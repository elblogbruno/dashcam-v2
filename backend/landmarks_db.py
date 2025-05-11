import sqlite3
import os
import json
import math
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LandmarksDB:
    def __init__(self, db_path=None):
        # Set database path - prioritize explicit path, then env var, then fallback to default
        self.db_path = db_path or os.environ.get('DASHCAM_DB_PATH') or os.path.join(
            os.environ.get('DASHCAM_DATA_PATH', os.path.join(os.path.dirname(__file__), 'data')), 
            'recordings.db'
        )
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Connection timeout and retry configuration
        self.connection_timeout = 10.0  # seconds
        self.max_retries = 3
        
        # Initialize notification variables
        self._initialize_notification_vars()
        
        # Initialize database
        self._init_database()
        
    def _get_connection(self):
        """Establishes a connection to the database with retry mechanism"""
        retries = 0
        last_error = None
        
        while retries < self.max_retries:
            try:
                # Set timeout to avoid waiting indefinitely for a locked database
                conn = sqlite3.connect(self.db_path, timeout=self.connection_timeout)
                return conn
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e):
                    # Wait and retry if database is locked
                    import time
                    wait_time = 0.5 * (2 ** retries)  # Exponential backoff
                    logger.warning(f"Database locked, retrying in {wait_time}s (attempt {retries+1}/{self.max_retries})")
                    time.sleep(wait_time)
                    retries += 1
                    last_error = e
                else:
                    # Other operational errors
                    raise
            except Exception as e:
                # Other unexpected errors
                raise
                
        # If we've exhausted retries
        logger.error(f"Failed to connect after {self.max_retries} attempts: {str(last_error)}")
        raise last_error or Exception("Failed to connect to database")

    def _init_database(self):
        """Initialize the SQLite database with necessary tables"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Create landmarks table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS landmarks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                radius_m INTEGER DEFAULT 500,
                description TEXT,
                category TEXT DEFAULT 'custom',
                trip_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # Create index for trip_id to quickly find landmarks associated with a trip
            cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_landmarks_trip_id ON landmarks (trip_id)
            ''')
            
            # Create index for spatial queries
            cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_landmarks_location ON landmarks (lat, lon)
            ''')
            
            # Create planned trips table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS planned_trips (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                start_lat REAL NOT NULL,
                start_lon REAL NOT NULL,
                end_lat REAL NOT NULL,
                end_lon REAL NOT NULL,
                origin_name TEXT,
                destination_name TEXT,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                notes TEXT,
                landmarks_downloaded BOOLEAN DEFAULT FALSE,
                completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # Create waypoints table for trips
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS trip_waypoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                name TEXT,
                position INTEGER NOT NULL,
                FOREIGN KEY (trip_id) REFERENCES planned_trips(id) ON DELETE CASCADE
            )
            ''')
            
            # Create index for trip_id in waypoints
            cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_waypoints_trip_id ON trip_waypoints (trip_id)
            ''')
            
            conn.commit()
            conn.close()
            
            logger.info("Database initialized with landmarks and planned trips tables")
            
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise
    
    def get_all_landmarks(self):
        """Get all landmarks from the database"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM landmarks')
            rows = cursor.fetchall()
            
            landmarks = []
            for row in rows:
                landmarks.append(dict(row))
                
            conn.close()
            return landmarks
        except Exception as e:
            logger.error(f"Error getting all landmarks: {str(e)}")
            return []
    
    def get_landmarks_by_trip(self, trip_id):
        """Get all landmarks associated with a specific trip"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM landmarks WHERE trip_id = ?', (trip_id,))
            rows = cursor.fetchall()
            
            landmarks = []
            for row in rows:
                landmarks.append(dict(row))
                
            conn.close()
            return landmarks
        except Exception as e:
            logger.error(f"Error getting landmarks for trip {trip_id}: {str(e)}")
            return []
    
    def get_landmarks_in_area(self, lat, lon, radius_km=10):
        """Get landmarks within a specific radius (approximate using simple distance calculation)"""
        # For better performance we use a simpler calculation to filter by area
        # Then we apply the more accurate Haversine formula on the filtered results
        try:
            # Approximate conversion of km to degrees (at middle latitudes)
            # This is an approximation that works reasonably well for small distances
            lat_range = radius_km / 111.0  # 1 degree of latitude is approximately 111km
            lon_range = radius_km / (111.0 * abs(math.cos(math.radians(lat))))
            
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Initial filtering using bounding box
            cursor.execute('''
            SELECT * FROM landmarks 
            WHERE lat BETWEEN ? AND ?
              AND lon BETWEEN ? AND ?
            ''', (
                lat - lat_range, lat + lat_range,
                lon - lon_range, lon + lon_range
            ))
            
            rows = cursor.fetchall()
            
            # Further refine with accurate distance calculation
            landmarks = []
            for row in rows:
                landmark = dict(row)
                distance = self._calculate_distance(
                    lat, lon, landmark['lat'], landmark['lon']
                )
                
                # Convert to km and check radius
                if distance / 1000 <= radius_km:
                    landmark['distance'] = distance
                    landmarks.append(landmark)
                    
            conn.close()
            return landmarks
        except Exception as e:
            logger.error(f"Error getting landmarks in area: {str(e)}")
            return []
    
    def add_landmark(self, landmark):
        """Add a new landmark to the database"""
        try:
            if 'id' not in landmark:
                # Generate a unique ID if not provided
                import uuid
                landmark['id'] = str(uuid.uuid4())[:8]
                
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if landmark with this ID already exists
            cursor.execute('SELECT id FROM landmarks WHERE id = ?', (landmark['id'],))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing landmark instead of inserting
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
                    landmark['id']
                ))
                logger.info(f"Updated existing landmark {landmark['name']} in database")
            else:
                # Insert new landmark
                cursor.execute('''
                INSERT INTO landmarks (id, name, lat, lon, radius_m, description, category, trip_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    landmark['id'],
                    landmark['name'],
                    landmark['lat'],
                    landmark['lon'],
                    landmark.get('radius_m', 500),
                    landmark.get('description', ''),
                    landmark.get('category', 'custom'),
                    landmark.get('trip_id')
                ))
                logger.info(f"Added landmark {landmark['name']} to database")
            
            conn.commit()
            conn.close()
            
            return landmark
        except Exception as e:
            logger.error(f"Error adding landmark: {str(e)}")
            return None
    
    def update_landmark(self, landmark_id, landmark_data):
        """Update an existing landmark"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if landmark exists
            cursor.execute('SELECT id FROM landmarks WHERE id = ?', (landmark_id,))
            if not cursor.fetchone():
                conn.close()
                return False
                
            # Update landmark
            cursor.execute('''
            UPDATE landmarks
            SET name = ?, lat = ?, lon = ?, radius_m = ?, description = ?, category = ?
            WHERE id = ?
            ''', (
                landmark_data['name'],
                landmark_data['lat'],
                landmark_data['lon'],
                landmark_data.get('radius_m', 500),
                landmark_data.get('description', ''),
                landmark_data.get('category', 'custom'),
                landmark_id
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Updated landmark {landmark_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating landmark {landmark_id}: {str(e)}")
            return False
    
    def remove_landmark(self, landmark_id):
        """Remove a landmark from the database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM landmarks WHERE id = ?', (landmark_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logger.info(f"Removed landmark {landmark_id} from database")
            
            return deleted
        except Exception as e:
            logger.error(f"Error removing landmark {landmark_id}: {str(e)}")
            return False
    
    def remove_trip_landmarks(self, trip_id):
        """Remove all landmarks associated with a specific trip"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # First get the count for logging
            cursor.execute('SELECT COUNT(*) FROM landmarks WHERE trip_id = ?', (trip_id,))
            count = cursor.fetchone()[0]
            
            # Now delete the landmarks
            cursor.execute('DELETE FROM landmarks WHERE trip_id = ?', (trip_id,))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Removed {count} landmarks associated with trip {trip_id}")
            return count
        except Exception as e:
            logger.error(f"Error removing landmarks for trip {trip_id}: {str(e)}")
            return 0
            
    def check_nearby(self, lat, lon, max_distance=None):
        """Check if vehicle is near any landmarks, return details of closest one within radius"""
        if not lat or not lon:
            return None
            
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get all landmarks
            cursor.execute('SELECT * FROM landmarks')
            landmarks = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            closest_landmark = None
            min_distance = float('inf')
            
            for landmark in landmarks:
                try:
                    # Calculate distance from current location to landmark
                    distance = self._calculate_distance(
                        lat, lon, 
                        landmark['lat'], landmark['lon']
                    )
                    
                    # Check if within landmark's radius
                    landmark_radius = landmark.get('radius_m', 500)  # Default 500m if not specified
                    
                    # Apply max_distance override if provided
                    if max_distance is not None:
                        landmark_radius = min(landmark_radius, max_distance)
                        
                    if distance <= landmark_radius:
                        # If found multiple landmarks within radius, pick the closest one
                        if distance < min_distance:
                            min_distance = distance
                            
                            # Copy landmark data and add distance
                            closest_landmark = landmark.copy()
                            closest_landmark['distance'] = distance
                            
                            # Check notification cooldown
                            landmark_id = landmark['id']
                            current_time = datetime.now().timestamp()
                            
                            # Only mark for notification if cooldown expired or first time
                            if (landmark_id not in self.last_notified or 
                                    current_time - self.last_notified[landmark_id] > self.notification_cooldown):
                                closest_landmark['notify'] = True
                                self.last_notified[landmark_id] = current_time
                            else:
                                closest_landmark['notify'] = False
                except Exception as e:
                    logger.error(f"Error checking landmark {landmark.get('name', 'unknown')}: {str(e)}")
                    
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
