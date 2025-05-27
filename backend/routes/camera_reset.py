from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Estas variables serán inicializadas desde main.py
camera_manager = None

@router.post("/api/cameras/reset/{camera_type}", response_model=Dict[str, Any])
async def reset_camera(camera_type: str):
    """
    Reinicia una cámara específica o ambas
    
    Args:
        camera_type: 'road', 'interior' o 'all'
    
    Returns:
        Dict con estado de la operación
    """
    if camera_manager is None:
        raise HTTPException(status_code=500, detail="Camera manager not initialized")
    
    try:
        if camera_type == "road":
            success = camera_manager.reinitialize_camera("road")
            message = "Road camera reinitialized" if success else "Failed to reinitialize road camera"
        elif camera_type == "interior":
            success = camera_manager.reinitialize_camera("interior")
            message = "Interior camera reinitialized" if success else "Failed to reinitialize interior camera"
        elif camera_type == "all":
            road_success = camera_manager.reinitialize_camera("road")
            interior_success = camera_manager.reinitialize_camera("interior")
            success = road_success and interior_success
            message = f"Road camera: {'OK' if road_success else 'Failed'}, Interior camera: {'OK' if interior_success else 'Failed'}"
        else:
            raise HTTPException(status_code=400, detail="Invalid camera type. Must be 'road', 'interior' or 'all'")
        
        return {
            "status": "success" if success else "error",
            "message": message,
            "camera_type": camera_type
        }
    except Exception as e:
        logger.error(f"Error resetting camera {camera_type}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error resetting camera: {str(e)}")
