"""
Trip Logger Package - Sistema modular de logging de viajes para dashcam

Este paquete proporciona una interfaz unificada para el logging de datos de viajes,
incluyendo GPS, landmarks, videos y estadísticas.
"""

# Direct imports - no compatibility layer  
from .services.trip_manager import TripManager
from .database.connection import get_database_manager
from .models.schemas import Trip, GpsCoordinate, VideoClip

__version__ = "2.0.0"

__all__ = [
    "TripManager",
    "get_database_manager", 
    "Trip",
    "GpsCoordinate",
    "VideoClip"
]
