"""
Repository pattern for database operations
"""

import logging
import os
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, asc

from ..models.db_models import (
    Trip as TripModel,
    GpsCoordinate as GpsCoordinateModel,
    LandmarkEncounter as LandmarkEncounterModel,
    VideoClip as VideoClipModel,
    ExternalVideo as ExternalVideoModel,
    QualityUpgrade as QualityUpgradeModel
)
from ..models.schemas import (
    TripCreateRequest,
    GpsCoordinateRequest,
    LandmarkEncounterRequest,
    VideoClipRequest,
    ExternalVideoRequest
)

logger = logging.getLogger(__name__)


class TripRepository:
    """Repository for trip-related database operations"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create_trip(self, trip_data: TripCreateRequest) -> TripModel:
        """Create a new trip"""
        try:
            trip = TripModel(
                start_time=datetime.utcnow(),
                start_lat=trip_data.start_lat,
                start_lon=trip_data.start_lon,
                planned_trip_id=trip_data.planned_trip_id
            )
            
            self.session.add(trip)
            self.session.flush()  # Get the ID without committing
            
            logger.info(f"Created new trip with ID: {trip.id}" + 
                       (f" (Planned trip: {trip_data.planned_trip_id})" if trip_data.planned_trip_id else ""))
            return trip
            
        except Exception as e:
            logger.error(f"Error creating trip: {str(e)}")
            raise
    
    def get_trip_by_id(self, trip_id: int) -> Optional[TripModel]:
        """Get trip by ID"""
        try:
            return self.session.query(TripModel).filter(TripModel.id == trip_id).first()
        except Exception as e:
            logger.error(f"Error getting trip {trip_id}: {str(e)}")
            return None
    
    def end_trip(self, trip_id: int, end_lat: Optional[float] = None, end_lon: Optional[float] = None) -> bool:
        """End a trip"""
        try:
            trip = self.get_trip_by_id(trip_id)
            if not trip:
                logger.warning(f"Trip {trip_id} not found")
                return False
            
            trip.end_time = datetime.utcnow()
            if end_lat is not None:
                trip.end_lat = end_lat
            if end_lon is not None:
                trip.end_lon = end_lon
            
            self.session.flush()
            logger.info(f"Ended trip {trip_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error ending trip {trip_id}: {str(e)}")
            return False
    
    def update_trip_location(self, trip_id: int, lat: float, lon: float, is_start: bool = False) -> bool:
        """Update trip location"""
        try:
            trip = self.get_trip_by_id(trip_id)
            if not trip:
                return False
            
            if is_start:
                trip.start_lat = lat
                trip.start_lon = lon
            else:
                trip.end_lat = lat
                trip.end_lon = lon
            
            self.session.flush()
            return True
            
        except Exception as e:
            logger.error(f"Error updating trip location: {str(e)}")
            return False
    
    def get_all_trips(self, limit: Optional[int] = None) -> List[TripModel]:
        """Get all trips ordered by start time"""
        try:
            query = self.session.query(TripModel).order_by(desc(TripModel.start_time))
            
            if limit:
                query = query.limit(limit)
            
            return query.all()
            
        except Exception as e:
            logger.error(f"Error getting all trips: {str(e)}")
            return []
    
    def get_trips_by_date(self, target_date: date) -> List[TripModel]:
        """Get trips for a specific date"""
        try:
            start_datetime = datetime.combine(target_date, datetime.min.time())
            end_datetime = datetime.combine(target_date, datetime.max.time())
            
            return self.session.query(TripModel).filter(
                and_(
                    TripModel.start_time >= start_datetime,
                    TripModel.start_time <= end_datetime
                )
            ).order_by(TripModel.start_time).all()
            
        except Exception as e:
            logger.error(f"Error getting trips by date {target_date}: {str(e)}")
            return []
    
    def get_trips_by_date_range(self, start_date: date, end_date: date) -> List[TripModel]:
        """Get trips within a date range"""
        try:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            return self.session.query(TripModel).filter(
                and_(
                    TripModel.start_time >= start_datetime,
                    TripModel.start_time <= end_datetime
                )
            ).order_by(TripModel.start_time).all()
            
        except Exception as e:
            logger.error(f"Error getting trips by date range: {str(e)}")
            return []
    
    def get_active_trip(self) -> Optional[TripModel]:
        """Get currently active trip (no end time)"""
        try:
            return self.session.query(TripModel).filter(
                TripModel.end_time.is_(None)
            ).order_by(desc(TripModel.start_time)).first()
            
        except Exception as e:
            logger.error(f"Error getting active trip: {str(e)}")
            return None
    
    def get_trip_with_details(self, trip_id: int) -> Optional[TripModel]:
        """Get trip with all related data"""
        try:
            return self.session.query(TripModel).options(
                joinedload(TripModel.gps_coordinates),
                joinedload(TripModel.landmark_encounters),
                joinedload(TripModel.video_clips),
                joinedload(TripModel.quality_upgrades)
            ).filter(TripModel.id == trip_id).first()
            
        except Exception as e:
            logger.error(f"Error getting trip details: {str(e)}")
            return None
    
    def get_calendar_data(self, year: int, month: int) -> Dict[str, Dict[str, Any]]:
        """Get calendar data with trip counts by day"""
        try:
            # Calculate first and last day of month
            first_day = date(year, month, 1)
            if month == 12:
                last_day = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                last_day = date(year, month + 1, 1) - timedelta(days=1)
            
            # Query trip counts by day
            results = self.session.query(
                func.date(TripModel.start_time).label('day'),
                func.count().label('trip_count')
            ).filter(
                and_(
                    func.date(TripModel.start_time) >= first_day,
                    func.date(TripModel.start_time) <= last_day
                )
            ).group_by(func.date(TripModel.start_time)).all()
            
            # Convert to dictionary
            trips_by_day = {str(row.day): row.trip_count for row in results}
            
            # Create calendar structure
            calendar_data = {}
            current_day = first_day
            
            while current_day <= last_day:
                day_str = current_day.isoformat()
                calendar_data[day_str] = {
                    'trips': trips_by_day.get(day_str, 0),
                    'date': day_str
                }
                current_day += timedelta(days=1)
            
            return calendar_data
            
        except Exception as e:
            logger.error(f"Error getting calendar data: {str(e)}")
            return {}
    
    def get_trips_by_planned_trip_id(self, planned_trip_id: str) -> List[TripModel]:
        """Get trips for a specific planned trip ID"""
        try:
            return self.session.query(TripModel).filter(
                TripModel.planned_trip_id == planned_trip_id
            ).order_by(TripModel.start_time).all()
            
        except Exception as e:
            logger.error(f"Error getting trips by planned trip ID {planned_trip_id}: {str(e)}")
            return []


class GpsRepository:
    """Repository for GPS-related database operations"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def log_coordinate(self, trip_id: int, gps_data: GpsCoordinateRequest) -> GpsCoordinateModel:
        """Log a GPS coordinate"""
        try:
            coordinate = GpsCoordinateModel(
                trip_id=trip_id,
                timestamp=datetime.utcnow(),
                latitude=gps_data.latitude,
                longitude=gps_data.longitude,
                altitude=gps_data.altitude,
                speed=gps_data.speed,
                heading=gps_data.heading,
                satellites=gps_data.satellites,
                fix_quality=gps_data.fix_quality.value if gps_data.fix_quality else None
            )
            
            self.session.add(coordinate)
            self.session.flush()
            
            return coordinate
            
        except Exception as e:
            logger.error(f"Error logging GPS coordinate: {str(e)}")
            raise
    
    def get_trip_coordinates(self, trip_id: int) -> List[GpsCoordinateModel]:
        """Get all GPS coordinates for a trip"""
        try:
            return self.session.query(GpsCoordinateModel).filter(
                GpsCoordinateModel.trip_id == trip_id
            ).order_by(GpsCoordinateModel.timestamp).all()
            
        except Exception as e:
            logger.error(f"Error getting GPS coordinates for trip {trip_id}: {str(e)}")
            return []
    
    def get_gps_statistics(self, trip_id: Optional[int] = None) -> Dict[str, Any]:
        """Get GPS statistics for a trip or all trips"""
        try:
            query = self.session.query(
                func.count().label('total_points'),
                func.min(GpsCoordinateModel.timestamp).label('first_point'),
                func.max(GpsCoordinateModel.timestamp).label('last_point'),
                func.avg(GpsCoordinateModel.speed).label('avg_speed'),
                func.max(GpsCoordinateModel.speed).label('max_speed'),
                func.avg(GpsCoordinateModel.satellites).label('avg_satellites'),
                func.count().filter(GpsCoordinateModel.fix_quality >= 3).label('high_quality_fixes')
            )
            
            if trip_id:
                query = query.filter(GpsCoordinateModel.trip_id == trip_id)
            
            result = query.first()
            
            if result:
                # Calculate speed readings count (non-null speed values)
                speed_readings_query = self.session.query(func.count()).filter(
                    GpsCoordinateModel.speed.isnot(None)
                )
                if trip_id:
                    speed_readings_query = speed_readings_query.filter(GpsCoordinateModel.trip_id == trip_id)
                speed_readings = speed_readings_query.scalar() or 0
                
                # total_readings is the same as total_points for GPS data
                total_readings = result.total_points or 0
                
                stats = {
                    'total_points': total_readings,
                    'first_point': result.first_point,
                    'last_point': result.last_point,
                    'avg_speed': result.avg_speed,
                    'max_speed': result.max_speed,
                    'avg_satellites': result.avg_satellites,
                    'high_quality_fixes': result.high_quality_fixes or 0,
                    'speed_readings': speed_readings,
                    'total_readings': total_readings
                }
                
                # Calculate moving average speed (excluding stops)
                if trip_id:
                    moving_speed = self.session.query(
                        func.avg(GpsCoordinateModel.speed)
                    ).filter(
                        and_(
                            GpsCoordinateModel.trip_id == trip_id,
                            GpsCoordinateModel.speed > 5
                        )
                    ).scalar()
                    stats['avg_moving_speed'] = moving_speed
                
                return stats
            
            return {
                'total_points': 0,
                'first_point': None,
                'last_point': None,
                'avg_speed': None,
                'max_speed': None,
                'avg_satellites': None,
                'high_quality_fixes': 0,
                'speed_readings': 0,
                'total_readings': 0,
                'avg_moving_speed': None
            }
            
        except Exception as e:
            logger.error(f"Error getting GPS statistics: {str(e)}")
            return {
                'total_points': 0,
                'first_point': None,
                'last_point': None,
                'avg_speed': None,
                'max_speed': None,
                'avg_satellites': None,
                'high_quality_fixes': 0,
                'speed_readings': 0,
                'total_readings': 0,
                'avg_moving_speed': None
            }
    
    def cleanup_old_data(self, cutoff_date: datetime) -> int:
        """Clean up old GPS data"""
        try:
            deleted_count = self.session.query(GpsCoordinateModel).filter(
                GpsCoordinateModel.timestamp < cutoff_date
            ).delete()
            
            self.session.flush()
            logger.info(f"Cleaned up {deleted_count} GPS records older than {cutoff_date}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up GPS data: {str(e)}")
            return 0


class LandmarkRepository:
    """Repository for landmark-related database operations"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def record_encounter(self, trip_id: int, landmark_data: LandmarkEncounterRequest) -> LandmarkEncounterModel:
        """Record a landmark encounter"""
        try:
            encounter = LandmarkEncounterModel(
                trip_id=trip_id,
                landmark_id=landmark_data.landmark_id,
                landmark_name=landmark_data.landmark_name,
                lat=landmark_data.lat,
                lon=landmark_data.lon,
                encounter_time=datetime.utcnow(),
                landmark_type=landmark_data.landmark_type.value,
                is_priority_landmark=landmark_data.is_priority_landmark
            )
            
            self.session.add(encounter)
            self.session.flush()
            
            logger.info(f"Recorded landmark encounter: {landmark_data.landmark_name}")
            return encounter
            
        except Exception as e:
            logger.error(f"Error recording landmark encounter: {str(e)}")
            raise
    
    def get_trip_landmarks(self, trip_id: int) -> List[LandmarkEncounterModel]:
        """Get all landmark encounters for a trip"""
        try:
            return self.session.query(LandmarkEncounterModel).filter(
                LandmarkEncounterModel.trip_id == trip_id
            ).order_by(LandmarkEncounterModel.encounter_time).all()
            
        except Exception as e:
            logger.error(f"Error getting landmarks for trip {trip_id}: {str(e)}")
            return []


class VideoRepository:
    """Repository for video-related database operations"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create_video_clip(self, trip_id: int, clip_data: VideoClipRequest) -> VideoClipModel:
        """Create a video clip record"""
        try:
            clip = VideoClipModel(
                trip_id=trip_id,
                start_time=clip_data.start_time,
                end_time=clip_data.end_time,
                start_lat=clip_data.start_lat,
                start_lon=clip_data.start_lon,
                end_lat=clip_data.end_lat,
                end_lon=clip_data.end_lon,
                sequence_num=clip_data.sequence_num,
                quality=clip_data.quality.value if clip_data.quality else None,
                road_video_file=clip_data.road_video_file,
                interior_video_file=clip_data.interior_video_file,
                near_landmark=clip_data.near_landmark,
                landmark_id=clip_data.landmark_id,
                landmark_type=clip_data.landmark_type.value if clip_data.landmark_type else None,
                location=clip_data.location
            )
            
            self.session.add(clip)
            self.session.flush()
            
            return clip
            
        except Exception as e:
            logger.error(f"Error creating video clip: {str(e)}")
            raise
    
    def create_external_video(self, video_data: ExternalVideoRequest) -> str:
        """Create an external video record and return its ID"""
        try:
            import json
            
            video = ExternalVideoModel(
                date=video_data.date,
                file_path=video_data.file_path,
                lat=video_data.lat,
                lon=video_data.lon,
                source=video_data.source,
                tags=json.dumps(video_data.tags) if video_data.tags else None,
                upload_time=datetime.utcnow()
            )
            
            self.session.add(video)
            self.session.flush()
            
            # Return the ID as a string
            return str(video.id)
            
        except Exception as e:
            logger.error(f"Error creating external video: {str(e)}")
            raise
    
    def get_trip_videos(self, trip_id: int) -> List[VideoClipModel]:
        """Get all video clips for a trip"""
        try:
            return self.session.query(VideoClipModel).filter(
                VideoClipModel.trip_id == trip_id
            ).order_by(VideoClipModel.start_time).all()
            
        except Exception as e:
            logger.error(f"Error getting videos for trip {trip_id}: {str(e)}")
            return []
    
    def get_external_video_by_id(self, video_id: str) -> Optional[ExternalVideoModel]:
        """Get external video by ID"""
        try:
            # Convertir el ID a entero si es necesario ya que en la base de datos es un campo Integer
            try:
                numeric_id = int(video_id)
            except ValueError:
                logger.error(f"Invalid video ID format: {video_id} (not a number)")
                return None
                
            logger.info(f"Buscando video externo con ID numérico: {numeric_id}")
            video = self.session.query(ExternalVideoModel).filter(
                ExternalVideoModel.id == numeric_id
            ).first()
            
            if video:
                logger.info(f"Video externo encontrado: ID={video.id}, file_path={video.file_path}")
                # Verificar si el archivo existe
                if not os.path.isfile(video.file_path):
                    logger.error(f"El archivo no existe en la ruta indicada: {video.file_path}")
            else:
                logger.warning(f"No se encontró video externo con ID {numeric_id}")
                
            return video
            
        except Exception as e:
            logger.error(f"Error getting external video {video_id}: {str(e)}")
            return None
            
    def get_external_videos_by_date(self, target_date: date) -> List[ExternalVideoModel]:
        """Get external videos by date"""
        try:
            start_datetime = datetime.combine(target_date, datetime.min.time())
            end_datetime = datetime.combine(target_date, datetime.max.time())
            
            return self.session.query(ExternalVideoModel).filter(
                or_(
                    and_(
                        ExternalVideoModel.date >= start_datetime,
                        ExternalVideoModel.date <= end_datetime
                    ),
                    and_(
                        ExternalVideoModel.upload_time >= start_datetime,
                        ExternalVideoModel.upload_time <= end_datetime
                    )
                )
            ).all()
            
        except Exception as e:
            logger.error(f"Error getting external videos for date {target_date}: {str(e)}")
            return []


class QualityUpgradeRepository:
    """Repository for quality upgrade events"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def log_quality_upgrade(self, trip_id: int, landmark_id: Optional[str] = None, 
                          landmark_name: Optional[str] = None, distance_meters: Optional[float] = None,
                          reason: Optional[str] = None) -> QualityUpgradeModel:
        """Log a quality upgrade event"""
        try:
            upgrade = QualityUpgradeModel(
                trip_id=trip_id,
                landmark_id=landmark_id,
                landmark_name=landmark_name,
                distance_meters=distance_meters,
                reason=reason,
                timestamp=datetime.utcnow()
            )
            
            self.session.add(upgrade)
            self.session.flush()
            
            return upgrade
            
        except Exception as e:
            logger.error(f"Error logging quality upgrade: {str(e)}")
            raise
    
    def get_trip_quality_upgrades(self, trip_id: int) -> List[QualityUpgradeModel]:
        """Get all quality upgrade events for a trip"""
        try:
            return self.session.query(QualityUpgradeModel).filter(
                QualityUpgradeModel.trip_id == trip_id
            ).order_by(QualityUpgradeModel.timestamp).all()
            
        except Exception as e:
            logger.error(f"Error getting quality upgrades for trip {trip_id}: {str(e)}")
            return []
