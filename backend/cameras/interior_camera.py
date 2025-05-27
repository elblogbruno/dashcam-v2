import time
import logging
import cv2
import os
import subprocess
import threading
import asyncio
from .base_camera import BaseCamera

logger = logging.getLogger(__name__)

class InteriorCamera(BaseCamera):
    """OpenCV implementation for interior USB camera"""
    
    def __init__(self, device_path="/dev/video0"):
        super().__init__()
        # Allow for both path or index as input
        if isinstance(device_path, str) and device_path.isdigit():
            self.device_index = int(device_path)
            self.device_path = f"/dev/video{self.device_index}"
        elif isinstance(device_path, str) and device_path.startswith("/dev/video"):
            self.device_path = device_path
            self.device_index = int(device_path.replace("/dev/video", ""))
        else:
            self.device_index = 0  # Default to first camera
            self.device_path = "/dev/video0"
            
        self.writer = None
        self.max_retries = 3
        self.retry_delay = 1.0
        
    def force_release_device(self):
        """Force release camera resources at system level"""
        try:
            logger.info(f"Forcing release of {self.device_path}")
            # Check if device exists
            if not os.path.exists(self.device_path):
                logger.warning(f"Device {self.device_path} does not exist")
                return False
                
            # Try to kill processes using the device
            try:
                cmd = ["sudo", "fuser", "-k", self.device_path]
                subprocess.run(cmd, timeout=2, check=False)
                time.sleep(1.0)
                logger.info(f"Killed processes using {self.device_path}")
            except Exception as e:
                logger.warning(f"Error killing processes: {e}")
                
            return True
        except Exception as e:
            logger.error(f"Error in force_release_device: {e}")
            return False
    
    def initialize(self):
        """Initialize interior camera with OpenCV"""
        # Full release of previous camera
        self.release()
        time.sleep(0.5)  # Reduced from 1.0
        
        # Try multiple times with shorter waits
        for attempt in range(self.max_retries):
            try:
                logger.info(f"Initializing interior camera attempt {attempt+1}/{self.max_retries}")
                
                # Using approach from video_test.py - using index instead of path
                logger.info(f"Opening camera with index {self.device_index}")
                self.camera = cv2.VideoCapture(self.device_index)
                
                # Only set parameters if opened successfully
                if self.camera.isOpened():
                    # Mejorar configuración para mejor calidad de imagen
                    self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.camera.set(cv2.CAP_PROP_FPS, 30)
                    
                    # Ajustes de calidad de imagen
                    self.camera.set(cv2.CAP_PROP_BRIGHTNESS, 0.5)  # Valor medio
                    self.camera.set(cv2.CAP_PROP_CONTRAST, 1.0)    # Valor neutral
                    self.camera.set(cv2.CAP_PROP_SATURATION, 1.0)  # Valor neutral
                    self.camera.set(cv2.CAP_PROP_AUTO_WB, 1)       # Auto white balance
                    
                    # Test just one capture to confirm it works (reduced from 3 tries)
                    ret, test_frame = self.camera.read()
                    if ret and test_frame is not None and test_frame.size > 0:
                        logger.info(f"Interior camera initialized successfully")
                        self.is_initialized = True
                        return True
                    else:
                        logger.warning("Camera opened but cannot capture valid frames")
                        self.release()
                else:
                    logger.warning(f"Failed to open camera on attempt {attempt+1}")
                
                # Shorter retry delay
                time.sleep(0.5 * (attempt + 1))
                
                # Skip force release to speed up retry
                
            except Exception as e:
                logger.error(f"Error initializing interior camera (attempt {attempt+1}): {str(e)}")
                self.release()
                time.sleep(0.5 * (attempt + 1))
        
        logger.error("Failed to initialize interior camera after multiple attempts")
        return False
    
    def release(self):
        """Release interior camera resources"""
        # Stop MJPEG streaming first
        self._stop_mjpeg_thread()
        
        # Release video writer
        if hasattr(self, 'writer') and self.writer is not None:
            try:
                self.writer.release()
            except Exception as e:
                logger.warning(f"Error releasing video writer: {str(e)}")
            self.writer = None
            
        # Release camera
        if hasattr(self, 'camera') and self.camera is not None:
            try:
                if hasattr(self.camera, 'release'):
                    self.camera.release()
            except Exception as e:
                logger.warning(f"Error releasing interior camera: {str(e)}")
            self.camera = None
            self.is_initialized = False
    
    def capture_frame(self):
        """Capture a single frame from interior camera"""
        if not hasattr(self, 'is_initialized') or not self.is_initialized or self.camera is None:
            logger.warning("Interior camera not initialized")
            return None
        
        try:
            if not self.camera.isOpened():
                logger.warning("Interior camera closed unexpectedly, attempting to reinitialize")
                if self.initialize():
                    logger.info("Successfully reinitialized camera")
                else:
                    logger.error("Failed to reinitialize camera")
                    return None
            
            # Just one read attempt for speed (reduced from 3 attempts)
            ret, frame = self.camera.read()
            if ret and frame is not None and frame.size > 0:
                return frame
            
            logger.warning("Could not get frame from interior camera")
            return None
            
        except Exception as e:
            logger.error(f"Error capturing frame from interior camera: {str(e)}")
            return None
    
    def start_recording(self, output_file, quality):
        """Start recording video with OpenCV"""
        if not self.is_initialized or self.camera is None:
            logger.warning("Interior camera not initialized")
            return False
            
        try:
            # Get properties
            width = int(self.camera.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = int(self.camera.get(cv2.CAP_PROP_FPS))
            if fps <= 0:  # If can't get FPS, use default
                fps = 30
            
            # Create VideoWriter con un códec más compatible
            try:
                # Intentar primero con códec H.264 (más compatible)
                fourcc = cv2.VideoWriter_fourcc(*'avc1')
                self.writer = cv2.VideoWriter(
                    output_file, fourcc, fps, (width, height)
                )
                if not self.writer.isOpened():
                    # Si falla, intentar con codec X264 (alternativa de H.264)
                    fourcc = cv2.VideoWriter_fourcc(*'X264')
                    self.writer = cv2.VideoWriter(
                        output_file, fourcc, fps, (width, height)
                    )
                    if not self.writer.isOpened():
                        # Si aún falla, volver a mp4v como último recurso
                        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                        self.writer = cv2.VideoWriter(
                            output_file, fourcc, fps, (width, height)
                        )
            except Exception as codec_error:
                logger.warning(f"Error al usar códecs avanzados: {codec_error}, usando mp4v como fallback")
                # Fallback al codec original
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                self.writer = cv2.VideoWriter(
                    output_file, fourcc, fps, (width, height)
                )
            
            logger.info(f"Interior camera recording started to {output_file}")
            return True
        except Exception as e:
            logger.error(f"Error setting up interior camera recording: {str(e)}")
            return False
    
    def stop_recording(self):
        """Stop recording video with OpenCV"""
        if self.writer is not None:
            try:
                self.writer.release()
                self.writer = None
                logger.info("Interior camera recording stopped")
                return True
            except Exception as e:
                logger.error(f"Error stopping interior camera recording: {str(e)}")
                self.writer = None
                return False
        return True
    
    def record_frame(self):
        """Record a single frame to the video file"""
        if not self.is_initialized or self.camera is None or self.writer is None:
            return False
            
        try:
            ret, frame = self.camera.read()
            if ret:
                self.writer.write(frame)
                return True
            else:
                logger.warning("Error getting frame from interior camera during recording")
                return False
        except Exception as e:
            logger.error(f"Error recording interior camera frame: {str(e)}")
            return False
    
    def _start_mjpeg_internal(self, quality=None):
        """Start MJPEG streaming for USB camera using software encoding"""
        if not self.is_initialized or self.camera is None:
            logger.warning("Interior camera not initialized for MJPEG streaming")
            return False
            
        try:
            # Stop any existing MJPEG thread
            self._stop_mjpeg_thread()
            
            # Start MJPEG capture thread
            self.mjpeg_running = True
            self.mjpeg_thread = threading.Thread(target=self._mjpeg_capture_loop, args=(quality,))
            self.mjpeg_thread.daemon = True
            self.mjpeg_thread.start()
            
            logger.info("Interior camera MJPEG streaming started")
            return True
            
        except Exception as e:
            logger.error(f"Error starting interior camera MJPEG streaming: {e}")
            return False
    
    def _stop_mjpeg_internal(self):
        """Stop MJPEG streaming for USB camera"""
        try:
            self._stop_mjpeg_thread()
            logger.info("Interior camera MJPEG streaming stopped")
            return True
        except Exception as e:
            logger.error(f"Error stopping interior camera MJPEG streaming: {e}")
            return False
    
    def _stop_mjpeg_thread(self):
        """Stop the MJPEG capture thread"""
        if hasattr(self, 'mjpeg_running'):
            self.mjpeg_running = False
        
        if hasattr(self, 'mjpeg_thread') and self.mjpeg_thread and self.mjpeg_thread.is_alive():
            try:
                self.mjpeg_thread.join(timeout=2.0)
            except Exception as e:
                logger.warning(f"Error joining MJPEG thread: {e}")
    
    def _mjpeg_capture_loop(self, quality=None):
        """Continuous capture loop for MJPEG streaming"""
        # Determine JPEG quality based on input
        if quality == "high":
            jpeg_quality = 95
        elif quality == "medium":
            jpeg_quality = 80
        elif quality == "low":
            jpeg_quality = 60
        else:
            jpeg_quality = 85  # Default
        
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality]
        
        while getattr(self, 'mjpeg_running', False):
            try:
                if not self.camera or not self.camera.isOpened():
                    break
                
                ret, frame = self.camera.read()
                if ret and frame is not None:
                    # Encode frame as JPEG
                    success, jpeg_buffer = cv2.imencode('.jpg', frame, encode_params)
                    if success and self.streaming_output:
                        # Write JPEG data to streaming output
                        self.streaming_output.write(jpeg_buffer.tobytes())
                
                # Control frame rate - target around 15 FPS for USB cameras
                time.sleep(1.0 / 15.0)
                
            except Exception as e:
                logger.error(f"Error in MJPEG capture loop: {e}")
                break
        
        logger.debug("MJPEG capture loop ended")
