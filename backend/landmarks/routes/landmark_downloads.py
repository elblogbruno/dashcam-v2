from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
import json
import logging
import math
import time
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel
import asyncio
from sse_starlette.sse import EventSourceResponse

# Import dependencies
from landmarks.services.landmark_optimization_service import LandmarkOptimizationService, OptimizationMetricsCollector
from landmarks.services.radius_optimizer import Waypoint as OptWaypoint, OptimizationResult
from landmarks.services.landmark_download_service import LandmarkDownloadService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize optimization services
optimization_service = None
metrics_collector = OptimizationMetricsCollector()
download_service = None

# Dictionary to store active landmark download processes and their progress
active_downloads = {}

# Global variables that will be initialized from main
landmark_checker = None
audio_notifier = None
settings_manager = None
planned_trips = []
save_trips_to_disk = None

router = APIRouter()

class Waypoint(BaseModel):
    lat: float
    lon: float
    name: Optional[str] = None

class LandmarkProgressUpdate(BaseModel):
    """Model for landmark download progress updates"""
    type: str  # 'progress', 'complete', 'error'
    progress: Optional[float] = None
    detail: Optional[str] = None
    message: Optional[str] = None

class LandmarkDownloadProgress(BaseModel):
    """Modelo detallado para el progreso de descarga de landmarks"""
    trip_id: str
    status: str  # 'started', 'processing_location', 'downloading_images', 'completed', 'error'
    current_location: Optional[str] = None
    location_index: int = 0
    total_locations: int = 0
    landmarks_found: int = 0
    landmarks_processed: int = 0
    images_downloaded: int = 0
    images_failed: int = 0
    current_landmark: Optional[str] = None
    progress_percent: float = 0.0
    estimated_time_remaining_min: Optional[float] = None
    download_speed_landmarks_per_min: Optional[float] = None
    error_message: Optional[str] = None
    optimization_used: bool = False
    optimization_efficiency: Optional[float] = None

def set_global_dependencies(landmark_checker_instance, audio_notifier_instance, settings_manager_instance, planned_trips_list=None, save_trips_func=None):
    """Set global dependencies from main module"""
    global landmark_checker, audio_notifier, settings_manager, planned_trips, save_trips_to_disk, download_service
    landmark_checker = landmark_checker_instance
    audio_notifier = audio_notifier_instance
    settings_manager = settings_manager_instance
    if planned_trips_list is not None:
        planned_trips = planned_trips_list
    if save_trips_func is not None:
        save_trips_to_disk = save_trips_func
    
    # Initialize download service
    download_service = LandmarkDownloadService(
        landmark_checker=landmark_checker,
        audio_notifier=audio_notifier,
        settings_manager=settings_manager
    )
    download_service.active_downloads = active_downloads

async def get_landmark_settings():
    """Get landmark settings from persistence manager"""
    if download_service:
        return await download_service.get_landmark_settings()
    else:
        # Fallback if service not initialized
        if settings_manager:
            return settings_manager.get_settings("landmarks")
        else:
            from data_persistence import get_persistence_manager
            persistence = get_persistence_manager()
            return persistence.load_json('landmark_settings.json', 
                                       subdirectory='settings', 
                                       default={})

def find_trip_by_id(trip_id: str):
    """Find a planned trip by ID"""
    for trip in planned_trips:
        if getattr(trip, 'id', None) == trip_id:
            return trip
    return None

def detect_trip_type(waypoints):
    """Detect the type of trip based on waypoint distribution"""
    if len(waypoints) < 2:
        return "single_point"
    
    if len(waypoints) == 2:
        return "point_to_point"
    
    # Simple heuristic: if waypoints form a loop (start and end are close), it's a loop
    start = waypoints[0]
    end = waypoints[-1]
    distance = math.sqrt((start['lat'] - end['lat'])**2 + (start['lon'] - end['lon'])**2)
    
    if distance < 0.1:  # Less than ~11km
        return "loop"
    else:
        return "multi_point"

# Placeholder functions that will be implemented using the download service
async def download_trip_landmarks_with_progress(trip, radius_km: int, trip_id: str):
    """Download landmarks with progress tracking"""
    if download_service:
        await download_service.download_trip_landmarks_with_progress(
            trip, radius_km, trip_id, planned_trips, save_trips_to_disk
        )
    else:
        logger.error("Download service not initialized")

async def download_trip_landmarks_enhanced_with_progress(trip, trip_id: str, use_optimization: bool):
    """Download landmarks with enhanced progress tracking"""
    # For now, use the standard download method
    # In the future, this could implement optimization-specific features
    if download_service:
        settings = await download_service.get_landmark_settings()
        radius_km = settings.get('download_radius_km', 5)
        await download_service.download_trip_landmarks_with_progress(
            trip, radius_km, trip_id, planned_trips, save_trips_to_disk
        )
    else:
        logger.error("Download service not initialized")

@router.post("/{trip_id}/optimize-landmarks-radius")
async def optimize_landmarks_radius(trip_id: str, optimization_config: Optional[dict] = None):
    """Optimize landmark download radius for a trip using advanced geometric algorithms"""
    import time
    start_time = time.time()
    
    global optimization_service
    
    # Initialize optimization service if not already done
    if optimization_service is None:
        settings = await get_landmark_settings()
        optimization_service = LandmarkOptimizationService({
            'min_radius_km': float(settings.get('download_radius_km', 5)) * 0.4,  # 40% of default as minimum
            'max_radius_km': float(settings.get('download_radius_km', 5)) * 2.5,   # 250% of default as maximum
            'overlap_tolerance': 0.15,  # 15% overlap tolerance
        })
    
    # Find the planned trip
    trip = find_trip_by_id(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    try:
        # Convert trip waypoints to optimization format
        waypoints_for_optimization = []
        
        # Add start location
        waypoints_for_optimization.append({
            'lat': trip.start_location['lat'],
            'lon': trip.start_location['lon'],
            'name': getattr(trip, 'origin_name', None) or 'Start Location'
        })
        
        # Add waypoints
        if hasattr(trip, 'waypoints') and trip.waypoints:
            for i, wp in enumerate(trip.waypoints):
                waypoints_for_optimization.append({
                    'lat': wp.lat,
                    'lon': wp.lon,
                    'name': getattr(wp, 'name', None) or f'Waypoint {i+1}'
                })
        
        # Add end location
        waypoints_for_optimization.append({
            'lat': trip.end_location['lat'],
            'lon': trip.end_location['lon'],
            'name': getattr(trip, 'destination_name', None) or 'Destination'
        })
        
        # Detect trip type based on waypoint distribution
        trip_type = detect_trip_type(waypoints_for_optimization)
        
        # Execute optimization
        optimization_result = optimization_service.optimize_trip_landmarks(
            waypoints_for_optimization, 
            trip_type
        )
        
        # Calculate execution time and record metrics
        execution_time_ms = (time.time() - start_time) * 1000
        
        if optimization_result.get('success'):
            # Record metrics for analytics
            from landmarks.services.radius_optimizer import OptimizationResult
            opt_result = OptimizationResult(
                optimized_circles=[],  # Simplified for metrics
                total_coverage_area=optimization_result['optimization_summary']['total_coverage_area_km2'],
                total_overlap_area=optimization_result['optimization_summary']['total_overlap_area_km2'],
                efficiency_ratio=optimization_result['optimization_summary']['efficiency_ratio'],
                waypoints_covered=optimization_result['optimization_summary']['waypoints_covered'],
                avg_radius=optimization_result['optimization_summary']['avg_radius_km'],
                recommendations=optimization_result['recommendations']
            )
            
            metrics_collector.record_optimization_metrics(
                opt_result, execution_time_ms, trip_type
            )
        
        # Add execution metrics to response
        optimization_result['execution_metrics'] = {
            'execution_time_ms': round(execution_time_ms, 2),
            'trip_type_detected': trip_type,
            'waypoints_processed': len(waypoints_for_optimization)
        }
        
        logger.info(f"Optimization completed for trip {trip_id} in {execution_time_ms:.2f}ms")
        return optimization_result
        
    except Exception as e:
        logger.error(f"Error optimizing landmarks radius for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@router.post("/{trip_id}/download-landmarks-optimized")
async def download_landmarks_optimized(trip_id: str, background_tasks: BackgroundTasks, 
                                     use_optimization: bool = True, notify: bool = True):
    """Download landmarks using optimized radius configuration"""
    # Find the planned trip
    trip = find_trip_by_id(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    # Reject if there is already an active download for this trip
    if trip_id in active_downloads:
        return {
            "status": "in_progress",
            "message": "Landmark download already in progress"
        }
    
    try:
        # Get landmark settings for default radius
        settings = await get_landmark_settings()
        radius_km = settings.get('download_radius_km', 5)
        
        # Notify user about optimized download start
        if notify and audio_notifier:
            audio_notifier.announce(
                f"Iniciando descarga optimizada de puntos de interés para el viaje {getattr(trip, 'name', 'sin nombre')}",
                title="Descarga Optimizada Iniciada",
                notification_type="info",
                send_notification=True
            )
        
        # Initialize progress tracker for this download
        active_downloads[trip_id] = {
            "progress": 0,
            "detail": "Starting optimized download...",
            "status": "in_progress",
            "optimization_used": use_optimization
        }
        
        # Start optimized download in background
        background_tasks.add_task(
            download_trip_landmarks_enhanced_with_progress,
            trip,
            trip_id,
            use_optimization
        )
        
        return {
            "status": "success",
            "message": "Optimized landmark download started",
            "optimization_enabled": use_optimization
        }
        
    except Exception as e:
        logger.error(f"Error starting optimized landmark download: {str(e)}")
        # Clean up the active download entry
        if trip_id in active_downloads:
            del active_downloads[trip_id]
        raise HTTPException(status_code=500, detail=f"Failed to start optimized download: {str(e)}")

@router.get("/{trip_id}/optimization-analytics")
async def get_optimization_analytics(trip_id: str):
    """Get analytics about optimization performance"""
    try:
        analytics = metrics_collector.get_performance_analytics()
        return analytics
    except Exception as e:
        logger.error(f"Error getting optimization analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

@router.post("/{trip_id}/download-landmarks")
async def download_landmarks_for_trip(trip_id: str, background_tasks: BackgroundTasks, radius_km: int = 10, notify: bool = True):
    """Download landmarks for a planned trip route"""
    # Find the planned trip
    trip = find_trip_by_id(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    # Reject if there is already an active download for this trip
    if trip_id in active_downloads:
        return {
            "status": "in_progress",
            "message": "Landmark download already in progress"
        }
    
    try:
        # Notify user about download start
        if notify and audio_notifier:
            audio_notifier.announce(
                f"Iniciando descarga de puntos de interés para el viaje {getattr(trip, 'name', 'sin nombre')}",
                title="Descarga Iniciada",
                notification_type="info",
                send_notification=True
            )
            
        # Initialize progress tracker for this download
        active_downloads[trip_id] = {
            "progress": 0,
            "detail": "Starting download...",
            "status": "in_progress"
        }
        
        # Remove existing landmarks for this trip
        if landmark_checker:
            try:
                deleted_count = landmark_checker.remove_trip_landmarks(trip_id)
                logger.info(f"[LANDMARK_DOWNLOAD] Removed {deleted_count} existing landmarks for trip {trip_id}")
            except Exception as e:
                logger.error(f"[LANDMARK_DOWNLOAD] Error removing existing landmarks for trip {trip_id}: {str(e)}")
        
        # Run landmark download in the background with progress tracking
        background_tasks.add_task(
            download_trip_landmarks_with_progress, 
            trip, 
            radius_km,
            trip_id
        )
        
        return {
            "status": "success", 
            "message": "Downloading landmarks for trip (processing in background)",
        }
    
    except Exception as e:
        logger.error(f"Error downloading landmarks: {str(e)}")
        # Clean up the active download entry
        if trip_id in active_downloads:
            del active_downloads[trip_id]
        raise HTTPException(status_code=500, detail=f"Failed to download landmarks: {str(e)}")

@router.post("/{trip_id}/download-landmarks-enhanced")
async def download_landmarks_enhanced(trip_id: str, background_tasks: BackgroundTasks, 
                                    use_optimization: bool = True, notify: bool = True):
    """Download landmarks using enhanced method with granular progress tracking and configurable settings"""
    # Find the planned trip
    trip = find_trip_by_id(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    # Reject if there is already an active download for this trip
    if trip_id in active_downloads:
        return {
            "status": "in_progress",
            "message": "Landmark download already in progress"
        }
    
    try:
        # Get landmark settings
        landmark_settings = await get_landmark_settings()
        
        # Notify user about enhanced download start
        if notify and audio_notifier:
            download_type = "optimizada" if use_optimization and landmark_settings.get("enable_optimization", True) else "estándar"
            audio_notifier.announce(
                f"Iniciando descarga {download_type} de puntos de interés para el viaje {getattr(trip, 'name', 'sin nombre')}",
                title="Descarga Mejorada Iniciada",
                notification_type="info",
                send_notification=True
            )
        
        # Initialize enhanced progress tracker
        active_downloads[trip_id] = {
            "progress": 0,
            "detail": "Starting enhanced download...",
            "status": "in_progress",
            "enhanced_mode": True,
            "total_locations": 0,
            "current_location": None,
            "landmarks_found": 0,
            "landmarks_processed": 0,
            "images_downloaded": 0,
            "images_failed": 0,
            "optimization_used": use_optimization and landmark_settings.get("enable_optimization", True)
        }
        
        # Start enhanced download in background
        background_tasks.add_task(
            download_trip_landmarks_enhanced_with_progress,
            trip,
            trip_id,
            use_optimization
        )
        
        return {
            "status": "success",
            "message": "Enhanced landmark download started",
            "enhanced_features": {
                "granular_progress": True,
                "image_download": landmark_settings.get("download_images", True),
                "optimization_enabled": use_optimization and landmark_settings.get("enable_optimization", True),
                "configurable_settings": True
            }
        }
        
    except Exception as e:
        logger.error(f"Error starting enhanced landmark download: {str(e)}")
        # Clean up the active download entry
        if trip_id in active_downloads:
            del active_downloads[trip_id]
        raise HTTPException(status_code=500, detail=f"Failed to start enhanced download: {str(e)}")

@router.get("/{trip_id}/download-landmarks-status")
async def check_landmarks_download_status(trip_id: str):
    """Get the current status of a landmark download"""
    logger.info(f"Checking download status for trip_id: {trip_id}")
    logger.info(f"Active downloads: {list(active_downloads.keys())}")
    
    if trip_id not in active_downloads:
        logger.warning(f"No active download found for trip_id: {trip_id}")
        # Instead of raising 404, return a default status that the frontend can understand
        return {
            "progress": 0,
            "detail": "No active download. Please start a new download.",
            "status": "not_started"
        }
    
    logger.info(f"Found active download for trip_id: {trip_id}, status: {active_downloads[trip_id]}")
    return active_downloads[trip_id]

@router.get("/{trip_id}/download-landmarks-stream")
async def download_landmarks_stream(request: Request, trip_id: str, radius_km: int = 10):
    """Stream the progress of downloading landmarks for a trip"""
    global active_downloads
    
    # Debug landmark checker
    if landmark_checker is None:
        logger.error(f"[LANDMARK_DOWNLOAD] landmark_checker is None - this is a critical error")
        raise HTTPException(status_code=500, detail="Landmark checker not initialized")
    else:
        try:
            # Test landmark checker by getting a landmark
            test_lat = 36.1  # Example location
            test_lon = -112.1
            logger.info(f"[LANDMARK_DOWNLOAD] Testing landmark_checker with coordinates {test_lat}, {test_lon}")
            
            test_landmarks = landmark_checker.get_landmarks_in_area(test_lat, test_lon, 10)
            logger.info(f"[LANDMARK_DOWNLOAD] Test returned {len(test_landmarks)} landmarks")
            
            if test_landmarks:
                logger.info(f"[LANDMARK_DOWNLOAD] First landmark example: {test_landmarks[0]}")
        except Exception as e:
            logger.error(f"[LANDMARK_DOWNLOAD] Error testing landmark_checker: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Landmark checker test failed: {str(e)}")
    
    # Find the planned trip
    trip = find_trip_by_id(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    # Print trip coordinates for debugging
    logger.info(f"[LANDMARK_DOWNLOAD] Trip start location: {trip.start_location}")
    logger.info(f"[LANDMARK_DOWNLOAD] Trip end location: {trip.end_location}")
    if hasattr(trip, 'waypoints') and trip.waypoints:
        logger.info(f"[LANDMARK_DOWNLOAD] Trip has {len(trip.waypoints)} waypoints")
        for i, wp in enumerate(trip.waypoints):
            logger.info(f"[LANDMARK_DOWNLOAD] Waypoint {i+1}: {wp.lat}, {wp.lon}")
    
    # Initialize progress tracker for this download
    active_downloads[trip_id] = {
        "progress": 0,
        "detail": "Starting download...",
        "status": "in_progress"
    }
    
    # Start the download process in the background
    background_tasks = BackgroundTasks()
    background_tasks.add_task(
        download_trip_landmarks_with_progress, 
        trip, 
        radius_km,
        trip_id
    )
    
    # Return SSE stream that will send progress updates
    async def event_generator():
        try:
            while True:
                # Check if client is still connected
                if await request.is_disconnected():
                    logger.info(f"[LANDMARK_DOWNLOAD] Client disconnected from stream for trip {trip_id}")
                    break
                
                # Get current progress
                download_status = active_downloads.get(trip_id, {})
                progress = download_status.get("progress", 0)
                detail = download_status.get("detail", "")
                status = download_status.get("status", "in_progress")
                
                # Send progress update with all available granular data
                if status == "in_progress":
                    progress_data = {
                        "type": "progress",
                        "progress": progress,
                        "detail": detail,
                        "status": status
                    }
                    
                    # Add all additional fields from download_status for granular display
                    for key, value in download_status.items():
                        if key not in ["progress", "detail", "status"] and value is not None:
                            progress_data[key] = value
                    
                    yield {
                        "event": "message",
                        "data": json.dumps(progress_data)
                    }
                elif status == "complete":
                    # Send completion message and clean up
                    yield {
                        "event": "message",
                        "data": json.dumps({
                            "type": "complete",
                            "message": "Landmarks downloaded successfully"
                        })
                    }
                    # Remove this download from active downloads
                    if trip_id in active_downloads:
                        del active_downloads[trip_id]
                    break
                elif status == "error":
                    # Send error message and clean up
                    yield {
                        "event": "message",
                        "data": json.dumps({
                            "type": "error",
                            "message": detail
                        })
                    }
                    # Remove this download from active downloads
                    if trip_id in active_downloads:
                        del active_downloads[trip_id]
                    break
                
                # Wait before sending the next update
                await asyncio.sleep(0.5)
                
        except Exception as e:
            # Send error message if something went wrong
            yield {
                "event": "message",
                "data": json.dumps({
                    "type": "error",
                    "message": f"Stream error: {str(e)}"
                })
            }
            # Clean up
            if trip_id in active_downloads:
                del active_downloads[trip_id]
    
    return EventSourceResponse(event_generator())

@router.post("/{trip_id}/cancel-landmarks-download")
async def cancel_landmarks_download(trip_id: str):
    """Cancel an active landmarks download"""
    if trip_id not in active_downloads:
        return {
            "status": "not_found", 
            "message": "No active download found for this trip"
        }
    
    try:
        # Remove from active downloads to signal cancellation
        del active_downloads[trip_id]
        
        # Notify user
        if audio_notifier:
            audio_notifier.announce(
                f"Descarga de puntos de interés cancelada para el viaje",
                title="Descarga Cancelada",
                notification_type="info",
                send_notification=True
            )
        
        logger.info(f"Cancelled landmarks download for trip {trip_id}")
        return {
            "status": "cancelled",
            "message": "Landmarks download cancelled"
        }
    except Exception as e:
        logger.error(f"Error cancelling landmarks download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel download: {str(e)}")

@router.post("/{trip_id}/pause-landmarks-download")
async def pause_landmarks_download(trip_id: str):
    """Pause an active landmarks download"""
    if trip_id in active_downloads:
        # Update status to paused
        active_downloads[trip_id].update({
            "status": "paused",
            "detail": "Download paused by user",
            "message": "Download has been paused"
        })
        
        # Notify user
        if audio_notifier:
            audio_notifier.announce(
                f"Descarga de puntos de interés pausada para el viaje",
                title="Descarga Pausada",
                notification_type="info",
                send_notification=True
            )
        
        logger.info(f"Paused landmarks download for trip {trip_id}")
        return {
            "status": "paused",
            "message": "Landmarks download paused"
        }
    else:
        return {
            "status": "not_found", 
            "message": "No active download found for this trip"
        }

@router.post("/{trip_id}/resume-landmarks-download")
async def resume_landmarks_download(trip_id: str):
    """Resume a paused landmarks download"""
    if trip_id in active_downloads and active_downloads[trip_id].get("status") == "paused":
        # Update status to resumed
        active_downloads[trip_id].update({
            "status": "downloading",
            "detail": "Download resumed by user",
            "message": "Download has been resumed"
        })
        
        # Notify user
        if audio_notifier:
            audio_notifier.announce(
                f"Descarga de puntos de interés reanudada para el viaje",
                title="Descarga Reanudada",
                notification_type="info",
                send_notification=True
            )
        
        logger.info(f"Resumed landmarks download for trip {trip_id}")
        return {
            "status": "resumed",
            "message": "Landmarks download resumed"
        }
    elif trip_id not in active_downloads:
        return {
            "status": "not_found", 
            "message": "No download found for this trip"
        }
    else:
        return {
            "status": "invalid_state",
            "message": "Download is not paused or cannot be resumed"
        }
