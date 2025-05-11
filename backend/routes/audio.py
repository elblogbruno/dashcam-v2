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