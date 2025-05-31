import io
import logging
import asyncio
import time
from abc import ABC, abstractmethod
from threading import Condition, Lock

logger = logging.getLogger(__name__)

class StreamingOutput(io.BufferedIOBase):
    """Optimized streaming output for MJPEG with async-friendly design"""
    def __init__(self):
        self.frame = None
        self.condition = Condition()
        self.frame_count = 0
        self.last_frame_time = 0
        self._lock = Lock()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.frame_count += 1
            self.last_frame_time = time.time()
            self.condition.notify_all()

    def read(self, timeout=1.0):
        """
        Optimized read method that minimizes blocking time
        by checking for available frames first
        """
        with self._lock:
            # Quick check: if we have a recent frame, return it immediately
            if self.frame is not None and (time.time() - self.last_frame_time) < 2.0:
                return self.frame
        
        # Only use condition wait if no recent frame is available
        with self.condition:
            if self.condition.wait(timeout):
                return self.frame
            return None
    
    def read_async_friendly(self, timeout=1.0):
        """
        Ultra-fast read method designed for async contexts
        that minimizes blocking operations
        """
        # First, try to get frame without any blocking
        with self._lock:
            if self.frame is not None:
                frame_age = time.time() - self.last_frame_time
                # If frame is fresh (less than 100ms old), return immediately
                if frame_age < 0.1:
                    return self.frame
                # If frame is reasonably fresh (less than 1s), still return it
                elif frame_age < 1.0:
                    return self.frame
        
        # If no fresh frame, do a very short wait
        start_time = time.time()
        with self.condition:
            # Use a much shorter timeout to reduce blocking
            short_timeout = min(0.05, timeout)  # Max 50ms wait
            if self.condition.wait(short_timeout):
                return self.frame
            
            # If still no frame after short wait, return the last available frame
            # This prevents long blocks that freeze the server
            if self.frame is not None:
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
