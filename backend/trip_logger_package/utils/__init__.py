"""
Utilities package for trip logger
"""

from .calculations import (
    calculate_distance,
    calculate_speed,
    calculate_bearing,
    is_valid_coordinate,
    format_coordinate,
    format_duration,
    format_distance,
    format_speed,
    safe_json_loads,
    safe_json_dumps,
    calculate_trip_statistics,
    simplify_gps_track,
    validate_gps_data,
    DistanceUnit,
    SpeedUnit
)

from .migration import (
    DataMigrator,
    run_migration
)

__all__ = [
    # Calculations
    'calculate_distance',
    'calculate_speed', 
    'calculate_bearing',
    'is_valid_coordinate',
    'format_coordinate',
    'format_duration',
    'format_distance',
    'format_speed',
    'safe_json_loads',
    'safe_json_dumps',
    'calculate_trip_statistics',
    'simplify_gps_track',
    'validate_gps_data',
    'DistanceUnit',
    'SpeedUnit',
    
    # Migration
    'DataMigrator',
    'run_migration'
]
