"""
SQLAlchemy models for trip logging database
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, Session
from datetime import datetime
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()


class Trip(Base):
    """Trip model for recording travel sessions"""
    __tablename__ = "trips"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    start_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    start_lat = Column(Float, nullable=True)
    start_lon = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lon = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=True)
    video_files = Column(Text, nullable=True)  # JSON string
    summary_file = Column(String(500), nullable=True)
    planned_trip_id = Column(String(50), nullable=True)  # Link to planned trip
    
    # Relationships
    gps_coordinates = relationship("GpsCoordinate", back_populates="trip", cascade="all, delete-orphan")
    landmark_encounters = relationship("LandmarkEncounter", back_populates="trip", cascade="all, delete-orphan")
    video_clips = relationship("VideoClip", back_populates="trip", cascade="all, delete-orphan")
    quality_upgrades = relationship("QualityUpgrade", back_populates="trip", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Trip(id={self.id}, start_time={self.start_time}, end_time={self.end_time})>"


class GpsCoordinate(Base):
    """GPS coordinate data for trips"""
    __tablename__ = "gps_coordinates"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    satellites = Column(Integer, nullable=True)
    fix_quality = Column(Integer, nullable=True)
    
    # Relationships
    trip = relationship("Trip", back_populates="gps_coordinates")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_gps_trip_time', 'trip_id', 'timestamp'),
        Index('idx_gps_coordinates_timestamp', 'timestamp'),
    )
    
    def __repr__(self):
        return f"<GpsCoordinate(trip_id={self.trip_id}, lat={self.latitude}, lon={self.longitude}, time={self.timestamp})>"


class LandmarkEncounter(Base):
    """Landmark encounters during trips"""
    __tablename__ = "landmark_encounters"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    landmark_id = Column(String(100), nullable=True)
    landmark_name = Column(String(200), nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    encounter_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    landmark_type = Column(String(50), default='standard')
    is_priority_landmark = Column(Boolean, default=False)
    
    # Relationships
    trip = relationship("Trip", back_populates="landmark_encounters")
    
    def __repr__(self):
        return f"<LandmarkEncounter(trip_id={self.trip_id}, name={self.landmark_name}, type={self.landmark_type})>"


class VideoClip(Base):
    """Video clips/segments for trips"""
    __tablename__ = "video_clips"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    start_lat = Column(Float, nullable=True)
    start_lon = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lon = Column(Float, nullable=True)
    sequence_num = Column(Integer, nullable=True)
    quality = Column(String(20), nullable=True)
    road_video_file = Column(String(500), nullable=True)
    interior_video_file = Column(String(500), nullable=True)
    near_landmark = Column(Boolean, default=False)
    landmark_id = Column(String(100), nullable=True)
    landmark_type = Column(String(50), nullable=True)
    location = Column(String(200), nullable=True)
    
    # Relationships
    trip = relationship("Trip", back_populates="video_clips")
    
    def __repr__(self):
        return f"<VideoClip(trip_id={self.trip_id}, quality={self.quality}, landmark={self.near_landmark})>"


class ExternalVideo(Base):
    """External videos (e.g., Insta360 uploads)"""
    __tablename__ = "external_videos"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(DateTime, nullable=True)
    file_path = Column(String(500), nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    source = Column(String(100), nullable=True)
    tags = Column(Text, nullable=True)  # JSON string
    upload_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<ExternalVideo(id={self.id}, source={self.source}, date={self.date})>"


class QualityUpgrade(Base):
    """Quality upgrade events during trips"""
    __tablename__ = "quality_upgrades"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    landmark_id = Column(String(100), nullable=True)
    landmark_name = Column(String(200), nullable=True)
    distance_meters = Column(Float, nullable=True)
    reason = Column(String(200), nullable=True)
    
    # Relationships
    trip = relationship("Trip", back_populates="quality_upgrades")
    
    def __repr__(self):
        return f"<QualityUpgrade(trip_id={self.trip_id}, landmark={self.landmark_name}, reason={self.reason})>"


# Helper functions for database setup
def create_all_tables(engine):
    """Create all tables in the database"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("All database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {str(e)}")
        raise


def drop_all_tables(engine):
    """Drop all tables from the database (use with caution!)"""
    try:
        Base.metadata.drop_all(bind=engine)
        logger.info("All database tables dropped")
    except Exception as e:
        logger.error(f"Error dropping database tables: {str(e)}")
        raise
