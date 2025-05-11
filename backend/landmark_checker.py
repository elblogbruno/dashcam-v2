import json
import os
import math
import logging
from datetime import datetime
from data_persistence import get_persistence_manager
from landmarks_db import LandmarksDB

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LandmarkChecker:
    def __init__(self, landmarks_file=None):
        self.landmarks = []
        self.last_notified = {}  # Store landmark IDs and when they were last announced
        self.notification_cooldown = 300  # 5 minutes cooldown between repeat notifications
        
        # Get persistence manager
        self.persistence = get_persistence_manager()
        
        # First try explicit path, then env var, then fallback to default
        data_path = os.environ.get('DASHCAM_DATA_PATH', os.path.join(os.path.dirname(__file__), 'data'))
        self.landmarks_file = landmarks_file or os.environ.get('DASHCAM_LANDMARKS_PATH') or os.path.join(data_path, 'landmarks.json')
        
        # Initialize the landmarks database
        self.landmarks_db = LandmarksDB()
        
        # Import existing landmarks from JSON file to the new database
        self._migrate_json_to_db()
        
        # Load landmarks
        self.load_landmarks()
        
    def _migrate_json_to_db(self):
        """Migrate existing landmarks from JSON to the new database"""
        try:
            if os.path.exists(self.landmarks_file):
                logger.info(f"Migrating landmarks from {self.landmarks_file} to database")
                count = self.landmarks_db.import_from_json(self.landmarks_file)
                
                if count > 0:
                    # Create backup of the original file
                    backup_path = f"{self.landmarks_file}.migrated"
                    try:
                        import shutil
                        shutil.copy2(self.landmarks_file, backup_path)
                        logger.info(f"Created backup of landmarks file at {backup_path}")
                    except Exception as e:
                        logger.error(f"Failed to create backup of landmarks file: {str(e)}")
        except Exception as e:
            logger.error(f"Error during landmark migration: {str(e)}")
        
    def load_landmarks(self, file_path=None):
        """Load landmarks from database"""
        try:
            # Load landmarks from the database
            self.landmarks = self.landmarks_db.get_all_landmarks()
            logger.info(f"Loaded {len(self.landmarks)} landmarks from database")
                
        except Exception as e:
            logger.error(f"Error loading landmarks: {str(e)}")
            # Initialize with empty list if loading fails
            self.landmarks = []
            
    def check_nearby(self, lat, lon, max_distance=None):
        """Check if vehicle is near any landmarks, return details of closest one within radius"""
        return self.landmarks_db.check_nearby(lat, lon, max_distance)

    def get_landmarks_in_area(self, center_lat, center_lon, radius_km=10):
        """Get all landmarks within a specific area (for map displays)"""
        return self.landmarks_db.get_landmarks_in_area(center_lat, center_lon, radius_km)
        
    def add_landmark(self, name, lat, lon, radius_m=500, description="", category="custom", trip_id=None):
        """Add a new landmark"""
        try:
            # Create landmark object
            landmark = {
                "name": name,
                "lat": lat,
                "lon": lon,
                "radius_m": radius_m,
                "description": description,
                "category": category,
                "trip_id": trip_id
            }
            
            # Add to database
            result = self.landmarks_db.add_landmark(landmark)
            
            # Reload landmarks
            if result:
                self.load_landmarks()
            
            return result
        except Exception as e:
            logger.error(f"Error adding landmark: {str(e)}")
            return None
            
    def remove_landmark(self, landmark_id):
        """Remove a landmark by ID"""
        try:
            # Remove from database
            result = self.landmarks_db.remove_landmark(landmark_id)
            
            # Reload landmarks
            if result:
                self.load_landmarks()
                
            return result
        except Exception as e:
            logger.error(f"Error removing landmark: {str(e)}")
            return False
    
    def remove_trip_landmarks(self, trip_id):
        """Remove all landmarks associated with a trip"""
        try:
            # Remove from database
            count = self.landmarks_db.remove_trip_landmarks(trip_id)
            
            # Reload landmarks
            if count > 0:
                self.load_landmarks()
                
            return count
        except Exception as e:
            logger.error(f"Error removing trip landmarks: {str(e)}")
            return 0
            
    def _save_landmarks(self):
        """Save landmarks to JSON file (legacy function for backward compatibility)"""
        try:
            # Export to JSON file
            return self.landmarks_db.export_to_json(self.landmarks_file)
        except Exception as e:
            logger.error(f"Error saving landmarks: {str(e)}")
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

    def get_recording_quality_for_position(self, lat, lon):
        """
        Determina qué calidad de grabación usar según la proximidad a landmarks importantes
        
        Args:
            lat: latitud actual
            lon: longitud actual
            
        Returns:
            quality: "high" si estamos cerca de un landmark, "normal" en caso contrario
        """
        try:
            # Buscar landmarks cercanos (dentro de 200 metros)
            nearby = self.check_nearby(lat, lon, max_distance=200)
            
            if nearby:
                # Si hay algún landmark cercano, usar calidad alta
                logger.info(f"Cambiando calidad a ALTA por proximidad a landmark: {nearby['name']}")
                return "high", nearby
            
            return "normal", None
        except Exception as e:
            logger.error(f"Error determinando calidad de grabación: {str(e)}")
            return "normal", None