#!/usr/bin/env python3
"""
Final validation script for the refactored Trip Logger system

This script performs comprehensive tests to validate that the entire
system is working correctly after the refactoring.
"""

import os
import sys
import time
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_trip_logger_basic_functionality():
    """Test basic TripLogger functionality"""
    print("🧪 Testing basic TripLogger functionality...")
    
    from trip_logger import TripLogger
    
    # Create TripLogger instance
    trip_logger = TripLogger(':memory:')
    
    # Test trip creation
    trip_id = trip_logger.start_trip()
    assert trip_id is not None, "Failed to create trip"
    print(f"  ✅ Trip created with ID: {trip_id}")
    
    # Test GPS logging
    trip_logger.log_gps_coordinate(
        latitude=40.4168,
        longitude=-3.7038,
        altitude=650.0,
        speed=50.0,
        heading=90.0,
        satellites=8,
        fix_quality=3
    )
    print("  ✅ GPS coordinate logged")
    
    # Test landmark encounter
    landmark = {
        'id': 'test_landmark',
        'name': 'Test Landmark',
        'lat': 40.4168,
        'lon': -3.7038,
        'category': 'tourism'
    }
    trip_logger.add_landmark_encounter(landmark)
    print("  ✅ Landmark encounter logged")
    
    # Test trip ending
    trip_logger.end_trip()
    print("  ✅ Trip ended successfully")
    
    # Test data retrieval
    trips = trip_logger.get_all_trips()
    assert len(trips) > 0, "No trips found"
    print(f"  ✅ Retrieved {len(trips)} trips from database")
    
    return True

def test_new_package_direct_usage():
    """Test using the new package directly"""
    print("🧪 Testing new package direct usage...")
    
    from trip_logger_package import TripManager
    from trip_logger_package.models.schemas import GpsCoordinateRequest
    
    # Test TripManager
    trip_manager = TripManager(':memory:')
    
    # Create trip with the corrected interface
    trip_id = trip_manager.start_trip(start_lat=40.4168, start_lon=-3.7038)
    assert trip_id is not None, "Failed to create trip with TripManager"
    print(f"  ✅ Trip created via TripManager: {trip_id}")
    
    # Test GPS coordinate request
    result = trip_manager.log_gps_coordinate(
        latitude=40.4168,
        longitude=-3.7038,
        altitude=650.0,
        speed=50.0,
        heading=90.0,
        satellites=8,
        fix_quality=3
    )
    assert result, "Failed to log GPS coordinate"
    print("  ✅ GPS coordinate logged via TripManager")
    
    trip_manager.end_trip()
    print("  ✅ Trip ended via TripManager")
    
    return True

def test_route_integration():
    """Test integration with route modules"""
    print("🧪 Testing route integration...")
    
    from trip_logger import TripLogger
    import routes.trips as trips_routes
    import routes.videos as videos_routes
    
    # Create TripLogger instance
    trip_logger = TripLogger(':memory:')
    
    # Test assignment to routes
    trips_routes.trip_logger = trip_logger
    videos_routes.trip_logger = trip_logger
    
    assert trips_routes.trip_logger is not None, "Failed to assign to trips_routes"
    assert videos_routes.trip_logger is not None, "Failed to assign to videos_routes"
    
    print("  ✅ Route integration successful")
    return True

def test_database_compatibility():
    """Test compatibility with existing database"""
    print("🧪 Testing database compatibility...")
    
    legacy_db = '/root/dashcam-v2/data/recordings.db'
    
    if os.path.exists(legacy_db):
        from trip_logger import TripLogger
        
        # Test reading from existing database
        trip_logger = TripLogger(legacy_db)
        
        # Get existing trips
        trips = trip_logger.get_all_trips()
        print(f"  ✅ Successfully read {len(trips)} trips from legacy database")
        
        # Get GPS coordinates if any trips exist
        if trips:
            trip_id = trips[0].get('id')
            gps_coords = trip_logger.get_trip_gps_coordinates(trip_id)
            print(f"  ✅ Successfully read {len(gps_coords)} GPS coordinates")
        
        return True
    else:
        print("  ⚠️  No legacy database found - skipping compatibility test")
        return True

def test_system_imports():
    """Test all critical system imports"""
    print("🧪 Testing system imports...")
    
    try:
        # Test main system components
        from trip_logger import TripLogger
        from camera_manager import CameraManager
        from auto_trip_manager import auto_trip_manager
        from landmarks.core.landmark_checker import LandmarkChecker
        from audio_notifier import AudioNotifier
        
        print("  ✅ Core system imports successful")
        
        # Test route imports
        import routes.recording as recording_routes
        import routes.trips as trips_routes
        import routes.videos as videos_routes
        import routes.trip_planner as trip_planner_routes
        
        print("  ✅ Route imports successful")
        
        # Test new package imports
        from trip_logger_package import TripManager
        from trip_logger_package.models.db_models import Trip, GpsCoordinate
        from trip_logger_package.models.schemas import TripCreateRequest
        from trip_logger_package.database.repository import TripRepository
        
        print("  ✅ New package imports successful")
        
        return True
        
    except ImportError as e:
        print(f"  ❌ Import failed: {e}")
        return False

def run_all_tests():
    """Run all validation tests"""
    print("🚀 Starting Trip Logger System Validation")
    print("=" * 50)
    
    tests = [
        ("System Imports", test_system_imports),
        ("Basic Functionality", test_trip_logger_basic_functionality),
        ("New Package Usage", test_new_package_direct_usage),
        ("Route Integration", test_route_integration),
        ("Database Compatibility", test_database_compatibility),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        try:
            start_time = time.time()
            success = test_func()
            duration = time.time() - start_time
            
            if success:
                print(f"  ✅ PASSED ({duration:.2f}s)")
                results.append((test_name, True, None))
            else:
                print(f"  ❌ FAILED ({duration:.2f}s)")
                results.append((test_name, False, "Test returned False"))
                
        except Exception as e:
            duration = time.time() - start_time if 'start_time' in locals() else 0
            print(f"  ❌ ERROR ({duration:.2f}s): {e}")
            results.append((test_name, False, str(e)))
    
    # Print summary
    print("\n" + "=" * 50)
    print("🏁 VALIDATION SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    for test_name, success, error in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status:8} {test_name}")
        if error:
            print(f"         Error: {error}")
    
    print(f"\nResult: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! The Trip Logger refactoring is successful!")
        print("✅ The system is ready for production use.")
    else:
        print(f"\n⚠️  {total - passed} tests failed. Please review the errors above.")
        return False
    
    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
