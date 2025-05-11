"""Camera package for dashcam application."""

# Import camera components for easy access from the package
from .base_camera import BaseCamera
from .road_camera import RoadCamera
from .interior_camera import InteriorCamera
from .recorder import VideoRecorder
from .settings import CameraSettings

__all__ = ['BaseCamera', 'RoadCamera', 'InteriorCamera', 'VideoRecorder', 'CameraSettings']
