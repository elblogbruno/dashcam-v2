from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
import os
import json
import logging
from settings_manager import settings_manager

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# These will be initialized from main.py
config = None

# Get video settings
@router.get("/video")
async def get_video_settings():
    """Get the current video recording settings"""
    try:
        return settings_manager.get_settings("video")
    except Exception as e:
        logger.error(f"Error getting video settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get video settings: {str(e)}")

# Update video settings
@router.post("/video")
async def update_video_settings(settings: Dict[str, Any]):
    """Update video recording settings"""
    try:
        # Validate required fields
        required_fields = ["roadQuality", "interiorQuality", "autoStartRecording"]
        for field in required_fields:
            if field not in settings:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Update settings using the settings manager
        success = settings_manager.update_settings("video", settings)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update video settings")
            
        return {"status": "success", "message": "Video settings updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating video settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update video settings: {str(e)}")

# Get audio settings
@router.get("/audio")
async def get_audio_settings():
    """Get the current audio notification settings"""
    try:
        return settings_manager.get_settings("audio")
    except Exception as e:
        logger.error(f"Error getting audio settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get audio settings: {str(e)}")

# Update audio settings
@router.post("/audio")
async def update_audio_settings(settings: Dict[str, Any]):
    """Update audio notification settings"""
    try:
        # Validate required fields
        required_fields = ["enabled", "volume"]
        for field in required_fields:
            if field not in settings:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Update settings using the settings manager
        success = settings_manager.update_settings("audio", settings)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update audio settings")
            
        return {"status": "success", "message": "Audio settings updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating audio settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update audio settings: {str(e)}")

# Get WiFi settings
@router.get("/wifi")
async def get_wifi_settings():
    """Get the current WiFi hotspot settings"""
    try:
        return settings_manager.get_settings("wifi")
    except Exception as e:
        logger.error(f"Error getting WiFi settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get WiFi settings: {str(e)}")

# Update WiFi settings
@router.post("/wifi")
async def update_wifi_settings(settings: Dict[str, Any]):
    """Update WiFi hotspot settings"""
    try:
        # Validate required fields
        required_fields = ["ssid", "enabled"]
        for field in required_fields:
            if field not in settings:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Update settings using the settings manager
        success = settings_manager.update_settings("wifi", settings)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update WiFi settings")
            
        return {"status": "success", "message": "WiFi settings updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating WiFi settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update WiFi settings: {str(e)}")