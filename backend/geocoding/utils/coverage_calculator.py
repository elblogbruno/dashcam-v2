"""Coverage calculator for trip route geodata coverage analysis."""

import logging
import math
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


class CoverageCalculator:
    """Coverage calculator for trip route geodata coverage analysis."""
    
    def calculate_trip_route_coverage(self, waypoints: List[Dict], geodata_points: List[Dict], radius_km: float) -> Dict:
        """Calculate how well the downloaded geodata covers the trip route"""
        return calculate_trip_route_coverage(waypoints, geodata_points, radius_km)


def calculate_trip_route_coverage(waypoints: List[Dict], geodata_points: List[Dict], radius_km: float) -> Dict:
    """Calculate how well the downloaded geodata covers the trip route"""
    try:
        # Calculate approximate route length and generate route points
        route_points = []
        total_route_distance = 0
        
        # Generate points along the route between waypoints
        for i in range(len(waypoints) - 1):
            start_wp = waypoints[i]
            end_wp = waypoints[i + 1]
            
            # Calculate distance between waypoints
            distance_km = calculate_distance_km(
                start_wp["lat"], start_wp["lon"],
                end_wp["lat"], end_wp["lon"]
            )
            total_route_distance += distance_km
            
            # Generate intermediate points along this segment
            segment_points = generate_route_segment_points(
                start_wp["lat"], start_wp["lon"],
                end_wp["lat"], end_wp["lon"],
                max(1, int(distance_km))  # One point per km minimum
            )
            route_points.extend(segment_points)
        
        # Check coverage for each route point
        covered_points = 0
        for route_point in route_points:
            is_covered = False
            for geo_point in geodata_points:
                distance = calculate_distance_km(
                    route_point[0], route_point[1],
                    geo_point["lat"], geo_point["lon"]
                )
                if distance <= radius_km:
                    is_covered = True
                    break
            
            if is_covered:
                covered_points += 1
        
        # Calculate coverage percentage
        coverage_percentage = (covered_points / len(route_points)) * 100 if route_points else 0
        
        return {
            "total_route_distance_km": round(total_route_distance, 2),
            "total_route_points": len(route_points),
            "covered_route_points": covered_points,
            "coverage_percentage": round(coverage_percentage, 2),
            "geodata_points_count": len(geodata_points),
            "coverage_radius_km": radius_km
        }
        
    except Exception as e:
        logger.error(f"Error calculating trip route coverage: {str(e)}")
        return {
            "total_route_distance_km": 0,
            "total_route_points": 0,
            "covered_route_points": 0,
            "coverage_percentage": 0,
            "geodata_points_count": len(geodata_points),
            "coverage_radius_km": radius_km,
            "error": str(e)
        }


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers using Haversine formula"""
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Earth radius in kilometers
    r = 6371
    return r * c


def generate_route_segment_points(lat1: float, lon1: float, lat2: float, lon2: float, num_points: int) -> List[Tuple[float, float]]:
    """Generate intermediate points along a route segment"""
    points = []
    
    if num_points <= 0:
        return points
    
    # Add intermediate points
    for i in range(1, num_points):
        fraction = i / num_points
        lat = lat1 + (lat2 - lat1) * fraction
        lon = lon1 + (lon2 - lon1) * fraction
        points.append((lat, lon))
    
    return points
