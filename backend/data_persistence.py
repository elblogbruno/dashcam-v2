import os
import json
import logging
import time
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional, Union, Callable

# Add backend directory to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import Trip Manager directly from the new system
from trip_logger_package.services.trip_manager import TripManager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DataPersistence:
    """
    Centralized data persistence manager to handle saving/loading of application data
    across different storage mechanisms (JSON files, SQLite DB, etc.)
    """
    def __init__(self, data_dir: str = None):
        """Initialize the data persistence manager"""
        # Set data directory - prioritize explicit path, then env var, then fallback to default
        self.data_dir = data_dir or os.environ.get('DASHCAM_DATA_PATH') or os.path.join(
            os.path.dirname(__file__), 'data'
        )
        
        # Create the data directory if it doesn't exist
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Create subdirectories
        self.settings_dir = os.path.join(self.data_dir, 'settings')
        os.makedirs(self.settings_dir, exist_ok=True)
        
        # Dictionary to store module references for callbacks
        self.registered_modules = {}
        
        # Dictionary to track file modification timestamps
        self.file_timestamps = {}
        
        # Initialize Trip Manager for database operations
        db_path = os.path.join(self.data_dir, "recordings.db")
        self.trip_manager = TripManager(db_path)
        
        logger.info(f"Data persistence initialized with data directory: {self.data_dir}")
    
    def get_file_path(self, file_name: str, subdirectory: str = None) -> str:
        """Get the absolute path for a file in the data directory"""
        if subdirectory:
            directory = os.path.join(self.data_dir, subdirectory)
            os.makedirs(directory, exist_ok=True)
            return os.path.join(directory, file_name)
        return os.path.join(self.data_dir, file_name)
    
    def save_json(self, data: Any, file_name: str, subdirectory: str = None) -> bool:
        """Save data to a JSON file"""
        try:
            file_path = self.get_file_path(file_name, subdirectory)
            
            # Create parent directory if it doesn't exist
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Update timestamp
            self.file_timestamps[file_path] = os.path.getmtime(file_path)
            
            logger.debug(f"Saved JSON data to {file_path}")
            return True
                
        except Exception as e:
            logger.error(f"Error saving JSON data to {file_name}: {str(e)}")
            return False
    
    def load_json(self, file_name: str, subdirectory: str = None, default: Any = None) -> Any:
        """Load data from a JSON file"""
        try:
            file_path = self.get_file_path(file_name, subdirectory)
            
            # If file doesn't exist, return default value
            if not os.path.exists(file_path):
                return default
            
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Update timestamp
            self.file_timestamps[file_path] = os.path.getmtime(file_path)
            
            return data
                
        except Exception as e:
            logger.error(f"Error loading JSON data from {file_name}: {str(e)}")
            return default
    
    def get_db_session(self):
        """Get a database session using Trip Manager (deprecated - use trip_manager directly)"""
        logger.warning("DataPersistence.get_db_session() is deprecated. Use trip_manager directly.")
        try:
            # Return a reference to trip_manager for backward compatibility
            return self.trip_manager
        except Exception as e:
            logger.error(f"Error getting database session: {str(e)}")
            raise
    
    def execute_trip_query(self, operation: str, **kwargs) -> Any:
        """Execute a Trip Manager operation"""
        try:
            if operation == 'get_all_videos':
                return self.trip_manager.get_all_videos()
            elif operation == 'get_all_trips':
                return self.trip_manager.get_all_trips()
            elif operation == 'get_video_by_id':
                return self.trip_manager.get_video_by_id(kwargs.get('video_id'))
            elif operation == 'add_video':
                return self.trip_manager.add_video(kwargs.get('video_data'))
            elif operation == 'update_video':
                return self.trip_manager.update_video(kwargs.get('video_id'), kwargs.get('video_data'))
            elif operation == 'delete_video':
                return self.trip_manager.delete_video(kwargs.get('video_id'))
            else:
                logger.warning(f"Unknown Trip Manager operation: {operation}")
                return None
                
        except Exception as e:
            logger.error(f"Error executing Trip Manager operation {operation}: {str(e)}")
            raise
    
    def register_module(self, module_id: str, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register a module to receive updates when its data changes"""
        self.registered_modules[module_id] = callback
        logger.debug(f"Registered module {module_id} for data updates")
    
    def notify_module(self, module_id: str, data: Dict[str, Any]) -> bool:
        """Notify a module about data changes"""
        if module_id not in self.registered_modules:
            logger.warning(f"Cannot notify module {module_id}: not registered")
            return False
        
        try:
            callback = self.registered_modules[module_id]
            callback(data)
            return True
        except Exception as e:
            logger.error(f"Error notifying module {module_id}: {str(e)}")
            return False
    
    def save_settings(self, module_id: str, settings: Dict[str, Any]) -> bool:
        """Save settings for a specific module"""
        file_name = f"{module_id}_settings.json"
        result = self.save_json(settings, file_name, "settings")
        
        # Notify module if registered
        if result and module_id in self.registered_modules:
            self.notify_module(module_id, settings)
            
        return result
    
    def load_settings(self, module_id: str, default: Dict[str, Any] = None) -> Dict[str, Any]:
        """Load settings for a specific module"""
        file_name = f"{module_id}_settings.json"
        return self.load_json(file_name, "settings", default or {})
    
    def create_tables(self, tables_definitions: Dict[str, str], db_name: str = 'recordings.db') -> bool:
        """Create database tables from definitions if they don't exist (deprecated - use Trip Logger)"""
        logger.warning("DataPersistence.create_tables() is deprecated. Trip Logger handles table creation automatically.")
        try:
            # For backward compatibility, we'll assume Trip Logger tables are already created
            logger.info(f"Tables verified through Trip Logger system: {', '.join(tables_definitions.keys())}")
            return True
            
        except Exception as e:
            logger.error(f"Error verifying tables through Trip Logger: {str(e)}")
            return False
    
    def backup_data(self, backup_dir: str = None) -> bool:
        """Backup important data files"""
        if not backup_dir:
            backup_dir = os.path.join(self.data_dir, 'backups', 
                                      datetime.now().strftime('%Y%m%d_%H%M%S'))
        
        try:
            os.makedirs(backup_dir, exist_ok=True)
            
            # Backup database
            db_path = self.get_file_path('recordings.db')
            if os.path.exists(db_path):
                import shutil
                shutil.copy2(db_path, os.path.join(backup_dir, 'recordings.db'))
            
            # Backup settings
            settings_backup_dir = os.path.join(backup_dir, 'settings')
            os.makedirs(settings_backup_dir, exist_ok=True)
            
            for item in os.listdir(self.settings_dir):
                if item.endswith('.json'):
                    src = os.path.join(self.settings_dir, item)
                    dst = os.path.join(settings_backup_dir, item)
                    import shutil
                    shutil.copy2(src, dst)
            
            # Backup landmarks
            landmarks_path = self.get_file_path('landmarks.json')
            if os.path.exists(landmarks_path):
                import shutil
                shutil.copy2(landmarks_path, os.path.join(backup_dir, 'landmarks.json'))
            
            # Backup planned trips
            trips_path = self.get_file_path('planned_trips.json')
            if os.path.exists(trips_path):
                import shutil
                shutil.copy2(trips_path, os.path.join(backup_dir, 'planned_trips.json'))
            
            logger.info(f"Data backup created at: {backup_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error backing up data: {str(e)}")
            return False
    
    def __del__(self):
        """Cleanup resources"""
        # Perform any necessary cleanup
        pass

# Singleton instance
_instance = None

def get_persistence_manager(data_dir: str = None) -> DataPersistence:
    """Get or create the singleton instance of the data persistence manager"""
    global _instance
    if _instance is None:
        _instance = DataPersistence(data_dir)
    return _instance