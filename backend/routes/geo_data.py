from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# These will be initialized from main.py
offline_geo_manager = None
trip_geo_manager = None

class GeoDataRegion(BaseModel):
    name: str
    bounds: Dict[str, float]  # {"north": lat, "south": lat, "east": lon, "west": lon}
    
class DownloadGeoDataRequest(BaseModel):
    regions: List[GeoDataRegion]
    trip_id: Optional[str] = None

class TripGeoDataRequest(BaseModel):
    trip_id: str
    coordinates: List[List[float]]  # [[lat, lon], ...]
    buffer_km: Optional[float] = 10.0

@router.post("/download-regions")
async def download_geo_data(request: DownloadGeoDataRequest, background_tasks: BackgroundTasks):
    """Download geographic data for specified regions"""
    if not offline_geo_manager:
        raise HTTPException(status_code=503, detail="Offline geo manager not available")
    
    try:
        download_tasks = []
        for region in request.regions:
            task_result = await offline_geo_manager.download_region_data(
                region.name, 
                region.bounds
            )
            download_tasks.append(task_result)
        
        return {
            "status": "success",
            "downloads_started": len(download_tasks),
            "regions": [region.name for region in request.regions],
            "tasks": download_tasks
        }
    except Exception as e:
        logger.error(f"Error downloading geo data: {e}")
        raise HTTPException(status_code=500, detail=f"Error downloading geo data: {str(e)}")

@router.post("/download-for-trip")
async def download_geo_data_for_trip(request: TripGeoDataRequest, background_tasks: BackgroundTasks):
    """Download geographic data for a specific trip route"""
    if not trip_geo_manager:
        raise HTTPException(status_code=503, detail="Trip geo manager not available")
    
    try:
        result = await trip_geo_manager.download_trip_geo_data(
            request.trip_id,
            request.coordinates,
            buffer_km=request.buffer_km
        )
        
        return {
            "status": "success",
            "trip_id": request.trip_id,
            "coordinates_count": len(request.coordinates),
            "buffer_km": request.buffer_km,
            "download_result": result
        }
    except Exception as e:
        logger.error(f"Error downloading trip geo data: {e}")
        raise HTTPException(status_code=500, detail=f"Error downloading trip geo data: {str(e)}")

@router.get("/regions/{region_name}/status")
async def get_region_status(region_name: str):
    """Get download status and information for a specific region"""
    if not offline_geo_manager:
        raise HTTPException(status_code=503, detail="Offline geo manager not available")
    
    try:
        status = await offline_geo_manager.get_region_status(region_name)
        return {
            "status": "success",
            "region": region_name,
            "download_status": status
        }
    except Exception as e:
        logger.error(f"Error getting region status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting region status: {str(e)}")

@router.get("/available-regions")
async def get_available_regions():
    """Get list of available geographic regions for download"""
    if not offline_geo_manager:
        raise HTTPException(status_code=503, detail="Offline geo manager not available")
    
    try:
        regions = await offline_geo_manager.get_available_regions()
        return {
            "status": "success",
            "regions": regions,
            "count": len(regions)
        }
    except Exception as e:
        logger.error(f"Error getting available regions: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting available regions: {str(e)}")

@router.get("/downloaded-regions")
async def get_downloaded_regions():
    """Get list of already downloaded geographic regions"""
    if not offline_geo_manager:
        raise HTTPException(status_code=503, detail="Offline geo manager not available")
    
    try:
        regions = await offline_geo_manager.get_downloaded_regions()
        return {
            "status": "success",
            "regions": regions,
            "count": len(regions)
        }
    except Exception as e:
        logger.error(f"Error getting downloaded regions: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting downloaded regions: {str(e)}")

@router.delete("/regions/{region_name}")
async def delete_region_data(region_name: str):
    """Delete downloaded geographic data for a specific region"""
    if not offline_geo_manager:
        raise HTTPException(status_code=503, detail="Offline geo manager not available")
    
    try:
        success = await offline_geo_manager.delete_region_data(region_name)
        return {
            "status": "success" if success else "failed",
            "region": region_name,
            "deleted": success
        }
    except Exception as e:
        logger.error(f"Error deleting region data: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting region data: {str(e)}")

@router.get("/trip/{trip_id}/geo-data")
async def get_trip_geo_data_status(trip_id: str):
    """Get geographic data status for a specific trip"""
    if not trip_geo_manager:
        raise HTTPException(status_code=503, detail="Trip geo manager not available")
    
    try:
        status = await trip_geo_manager.get_trip_geo_status(trip_id)
        return {
            "status": "success",
            "trip_id": trip_id,
            "geo_data_status": status
        }
    except Exception as e:
        logger.error(f"Error getting trip geo data status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting trip geo data status: {str(e)}")

@router.post("/trip/{trip_id}/upload-geo-data")
async def upload_trip_geo_data(trip_id: str):
    """Upload local geographic data for a trip to cloud storage"""
    if not trip_geo_manager:
        raise HTTPException(status_code=503, detail="Trip geo manager not available")
    
    try:
        result = await trip_geo_manager.upload_trip_geo_data(trip_id)
        return {
            "status": "success",
            "trip_id": trip_id,
            "upload_result": result
        }
    except Exception as e:
        logger.error(f"Error uploading trip geo data: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading trip geo data: {str(e)}")

@router.get("/system/status")
async def get_geo_system_status():
    """Get overall status of the geographic data management system"""
    try:
        status = {
            "offline_geo_manager": offline_geo_manager is not None,
            "trip_geo_manager": trip_geo_manager is not None
        }
        
        if offline_geo_manager:
            status["offline_stats"] = await offline_geo_manager.get_system_stats()
        
        if trip_geo_manager:
            status["trip_stats"] = await trip_geo_manager.get_system_stats()
        
        return {
            "status": "success",
            "system_status": status
        }
    except Exception as e:
        logger.error(f"Error getting geo system status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting geo system status: {str(e)}")
