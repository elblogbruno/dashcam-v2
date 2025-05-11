import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class BaseCamera(ABC):
    """Base abstract class for all camera types"""
    
    def __init__(self):
        self.camera = None
        self.is_initialized = False
    
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
    
    def reset(self):
        """Reset camera by releasing and reinitializing"""
        logger.info(f"Resetting camera {self.__class__.__name__}")
        self.release()
        return self.initialize()
