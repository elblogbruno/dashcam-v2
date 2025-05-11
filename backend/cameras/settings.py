import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class CameraSettings:
    """Manages camera settings and quality profiles"""
    
    def __init__(self):
        # Default quality settings
        self.quality_settings = {
            "low": {"width": 640, "height": 480, "bitrate": 1000000},    # 1 Mbps
            "medium": {"width": 1280, "height": 720, "bitrate": 4000000}, # 4 Mbps
            "high": {"width": 1920, "height": 1080, "bitrate": 8000000}  # 8 Mbps
        }
        
        # Default camera settings
        self.road_quality = "high"
        self.interior_quality = "medium"
        self.auto_start_recording = True
    
    def get_quality(self, camera_type):
        """Get quality settings for a specific camera type"""
        if camera_type == "road":
            return self.quality_settings[self.road_quality]
        elif camera_type == "interior":
            return self.quality_settings[self.interior_quality]
        else:
            return self.quality_settings["medium"]  # Default
    
    def apply_settings(self, settings: Dict[str, Any]):
        """Apply new camera settings"""
        try:
            settings_changed = False
            
            # Update road camera quality
            if "roadQuality" in settings and settings["roadQuality"] != self.road_quality:
                self.road_quality = settings["roadQuality"]
                settings_changed = True
                logger.info(f"Road camera quality updated to {self.road_quality}")
                
            # Update interior camera quality
            if "interiorQuality" in settings and settings["interiorQuality"] != self.interior_quality:
                self.interior_quality = settings["interiorQuality"]
                settings_changed = True
                logger.info(f"Interior camera quality updated to {self.interior_quality}")
                
            # Update auto-start recording setting
            if "autoStartRecording" in settings:
                self.auto_start_recording = settings["autoStartRecording"]
                settings_changed = True
                logger.info(f"Auto-start recording set to {self.auto_start_recording}")
            
            logger.info("Camera settings updated")
            return True
            
        except Exception as e:
            logger.error(f"Error applying settings: {str(e)}")
            return False
