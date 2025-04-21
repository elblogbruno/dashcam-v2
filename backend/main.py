from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import os
import time
import sys
import logging
from datetime import datetime
from typing import Set, Dict, Optional

# Configurar logging más detallado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("../backend_log.txt")
    ]
)
logger = logging.getLogger("dashcam-api")
logger.info("====== INICIANDO SERVIDOR FASTAPI ======")

# Import configuration
from config import config
logger.info(f"Configuración cargada: data_path={config.data_path}")

# Import our modules
try:
    logger.info("Importando módulos...")
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
    logger.info("Módulos importados correctamente")
except Exception as e:
    logger.error(f"Error importando módulos: {e}", exc_info=True)
    raise

# Import routes
try:
    logger.info("Importando rutas...")
    from routes import router as api_router
    logger.info("Rutas importadas correctamente")
except Exception as e:
    logger.error(f"Error importando rutas: {e}", exc_info=True)
    raise

try:
    logger.info("Creando aplicación FastAPI...")
    app = FastAPI(title="Smart Dashcam API")
    
    # Add CORS middleware to allow the frontend to access the API
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allows all origins
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
    )
    logger.info("Middleware CORS configurado")

    # Inicializa los componentes con manejo de excepciones
    logger.info("Inicializando componentes...")
    
    # Initialize our components with proper configuration
    camera_manager = CameraManager()
    logger.info("CameraManager inicializado")
    
    gps_reader = GPSReader()
    logger.info("GPSReader inicializado")
    
    trip_logger = TripLogger(db_path=config.db_path)
    logger.info("TripLogger inicializado")
    
    landmark_checker = LandmarkChecker(landmarks_file=config.landmarks_path)
    logger.info("LandmarkChecker inicializado")
    
    audio_notifier = AudioNotifier()
    logger.info("AudioNotifier inicializado")
    
    video_maker = VideoMaker(data_path=config.data_path)
    logger.info("VideoMaker inicializado")
    
    shutdown_monitor = ShutdownMonitor()
    logger.info("ShutdownMonitor inicializado")
    
    disk_manager = DiskManager(
        data_path=config.data_path,
        db_path=config.db_path,
        settings_path=config.storage_settings_path
    )
    logger.info("DiskManager inicializado")
except Exception as e:
    logger.error(f"Error inicializando componentes: {e}", exc_info=True)
    raise

# Global state
is_recording = False
current_location = {"lat": 0.0, "lon": 0.0, "speed": 0.0}
active_landmark = None
connected_clients: Set[WebSocket] = set()

# Track landmark announcements to avoid repetitive announcements
landmark_announcements: Dict[str, int] = {}  # {landmark_id: announcement_count}
last_announcement_time: Dict[str, float] = {}  # {landmark_id: timestamp}

# Initialize route modules with the necessary components
try:
    logger.info("Configurando módulos de rutas...")
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
    logger.info("Rutas configuradas correctamente")
except Exception as e:
    logger.error(f"Error configurando módulos de rutas: {e}", exc_info=True)
    raise

# Include the API router
try:
    logger.info("Incluyendo router API...")
    app.include_router(api_router)
    logger.info("Router API incluido correctamente")
except Exception as e:
    logger.error(f"Error incluyendo router API: {e}", exc_info=True)
    raise

# Register modules with the settings manager to receive updates
def initialize_settings_subscriptions():
    """Register all modules with the settings manager to receive updates"""
    logger.info("Inicializando suscripciones de configuración...")
    
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
    logger.info("Suscripciones de configuración inicializadas")

# WebSocket connections for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info(f"Nueva conexión WebSocket. Total de clientes: {len(connected_clients)}")
    
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except Exception as e:
        logger.info(f"Cliente WebSocket desconectado: {str(e)}")
        # Client disconnected
        connected_clients.remove(websocket)

# Background task to update location and check landmarks
@app.on_event("startup")
async def startup_event():
    logger.info("Evento de inicio ejecutándose...")
    # Initialize settings subscriptions
    initialize_settings_subscriptions()
    
    # Start background tasks
    logger.info("Iniciando tarea de actualización de ubicación...")
    asyncio.create_task(update_location_task())
    
    # Start the shutdown monitor in a separate thread
    logger.info("Iniciando monitor de apagado...")
    shutdown_monitor.start_monitoring()
    
    logger.info("Evento de inicio completado")

async def update_location_task():
    global current_location, active_landmark, is_recording, landmark_announcements, last_announcement_time
    logger.info("Tarea de actualización de ubicación iniciada")
    
    while True:
        try:
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
                
                for client in list(connected_clients):
                    try:
                        await client.send_json(message)
                    except Exception as e:
                        logger.warning(f"Error enviando actualización a cliente WebSocket: {str(e)}")
                        connected_clients.remove(client)
        except Exception as e:
            logger.error(f"Error en tarea de actualización de ubicación: {str(e)}", exc_info=True)
            
        await asyncio.sleep(1)  # Update every second

try:
    # Mount the static frontend files
    logger.info("Montando archivos estáticos del frontend...")
    frontend_path = "../frontend/dist"
    if os.path.exists(frontend_path):
        app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
        logger.info(f"Frontend montado desde: {frontend_path}")
    else:
        logger.warning(f"Directorio del frontend no encontrado: {frontend_path}")
except Exception as e:
    logger.error(f"Error montando archivos estáticos: {e}", exc_info=True)

# Cleanup on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Evento de apagado ejecutándose...")
    # Stop the settings manager's watcher thread
    settings_manager.stop()
    
    # Perform any other necessary cleanup
    if camera_manager:
        camera_manager.cleanup()
    logger.info("Evento de apagado completado")

if __name__ == "__main__":
    try:
        logger.info("Iniciando servidor Uvicorn en puerto 8000...")
        print("Iniciando servidor Uvicorn en puerto 8000...")
        uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="info")
    except Exception as e:
        logger.critical(f"Error fatal al iniciar Uvicorn: {e}", exc_info=True)
        print(f"Error fatal al iniciar Uvicorn: {e}")
        sys.exit(1)