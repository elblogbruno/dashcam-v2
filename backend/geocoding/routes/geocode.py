from fastapi import APIRouter, HTTPException
import requests
import logging
from typing import Optional
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define router
router = APIRouter()

# These will be initialized from main.py
reverse_geocoding_service = None
reverse_geocoding_worker = None

class ProcessClipRequest(BaseModel):
    clip_id: int

@router.get("/reverse")
async def reverse_geocode(lat: float, lon: float):
    """Get location name from coordinates using OpenStreetMap Nominatim API"""
    try:
        # Use Nominatim API for reverse geocoding
        reverse_url = "https://nominatim.openstreetmap.org/reverse"
        
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json",
            "zoom": 14,  # Choose appropriate zoom level for neighborhood-level results
            "addressdetails": 1
        }
        
        # Add user-agent to comply with Nominatim usage policy
        headers = {
            "User-Agent": "DashcamV2/1.0"
        }
        
        logger.info(f"Reverse geocoding request for coordinates: {lat}, {lon}")
        
        response = requests.get(reverse_url, params=params, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Reverse geocoding full result: {result}")
        logger.info(f"Reverse geocoding display_name: {result.get('display_name', 'Unknown location')}")
        
        return result
    except Exception as e:
        logger.error(f"Error in reverse geocoding: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reverse geocode: {str(e)}")


@router.get("/worker/status")
async def get_worker_status():
    """Get reverse geocoding worker status and statistics"""
    if not reverse_geocoding_worker:
        raise HTTPException(status_code=503, detail="Reverse geocoding worker not available")
    
    try:
        stats = reverse_geocoding_worker.get_stats()
        return {
            "status": "success",
            "worker_running": stats.get('worker_running', False),
            "clips_pending": stats.get('clips_pending', 0),
            "worker_stats": stats.get('worker_stats', {})
        }
    except Exception as e:
        logger.error(f"Error getting worker status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting worker status: {str(e)}")


@router.post("/worker/process-clip")
async def process_clip(request: ProcessClipRequest):
    """Process a specific clip for reverse geocoding"""
    if not reverse_geocoding_worker:
        raise HTTPException(status_code=503, detail="Reverse geocoding worker not available")
    
    try:
        success = reverse_geocoding_worker.process_single_clip(request.clip_id)
        return {
            "status": "success" if success else "failed",
            "clip_id": request.clip_id,
            "processed": success
        }
    except Exception as e:
        logger.error(f"Error processing clip {request.clip_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing clip: {str(e)}")


@router.post("/worker/restart")
async def restart_worker():
    """Restart the reverse geocoding worker"""
    if not reverse_geocoding_worker:
        raise HTTPException(status_code=503, detail="Reverse geocoding worker not available")
    
    try:
        reverse_geocoding_worker.stop()
        await reverse_geocoding_worker.start()
        return {
            "status": "success",
            "message": "Worker restarted successfully"
        }
    except Exception as e:
        logger.error(f"Error restarting worker: {e}")
        raise HTTPException(status_code=500, detail=f"Error restarting worker: {str(e)}")


@router.get("/offline/stats")
async def get_offline_stats():
    """Get offline geocoding database statistics"""
    if not reverse_geocoding_service:
        raise HTTPException(status_code=503, detail="Reverse geocoding service not available")
    
    try:
        # Obtener estadísticas básicas del almacenamiento offline
        db_storage = reverse_geocoding_service.db_storage
        
        # Contar entradas en la base de datos
        total_locations = db_storage.get_total_count() if hasattr(db_storage, 'get_total_count') else 0
        
        return {
            "status": "success",
            "offline_database": {
                "total_locations": total_locations,
                "database_available": True
            },
            "message": "Sistema simplificado - usando SQLite + Nominatim"
        }
    except Exception as e:
        logger.error(f"Error getting offline stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting offline stats: {str(e)}")


@router.get("/reverse-offline-first")
async def reverse_geocode_offline_first(lat: float, lon: float):
    """Get location name from coordinates using offline database first, then Nominatim as fallback"""
    try:
        global reverse_geocoding_service
        
        if not reverse_geocoding_service:
            raise HTTPException(status_code=503, detail="Reverse geocoding service not available")
        
        logger.info(f"Reverse geocoding (offline-first) request for coordinates: {lat:.6f}, {lon:.6f}")
        
        # Use the offline-first reverse geocoding service
        result = await reverse_geocoding_service.get_location(lat, lon)
        
        if result:
            # Determinar la fuente de los datos con descripción amigable
            source_descriptions = {
                'offline': '🔒 Base de datos local (offline)',
                'online': '🌐 Servicio online (Nominatim)',
                'cache': '⚡ Caché en memoria'
            }
            
            source_display = source_descriptions.get(result.source, f"📍 {result.source or 'Desconocido'}")
            
            response_data = {
                "status": "success",
                "location": {
                    "city": result.city,
                    "state": result.state,
                    "country": result.country,
                    "country_code": result.country_code,
                    "display_name": result.get_display_name(),
                },
                "coordinates": {
                    "lat": lat,
                    "lon": lon
                },
                "data_source": {
                    "type": result.source or "unknown",
                    "description": source_display
                }
            }
            
            logger.info(f"Reverse geocoding result: {result.city}, {result.state}, {result.country} (fuente: {result.source})")
            return response_data
        else:
            logger.warning(f"No reverse geocoding result found for {lat:.6f}, {lon:.6f}")
            return {
                "status": "not_found",
                "message": "No location found for the given coordinates",
                "coordinates": {"lat": lat, "lon": lon}
            }
            
    except Exception as e:
        logger.error(f"Error in offline-first reverse geocoding: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reverse geocode: {str(e)}")


@router.get("/service-stats")
async def get_service_stats():
    """Get statistics about the reverse geocoding service"""
    try:
        global reverse_geocoding_service
        
        if not reverse_geocoding_service:
            raise HTTPException(status_code=503, detail="Reverse geocoding service not available")
        
        stats = reverse_geocoding_service.get_stats()
        return {
            "status": "success",
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting service stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
