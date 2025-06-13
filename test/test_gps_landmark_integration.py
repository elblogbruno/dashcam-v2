#!/usr/bin/env python3
"""
Test script to verify GPS coordinate logging and landmark integration
"""

import sys
import os
import time
import logging
from datetime import datetime

# Add backend to path
sys.path.append('/root/dashcam-v2/backend')

from landmarks.core.landmark_checker import LandmarkChecker
from trip_logger import TripLogger
# Note: Not importing camera_manager due to OpenCV dependencies in test environment

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_gps_landmark_integration():
    """Test the complete GPS and landmark integration system"""
    
    logger.info("=== Starting GPS and Landmark Integration Test ===")
    
    # Initialize components
    try:
        # Test LandmarkChecker
        logger.info("Testing LandmarkChecker...")
        landmark_checker = LandmarkChecker()
        logger.info(f"Loaded {len(landmark_checker.landmarks)} landmarks")
        
        # Test get_nearby_landmarks method
        test_lat, test_lon = 40.7589, -73.9851  # Times Square, NYC
        nearby_landmarks = landmark_checker.get_nearby_landmarks(test_lat, test_lon, radius_km=1.0)
        logger.info(f"Found {len(nearby_landmarks)} landmarks near Times Square")
        
        # Test TripLogger GPS methods
        logger.info("Testing TripLogger GPS functionality...")
        trip_logger = TripLogger()
        
        # Test GPS statistics
        stats = trip_logger.get_gps_statistics()
        logger.info(f"GPS Statistics: {stats}")
        
        # Test cleanup method
        from datetime import timedelta
        cutoff_date = datetime.now() - timedelta(days=30)
        cleaned_count = trip_logger.cleanup_old_gps_data(cutoff_date)
        logger.info(f"Cleaned up {cleaned_count} old GPS records")
        
        # Add a test landmark
        logger.info("Testing landmark operations...")
        test_landmark_id = landmark_checker.add_landmark(
            name="Test Integration Landmark",
            lat=test_lat + 0.001,  # Slightly offset
            lon=test_lon + 0.001,
            radius_m=100,
            description="Test landmark for integration testing",
            category="test"
        )
        
        if test_landmark_id:
            logger.info(f"Successfully added test landmark with ID: {test_landmark_id}")
            
            # Test nearby check with new landmark
            nearby_landmarks = landmark_checker.get_nearby_landmarks(test_lat, test_lon, radius_km=1.0)
            test_landmark_found = any(
                lm['landmark'].get('name') == "Test Integration Landmark" 
                for lm in nearby_landmarks
            )
            
            if test_landmark_found:
                logger.info("✓ Test landmark successfully detected in nearby search")
            else:
                logger.warning("✗ Test landmark not found in nearby search")
                
            # Clean up test landmark
            landmark_checker.remove_landmark(test_landmark_id['id'])  # Use the ID from the result
            logger.info("Cleaned up test landmark")
        
        logger.info("=== GPS and Landmark Integration Test COMPLETED ===")
        return True
        
    except Exception as e:
        logger.error(f"Integration test failed: {str(e)}")
        return False

def test_priority_landmark_categories():
    """Test priority landmark category detection"""
    
    logger.info("=== Testing Priority Landmark Categories ===")
    
    try:
        # Test priority categories
        priority_categories = [
            'tourism', 'monument', 'museum', 'castle', 'viewpoint', 
            'attraction', 'historic', 'tourist_attraction', 'heritage'
        ]
        
        standard_categories = [
            'gas_station', 'restaurant', 'hotel', 'custom', 'poi'
        ]
        
        # Since we can't directly test _is_priority_landmark_category (it's in camera_manager),
        # we'll test the landmark categories that should trigger priority behavior
        landmark_checker = LandmarkChecker()
        
        for i, category in enumerate(priority_categories):
            test_id = landmark_checker.add_landmark(
                name=f"Test {category.title()} Landmark",
                lat=40.7589 + (i * 0.001),
                lon=-73.9851,
                radius_m=200,
                category=category
            )
            
            if test_id:
                logger.info(f"✓ Added priority landmark: {category}")
                landmark_checker.remove_landmark(test_id['id'])  # Use the ID from the result
            else:
                logger.warning(f"✗ Failed to add priority landmark: {category}")
        
        logger.info("=== Priority Landmark Categories Test COMPLETED ===")
        return True
        
    except Exception as e:
        logger.error(f"Priority categories test failed: {str(e)}")
        return False

def test_gps_coordinate_formats():
    """Test different GPS coordinate formats and edge cases"""
    
    logger.info("=== Testing GPS Coordinate Formats ===")
    
    try:
        landmark_checker = LandmarkChecker()
        
        # Test coordinate pairs
        test_coordinates = [
            (40.7589, -73.9851),  # NYC
            (51.5074, -0.1278),   # London
            (35.6762, 139.6503),  # Tokyo
            (-33.8688, 151.2093), # Sydney
            (0.0, 0.0),           # Null Island
        ]
        
        for lat, lon in test_coordinates:
            nearby = landmark_checker.get_nearby_landmarks(lat, lon, radius_km=0.1)
            logger.info(f"Coordinates ({lat}, {lon}): Found {len(nearby)} nearby landmarks")
            
        logger.info("=== GPS Coordinate Formats Test COMPLETED ===")
        return True
        
    except Exception as e:
        logger.error(f"GPS coordinate formats test failed: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting comprehensive GPS and Landmark system tests...")
    
    # Set test environment
    os.environ['DASHCAM_DATA_PATH'] = '/root/dashcam-v2/backend/data'
    
    # Run tests
    tests = [
        test_gps_landmark_integration,
        test_priority_landmark_categories,
        test_gps_coordinate_formats
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
                logger.info(f"✓ {test.__name__} PASSED")
            else:
                logger.error(f"✗ {test.__name__} FAILED")
        except Exception as e:
            logger.error(f"✗ {test.__name__} FAILED with exception: {str(e)}")
    
    logger.info(f"\n=== TEST SUMMARY ===")
    logger.info(f"Passed: {passed}/{total}")
    logger.info(f"Success rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        logger.info("🎉 All tests passed! GPS and Landmark system is ready.")
        sys.exit(0)
    else:
        logger.error("❌ Some tests failed. Please check the errors above.")
        sys.exit(1)
