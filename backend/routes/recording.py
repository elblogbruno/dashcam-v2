from fastapi import APIRouter, HTTPException
from typing import Dict

router = APIRouter()

# These will be initialized from main.py
camera_manager = None
trip_logger = None
is_recording = False

# Route to start recording
@router.post("/start")
async def start_recording():
    global is_recording
    if not is_recording:
        success = camera_manager.start_recording()
        if success:
            is_recording = True
            trip_logger.start_trip()
            return {"status": "success", "message": "Recording started"}
        return {"status": "error", "message": "Failed to start recording"}
    return {"status": "info", "message": "Already recording"}

# Route to stop recording
@router.post("/stop")
async def stop_recording():
    global is_recording
    if is_recording:
        # Obtener información de clips grabados
        completed_clips = camera_manager.stop_recording()
        if completed_clips:
            is_recording = False
            # Finalizar el viaje y obtener el ID
            trip_id = trip_logger.end_trip()
            
            # Registrar los clips en la base de datos
            if trip_id:
                trip_logger.add_video_clips(trip_id, completed_clips)
                
            return {"status": "success", "message": "Recording stopped", "clips_count": len(completed_clips)}
        return {"status": "error", "message": "Failed to stop recording"}
    return {"status": "info", "message": "Not recording"}

# Route to get recording status
@router.get("/status")
async def recording_status():
    return {"recording": is_recording}