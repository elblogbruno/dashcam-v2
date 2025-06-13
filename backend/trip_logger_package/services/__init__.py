"""
Services package for trip logger
"""

from .trip_manager import TripManager, get_trip_manager

__all__ = [
    'TripManager',
    'get_trip_manager'
]
