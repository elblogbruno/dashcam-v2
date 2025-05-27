import sqlite3
import os
import json
import logging
import time
from datetime import datetime, date, timedelta

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
        
        # Check for and apply any schema migrations
        self._check_and_apply_migrations()
        
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
            # !!! Actualizada para incluir columna 'tags' !!!
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS external_videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE,
                file_path TEXT,
                lat REAL,
                lon REAL,
                source TEXT,
                tags TEXT,
                upload_time TIMESTAMP
            )
            ''')
            
            # Create video clips table for short segments of recordings
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS video_clips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                sequence_num INTEGER,
                quality TEXT,
                road_video_file TEXT,
                interior_video_file TEXT,
                near_landmark BOOLEAN DEFAULT 0,
                landmark_id TEXT,
                FOREIGN KEY (trip_id) REFERENCES trips (id)
            )
            ''')
            
            conn.commit()
            conn.close()
            
            logger.info("Trip logger database initialized")
            
        except Exception as e:
            logger.error(f"Database initialization error: {str(e)}")
            raise
    
    def _check_and_apply_migrations(self):
        """Verifica y aplica migraciones necesarias en la base de datos"""
        try:
            logger.info("Verificando si se necesitan migraciones de esquema...")
            self._add_tags_column_if_missing()
            logger.info("Verificación de migraciones completada")
        except Exception as e:
            logger.error(f"Error durante la verificación de migraciones: {str(e)}")
    
    def _add_tags_column_if_missing(self):
        """Añade la columna 'tags' a la tabla external_videos si no existe"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Verificar si la columna ya existe
            cursor.execute("PRAGMA table_info(external_videos)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'tags' not in columns:
                logger.info("Columna 'tags' no encontrada en tabla 'external_videos'. Añadiendo columna...")
                cursor.execute("ALTER TABLE external_videos ADD COLUMN tags TEXT")
                conn.commit()
                logger.info("Columna 'tags' añadida correctamente")
            else:
                logger.info("Columna 'tags' ya existe en tabla 'external_videos'")
                
            conn.close()
        except Exception as e:
            logger.error(f"Error al verificar/añadir columna 'tags': {str(e)}")
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
            # Intentar buscar el último viaje sin finalizar en caso de fallo anterior
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM trips WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1")
                result = cursor.fetchone()
                if result:
                    self.current_trip_id = result[0]
                    logger.info(f"Recovered unfinished trip ID: {self.current_trip_id}")
                conn.close()
            except Exception as e:
                logger.error(f"Error finding unfinished trip: {str(e)}")
            
            if not self.current_trip_id:
                logger.warning("No trip to end, creating a new one")
                return self.start_trip()  # Crear un nuevo viaje si no hay ninguno activo
            
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
            
            # Verificar que la actualización se hizo correctamente
            cursor.execute("SELECT end_time FROM trips WHERE id = ?", (self.current_trip_id,))
            result = cursor.fetchone()
            logger.info(f"Trip end time update result: {result}")
            
            conn.close()
            
            # Record the trip ID and reset current trip
            ended_trip_id = self.current_trip_id
            self.current_trip_id = None
            
            logger.info(f"Ended trip {ended_trip_id}")
            return ended_trip_id
            
        except Exception as e:
            logger.error(f"Error ending trip: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return self.current_trip_id  # Devolver el ID actual incluso si hay error para no perder referencia
            
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
            
            # Query trip details with safe type casting
            cursor.execute('''
            SELECT id, start_time, end_time, 
                   CAST(IFNULL(start_lat, 0.0) AS REAL) as start_lat, 
                   CAST(IFNULL(start_lon, 0.0) AS REAL) as start_lon,
                   CAST(IFNULL(end_lat, 0.0) AS REAL) as end_lat, 
                   CAST(IFNULL(end_lon, 0.0) AS REAL) as end_lon,
                   CAST(IFNULL(distance_km, 0.0) AS REAL) as distance_km,
                   video_files, summary_file 
            FROM trips WHERE id = ?
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
            
            # Get video clips for this trip
            cursor.execute('''
            SELECT * FROM video_clips
            WHERE trip_id = ?
            ORDER BY sequence_num
            ''', (trip_id,))
            
            landmark_rows = cursor.fetchall()
            landmarks = [dict(row) for row in landmark_rows]
            trip_dict['landmarks'] = landmarks
            
            # Get video clips
            clip_rows = cursor.fetchall()
            clips = [dict(row) for row in clip_rows]
            trip_dict['video_clips'] = clips
            
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
            
            # Query trips on the target date - with type casting for safety
            cursor.execute('''
            SELECT id, start_time, end_time, 
                   CAST(IFNULL(start_lat, 0.0) AS REAL) as start_lat, 
                   CAST(IFNULL(start_lon, 0.0) AS REAL) as start_lon,
                   CAST(IFNULL(end_lat, 0.0) AS REAL) as end_lat, 
                   CAST(IFNULL(end_lon, 0.0) AS REAL) as end_lon,
                   CAST(IFNULL(distance_km, 0.0) AS REAL) as distance_km,
                   video_files, summary_file  
            FROM trips 
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
            
            # Query trips in the date range - con conversión segura de tipos
            cursor.execute('''
            SELECT id, start_time, end_time, 
                   CAST(IFNULL(start_lat, 0.0) AS REAL) as start_lat, 
                   CAST(IFNULL(start_lon, 0.0) AS REAL) as start_lon,
                   CAST(IFNULL(end_lat, 0.0) AS REAL) as end_lat, 
                   CAST(IFNULL(end_lon, 0.0) AS REAL) as end_lon,
                   CAST(IFNULL(distance_km, 0.0) AS REAL) as distance_km,
                   video_files, summary_file 
            FROM trips 
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
            
            # Query all trips with limit - usando CAST para asegurar los tipos correctos
            cursor.execute('''
            SELECT id, start_time, end_time, 
                   CAST(IFNULL(start_lat, 0.0) AS REAL) as start_lat, 
                   CAST(IFNULL(start_lon, 0.0) AS REAL) as start_lon,
                   CAST(IFNULL(end_lat, 0.0) AS REAL) as end_lat, 
                   CAST(IFNULL(end_lon, 0.0) AS REAL) as end_lon,
                   CAST(IFNULL(distance_km, 0.0) AS REAL) as distance_km,
                   video_files, summary_file 
            FROM trips 
            ORDER BY start_time DESC
            LIMIT ?
            ''', (limit if limit is not None else -1,))
            
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
            
        except sqlite3.Error as e:
            logger.error(f"Error de SQLite al obtener todos los viajes: {str(e)}, tipo: {type(e)}")
            return []
        except Exception as e:
            logger.error(f"Error general al obtener todos los viajes: {str(e)}, tipo: {type(e)}")
            import traceback
            logger.error(f"Detalle: {traceback.format_exc()}")
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
            (date, file_path, lat, lon, source, tags, upload_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                date_str,
                metadata.get('file_path', ''),
                metadata.get('lat'),
                metadata.get('lon'),
                metadata.get('source', 'external'),
                metadata.get('tags'),
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

    def cleanup(self):
        """Clean up database connections and resources"""
        logger.info("Cleaning up TripLogger resources")
        
        # Ensure any active trip is properly ended
        if self.current_trip_id:
            try:
                logger.info(f"Ending active trip {self.current_trip_id} during cleanup")
                self.end_trip()
            except Exception as e:
                logger.error(f"Error ending active trip during cleanup: {str(e)}")
                
        # Close any open database connections
        # Since we're using a connection-per-operation pattern, nothing explicit to close here
        
        logger.info("TripLogger cleanup completed")

    def add_video_clips(self, trip_id, clips_data, landmark_id=None):
        """Register video clips in the database
        
        Args:
            trip_id: ID of the trip
            clips_data: List of clips info dictionaries with start_time, end_time, sequence, files, quality
            landmark_id: Optional landmark ID if clips were recorded near a landmark
        """
        if not trip_id:
            logger.warning("Missing trip ID")
            return False
            
        if not clips_data:
            logger.warning("No clips data provided")
            return False
            
        logger.info(f"Adding video clips to database. Trip ID: {trip_id}, Clips count: {len(clips_data)}")
        logger.info(f"Clips data: {clips_data}")
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Listas para recopilar archivos de video e información
            all_video_files = []
            valid_clips = []
            
            # Procesamos cada clip
            for clip in clips_data:
                logger.info(f"Processing clip: {clip}")
                
                if not isinstance(clip, dict):
                    logger.warning(f"Invalid clip data format: {type(clip)}")
                    continue
                    
                # Verificar campos requeridos
                required_fields = ['start_time', 'end_time', 'sequence', 'quality', 'files']
                missing_fields = [field for field in required_fields if field not in clip]
                if missing_fields:
                    logger.warning(f"Clip missing required fields: {missing_fields}")
                    continue
                    
                # Verificar que el campo 'files' es un diccionario
                if not isinstance(clip['files'], dict):
                    logger.warning(f"Clip files field is not a dictionary: {clip['files']}")
                    continue
                
                # Extract file paths for each camera
                road_file = clip['files'].get('road', '')
                interior_file = clip['files'].get('interior', '')
                
                logger.info(f"Road file: {road_file}")
                logger.info(f"Interior file: {interior_file}")
                
                # Verificar que al menos un archivo existe
                if not road_file and not interior_file:
                    logger.warning(f"Clip has no valid files: {clip['files']}")
                    continue
                
                valid_clips.append(clip)
                
                # Agregar archivos a la lista
                if road_file:
                    all_video_files.append(road_file)
                if interior_file:
                    all_video_files.append(interior_file)
                
                # Insertar información del clip en la base de datos
                try:
                    cursor.execute('''
                    INSERT INTO video_clips (
                        trip_id, start_time, end_time, sequence_num, quality, 
                        road_video_file, interior_video_file, near_landmark, landmark_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        trip_id,
                        clip['start_time'],
                        clip['end_time'],
                        clip['sequence'],
                        clip['quality'],
                        road_file or '',
                        interior_file or '',
                        1 if landmark_id else 0,
                        landmark_id or ''
                    ))
                    
                    clip_id = cursor.lastrowid
                    logger.info(f"Added clip {clip['sequence']} to database, row ID: {clip_id}")
                    
                    # Sincronizar automáticamente con la tabla recordings
                    sync_count = self._sync_clip_to_recordings(trip_id, clip, cursor)
                    if sync_count > 0:
                        logger.info(f"Sincronizados {sync_count} archivos del clip {clip['sequence']} a recordings")
                    
                except Exception as e:
                    logger.error(f"Error inserting clip into database: {e}")
            
            # Actualizar la lista de archivos de video del viaje
            if all_video_files:
                self.update_trip_videos(trip_id, all_video_files)
            
            # Sincronizar cada clip con la tabla recordings
            for clip in clips_data:
                self._sync_clip_to_recordings(trip_id, clip, cursor)
            
            conn.commit()
            conn.close()
            
            logger.info(f"Added {len(valid_clips)} valid video clips for trip {trip_id}")
            return len(valid_clips) > 0
            
        except Exception as e:
            logger.error(f"Exception in add_video_clips: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
            
        except Exception as e:
            logger.error(f"Error adding video clips: {str(e)}")
            return False

    def _sync_clip_to_recordings(self, trip_id, clip_data, cursor):
        """
        Sincronizar un clip con la tabla recordings.
        Esta función se llama automáticamente cuando se añaden clips.
        """
        try:
            start_time = clip_data['start_time']
            end_time = clip_data['end_time']
            files = clip_data['files']
            
            # Calcular duración
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                duration = int((end_dt - start_dt).total_seconds())
            except Exception as e:
                logger.warning(f"No se pudo calcular duración para clip: {e}")
                duration = 0
            
            # Procesar cada archivo (road e interior)
            sync_count = 0
            for camera_type, filename in files.items():
                if not filename:
                    continue
                    
                # Construir la ruta completa del archivo
                file_path = f"/root/dashcam-v2/data/videos/{filename}"
                
                # Obtener tamaño del archivo
                file_size = 0
                try:
                    if os.path.exists(file_path):
                        file_size = os.path.getsize(file_path)
                except Exception as e:
                    logger.warning(f"No se pudo obtener el tamaño de {file_path}: {e}")
                
                # Verificar si ya existe en recordings
                cursor.execute("""
                    SELECT id FROM recordings WHERE file_path = ?
                """, (file_path,))
                
                if cursor.fetchone() is None:
                    # Insertar en recordings
                    cursor.execute("""
                        INSERT INTO recordings (
                            file_path, file_size, duration, 
                            start_time, end_time, trip_id,
                            is_archived, is_processed
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)
                    """, (
                        file_path, file_size, duration,
                        start_time, end_time, str(trip_id)
                    ))
                    sync_count += 1
                    logger.debug(f"Sincronizado a recordings: {filename} ({camera_type})")
                else:
                    logger.debug(f"Ya existe en recordings: {filename}")
            
            return sync_count
            
        except Exception as e:
            logger.error(f"Error sincronizando clip a recordings: {e}")
            return 0

    def get_external_video(self, video_id):
        """
        Obtiene la información de un video externo específico por su ID
        
        Args:
            video_id: ID del video externo a buscar
            
        Returns:
            Diccionario con los datos del video o None si no se encuentra
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT * FROM external_videos
            WHERE id = ?
            ''', (video_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                video_dict = dict(row)
                
                # Parse metadata JSON if it exists
                if video_dict.get('metadata'):
                    try:
                        video_dict['metadata'] = json.loads(video_dict['metadata'])
                    except:
                        video_dict['metadata'] = {}
                        
                return video_dict
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error obteniendo video externo {video_id}: {str(e)}")
            return None