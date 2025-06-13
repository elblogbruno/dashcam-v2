#!/usr/bin/env python3
"""Test script for enhanced reverse geocoding storage"""

import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from geocoding.services.reverse_geocoding_service import ReverseGeocodingService

async def test_enhanced_geocoding():
    """Test enhanced geocoding storage"""
    
    # Create service instance with cache DB path
    cache_db_path = os.path.join("data", "geocoding_offline.db")
    service = ReverseGeocodingService(cache_db_path=cache_db_path)
    
    # Test coordinates from the log
    lat, lon = 41.780643, 1.834485
    
    print(f"Testing enhanced reverse geocoding for: {lat}, {lon}")
    print("=" * 60)
    
    # Force online to get fresh Nominatim data
    result = await service.get_location(lat, lon, force_online=True)
    
    if result:
        print(f"✓ Geocoding successful!")
        print(f"  Display name: {result.get_display_name()}")
        print(f"  City: {result.city}")
        print(f"  State: {result.state}")
        print(f"  Country: {result.country}")
        print(f"  Source: {result.source}")
        print(f"  Raw response available: {result.raw_response is not None}")
        
        if result.raw_response:
            print(f"  Place ID: {result.raw_response.get('place_id')}")
            print(f"  OSM Type: {result.raw_response.get('osm_type')}")
            print(f"  Address components: {len(result.raw_response.get('address', {}))}")
    else:
        print("✗ Geocoding failed")
    
    print("\n" + "=" * 60)
    print("Now testing offline retrieval...")
    
    # Test offline retrieval
    offline_result = await service.get_location(lat, lon)
    
    if offline_result:
        print(f"✓ Offline geocoding successful!")
        print(f"  Display name: {offline_result.get_display_name()}")
        print(f"  City: {offline_result.city}")
        print(f"  State: {offline_result.state}")
        print(f"  Country: {offline_result.country}")
        print(f"  Source: {offline_result.source}")
    else:
        print("✗ Offline geocoding failed")
    
    # Test nearby coordinates
    print("\n" + "=" * 60)
    print("Testing nearby coordinates...")
    
    nearby_result = await service.get_location(lat + 0.0001, lon + 0.0001)
    
    if nearby_result:
        print(f"✓ Nearby geocoding successful!")
        print(f"  Display name: {nearby_result.get_display_name()}")
        print(f"  Source: {nearby_result.source}")
    else:
        print("✗ Nearby geocoding failed")

if __name__ == "__main__":
    asyncio.run(test_enhanced_geocoding())
