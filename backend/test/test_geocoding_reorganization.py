#!/usr/bin/env python3
"""
Test script to verify that the geocoding module reorganization is working correctly.
"""

import asyncio
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_geocoding_reorganization():
    """Test all the geocoding module components"""
    
    print("🧪 Testing geocoding module reorganization...")
    
    try:
        # Test 1: Import all reorganized classes
        print("\n📦 Testing imports...")
        from geocoding.downloader.geodata_downloader import GeodataDownloader
        from geocoding.utils.coverage_calculator import CoverageCalculator
        from geocoding.utils.db_storage import DBStorage
        from geocoding.services.reverse_geocoding_service import LocationInfo, ReverseGeocodingService
        from geocoding.routes.geocode import router as geocode_router
        print("✅ All imports successful")
        
        # Test 2: Instantiate classes
        print("\n🏗️  Testing class instantiation...")
        downloader = GeodataDownloader()
        coverage_calc = CoverageCalculator()
        db_storage = DBStorage()
        print("✅ All classes instantiated successfully")
        
        # Test 3: Test LocationInfo dataclass
        print("\n📍 Testing LocationInfo...")
        location = LocationInfo(
            city="Test City",
            state="Test State", 
            country="Test Country",
            country_code="TC"
        )
        print(f"✅ LocationInfo created: {location.get_display_name()}")
        
        # Test 4: Test mock geocoding download
        print("\n🌍 Testing geocoding download...")
        mock_data = await downloader.download_geodata_for_location(
            40.7128, -74.0060, 1.0, "New York Test"
        )
        print(f"✅ Mock geocoding download returned {len(mock_data)} records")
        
        # Test 5: Test coverage calculation 
        print("\n📊 Testing coverage calculation...")
        mock_waypoints = [
            {"lat": 40.7128, "lon": -74.0060, "name": "Start"},
            {"lat": 40.7589, "lon": -73.9851, "name": "End"}
        ]
        mock_geodata = [
            {"lat": 40.7300, "lon": -74.0000, "name": "Point 1"},
            {"lat": 40.7400, "lon": -73.9900, "name": "Point 2"}
        ]
        
        coverage_stats = coverage_calc.calculate_trip_route_coverage(
            mock_waypoints, mock_geodata, 5.0
        )
        print(f"✅ Coverage calculation completed: {coverage_stats.get('coverage_percentage', 0):.1f}%")
        
        print("\n🎉 All tests passed! Geocoding module reorganization is successful!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run the test"""
    success = asyncio.run(test_geocoding_reorganization())
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
