"""
Pydantic schemas for data validation and serialization
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import json


class LandmarkType(str, Enum):
    """Landmark types"""
    STANDARD = "standard"
    PRIORITY = "priority"
    HIGHWAY = "highway"
    CITY = "city"
    SCENIC = "scenic"
    RESTAURANT = "restaurant"
    GAS_STATION = "gas_station"
    HOTEL = "hotel"


class VideoQuality(str, Enum):
    """Video quality levels"""
    LOW = "low"
    MEDIUM = "medium" 
    HIGH = "high"
    ULTRA = "ultra"


class GpsFixQuality(int, Enum):
    """GPS fix quality levels"""
    INVALID = 0
    GPS_FIX = 1
    DGPS_FIX = 2
    PPS_FIX = 3
    RTK_FIX = 4
    FLOAT_RTK = 5
    ESTIMATED = 6
    MANUAL = 7
    SIMULATION = 8


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    
    model_config = {
        "from_attributes": True,
        "json_encoders": {
            datetime: lambda v: v.isoformat() if v else None
        }
    }


# Request schemas
class TripCreateRequest(BaseSchema):
    """Schema for creating a new trip"""
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    planned_trip_id: Optional[str] = None


class GpsCoordinateRequest(BaseSchema):
    """Schema for logging GPS coordinates"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    speed: Optional[float] = Field(None, ge=0)
    heading: Optional[float] = Field(None, ge=0, lt=360)
    satellites: Optional[int] = Field(None, ge=0)
    fix_quality: Optional[GpsFixQuality] = None


class LandmarkEncounterRequest(BaseSchema):
    """Schema for recording landmark encounters"""
    landmark_id: Optional[str] = None
    landmark_name: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    landmark_type: LandmarkType = LandmarkType.STANDARD
    is_priority_landmark: bool = False


class VideoClipRequest(BaseSchema):
    """Schema for creating video clips"""
    start_time: datetime
    end_time: datetime
    start_lat: Optional[float] = Field(None, ge=-90, le=90)
    start_lon: Optional[float] = Field(None, ge=-180, le=180)
    end_lat: Optional[float] = Field(None, ge=-90, le=90)
    end_lon: Optional[float] = Field(None, ge=-180, le=180)
    sequence_num: Optional[int] = None
    quality: Optional[VideoQuality] = None
    road_video_file: Optional[str] = None
    interior_video_file: Optional[str] = None
    near_landmark: bool = False
    landmark_id: Optional[str] = None
    landmark_type: Optional[LandmarkType] = None
    location: Optional[str] = None


class ExternalVideoRequest(BaseSchema):
    """Schema for external video uploads"""
    date: Optional[datetime] = None
    file_path: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    source: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None

    @field_validator('tags', mode='before')
    @classmethod
    def validate_tags(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v or {}


# Response schemas
class Trip(BaseSchema):
    """Trip response schema"""
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None
    distance_km: Optional[float] = None
    video_files: Optional[str] = None
    summary_file: Optional[str] = None
    planned_trip_id: Optional[str] = None


class GpsCoordinate(BaseSchema):
    """GPS coordinate response schema"""
    id: int
    trip_id: Optional[int] = None
    timestamp: datetime
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    satellites: Optional[int] = None
    fix_quality: Optional[int] = None


class LandmarkEncounter(BaseSchema):
    """Landmark encounter response schema"""
    id: int
    trip_id: Optional[int] = None
    landmark_id: Optional[str] = None
    landmark_name: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    encounter_time: datetime
    landmark_type: str
    is_priority_landmark: bool


class VideoClip(BaseSchema):
    """Video clip response schema"""
    id: int
    trip_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None
    sequence_num: Optional[int] = None
    quality: Optional[str] = None
    road_video_file: Optional[str] = None
    interior_video_file: Optional[str] = None
    near_landmark: bool
    landmark_id: Optional[str] = None
    landmark_type: Optional[str] = None
    location: Optional[str] = None


class ExternalVideo(BaseSchema):
    """External video response schema"""
    id: int
    date: Optional[datetime] = None
    file_path: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    source: Optional[str] = None
    tags: Optional[str] = None
    upload_time: datetime


class QualityUpgrade(BaseSchema):
    """Quality upgrade response schema"""
    id: int
    trip_id: Optional[int] = None
    timestamp: datetime
    landmark_id: Optional[str] = None
    landmark_name: Optional[str] = None
    distance_meters: Optional[float] = None
    reason: Optional[str] = None


# Complex response schemas
class TripWithDetails(Trip):
    """Trip with related data"""
    gps_coordinates: List[GpsCoordinate] = []
    landmark_encounters: List[LandmarkEncounter] = []
    video_clips: List[VideoClip] = []
    quality_upgrades: List[QualityUpgrade] = []


class TripStatistics(BaseSchema):
    """Trip statistics"""
    total_trips: int
    total_distance_km: float
    total_recording_time_hours: float
    average_trip_duration_minutes: float
    gps_points_logged: int
    landmarks_encountered: int
    quality_upgrades: int


class GpsStatistics(BaseSchema):
    """GPS statistics"""
    total_points: int
    first_point: Optional[datetime] = None
    last_point: Optional[datetime] = None
    avg_speed: Optional[float] = None
    max_speed: Optional[float] = None
    avg_moving_speed: Optional[float] = None
    avg_satellites: Optional[float] = None
    high_quality_fixes: int
    speed_readings: int
    total_readings: int


class CalendarData(BaseSchema):
    """Calendar data for trips"""
    date: str
    trips: int


class TripSummary(BaseSchema):
    """Comprehensive trip summary"""
    trip_info: Trip
    gps_track: List[GpsCoordinate]
    landmarks: List[LandmarkEncounter]
    quality_upgrades: List[QualityUpgrade]
    statistics: GpsStatistics
