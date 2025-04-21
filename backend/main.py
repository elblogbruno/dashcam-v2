from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import os
import time
from datetime import datetime
from typing import Set, Dict, Optional

# Import configuration
from config import config

# Import our modules
from camera_manager import CameraManager
from gps_reader import GPSReader
from landmark_checker import LandmarkChecker
from audio_notifier import AudioNotifier
from trip_logger import TripLogger
from video_maker import VideoMaker
from shutdown_monitor import ShutdownMonitor
from disk_manager import DiskManager
from settings_manager import settings_manager  # Import the settings manager
from data_persistence import get_persistence_manager  # Import our new persistence manager

# Import routes
from routes import router as api_router

app = FastAPI(title="Smart Dashcam API")

# Add CORS middleware to allow the frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize our components with proper configuration
camera_manager = CameraManager()
gps_reader = GPSReader()
trip_logger = TripLogger(db_path=config.db_path)
landmark_checker = LandmarkChecker(landmarks_file=config.landmarks_path)
audio_notifier = AudioNotifier()
video_maker = VideoMaker(data_path=config.data_path)
shutdown_monitor = ShutdownMonitor()
disk_manager = DiskManager(
    data_path=config.data_path,
    db_path=config.db_path,
    settings_path=config.storage_settings_path
)

# Global state
is_recording = False
current_location = {"lat": 0.0, "lon": 0.0, "speed": 0.0}
active_landmark = None
connected_clients: Set[WebSocket] = set()

# Track landmark announcements to avoid repetitive announcements
landmark_announcements: Dict[str, int] = {}  # {landmark_id: announcement_count}
last_announcement_time: Dict[str, float] = {}  # {landmark_id: timestamp}

# Initialize route modules with the necessary components
import routes.recording as recording_routes
import routes.landmarks as landmarks_routes
import routes.trips as trips_routes
import routes.storage as storage_routes
import routes.system as system_routes
import routes.videos as videos_routes
import routes.trip_planner as trip_planner_routes
import routes.settings as settings_routes

# Set up shared components in the route modules
recording_routes.camera_manager = camera_manager
recording_routes.trip_logger = trip_logger
recording_routes.is_recording = is_recording

landmarks_routes.landmark_checker = landmark_checker

trips_routes.trip_logger = trip_logger

storage_routes.disk_manager = disk_manager

system_routes.camera_manager = camera_manager
system_routes.gps_reader = gps_reader

videos_routes.trip_logger = trip_logger
videos_routes.video_maker = video_maker
videos_routes.config = config

# Initialize trip planner routes
trip_planner_routes.landmark_checker = landmark_checker
trip_planner_routes.trip_logger = trip_logger
trip_planner_routes.config = config
trip_planner_routes.initialize() # Call the new initialize function to load saved trips

# Initialize settings routes
settings_routes.config = config

# Include the API router
app.include_router(api_router)

# Register modules with the settings manager to receive updates
def initialize_settings_subscriptions():
    """Register all modules with the settings manager to receive updates"""
    # Audio settings for the audio notifier
    settings_manager.register_module(
        "audio_notifier", 
        "audio", 
        audio_notifier.apply_settings
    )
    
    # Video settings for the camera manager
    settings_manager.register_module(
        "camera_manager", 
        "video", 
        camera_manager.apply_settings
    )
    
    # Storage settings for the disk manager
    settings_manager.register_module(
        "disk_manager", 
        "storage", 
        disk_manager.apply_settings
    )
    
    # WiFi settings (if applicable to your system)
    # Add more modules as needed

# WebSocket connections for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except Exception:
        # Client disconnected
        connected_clients.remove(websocket)

# Background task to update location and check landmarks
@app.on_event("startup")
async def startup_event():
    # Initialize settings subscriptions
    initialize_settings_subscriptions()
    
    # Start background tasks
    asyncio.create_task(update_location_task())
    
    # Start the shutdown monitor in a separate thread
    shutdown_monitor.start_monitoring()

async def update_location_task():
    global current_location, active_landmark, is_recording, landmark_announcements, last_announcement_time
    
    while True:
        # Update GPS location
        location = gps_reader.get_location()
        if location:
            current_location = location
            
            # Check for nearby landmarks
            nearby = landmark_checker.check_nearby(location["lat"], location["lon"])
            if nearby:
                active_landmark = nearby
                landmark_id = str(nearby.get("id", nearby.get("name", "")))
                
                # Log the landmark encounter (this still happens every time)
                trip_logger.add_landmark_encounter(nearby)
                
                # Check if we need to announce this landmark
                current_time = time.time()
                announcement_count = landmark_announcements.get(landmark_id, 0)
                last_time = last_announcement_time.get(landmark_id, 0)
                
                # Only announce if we haven't announced twice yet
                # and at least 10 seconds have passed since the last announcement
                if announcement_count < 2 and (current_time - last_time) > 10:
                    audio_notifier.announce(f"Approaching {nearby['name']}")
                    landmark_announcements[landmark_id] = announcement_count + 1
                    last_announcement_time[landmark_id] = current_time
            else:
                # No nearby landmark - reset active landmark
                if active_landmark:
                    active_landmark = None
            
            # Include camera status in message
            camera_status = {
                "road_camera": camera_manager.road_camera is not None,
                "interior_camera": camera_manager.interior_camera is not None,
                "errors": getattr(camera_manager, "camera_errors", [])
            }
                
            # Broadcast updates to all connected clients
            message = {
                "type": "status_update",
                "location": current_location,
                "landmark": active_landmark,
                "recording": is_recording,
                "camera_status": camera_status
            }
            for client in connected_clients:
                try:
                    await client.send_json(message)
                except Exception:
                    connected_clients.remove(client)
        
        await asyncio.sleep(1)  # Update every second

# Mount the static frontend files
app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="frontend")

# Cleanup on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    # Stop the settings manager's watcher thread
    settings_manager.stop()
    
    # Perform any other necessary cleanup
    if camera_manager:
        camera_manager.cleanup()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)