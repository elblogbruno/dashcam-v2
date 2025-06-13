from fastapi import APIRouter, HTTPException
from typing import Dict
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# These will be initialized from main.py
camera_manager = None
trip_logger = None
is_recording = False

# Route to start recording
@router.post("/start")
async def start_recording():
    global is_recording
    logger.info(f"Start recording request received. Current state: {is_recording}")
    if not is_recording:
        success = camera_manager.start_recording()
        if success:
            is_recording = True
            # El trip_id ya se establece dentro de camera_manager.start_recording()
            return {"status": "success", "message": "Recording started"}
        return {"status": "error", "message": "Failed to start recording"}
    return {"status": "info", "message": "Already recording"}

# Route to stop recording
@router.post("/stop")
async def stop_recording():
    global is_recording
    logger.info(f"Stop recording request received. Current state: {is_recording}")
    
    if is_recording:
        # Finalizar el viaje
        trip_id = trip_logger.end_trip()
        logger.info(f"Trip ended with id: {trip_id}")
        
        # Obtener información de clips grabados y detener la grabación
        # Esto también guardará el último clip si es necesario
        completed_clips = camera_manager.stop_recording()
        is_recording = False
        
        # Verificar la base de datos después de detener la grabación
        try:
            # Use the new trip logger system to get video clip count
            videos = trip_logger.get_trip_videos(trip_id) if hasattr(trip_logger, 'get_trip_videos') else []
            count = len(videos)
            logger.info(f"Database now has {count} clips for trip {trip_id}")
        except Exception as e:
            logger.error(f"Error verifying database: {e}")
        
        return {
            "status": "success", 
            "message": "Recording stopped", 
            "clips_count": len(completed_clips) if completed_clips else 0,
            "trip_id": trip_id
        }
    return {"status": "info", "message": "Not recording"}

# Route to get recording status
@router.get("/status")
async def recording_status():
    return {"recording": is_recording}

# Route to debug database 
@router.get("/debug-db")
async def debug_database():
    """Endpoint para depurar la base de datos y verificar el contenido de las tablas importantes"""
    try:
        # Use the new trip logger system for database debugging
        all_trips = trip_logger.get_all_trips(limit=10)
        trips_count = len(trip_logger.get_all_trips(limit=None))
        
        # Get video clips count (if method exists)
        clips_count = 0
        recent_clips = []
        
        # Format recent trips for response
        recent_trips = []
        for trip in all_trips:
            trip_dict = trip if isinstance(trip, dict) else {
                'id': getattr(trip, 'id', None),
                'start_time': getattr(trip, 'start_time', None),
                'end_time': getattr(trip, 'end_time', None)
            }
            
            # Get clips count for this trip if possible
            if hasattr(trip_logger, 'get_trip_videos'):
                trip_videos = trip_logger.get_trip_videos(trip_dict['id'])
                trip_dict['clips_count'] = len(trip_videos)
                clips_count += len(trip_videos)
                
                # Add recent clips
                for video in trip_videos[:5]:  # Limit to 5 per trip
                    if len(recent_clips) < 10:  # Total limit of 10
                        video_dict = video if isinstance(video, dict) else {
                            'id': getattr(video, 'id', None),
                            'trip_id': getattr(video, 'trip_id', None),
                            'start_time': getattr(video, 'start_time', None),
                            'end_time': getattr(video, 'end_time', None),
                            'sequence_num': getattr(video, 'sequence_num', None),
                            'quality': getattr(video, 'quality', None),
                            'road_video_file': getattr(video, 'road_video_file', None),
                            'interior_video_file': getattr(video, 'interior_video_file', None)
                        }
                        recent_clips.append(video_dict)
            else:
                trip_dict['clips_count'] = 0
                
            recent_trips.append(trip_dict)
        
        return {
            "db_path": trip_logger.db_path,
            "trips_count": trips_count,
            "clips_count": clips_count,
            "recent_trips": recent_trips,
            "recent_clips": recent_clips,
            "using_new_system": True
        }
    except Exception as e:
        logger.error(f"Error depurando base de datos: {e}")
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "using_new_system": True
        }