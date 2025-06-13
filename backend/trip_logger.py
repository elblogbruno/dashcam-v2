"""
Trip Logger - New modular implementation

This file provides backward compatibility with the original trip_logger.py
while using the new modular architecture underneath.

For new code, prefer importing from trip_logger_package directly:
    from trip_logger_package import TripManager
    from trip_logger_package.models.schemas import Trip, GpsCoordinate

For existing code, this module provides the same TripLogger class interface.
"""

# Import the compatibility wrapper
from trip_logger_package import TripLogger

# For any code that imports specific functions
from trip_logger_package import get_trip_manager, init_database, init_logging

# Backward compatibility aliases
create_trip_logger = lambda db_path=None: TripLogger(db_path)

__all__ = [
    'TripLogger',
    'create_trip_logger',
    'get_trip_manager',
    'init_database', 
    'init_logging'
]
