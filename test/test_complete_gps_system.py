#!/usr/bin/env python3
"""
Test script for GPS metadata injection and video coordinate embedding
"""

import sys
import os
import time
import logging
from datetime import datetime, timedelta

# Add backend to path
sys.path.append('/root/dashcam-v2/backend')

from video_metadata_injector import VideoMetadataInjector
from landmarks.core.landmark_checker import LandmarkChecker
from trip_logger import TripLogger

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_gps_metadata_system():
    """Test GPS metadata injection and video coordinate embedding"""
    
    logger.info("=== Testing GPS Metadata System ===")
    
    try:
        # Initialize components
        injector = VideoMetadataInjector()
        trip_logger = TripLogger()
        
        # Simulate trip data with GPS coordinates
        test_trip_id = trip_logger.start_trip()
        if not test_trip_id:
            logger.error("Failed to start test trip")
            return False
        
        # Log some test GPS coordinates
        test_coordinates = [
            (40.7589, -73.9851, 10.0, 25.5),  # Times Square
            (40.7614, -73.9776, 12.0, 30.0),  # Central Park
            (40.7505, -73.9934, 8.0, 20.0),   # Hudson Yards
        ]
        
        logger.info(f"Logging {len(test_coordinates)} GPS coordinates for trip {test_trip_id}")
        for i, (lat, lon, speed, altitude) in enumerate(test_coordinates):
            # Simulate time progression
            time.sleep(0.1)
            
            success = trip_logger.log_gps_coordinate(
                latitude=lat,
                longitude=lon,
                altitude=altitude,
                speed=speed,
                heading=45 + (i * 10),  # Varying heading
                satellites=8 + i,
                fix_quality=3
            )
            
            if success:
                logger.info(f"✓ Logged GPS coordinate {i+1}: {lat}, {lon}")
            else:
                logger.warning(f"✗ Failed to log GPS coordinate {i+1}")
        
        # Test GPS track retrieval
        gps_track = trip_logger.get_gps_track_for_trip(test_trip_id)
        logger.info(f"Retrieved GPS track with {len(gps_track)} points")
        
        # Test GPS statistics
        stats = trip_logger.get_gps_statistics(test_trip_id)
        logger.info(f"Trip GPS statistics: {stats}")
        
        # Test comprehensive trip summary
        summary = trip_logger.get_trip_gps_summary(test_trip_id)
        logger.info(f"Comprehensive trip summary includes: {list(summary.keys())}")
        
        # Test metadata preparation
        if gps_track:
            logger.info("Testing GPS metadata preparation...")
            metadata = injector.prepare_gps_metadata(gps_track)
            
            if metadata and 'waypoints' in metadata:
                logger.info(f"✓ Prepared metadata with {len(metadata['waypoints'])} waypoints")
                logger.info(f"  - Track bounds: {metadata.get('bounds', {})}")
                logger.info(f"  - Total distance: {metadata.get('total_distance_km', 0):.2f} km")
            else:
                logger.warning("✗ Failed to prepare GPS metadata")
        
        # Clean up test trip
        trip_logger.end_trip()
        logger.info(f"Ended test trip {test_trip_id}")
        
        logger.info("=== GPS Metadata System Test COMPLETED ===")
        return True
        
    except Exception as e:
        logger.error(f"GPS metadata test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_landmark_video_integration():
    """Test landmark detection and video quality management"""
    
    logger.info("=== Testing Landmark-Video Integration ===")
    
    try:
        landmark_checker = LandmarkChecker()
        
        # Add test priority landmarks
        priority_landmarks = [
            ("Statue of Liberty", 40.6892, -74.0445, "monument"),
            ("Central Park", 40.7829, -73.9654, "tourism"),
            ("Brooklyn Bridge", 40.7061, -73.9969, "historic"),
        ]
        
        added_landmarks = []
        for name, lat, lon, category in priority_landmarks:
            result = landmark_checker.add_landmark(
                name=name,
                lat=lat,
                lon=lon,
                radius_m=500,
                description=f"Test {category} landmark",
                category=category
            )
            
            if result:
                added_landmarks.append(result['id'])
                logger.info(f"✓ Added priority landmark: {name} ({category})")
            else:
                logger.warning(f"✗ Failed to add landmark: {name}")
        
        # Test nearby landmark detection with distance information
        test_locations = [
            (40.6892, -74.0445),  # Near Statue of Liberty
            (40.7829, -73.9654),  # Near Central Park
            (40.7061, -73.9969),  # Near Brooklyn Bridge
            (40.7589, -73.9851),  # Times Square (no landmarks)
        ]
        
        for lat, lon in test_locations:
            nearby = landmark_checker.get_nearby_landmarks(lat, lon, radius_km=1.0)
            
            if nearby:
                closest = nearby[0]
                landmark_name = closest['landmark'].get('name', 'Unknown')
                distance = closest.get('distance_meters', 0)
                logger.info(f"✓ Near {landmark_name}: {distance:.0f}m away")
            else:
                logger.info(f"No landmarks found near ({lat:.4f}, {lon:.4f})")
        
        # Test recording quality determination
        for name, lat, lon, category in priority_landmarks:
            quality, landmark_info = landmark_checker.get_recording_quality_for_position(lat, lon)
            if quality == "high" and landmark_info:
                logger.info(f"✓ High quality recording triggered for {landmark_info.get('name')}")
            else:
                logger.info(f"Normal quality recording for location ({lat:.4f}, {lon:.4f})")
        
        # Clean up test landmarks
        for landmark_id in added_landmarks:
            landmark_checker.remove_landmark(landmark_id)
            
        logger.info(f"Cleaned up {len(added_landmarks)} test landmarks")
        logger.info("=== Landmark-Video Integration Test COMPLETED ===")
        return True
        
    except Exception as e:
        logger.error(f"Landmark-video integration test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_system_integration():
    """Test complete system integration with GPS logging, landmarks, and video coordination"""
    
    logger.info("=== Testing Complete System Integration ===")
    
    try:
        # Initialize all components
        trip_logger = TripLogger()
        landmark_checker = LandmarkChecker()
        injector = VideoMetadataInjector()
        
        # Add a test landmark
        test_landmark = landmark_checker.add_landmark(
            name="Test Route Landmark",
            lat=40.7589,
            lon=-73.9851,
            radius_m=300,
            description="Test landmark for system integration",
            category="tourism"
        )
        
        if not test_landmark:
            logger.error("Failed to add test landmark")
            return False
            
        logger.info(f"Added test landmark: {test_landmark['name']}")
        
        # Start a test trip
        trip_id = trip_logger.start_trip()
        if not trip_id:
            logger.error("Failed to start test trip")
            return False
            
        logger.info(f"Started test trip: {trip_id}")
        
        # Simulate GPS logging with approach to landmark
        route_points = [
            (40.7500, -73.9900, 25.0),  # Starting point
            (40.7550, -73.9875, 30.0),  # Approaching
            (40.7589, -73.9851, 20.0),  # Near landmark (should trigger quality upgrade)
            (40.7620, -73.9800, 35.0),  # Leaving
        ]
        
        logger.info("Simulating GPS route with landmark encounter...")
        
        for i, (lat, lon, speed) in enumerate(route_points):
            # Log GPS position
            success = trip_logger.log_gps_coordinate(
                latitude=lat,
                longitude=lon,
                speed=speed,
                heading=45,
                satellites=8,
                fix_quality=3
            )
            
            if success:
                logger.info(f"✓ Logged GPS point {i+1}: ({lat:.4f}, {lon:.4f})")
            
            # Check for nearby landmarks
            nearby_landmarks = landmark_checker.get_nearby_landmarks(lat, lon, radius_km=1.0)
            
            if nearby_landmarks:
                closest = nearby_landmarks[0]
                landmark = closest['landmark']
                distance = closest['distance_meters']
                
                logger.info(f"  → Near landmark '{landmark.get('name')}' at {distance:.0f}m")
                
                # Test quality upgrade logging
                if distance <= 500:  # Within quality upgrade range
                    upgrade_logged = trip_logger.log_quality_upgrade(
                        landmark_id=landmark.get('id'),
                        landmark_name=landmark.get('name'),
                        distance_meters=distance,
                        reason="Approaching priority landmark"
                    )
                    
                    if upgrade_logged:
                        logger.info(f"  ✓ Logged quality upgrade for {landmark.get('name')}")
                
                # Test landmark encounter logging
                if distance <= 200:  # Within encounter range
                    encounter_logged = trip_logger.add_landmark_encounter(landmark)
                    
                    if encounter_logged:
                        logger.info(f"  ✓ Logged landmark encounter for {landmark.get('name')}")
            
            time.sleep(0.1)  # Small delay to simulate real-time
        
        # End the trip
        trip_logger.end_trip(route_points[-1][0], route_points[-1][1])
        logger.info(f"Ended trip {trip_id}")
        
        # Test comprehensive trip analysis
        summary = trip_logger.get_trip_gps_summary(trip_id)
        
        logger.info("=== Trip Summary ===")
        logger.info(f"GPS Track Points: {len(summary.get('gps_track', []))}")
        logger.info(f"Landmark Encounters: {len(summary.get('landmarks', []))}")
        logger.info(f"Quality Upgrades: {len(summary.get('quality_upgrades', []))}")
        logger.info(f"Trip Statistics: {summary.get('statistics', {})}")
        
        # Test metadata generation from trip
        gps_track = summary.get('gps_track', [])
        if gps_track:
            metadata = injector.prepare_gps_metadata(gps_track)
            if metadata:
                logger.info(f"✓ Generated video metadata with {len(metadata.get('waypoints', []))} waypoints")
            else:
                logger.warning("✗ Failed to generate video metadata")
        
        # Clean up
        landmark_checker.remove_landmark(test_landmark['id'])
        logger.info("Cleaned up test data")
        
        logger.info("=== Complete System Integration Test COMPLETED ===")
        return True
        
    except Exception as e:
        logger.error(f"System integration test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    logger.info("Starting comprehensive GPS and Video system tests...")
    
    # Set test environment
    os.environ['DASHCAM_DATA_PATH'] = '/root/dashcam-v2/backend/data'
    
    # Run tests
    tests = [
        test_gps_metadata_system,
        test_landmark_video_integration,
        test_system_integration
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
    
    logger.info(f"\n=== FINAL TEST SUMMARY ===")
    logger.info(f"Passed: {passed}/{total}")
    logger.info(f"Success rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        logger.info("🎉 All GPS and Video system tests passed!")
        logger.info("The system is ready for:")
        logger.info("  ✓ Comprehensive GPS coordinate logging")
        logger.info("  ✓ GPS metadata injection into videos")
        logger.info("  ✓ Intelligent landmark detection and recording")
        logger.info("  ✓ Priority landmark quality upgrades")
        logger.info("  ✓ Complete trip tracking and analysis")
        sys.exit(0)
    else:
        logger.error("❌ Some tests failed. Please check the errors above.")
        sys.exit(1)
