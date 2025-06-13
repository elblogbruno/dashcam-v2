"""
API routes for Disk Space Monitor
Provides endpoints to control and monitor the disk space monitoring system.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging

from disk_space_monitor import get_disk_space_monitor, cleanup_disk_space_monitor

router = APIRouter()
logger = logging.getLogger(__name__)

class MonitorSettings(BaseModel):
    check_interval: Optional[int] = None
    enable_leds: Optional[bool] = None
    data_path: Optional[str] = None

class ThresholdSettings(BaseModel):
    critical: Optional[int] = None
    low: Optional[int] = None
    medium: Optional[int] = None

@router.get("/status")
async def get_monitor_status():
    """Get current disk space monitor status"""
    try:
        monitor = get_disk_space_monitor()
        status = monitor.get_status()
        
        # Also get current disk usage
        disk_usage = monitor.get_disk_usage()
        status['current_usage'] = disk_usage
        
        return status
    except Exception as e:
        logger.error(f"Error getting monitor status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start")
async def start_monitor(settings: Optional[MonitorSettings] = None):
    """Start the disk space monitor"""
    try:
        # Get or create monitor with optional settings
        if settings:
            monitor = get_disk_space_monitor(
                data_path=settings.data_path,
                check_interval=settings.check_interval or 30,
                enable_leds=settings.enable_leds if settings.enable_leds is not None else True
            )
        else:
            monitor = get_disk_space_monitor()
        
        monitor.start()
        
        return {
            "status": "success",
            "message": "Disk space monitor started",
            "monitor_status": monitor.get_status()
        }
    except Exception as e:
        logger.error(f"Error starting monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_monitor():
    """Stop the disk space monitor"""
    try:
        monitor = get_disk_space_monitor()
        monitor.stop()
        
        return {
            "status": "success",
            "message": "Disk space monitor stopped"
        }
    except Exception as e:
        logger.error(f"Error stopping monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restart")
async def restart_monitor(settings: Optional[MonitorSettings] = None):
    """Restart the disk space monitor with optional new settings"""
    try:
        # Stop current monitor
        monitor = get_disk_space_monitor()
        monitor.stop()
        
        # Clean up and create new instance with new settings if provided
        if settings:
            cleanup_disk_space_monitor()
            monitor = get_disk_space_monitor(
                data_path=settings.data_path,
                check_interval=settings.check_interval or 30,
                enable_leds=settings.enable_leds if settings.enable_leds is not None else True
            )
        
        # Start the monitor
        monitor.start()
        
        return {
            "status": "success",
            "message": "Disk space monitor restarted",
            "monitor_status": monitor.get_status()
        }
    except Exception as e:
        logger.error(f"Error restarting monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-leds")
async def test_leds():
    """Test all LED states"""
    try:
        monitor = get_disk_space_monitor()
        monitor.test_leds()
        
        return {
            "status": "success",
            "message": "LED test completed"
        }
    except Exception as e:
        logger.error(f"Error testing LEDs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-thresholds")
async def update_thresholds(thresholds: ThresholdSettings):
    """Update LED activation thresholds"""
    try:
        monitor = get_disk_space_monitor()
        monitor.update_thresholds(
            critical=thresholds.critical,
            low=thresholds.low,
            medium=thresholds.medium
        )
        
        return {
            "status": "success",
            "message": "Thresholds updated",
            "new_thresholds": monitor.thresholds
        }
    except Exception as e:
        logger.error(f"Error updating thresholds: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/disk-usage")
async def get_disk_usage():
    """Get current disk usage information"""
    try:
        monitor = get_disk_space_monitor()
        usage = monitor.get_disk_usage()
        
        return usage
    except Exception as e:
        logger.error(f"Error getting disk usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/thresholds")
async def get_thresholds():
    """Get current LED thresholds"""
    try:
        monitor = get_disk_space_monitor()
        return {
            "thresholds": monitor.thresholds,
            "description": {
                "critical": "Flash all LEDs red when free space < critical%",
                "low": "Light red LED when free space < low%", 
                "medium": "Light yellow LED when free space < medium%",
                "good": "Light green LED when free space >= medium%"
            }
        }
    except Exception as e:
        logger.error(f"Error getting thresholds: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/settings")
async def get_monitor_settings():
    """Get current monitor settings"""
    try:
        monitor = get_disk_space_monitor()
        status = monitor.get_status()
        
        return {
            "check_interval": status['check_interval'],
            "enable_leds": status['enable_leds'],
            "data_path": status['data_path'],
            "thresholds": status['thresholds'],
            "running": status['running']
        }
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))
