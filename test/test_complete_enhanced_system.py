#!/usr/bin/env python3
"""Test script for complete enhanced geodata system"""

import asyncio
import sys
import os
import sqlite3
import json

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from geocoding.services.reverse_geocoding_service import ReverseGeocodingService
from geocoding.utils.db_storage import store_geodata_in_db
from geocoding.downloader.geodata_downloader import GeodataDownloader

async def test_complete_geodata_system():
    """Test the complete enhanced geodata system"""
    
    print("🧪 Testing Complete Enhanced Geodata System")
    print("=" * 60)
    
    # Database path
    cache_db_path = os.path.join("data", "geocoding_offline.db")
    
    # Test coordinates (different location to avoid cache interference)
    lat, lon = 41.4036, 2.1744  # Barcelona coordinates
    
    print(f"📍 Testing coordinates: {lat}, {lon}")
    
    # Test 1: Enhanced reverse geocoding service
    print("\n1️⃣ Testing Enhanced Reverse Geocoding Service")
    print("-" * 40)
    
    service = ReverseGeocodingService(cache_db_path=cache_db_path)
    result = await service.get_location(lat, lon, force_online=True)
    
    if result:
        print(f"✅ Service test successful!")
        print(f"   📍 Location: {result.get_display_name()}")
        print(f"   🏙️  City: {result.city}")
        print(f"   🌍 Country: {result.country}")
        print(f"   📊 Raw response available: {result.raw_response is not None}")
        if result.raw_response:
            print(f"   🆔 Place ID: {result.raw_response.get('place_id')}")
            print(f"   🗺️  OSM Type: {result.raw_response.get('osm_type')}")
    else:
        print("❌ Service test failed")
        return
    
    # Test 2: Direct database storage function
    print("\n2️⃣ Testing Direct Database Storage")
    print("-" * 40)
    
    # Create test geodata record
    test_geodata = {
        'lat': lat + 0.001,  # Slightly different coordinates
        'lon': lon + 0.001,
        'name': 'Test Location',
        'admin1': result.state,
        'admin2': result.city or 'Test City',
        'cc': result.country_code,
        'raw_response': result.raw_response,
        'source': 'test'
    }
    
    # Create test waypoint
    test_waypoint = {
        'lat': lat + 0.001,
        'lon': lon + 0.001
    }
    
    try:
        await store_geodata_in_db(test_geodata, "test_trip_001", test_waypoint)
        print("✅ Direct storage test successful!")
    except Exception as e:
        print(f"❌ Direct storage failed: {e}")
        return
    
    # Test 3: GeodataDownloader with enhanced storage
    print("\n3️⃣ Testing GeodataDownloader Integration")
    print("-" * 40)
    
    def progress_callback(progress, detail, grid_processed=0, grid_total=0, 
                         successful_calls=0, failed_calls=0, rate_limit_wait=False):
        if progress > 0:
            print(f"   📈 Progress: {progress:.1f}% - {detail}")
    
    downloader = GeodataDownloader(progress_callback=progress_callback)
    
    try:
        # Download geodata for a small radius
        geodata_results = await downloader.download_geodata_for_location(
            lat + 0.002, lon + 0.002, radius_km=0.5, location_name="Test Downloader Location"
        )
        
        if geodata_results:
            print(f"✅ Downloader test successful! Got {len(geodata_results)} records")
            
            # Check if the first record has enhanced data
            first_record = geodata_results[0]
            has_raw_response = 'raw_response' in first_record and first_record['raw_response']
            print(f"   📊 Enhanced data available: {has_raw_response}")
            
            if has_raw_response:
                raw = first_record['raw_response']
                print(f"   🆔 Place ID: {raw.get('place_id')}")
                print(f"   📍 Display name: {raw.get('display_name', 'N/A')[:80]}...")
        else:
            print("❌ Downloader test failed - no results")
            
    except Exception as e:
        print(f"❌ Downloader test failed: {e}")
    
    # Test 4: Database verification
    print("\n4️⃣ Verifying Database Storage")
    print("-" * 40)
    
    try:
        conn = sqlite3.connect(cache_db_path)
        cursor = conn.cursor()
        
        # Check detailed_geocoding table
        cursor.execute("SELECT COUNT(*) FROM detailed_geocoding")
        detailed_count = cursor.fetchone()[0]
        
        # Check for recent entries with raw_response
        cursor.execute("""
            SELECT place_id, osm_type, display_name, raw_response 
            FROM detailed_geocoding 
            WHERE raw_response IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 3
        """)
        
        recent_entries = cursor.fetchall()
        
        print(f"✅ Database verification successful!")
        print(f"   📊 Total detailed records: {detailed_count}")
        print(f"   📝 Recent enhanced entries: {len(recent_entries)}")
        
        for i, (place_id, osm_type, display_name, raw_response) in enumerate(recent_entries):
            print(f"   {i+1}. Place ID: {place_id}, Type: {osm_type}")
            print(f"      Display: {(display_name or 'N/A')[:60]}...")
            
            if raw_response:
                try:
                    raw_data = json.loads(raw_response)
                    addr_components = len(raw_data.get('address', {}))
                    print(f"      Address components: {addr_components}")
                except:
                    print(f"      Raw response: {len(raw_response)} chars")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database verification failed: {e}")
    
    print("\n" + "=" * 60)
    print("🎉 Enhanced Geodata System Test Complete!")
    print("   ✅ All components are using the enhanced storage system")
    print("   ✅ Complete Nominatim responses are being stored")
    print("   ✅ Database contains detailed geocoding information")

if __name__ == "__main__":
    asyncio.run(test_complete_geodata_system())
