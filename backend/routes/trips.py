from fastapi import APIRouter, HTTPException
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional
import json
import sqlite3

router = APIRouter()

# Will be initialized from main.py
trip_logger = None
auto_trip_manager = None

# Route to get all trips
@router.get("")
async def get_trips(date_str: Optional[str] = None):
    if date_str:
        try:
            selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            trips = trip_logger.get_trips_by_date(selected_date)
            
            # Buscar clips de video para este día
            try:
                conn = sqlite3.connect(trip_logger.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Obtener clips para este día
                cursor.execute('''
                SELECT vc.id, vc.trip_id, vc.start_time, vc.end_time, 
                       vc.sequence_num, vc.quality, vc.road_video_file, 
                       vc.interior_video_file, t.start_time as trip_start_time
                FROM video_clips vc
                LEFT JOIN trips t ON vc.trip_id = t.id
                WHERE date(vc.start_time) = ?
                ORDER BY vc.start_time
                ''', (selected_date.isoformat(),))
                
                video_clips = [dict(row) for row in cursor.fetchall()]
                
                # Obtener videos externos
                cursor.execute('''
                SELECT * FROM external_videos
                WHERE date = ?
                ''', (selected_date.isoformat(),))
                
                external_videos = [dict(row) for row in cursor.fetchall()]
                
                conn.close()
                
                # Incorporar los clips de video al resultado
                return {
                    "trips": trips, 
                    "video_clips": video_clips,
                    "external_videos": external_videos
                }
                
            except Exception as e:
                print(f"Error obteniendo clips de video: {e}")
                # Si hay un error, devolvemos solo los viajes
                return {"trips": trips}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        all_trips = trip_logger.get_all_trips()
        return {"trips": all_trips}

# Route to get trips by date range
@router.get("/range")
async def get_trips_range(start_date: str, end_date: str):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        trips = trip_logger.get_trips_by_date_range(start, end)
        return {"trips": trips}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

# Route to get trips by month for calendar view
@router.get("/calendar")
async def get_trips_by_month(year: int, month: int):
    try:
        # Usar el método get_calendar_data que ya existe en trip_logger
        # Este método devuelve datos en formato compatible con el calendario de frontend
        calendar_data = trip_logger.get_calendar_data(year, month)
        
        # Verificar si también hay datos de clips de video
        try:
            # Verificar cuántos clips de video hay por día en el mes
            conn = sqlite3.connect(trip_logger.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Primer día del mes
            start_date = date(year, month, 1)
            # Último día del mes
            if month == 12:
                end_date = date(year + 1, 1, 1)
            else:
                end_date = date(year, month + 1, 1)
            end_date = end_date - timedelta(days=1)
            
            # Contar clips por día
            cursor.execute('''
            SELECT date(start_time) as day, COUNT(*) as clip_count
            FROM video_clips
            WHERE date(start_time) >= ? AND date(start_time) <= ?
            GROUP BY day
            ''', (start_date.isoformat(), end_date.isoformat()))
            
            video_clips_by_day = {row['day']: row['clip_count'] for row in cursor.fetchall()}
            conn.close()
            
            # Incorporar datos de clips al resultado del calendario
            for date_str, day_data in calendar_data.items():
                # Añadir información sobre los clips de video a cada día
                day_data['video_clips'] = video_clips_by_day.get(date_str, 0)
                
                # Si no hay viajes pero hay clips, asegurarse de marcarlo como día con contenido
                if day_data['trips'] == 0 and video_clips_by_day.get(date_str, 0) > 0:
                    day_data['trips'] = 1
                
        except Exception as e:
            print(f"Error obteniendo datos de clips para el calendario: {e}")
            
        return calendar_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date parameters: {str(e)}")

# Route to start a trip manually
@router.post("/start")
async def start_trip(planned_trip_id: Optional[str] = None):
    try:
        # Use the auto_trip_manager to start the trip
        trip_id = auto_trip_manager.start_trip_manually(planned_trip_id)
        if trip_id:
            return {"status": "success", "trip_id": trip_id}
        else:
            raise HTTPException(status_code=400, detail="Failed to start trip - another trip may be in progress")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start trip: {str(e)}")

# Route to end a trip manually
@router.post("/end")
async def end_trip():
    try:
        # Use the auto_trip_manager to end the trip
        success = auto_trip_manager.end_trip()
        if success:
            return {"status": "success", "message": "Trip ended successfully"}
        else:
            raise HTTPException(status_code=404, detail="No active trip found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end trip: {str(e)}")

# Route to get active trip information
@router.get("/active")
async def get_active_trip():
    """Get information about the currently active trip"""
    active_trip = auto_trip_manager.get_active_trip_info()
    if active_trip:
        return {"status": "success", "active_trip": active_trip}
    else:
        return {"status": "success", "active_trip": None}

# Route to get trip statistics for dashboard
@router.get("/stats")
async def get_trip_stats(limit_recent: int = 5):
    try:
        # Get all trips for calculating statistics
        all_trips = trip_logger.get_all_trips(limit=None)
        
        # Initialize stats
        total_trips = len(all_trips)
        recording_time = 0
        distance_traveled = 0
        recent_trips = []
        
        # Calculate statistics
        for trip in all_trips:
            # Add distance if available
            if trip.get('distance_km'):
                distance_traveled += trip.get('distance_km')
            
            # Calculate recording time if start and end times are available
            if trip.get('start_time') and trip.get('end_time'):
                try:
                    start = datetime.fromisoformat(trip['start_time'])
                    end = datetime.fromisoformat(trip['end_time'])
                    duration = (end - start).total_seconds()
                    recording_time += duration
                except (ValueError, TypeError):
                    # Skip this trip if timestamps can't be parsed
                    pass
        
        # Get recent trips (limited number)
        recent_trips = all_trips[:limit_recent] if all_trips else []
        
        # Format recent trips to include only necessary data
        formatted_recent = []
        for trip in recent_trips:
            formatted_trip = {
                "id": trip.get('id'),
                "start_time": trip.get('start_time'),
                "end_time": trip.get('end_time'),
                "distance_km": trip.get('distance_km')
            }
            formatted_recent.append(formatted_trip)
            
        return {
            "total_trips": total_trips,
            "recording_time": int(recording_time),  # Return as seconds
            "distance_traveled": distance_traveled,
            "recent_trips": formatted_recent
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trip statistics: {str(e)}")