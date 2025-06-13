"""
Main trip manager service - Unified interface for trip logging operations
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta

from ..database.connection import get_database_manager
from ..database.repository import (
    TripRepository,
    GpsRepository,
    LandmarkRepository,
    VideoRepository,
    QualityUpgradeRepository
)
from ..models.schemas import (
    Trip,
    TripCreateRequest,
    GpsCoordinate,
    GpsCoordinateRequest,
    LandmarkEncounter,
    LandmarkEncounterRequest,
    VideoClip,
    VideoClipRequest,
    ExternalVideo,
    ExternalVideoRequest,
    TripWithDetails,
    TripStatistics,
    GpsStatistics,
    CalendarData,
    TripSummary,
    LandmarkType,
    VideoQuality,
    GpsFixQuality
)
from ..logging import get_logger

logger = get_logger('trip_manager')


class TripManager:
    """
    Main service class for trip logging operations.
    
    This class provides a unified interface for all trip-related operations,
    replacing the old monolithic TripLogger class.
    """
    
    def __init__(self, db_path: str = None):
        """Initialize the trip manager"""
        self.db_manager = get_database_manager(db_path)
        self.current_trip_id: Optional[int] = None
        
        logger.info("TripManager initialized")
    
    # Trip Management Methods
    def start_trip(self, start_lat: Optional[float] = None, start_lon: Optional[float] = None, planned_trip_id: Optional[str] = None) -> Optional[int]:
        """Start a new trip recording"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                
                trip_data = TripCreateRequest(start_lat=start_lat, start_lon=start_lon, planned_trip_id=planned_trip_id)
                trip = trip_repo.create_trip(trip_data)
                
                self.current_trip_id = trip.id
                logger.info(f"Started new trip with ID {self.current_trip_id}" + 
                          (f" (Planned trip: {planned_trip_id})" if planned_trip_id else ""))
                return self.current_trip_id
                
        except Exception as e:
            logger.error(f"Error starting trip: {str(e)}")
            return None
    
    def end_trip(self, end_lat: Optional[float] = None, end_lon: Optional[float] = None) -> Optional[int]:
        """End the current trip recording"""
        if not self.current_trip_id:
            logger.warning("No active trip to end")
            # Try to find unfinished trip
            active_trip = self.get_active_trip()
            if active_trip:
                self.current_trip_id = active_trip.id
                logger.info(f"Recovered unfinished trip ID: {self.current_trip_id}")
            else:
                logger.warning("No active trip found")
                return None
        
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                
                if trip_repo.end_trip(self.current_trip_id, end_lat, end_lon):
                    ended_trip_id = self.current_trip_id
                    self.current_trip_id = None
                    logger.info(f"Ended trip {ended_trip_id}")
                    return ended_trip_id
                else:
                    logger.error("Failed to end trip")
                    return None
                    
        except Exception as e:
            logger.error(f"Error ending trip: {str(e)}")
            return self.current_trip_id
    
    def update_trip_location(self, lat: float, lon: float, is_start: bool = False) -> bool:
        """Update the start or end location of current trip"""
        if not self.current_trip_id:
            logger.warning("No active trip to update location")
            return False
        
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                return trip_repo.update_trip_location(self.current_trip_id, lat, lon, is_start)
                
        except Exception as e:
            logger.error(f"Error updating trip location: {str(e)}")
            return False
    
    def get_active_trip(self) -> Optional[Trip]:
        """Get the currently active trip"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                trip_model = trip_repo.get_active_trip()
                
                if trip_model:
                    return Trip.from_orm(trip_model)
                return None
                
        except Exception as e:
            logger.error(f"Error getting active trip: {str(e)}")
            return None
    
    # GPS Logging Methods
    def log_gps_coordinate(self, latitude: float, longitude: float, altitude: Optional[float] = None,
                          speed: Optional[float] = None, heading: Optional[float] = None,
                          satellites: Optional[int] = None, fix_quality: Optional[int] = None) -> bool:
        """Log a GPS coordinate to the database"""
        if not self.current_trip_id:
            logger.debug("No active trip for GPS logging")
            return False
        
        try:
            with self.db_manager.session_scope() as session:
                gps_repo = GpsRepository(session)
                
                gps_data = GpsCoordinateRequest(
                    latitude=latitude,
                    longitude=longitude,
                    altitude=altitude,
                    speed=speed,
                    heading=heading,
                    satellites=satellites,
                    fix_quality=fix_quality
                )
                
                gps_repo.log_coordinate(self.current_trip_id, gps_data)
                return True
                
        except Exception as e:
            logger.error(f"Error logging GPS coordinate: {str(e)}")
            return False
    
    def log_gps_coordinate_with_calculated_speed(self, latitude: float, longitude: float, 
                                               altitude: Optional[float] = None, gps_speed: Optional[float] = None,
                                               heading: Optional[float] = None, satellites: Optional[int] = None,
                                               fix_quality: Optional[int] = None) -> bool:
        """Log GPS coordinate with speed calculation (backward compatibility)"""
        # For now, just use the provided GPS speed
        # Could add speed calculation logic here if needed
        return self.log_gps_coordinate(
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            speed=gps_speed,
            heading=heading,
            satellites=satellites,
            fix_quality=fix_quality
        )
    
    # Landmark Methods
    def add_landmark_encounter(self, landmark_data: Dict[str, Any]) -> bool:
        """Record when a landmark is encountered during a trip"""
        if not self.current_trip_id:
            logger.debug("No active trip for landmark encounter")
            return False
        
        if not landmark_data or not isinstance(landmark_data, dict):
            logger.warning("Invalid landmark data")
            return False
        
        # Only log landmarks that need notification
        if not landmark_data.get('notify', False):
            return False
        
        try:
            with self.db_manager.session_scope() as session:
                landmark_repo = LandmarkRepository(session)
                
                encounter_data = LandmarkEncounterRequest(
                    landmark_id=landmark_data.get('id'),
                    landmark_name=landmark_data.get('name', 'Unknown'),
                    lat=landmark_data.get('lat'),
                    lon=landmark_data.get('lon'),
                    landmark_type=self._determine_landmark_type(landmark_data),
                    is_priority_landmark=self._is_priority_landmark(landmark_data)
                )
                
                landmark_repo.record_encounter(self.current_trip_id, encounter_data)
                return True
                
        except Exception as e:
            logger.error(f"Error recording landmark encounter: {str(e)}")
            return False
    
    def log_quality_upgrade(self, landmark_id: Optional[str] = None, landmark_name: Optional[str] = None,
                           distance_meters: Optional[float] = None, reason: Optional[str] = None) -> bool:
        """Log when recording quality is upgraded due to landmark proximity"""
        if not self.current_trip_id:
            return False
        
        try:
            with self.db_manager.session_scope() as session:
                quality_repo = QualityUpgradeRepository(session)
                quality_repo.log_quality_upgrade(
                    self.current_trip_id, landmark_id, landmark_name, distance_meters, reason
                )
                return True
                
        except Exception as e:
            logger.error(f"Error logging quality upgrade: {str(e)}")
            return False
    
    # Video Methods
    def create_video_clip(self, clip_data: VideoClipRequest) -> bool:
        """Create a video clip record"""
        if not self.current_trip_id:
            logger.warning("No active trip for video clip")
            return False
        
        try:
            with self.db_manager.session_scope() as session:
                video_repo = VideoRepository(session)
                video_repo.create_video_clip(self.current_trip_id, clip_data)
                return True
                
        except Exception as e:
            logger.error(f"Error creating video clip: {str(e)}")
            return False
    
    def create_external_video(self, video_data: ExternalVideoRequest) -> Optional[str]:
        """Create an external video record"""
        try:
            with self.db_manager.session_scope() as session:
                video_repo = VideoRepository(session)
                video_id = video_repo.create_external_video(video_data)
                return video_id
                
        except Exception as e:
            logger.error(f"Error creating external video: {str(e)}")
            return None
    
    def get_external_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get external video by ID"""
        try:
            with self.db_manager.session_scope() as session:
                video_repo = VideoRepository(session)
                video = video_repo.get_external_video_by_id(video_id)
                if video:
                    # Convertir a diccionario para compatibilidad con el código antiguo
                    return {
                        'id': video.id,
                        'file_path': video.file_path,
                        'date': video.date,
                        'upload_time': video.upload_time,
                        'lat': video.lat,
                        'lon': video.lon,
                        'source': video.source,
                        'tags': video.tags
                    }
                return None
                
        except Exception as e:
            logger.error(f"Error getting external video: {str(e)}")
            return None
            
    def add_external_video(self, upload_date, metadata: Dict[str, Any]) -> Optional[str]:
        """Add external video (compatibility method)"""
        try:
            # Convertir el formato antiguo al nuevo
            video_data = ExternalVideoRequest(
                file_path=metadata.get('file_path'),
                date=upload_date,
                lat=metadata.get('lat'),
                lon=metadata.get('lon'),
                source=metadata.get('source', 'external'),
                tags=metadata.get('tags')
            )
            
            with self.db_manager.session_scope() as session:
                video_repo = VideoRepository(session)
                video_id = video_repo.create_external_video(video_data)
                return str(video_id)
                
        except Exception as e:
            logger.error(f"Error adding external video: {str(e)}")
            return None
    
    # Query Methods
    def get_all_trips(self, limit: Optional[int] = None) -> List[Trip]:
        """Get all trips ordered by start time"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                trip_models = trip_repo.get_all_trips(limit)
                return [Trip.from_orm(trip) for trip in trip_models]
                
        except Exception as e:
            logger.error(f"Error getting all trips: {str(e)}")
            return []
    
    def get_trip_by_id(self, trip_id: int) -> Optional[Trip]:
        """Get trip by ID"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                trip_model = trip_repo.get_trip_by_id(trip_id)
                
                if trip_model:
                    return Trip.from_orm(trip_model)
                return None
                
        except Exception as e:
            logger.error(f"Error getting trip {trip_id}: {str(e)}")
            return None
    
    def get_trips_by_date(self, target_date: date) -> List[Trip]:
        """Get all trips for a specific date"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                trip_models = trip_repo.get_trips_by_date(target_date)
                return [Trip.from_orm(trip) for trip in trip_models]
                
        except Exception as e:
            logger.error(f"Error getting trips by date: {str(e)}")
            return []
    
    def get_trips_by_date_range(self, start_date: date, end_date: date) -> List[Trip]:
        """Get all trips within a date range"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                trip_models = trip_repo.get_trips_by_date_range(start_date, end_date)
                return [Trip.from_orm(trip) for trip in trip_models]
                
        except Exception as e:
            logger.error(f"Error getting trips by date range: {str(e)}")
            return []
    
    def get_gps_track_for_trip(self, trip_id: int) -> List[GpsCoordinate]:
        """Get GPS track data for a specific trip"""
        try:
            with self.db_manager.session_scope() as session:
                gps_repo = GpsRepository(session)
                gps_models = gps_repo.get_trip_coordinates(trip_id)
                return [GpsCoordinate.from_orm(gps) for gps in gps_models]
                
        except Exception as e:
            logger.error(f"Error getting GPS track for trip {trip_id}: {str(e)}")
            return []
    
    def get_gps_statistics(self, trip_id: Optional[int] = None) -> GpsStatistics:
        """Get GPS logging statistics for a trip or all trips"""
        try:
            with self.db_manager.session_scope() as session:
                gps_repo = GpsRepository(session)
                stats_dict = gps_repo.get_gps_statistics(trip_id)
                return GpsStatistics(**stats_dict)
                
        except Exception as e:
            logger.error(f"Error getting GPS statistics: {str(e)}")
            return GpsStatistics(
                total_points=0, speed_readings=0, total_readings=0, high_quality_fixes=0
            )
    
    def get_trip_gps_summary(self, trip_id: int) -> TripSummary:
        """Get a comprehensive GPS summary for a trip"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                trip_model = trip_repo.get_trip_with_details(trip_id)
                
                if not trip_model:
                    raise ValueError(f"Trip {trip_id} not found")
                
                return TripSummary(
                    trip_info=Trip.from_orm(trip_model),
                    gps_track=[GpsCoordinate.from_orm(gps) for gps in trip_model.gps_coordinates],
                    landmarks=[LandmarkEncounter.from_orm(lm) for lm in trip_model.landmark_encounters],
                    quality_upgrades=[],  # Would need to convert if QualityUpgrade schema exists
                    statistics=self.get_gps_statistics(trip_id)
                )
                
        except Exception as e:
            logger.error(f"Error getting trip GPS summary: {str(e)}")
            # Return empty summary
            return TripSummary(
                trip_info=Trip(id=trip_id, start_time=datetime.utcnow()),
                gps_track=[],
                landmarks=[],
                quality_upgrades=[],
                statistics=GpsStatistics(
                    total_points=0, speed_readings=0, total_readings=0, high_quality_fixes=0
                )
            )
    
    def get_calendar_data(self, year: int, month: int) -> Dict[str, CalendarData]:
        """Get calendar data for a specific month with trip counts by day"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                calendar_dict = trip_repo.get_calendar_data(year, month)
                
                # Convert to CalendarData objects
                return {
                    date_str: CalendarData(date=data['date'], trips=data['trips'])
                    for date_str, data in calendar_dict.items()
                }
                
        except Exception as e:
            logger.error(f"Error getting calendar data: {str(e)}")
            return {}
    
    # Utility Methods
    def cleanup_old_gps_data(self, cutoff_date: datetime) -> int:
        """Clean up GPS coordinate data older than the cutoff date"""
        try:
            with self.db_manager.session_scope() as session:
                gps_repo = GpsRepository(session)
                return gps_repo.cleanup_old_data(cutoff_date)
                
        except Exception as e:
            logger.error(f"Error cleaning up old GPS data: {str(e)}")
            return 0
    
    def calculate_speed_from_gps(self, lat1: float, lon1: float, lat2: float, lon2: float,
                                time_diff_seconds: float) -> float:
        """Calculate speed from GPS coordinates
        
        Args:
            lat1, lon1: First coordinate
            lat2, lon2: Second coordinate  
            time_diff_seconds: Time difference in seconds
            
        Returns:
            Speed in km/h
        """
        from ..utils.calculations import calculate_speed, SpeedUnit
        return calculate_speed(lat1, lon1, lat2, lon2, time_diff_seconds, SpeedUnit.KPH)
    
    def _determine_landmark_type(self, landmark_data: Dict[str, Any]) -> str:
        """Determine landmark type from data"""
        # Priority determination logic
        if landmark_data.get('tags', {}).get('tourism') == 'attraction':
            return 'scenic'
        elif landmark_data.get('tags', {}).get('amenity') == 'fuel':
            return 'gas_station'
        elif landmark_data.get('tags', {}).get('amenity') in ['restaurant', 'fast_food', 'cafe']:
            return 'restaurant'
        elif landmark_data.get('tags', {}).get('tourism') == 'hotel':
            return 'hotel'
        elif landmark_data.get('tags', {}).get('highway'):
            return 'highway'
        elif landmark_data.get('tags', {}).get('place') in ['city', 'town', 'village']:
            return 'city'
        else:
            return 'standard'
    
    def _is_priority_landmark(self, landmark_data: Dict[str, Any]) -> bool:
        """Determine if landmark is priority"""
        # Priority landmarks are tourist attractions, important places, etc.
        tags = landmark_data.get('tags', {})
        
        priority_conditions = [
            tags.get('tourism') in ['attraction', 'museum', 'monument'],
            tags.get('historic') is not None,
            tags.get('natural') in ['peak', 'volcano', 'geyser'],
            tags.get('place') in ['city', 'town'],
            tags.get('boundary') == 'administrative'
        ]
        
        return any(priority_conditions)

    @property
    def db_path(self) -> str:
        """Get database path"""
        return self.db_manager.db_path
    
    def test_connection(self) -> bool:
        """Test database connection"""
        return self.db_manager.test_connection()

    def get_trips_by_planned_trip_id(self, planned_trip_id: str) -> List[Trip]:
        """Get all trips for a specific planned trip ID"""
        try:
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                trip_models = trip_repo.get_trips_by_planned_trip_id(planned_trip_id)
                return [Trip.from_orm(trip) for trip in trip_models]
                
        except Exception as e:
            logger.error(f"Error getting trips by planned trip ID {planned_trip_id}: {str(e)}")
            return []

    def get_trip_videos(self, trip_id: int) -> List[VideoClip]:
        """Get all video clips for a specific trip"""
        try:
            with self.db_manager.session_scope() as session:
                video_repo = VideoRepository(session)
                video_models = video_repo.get_trip_videos(trip_id)
                return [VideoClip.from_orm(video) for video in video_models]
                
        except Exception as e:
            logger.error(f"Error getting videos for trip {trip_id}: {str(e)}")
            return []

    def get_trip_landmarks(self, trip_id: int) -> List[LandmarkEncounter]:
        """Get all landmark encounters for a specific trip"""
        try:
            with self.db_manager.session_scope() as session:
                landmark_repo = LandmarkRepository(session)
                landmark_models = landmark_repo.get_trip_landmarks(trip_id)
                return [LandmarkEncounter.from_orm(landmark) for landmark in landmark_models]
                
        except Exception as e:
            logger.error(f"Error getting landmarks for trip {trip_id}: {str(e)}")
            return []
    
    def cleanup(self):
        """
        Cleanup method for graceful shutdown.
        Ends any active trip and cleans up resources.
        """
        try:
            logger.info("TripManager cleanup started")
            
            # End any active trip
            active_trip = self.get_active_trip()
            if active_trip:
                logger.info(f"Ending active trip (ID: {active_trip.id}) during cleanup")
                trip_id = self.end_trip()
                if trip_id:
                    logger.info(f"Successfully ended trip {trip_id} during cleanup")
                else:
                    logger.warning("Failed to end active trip during cleanup")
            else:
                logger.info("No active trip to end during cleanup")
            
            # Clean up database connection
            if hasattr(self, 'db_manager') and self.db_manager:
                logger.info("Cleaning up database manager")
                # The database manager handles its own cleanup automatically
                
            logger.info("TripManager cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during TripManager cleanup: {str(e)}")


# Create a singleton instance for backward compatibility
trip_manager_instance: Optional[TripManager] = None


def get_trip_manager(db_path: str = None) -> TripManager:
    """Get the global trip manager instance"""
    global trip_manager_instance
    
    if trip_manager_instance is None:
        trip_manager_instance = TripManager(db_path)
    
    return trip_manager_instance
