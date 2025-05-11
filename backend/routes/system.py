import psutil
import platform
import datetime
import subprocess
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

def get_system_stats():
    """Get detailed system statistics including CPU, memory, temperature and storage"""
    try:
        # Get CPU usage percentage
        cpu_usage = psutil.cpu_percent(interval=0.1)
        
        # Get memory usage information
        memory = psutil.virtual_memory()
        memory_usage = memory.percent
        
        # Get storage information for the root filesystem
        disk = psutil.disk_usage('/')
        storage = {
            "total": disk.total,
            "available": disk.free,
            "used": disk.used,
            "percent_used": disk.percent
        }
        
        # Get system uptime
        uptime_seconds = time.time() - psutil.boot_time()
        
        def format_uptime(seconds):
            """Format uptime in human-readable format"""
            days, seconds = divmod(seconds, 86400)
            hours, seconds = divmod(seconds, 3600)
            minutes, seconds = divmod(seconds, 60)
            
            if days > 0:
                return f"{int(days)}d {int(hours)}h {int(minutes)}m"
            elif hours > 0:
                return f"{int(hours)}h {int(minutes)}m"
            else:
                return f"{int(minutes)}m {int(seconds)}s"
        
        # Format uptime
        uptime = format_uptime(uptime_seconds)
        
        # Try to get CPU temperature (works on Raspberry Pi)
        cpu_temp = 0
        throttling = False
        throttling_reason = ""
        
        # Method 1: Try vcgencmd for Raspberry Pi
        try:
            temp_output = subprocess.check_output(['vcgencmd', 'measure_temp'], universal_newlines=True)
            cpu_temp = float(temp_output.replace('temp=', '').replace('\'C', ''))
            
            # Check for throttling status on Raspberry Pi
            throttle_output = subprocess.check_output(['vcgencmd', 'get_throttled'], universal_newlines=True)
            throttle_value = int(throttle_output.split('=')[1], 16)
            
            # Check specific bits for throttling states
            # See: https://www.raspberrypi.org/documentation/raspbian/applications/vcgencmd.md
            throttling = throttle_value > 0
            
            # Decode throttling reasons if throttling is active
            if throttling:
                reasons = []
                
                # Current throttling states
                if throttle_value & 0x1:
                    reasons.append("Temperatura límite bajo-voltaje")
                if throttle_value & 0x2:
                    reasons.append("Frenado por temperatuta")
                if throttle_value & 0x4:
                    reasons.append("Frenado por bajo-voltaje")
                
                # Previous throttling states
                if throttle_value & 0x10000:
                    reasons.append("Temperatura límite bajo-voltaje detectada")
                if throttle_value & 0x20000:
                    reasons.append("Frenado por temperatura detectado")
                if throttle_value & 0x40000:
                    reasons.append("Frenado por bajo-voltaje detectado")
                
                throttling_reason = ", ".join(reasons)
        except (subprocess.SubprocessError, FileNotFoundError, ValueError):
            # Not a Raspberry Pi or vcgencmd not available
            pass
        
        # Method 2: Try reading from thermal zones (Linux)
        if cpu_temp == 0:
            try:
                for i in range(10):  # Check up to 10 thermal zones
                    thermal_zone = f"/sys/class/thermal/thermal_zone{i}/temp"
                    if os.path.exists(thermal_zone):
                        with open(thermal_zone, 'r') as f:
                            temp = int(f.read().strip()) / 1000.0
                            if temp > 0:  # Valid temperature
                                cpu_temp = temp
                                break
            except (OSError, ValueError):
                pass
        
        # Method 3: Try psutil for CPU temperature (cross-platform)
        if cpu_temp == 0 and hasattr(psutil, "sensors_temperatures"):
            try:
                temps = psutil.sensors_temperatures()
                if temps:
                    for name, entries in temps.items():
                        for entry in entries:
                            if entry.current > 0:
                                cpu_temp = entry.current
                                break
                        if cpu_temp > 0:
                            break
            except (AttributeError, KeyError):
                pass
        
        # Detect system throttling based on high resource usage if not detected by vcgencmd
        if not throttling:
            reasons = []
            if cpu_usage > 90:
                reasons.append("CPU sobrecargada")
                throttling = True
            if memory_usage > 90:
                reasons.append("Memoria agotada")
                throttling = True
            if cpu_temp > 80:
                reasons.append("Temperatura crítica")
                throttling = True
                
            if reasons:
                throttling_reason = ", ".join(reasons)
        
        # Get system version
        try:
            with open('/etc/os-release', 'r') as f:
                os_info = {}
                for line in f:
                    if '=' in line:
                        key, value = line.strip().split('=', 1)
                        os_info[key] = value.strip('"')
            
            version = f"{os_info.get('NAME', 'Linux')} {os_info.get('VERSION', '')}"
        except (FileNotFoundError, KeyError):
            version = platform.platform()
        
        return {
            "cpu_usage": round(cpu_usage, 1),
            "memory_usage": round(memory_usage, 1),
            "cpu_temp": round(cpu_temp, 1),
            "storage": storage,
            "uptime": uptime,
            "version": version,
            "throttling": throttling,
            "throttling_reason": throttling_reason,
            "timestamp": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        return {
            "cpu_usage": 0,
            "memory_usage": 0,
            "cpu_temp": 0,
            "storage": {
                "total": 0,
                "available": 0,
                "used": 0,
                "percent_used": 0
            },
            "uptime": "Error",
            "version": "Unknown",
            "error": str(e)
        }

# Get system status endpoint
@router.get("/status")
async def get_system_status():
    """Get the status of the system, including camera availability and system statistics"""
    # Get camera status
    camera_status = {
        "road_camera": camera_manager.road_camera is not None,
        "interior_camera": camera_manager.interior_camera is not None,
        "errors": getattr(camera_manager, "camera_errors", [])
    }
    
    # Get detailed system statistics
    system_stats = get_system_stats()
    
    return {
        "camera_status": camera_status,
        "gps_available": gps_reader.is_available() if hasattr(gps_reader, "is_available") else True,
        "recording": False,  # This will be set by main.py
        "system_stats": system_stats
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
        # Obtener configuración actual de cámaras si está disponible
        current_road_camera = None
        current_interior_camera = None
        if camera_manager:
            # Guardar las configuraciones de cámaras actuales
            current_road_camera = getattr(camera_manager, 'road_camera_path', None)
            current_interior_camera = getattr(camera_manager, 'interior_camera_path', None)
            logger.info(f"Configuración actual - Road: {current_road_camera}, Interior: {current_interior_camera}")
        
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
        
        # Add labels para ayudar a identificar cámaras (conservando configuración actual)
        for i, camera in enumerate(available_cameras):
            if camera["working"]:
                # Marcar como cámara actual si corresponde
                if current_road_camera and camera["device"] == current_road_camera:
                    camera["suggested_use"] = "Road (front-facing)"
                    camera["current_use"] = "road"
                elif current_interior_camera and camera["device"] == current_interior_camera:
                    camera["suggested_use"] = "Interior (facing driver)"
                    camera["current_use"] = "interior"
                # Si no hay configuración actual, recomendar basado en el tipo/índice
                elif not camera.get("suggested_use"):
                    if i == 0 and "built-in" in camera["type"].lower():
                        camera["suggested_use"] = "Interior (facing driver)"
                    elif i == 0:
                        camera["suggested_use"] = "Road (front-facing)"
                    elif i == 1:
                        camera["suggested_use"] = "Interior (facing driver)" if "road" in available_cameras[0].get("suggested_use", "").lower() else "Road (front-facing)"
            
        return {
            "cameras": available_cameras,
            "detection_method": "hybrid" if os.path.exists('/dev') else "index_based",
            "current_config": {
                "road_camera": current_road_camera,
                "interior_camera": current_interior_camera
            }
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