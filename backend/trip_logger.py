import sqlite3
import os
import json
import logging
import time
from datetime import datetime, date

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TripLogger:
    def __init__(self, db_path=None):
        # Set database path - prioritize explicit path, then env var, then fallback to default
        self.db_path = db_path or os.environ.get('DASHCAM_DB_PATH') or os.path.join(
            os.environ.get('DASHCAM_DATA_PATH', os.path.join(os.path.dirname(__file__), 'data')), 
            'recordings.db'
        )
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        # Current trip ID (set when recording starts)
        self.current_trip_id = None
        
    def _init_database(self):
        """Initialize the SQLite database with necessary tables"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create trips table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                start_lat REAL,
                start_lon REAL,
                end_lat REAL,
                end_lon REAL,
                distance_km REAL,
                video_files TEXT,
                summary_file TEXT
            )
            ''')
            
            # Create landmarks table to record landmark encounters during trips
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS landmark_encounters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER,
                landmark_id TEXT,
                landmark_name TEXT,
                lat REAL,
                lon REAL,
                encounter_time TIMESTAMP,
                FOREIGN KEY (trip_id) REFERENCES trips (id)
            )
            ''')
            
            # Create external videos table (for Insta360 uploads)
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS external_videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE,
                file_path TEXT,
                lat REAL,
                lon REAL,
                source TEXT,
                upload_time TIMESTAMP
            )
            ''')
            
            conn.commit()
            conn.close()
            
            logger.info("Trip logger database initialized")
            
        except Exception as e:
            logger.error(f"Database initialization error: {str(e)}")
            raise
            
    def start_trip(self):
        """Start a new trip recording, return the trip ID"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            now = datetime.now()
            
            # Insert new trip with start time
            cursor.execute('''
            INSERT INTO trips (start_time) VALUES (?)
            ''', (now.isoformat(),))
            
            # Get the last inserted ID
            self.current_trip_id = cursor.lastrowid
            
            conn.commit()
            conn.close()
            
            logger.info(f"Started new trip with ID {self.current_trip_id}")
            return self.current_trip_id
            
        except Exception as e:
            logger.error(f"Error starting trip: {str(e)}")
            return None
            
    def update_trip_location(self, lat, lon, is_start=False):
        """Update the start or end location of current trip"""
        if not self.current_trip_id:
            logger.warning("No active trip to update location")
            return False
            
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if is_start:
                # Update start location
                cursor.execute('''
                UPDATE trips SET start_lat = ?, start_lon = ? WHERE id = ?
                ''', (lat, lon, self.current_trip_id))
            else:
                # Update end location
                cursor.execute('''
                UPDATE trips SET end_lat = ?, end_lon = ? WHERE id = ?
                ''', (lat, lon, self.current_trip_id))
                
            conn.commit()
            conn.close()
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating trip location: {str(e)}")
            return False
            
    def end_trip(self, end_lat=None, end_lon=None):
        """End the current trip recording"""
        if not self.current_trip_id:
            logger.warning("No active trip to end")
            return False
            
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            now = datetime.now()
            
            # Update end time and location if provided
            if end_lat is not None and end_lon is not None:
                cursor.execute('''
                UPDATE trips SET end_time = ?, end_lat = ?, end_lon = ? WHERE id = ?
                ''', (now.isoformat(), end_lat, end_lon, self.current_trip_id))
            else:
                cursor.execute('''
                UPDATE trips SET end_time = ? WHERE id = ?
                ''', (now.isoformat(), self.current_trip_id))
                
            conn.commit()
            conn.close()
            
            # Record the trip ID and reset current trip
            ended_trip_id = self.current_trip_id
            self.current_trip_id = None
            
            logger.info(f"Ended trip {ended_trip_id}")
            return ended_trip_id
            
        except Exception as e:
            logger.error(f"Error ending trip: {str(e)}")
            return False
            
    def add_landmark_encounter(self, landmark_data):
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
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            now = datetime.now()
            
            cursor.execute('''
            INSERT INTO landmark_encounters 
            (trip_id, landmark_id, landmark_name, lat, lon, encounter_time)
            VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                self.current_trip_id,
                landmark_data.get('id', ''),
                landmark_data.get('name', 'Unknown'),
                landmark_data.get('lat', 0),
                landmark_data.get('lon', 0),
                now.isoformat()
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Recorded landmark encounter: {landmark_data.get('name')}")
            return True
            
        except Exception as e:
            logger.error(f"Error recording landmark encounter: {str(e)}")
            return False
            
    def update_trip_videos(self, trip_id, video_files):
        """Update the list of video files for a trip"""
        try:
            if isinstance(video_files, list):
                # Convert list to JSON string
                video_files_json = json.dumps(video_files)
            else:
                video_files_json = json.dumps([video_files])
                
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            UPDATE trips SET video_files = ? WHERE id = ?
            ''', (video_files_json, trip_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Updated videos for trip {trip_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating trip videos: {str(e)}")
            return False
            
    def update_trip_summary(self, trip_id, summary_file):
        """Update the summary video file for a trip"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            UPDATE trips SET summary_file = ? WHERE id = ?
            ''', (summary_file, trip_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Updated summary video for trip {trip_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating trip summary: {str(e)}")
            return False
            
    def get_trip(self, trip_id):
        """Get details of a specific trip"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Return rows as dictionaries
            cursor = conn.cursor()
            
            # Query trip details
            cursor.execute('''
            SELECT * FROM trips WHERE id = ?
            ''', (trip_id,))
            
            trip = cursor.fetchone()
            
            if not trip:
                conn.close()
                return None
                
            # Convert to dict
            trip_dict = dict(trip)
            
            # Parse video files JSON
            if trip_dict.get('video_files'):
                try:
                    trip_dict['video_files'] = json.loads(trip_dict['video_files'])
                except:
                    trip_dict['video_files'] = []
                    
            # Get landmarks encountered during this trip
            cursor.execute('''
            SELECT * FROM landmark_encounters 
            WHERE trip_id = ? 
            ORDER BY encounter_time
            ''', (trip_id,))
            
            landmarks = [dict(row) for row in cursor.fetchall()]
            trip_dict['landmarks'] = landmarks
            
            conn.close()
            
            return trip_dict
            
        except Exception as e:
            logger.error(f"Error getting trip {trip_id}: {str(e)}")
            return None
            
    def get_trips_by_date(self, target_date):
        """Get all trips for a specific date"""
        try:
            date_str = target_date.strftime("%Y-%m-%d")
            
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Query trips on the target date
            cursor.execute('''
            SELECT * FROM trips 
            WHERE date(start_time) = ? 
            ORDER BY start_time DESC
            ''', (date_str,))
            
            trips = [dict(row) for row in cursor.fetchall()]
            
            # Get external videos for this date
            cursor.execute('''
            SELECT * FROM external_videos
            WHERE date = ?
            ORDER BY upload_time DESC
            ''', (date_str,))
            
            external_videos = [dict(row) for row in cursor.fetchall()]
            
            # Parse video files JSON for each trip
            for trip in trips:
                if trip.get('video_files'):
                    try:
                        trip['video_files'] = json.loads(trip['video_files'])
                    except:
                        trip['video_files'] = []
                        
            conn.close()
            
            return {
                "trips": trips,
                "external_videos": external_videos
            }
            
        except Exception as e:
            logger.error(f"Error getting trips for date {target_date}: {str(e)}")
            return {"trips": [], "external_videos": []}
            
    def get_trips_by_date_range(self, start_date, end_date):
        """Get all trips within a date range"""
        try:
            start_str = start_date.strftime("%Y-%m-%d")
            end_str = end_date.strftime("%Y-%m-%d")
            
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Query trips in the date range
            cursor.execute('''
            SELECT * FROM trips 
            WHERE date(start_time) >= ? AND date(start_time) <= ? 
            ORDER BY start_time DESC
            ''', (start_str, end_str))
            
            trips = [dict(row) for row in cursor.fetchall()]
            
            # Get external videos in this range
            cursor.execute('''
            SELECT * FROM external_videos
            WHERE date >= ? AND date <= ?
            ORDER BY date DESC, upload_time DESC
            ''', (start_str, end_str))
            
            external_videos = [dict(row) for row in cursor.fetchall()]
            
            # Parse video files JSON for each trip
            for trip in trips:
                if trip.get('video_files'):
                    try:
                        trip['video_files'] = json.loads(trip['video_files'])
                    except:
                        trip['video_files'] = []
                        
            conn.close()
            
            return {
                "trips": trips,
                "external_videos": external_videos
            }
            
        except Exception as e:
            logger.error(f"Error getting trips for date range {start_date} to {end_date}: {str(e)}")
            return {"trips": [], "external_videos": []}
            
    def get_all_trips(self, limit=100):
        """Get all trips, with optional limit"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Query all trips with limit
            cursor.execute('''
            SELECT * FROM trips 
            ORDER BY start_time DESC
            LIMIT ?
            ''', (limit,))
            
            trips = [dict(row) for row in cursor.fetchall()]
            
            # Parse video files JSON for each trip
            for trip in trips:
                if trip.get('video_files'):
                    try:
                        trip['video_files'] = json.loads(trip['video_files'])
                    except:
                        trip['video_files'] = []
                        
            conn.close()
            
            return trips
            
        except Exception as e:
            logger.error(f"Error getting all trips: {str(e)}")
            return []
            
    def add_external_video(self, video_date, metadata):
        """Add an external video (e.g., from Insta360)"""
        try:
            # Convert date to string if it's a date object
            if isinstance(video_date, date):
                date_str = video_date.strftime("%Y-%m-%d")
            else:
                date_str = video_date
                
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            now = datetime.now()
            
            cursor.execute('''
            INSERT INTO external_videos
            (date, file_path, lat, lon, source, upload_time)
            VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                date_str,
                metadata.get('file_path', ''),
                metadata.get('lat'),
                metadata.get('lon'),
                metadata.get('source', 'external'),
                now.isoformat()
            ))
            
            # Get the inserted ID
            video_id = cursor.lastrowid
            
            conn.commit()
            conn.close()
            
            logger.info(f"Added external video for date {date_str}")
            return video_id
            
        except Exception as e:
            logger.error(f"Error adding external video: {str(e)}")
            return None
            
    def get_calendar_data(self, year, month):
        """Get data for calendar view - which days have recordings"""
        try:
            # First day of month
            start_date = date(year, month, 1)
            
            # Last day of month
            if month == 12:
                end_date = date(year + 1, 1, 1)
            else:
                end_date = date(year, month + 1, 1)
                
            # Adjust end date to be inclusive
            from datetime import timedelta
            end_date = end_date - timedelta(days=1)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get days with trip recordings
            cursor.execute('''
            SELECT DISTINCT date(start_time) as day, COUNT(*) as trip_count
            FROM trips
            WHERE date(start_time) >= ? AND date(start_time) <= ?
            GROUP BY day
            ''', (start_date.isoformat(), end_date.isoformat()))
            
            trip_days = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Get days with external videos
            cursor.execute('''
            SELECT date, COUNT(*) as video_count
            FROM external_videos
            WHERE date >= ? AND date <= ?
            GROUP BY date
            ''', (start_date.isoformat(), end_date.isoformat()))
            
            video_days = {row[0]: row[1] for row in cursor.fetchall()}
            
            conn.close()
            
            # Combine the data
            calendar_data = {}
            
            # Process all days in the month
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.isoformat()
                
                calendar_data[date_str] = {
                    "trips": trip_days.get(date_str, 0),
                    "external_videos": video_days.get(date_str, 0)
                }
                
                current_date += timedelta(days=1)
                
            return calendar_data
            
        except Exception as e:
            logger.error(f"Error getting calendar data: {str(e)}")
            return {}