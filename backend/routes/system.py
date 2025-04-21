from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from typing import Dict, List, Optional
from pydantic import BaseModel
import os
import cv2
import base64
import threading
import tempfile
from pathlib import Path
import time
import json
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# These will be initialized from main.py
camera_manager = None
gps_reader = None

# Get system status endpoint
@router.get("/status")
async def get_system_status():
    """Get the status of the system, including camera availability"""
    camera_status = {
        "road_camera": camera_manager.road_camera is not None,
        "interior_camera": camera_manager.interior_camera is not None,
        "errors": getattr(camera_manager, "camera_errors", [])
    }
    return {
        "camera_status": camera_status,
        "gps_available": gps_reader.is_available() if hasattr(gps_reader, "is_available") else True,
        "recording": False  # This will be set by main.py
    }

# Get current GPS location
@router.get("/gps")
async def get_gps():
    """Get current GPS coordinates and speed"""
    location = gps_reader.get_location()
    if not location:
        return {"lat": 0.0, "lon": 0.0, "speed": 0.0, "available": False}
    
    location["available"] = True
    return location

class CameraTestRequest(BaseModel):
    camera_path: str

# Detect available cameras
@router.get("/cameras")
async def detect_cameras():
    """Detect all available camera devices connected to the system"""
    available_cameras = []
    
    try:
        # Try multiple methods to detect cameras
        # Method 1: Check /dev/video* devices (Linux)
        if os.path.exists('/dev'):
            video_devices = [d for d in os.listdir('/dev') if d.startswith('video')]
            
            for device in video_devices:
                device_path = f"/dev/{device}"
                device_id = int(device.replace('video', ''))
                
                # Try to open the camera to check if it's available
                cap = cv2.VideoCapture(device_id)  # Use device ID instead of path for better compatibility
                
                # Skip device if it can't be opened (might be in use by another process)
                if not cap.isOpened():
                    cap.release()
                    continue
                
                # Get camera properties
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30  # Default to 30 if fps detection fails
                
                # Try to get camera name/description
                camera_name = get_camera_name(device_path)
                
                # Take a test frame to validate the camera works
                ret, frame = cap.read()
                
                # Check if camera actually works and produced a valid frame
                if ret and frame is not None and frame.size > 0:
                    # Try to detect if this is a USB camera vs built-in
                    camera_type = "USB" if device_id > 0 else "Built-in"
                    
                    # Check if this is a virtual camera (often used by webcam software)
                    if camera_name and any(v in camera_name.lower() for v in ["virtual", "dummy", "emulated"]):
                        camera_type = "Virtual"
                    
                    available_cameras.append({
                        "device": device_path,
                        "device_id": device_id,
                        "name": camera_name or f"Camera {device}",
                        "resolution": f"{width}x{height}",
                        "fps": fps,
                        "type": camera_type,
                        "working": True
                    })
                else:
                    # Add to list but mark as not working
                    available_cameras.append({
                        "device": device_path,
                        "device_id": device_id,
                        "name": camera_name or f"Camera {device}",
                        "resolution": "Unknown",
                        "type": "Unknown",
                        "working": False
                    })
                
                # Release the camera
                cap.release()
        
        # Method 2: Try to detect direct device indices for other platforms
        # Try the first few indices (0-5) which are typically used for camera devices
        for idx in range(6):
            # Skip indices we've already checked via /dev/video* method
            if any(cam.get("device_id") == idx for cam in available_cameras):
                continue
                
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                # Get camera properties
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
                
                # Take a test frame
                ret, frame = cap.read()
                
                if ret and frame is not None and frame.size > 0:
                    # Determine camera type based on index
                    camera_type = "Built-in" if idx == 0 else "USB"
                    
                    available_cameras.append({
                        "device": f"Camera index {idx}",
                        "device_id": idx,
                        "name": f"Camera {idx}",
                        "resolution": f"{width}x{height}",
                        "fps": fps,
                        "type": camera_type,
                        "working": True
                    })
                
                cap.release()
        
        # Sort cameras by device ID for consistent ordering
        available_cameras.sort(key=lambda x: x["device_id"])
        
        # Add labels to help identify cameras
        for i, camera in enumerate(available_cameras):
            if camera["working"]:
                if i == 0 and "built-in" in camera["type"].lower():
                    camera["suggested_use"] = "Interior (facing driver)"
                elif i == 0:
                    camera["suggested_use"] = "Road (front-facing)"
                elif i == 1:
                    camera["suggested_use"] = "Interior (facing driver)" if "road" in available_cameras[0].get("suggested_use", "").lower() else "Road (front-facing)"
            
        return {
            "cameras": available_cameras,
            "detection_method": "hybrid" if os.path.exists('/dev') else "index_based"
        }
        
    except Exception as e:
        logger.error(f"Error detecting cameras: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error detecting cameras: {str(e)}")

# Test a specific camera
@router.post("/test-camera")
async def test_camera(request: CameraTestRequest):
    """Test a specific camera and return a preview image"""
    if not request.camera_path:
        raise HTTPException(status_code=400, detail="Camera path is required")
    
    try:
        # Handle both device paths (/dev/videoX) and numeric indices
        camera_id = request.camera_path
        if request.camera_path.startswith('/dev/video'):
            try:
                # Extract numeric ID from path
                camera_id = int(request.camera_path.replace('/dev/video', ''))
            except ValueError:
                # Fallback to path if conversion fails
                camera_id = request.camera_path
                
        # Try to open the camera using the device ID first (more reliable)
        if isinstance(camera_id, int):
            cap = cv2.VideoCapture(camera_id)
        else:
            # Fallback to path if needed
            if not os.path.exists(request.camera_path):
                raise HTTPException(status_code=404, detail=f"Camera not found: {request.camera_path}")
            cap = cv2.VideoCapture(request.camera_path)
            
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Failed to open camera")
        
        # Some cameras need a few frames to "warm up"
        for _ in range(5):
            cap.read()
            time.sleep(0.1)
        
        # Read multiple frames (some cameras need a moment to adjust exposure/focus)
        frames = []
        for _ in range(3):
            ret, frame = cap.read()
            if ret and frame is not None and frame.size > 0:
                frames.append(frame)
            time.sleep(0.1)
            
        if not frames:
            cap.release()
            raise HTTPException(status_code=400, detail="Failed to capture image from camera")
            
        # Use the last frame (likely to have better exposure)
        frame = frames[-1]
        
        # Create a temporary file to store the image
        _, temp_image_path = tempfile.mkstemp(suffix='.jpg')
        
        # Save the frame as JPEG with quality setting
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 85]
        cv2.imwrite(temp_image_path, frame, encode_params)
        
        # Get basic camera info
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
        
        # Generate a preview URL
        preview_url = f"/api/system/preview/{os.path.basename(temp_image_path)}"
        
        # Release the camera
        cap.release()
        
        return {
            "success": True,
            "preview_url": preview_url,
            "temp_file": temp_image_path,
            "width": width,
            "height": height,
            "fps": fps
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing camera: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error testing camera: {str(e)}")

# Helper to serve the preview image
@router.get("/preview/{filename}")
async def get_preview(filename: str):
    """Serve a camera preview image"""
    # Find the temporary file
    temp_dir = tempfile.gettempdir()
    image_path = os.path.join(temp_dir, filename)
    
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Preview image not found")
    
    # Read the image file
    with open(image_path, "rb") as f:
        image_data = f.read()
    
    # Return the image as base64 data URI
    import base64
    image_base64 = base64.b64encode(image_data).decode("utf-8")
    return {"image_data_uri": f"data:image/jpeg;base64,{image_base64}"}

# Helper function to get camera name using v4l2-ctl if available
def get_camera_name(device_path):
    try:
        # Method 1: Use v4l2-ctl if available (Linux)
        try:
            import subprocess
            result = subprocess.run(
                ["v4l2-ctl", "--device", device_path, "--all"], 
                capture_output=True, 
                text=True,
                timeout=2  # Add timeout to prevent hanging
            )
            
            if result.returncode == 0:
                # Look for card type or driver name
                card_type = None
                driver_name = None
                
                for line in result.stdout.split('\n'):
                    if "Card type" in line:
                        card_type = line.split(':')[1].strip()
                    elif "Driver name" in line:
                        driver_name = line.split(':')[1].strip()
                
                # Prefer card type, fall back to driver name
                if card_type and not card_type.lower() in ["unknown", "default"]:
                    return card_type
                elif driver_name:
                    return f"{driver_name} camera"
        except (subprocess.SubprocessError, FileNotFoundError, TimeoutError):
            pass
            
        # Method 2: Check udev properties (Linux)
        try:
            import pyudev
            context = pyudev.Context()
            
            # Extract device number from path
            device_num = device_path.replace('/dev/video', '')
            
            for device in context.list_devices(subsystem='video4linux'):
                if device.device_node == device_path:
                    # Try different properties that might contain the name
                    for prop in ['ID_MODEL', 'ID_MODEL_FROM_DATABASE', 'ID_VENDOR_ENC', 'ID_VENDOR']:
                        if prop in device:
                            name = device.get(prop)
                            if name and name.strip():
                                return name.strip()
            
        except (ImportError, Exception):
            pass
            
        # No name could be determined
        return None
        
    except Exception:
        # If all methods fail, return None and use default name
        return None