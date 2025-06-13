import os
import platform
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("config")

class Config:
    """Central configuration for the dashcam application"""
    
    def __init__(self):
        # Detect system type (Raspberry Pi or other)
        self.is_raspberry_pi = self._is_running_on_pi()
        
        # Base paths
        self.base_path = self._get_base_path()
        self.data_path = self._get_data_path()
        
        # Database paths
        self.db_path = os.environ.get('DASHCAM_DB_PATH') or os.path.join(self.data_path, "recordings.db")
        self.geocoding_db_path = os.environ.get('DASHCAM_GEOCODING_DB_PATH') or os.path.join(self.data_path, "geocoding_offline.db")
        
        # Video storage paths
        self.video_path = os.path.join(self.data_path, "videos")
        self.upload_path = os.path.join(self.data_path, "uploads")
        
        # Settings paths
        self.settings_path = os.path.join(self.data_path, "settings")
        self.storage_settings_path = os.path.join(self.settings_path, "storage_settings.json")
        self.audio_settings_path = os.path.join(self.settings_path, "audio_settings.json")
        self.video_settings_path = os.path.join(self.settings_path, "video_settings.json")
        self.wifi_settings_path = os.path.join(self.settings_path, "wifi_settings.json")
        
        # Other data paths
        self.landmarks_path = os.path.join(self.data_path, "landmarks.json")
        
        # Reverse geocoding configuration
        self.reverse_geocoding_enabled = os.environ.get('REVERSE_GEOCODING_ENABLED', 'true').lower() == 'true'
        self.reverse_geocoding_batch_size = int(os.environ.get('REVERSE_GEOCODING_BATCH_SIZE', '10'))
        self.reverse_geocoding_batch_delay = int(os.environ.get('REVERSE_GEOCODING_BATCH_DELAY', '30'))
        
        # External storage config
        self.default_mount_point = "/mnt/dashcam_storage" if self.is_raspberry_pi else os.path.join(os.getcwd(), "mnt")
        
        # Ensure critical directories exist
        self._ensure_directories()
        
        logger.info(f"Configuration initialized (Running on Raspberry Pi: {self.is_raspberry_pi})")
        logger.info(f"Data path: {self.data_path}")
    
    def _is_running_on_pi(self):
        """Detect if we're running on a Raspberry Pi"""
        # Method 1: Check /proc/device-tree/model
        try:
            with open('/proc/device-tree/model', 'r') as f:
                if 'raspberry pi' in f.read().lower():
                    return True
        except:
            pass
            
        # Method 2: Check platform information
        return platform.machine().startswith('arm') and os.path.exists('/opt/vc/bin')
    
    def _get_base_path(self):
        """Get the base path for the application"""
        # If env var is set, use it
        if 'DASHCAM_BASE_PATH' in os.environ:
            return os.environ['DASHCAM_BASE_PATH']
            
        # If on Raspberry Pi, use /home/pi/dashcam
        if self.is_raspberry_pi:
            return "/home/pi/dashcam"
            
        # Otherwise, use a directory in current working directory
        return os.path.join(os.getcwd(), "dashcam")
    
    def _get_data_path(self):
        """Get the data storage path"""
        # If env var is set, use it
        if 'DASHCAM_DATA_PATH' in os.environ:
            return os.environ['DASHCAM_DATA_PATH']
            
        # Otherwise, use a data directory in base path
        return os.path.join(self.base_path, "data")
    
    def _ensure_directories(self):
        """Ensure that all required directories exist"""
        directories = [
            self.data_path,
            self.video_path,
            self.upload_path,
            self.settings_path
        ]
        
        for directory in directories:
            try:
                os.makedirs(directory, exist_ok=True)
                logger.debug(f"Directory ensured: {directory}")
            except Exception as e:
                logger.error(f"Error creating directory {directory}: {str(e)}")

# Create a global instance of the config that can be imported by other modules
config = Config()