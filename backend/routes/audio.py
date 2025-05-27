from fastapi import APIRouter, HTTPException
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# This will be initialized from main.py
audio_notifier = None

@router.post("/test")
async def test_audio():
    """Test the audio system by playing a test sound"""
    if not audio_notifier:
        raise HTTPException(status_code=500, detail="Audio notifier not initialized")
    
    try:
        success = audio_notifier.test_audio()
        if success:
            return {"status": "success", "message": "Audio test initiated"}
        else:
            return {"status": "error", "message": "Failed to play test audio"}
    except Exception as e:
        logger.error(f"Error testing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error testing audio: {str(e)}")

@router.post("/notifications/test")
async def test_notification(
    message: str = "Esta es una notificación de prueba", 
    title: str = "Notificación de prueba",
    type: str = "info"
):
    """
    Endpoint de prueba para enviar notificaciones
    
    Args:
        message: El mensaje de la notificación
        title: El título de la notificación
        type: El tipo de notificación (info, success, error, warning)
    """
    if not audio_notifier:
        raise HTTPException(status_code=500, detail="Audio notifier not initialized")
    
    # Validar el tipo de notificación
    valid_types = ["info", "success", "error", "warning"]
    if type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid notification type. Must be one of: {', '.join(valid_types)}")
    
    try:
        # Solo enviar notificación visual, sin audio
        await audio_notifier._send_notification(
            message=message,
            title=title,
            notification_type=type
        )
        return {
            "status": "success", 
            "message": "Notification sent",
            "details": {
                "message": message,
                "title": title,
                "type": type
            }
        }
    except Exception as e:
        logger.error(f"Error sending test notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending test notification: {str(e)}")
        
@router.post("/notifications/announce")
async def test_notification_with_audio(
    message: str = "Esta es una notificación de prueba con audio", 
    title: str = "Notificación de prueba",
    type: str = "info"
):
    """
    Endpoint de prueba para enviar notificaciones con audio
    
    Args:
        message: El mensaje de la notificación
        title: El título de la notificación
        type: El tipo de notificación (info, success, error, warning)
    """
    if not audio_notifier:
        raise HTTPException(status_code=500, detail="Audio notifier not initialized")
    
    # Validar el tipo de notificación
    valid_types = ["info", "success", "error", "warning"]
    if type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid notification type. Must be one of: {', '.join(valid_types)}")
    
    try:
        # Enviar notificación visual y audio
        audio_notifier.announce(
            text=message,
            title=title,
            notification_type=type,
            send_notification=True
        )
        return {
            "status": "success", 
            "message": "Notification with audio sent",
            "details": {
                "message": message,
                "title": title,
                "type": type
            }
        }
    except Exception as e:
        logger.error(f"Error sending test notification with audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending test notification with audio: {str(e)}")