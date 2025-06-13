from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.sql import func
import os
import json
import math
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# SQLAlchemy setup
Base = declarative_base()

class Landmark(Base):
    __tablename__ = 'landmarks'
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    radius_m = Column(Integer, default=500)
    description = Column(Text)
    category = Column(String, default='custom')
    trip_id = Column(String)
    created_at = Column(DateTime, default=func.current_timestamp())
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_landmarks_trip_id', 'trip_id'),
        Index('idx_landmarks_location', 'lat', 'lon'),
    )

class PlannedTrip(Base):
    __tablename__ = 'planned_trips'
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    start_lat = Column(Float, nullable=False)
    start_lon = Column(Float, nullable=False)
    end_lat = Column(Float, nullable=False)
    end_lon = Column(Float, nullable=False)
    origin_name = Column(String)
    destination_name = Column(String)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    notes = Column(Text)
    landmarks_downloaded = Column(Boolean, default=False)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.current_timestamp())
    updated_at = Column(DateTime, default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationship to waypoints
    waypoints = relationship("TripWaypoint", back_populates="trip", cascade="all, delete-orphan")

class TripWaypoint(Base):
    __tablename__ = 'trip_waypoints'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(String, ForeignKey('planned_trips.id', ondelete='CASCADE'), nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    name = Column(String)
    position = Column(Integer, nullable=False)
    
    # Relationship to trip
    trip = relationship("PlannedTrip", back_populates="waypoints")
    
    # Index for performance
    __table_args__ = (
        Index('idx_waypoints_trip_id', 'trip_id'),
    )

class LandmarksDB:
    def __init__(self, db_path=None):
        # Set database path - prioritize explicit path, then env var, then fallback to default
        self.db_path = db_path or os.environ.get('DASHCAM_DB_PATH') or os.path.join(
            os.environ.get('DASHCAM_DATA_PATH', os.path.join(os.path.dirname(__file__), 'data')), 
            'recordings.db'
        )
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Initialize notification variables
        self._initialize_notification_vars()
        
        # Initialize SQLAlchemy engine and session
        self._init_sqlalchemy()
        
        # Initialize database tables
        self._init_database()
        
    def _init_sqlalchemy(self):
        """Initialize SQLAlchemy engine and session maker"""
        # Create SQLAlchemy engine with SQLite
        self.engine = create_engine(
            f'sqlite:///{self.db_path}',
            pool_pre_ping=True,
            pool_recycle=300,
            echo=False  # Set to True for SQL debugging
        )
        
        # Create session maker
        self.SessionLocal = sessionmaker(bind=self.engine)
        
        logger.info(f"SQLAlchemy engine initialized with database: {self.db_path}")

    @contextmanager
    def get_session(self) -> Session:
        """Context manager for database sessions with automatic cleanup"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            session.close()

    def _init_database(self):
        """Initialize the database with necessary tables using SQLAlchemy"""
        try:
            # Create all tables
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database initialized with landmarks and planned trips tables using SQLAlchemy")
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise
    
    def get_all_landmarks(self) -> List[Dict[str, Any]]:
        """Get all landmarks from the database"""
        try:
            with self.get_session() as session:
                landmarks = session.query(Landmark).all()
                return [self._landmark_to_dict(landmark) for landmark in landmarks]
        except Exception as e:
            logger.error(f"Error getting all landmarks: {str(e)}")
            return []
    
    def get_landmarks_by_trip(self, trip_id: str) -> List[Dict[str, Any]]:
        """Get all landmarks associated with a specific trip"""
        try:
            with self.get_session() as session:
                landmarks = session.query(Landmark).filter(Landmark.trip_id == trip_id).all()
                return [self._landmark_to_dict(landmark) for landmark in landmarks]
        except Exception as e:
            logger.error(f"Error getting landmarks for trip {trip_id}: {str(e)}")
            return []
    
    def get_landmarks_in_area(self, lat: float, lon: float, radius_km: float = 10) -> List[Dict[str, Any]]:
        """Get landmarks within a specific radius using SQLAlchemy"""
        try:
            # Approximate conversion of km to degrees (at middle latitudes)
            lat_range = radius_km / 111.0  # 1 degree of latitude is approximately 111km
            lon_range = radius_km / (111.0 * abs(math.cos(math.radians(lat))))
            
            with self.get_session() as session:
                # Initial filtering using bounding box
                landmarks = session.query(Landmark).filter(
                    Landmark.lat.between(lat - lat_range, lat + lat_range),
                    Landmark.lon.between(lon - lon_range, lon + lon_range)
                ).all()
                
                # Further refine with accurate distance calculation
                filtered_landmarks = []
                for landmark in landmarks:
                    distance = self._calculate_distance(lat, lon, landmark.lat, landmark.lon)
                    
                    # Convert to km and check radius
                    if distance / 1000 <= radius_km:
                        landmark_dict = self._landmark_to_dict(landmark)
                        landmark_dict['distance'] = distance
                        filtered_landmarks.append(landmark_dict)
                        
                return filtered_landmarks
        except Exception as e:
            logger.error(f"Error getting landmarks in area: {str(e)}")
            return []

    def add_landmark(self, landmark_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Add a new landmark to the database using SQLAlchemy"""
        try:
            if 'id' not in landmark_data:
                # Generate a unique ID if not provided
                import uuid
                landmark_data['id'] = str(uuid.uuid4())[:8]
                
            with self.get_session() as session:
                # Check if landmark with this ID already exists
                existing = session.query(Landmark).filter(Landmark.id == landmark_data['id']).first()
                
                if existing:
                    # Update existing landmark
                    existing.name = landmark_data['name']
                    existing.lat = landmark_data['lat']
                    existing.lon = landmark_data['lon']
                    existing.radius_m = landmark_data.get('radius_m', 500)
                    existing.description = landmark_data.get('description', '')
                    existing.category = landmark_data.get('category', 'custom')
                    existing.trip_id = landmark_data.get('trip_id')
                    logger.info(f"Updated existing landmark {landmark_data['name']} in database")
                else:
                    # Insert new landmark
                    new_landmark = Landmark(
                        id=landmark_data['id'],
                        name=landmark_data['name'],
                        lat=landmark_data['lat'],
                        lon=landmark_data['lon'],
                        radius_m=landmark_data.get('radius_m', 500),
                        description=landmark_data.get('description', ''),
                        category=landmark_data.get('category', 'custom'),
                        trip_id=landmark_data.get('trip_id')
                    )
                    session.add(new_landmark)
                    logger.info(f"Added landmark {landmark_data['name']} to database")
                
                return landmark_data
        except Exception as e:
            logger.error(f"Error adding landmark: {str(e)}")
            return None

    def update_landmark(self, landmark_id: str, landmark_data: Dict[str, Any]) -> bool:
        """Update an existing landmark using SQLAlchemy"""
        try:
            with self.get_session() as session:
                landmark = session.query(Landmark).filter(Landmark.id == landmark_id).first()
                
                if not landmark:
                    return False
                
                # Update landmark fields
                landmark.name = landmark_data['name']
                landmark.lat = landmark_data['lat']
                landmark.lon = landmark_data['lon']
                landmark.radius_m = landmark_data.get('radius_m', 500)
                landmark.description = landmark_data.get('description', '')
                landmark.category = landmark_data.get('category', 'custom')
                
                logger.info(f"Updated landmark {landmark_id}")
                return True
        except Exception as e:
            logger.error(f"Error updating landmark {landmark_id}: {str(e)}")
            return False

    def remove_landmark(self, landmark_id: str) -> bool:
        """Remove a landmark from the database using SQLAlchemy"""
        try:
            with self.get_session() as session:
                deleted_count = session.query(Landmark).filter(Landmark.id == landmark_id).delete()
                
                if deleted_count > 0:
                    logger.info(f"Removed landmark {landmark_id} from database")
                    return True
                return False
        except Exception as e:
            logger.error(f"Error removing landmark {landmark_id}: {str(e)}")
            return False

    def remove_landmarks_batch(self, landmark_ids: List[str]) -> int:
        """Remove multiple landmarks in a single transaction using SQLAlchemy"""
        if not landmark_ids:
            return 0
            
        try:
            with self.get_session() as session:
                deleted_count = session.query(Landmark).filter(Landmark.id.in_(landmark_ids)).delete(synchronize_session=False)
                
                logger.info(f"Batch removed {deleted_count} landmarks from database")
                return deleted_count
        except Exception as e:
            logger.error(f"Error batch removing landmarks: {str(e)}")
            return 0

    def remove_landmarks_by_category(self, category: str) -> int:
        """Remove all landmarks of a specific category using SQLAlchemy"""
        try:
            with self.get_session() as session:
                deleted_count = session.query(Landmark).filter(Landmark.category == category).delete()
                
                logger.info(f"Removed {deleted_count} landmarks with category '{category}'")
                return deleted_count
        except Exception as e:
            logger.error(f"Error removing landmarks by category {category}: {str(e)}")
            return 0

    def remove_trip_landmarks(self, trip_id: str) -> int:
        """Remove all landmarks associated with a specific trip using SQLAlchemy"""
        try:
            with self.get_session() as session:
                deleted_count = session.query(Landmark).filter(Landmark.trip_id == trip_id).delete()
                
                logger.info(f"Removed {deleted_count} landmarks associated with trip {trip_id}")
                return deleted_count
        except Exception as e:
            logger.error(f"Error removing landmarks for trip {trip_id}: {str(e)}")
            return 0

    def check_nearby(self, lat: float, lon: float, max_distance: Optional[float] = None) -> Optional[Dict[str, Any]]:
        """Check if vehicle is near any landmarks using SQLAlchemy"""
        if not lat or not lon:
            return None
            
        try:
            with self.get_session() as session:
                landmarks = session.query(Landmark).all()
                
                closest_landmark = None
                min_distance = float('inf')
                
                for landmark in landmarks:
                    try:
                        # Calculate distance from current location to landmark
                        distance = self._calculate_distance(lat, lon, landmark.lat, landmark.lon)
                        
                        # Check if within landmark's radius
                        landmark_radius = landmark.radius_m or 500  # Default 500m if not specified
                        
                        # Apply max_distance override if provided
                        if max_distance is not None:
                            landmark_radius = min(landmark_radius, max_distance)
                            
                        if distance <= landmark_radius:
                            # If found multiple landmarks within radius, pick the closest one
                            if distance < min_distance:
                                min_distance = distance
                                
                                # Copy landmark data and add distance
                                closest_landmark = self._landmark_to_dict(landmark)
                                closest_landmark['distance'] = distance
                                
                                # Check notification cooldown
                                landmark_id = landmark.id
                                current_time = datetime.now().timestamp()
                                
                                # Only mark for notification if cooldown expired or first time
                                if (landmark_id not in self.last_notified or 
                                        current_time - self.last_notified[landmark_id] > self.notification_cooldown):
                                    closest_landmark['notify'] = True
                                    self.last_notified[landmark_id] = current_time
                                else:
                                    closest_landmark['notify'] = False
                    except Exception as e:
                        logger.error(f"Error checking landmark {landmark.name}: {str(e)}")
                        
                return closest_landmark
                
        except Exception as e:
            logger.error(f"Error checking nearby landmarks: {str(e)}")
            return None

    def import_from_json(self, json_path: str) -> int:
        """Import landmarks from a JSON file using SQLAlchemy"""
        try:
            if not os.path.exists(json_path):
                logger.warning(f"JSON file not found: {json_path}")
                return 0
                
            with open(json_path, 'r') as f:
                landmarks = json.load(f)
                
            if not landmarks or not isinstance(landmarks, list):
                logger.warning(f"Invalid landmarks data in {json_path}")
                return 0
            
            added_count = 0
            
            with self.get_session() as session:
                # Generate UUIDs for landmarks without IDs first to avoid conflicts
                for landmark in landmarks:
                    if 'id' not in landmark:
                        import uuid
                        landmark['id'] = str(uuid.uuid4())[:8]
                
                # Now perform the inserts/updates within a single transaction
                for landmark in landmarks:
                    try:
                        landmark_id = landmark['id']
                        
                        existing = session.query(Landmark).filter(Landmark.id == landmark_id).first()
                        
                        if existing:
                            # Update existing landmark
                            existing.name = landmark['name']
                            existing.lat = landmark['lat']
                            existing.lon = landmark['lon']
                            existing.radius_m = landmark.get('radius_m', 500)
                            existing.description = landmark.get('description', '')
                            existing.category = landmark.get('category', 'custom')
                            existing.trip_id = landmark.get('trip_id')
                        else:
                            # Insert new landmark
                            new_landmark = Landmark(
                                id=landmark_id,
                                name=landmark['name'],
                                lat=landmark['lat'],
                                lon=landmark['lon'],
                                radius_m=landmark.get('radius_m', 500),
                                description=landmark.get('description', ''),
                                category=landmark.get('category', 'custom'),
                                trip_id=landmark.get('trip_id')
                            )
                            session.add(new_landmark)
                            
                        added_count += 1
                    except Exception as e:
                        logger.error(f"Error importing landmark {landmark.get('name', 'unknown')}: {str(e)}")
                        # Continue with next landmark instead of failing the entire batch
            
            logger.info(f"Imported {added_count} landmarks from {json_path}")
            return added_count
        except Exception as e:
            logger.error(f"Error importing landmarks from JSON: {str(e)}")
            return 0
            
    def export_to_json(self, json_path: str) -> int:
        """Export all landmarks to a JSON file"""
        try:
            landmarks = self.get_all_landmarks()
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(json_path), exist_ok=True)
            
            with open(json_path, 'w') as f:
                json.dump(landmarks, f, indent=2)
                
            logger.info(f"Exported {len(landmarks)} landmarks to {json_path}")
            return len(landmarks)
        except Exception as e:
            logger.error(f"Error exporting landmarks to JSON: {str(e)}")
            return 0
    
    # Variables for check_nearby functionality
    def _initialize_notification_vars(self):
        # Notification cooldown related attributes
        self.last_notified = {}  # Store landmark IDs and when they were last announced
        self.notification_cooldown = 300  # 5 minutes cooldown between repeat notifications
        
    # === Planned Trips Methods ===
    
    def get_all_trips(self) -> List[Dict[str, Any]]:
        """Get all planned trips from the database using SQLAlchemy"""
        try:
            with self.get_session() as session:
                trips = session.query(PlannedTrip).order_by(PlannedTrip.start_date).all()
                return [self._trip_to_dict(trip) for trip in trips]
        except Exception as e:
            logger.error(f"Error getting all planned trips: {str(e)}")
            return []
    
    def get_trip_by_id(self, trip_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific planned trip by ID using SQLAlchemy"""
        try:
            with self.get_session() as session:
                trip = session.query(PlannedTrip).filter(PlannedTrip.id == trip_id).first()
                
                if not trip:
                    return None
                    
                return self._trip_to_dict(trip)
        except Exception as e:
            logger.error(f"Error getting trip by ID {trip_id}: {str(e)}")
            return None
    
    def add_trip(self, trip_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Add a new planned trip to the database using SQLAlchemy"""
        try:
            if 'id' not in trip_data:
                # Generate a unique ID if not provided
                import uuid
                trip_data['id'] = str(uuid.uuid4())[:8]
                
            with self.get_session() as session:
                # Create new trip
                new_trip = PlannedTrip(
                    id=trip_data['id'],
                    name=trip_data['name'],
                    start_lat=trip_data['start_location']['lat'],
                    start_lon=trip_data['start_location']['lon'],
                    end_lat=trip_data['end_location']['lat'],
                    end_lon=trip_data['end_location']['lon'],
                    origin_name=trip_data.get('origin_name'),
                    destination_name=trip_data.get('destination_name'),
                    start_date=trip_data['start_date'],
                    end_date=trip_data['end_date'],
                    notes=trip_data.get('notes', ''),
                    landmarks_downloaded=trip_data.get('landmarks_downloaded', False),
                    completed=trip_data.get('completed', False)
                )
                session.add(new_trip)
                
                # Add waypoints if any
                if 'waypoints' in trip_data and trip_data['waypoints']:
                    for i, waypoint in enumerate(trip_data['waypoints']):
                        new_waypoint = TripWaypoint(
                            trip_id=trip_data['id'],
                            lat=waypoint['lat'],
                            lon=waypoint['lon'],
                            name=waypoint.get('name'),
                            position=i
                        )
                        session.add(new_waypoint)
                
                logger.info(f"Added planned trip {trip_data['name']} to database")
                return trip_data
        except Exception as e:
            logger.error(f"Error adding planned trip: {str(e)}")
            return None
            
    def update_trip(self, trip_id: str, trip_data: Dict[str, Any]) -> bool:
        """Update an existing planned trip using SQLAlchemy"""
        try:
            with self.get_session() as session:
                trip = session.query(PlannedTrip).filter(PlannedTrip.id == trip_id).first()
                
                if not trip:
                    return False
                
                # Update the trip record
                trip.name = trip_data['name']
                trip.start_lat = trip_data['start_location']['lat']
                trip.start_lon = trip_data['start_location']['lon']
                trip.end_lat = trip_data['end_location']['lat']
                trip.end_lon = trip_data['end_location']['lon']
                trip.origin_name = trip_data.get('origin_name')
                trip.destination_name = trip_data.get('destination_name')
                trip.start_date = trip_data['start_date']
                trip.end_date = trip_data['end_date']
                trip.notes = trip_data.get('notes', '')
                trip.landmarks_downloaded = trip_data.get('landmarks_downloaded', False)
                trip.completed = trip_data.get('completed', False)
                trip.updated_at = func.current_timestamp()
                
                # Delete and reinsert waypoints to handle changes
                session.query(TripWaypoint).filter(TripWaypoint.trip_id == trip_id).delete()
                
                # Insert updated waypoints if any
                if 'waypoints' in trip_data and trip_data['waypoints']:
                    for i, waypoint in enumerate(trip_data['waypoints']):
                        new_waypoint = TripWaypoint(
                            trip_id=trip_id,
                            lat=waypoint['lat'],
                            lon=waypoint['lon'],
                            name=waypoint.get('name'),
                            position=i
                        )
                        session.add(new_waypoint)
                
                logger.info(f"Updated planned trip {trip_id}")
                return True
        except Exception as e:
            logger.error(f"Error updating planned trip {trip_id}: {str(e)}")
            return False
            
    def remove_trip(self, trip_id: str) -> bool:
        """Remove a planned trip and its waypoints using SQLAlchemy"""
        try:
            with self.get_session() as session:
                # Delete the trip (waypoints will be deleted due to cascade)
                deleted_count = session.query(PlannedTrip).filter(PlannedTrip.id == trip_id).delete()
                
                if deleted_count > 0:
                    logger.info(f"Removed planned trip {trip_id} from database")
                    return True
                return False
        except Exception as e:
            logger.error(f"Error removing planned trip {trip_id}: {str(e)}")
            return False
            
    def update_trip_status(self, trip_id: str, landmarks_downloaded: Optional[bool] = None, completed: Optional[bool] = None) -> bool:
        """Update the status fields of a planned trip using SQLAlchemy"""
        try:
            with self.get_session() as session:
                trip = session.query(PlannedTrip).filter(PlannedTrip.id == trip_id).first()
                
                if not trip:
                    return False
                
                updated = False
                status_changes = []
                
                if landmarks_downloaded is not None:
                    trip.landmarks_downloaded = landmarks_downloaded
                    status_changes.append(f"landmarks_downloaded={landmarks_downloaded}")
                    updated = True
                    
                if completed is not None:
                    trip.completed = completed
                    status_changes.append(f"completed={completed}")
                    updated = True
                
                if updated:
                    trip.updated_at = func.current_timestamp()
                    logger.info(f"Updated trip {trip_id} status: {', '.join(status_changes)}")
                
                return updated
        except Exception as e:
            logger.error(f"Error updating trip {trip_id} status: {str(e)}")
            return False
    
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two coordinates in meters using Haversine formula"""
        # Earth radius in meters
        R = 6371000
        
        # Convert coordinates to radians
        lat1_rad = math.radians(float(lat1))
        lon1_rad = math.radians(float(lon1))
        lat2_rad = math.radians(float(lat2))
        lon2_rad = math.radians(float(lon2))
        
        # Differences
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        # Haversine formula
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        
        return distance
    
    def _landmark_to_dict(self, landmark: Landmark) -> Dict[str, Any]:
        """Convert SQLAlchemy Landmark model to dictionary"""
        return {
            'id': landmark.id,
            'name': landmark.name,
            'lat': landmark.lat,
            'lon': landmark.lon,
            'radius_m': landmark.radius_m,
            'description': landmark.description,
            'category': landmark.category,
            'trip_id': landmark.trip_id,
            'created_at': landmark.created_at.isoformat() if landmark.created_at else None
        }
    
    def _trip_to_dict(self, trip: PlannedTrip) -> Dict[str, Any]:
        """Convert SQLAlchemy PlannedTrip model to dictionary"""
        # Get waypoints
        waypoints = []
        for waypoint in trip.waypoints:
            waypoints.append({
                'lat': waypoint.lat,
                'lon': waypoint.lon,
                'name': waypoint.name
            })
        
        return {
            'id': trip.id,
            'name': trip.name,
            'start_location': {'lat': trip.start_lat, 'lon': trip.start_lon},
            'end_location': {'lat': trip.end_lat, 'lon': trip.end_lon},
            'origin_name': trip.origin_name,
            'destination_name': trip.destination_name,
            'start_date': trip.start_date,
            'end_date': trip.end_date,
            'notes': trip.notes,
            'landmarks_downloaded': trip.landmarks_downloaded,
            'completed': trip.completed,
            'created_at': trip.created_at.isoformat() if trip.created_at else None,
            'updated_at': trip.updated_at.isoformat() if trip.updated_at else None,
            'waypoints': waypoints
        }
