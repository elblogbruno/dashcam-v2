"""
API routes for trip planner geodata management
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from typing import List, Dict, Any, Optional
import asyncio
import logging
import json
from datetime import datetime
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# Import geocoding components
from ..downloader.geodata_downloader import GeodataDownloader
from ..utils.db_storage import store_geodata_in_db

logger = logging.getLogger(__name__)

router = APIRouter()

class WaypointGeoDataRequest(BaseModel):
    radius_km: Optional[float] = 10.0
    format: Optional[str] = "both"  # "csv", "db", "both"
    use_single_center: Optional[bool] = False  # Use optimized single center approach
    center_lat: Optional[float] = None  # Optimized center latitude
    center_lon: Optional[float] = None  # Optimized center longitude

class WaypointGeoProgress(BaseModel):
    """Model for waypoint geodata download progress"""
    type: str  # 'progress', 'complete', 'error', 'waypoint_start', 'waypoint_complete'
    progress: Optional[float] = None
    detail: Optional[str] = None
    message: Optional[str] = None
    waypoint_index: Optional[int] = None
    waypoint_name: Optional[str] = None
    waypoints_processed: Optional[int] = None
    total_waypoints: Optional[int] = None
    grid_progress: Optional[float] = None
    grid_detail: Optional[str] = None
    csv_records: Optional[int] = None
    db_records: Optional[int] = None
    current_waypoint_index: Optional[int] = None
    current_waypoint_name: Optional[str] = None
    status: Optional[str] = None
    # New granular progress fields
    current_waypoint_progress: Optional[float] = None
    current_waypoint_grid_processed: Optional[int] = None
    current_waypoint_grid_total: Optional[int] = None
    successful_api_calls: Optional[int] = None
    failed_api_calls: Optional[int] = None
    api_rate_limit_wait: Optional[bool] = None
    estimated_time_remaining: Optional[str] = None
    current_phase: Optional[str] = None  # 'initializing', 'downloading_waypoint', 'saving_data', 'completing'

# Global storage for active downloads - will be replaced with proper state management
active_geodata_downloads = {}

# Dependencies that will be injected
planned_trips = []
audio_notifier = None

def set_dependencies(trips_list, notifier):
    """Set dependencies from main application"""
    global planned_trips, audio_notifier
    planned_trips = trips_list
    audio_notifier = notifier

@router.post("/{trip_id}/download-geodata")
async def download_waypoint_geodata(
    trip_id: str, 
    background_tasks: BackgroundTasks,
    request: WaypointGeoDataRequest
):
    """Download reverse geocoded data for all waypoints in a trip"""
    # Find the planned trip
    trip = None
    for t in planned_trips:
        if t.id == trip_id:
            trip = t
            break
    
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    # Check if there's already an active download for this trip
    if trip_id in active_geodata_downloads:
        return {
            "status": "in_progress",
            "message": "Waypoint geodata download already in progress"
        }
    
    try:
        # Initialize progress tracker
        active_geodata_downloads[trip_id] = {
            "progress": 0,
            "detail": "Starting waypoint geodata download...",
            "status": "downloading",
            "waypoints_processed": 0,
            "total_waypoints": 0
        }
        
        # Start background task
        background_tasks.add_task(
            download_waypoint_geodata_background, 
            trip, 
            request.radius_km, 
            request.format, 
            trip_id,
            request.use_single_center,
            request.center_lat,
            request.center_lon
        )
        
        return {
            "status": "started",
            "message": f"Waypoint geodata download started for trip: {trip.name}",
            "trip_id": trip_id,
            "radius_km": request.radius_km,
            "format": request.format,
            "optimization_used": request.use_single_center,
            "optimization_center": {
                "lat": request.center_lat, 
                "lon": request.center_lon
            } if request.use_single_center and request.center_lat is not None and request.center_lon is not None else None
        }
        
    except Exception as e:
        logger.error(f"Error starting waypoint geodata download: {str(e)}")
        if trip_id in active_geodata_downloads:
            del active_geodata_downloads[trip_id]
        raise HTTPException(status_code=500, detail=f"Failed to start download: {str(e)}")

@router.get("/{trip_id}/download-geodata-status")
async def check_waypoint_geodata_status(trip_id: str):
    """Check the status of waypoint geodata download"""
    if trip_id not in active_geodata_downloads:
        return {"status": "not_found", "message": "No download in progress for this trip"}
    
    return {
        "status": "in_progress",
        "data": active_geodata_downloads[trip_id]
    }

@router.post("/{trip_id}/cancel-geodata-download")
async def cancel_waypoint_geodata_download(trip_id: str):
    """Cancel the geodata download for a trip"""
    if trip_id not in active_geodata_downloads:
        return {"status": "not_found", "message": "No download in progress for this trip"}
    
    try:
        # Remove from active downloads to signal cancellation
        del active_geodata_downloads[trip_id]
        
        logger.info(f"[GEODATA_DOWNLOAD] Download cancelled for trip {trip_id}")
        
        return {
            "status": "cancelled",
            "message": f"Geodata download cancelled for trip {trip_id}"
        }
        
    except Exception as e:
        logger.error(f"Error cancelling geodata download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel download: {str(e)}")

@router.post("/{trip_id}/pause-geodata-download")
async def pause_geodata_download(trip_id: str):
    """Pause the geodata download for a trip"""
    if trip_id not in active_geodata_downloads:
        return {"status": "not_found", "message": "No download in progress for this trip"}
    
    try:
        active_geodata_downloads[trip_id]["status"] = "paused"
        logger.info(f"[GEODATA_DOWNLOAD] Download paused for trip {trip_id}")
        
        return {
            "status": "paused",
            "message": f"Geodata download paused for trip {trip_id}"
        }
        
    except Exception as e:
        logger.error(f"Error pausing geodata download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to pause download: {str(e)}")

@router.post("/{trip_id}/resume-geodata-download")
async def resume_geodata_download(trip_id: str):
    """Resume the geodata download for a trip"""
    if trip_id not in active_geodata_downloads:
        return {"status": "not_found", "message": "No download in progress for this trip"}
    
    try:
        active_geodata_downloads[trip_id]["status"] = "downloading"
        logger.info(f"[GEODATA_DOWNLOAD] Download resumed for trip {trip_id}")
        
        return {
            "status": "resumed",
            "message": f"Geodata download resumed for trip {trip_id}"
        }
        
    except Exception as e:
        logger.error(f"Error resuming geodata download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to resume download: {str(e)}")

@router.get("/{trip_id}/download-geodata-stream")
async def get_waypoint_geodata_download_stream(request: Request, trip_id: str):
    """Stream real-time progress updates for waypoint geodata download"""
    async def event_generator():
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info(f"[GEODATA_STREAM] Client disconnected for trip {trip_id}")
                    break
                
                # Check if download exists
                if trip_id not in active_geodata_downloads:
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "type": "error",
                            "message": "Download not found or completed"
                        })
                    }
                    break
                
                progress_data = active_geodata_downloads[trip_id]
                
                # Send progress update with more granular data
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "type": "progress",
                        "progress": progress_data.get("progress", 0),
                        "detail": progress_data.get("detail", ""),
                        "waypoints_processed": progress_data.get("waypoints_processed", 0),
                        "total_waypoints": progress_data.get("total_waypoints", 0),
                        "current_waypoint_name": progress_data.get("current_waypoint_name", ""),
                        "current_waypoint_index": progress_data.get("current_waypoint_index", 0),
                        "current_waypoint_progress": progress_data.get("current_waypoint_progress", 0),
                        "current_waypoint_grid_processed": progress_data.get("current_waypoint_grid_processed", 0),
                        "current_waypoint_grid_total": progress_data.get("current_waypoint_grid_total", 0),
                        "successful_api_calls": progress_data.get("successful_api_calls", 0),
                        "failed_api_calls": progress_data.get("failed_api_calls", 0),
                        "api_rate_limit_wait": progress_data.get("api_rate_limit_wait", False),
                        "estimated_time_remaining": progress_data.get("estimated_time_remaining", ""),
                        "current_phase": progress_data.get("current_phase", "downloading"),
                        "status": progress_data.get("status", "downloading"),
                        "optimization_used": progress_data.get("optimization_used", False),
                        "optimization_center": progress_data.get("optimization_center", None),
                        "optimization_radius_km": progress_data.get("optimization_radius_km", None)
                    })
                }
                
                # Check if download is complete
                if progress_data.get("status") == "complete":
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "type": "complete",
                            "message": "Geodata download completed successfully",
                            "waypoints_processed": progress_data.get("waypoints_processed", 0)
                        })
                    }
                    break
                elif progress_data.get("status") == "error":
                    yield {
                        "event": "error", 
                        "data": json.dumps({
                            "type": "error",
                            "message": progress_data.get("detail", "Unknown error occurred")
                        })
                    }
                    break
                
                # Wait before next update
                await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"[GEODATA_STREAM] Error in stream for trip {trip_id}: {str(e)}")
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error", 
                    "message": f"Stream error: {str(e)}"
                })
            }
    
    return EventSourceResponse(event_generator())

# Background function for downloading geodata with pause support and granular progress
async def download_waypoint_geodata_background(trip, radius_km: float, format: str, trip_id: str, 
                                             use_single_center: bool = False, center_lat: float = None, center_lon: float = None):
    """Background task to download waypoint geodata with progress tracking and pause support"""
    global active_geodata_downloads
    
    try:
        # Create a progress callback for the downloader
        def update_waypoint_progress(progress_percent: float, detail: str, grid_processed: int = 0, grid_total: int = 0, 
                                   successful_calls: int = 0, failed_calls: int = 0, rate_limit_wait: bool = False):
            """Update progress for current waypoint grid processing"""
            if trip_id in active_geodata_downloads:
                active_geodata_downloads[trip_id].update({
                    "current_waypoint_progress": progress_percent,
                    "current_waypoint_grid_processed": grid_processed,
                    "current_waypoint_grid_total": grid_total,
                    "successful_api_calls": successful_calls,
                    "failed_api_calls": failed_calls,
                    "api_rate_limit_wait": rate_limit_wait,
                    "grid_detail": detail
                })
        
        # Initialize geocoding components with progress callback
        geocoding_downloader = GeodataDownloader(progress_callback=update_waypoint_progress)
        
        # Collect all waypoints including start and end locations FIRST
        all_waypoints = []
        
        # Add start location
        all_waypoints.append({
            "lat": trip.start_location["lat"],
            "lon": trip.start_location["lon"],
            "name": trip.origin_name or "Start Location",
            "type": "start"
        })
        
        # Add waypoints
        if trip.waypoints:
            for i, wp in enumerate(trip.waypoints):
                all_waypoints.append({
                    "lat": wp.lat,
                    "lon": wp.lon,
                    "name": wp.name or f"Waypoint {i+1}",
                    "type": "waypoint"
                })
        
        # Add end location
        all_waypoints.append({
            "lat": trip.end_location["lat"],
            "lon": trip.end_location["lon"],
            "name": trip.destination_name or "Destination",
            "type": "end"
        })
        
        # Determine the appropriate radius for different approaches
        optimized_radius = radius_km  # This is the optimized radius from frontend
        traditional_waypoint_radius = 10.0  # Default radius for individual waypoints
        waypoint_radii = None
        adaptation_stats = {}
        
        # If using single center optimization, use the optimized radius
        # Otherwise, calculate adaptive radii for traditional approach
        if use_single_center:
            effective_radius = optimized_radius
            waypoint_radii = None  # Not used in single center approach
            adaptation_stats = None
        else:
            # Import the adaptive radius calculator
            from ..utils.adaptive_radius_calculator import calculate_adaptive_radii_for_waypoints
            
            # Calculate adaptive radii for each waypoint
            waypoint_radii, adaptation_stats = calculate_adaptive_radii_for_waypoints(all_waypoints)
            effective_radius = traditional_waypoint_radius  # Fallback, will be overridden per waypoint
            
            logger.info(f"[GEODATA_DOWNLOAD] Adaptive radii calculated: "
                       f"avg={adaptation_stats['avg_radius_km']:.1f}km, "
                       f"range={adaptation_stats['min_radius_km']:.1f}-{adaptation_stats['max_radius_km']:.1f}km, "
                       f"efficiency_gain={adaptation_stats['estimated_efficiency_gain']:.1f}%")
        
        logger.info(f"[GEODATA_DOWNLOAD] Radius settings - Optimized: {optimized_radius:.1f}km, "
                   f"Using: {'single_center' if use_single_center else 'adaptive_per_waypoint'} "
                   f"(single_center: {use_single_center})")
        
        total_waypoints = len(all_waypoints)
        processed_waypoints = 0
        start_time = datetime.now()
        
        # Initialize progress only if download is still active
        if trip_id in active_geodata_downloads:
            optimization_info = ""
            if use_single_center and center_lat is not None and center_lon is not None:
                optimization_info = " (usando optimización de centro único)"
            
            active_geodata_downloads[trip_id].update({
                "total_waypoints": total_waypoints,
                "waypoints_processed": 0,
                "progress": 0,
                "detail": f"Inicializando descarga de geodatos{optimization_info}...",
                "status": "downloading",
                "current_phase": "initializing",
                "successful_api_calls": 0,
                "failed_api_calls": 0,
                "estimated_time_remaining": "Calculando...",
                "optimization_used": use_single_center
            })
        else:
            # Download was cancelled before starting
            logger.info(f"[GEODATA_DOWNLOAD] Download cancelled for trip {trip_id} before starting")
            return
        
        logger.info(f"[GEODATA_DOWNLOAD] Starting geodata download for trip {trip_id} with {total_waypoints} waypoints")
        
        # Check if we should use optimized single-center approach
        if use_single_center and center_lat is not None and center_lon is not None:
            logger.info(f"[GEODATA_DOWNLOAD] Using optimized single-center approach: center=({center_lat:.4f}, {center_lon:.4f}), radius={optimized_radius:.1f}km")
            
            # Update progress to indicate optimized approach
            if trip_id in active_geodata_downloads:
                active_geodata_downloads[trip_id].update({
                    "progress": 10,
                    "detail": f"Descargando geodatos desde centro optimizado ({center_lat:.4f}, {center_lon:.4f})...",
                    "current_phase": "downloading_optimized",
                    "optimization_center": {"lat": center_lat, "lon": center_lon}
                })
            
            try:
                # Download geodata for the optimized center point
                center_name = f"Centro optimizado del viaje {trip.name}"
                logger.info(f"[GEODATA_DOWNLOAD] Downloading geodata for optimized center: {center_name}")
                
                geodata_results = await geocoding_downloader.download_geodata_for_location(
                    center_lat, center_lon, optimized_radius, center_name
                )
                
                # Update progress to saving phase
                if trip_id in active_geodata_downloads:
                    active_geodata_downloads[trip_id].update({
                        "progress": 80,
                        "detail": f"Guardando {len(geodata_results) if geodata_results else 0} registros desde descarga optimizada...",
                        "current_phase": "saving_data"
                    })
                
                saved_count = 0
                if geodata_results:
                    logger.info(f"[GEODATA_DOWNLOAD] Saving {len(geodata_results)} records from optimized download")
                    
                    for geodata_record in geodata_results:
                        try:
                            # Create waypoint dict for storage function
                            waypoint_data = {
                                'lat': geodata_record['lat'],
                                'lon': geodata_record['lon']
                            }
                            
                            # Use the enhanced store_geodata_in_db function
                            await store_geodata_in_db(geodata_record, trip_id, waypoint_data)
                            saved_count += 1
                        except Exception as save_error:
                            logger.warning(f"Error saving optimized geodata record: {save_error}")
                
                # Mark as complete
                if trip_id in active_geodata_downloads:
                    completion_message = f"Descarga optimizada completada: {saved_count} registros guardados desde centro único"
                    
                    active_geodata_downloads[trip_id] = {
                        "progress": 100,
                        "detail": completion_message,
                        "status": "complete",
                        "waypoints_processed": 1,  # Single optimized center
                        "total_waypoints": 1,
                        "current_phase": "complete",
                        "successful_api_calls": 1,
                        "failed_api_calls": 0,
                        "csv_records": 0,  # Not used in optimized approach
                        "db_records": saved_count,
                        "estimated_time_remaining": "Completado",
                        "optimization_used": True,
                        "optimization_center": {"lat": center_lat, "lon": center_lon},
                        "optimization_radius_km": optimized_radius
                    }
                    
                    logger.info(f"[GEODATA_DOWNLOAD] Optimized geodata download completed for trip {trip_id}: {saved_count} records")
                
                # Notify user of optimized completion
                if audio_notifier:
                    audio_notifier.announce(
                        f"Descarga optimizada de geodatos completada para el viaje {trip.name} con {saved_count} registros"
                    )
                
                return  # Exit here for optimized approach
                
            except Exception as e:
                logger.error(f"[GEODATA_DOWNLOAD] Error in optimized geodata download: {str(e)}")
                # Fall back to traditional approach if optimized fails
                if trip_id in active_geodata_downloads:
                    active_geodata_downloads[trip_id].update({
                        "detail": f"Error en descarga optimizada, cambiando a método tradicional: {str(e)}",
                        "optimization_used": False
                    })
                logger.info(f"[GEODATA_DOWNLOAD] Falling back to traditional waypoint-by-waypoint approach")
                # Continue with traditional approach below
        
        # Traditional waypoint-by-waypoint approach
        approach_description = "adaptive radii" if waypoint_radii else f"{effective_radius:.1f}km radius"
        logger.info(f"[GEODATA_DOWNLOAD] Using traditional waypoint-by-waypoint approach with {approach_description} per waypoint")
        
        # Process each waypoint
        for i, waypoint in enumerate(all_waypoints):
            # Check if download was paused
            if trip_id in active_geodata_downloads and active_geodata_downloads[trip_id].get('status') == 'paused':
                logger.info(f"[GEODATA_DOWNLOAD] Download paused for trip {trip_id} at waypoint {i+1}")
                return
            
            # Calculate estimated time remaining
            if i > 0:
                elapsed_time = (datetime.now() - start_time).total_seconds()
                avg_time_per_waypoint = elapsed_time / i
                remaining_waypoints = total_waypoints - i
                estimated_remaining_seconds = avg_time_per_waypoint * remaining_waypoints
                
                if estimated_remaining_seconds < 60:
                    estimated_time = f"{int(estimated_remaining_seconds)}s"
                elif estimated_remaining_seconds < 3600:
                    estimated_time = f"{int(estimated_remaining_seconds / 60)}m {int(estimated_remaining_seconds % 60)}s"
                else:
                    hours = int(estimated_remaining_seconds / 3600)
                    minutes = int((estimated_remaining_seconds % 3600) / 60)
                    estimated_time = f"{hours}h {minutes}m"
            else:
                estimated_time = "Calculando..."
            
            # Update progress only if download is still active
            if trip_id in active_geodata_downloads:
                waypoint_radius = waypoint_radii[i] if waypoint_radii else effective_radius
                progress = (i / total_waypoints) * 100
                active_geodata_downloads[trip_id].update({
                    "progress": progress,
                    "detail": f"Procesando {waypoint['name']} ({waypoint['type']}) - Radio: {waypoint_radius:.1f}km...",
                    "waypoints_processed": i,
                    "current_waypoint_index": i,
                    "current_waypoint_name": waypoint['name'],
                    "current_waypoint_radius": waypoint_radius,
                    "current_phase": "downloading_waypoint",
                    "current_waypoint_progress": 0,
                    "current_waypoint_grid_processed": 0,
                    "current_waypoint_grid_total": 0,
                    "estimated_time_remaining": estimated_time,
                    "status": "downloading"
                })
            else:
                # Download was cancelled, stop processing
                logger.info(f"[GEODATA_DOWNLOAD] Download cancelled for trip {trip_id} - stopping")
                return
            
            logger.info(f"[GEODATA_DOWNLOAD] Processing waypoint {i+1}/{total_waypoints}: {waypoint['name']}")
            
            try:
                # Determine the radius for this specific waypoint
                waypoint_radius = waypoint_radii[i] if waypoint_radii else effective_radius
                
                # Use the geocoding downloader to download geodata for this waypoint
                logger.info(f"[GEODATA_DOWNLOAD] Iniciando descarga de geodatos para waypoint {i+1}/{total_waypoints}: {waypoint['name']} (radio: {waypoint_radius:.1f}km)")
                
                # Update phase to downloading
                if trip_id in active_geodata_downloads:
                    active_geodata_downloads[trip_id]["current_phase"] = "downloading_waypoint"
                
                geodata_results = await geocoding_downloader.download_geodata_for_location(
                    waypoint['lat'], waypoint['lon'], waypoint_radius, waypoint['name']
                )
                
                # Update phase to saving data
                if trip_id in active_geodata_downloads:
                    active_geodata_downloads[trip_id]["current_phase"] = "saving_data"
                    active_geodata_downloads[trip_id]["detail"] = f"Guardando datos para {waypoint['name']}..."
                
                if geodata_results:
                    # Save to database using enhanced storage system
                    logger.info(f"[GEODATA_DOWNLOAD] Guardando {len(geodata_results)} registros en BD para {waypoint['name']}")
                    
                    saved_count = 0
                    for geodata_record in geodata_results:
                        try:
                            # Create waypoint dict for storage function
                            waypoint_data = {
                                'lat': geodata_record['lat'],
                                'lon': geodata_record['lon']
                            }
                            
                            # Use the enhanced store_geodata_in_db function
                            await store_geodata_in_db(geodata_record, trip_id, waypoint_data)
                            saved_count += 1
                        except Exception as save_error:
                            logger.warning(f"Error saving geodata record for {waypoint['name']}: {save_error}")
                    
                    # Update DB records count
                    if trip_id in active_geodata_downloads:
                        current_db = active_geodata_downloads[trip_id].get("db_records", 0)
                        active_geodata_downloads[trip_id]["db_records"] = current_db + saved_count
                    
                    logger.info(f"[GEODATA_DOWNLOAD] Successfully saved {saved_count}/{len(geodata_results)} records for {waypoint['name']}")
                
                processed_waypoints += 1
                
                # Update total successful API calls
                if trip_id in active_geodata_downloads:
                    current_successful = active_geodata_downloads[trip_id].get("successful_api_calls", 0)
                    current_failed = active_geodata_downloads[trip_id].get("failed_api_calls", 0)
                    
                    # Add the successful calls from this waypoint
                    grid_successful = active_geodata_downloads[trip_id].get("current_waypoint_grid_processed", 0)
                    total_successful = current_successful + grid_successful
                    
                    active_geodata_downloads[trip_id]["successful_api_calls"] = total_successful
                
                # Update progress after completing waypoint only if download is still active
                if trip_id in active_geodata_downloads:
                    progress = (processed_waypoints / total_waypoints) * 100
                    active_geodata_downloads[trip_id].update({
                        "progress": progress,
                        "waypoints_processed": processed_waypoints,
                        "current_phase": "completing_waypoint",
                        "detail": f"Completado {waypoint['name']} ({processed_waypoints}/{total_waypoints})",
                        "current_waypoint_progress": 100
                    })
                else:
                    # Download was cancelled, stop processing
                    logger.info(f"[GEODATA_DOWNLOAD] Download cancelled for trip {trip_id} after waypoint completion - stopping")
                    return
                
                # Brief pause between waypoints
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"[GEODATA_DOWNLOAD] Error processing waypoint {waypoint['name']}: {str(e)}")
                
                # Update failed API calls count
                if trip_id in active_geodata_downloads:
                    current_failed = active_geodata_downloads[trip_id].get("failed_api_calls", 0)
                    active_geodata_downloads[trip_id]["failed_api_calls"] = current_failed + 1
                    active_geodata_downloads[trip_id]["detail"] = f"Error en {waypoint['name']}: {str(e)}"
                
                continue
        
        # Check if download was paused before completion
        if trip_id in active_geodata_downloads and active_geodata_downloads[trip_id].get('status') == 'paused':
            logger.info(f"[GEODATA_DOWNLOAD] Download paused for trip {trip_id} before completion")
            return
        
        # Mark as complete only if download is still active
        if trip_id in active_geodata_downloads:
            total_successful_calls = active_geodata_downloads[trip_id].get("successful_api_calls", 0)
            total_failed_calls = active_geodata_downloads[trip_id].get("failed_api_calls", 0)
            total_csv_records = active_geodata_downloads[trip_id].get("csv_records", 0)
            total_db_records = active_geodata_downloads[trip_id].get("db_records", 0)
            
            completion_message = f"Geodatos descargados para {processed_waypoints} waypoints"
            if total_csv_records > 0 or total_db_records > 0:
                completion_message += f" - {total_csv_records} registros CSV, {total_db_records} registros BD"
            completion_message += f" - {total_successful_calls} llamadas exitosas, {total_failed_calls} fallos"
            
            # Add adaptive radius statistics if used
            adaptive_stats = {}
            if waypoint_radii:
                adaptive_stats = {
                    "adaptive_radii_used": True,
                    "avg_radius_km": sum(waypoint_radii) / len(waypoint_radii),
                    "min_radius_km": min(waypoint_radii),
                    "max_radius_km": max(waypoint_radii),
                    "efficiency_gain_percent": adaptation_stats.get('estimated_efficiency_gain', 0)
                }
                completion_message += f" - Radio adaptativo promedio: {adaptive_stats['avg_radius_km']:.1f}km"
            
            active_geodata_downloads[trip_id] = {
                "progress": 100,
                "detail": completion_message,
                "status": "complete",
                "waypoints_processed": processed_waypoints,
                "total_waypoints": total_waypoints,
                "current_phase": "complete",
                "successful_api_calls": total_successful_calls,
                "failed_api_calls": total_failed_calls,
                "csv_records": total_csv_records,
                "db_records": total_db_records,
                "estimated_time_remaining": "Completado",
                "optimization_used": use_single_center,
                **adaptive_stats
            }
            
            logger.info(f"[GEODATA_DOWNLOAD] Geodata download completed for trip {trip_id}")
        else:
            logger.info(f"[GEODATA_DOWNLOAD] Download was cancelled for trip {trip_id} - not marking as complete")
        
        # Notify user
        if audio_notifier:
            audio_notifier.announce(
                f"Descarga de geodatos completada para el viaje {trip.name}"
            )
            
    except Exception as e:
        logger.error(f"[GEODATA_DOWNLOAD] Error in background geodata download: {str(e)}", exc_info=True)
        # Update status to error only if download is still active
        if trip_id in active_geodata_downloads:
            active_geodata_downloads[trip_id] = {
                "progress": 0,
                "detail": f"Error: {str(e)}",
                "status": "error"
            }
            
            # Notify user of error
            if audio_notifier:
                audio_notifier.announce(
                    f"Error al descargar datos geográficos para el viaje {trip.name}: {str(e)}"
                )
        else:
            logger.info(f"[GEODATA_DOWNLOAD] Download was cancelled for trip {trip_id} - not reporting error")
