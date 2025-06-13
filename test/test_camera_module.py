import cv2
import time
import logging
import sys
import os

from backend.cameras.road_camera import RoadCamera

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Import our camera module
from backend.cameras.interior_camera import InteriorCamera

def test_interior_camera():
    logger.info("Testing interior camera module...")
    
    # Create camera instance
    # camera = InteriorCamera(device_path="0")  # Use index 0 directly
    camera = RoadCamera()
    # Initialize camera
    if not camera.initialize():
        logger.error("Failed to initialize camera")
        return False
    
    logger.info("Camera initialized successfully")
    
    # Test capturing frames
    for i in range(10):
        logger.info(f"Capturing frame {i+1}/10")
        frame = camera.capture_frame()
        
        if frame is not None:
            logger.info(f"Frame captured: shape={frame.shape}")
            
            # Display frame
            cv2.imshow('Camera Test', frame)
            cv2.waitKey(100)
        else:
            logger.error(f"Failed to capture frame {i+1}")
        
        time.sleep(0.5)
    
    # Clean up
    camera.release()
    cv2.destroyAllWindows()
    logger.info("Test completed")
    return True

if __name__ == "__main__":
    test_interior_camera()
