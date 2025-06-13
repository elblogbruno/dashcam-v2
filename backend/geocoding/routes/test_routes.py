"""
API routes for geocoding testing and debugging
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from typing import List, Dict, Any, Optional
import asyncio
import logging
import json
import time
from datetime import datetime
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import requests

# Import geocoding components
from ..downloader.geodata_downloader import GeodataDownloader
from ..utils.db_storage import DBStorage
from ..utils.grid_generator import generate_comprehensive_grid_coverage

logger = logging.getLogger(__name__)

router = APIRouter()

class GeocodingTestRequest(BaseModel):
    lat: float
    lon: float
    location_name: Optional[str] = "Test Location"
    radius_km: Optional[float] = 5.0
    test_type: Optional[str] = "both"  # "online", "offline", "both"
    offline_method: Optional[str] = "database"  # "database", "csv"
    generate_grid: Optional[bool] = True
    max_results: Optional[int] = 50

class GeocodingTestProgress(BaseModel):
    type: str  # 'progress', 'complete', 'error'
    progress: Optional[float] = None
    total: Optional[int] = None
    phase: Optional[str] = None
    details: Optional[str] = None
    results: Optional[Dict] = None
    message: Optional[str] = None

# Global storage for active test
active_test = {
    "running": False,
    "progress": 0,
    "phase": "idle",
    "details": "",
    "results": None
}

@router.get("/connectivity")
async def check_connectivity():
    """Check if online geocoding services are available"""
    try:
        # Test Nominatim connectivity
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": 40.7589,
                "lon": -73.9851,
                "format": "json"
            },
            timeout=5
        )
        online_available = response.status_code == 200
    except Exception as e:
        logger.warning(f"Online connectivity test failed: {str(e)}")
        online_available = False
    
    return {
        "online": online_available,
        "services": {
            "nominatim": online_available
        },
        "timestamp": datetime.now().isoformat()
    }

@router.get("/offline-status")
async def check_offline_status():
    """Check if offline geocoding methods are available"""
    try:
        # Check database method
        db_storage = DBStorage()
        db_available = await db_storage.is_available()
        db_count = 0
        if db_available:
            db_count = await db_storage.get_record_count()
        
        # Check CSV/reverse_geocoder method
        csv_available = False
        csv_error = None
        try:
            import reverse_geocoder as rg
            # Test with a simple search to verify it's working
            test_result = rg.search([(0, 0)])
            csv_available = True
        except ImportError as e:
            csv_error = f"reverse_geocoder library not installed: {str(e)}"
        except Exception as e:
            csv_error = f"reverse_geocoder error: {str(e)}"
        
        return {
            "database": {
                "available": db_available,
                "record_count": db_count
            },
            "csv": {
                "available": csv_available,
                "error": csv_error
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Offline status check failed: {str(e)}")
        return {
            "database": {
                "available": False,
                "record_count": 0,
                "error": str(e)
            },
            "csv": {
                "available": False,
                "error": str(e)
            },
            "timestamp": datetime.now().isoformat()
        }

@router.post("/run-test")
async def run_geocoding_test(
    request: GeocodingTestRequest,
    background_tasks: BackgroundTasks
):
    """Start a comprehensive geocoding test"""
    global active_test
    
    if active_test["running"]:
        raise HTTPException(status_code=409, detail="Test already running")
    
    # Validate coordinates
    if not (-90 <= request.lat <= 90) or not (-180 <= request.lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    # Initialize test state
    active_test = {
        "running": True,
        "progress": 0,
        "phase": "starting",
        "details": "Iniciando prueba de geocodificación...",
        "results": None
    }
    
    # Start background test
    background_tasks.add_task(
        run_geocoding_test_background,
        request
    )
    
    return {
        "status": "started",
        "message": f"Geocoding test started for location: {request.location_name}",
        "test_config": request.dict()
    }

@router.post("/stop")
async def stop_geocoding_test():
    """Stop the current geocoding test"""
    global active_test
    
    if not active_test["running"]:
        return {"status": "not_running", "message": "No test currently running"}
    
    active_test["running"] = False
    active_test["phase"] = "stopped"
    active_test["details"] = "Prueba detenida por el usuario"
    
    return {
        "status": "stopped",
        "message": "Geocoding test stopped"
    }

@router.get("/stream")
async def get_geocoding_test_stream(request: Request):
    """Stream real-time progress updates for geocoding test"""
    async def event_generator():
        try:
            last_progress = -1
            last_phase = ""
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info("[GEOCODING_TEST] Client disconnected")
                    break
                
                current_progress = active_test.get("progress", 0)
                current_phase = active_test.get("phase", "idle")
                
                # Only send updates when something changes
                if (current_progress != last_progress or 
                    current_phase != last_phase or 
                    active_test.get("results") is not None):
                    
                    progress_data = {
                        "type": "progress",
                        "progress": current_progress,
                        "total": 100,
                        "phase": current_phase,
                        "details": active_test.get("details", ""),
                        "running": active_test.get("running", False)
                    }
                    
                    yield f"data: {json.dumps(progress_data)}\n\n"
                    last_progress = current_progress
                    last_phase = current_phase
                
                # Check if test is complete
                if active_test.get("results") is not None:
                    complete_data = {
                        "type": "complete",
                        "results": active_test["results"]
                    }
                    yield f"data: {json.dumps(complete_data)}\n\n"
                    break
                elif not active_test.get("running", False) and active_test.get("phase") == "stopped":
                    stopped_data = {
                        "type": "stopped",
                        "message": active_test.get("details", "Test stopped")
                    }
                    yield f"data: {json.dumps(stopped_data)}\n\n"
                    break
                
                # Wait before next update
                await asyncio.sleep(0.5)
                
        except Exception as e:
            logger.error(f"[GEOCODING_TEST] Error in stream: {str(e)}")
            error_data = {
                "type": "error",
                "message": f"Stream error: {str(e)}"
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )

async def run_geocoding_test_background(test_request: GeocodingTestRequest):
    """Background function to run comprehensive geocoding test"""
    global active_test
    
    start_time = time.time()
    results = {
        "online": {"success": False, "total_results": 0, "error": None},
        "offline": {"success": False, "total_results": 0, "error": None},
        "sample_results": [],
        "total_time": None,
        "test_config": test_request.dict()
    }
    
    try:
        logger.info(f"[GEOCODING_TEST] Starting test for {test_request.location_name} at ({test_request.lat}, {test_request.lon})")
        
        # Generate test points
        active_test.update({
            "progress": 10,
            "phase": "generating_points",
            "details": "Generando puntos de prueba..."
        })
        
        test_points = [(test_request.lat, test_request.lon, "center")]
        
        if test_request.generate_grid:
            grid_points = generate_comprehensive_grid_coverage(
                test_request.lat, 
                test_request.lon, 
                test_request.radius_km
            )
            test_points.extend([(p[0], p[1], "grid") for p in grid_points[:test_request.max_results-1]])
        
        total_points = len(test_points)
        logger.info(f"[GEOCODING_TEST] Generated {total_points} test points")
        
        # Test Online Geocoding
        if test_request.test_type in ["online", "both"]:
            active_test.update({
                "progress": 20,
                "phase": "testing_online",
                "details": "Probando geocodificación online..."
            })
            
            try:
                online_start = time.time()
                online_results, online_stats = await test_online_geocoding(test_points, test_request)
                online_end = time.time()
                
                results["online_results"] = {
                    "success": True,
                    "response_time": f"{online_end - online_start:.2f}",
                    "points_processed": online_stats.get("points_processed", 0),
                    "results_found": len(online_results),
                    "sample_results": online_results[:5],  # First 5 results as samples
                    "api_calls_made": online_stats.get("api_calls", 0),
                    "api_call_rate": online_stats.get("call_rate", "N/A"),
                    "error": None
                }
                
                logger.info(f"[GEOCODING_TEST] Online test completed: {len(online_results)} results in {online_end - online_start:.2f}s")
                
            except Exception as e:
                logger.error(f"[GEOCODING_TEST] Online test failed: {str(e)}")
                results["online_results"] = {
                    "success": False,
                    "response_time": "N/A",
                    "points_processed": 0,
                    "results_found": 0,
                    "sample_results": [],
                    "api_calls_made": 0,
                    "api_call_rate": "N/A",
                    "error": str(e)
                }
        
        # Test Offline Geocoding
        if test_request.test_type in ["offline", "both"]:
            active_test.update({
                "progress": 60,
                "phase": "testing_offline",
                "details": "Probando geocodificación offline..."
            })
            
            try:
                offline_start = time.time()
                offline_results, offline_stats = await test_offline_geocoding(test_points, test_request)
                offline_end = time.time()
                
                results["offline_results"] = {
                    "success": True,
                    "response_time": f"{offline_end - offline_start:.2f}",
                    "points_processed": offline_stats.get("points_processed", 0),
                    "method": offline_stats.get("method", "unknown"),
                    "database_records": offline_stats.get("db_records", 0),
                    "csv_records": offline_stats.get("csv_records", 0),
                    "cache_hits": offline_stats.get("cache_hits", 0),
                    "sample_results": offline_results[:5],  # First 5 results as samples
                    "error": None
                }
                
                logger.info(f"[GEOCODING_TEST] Offline test completed: {offline_stats.get('db_records', 0)} DB records found in {offline_end - offline_start:.2f}s")
                
            except Exception as e:
                logger.error(f"[GEOCODING_TEST] Offline test failed: {str(e)}")
                results["offline_results"] = {
                    "success": False,
                    "response_time": "N/A",
                    "points_processed": 0,
                    "method": test_request.offline_method,
                    "database_records": 0,
                    "csv_records": 0,
                    "cache_hits": 0,
                    "sample_results": [],
                    "error": str(e)
                }
        
        # Complete test
        end_time = time.time()
        results["total_time"] = f"{end_time - start_time:.2f} segundos"
        
        active_test.update({
            "progress": 100,
            "phase": "completed",
            "details": "Prueba completada exitosamente",
            "running": False,
            "results": results
        })
        
        logger.info(f"[GEOCODING_TEST] Test completed in {results['total_time']}")
        
    except Exception as e:
        logger.error(f"[GEOCODING_TEST] Test failed: {str(e)}", exc_info=True)
        active_test.update({
            "progress": 0,
            "phase": "error",
            "details": f"Error en la prueba: {str(e)}",
            "running": False,
            "results": {
                **results,
                "error": str(e),
                "total_time": f"{time.time() - start_time:.2f} segundos"
            }
        })

async def test_online_geocoding(test_points, config):
    """Test online geocoding services"""
    results = []
    stats = {
        "points_processed": 0,
        "api_calls": 0,
        "call_rate": "N/A",
        "errors": 0
    }
    
    try:
        geocoding_downloader = GeodataDownloader()
        test_limit = min(10, len(test_points))  # Limit for testing
        start_time = time.time()
        
        for i, (lat, lon, point_type) in enumerate(test_points[:test_limit]):
            if not active_test.get("running", False):
                break
                
            try:
                # Update progress
                progress = 20 + (i / test_limit) * 40
                active_test.update({
                    "progress": progress,
                    "details": f"Probando punto online {i+1}/{test_limit}: ({lat:.4f}, {lon:.4f})"
                })
                
                # Test reverse geocoding
                result = await geocoding_downloader.fetch_reverse_geocoding_from_nominatim(lat, lon)
                stats["api_calls"] += 1
                stats["points_processed"] += 1
                
                if result:
                    results.append({
                        "lat": lat,
                        "lon": lon,
                        "point_type": point_type,
                        "source": "nominatim_online",
                        "display_name": result.get("display_name", ""),
                        "address": result.get("address", {}),
                        "timestamp": datetime.now().isoformat()
                    })
                
                # Small delay to be respectful
                await asyncio.sleep(0.2)
                
            except Exception as e:
                logger.warning(f"Error testing online point {i}: {str(e)}")
                stats["errors"] += 1
                continue
        
        # Calculate call rate
        elapsed_time = time.time() - start_time
        if elapsed_time > 0:
            stats["call_rate"] = f"{stats['api_calls'] / elapsed_time:.2f} calls/sec"
                
    except Exception as e:
        logger.error(f"Online geocoding test failed: {str(e)}")
        raise
    
    return results, stats

async def test_offline_geocoding(test_points, config):
    """Test offline geocoding using the specified method"""
    results = []
    stats = {
        "points_processed": 0,
        "db_records": 0,
        "cache_hits": 0,
        "errors": 0,
        "method": config.offline_method
    }
    
    try:
        # Choose the offline method based on configuration
        if config.offline_method == "csv":
            return await test_csv_geocoding(test_points, config)
        else:  # default to database
            return await test_database_geocoding(test_points, config)
                
    except Exception as e:
        logger.error(f"Offline geocoding test failed: {str(e)}")
        raise
    
    return results, stats

async def test_database_geocoding(test_points, config):
    """Test offline geocoding using database method"""
    results = []
    stats = {
        "points_processed": 0,
        "db_records": 0,
        "cache_hits": 0,
        "errors": 0,
        "method": "database"
    }
    
    try:
        db_storage = DBStorage()
        
        if not await db_storage.is_available():
            raise Exception("Offline database not available")
        
        # Get total record count for statistics
        total_records = await db_storage.get_record_count()
        
        test_limit = min(20, len(test_points))  # Test more points for offline
        
        for i, (lat, lon, point_type) in enumerate(test_points[:test_limit]):
            if not active_test.get("running", False):
                break
                
            try:
                # Update progress
                progress = 60 + (i / test_limit) * 30
                active_test.update({
                    "progress": progress,
                    "details": f"Probando punto offline (DB) {i+1}/{test_limit}: ({lat:.4f}, {lon:.4f})"
                })
                
                # Test offline reverse geocoding
                result = await db_storage.reverse_geocode(lat, lon)
                stats["points_processed"] += 1
                
                if result:
                    stats["db_records"] += 1
                    results.append({
                        "lat": lat,
                        "lon": lon,
                        "point_type": point_type,
                        "source": "offline_database",
                        "address": result.get("name", ""),
                        "admin1": result.get("admin1", ""),
                        "admin2": result.get("admin2", ""),
                        "country": result.get("cc", ""),
                        "distance": result.get("distance", 0),
                        "timestamp": datetime.now().isoformat()
                    })
                
            except Exception as e:
                logger.warning(f"Error testing offline point {i}: {str(e)}")
                stats["errors"] += 1
                continue
        
        # Set total database records available
        stats["db_records"] = total_records
                
    except Exception as e:
        logger.error(f"Database geocoding test failed: {str(e)}")
        raise
    
    return results, stats

async def test_csv_geocoding(test_points, config):
    """Test offline geocoding using CSV/reverse_geocoder method"""
    results = []
    stats = {
        "points_processed": 0,
        "csv_records": 0,
        "cache_hits": 0,
        "errors": 0,
        "method": "csv"
    }
    
    try:
        # Try to import reverse_geocoder
        try:
            import reverse_geocoder as rg
        except ImportError:
            raise Exception("reverse_geocoder library not installed. Please install it with: pip install reverse_geocoder")
        
        test_limit = min(20, len(test_points))  # Test more points for offline
        
        for i, (lat, lon, point_type) in enumerate(test_points[:test_limit]):
            if not active_test.get("running", False):
                break
                
            try:
                # Update progress
                progress = 60 + (i / test_limit) * 30
                active_test.update({
                    "progress": progress,
                    "details": f"Probando punto offline (CSV) {i+1}/{test_limit}: ({lat:.4f}, {lon:.4f})"
                })
                
                # Test reverse geocoding using reverse_geocoder
                result = rg.search([(lat, lon)])
                stats["points_processed"] += 1
                
                if result and len(result) > 0:
                    location = result[0]  # Get first result
                    stats["csv_records"] += 1
                    results.append({
                        "lat": lat,
                        "lon": lon,
                        "point_type": point_type,
                        "source": "reverse_geocoder_csv",
                        "address": location.get("name", ""),
                        "admin1": location.get("admin1", ""),
                        "admin2": location.get("admin2", ""),
                        "country": location.get("cc", ""),
                        "timestamp": datetime.now().isoformat()
                    })
                
            except Exception as e:
                logger.warning(f"Error testing CSV point {i}: {str(e)}")
                stats["errors"] += 1
                continue
        
        # Get approximate record count for reverse_geocoder
        try:
            # Test a few points to see if reverse_geocoder is working
            test_result = rg.search([(0, 0)])
            stats["csv_records"] = len(test_result) if test_result else 0
        except:
            stats["csv_records"] = 0
                
    except Exception as e:
        logger.error(f"CSV geocoding test failed: {str(e)}")
        raise
    
    return results, stats
