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
            import sqlite3
            conn = sqlite3.connect(trip_logger.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM video_clips WHERE trip_id = ?", (trip_id,))
            count = cursor.fetchone()[0]
            logger.info(f"Database now has {count} clips for trip {trip_id}")
            conn.close()
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
        import sqlite3
        conn = sqlite3.connect(trip_logger.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Contar registros en trips
        cursor.execute("SELECT COUNT(*) as count FROM trips")
        trips_count = cursor.fetchone()["count"]
        
        # Contar registros en video_clips
        cursor.execute("SELECT COUNT(*) as count FROM video_clips")
        clips_count = cursor.fetchone()["count"]
        
        # Obtener hasta 10 viajes más recientes
        cursor.execute("""
            SELECT id, start_time, end_time, 
            (SELECT COUNT(*) FROM video_clips WHERE trip_id = trips.id) as clips_count
            FROM trips 
            ORDER BY start_time DESC LIMIT 10
        """)
        recent_trips = [dict(trip) for trip in cursor.fetchall()]
        
        # Obtener hasta 10 clips más recientes
        cursor.execute("""
            SELECT id, trip_id, start_time, end_time, sequence_num, quality,
            road_video_file, interior_video_file
            FROM video_clips 
            ORDER BY start_time DESC LIMIT 10
        """)
        recent_clips = [dict(clip) for clip in cursor.fetchall()]
        
        conn.close()
        
        return {
            "db_path": trip_logger.db_path,
            "trips_count": trips_count,
            "clips_count": clips_count,
            "recent_trips": recent_trips,
            "recent_clips": recent_clips
        }
    except Exception as e:
        logger.error(f"Error depurando base de datos: {e}")
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }