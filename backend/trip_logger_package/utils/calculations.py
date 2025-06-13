"""
Utility functions for trip logger package
"""

import math
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from enum import Enum


class DistanceUnit(str, Enum):
    """Distance units"""
    METERS = "meters"
    KILOMETERS = "kilometers"
    MILES = "miles"


class SpeedUnit(str, Enum):
    """Speed units"""
    MPS = "m/s"
    KPH = "km/h"
    MPH = "mph"


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float, 
                      unit: DistanceUnit = DistanceUnit.METERS) -> float:
    """
    Calculate distance between two GPS coordinates using Haversine formula
    
    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate
        unit: Distance unit for result
        
    Returns:
        Distance in specified unit
    """
    try:
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        # Haversine formula
        a = (math.sin(delta_lat / 2) * math.sin(delta_lat / 2) +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) * math.sin(delta_lon / 2))
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        # Earth's radius in meters
        R = 6371000
        distance_meters = R * c
        
        # Convert to requested unit
        if unit == DistanceUnit.KILOMETERS:
            return distance_meters / 1000
        elif unit == DistanceUnit.MILES:
            return distance_meters / 1609.344
        else:
            return distance_meters
            
    except Exception:
        return 0.0


def calculate_speed(lat1: float, lon1: float, lat2: float, lon2: float, 
                   time_diff_seconds: float, unit: SpeedUnit = SpeedUnit.KPH) -> float:
    """
    Calculate speed between two GPS points
    
    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate
        time_diff_seconds: Time difference in seconds
        unit: Speed unit for result
        
    Returns:
        Speed in specified unit
    """
    try:
        if time_diff_seconds <= 0:
            return 0.0
        
        distance_meters = calculate_distance(lat1, lon1, lat2, lon2, DistanceUnit.METERS)
        speed_mps = distance_meters / time_diff_seconds
        
        # Convert to requested unit
        if unit == SpeedUnit.KPH:
            return speed_mps * 3.6
        elif unit == SpeedUnit.MPH:
            return speed_mps * 2.23694
        else:
            return speed_mps
            
    except Exception:
        return 0.0


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate bearing between two GPS coordinates
    
    Returns:
        Bearing in degrees (0-360)
    """
    try:
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lon_rad = math.radians(lon2 - lon1)
        
        y = math.sin(delta_lon_rad) * math.cos(lat2_rad)
        x = (math.cos(lat1_rad) * math.sin(lat2_rad) -
             math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lon_rad))
        
        bearing_rad = math.atan2(y, x)
        bearing_deg = math.degrees(bearing_rad)
        
        # Normalize to 0-360 degrees
        return (bearing_deg + 360) % 360
        
    except Exception:
        return 0.0


def is_valid_coordinate(lat: float, lon: float) -> bool:
    """
    Validate GPS coordinates
    
    Args:
        lat: Latitude
        lon: Longitude
        
    Returns:
        True if coordinates are valid
    """
    return (-90 <= lat <= 90) and (-180 <= lon <= 180)


def format_coordinate(lat: float, lon: float, precision: int = 6) -> str:
    """
    Format GPS coordinates for display
    
    Args:
        lat: Latitude
        lon: Longitude
        precision: Decimal places
        
    Returns:
        Formatted coordinate string
    """
    return f"{lat:.{precision}f}, {lon:.{precision}f}"


def format_duration(seconds: float) -> str:
    """
    Format duration in human-readable format
    
    Args:
        seconds: Duration in seconds
        
    Returns:
        Formatted duration string
    """
    try:
        duration = timedelta(seconds=int(seconds))
        total_seconds = int(duration.total_seconds())
        
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        secs = total_seconds % 60
        
        if hours > 0:
            return f"{hours}h {minutes}m {secs}s"
        elif minutes > 0:
            return f"{minutes}m {secs}s"
        else:
            return f"{secs}s"
            
    except Exception:
        return "0s"


def format_distance(distance_meters: float, unit: DistanceUnit = DistanceUnit.KILOMETERS) -> str:
    """
    Format distance in human-readable format
    
    Args:
        distance_meters: Distance in meters
        unit: Desired unit for formatting
        
    Returns:
        Formatted distance string
    """
    try:
        if unit == DistanceUnit.KILOMETERS:
            if distance_meters >= 1000:
                return f"{distance_meters / 1000:.1f} km"
            else:
                return f"{distance_meters:.0f} m"
        elif unit == DistanceUnit.MILES:
            miles = distance_meters / 1609.344
            if miles >= 1:
                return f"{miles:.1f} mi"
            else:
                feet = distance_meters * 3.28084
                return f"{feet:.0f} ft"
        else:
            return f"{distance_meters:.0f} m"
            
    except Exception:
        return "0 m"


def format_speed(speed_mps: float, unit: SpeedUnit = SpeedUnit.KPH) -> str:
    """
    Format speed in human-readable format
    
    Args:
        speed_mps: Speed in meters per second
        unit: Desired unit for formatting
        
    Returns:
        Formatted speed string
    """
    try:
        if unit == SpeedUnit.KPH:
            return f"{speed_mps * 3.6:.1f} km/h"
        elif unit == SpeedUnit.MPH:
            return f"{speed_mps * 2.23694:.1f} mph"
        else:
            return f"{speed_mps:.1f} m/s"
            
    except Exception:
        return "0 km/h"


def safe_json_loads(json_str: Optional[str], default: Any = None) -> Any:
    """
    Safely parse JSON string
    
    Args:
        json_str: JSON string to parse
        default: Default value if parsing fails
        
    Returns:
        Parsed JSON or default value
    """
    if not json_str:
        return default
    
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default


def safe_json_dumps(obj: Any, default: str = "{}") -> str:
    """
    Safely serialize object to JSON
    
    Args:
        obj: Object to serialize
        default: Default value if serialization fails
        
    Returns:
        JSON string or default value
    """
    try:
        return json.dumps(obj, default=str)
    except (TypeError, ValueError):
        return default


def calculate_trip_statistics(coordinates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate statistics for a trip based on GPS coordinates
    
    Args:
        coordinates: List of GPS coordinate dictionaries
        
    Returns:
        Dictionary with trip statistics
    """
    try:
        if not coordinates:
            return {
                'total_distance_km': 0.0,
                'average_speed_kph': 0.0,
                'max_speed_kph': 0.0,
                'duration_seconds': 0,
                'total_points': 0
            }
        
        total_distance = 0.0
        speeds = []
        
        # Calculate distances and speeds
        for i in range(1, len(coordinates)):
            prev_coord = coordinates[i-1]
            curr_coord = coordinates[i]
            
            # Calculate distance
            distance = calculate_distance(
                prev_coord['latitude'], prev_coord['longitude'],
                curr_coord['latitude'], curr_coord['longitude'],
                DistanceUnit.METERS
            )
            total_distance += distance
            
            # Calculate speed if we have timestamps
            if 'timestamp' in prev_coord and 'timestamp' in curr_coord:
                try:
                    prev_time = datetime.fromisoformat(prev_coord['timestamp'].replace('Z', '+00:00'))
                    curr_time = datetime.fromisoformat(curr_coord['timestamp'].replace('Z', '+00:00'))
                    time_diff = (curr_time - prev_time).total_seconds()
                    
                    if time_diff > 0:
                        speed_kph = calculate_speed(
                            prev_coord['latitude'], prev_coord['longitude'],
                            curr_coord['latitude'], curr_coord['longitude'],
                            time_diff, SpeedUnit.KPH
                        )
                        speeds.append(speed_kph)
                except (ValueError, TypeError):
                    pass
        
        # Calculate duration
        duration_seconds = 0
        if len(coordinates) >= 2 and 'timestamp' in coordinates[0] and 'timestamp' in coordinates[-1]:
            try:
                start_time = datetime.fromisoformat(coordinates[0]['timestamp'].replace('Z', '+00:00'))
                end_time = datetime.fromisoformat(coordinates[-1]['timestamp'].replace('Z', '+00:00'))
                duration_seconds = (end_time - start_time).total_seconds()
            except (ValueError, TypeError):
                pass
        
        return {
            'total_distance_km': total_distance / 1000,
            'average_speed_kph': sum(speeds) / len(speeds) if speeds else 0.0,
            'max_speed_kph': max(speeds) if speeds else 0.0,
            'duration_seconds': duration_seconds,
            'total_points': len(coordinates)
        }
        
    except Exception:
        return {
            'total_distance_km': 0.0,
            'average_speed_kph': 0.0,
            'max_speed_kph': 0.0,
            'duration_seconds': 0,
            'total_points': 0
        }


def simplify_gps_track(coordinates: List[Dict[str, Any]], tolerance: float = 0.0001) -> List[Dict[str, Any]]:
    """
    Simplify GPS track using Douglas-Peucker algorithm
    
    Args:
        coordinates: List of GPS coordinates
        tolerance: Simplification tolerance
        
    Returns:
        Simplified coordinate list
    """
    if len(coordinates) <= 2:
        return coordinates
    
    try:
        def perpendicular_distance(point: Dict, line_start: Dict, line_end: Dict) -> float:
            """Calculate perpendicular distance from point to line"""
            lat = point['latitude']
            lon = point['longitude']
            lat1 = line_start['latitude']
            lon1 = line_start['longitude']
            lat2 = line_end['latitude']
            lon2 = line_end['longitude']
            
            # Simple approximation for small distances
            A = lat2 - lat1
            B = lon1 - lon2
            C = lat2 * lon1 - lat1 * lon2
            
            return abs(A * lon + B * lat + C) / math.sqrt(A * A + B * B)
        
        def douglas_peucker(coords: List[Dict], tolerance: float) -> List[Dict]:
            """Douglas-Peucker simplification algorithm"""
            if len(coords) <= 2:
                return coords
            
            # Find the point with maximum distance
            dmax = 0
            index = 0
            end_index = len(coords) - 1
            
            for i in range(1, end_index):
                d = perpendicular_distance(coords[i], coords[0], coords[end_index])
                if d > dmax:
                    index = i
                    dmax = d
            
            # If max distance is greater than tolerance, recursively simplify
            if dmax > tolerance:
                # Recursive call
                rec_results1 = douglas_peucker(coords[:index + 1], tolerance)
                rec_results2 = douglas_peucker(coords[index:], tolerance)
                
                # Build the result list
                return rec_results1[:-1] + rec_results2
            else:
                return [coords[0], coords[end_index]]
        
        return douglas_peucker(coordinates, tolerance)
        
    except Exception:
        # Return original coordinates if simplification fails
        return coordinates


def validate_gps_data(coordinate: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate GPS coordinate data
    
    Args:
        coordinate: GPS coordinate dictionary
        
    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []
    
    # Check required fields
    if 'latitude' not in coordinate:
        errors.append("Missing latitude")
    if 'longitude' not in coordinate:
        errors.append("Missing longitude")
    
    # Validate coordinate ranges
    if 'latitude' in coordinate:
        lat = coordinate['latitude']
        if not isinstance(lat, (int, float)) or not (-90 <= lat <= 90):
            errors.append("Invalid latitude range")
    
    if 'longitude' in coordinate:
        lon = coordinate['longitude']
        if not isinstance(lon, (int, float)) or not (-180 <= lon <= 180):
            errors.append("Invalid longitude range")
    
    # Validate optional fields
    if 'speed' in coordinate and coordinate['speed'] is not None:
        if not isinstance(coordinate['speed'], (int, float)) or coordinate['speed'] < 0:
            errors.append("Invalid speed value")
    
    if 'heading' in coordinate and coordinate['heading'] is not None:
        if not isinstance(coordinate['heading'], (int, float)) or not (0 <= coordinate['heading'] < 360):
            errors.append("Invalid heading value")
    
    if 'altitude' in coordinate and coordinate['altitude'] is not None:
        if not isinstance(coordinate['altitude'], (int, float)):
            errors.append("Invalid altitude value")
    
    return len(errors) == 0, errors
