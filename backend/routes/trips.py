import os
import logging
import glob
import re
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, List, Optional
import json

# Importamos los modelos SQLAlchemy necesarios
from trip_logger_package.models import VideoClipModel, ExternalVideoModel
from trip_logger_package.database import VideoRepository
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be initialized from main.py
trip_logger = None
auto_trip_manager = None
config = None
video_base_path = None
db_manager = None  # Variable para el gestor de la base de datos que proporciona sesiones SQLAlchemy

# Route to get all trips
@router.get("")
async def get_trips(date_str: Optional[str] = None):
    if date_str:
        try:
            selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            trips = trip_logger.get_trips_by_date(selected_date)
            
            # Buscar clips de video para este día usando el nuevo sistema
            try:
                video_clips = []
                external_videos = []
                
                # Get video clips for this date using the new system
                all_trips_for_date = trip_logger.get_trips_by_date(selected_date)
                
                for trip in all_trips_for_date:
                    trip_id = trip.get('id') if isinstance(trip, dict) else getattr(trip, 'id', None)
                    if trip_id and hasattr(trip_logger, 'get_trip_videos'):
                        trip_videos = trip_logger.get_trip_videos(trip_id)
                        for video in trip_videos:
                            # Convert to dict format for compatibility
                            video_dict = video if isinstance(video, dict) else {
                                'id': getattr(video, 'id', None),
                                'trip_id': getattr(video, 'trip_id', None),
                                'start_time': getattr(video, 'start_time', None),
                                'end_time': getattr(video, 'end_time', None),
                                'sequence_num': getattr(video, 'sequence_num', None),
                                'quality': getattr(video, 'quality', None),
                                'road_video_file': getattr(video, 'road_video_file', None),
                                'interior_video_file': getattr(video, 'interior_video_file', None),
                                'start_lat': getattr(video, 'start_lat', None),
                                'start_lon': getattr(video, 'start_lon', None),
                                'end_lat': getattr(video, 'end_lat', None),
                                'end_lon': getattr(video, 'end_lon', None),
                                'landmark_type': getattr(video, 'landmark_type', None),
                                'location': getattr(video, 'location', None)
                            }
                            # Add trip start time for compatibility
                            trip_start = trip.get('start_time') if isinstance(trip, dict) else getattr(trip, 'start_time', None)
                            video_dict['trip_start_time'] = trip_start
                            video_clips.append(video_dict)
                
                # Buscar videos adicionales directamente en la base de datos usando SQLAlchemy
                additional_videos = get_videos_by_date_from_db(selected_date)
                if additional_videos:
                    # Añadir los videos a la lista existente, evitando duplicados
                    existing_ids = {clip.get('id') for clip in video_clips}
                    for video in additional_videos:
                        if video.get('id') not in existing_ids:
                            video_clips.append(video)
                    
                    logger.info(f"Found {len(additional_videos)} additional video clips for date {date_str}")
                
                # Buscar videos externos en la base de datos
                ext_videos = get_external_videos_by_date_from_db(selected_date)
                if ext_videos:
                    external_videos = ext_videos
                    logger.info(f"Found {len(external_videos)} external videos for date {date_str}")
                
                # Incorporar los clips de video al resultado
                return {
                    "trips": trips, 
                    "video_clips": video_clips,
                    "external_videos": external_videos,
                    "using_new_system": True
                }
                
            except Exception as e:
                logger.error(f"Error obteniendo clips de video: {e}")
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
        
        # Verificar si también hay datos de clips de video usando el nuevo sistema
        try:
            # Get video clips count by day using the new system
            video_clips_by_day = {}
            
            # Get all trips for the month
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
            
            month_trips = trip_logger.get_trips_by_date_range(start_date, end_date)
            
            for trip in month_trips:
                trip_id = trip.get('id') if isinstance(trip, dict) else getattr(trip, 'id', None)
                trip_start = trip.get('start_time') if isinstance(trip, dict) else getattr(trip, 'start_time', None)
                
                if trip_id and trip_start and hasattr(trip_logger, 'get_trip_videos'):
                    try:
                        # Parse the start time to get the date
                        if isinstance(trip_start, str):
                            trip_date = datetime.fromisoformat(trip_start.replace('Z', '+00:00')).date()
                        else:
                            trip_date = trip_start.date() if hasattr(trip_start, 'date') else trip_start
                        
                        day_str = trip_date.isoformat()
                        
                        trip_videos = trip_logger.get_trip_videos(trip_id)
                        if day_str not in video_clips_by_day:
                            video_clips_by_day[day_str] = 0
                        video_clips_by_day[day_str] += len(trip_videos)
                    except Exception as e:
                        print(f"Error processing trip {trip_id}: {e}")
                        continue
            
            # Incorporar datos de clips al resultado del calendario
            for date_str, day_data in calendar_data.items():
                # Añadir información sobre los clips de video a cada día
                clips_count = video_clips_by_day.get(date_str, 0)
                if isinstance(day_data, dict):
                    day_data['video_clips'] = clips_count
                    
                    # Si no hay viajes pero hay clips, asegurarse de marcarlo como día con contenido
                    if day_data.get('trips', 0) == 0 and clips_count > 0:
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
            # Handle both dict and object formats
            if isinstance(trip, dict):
                distance_km = trip.get('distance_km')
                start_time = trip.get('start_time')
                end_time = trip.get('end_time')
            else:
                # SQLAlchemy object
                distance_km = getattr(trip, 'distance_km', None)
                start_time = getattr(trip, 'start_time', None)
                end_time = getattr(trip, 'end_time', None)
            
            # Add distance if available
            if distance_km:
                distance_traveled += distance_km
            
            # Calculate recording time if start and end times are available
            if start_time and end_time:
                try:
                    if isinstance(start_time, str):
                        start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                    else:
                        start = start_time
                    
                    if isinstance(end_time, str):
                        end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                    else:
                        end = end_time
                    
                    duration = (end - start).total_seconds()
                    recording_time += duration
                except (ValueError, TypeError, AttributeError):
                    # Skip this trip if timestamps can't be parsed
                    pass
        
        # Get recent trips (limited number)
        recent_trips = all_trips[:limit_recent] if all_trips else []
        
        # Format recent trips to include only necessary data
        formatted_recent = []
        for trip in recent_trips:
            if isinstance(trip, dict):
                formatted_trip = {
                    "id": trip.get('id'),
                    "start_time": trip.get('start_time'),
                    "end_time": trip.get('end_time'),
                    "distance_km": trip.get('distance_km')
                }
            else:
                # SQLAlchemy object
                formatted_trip = {
                    "id": getattr(trip, 'id', None),
                    "start_time": getattr(trip, 'start_time', None),
                    "end_time": getattr(trip, 'end_time', None),
                    "distance_km": getattr(trip, 'distance_km', None)
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

def get_videos_by_date_from_db(target_date: date) -> List[Dict]:
    """
    Consulta la tabla video_clips usando SQLAlchemy para encontrar videos
    que corresponden a la fecha especificada, independientemente de si están asociados a viajes.
    """
    if not db_manager:
        logger.error("Error: db_manager is not configured")
        return []
    
    videos = []
    date_str = target_date.strftime("%Y-%m-%d")
    start_datetime = datetime.combine(target_date, datetime.min.time())
    end_datetime = datetime.combine(target_date, datetime.max.time())
    
    # Log de depuración para verificar formatos de fecha
    logger.info(f"Buscando videos para fecha: {date_str}, start: {start_datetime.isoformat()}, end: {end_datetime.isoformat()}")
    
    try:
        with db_manager.session_scope() as session:
            # Consultar videos por fecha usando SQLAlchemy con múltiples estrategias
            # 1. Utilizamos func.date() para extraer solo la fecha y compararla directamente
            date_query = session.query(VideoClipModel).filter(
                or_(
                    func.date(VideoClipModel.start_time) == target_date,
                    func.date(VideoClipModel.end_time) == target_date
                )
            )
            
            # 2. También usamos el rango completo de la fecha como respaldo
            range_query = session.query(VideoClipModel).filter(
                or_(
                    # Videos que empiezan en la fecha objetivo
                    and_(
                        VideoClipModel.start_time >= start_datetime,
                        VideoClipModel.start_time <= end_datetime
                    ),
                    # Videos que terminan en la fecha objetivo
                    and_(
                        VideoClipModel.end_time >= start_datetime,
                        VideoClipModel.end_time <= end_datetime
                    ),
                    # Videos que abarcan toda la fecha (empiezan antes y terminan después)
                    and_(
                        VideoClipModel.start_time < start_datetime,
                        VideoClipModel.end_time > end_datetime
                    )
                )
            )
            
            # 3. Buscar mediante cadenas de texto en la ruta del archivo
            # Esto es útil para encontrar videos almacenados en carpetas por fecha
            path_query = session.query(VideoClipModel).filter(
                or_(
                    VideoClipModel.road_video_file.like(f"%/{date_str}/%"),
                    VideoClipModel.interior_video_file.like(f"%/{date_str}/%"),
                    # También buscar con formato de fecha YYYY-MM-DD
                    VideoClipModel.road_video_file.like(f"%/{target_date.year}-{target_date.month:02d}-{target_date.day:02d}/%"),
                    VideoClipModel.interior_video_file.like(f"%/{target_date.year}-{target_date.month:02d}-{target_date.day:02d}/%")
                )
            )
            
            # Combinar todos los resultados y eliminar duplicados
            date_results = date_query.all()
            range_results = range_query.all()
            path_results = path_query.all()
            
            # Usar un diccionario para eliminar duplicados por ID
            unique_videos = {}
            for video_list in [date_results, range_results, path_results]:
                for video in video_list:
                    if video.id not in unique_videos:
                        unique_videos[video.id] = video
            
            video_models = list(unique_videos.values())
            logger.info(f"Found {len(video_models)} videos in video_clips table for date {date_str}")
            
            # Consulta de depuración directa si no se encontraron resultados
            if len(video_models) == 0:
                try:
                    # Consulta directa con SQL para verificar - usando text() para SQLAlchemy moderno
                    from sqlalchemy import text
                    raw_result = session.execute(text(f"SELECT id FROM video_clips WHERE date(start_time) = '{date_str}' OR date(end_time) = '{date_str}'")).fetchall()
                    if raw_result:
                        logger.warning(f"¡ATENCIÓN! Se encontraron {len(raw_result)} videos con SQL directo pero 0 con SQLAlchemy - IDs: {[r[0] for r in raw_result]}")
                        
                        # Si encontramos algo con SQL directo, intentamos cargar esos modelos
                        for row in raw_result:
                            video_id = row[0]
                            direct_video = session.query(VideoClipModel).get(video_id)
                            if direct_video:
                                unique_videos[video_id] = direct_video
                        
                        # Actualizar la lista de video_models
                        video_models = list(unique_videos.values())
                        logger.info(f"Recuperados {len(video_models)} videos mediante SQL directo")
                except Exception as sql_error:
                    logger.error(f"Error en consulta SQL directa: {sql_error}")
            
            # Convertir modelos SQLAlchemy a diccionarios
            for video in video_models:
                video_dict = {
                    'id': video.id,
                    'trip_id': video.trip_id,
                    'start_time': video.start_time.isoformat() if video.start_time else None,
                    'end_time': video.end_time.isoformat() if video.end_time else None,
                    'sequence_num': video.sequence_num,
                    'quality': video.quality,
                    'road_video_file': video.road_video_file,
                    'interior_video_file': video.interior_video_file,
                    'start_lat': video.start_lat,
                    'start_lon': video.start_lon,
                    'end_lat': video.end_lat,
                    'end_lon': video.end_lon,
                    'landmark_type': video.landmark_type,
                    'location': video.location,
                    'near_landmark': video.near_landmark
                }
                videos.append(video_dict)
                
    except Exception as e:
        logger.error(f"Error getting videos from database: {e}")
        # Añadir más información sobre el error para depuración
        import traceback
        logger.error(f"Error trace: {traceback.format_exc()}")
    
    return videos

def get_external_videos_by_date_from_db(target_date: date) -> List[Dict]:
    """
    Consulta la tabla external_videos usando SQLAlchemy para encontrar videos
    que corresponden a la fecha especificada.
    """
    if not db_manager:
        logger.error("Error: db_manager is not configured")
        return []
    
    videos = []
    date_str = target_date.strftime("%Y-%m-%d")
    
    try:
        with db_manager.session_scope() as session:
            # Consultar videos externos por fecha usando SQLAlchemy de múltiples formas
            # para asegurarnos de que encontramos todos los videos relevantes:
            
            # 1. Consulta exacta por fecha (usando func.date() para extraer solo la fecha)
            query1 = session.query(ExternalVideoModel).filter(
                func.date(ExternalVideoModel.date) == target_date
            )
            
            # 2. Consulta alternativa por fecha (buscando en el rango completo del día)
            start_datetime = datetime.combine(target_date, datetime.min.time())
            end_datetime = datetime.combine(target_date, datetime.max.time())
            query2 = session.query(ExternalVideoModel).filter(
                and_(
                    ExternalVideoModel.date >= start_datetime,
                    ExternalVideoModel.date <= end_datetime
                )
            )
            
            # 3. Buscar también en la fecha de carga (upload_time)
            query3 = session.query(ExternalVideoModel).filter(
                and_(
                    ExternalVideoModel.upload_time >= start_datetime,
                    ExternalVideoModel.upload_time <= end_datetime
                )
            )
            
            # 4. Buscar por ruta de archivo en formato fecha
            query4 = session.query(ExternalVideoModel).filter(
                or_(
                    ExternalVideoModel.file_path.like(f"%/{date_str}/%"),
                    ExternalVideoModel.file_path.like(f"%/{target_date.year}-{target_date.month:02d}-{target_date.day:02d}/%")
                )
            )
            
            # 5. Buscar usando strftime en SQLite para comparar la fecha como cadena
            query5 = session.query(ExternalVideoModel).filter(
                or_(
                    func.strftime('%Y-%m-%d', ExternalVideoModel.date) == date_str,
                    func.strftime('%Y-%m-%d', ExternalVideoModel.upload_time) == date_str
                )
            )
            
            # Combinar resultados y eliminar duplicados (por id)
            results1 = query1.all()
            results2 = query2.all()
            results3 = query3.all()
            results4 = query4.all()
            results5 = query5.all()
            
            # Usar un conjunto para evitar duplicados por ID
            unique_videos = {}
            for video_list in [results1, results2, results3, results4, results5]:
                for video in video_list:
                    if video.id not in unique_videos:
                        unique_videos[video.id] = video
            
            external_videos = list(unique_videos.values())
            
            logger.info(f"Found {len(external_videos)} unique videos in external_videos table for date {date_str}")
            
            # Convertir modelos SQLAlchemy a diccionarios
            for video in external_videos:
                # Intentar deserializar tags si están en formato JSON
                tags = video.tags
                if tags and isinstance(tags, str):
                    try:
                        import json
                        tags_dict = json.loads(tags)
                    except json.JSONDecodeError:
                        tags_dict = tags
                else:
                    tags_dict = tags
                    
                video_dict = {
                    'id': video.id,
                    'file_path': video.file_path,
                    'lat': video.lat,
                    'lon': video.lon,
                    'source': video.source,
                    'tags': tags_dict,
                    'upload_time': video.upload_time.isoformat() if video.upload_time else None,
                    'isExternalVideo': True,  # Marcar como video externo para el frontend
                    'timestamp': video.date.isoformat() if video.date else f"{date_str}T00:00:00.000Z"
                }
                videos.append(video_dict)
                
    except Exception as e:
        logger.error(f"Error getting external videos from database: {e}")
        import traceback
        logger.error(f"Error trace: {traceback.format_exc()}")
    
    return videos

# Esta función se mantiene para compatibilidad, pero ahora delegamos a get_videos_by_date_from_db
def scan_videos_by_date(target_date: date) -> List[Dict]:
    """
    Esta función ahora delega a get_videos_by_date_from_db para mantener la compatibilidad
    con el código existente.
    """
    logger.info("Deprecated scan_videos_by_date called, delegating to database query")
    
    # Llamar a la nueva función que usa SQLAlchemy
    videos = get_videos_by_date_from_db(target_date)
    
    # También podemos intentar obtener videos externos si es necesario
    try:
        external_videos = get_external_videos_by_date_from_db(target_date)
        # Combinar los resultados si hay videos externos
        if external_videos:
            videos.extend(external_videos)
            logger.info(f"Added {len(external_videos)} external videos to scan result")
    except Exception as e:
        logger.error(f"Error getting external videos in scan_videos_by_date: {e}")
    
    return videos