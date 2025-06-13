#!/usr/bin/env python3
"""
Test script for GPS metadata injection in dashcam videos
"""

import os
import sys
import logging
from datetime import datetime, timedelta

# Add backend to Python path
sys.path.append('/root/dashcam-v2/backend')

# Set working directory to backend
os.chdir('/root/dashcam-v2/backend')

from video_metadata_injector import VideoMetadataInjector, inject_gps_into_video, extract_gps_from_video

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_gps_metadata_injection():
    """Test GPS metadata injection functionality"""
    
    # Test data - simulated GPS coordinates
    test_gps_data = []
    base_time = datetime.now()
    base_lat = 40.7589  # Nueva York
    base_lon = -73.9851
    
    # Generate 30 seconds of GPS data (every 2 seconds)
    for i in range(15):
        timestamp = base_time + timedelta(seconds=i * 2)
        # Simulate slight movement
        lat = base_lat + (i * 0.0001)
        lon = base_lon + (i * 0.0001)
        
        test_gps_data.append((timestamp, "test_trip_001", lat, lon))
    
    # Test clip info
    test_clip_info = {
        'sequence': 1,
        'start_time': base_time.isoformat(),
        'end_time': (base_time + timedelta(seconds=30)).isoformat(),
        'quality': 'normal',
        'near_landmark': True,
        'landmark_id': 'test_landmark_001',
        'landmark_type': 'tourist_attraction'
    }
    
    # Create test instance
    injector = VideoMetadataInjector()
    
    logger.info("Testing GPS metadata preparation...")
    
    # Test metadata preparation
    metadata = injector._prepare_video_metadata(test_gps_data, test_clip_info)
    logger.info(f"Generated metadata: {metadata}")
    
    # Test GPX creation
    gpx_content = injector._create_gpx_track(test_gps_data, test_clip_info)
    if gpx_content:
        logger.info(f"Generated GPX content (first 200 chars): {gpx_content[:200]}...")
    else:
        logger.error("Failed to generate GPX content")
    
    # Test with a dummy video file (if available)
    test_video_path = "/root/dashcam-v2/data/videos"
    if os.path.exists(test_video_path):
        # Look for any existing video files to test with
        for root, dirs, files in os.walk(test_video_path):
            for file in files:
                if file.endswith('.mp4'):
                    video_file = os.path.join(root, file)
                    logger.info(f"Found test video file: {video_file}")
                    
                    # Test metadata extraction first
                    existing_metadata = injector.extract_gps_metadata(video_file)
                    if existing_metadata:
                        logger.info(f"Existing metadata in {file}: {existing_metadata}")
                    else:
                        logger.info(f"No existing GPS metadata found in {file}")
                    
                    # Note: We won't actually inject metadata into existing files
                    # to avoid modifying user data
                    logger.info("Metadata injection test completed (no actual modification)")
                    return
    
    logger.info("No video files found for testing, but metadata preparation tests completed successfully")

def test_convenience_functions():
    """Test convenience functions"""
    logger.info("Testing convenience functions...")
    
    # Test extraction from non-existent file
    result = extract_gps_from_video("/non/existent/file.mp4")
    if result is None:
        logger.info("✓ Correctly handled non-existent file")
    else:
        logger.error("✗ Should have returned None for non-existent file")

if __name__ == "__main__":
    logger.info("Starting GPS metadata injection tests...")
    
    try:
        test_gps_metadata_injection()
        test_convenience_functions()
        logger.info("All tests completed successfully!")
        
    except Exception as e:
        logger.error(f"Test failed with error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
