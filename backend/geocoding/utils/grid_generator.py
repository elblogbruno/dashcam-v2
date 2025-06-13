"""Grid generator for comprehensive geodata coverage."""

import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)


def generate_comprehensive_grid_coverage(center_lat: float, center_lon: float, radius_km: float) -> List[Tuple[float, float]]:
    """Generate comprehensive grid coverage around a location for offline geocoding preparation"""
    points = []
    
    try:
        # Convert radius from km to degrees (approximate)
        radius_deg = float(radius_km) / 111.0  # 1 degree ≈ 111 km
        
        # Use adaptive grid density based on radius
        if radius_km <= 1:
            grid_density = 0.001  # Very fine grid for small radius (about 100m)
        elif radius_km <= 5:
            grid_density = 0.005  # Fine grid for medium radius (about 500m)
        elif radius_km <= 10:
            grid_density = 0.01   # Medium grid for larger radius (about 1km)
        else:
            grid_density = 0.02   # Coarse grid for very large radius (about 2km)
        
        # Generate grid points within the radius
        lat_start = center_lat - radius_deg
        lat_end = center_lat + radius_deg
        lon_start = center_lon - radius_deg
        lon_end = center_lon + radius_deg
        
        current_lat = lat_start
        while current_lat <= lat_end:
            current_lon = lon_start
            while current_lon <= lon_end:
                # Check if point is within radius (circular coverage)
                distance_deg = ((current_lat - center_lat) ** 2 + (current_lon - center_lon) ** 2) ** 0.5
                if distance_deg <= radius_deg:
                    # Skip center point (will be processed separately)
                    if not (abs(current_lat - center_lat) < 0.001 and abs(current_lon - center_lon) < 0.001):
                        # Validate coordinates are within valid ranges
                        if -90 <= current_lat <= 90 and -180 <= current_lon <= 180:
                            points.append((current_lat, current_lon))
                
                current_lon += grid_density
            current_lat += grid_density
        
        logger.info(f"Generating grid coverage for ({center_lat:.4f}, {center_lon:.4f}) with {radius_km}km radius")
        logger.info(f"Using grid density: {grid_density:.4f} degrees (~{grid_density*111:.0f}m)")
        
        logger.debug(f"Generated {len(points)} grid points for comprehensive coverage "
                    f"around ({center_lat}, {center_lon}) with {radius_km}km radius")
        
        logger.info(f"Grid generation complete: {len(points)} points generated for {radius_km}km radius")
        return points
        
    except Exception as grid_error:
        logger.error(f"Error generating comprehensive grid around ({center_lat}, {center_lon}): {str(grid_error)}")
        return []


def generate_grid_around_point(center_lat: float, center_lon: float, radius_km: float, grid_size: int) -> List[Tuple[float, float]]:
    """Generate a grid of points around a center location"""
    points = []
    
    try:
        # Validate inputs
        if not isinstance(center_lat, (int, float)) or not isinstance(center_lon, (int, float)):
            logger.error(f"Invalid coordinate types: lat={type(center_lat)}, lon={type(center_lon)}")
            return points
            
        if not isinstance(radius_km, (int, float)) or radius_km <= 0:
            logger.error(f"Invalid radius: {radius_km}")
            return points
            
        if not isinstance(grid_size, int) or grid_size <= 0:
            logger.error(f"Invalid grid size: {grid_size}")
            return points
        
        # Convert radius from km to degrees (approximate)
        radius_deg = float(radius_km) / 111.0  # 1 degree ≈ 111 km
        
        # Calculate step size for grid
        step = (2 * radius_deg) / (grid_size - 1) if grid_size > 1 else 0
        
        # Generate grid points
        for i in range(grid_size):
            for j in range(grid_size):
                lat = float(center_lat) - radius_deg + (i * step)
                lon = float(center_lon) - radius_deg + (j * step)
                
                # Skip the center point (already processed)
                if abs(lat - center_lat) < 0.001 and abs(lon - center_lon) < 0.001:
                    continue
                    
                # Validate coordinates are within valid ranges
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    points.append((lat, lon))
        
        logger.debug(f"Generated {len(points)} grid points around ({center_lat}, {center_lon})")
        return points
        
    except Exception as grid_error:
        logger.error(f"Error generating grid around ({center_lat}, {center_lon}): {str(grid_error)}")
        return []
