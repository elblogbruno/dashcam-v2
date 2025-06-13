#!/usr/bin/env python3
"""
Test script para verificar que el reverse geocoding offline funciona correctamente
"""

import asyncio
import os
import sys
import logging

# Add the backend directory to the path
sys.path.append('/root/dashcam-v2/backend')

from geocoding.services.reverse_geocoding_service import ReverseGeocodingService
from geocoding.utils.db_storage import DBStorage

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def test_reverse_geocoding():
    """Test the reverse geocoding service"""
    
    # Test coordinates (Madrid, Spain)
    test_coordinates = [
        (40.4168, -3.7038),   # Madrid center
        (41.3851, 2.1734),    # Barcelona
        (39.4699, -0.3763),   # Valencia
        (43.2630, -2.9350),   # Bilbao
    ]
    
    print("🔍 Testing Reverse Geocoding Offline-First System")
    print("=" * 60)
    
    # Initialize the service
    try:
        cache_db_path = "/root/dashcam-v2/data/recordings.db"
        offline_db_path = "/root/dashcam-v2/data/geocoding_offline.db"
        
        print(f"📁 Cache DB: {cache_db_path}")
        print(f"📁 Offline DB: {offline_db_path}")
        print(f"📊 Cache DB exists: {os.path.exists(cache_db_path)}")
        print(f"📊 Offline DB exists: {os.path.exists(offline_db_path)}")
        print()
        
        service = ReverseGeocodingService(
            cache_db_path=cache_db_path,
            enable_online=True,
            rate_limit=1.0
        )
        
        print("✅ ReverseGeocodingService initialized successfully")
        print()
        
        # Test DB Storage directly
        print("🔬 Testing DBStorage directly...")
        db_storage = DBStorage()
        is_available = await db_storage.is_available()
        print(f"📊 DBStorage available: {is_available}")
        
        if is_available:
            record_count = await db_storage.get_record_count()
            print(f"📊 Records in offline DB: {record_count}")
        print()
        
        # Test each coordinate
        for i, (lat, lon) in enumerate(test_coordinates, 1):
            print(f"🌍 Test {i}: Coordinates ({lat:.4f}, {lon:.4f})")
            
            try:
                # Test the main service
                result = await service.get_location(lat, lon)
                
                if result:
                    print(f"✅ Found: {result.get_display_name()}")
                    print(f"   City: {result.city}")
                    print(f"   State: {result.state}")
                    print(f"   Country: {result.country}")
                    print(f"   Country Code: {result.country_code}")
                else:
                    print("❌ No result found")
                
                # Test DBStorage directly if available
                if is_available:
                    print("🔍 Testing direct DBStorage query...")
                    offline_result = await db_storage.reverse_geocode(lat, lon, radius_km=5.0)
                    if offline_result:
                        print(f"✅ Offline result: {offline_result.get('name', 'Unknown')}")
                    else:
                        print("❌ No offline result")
                
            except Exception as e:
                print(f"❌ Error: {str(e)}")
                logger.exception(f"Error testing coordinates {lat}, {lon}")
            
            print("-" * 40)
        
        # Print statistics
        print("\n📊 Service Statistics:")
        stats = service.get_stats()
        for key, value in stats.items():
            print(f"   {key}: {value}")
        
        print("\n✅ Test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error initializing service: {str(e)}")
        logger.exception("Error in test")

if __name__ == "__main__":
    asyncio.run(test_reverse_geocoding())
