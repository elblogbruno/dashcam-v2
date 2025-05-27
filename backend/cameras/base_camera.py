import io
import logging
from abc import ABC, abstractmethod
from threading import Condition

logger = logging.getLogger(__name__)

class StreamingOutput(io.BufferedIOBase):
    """Optimized streaming output for MJPEG"""
    def __init__(self):
        self.frame = None
        self.condition = Condition()
        self.frame_count = 0

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.frame_count += 1
            self.condition.notify_all()

    def read(self, timeout=1.0):
        with self.condition:
            if self.condition.wait(timeout):
                return self.frame
            return None

class BaseCamera(ABC):
    """Base abstract class for all camera types"""
    
    def __init__(self):
        self.camera = None
        self.is_initialized = False
        self.streaming_output = None
        self.is_mjpeg_streaming = False
    
    @abstractmethod
    def initialize(self):
        """Initialize camera hardware"""
        pass
    
    @abstractmethod
    def release(self):
        """Release camera resources"""
        pass
    
    @abstractmethod
    def capture_frame(self):
        """Capture a single frame"""
        pass
    
    @abstractmethod
    def start_recording(self, output_file, quality):
        """Start recording video"""
        pass
    
    @abstractmethod
    def stop_recording(self):
        """Stop recording video"""
        pass
    
    def start_mjpeg_stream(self, quality=None):
        """Start MJPEG streaming using native encoder"""
        if self.is_mjpeg_streaming:
            logger.warning("MJPEG streaming already active")
            return self.streaming_output
            
        try:
            self.streaming_output = StreamingOutput()
            success = self._start_mjpeg_internal(quality)
            if success:
                self.is_mjpeg_streaming = True
                logger.info(f"MJPEG streaming started for {self.__class__.__name__}")
                return self.streaming_output
            else:
                self.streaming_output = None
                return None
        except Exception as e:
            logger.error(f"Error starting MJPEG stream: {e}")
            self.streaming_output = None
            return None
    
    def stop_mjpeg_stream(self):
        """Stop MJPEG streaming"""
        if not self.is_mjpeg_streaming:
            return True
            
        try:
            success = self._stop_mjpeg_internal()
            self.is_mjpeg_streaming = False
            self.streaming_output = None
            logger.info(f"MJPEG streaming stopped for {self.__class__.__name__}")
            return success
        except Exception as e:
            logger.error(f"Error stopping MJPEG stream: {e}")
            return False
    
    def _start_mjpeg_internal(self, quality):
        """Internal method to start MJPEG streaming - to be overridden by subclasses"""
        return False
    
    def _stop_mjpeg_internal(self):
        """Internal method to stop MJPEG streaming - to be overridden by subclasses"""
        return True
    
    def reset(self):
        """Reset camera by releasing and reinitializing"""
        logger.info(f"Resetting camera {self.__class__.__name__}")
        self.release()
        return self.initialize()
