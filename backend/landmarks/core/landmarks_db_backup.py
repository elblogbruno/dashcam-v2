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
    
    def import_from_json(self, json_path):
        """Import landmarks from a JSON file"""
        try:
            if not os.path.exists(json_path):
                logger.warning(f"JSON file not found: {json_path}")
                return 0
                
            with open(json_path, 'r') as f:
                landmarks = json.load(f)
                
            if not landmarks or not isinstance(landmarks, list):
                logger.warning(f"Invalid landmarks data in {json_path}")
                return 0
            
            # Use our improved connection handling    
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Use a transaction to ensure atomicity
            added_count = 0
            
            # Generate UUIDs for landmarks without IDs first to avoid conflicts
            for i, landmark in enumerate(landmarks):
                if 'id' not in landmark:
                    import uuid
                    landmarks[i]['id'] = str(uuid.uuid4())[:8]
            
            # Now perform the inserts/updates within a single transaction
            try:
                for landmark in landmarks:
                    try:
                        # Check if the landmark already exists
                        landmark_id = landmark['id']  # We know it exists now
                        
                        cursor.execute('SELECT id FROM landmarks WHERE id = ?', (landmark_id,))
                        if cursor.fetchone():
                            # Update existing landmark
                            cursor.execute('''
                            UPDATE landmarks
                            SET name = ?, lat = ?, lon = ?, radius_m = ?, description = ?, category = ?, trip_id = ?
                            WHERE id = ?
                            ''', (
                                landmark['name'],
                                landmark['lat'],
                                landmark['lon'],
                                landmark.get('radius_m', 500),
                                landmark.get('description', ''),
                                landmark.get('category', 'custom'),
                                landmark.get('trip_id'),
                                landmark_id
                            ))
                        else:
                            # Insert new landmark
                            cursor.execute('''
                            INSERT INTO landmarks (id, name, lat, lon, radius_m, description, category, trip_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                landmark_id,
                                landmark['name'],
                                landmark['lat'],
                                landmark['lon'],
                                landmark.get('radius_m', 500),
                                landmark.get('description', ''),
                                landmark.get('category', 'custom'),
                                landmark.get('trip_id')
                            ))
                            
                        added_count += 1
                    except Exception as e:
                        logger.error(f"Error importing landmark {landmark.get('name', 'unknown')}: {str(e)}")
                        # Continue with next landmark instead of failing the entire batch
                
                # Commit all changes at once
                conn.commit()
                
            except Exception as e:
                # Roll back on error
                conn.rollback()
                logger.error(f"Transaction error during landmark import: {str(e)}")
                raise
            finally:
                conn.close()
            
            logger.info(f"Imported {added_count} landmarks from {json_path}")
            return added_count
        except Exception as e:
            logger.error(f"Error importing landmarks from JSON: {str(e)}")
            return 0
            
    def export_to_json(self, json_path):
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
    
    # Variables for check_nearby functionality - these are now incorporated into the main __init__ method
    def _initialize_notification_vars(self):
        # Notification cooldown related attributes
        self.last_notified = {}  # Store landmark IDs and when they were last announced
        self.notification_cooldown = 300  # 5 minutes cooldown between repeat notifications
        
    # === Planned Trips Methods ===
    
    def get_all_trips(self):
        """Get all planned trips from the database"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get all trips
            cursor.execute('SELECT * FROM planned_trips ORDER BY start_date')
            trip_rows = cursor.fetchall()
            
            trips = []
            for trip_row in trip_rows:
                trip = dict(trip_row)
                
                # Format start and end locations
                trip['start_location'] = {'lat': trip.pop('start_lat'), 'lon': trip.pop('start_lon')}
                trip['end_location'] = {'lat': trip.pop('end_lat'), 'lon': trip.pop('end_lon')}
                
                # Get waypoints for this trip
                cursor.execute('SELECT * FROM trip_waypoints WHERE trip_id = ? ORDER BY position', (trip['id'],))
                waypoint_rows = cursor.fetchall()
                
                waypoints = []
                for wp_row in waypoint_rows:
                    waypoint = dict(wp_row)
                    waypoints.append({
                        'lat': waypoint['lat'],
                        'lon': waypoint['lon'],
                        'name': waypoint['name']
                    })
                
                trip['waypoints'] = waypoints
                trips.append(trip)
                
            conn.close()
            return trips
        except Exception as e:
            logger.error(f"Error getting all planned trips: {str(e)}")
            return []
    
    def get_trip_by_id(self, trip_id):
        """Get a specific planned trip by ID"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM planned_trips WHERE id = ?', (trip_id,))
            trip_row = cursor.fetchone()
            
            if not trip_row:
                conn.close()
                return None
                
            trip = dict(trip_row)
            
            # Format start and end locations
            trip['start_location'] = {'lat': trip.pop('start_lat'), 'lon': trip.pop('start_lon')}
            trip['end_location'] = {'lat': trip.pop('end_lat'), 'lon': trip.pop('end_lon')}
            
            # Get waypoints for this trip
            cursor.execute('SELECT * FROM trip_waypoints WHERE trip_id = ? ORDER BY position', (trip_id,))
            waypoint_rows = cursor.fetchall()
            
            waypoints = []
            for wp_row in waypoint_rows:
                waypoint = dict(wp_row)
                waypoints.append({
                    'lat': waypoint['lat'],
                    'lon': waypoint['lon'],
                    'name': waypoint['name']
                })
            
            trip['waypoints'] = waypoints
            conn.close()
            
            return trip
        except Exception as e:
            logger.error(f"Error getting trip by ID {trip_id}: {str(e)}")
            return None
    
    def add_trip(self, trip):
        """Add a new planned trip to the database"""
        try:
            if 'id' not in trip:
                # Generate a unique ID if not provided
                import uuid
                trip['id'] = str(uuid.uuid4())[:8]
                
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Insert the trip record
            cursor.execute('''
            INSERT INTO planned_trips (
                id, name, 
                start_lat, start_lon, 
                end_lat, end_lon,
                origin_name, destination_name,
                start_date, end_date, 
                notes, landmarks_downloaded, completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                trip['id'],
                trip['name'],
                trip['start_location']['lat'],
                trip['start_location']['lon'],
                trip['end_location']['lat'],
                trip['end_location']['lon'],
                trip.get('origin_name'),
                trip.get('destination_name'),
                trip['start_date'],
                trip['end_date'],
                trip.get('notes', ''),
                trip.get('landmarks_downloaded', False),
                trip.get('completed', False)
            ))
            
            # Insert waypoints if any
            if 'waypoints' in trip and trip['waypoints']:
                for i, waypoint in enumerate(trip['waypoints']):
                    cursor.execute('''
                    INSERT INTO trip_waypoints (trip_id, lat, lon, name, position)
                    VALUES (?, ?, ?, ?, ?)
                    ''', (
                        trip['id'],
                        waypoint['lat'],
                        waypoint['lon'],
                        waypoint.get('name'),
                        i
                    ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Added planned trip {trip['name']} to database")
            return trip
        except Exception as e:
            logger.error(f"Error adding planned trip: {str(e)}")
            return None
            
    def update_trip(self, trip_id, trip_data):
        """Update an existing planned trip"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Check if trip exists
            cursor.execute('SELECT id FROM planned_trips WHERE id = ?', (trip_id,))
            if not cursor.fetchone():
                conn.close()
                return False
            
            # Update the trip record
            cursor.execute('''
            UPDATE planned_trips SET
                name = ?, 
                start_lat = ?, start_lon = ?, 
                end_lat = ?, end_lon = ?,
                origin_name = ?, destination_name = ?,
                start_date = ?, end_date = ?, 
                notes = ?, landmarks_downloaded = ?, completed = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', (
                trip_data['name'],
                trip_data['start_location']['lat'],
                trip_data['start_location']['lon'],
                trip_data['end_location']['lat'],
                trip_data['end_location']['lon'],
                trip_data.get('origin_name'),
                trip_data.get('destination_name'),
                trip_data['start_date'],
                trip_data['end_date'],
                trip_data.get('notes', ''),
                trip_data.get('landmarks_downloaded', False),
                trip_data.get('completed', False),
                trip_id
            ))
            
            # Delete and reinsert waypoints to handle changes
            cursor.execute('DELETE FROM trip_waypoints WHERE trip_id = ?', (trip_id,))
            
            # Insert updated waypoints if any
            if 'waypoints' in trip_data and trip_data['waypoints']:
                for i, waypoint in enumerate(trip_data['waypoints']):
                    cursor.execute('''
                    INSERT INTO trip_waypoints (trip_id, lat, lon, name, position)
                    VALUES (?, ?, ?, ?, ?)
                    ''', (
                        trip_id,
                        waypoint['lat'],
                        waypoint['lon'],
                        waypoint.get('name'),
                        i
                    ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Updated planned trip {trip_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating planned trip {trip_id}: {str(e)}")
            return False
            
    def remove_trip(self, trip_id):
        """Remove a planned trip and its waypoints"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Delete waypoints first to maintain referential integrity
            cursor.execute('DELETE FROM trip_waypoints WHERE trip_id = ?', (trip_id,))
            
            # Then delete the trip
            cursor.execute('DELETE FROM planned_trips WHERE id = ?', (trip_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logger.info(f"Removed planned trip {trip_id} from database")
            
            return deleted
        except Exception as e:
            logger.error(f"Error removing planned trip {trip_id}: {str(e)}")
            return False
            
    def update_trip_status(self, trip_id, landmarks_downloaded=None, completed=None):
        """Update the status fields of a planned trip"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            updates = []
            params = []
            
            if landmarks_downloaded is not None:
                updates.append("landmarks_downloaded = ?")
                params.append(landmarks_downloaded)
                
            if completed is not None:
                updates.append("completed = ?")
                params.append(completed)
                
            if not updates:  # Nothing to update
                conn.close()
                return True
                
            updates.append("updated_at = CURRENT_TIMESTAMP")
            
            # Add the trip_id as the last parameter
            params.append(trip_id)
            
            cursor.execute(
                f"UPDATE planned_trips SET {', '.join(updates)} WHERE id = ?",
                params
            )
            
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                status_changes = []
                if landmarks_downloaded is not None:
                    status_changes.append(f"landmarks_downloaded={landmarks_downloaded}")
                if completed is not None:
                    status_changes.append(f"completed={completed}")
                
                logger.info(f"Updated trip {trip_id} status: {', '.join(status_changes)}")
            
            return updated
        except Exception as e:
            logger.error(f"Error updating trip {trip_id} status: {str(e)}")
            return False
    
    def _calculate_distance(self, lat1, lon1, lat2, lon2):
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
