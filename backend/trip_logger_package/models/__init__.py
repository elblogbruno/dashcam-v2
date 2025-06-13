"""
Models package for trip logger
"""

from .db_models import (
    Base,
    Trip as TripModel,
    GpsCoordinate as GpsCoordinateModel,
    LandmarkEncounter as LandmarkEncounterModel,
    VideoClip as VideoClipModel,
    ExternalVideo as ExternalVideoModel,
    QualityUpgrade as QualityUpgradeModel,
    create_all_tables,
    drop_all_tables
)

from .schemas import (
    Trip,
    GpsCoordinate,
    LandmarkEncounter,
    VideoClip,
    ExternalVideo,
    QualityUpgrade,
    TripCreateRequest,
    GpsCoordinateRequest,
    LandmarkEncounterRequest,
    VideoClipRequest,
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

__all__ = [
    # DB Models
    'Base',
    'TripModel',
    'GpsCoordinateModel',
    'LandmarkEncounterModel', 
    'VideoClipModel',
    'ExternalVideoModel',
    'QualityUpgradeModel',
    'create_all_tables',
    'drop_all_tables',
    
    # Schemas
    'Trip',
    'GpsCoordinate',
    'LandmarkEncounter',
    'VideoClip',
    'ExternalVideo',
    'QualityUpgrade',
    'TripCreateRequest',
    'GpsCoordinateRequest',
    'LandmarkEncounterRequest',
    'VideoClipRequest',
    'ExternalVideoRequest',
    'TripWithDetails',
    'TripStatistics',
    'GpsStatistics',
    'CalendarData',
    'TripSummary',
    'LandmarkType',
    'VideoQuality',
    'GpsFixQuality'
]
