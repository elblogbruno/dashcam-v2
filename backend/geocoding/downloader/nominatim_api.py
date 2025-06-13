"""Nominatim API wrapper for reverse geocoding."""

import logging
from typing import Dict, Optional
import requests

logger = logging.getLogger(__name__)


async def fetch_reverse_geocoding_from_nominatim(lat: float, lon: float) -> Optional[Dict]:
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
        
        headers = {
            "User-Agent": "DashCam-TripPlanner/1.0 (offline geocoding preparation)"
        }
        
        # Make request with timeout
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        return response.json()
        
    except requests.exceptions.RequestException as e:
        logger.debug(f"HTTP error fetching reverse geocoding for ({lat:.4f}, {lon:.4f}): {str(e)}")
        return None
    except Exception as e:
        logger.debug(f"Error fetching reverse geocoding for ({lat:.4f}, {lon:.4f}): {str(e)}")
        return None
