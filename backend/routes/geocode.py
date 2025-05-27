from fastapi import APIRouter, HTTPException
import requests
import logging
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define router
router = APIRouter()

@router.get("/reverse")
async def reverse_geocode(lat: float, lon: float):
    """Get location name from coordinates using OpenStreetMap Nominatim API"""
    try:
        # Use Nominatim API for reverse geocoding
        reverse_url = "https://nominatim.openstreetmap.org/reverse"
        
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json",
            "zoom": 14,  # Choose appropriate zoom level for neighborhood-level results
            "addressdetails": 1
        }
        
        # Add user-agent to comply with Nominatim usage policy
        headers = {
            "User-Agent": "DashcamV2/1.0"
        }
        
        logger.info(f"Reverse geocoding request for coordinates: {lat}, {lon}")
        
        response = requests.get(reverse_url, params=params, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Reverse geocoding result: {result.get('display_name', 'Unknown location')}")
        
        return result
    except Exception as e:
        logger.error(f"Error in reverse geocoding: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reverse geocode: {str(e)}")
