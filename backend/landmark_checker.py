import json
import os
import math
import logging
from datetime import datetime
from data_persistence import get_persistence_manager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime%s - %(name)s - %(levelname)s - %(message)s')
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
        
        # Load landmarks
        self.load_landmarks()
        
    def load_landmarks(self, file_path=None):
        """Load landmarks from JSON file"""
        try:
            file_to_load = file_path or self.landmarks_file
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(file_to_load), exist_ok=True)
            
            # If file doesn't exist, create it with sample data
            if not os.path.exists(file_to_load):
                sample_landmarks = [
                    {
                        "id": "gc1",
                        "name": "Grand Canyon",
                        "lat": 36.1,
                        "lon": -112.1,
                        "radius_m": 500,
                        "description": "A steep-sided canyon carved by the Colorado River",
                        "category": "natural"
                    },
                    {
                        "id": "hs1",
                        "name": "Hoover Dam",
                        "lat": 36.0162,
                        "lon": -114.7377,
                        "radius_m": 300,
                        "description": "A concrete arch-gravity dam in the Black Canyon of the Colorado River",
                        "category": "infrastructure"
                    }
                ]
                
                # Use persistence manager to save sample data
                self.persistence.save_json(sample_landmarks, os.path.basename(file_to_load), 
                                          os.path.dirname(file_to_load))
                logger.info(f"Created sample landmarks file at {file_to_load}")
                
            # Use persistence manager to load the landmarks
            if os.path.basename(file_to_load) == 'landmarks.json' and os.path.dirname(file_to_load) == self.persistence.data_dir:
                # If it's directly in the data directory, use simple load
                self.landmarks = self.persistence.load_json('landmarks.json', default=[])
            else:
                # Otherwise, load from the specific path
                with open(file_to_load, 'r') as f:
                    self.landmarks = json.load(f)
                
            logger.info(f"Loaded {len(self.landmarks)} landmarks")
                
        except Exception as e:
            logger.error(f"Error loading landmarks: {str(e)}")
            # Initialize with empty list if loading fails
            self.landmarks = []
            
    def check_nearby(self, lat, lon, max_distance=None):
        """Check if vehicle is near any landmarks, return details of closest one within radius"""
        if not lat or not lon:
            return None
            
        closest_landmark = None
        min_distance = float('inf')
        
        for landmark in self.landmarks:
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
                        landmark_id = landmark.get('id', f"{landmark['lat']},{landmark['lon']}")
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

    def get_landmarks_in_area(self, center_lat, center_lon, radius_km=10):
        """Get all landmarks within a specific area (for map displays)"""
        if not center_lat or not center_lon:
            return []
            
        nearby_landmarks = []
        
        for landmark in self.landmarks:
            try:
                # Calculate distance
                distance = self._calculate_distance(
                    center_lat, center_lon,
                    landmark['lat'], landmark['lon']
                )
                
                # Convert to km and check radius
                if distance / 1000 <= radius_km:
                    landmark_copy = landmark.copy()
                    landmark_copy['distance'] = distance
                    nearby_landmarks.append(landmark_copy)
            except Exception as e:
                logger.error(f"Error in area search for landmark {landmark.get('name', 'unknown')}: {str(e)}")
                
        return nearby_landmarks
        
    def add_landmark(self, name, lat, lon, radius_m=500, description="", category="custom"):
        """Add a new landmark"""
        try:
            # Create a unique ID
            import uuid
            landmark_id = str(uuid.uuid4())[:8]
            
            new_landmark = {
                "id": landmark_id,
                "name": name,
                "lat": lat,
                "lon": lon,
                "radius_m": radius_m,
                "description": description,
                "category": category
            }
            
            self.landmarks.append(new_landmark)
            
            # Save to file
            self._save_landmarks()
            
            return new_landmark
        except Exception as e:
            logger.error(f"Error adding landmark: {str(e)}")
            return None
            
    def remove_landmark(self, landmark_id):
        """Remove a landmark by ID"""
        try:
            original_count = len(self.landmarks)
            self.landmarks = [lm for lm in self.landmarks if lm.get('id') != landmark_id]
            
            if len(self.landmarks) < original_count:
                # Save changes
                self._save_landmarks()
                return True
            return False
        except Exception as e:
            logger.error(f"Error removing landmark: {str(e)}")
            return False
            
    def _save_landmarks(self):
        """Save landmarks to file"""
        try:
            # Use persistence manager to save the landmarks
            if os.path.basename(self.landmarks_file) == 'landmarks.json' and os.path.dirname(self.landmarks_file) == self.persistence.data_dir:
                # If it's directly in the data directory, use simple save
                return self.persistence.save_json(self.landmarks, 'landmarks.json')
            else:
                # Otherwise, save to the specific path
                with open(self.landmarks_file, 'w') as f:
                    json.dump(self.landmarks, f, indent=2)
                return True
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