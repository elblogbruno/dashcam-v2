"""Geodata downloader functionality for offline geocoding."""

import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import requests

from ..utils.grid_generator import generate_comprehensive_grid_coverage

logger = logging.getLogger(__name__)


class GeodataDownloader:
    """Class for downloading geodata for offline use"""
    
    def __init__(self, progress_callback=None):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "DashCam-TripPlanner/1.0 (offline geocoding preparation)"
        })
        self.progress_callback = progress_callback
    
    async def download_geodata_for_location(self, lat: float, lon: float, radius_km: float, location_name: str) -> List[Dict]:
        """Download reverse geocoded data for a specific location using online APIs and store for offline use"""
        try:
            logger.debug(f"Starting online geodata download for location: {location_name} at ({lat}, {lon}) with radius {radius_km}km")
            
            # Validate coordinates
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                logger.error(f"Invalid coordinates for {location_name}: lat={lat}, lon={lon}")
                return []

            geodata = []
            
            # Generate grid points around the location for comprehensive coverage
            logger.debug(f"Generating comprehensive grid coverage around {location_name}")
            grid_points = generate_comprehensive_grid_coverage(lat, lon, radius_km)
            
            # Add the center point as the first point
            all_points = [(lat, lon, "center_waypoint")] + [(p[0], p[1], "grid_point") for p in grid_points]
            
            total_points = len(all_points)
            successful_requests = 0
            failed_requests = 0
            
            # Initial progress callback
            if self.progress_callback:
                self.progress_callback(0, f"Iniciando descarga para {location_name}", 0, total_points, 0, 0, False)
            
            logger.info(f"Processing {total_points} points for comprehensive geodata coverage around {location_name}")
            
            # Process each point (center + grid)
            for i, (point_lat, point_lon, point_type) in enumerate(all_points):
                try:
                    # Calculate and report progress
                    current_progress = (i / total_points) * 100
                    
                    # Call progress callback if provided
                    if self.progress_callback:
                        self.progress_callback(
                            current_progress, 
                            f"Procesando punto {i+1}/{total_points} para {location_name}",
                            i,
                            total_points,
                            successful_requests,
                            failed_requests,
                            False
                        )
                    
                    logger.debug(f"Processing point {i+1}/{total_points} ({point_lat:.4f}, {point_lon:.4f}) for {location_name}")
                    
                    # Get reverse geocoding data from Nominatim API
                    reverse_data = await self.fetch_reverse_geocoding_from_nominatim(point_lat, point_lon)
                    
                    if reverse_data:
                        # Store the complete Nominatim response for enhanced storage
                        geodata_record = {
                            "lat": point_lat,
                            "lon": point_lon,
                            "raw_response": reverse_data,  # Complete Nominatim response
                            "location_type": point_type,
                            "radius_km": radius_km,
                            "source": "nominatim_online",
                            "timestamp": datetime.now().isoformat(),
                            # Legacy fields for backward compatibility
                            "name": reverse_data.get("display_name", f"{point_type}_{point_lat:.4f}_{point_lon:.4f}"),
                            "admin1": reverse_data.get("address", {}).get("state", ""),
                            "admin2": reverse_data.get("address", {}).get("county", ""),
                            "cc": reverse_data.get("address", {}).get("country_code", "").upper(),
                            "city": reverse_data.get("address", {}).get("city", reverse_data.get("address", {}).get("town", "")),
                            "village": reverse_data.get("address", {}).get("village", ""),
                            "road": reverse_data.get("address", {}).get("road", ""),
                            "house_number": reverse_data.get("address", {}).get("house_number", ""),
                            "postcode": reverse_data.get("address", {}).get("postcode", ""),
                            "suburb": reverse_data.get("address", {}).get("suburb", "")
                        }
                        
                        geodata.append(geodata_record)
                        successful_requests += 1
                        
                        logger.debug(f"Successfully processed point {i+1}/{total_points} for {location_name}: {reverse_data.get('display_name', 'Unknown location')}")
                        
                        # Small delay to be respectful to the API
                        await asyncio.sleep(0.1)
                    else:
                        failed_requests += 1
                        logger.debug(f"No data returned for point {i+1}/{total_points} ({point_lat:.4f}, {point_lon:.4f}) for {location_name}")
                    
                    # Update progress after processing each point
                    current_progress = ((i + 1) / total_points) * 100
                    if self.progress_callback:
                        self.progress_callback(
                            current_progress, 
                            f"Procesado {i + 1}/{total_points} puntos para {location_name}",
                            i + 1,
                            total_points,
                            successful_requests,
                            failed_requests,
                            False
                        )
                    
                    # Log progress every 10 points
                    if (i + 1) % 10 == 0:
                        logger.info(f"Progress for {location_name}: {i + 1}/{total_points} points processed ({current_progress:.1f}%) - {successful_requests} exitosos, {failed_requests} fallos")
                        
                except Exception as point_error:
                    failed_requests += 1
                    logger.warning(f"Error processing point {i+1}/{total_points} ({point_lat:.4f}, {point_lon:.4f}) for {location_name}: {str(point_error)}")
                    
                    # Update progress with failed count
                    if self.progress_callback:
                        current_progress = ((i + 1) / total_points) * 100
                        self.progress_callback(
                            current_progress, 
                            f"Error en punto {i+1}/{total_points} para {location_name}",
                            i + 1,
                            total_points,
                            successful_requests,
                            failed_requests,
                            False
                        )
                    continue
            
            # Final progress callback
            if self.progress_callback:
                self.progress_callback(
                    100, 
                    f"Completado para {location_name}",
                    total_points,
                    total_points,
                    successful_requests,
                    failed_requests,
                    False
                )
            
            # Calculate coverage statistics
            coverage_percentage = (successful_requests / total_points) * 100 if total_points > 0 else 0
            
            logger.info(f"Downloaded {len(geodata)} geodata records for location {location_name} "
                       f"(Coverage: {coverage_percentage:.1f}% - {successful_requests}/{total_points} points successful, {failed_requests} failed)")
            
            return geodata
            
        except Exception as location_error:
            logger.error(f"Error downloading geodata for location {location_name} at ({lat}, {lon}): {str(location_error)}", exc_info=True)
            return []

    async def fetch_reverse_geocoding_from_nominatim(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch reverse geocoding data from OpenStreetMap Nominatim API"""
        try:
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {
                "lat": lat,
                "lon": lon,
                "format": "json",
                "addressdetails": 1,
                "extratags": 1,
                "namedetails": 1,
                "zoom": 18  # High detail level
            }
            
            logger.debug(f"Fetching reverse geocoding for ({lat:.4f}, {lon:.4f})")
            
            # Make request with timeout
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data and 'display_name' in data:
                logger.debug(f"Successfully fetched geocoding data for ({lat:.4f}, {lon:.4f}): {data.get('display_name', 'Unknown')}")
                return data
            else:
                logger.debug(f"No geocoding data available for ({lat:.4f}, {lon:.4f})")
                return None
            
        except requests.exceptions.RequestException as e:
            logger.warning(f"HTTP error fetching reverse geocoding for ({lat:.4f}, {lon:.4f}): {str(e)}")
            return None
        except Exception as e:
            logger.warning(f"Error fetching reverse geocoding for ({lat:.4f}, {lon:.4f}): {str(e)}")
            return None
