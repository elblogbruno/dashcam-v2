import os
import time
from datetime import datetime
import threading
import logging
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CameraManager:
    def __init__(self):
        self.recording = False
        self.road_camera = None  # Will be initialized with picamera2 or cv2.VideoCapture
        self.interior_camera = None  # Will be initialized with cv2.VideoCapture
        self.recording_thread = None
        self.current_output_folder = None
        self.road_output_file = None
        self.interior_output_file = None
        
        # Camera settings
        self.road_camera_path = "/dev/video0"  # Default camera device
        self.interior_camera_path = "/dev/video1"  # Default camera device
        self.road_quality = "high"  # Options: low, medium, high
        self.interior_quality = "medium"  # Options: low, medium, high
        self.auto_start_recording = True
        
        # Quality settings mapping (resolution and bitrate)
        self.quality_settings = {
            "low": {"width": 640, "height": 480, "bitrate": 1000000},  # 1 Mbps
            "medium": {"width": 1280, "height": 720, "bitrate": 4000000},  # 4 Mbps
            "high": {"width": 1920, "height": 1080, "bitrate": 8000000}  # 8 Mbps
        }
        
        # Base directory for saving recordings
        self.base_dir = "../data"
        
        # Initialize cameras
        self.initialize_cameras()
        
    def initialize_cameras(self):
        """Initialize both cameras based on available hardware"""
        self.camera_errors = []
        try:
            # Try to import picamera2 for road camera (Raspberry Pi Camera Module)
            try:
                from picamera2 import Picamera2
                self.road_camera = Picamera2()
                self.road_camera.configure(self.road_camera.create_video_configuration())
                logger.info("Initialized road camera with Picamera2")
            except (ImportError, ModuleNotFoundError):
                # Fallback to OpenCV for road camera
                import cv2
                self.road_camera = cv2.VideoCapture(self.road_camera_path)  # Use the specified camera path
                if not self.road_camera.isOpened():
                    logger.error(f"Failed to open road camera at {self.road_camera_path}")
                    self.camera_errors.append(f"Road camera not available at {self.road_camera_path}")
                    self.road_camera = None
                else:
                    logger.info(f"Initialized road camera with OpenCV at {self.road_camera_path}")
                
            # Initialize interior camera with OpenCV (USB camera)
            import cv2
            self.interior_camera = cv2.VideoCapture(self.interior_camera_path)  # Use the specified camera path
            if not self.interior_camera.isOpened():
                logger.warning(f"Failed to open interior camera at {self.interior_camera_path}. Will continue with road camera only.")
                self.interior_camera = None
                self.camera_errors.append(f"Interior camera not available at {self.interior_camera_path}")
            else:
                logger.info(f"Initialized interior camera with OpenCV at {self.interior_camera_path}")
                
        except Exception as e:
            logger.error(f"Camera initialization error: {str(e)}")
            self.camera_errors.append(f"Camera initialization error: {str(e)}")
            # Don't crash, make sure both cameras have a value (even if it's None)
            if not hasattr(self, 'road_camera') or self.road_camera is None:
                self.road_camera = None
            if not hasattr(self, 'interior_camera') or self.interior_camera is None:
                self.interior_camera = None
                
    def apply_settings(self, settings: Dict[str, Any]):
        """
        Apply new camera settings from the settings manager
        
        Args:
            settings: Dictionary containing video/camera settings
        """
        try:
            settings_changed = False
            camera_device_changed = False
            
            # Update road camera path if provided and different
            if "roadCamera" in settings and settings["roadCamera"] != self.road_camera_path:
                self.road_camera_path = settings["roadCamera"]
                camera_device_changed = True
                settings_changed = True
                logger.info(f"Road camera path updated to {self.road_camera_path}")
                
            # Update interior camera path if provided and different
            if "interiorCamera" in settings and settings["interiorCamera"] != self.interior_camera_path:
                self.interior_camera_path = settings["interiorCamera"]
                camera_device_changed = True
                settings_changed = True
                logger.info(f"Interior camera path updated to {self.interior_camera_path}")
                
            # Update road quality if provided and different
            if "roadQuality" in settings and settings["roadQuality"] != self.road_quality:
                self.road_quality = settings["roadQuality"]
                settings_changed = True
                logger.info(f"Road camera quality updated to {self.road_quality}")
                
            # Update interior quality if provided and different
            if "interiorQuality" in settings and settings["interiorQuality"] != self.interior_quality:
                self.interior_quality = settings["interiorQuality"]
                settings_changed = True
                logger.info(f"Interior camera quality updated to {self.interior_quality}")
                
            # Update auto-start recording if provided
            if "autoStartRecording" in settings:
                self.auto_start_recording = settings["autoStartRecording"]
                settings_changed = True
                logger.info(f"Auto-start recording set to {self.auto_start_recording}")
            
            # If camera devices changed, we need to reinitialize the cameras
            was_recording = self.recording
            
            if camera_device_changed:
                if was_recording:
                    self.stop_recording()
                
                # Release existing cameras if they exist
                if hasattr(self.road_camera, 'release'):
                    self.road_camera.release()
                if self.interior_camera and hasattr(self.interior_camera, 'release'):
                    self.interior_camera.release()
                
                # Reinitialize cameras with new settings
                self.initialize_cameras()
                
                # Resume recording if it was active
                if was_recording and self.auto_start_recording:
                    self.start_recording()
                    
            # Apply quality settings to cameras if they support it
            # This would typically involve setting resolution and bitrate
            # The implementation depends on the camera type (picamera2 vs OpenCV)
            
            logger.info("Camera settings updated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error applying camera settings: {str(e)}")
            return False
    
    def _create_output_folder(self):
        """Create a folder structure for today's recordings"""
        today = datetime.now().strftime("%Y-%m-%d")
        output_folder = os.path.join(self.base_dir, today)
        
        # Create directory if it doesn't exist
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            
        return output_folder
        
    def _get_file_names(self):
        """Generate file names based on current time"""
        timestamp = datetime.now().strftime("%H-%M")
        road_filename = f"{timestamp}-road.mp4"
        interior_filename = f"{timestamp}-interior.mp4"
        
        return road_filename, interior_filename
        
    def start_recording(self):
        """Start recording from both cameras"""
        if self.recording:
            logger.warning("Recording is already in progress")
            return False
            
        try:
            # Create output folder
            self.current_output_folder = self._create_output_folder()
            
            # Generate file names
            road_filename, interior_filename = self._get_file_names()
            
            # Set full output paths
            self.road_output_file = os.path.join(self.current_output_folder, road_filename)
            self.interior_output_file = os.path.join(self.current_output_folder, interior_filename)
            
            # Start recording thread
            self.recording = True
            self.recording_thread = threading.Thread(target=self._record_video)
            self.recording_thread.daemon = True
            self.recording_thread.start()
            
            logger.info(f"Started recording to {self.road_output_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting recording: {str(e)}")
            self.recording = False
            return False
            
    def stop_recording(self):
        """Stop the recording process"""
        if not self.recording:
            logger.warning("No recording in progress")
            return False
            
        try:
            self.recording = False
            # Wait for the recording thread to finish
            if self.recording_thread:
                self.recording_thread.join(timeout=5.0)
                
            logger.info("Recording stopped")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping recording: {str(e)}")
            return False
            
    def _record_video(self):
        """Background thread for recording video from both cameras"""
        try:
            # Different approach based on camera type
            if isinstance(self.road_camera, object) and hasattr(self.road_camera, 'start_recording'):
                # Using picamera2
                self.road_camera.start_recording(output=self.road_output_file)
                
                # OpenCV setup for interior camera if available
                if self.interior_camera:
                    import cv2
                    # Get camera properties
                    width = int(self.interior_camera.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(self.interior_camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    fps = int(self.interior_camera.get(cv2.CAP_PROP_FPS))
                    
                    # Create VideoWriter
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # or 'avc1'
                    interior_writer = cv2.VideoWriter(
                        self.interior_output_file, fourcc, fps, (width, height)
                    )
                    
                    # Recording loop
                    while self.recording:
                        ret, frame = self.interior_camera.read()
                        if ret:
                            interior_writer.write(frame)
                        else:
                            logger.warning("Failed to get frame from interior camera")
                        
                        time.sleep(1/fps)  # Approximate frame timing
                        
                    # Clean up
                    interior_writer.release()
                    
                # Wait for recording to stop
                while self.recording:
                    time.sleep(0.1)
                    
                # Stop picamera2 recording
                self.road_camera.stop_recording()
                
            else:
                # Using OpenCV for both cameras
                import cv2
                
                # Setup road camera
                width_road = int(self.road_camera.get(cv2.CAP_PROP_FRAME_WIDTH))
                height_road = int(self.road_camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps_road = int(self.road_camera.get(cv2.CAP_PROP_FPS))
                
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # or 'avc1'
                road_writer = cv2.VideoWriter(
                    self.road_output_file, fourcc, fps_road, (width_road, height_road)
                )
                
                # Setup interior camera if available
                interior_writer = None
                if self.interior_camera:
                    width_interior = int(self.interior_camera.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height_interior = int(self.interior_camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    fps_interior = int(self.interior_camera.get(cv2.CAP_PROP_FPS))
                    
                    interior_writer = cv2.VideoWriter(
                        self.interior_output_file, fourcc, fps_interior, 
                        (width_interior, height_interior)
                    )
                
                # Recording loop
                while self.recording:
                    # Road camera
                    ret_road, frame_road = self.road_camera.read()
                    if ret_road:
                        road_writer.write(frame_road)
                    else:
                        logger.warning("Failed to get frame from road camera")
                    
                    # Interior camera
                    if self.interior_camera and interior_writer:
                        ret_interior, frame_interior = self.interior_camera.read()
                        if ret_interior:
                            interior_writer.write(frame_interior)
                        else:
                            logger.warning("Failed to get frame from interior camera")
                    
                    # Timing based on road camera
                    time.sleep(1/fps_road)
                
                # Clean up
                road_writer.release()
                if interior_writer:
                    interior_writer.release()
                    
        except Exception as e:
            logger.error(f"Recording error: {str(e)}")
            self.recording = False
            
    def get_preview_frame(self, camera_type="road"):
        """Get a single frame for preview purposes"""
        if camera_type == "road" and self.road_camera:
            if hasattr(self.road_camera, 'capture_array'):
                # picamera2
                return self.road_camera.capture_array()
            else:
                # OpenCV
                ret, frame = self.road_camera.read()
                if ret:
                    return frame
                return None
        elif camera_type == "interior" and self.interior_camera:
            ret, frame = self.interior_camera.read()
            if ret:
                return frame
            return None
        return None
    
    def cleanup(self):
        """Clean up resources when object is destroyed"""
        self.stop_recording()
        
        # Release OpenCV cameras
        if hasattr(self.road_camera, 'release'):
            self.road_camera.release()
        if self.interior_camera and hasattr(self.interior_camera, 'release'):
            self.interior_camera.release()
            
    def __del__(self):
        """Clean up resources when object is destroyed"""
        self.cleanup()