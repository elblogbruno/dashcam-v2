import os
import time
import logging
import threading
from typing import Dict, Any, Optional

# Change from relative imports to absolute imports
from cameras import RoadCamera, InteriorCamera, VideoRecorder, CameraSettings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CameraManager:
    def __init__(self):
        # Initialize camera components
        self.road_camera = RoadCamera()
        self.interior_camera = InteriorCamera(device_path="/dev/video0")
        
        # Settings and recorder
        self.settings = CameraSettings()
        self.recorder = VideoRecorder(base_dir="../data")
        
        # Add cameras to recorder
        self.recorder.add_camera("road", self.road_camera)
        self.recorder.add_camera("interior", self.interior_camera)
        
        # Camera errors list
        self.camera_errors = []
        
        # Failure counters for each camera
        self.road_camera_failures = 0
        self.interior_camera_failures = 0
        
        # Threshold for consecutive failures before reset
        self.reset_threshold = 5
        
        # Initialize cameras
        self.initialize_cameras()
        
    def initialize_cameras(self):
        """Initialize all cameras in parallel for faster startup"""
        self.camera_errors = []
        
        # Define initialization functions
        def init_road_camera():
            logger.info("Initializing road camera with PiCamera2")
            if not self.road_camera.initialize():
                logger.error("Could not initialize road camera")
                self.camera_errors.append("Could not initialize PiCamera2")
        
        def init_interior_camera():
            logger.info("Initializing interior camera with OpenCV")
            if not self.interior_camera.initialize():
                logger.warning("Could not initialize interior camera")
                self.camera_errors.append("Could not initialize interior camera")
        
        # Create threads for parallel initialization
        road_thread = threading.Thread(target=init_road_camera)
        interior_thread = threading.Thread(target=init_interior_camera)
        
        # Start threads
        road_thread.start()
        interior_thread.start()
        
        # Wait for both to complete
        road_thread.join()
        interior_thread.join()
        
        logger.info("Camera initialization complete")

    def get_preview_frame(self, camera_type="road"):
        """Get preview frame from specified camera"""
        try:
            if camera_type == "road":
                if not self.road_camera.is_initialized:
                    logger.warning("Road camera not initialized")
                    self._reset_camera("road")
                    return None
                
                frame = self.road_camera.capture_frame()
                if frame is None:
                    # Increment failure counter
                    self.road_camera_failures += 1
                    logger.warning(f"Failed to get road camera frame ({self.road_camera_failures}/{self.reset_threshold})")
                    
                    # Only reset if we've reached the threshold
                    if self.road_camera_failures >= self.reset_threshold:
                        logger.warning(f"Road camera failed {self.road_camera_failures} times in a row, resetting")
                        self._reset_camera("road")
                        self.road_camera_failures = 0  # Reset counter after reset attempt
                    return None
                else:
                    # Reset failure counter on success
                    if self.road_camera_failures > 0:
                        logger.info("Road camera recovered without reset")
                        self.road_camera_failures = 0
                    return frame
                    
            elif camera_type == "interior":
                if not self.interior_camera.is_initialized:
                    logger.warning("Interior camera not initialized")
                    self._reset_camera("interior")
                    return None
                
                frame = self.interior_camera.capture_frame()
                if frame is None:
                    # Increment failure counter
                    self.interior_camera_failures += 1
                    logger.warning(f"Failed to get interior camera frame ({self.interior_camera_failures}/{self.reset_threshold})")
                    
                    # Only reset if we've reached the threshold
                    if self.interior_camera_failures >= self.reset_threshold:
                        logger.warning(f"Interior camera failed {self.interior_camera_failures} times in a row, resetting")
                        self._reset_camera("interior")
                        self.interior_camera_failures = 0  # Reset counter after reset attempt
                    return None
                else:
                    # Reset failure counter on success
                    if self.interior_camera_failures > 0:
                        logger.info("Interior camera recovered without reset")
                        self.interior_camera_failures = 0
                    return frame
            else:
                logger.warning(f"Camera '{camera_type}' not available")
                return None
                
        except Exception as e:
            logger.error(f"Error in get_preview_frame: {str(e)}")
            # Don't increment failure counter for other exceptions
            return None

    def _reset_camera(self, camera_type):
        """Reset a problematic camera"""
        logger.info(f"Resetting {camera_type} camera")
        
        if camera_type == "road":
            if not self.road_camera.reset():
                logger.error("Could not reset road camera")
                
        elif camera_type == "interior":
            if not self.interior_camera.reset():
                logger.error("Could not reset interior camera")

    def start_recording(self):
        """Start recording from all cameras"""
        return self.recorder.start_recording()

    def stop_recording(self):
        """Stop recording from all cameras and return clip information"""
        return self.recorder.stop_recording()
    
    def set_recording_quality(self, quality):
        """Change the recording quality (normal or high)"""
        return self.recorder.set_recording_quality(quality)
        
    def apply_settings(self, settings: Dict[str, Any]):
        """Apply new camera settings"""
        return self.settings.apply_settings(settings)

    def cleanup(self):
        """Release all resources"""
        try:
            if self.recorder.recording:
                logger.info("Stopping recording during cleanup")
                self.recorder.stop_recording()
                
            self.road_camera.release()
            self.interior_camera.release()
                
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
            
    def __del__(self):
        """Destructor"""
        self.cleanup()