# Backend routes for handling Organic Maps (.mwm) files
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, File, UploadFile, Query, Depends
from fastapi.responses import JSONResponse, FileResponse, Response
import os
import json
import requests
import logging
import aiohttp
import aiofiles
import hashlib
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import asyncio
import tempfile
import shutil
from datetime import datetime
import subprocess
import zipfile
import io
import math
import sys

# Importar módulos modularizados
from .organic_maps_utils import server_connection
from .organic_maps_utils import region_search
from .organic_maps_utils import download

# Define router
router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Will be initialized from main.py
config = None

# Base directory for Organic Maps files
ORGANIC_MAPS_DIR = "organic_maps"

# List of available regions (will be loaded from the Organic Maps server or a local file)
available_regions = None

# Store download tasks
active_downloads = {}

# Inicializar variables en módulos
def init_modules(app_config):
    """Inicializa las variables de configuración en los módulos"""
    global config
    config = app_config
    
    # Pasar configuración a los módulos
    server_connection.config = app_config
    server_connection.ORGANIC_MAPS_DIR = ORGANIC_MAPS_DIR
    region_search.config = app_config
    download.config = app_config
    download.ORGANIC_MAPS_DIR = ORGANIC_MAPS_DIR
    
    # Inicializar la URL base en el módulo de conexión
    server_connection.init_urls()

class TileRequest(BaseModel):
    z: int
    x: int
    y: int

class OrganicTripRequest(BaseModel):
    trip_id: str
    coordinates: List[List[float]]

class RegionRequest(BaseModel):
    region_id: str

class CoordinatesTestRequest(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float

class CountryMapsForRouteRequest(BaseModel):
    coordinates: List[List[float]]  # Lista de coordenadas [[lat, lon], ...]

@router.get("/regions")
async def get_available_regions():
    """Get the list of available regions from Organic Maps"""
    global available_regions
    
    try:
        # Verificar la disponibilidad de los espejos
        working_url = await server_connection.check_mirror_availability()
        
        # Check if we have a cached list of regions
        if available_regions is None:
            # First try to load from the local cache
            regions_cache_path = os.path.join(config.data_path, ORGANIC_MAPS_DIR, "regions_cache.json")
            
            if os.path.exists(regions_cache_path):
                try:
                    with open(regions_cache_path, "r") as f:
                        cache_data = json.load(f)
                        
                    if "timestamp" in cache_data and "regions" in cache_data:
                        # Only use cache if it's less than 7 days old
                        cache_time = datetime.fromisoformat(cache_data["timestamp"])
                        age = datetime.now() - cache_time
                        
                        if age.days < 7:
                            available_regions = cache_data["regions"]
                            logger.info(f"Using cached regions list (age: {age.days} days)")
                except Exception as e:
                    logger.warning(f"Failed to load regions from cache: {str(e)}")
            
            # If no cache or expired, fetch from Organic Maps
            if available_regions is None:
                # Create a directory for Organic Maps if it doesn't exist
                os.makedirs(os.path.join(config.data_path, ORGANIC_MAPS_DIR), exist_ok=True)
                
                try:
                    # Obtener la lista de archivos disponibles en el servidor
                    logger.info("Fetching available map files from server...")
                    MAP_VERSION = "250511"  # Versión más reciente de los mapas
                    map_files = await server_connection.get_available_map_files(MAP_VERSION)
                    
                    if map_files and len(map_files) > 0:
                        available_regions = map_files
                        logger.info(f"Successfully fetched {len(available_regions)} map regions from server")
                    else:
                        raise Exception("No map files found on server")
                        
                except Exception as e:
                    logger.error(f"Error fetching map files from server: {str(e)}")
                    # Si falla, usamos una lista de respaldo muy pequeña
                    logger.warning("Using backup regions list")
                    available_regions = [
                        {
                            "id": "US_California_LA",
                            "name": "US California LA",
                            "parent_id": "US_California",
                            "size_mb": 272,
                            "mwm_url": f"{server_connection.ORGANIC_MAPS_BASE_URL}/{MAP_VERSION}/US_California_LA.mwm",
                            "map_version": MAP_VERSION
                        },
                        {
                            "id": "US_Arizona_Phoenix",
                            "name": "US Arizona Phoenix",
                            "parent_id": "US_Arizona",
                            "size_mb": 165,
                            "mwm_url": f"{server_connection.ORGANIC_MAPS_BASE_URL}/{MAP_VERSION}/US_Arizona_Phoenix.mwm",
                            "map_version": MAP_VERSION
                        }
                    ]
                
                # Save to cache
                with open(regions_cache_path, "w") as f:
                    json.dump({
                        "timestamp": datetime.now().isoformat(),
                        "regions": available_regions
                    }, f, indent=2)
                
                logger.info(f"Saved regions list to cache")
        
        return {"regions": available_regions}
    except Exception as e:
        logger.error(f"Error fetching available regions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching available regions: {str(e)}")

@router.post("/regions-for-trip")
async def get_regions_for_trip(request: OrganicTripRequest):
    """Get the list of required regions for a trip"""
    try:
        # Get all available regions
        regions_response = await get_available_regions()
        all_regions = regions_response.get("regions", [])
        
        logger.info(f"Buscando regiones para viaje con {len(request.coordinates)} coordenadas")
        
        # Usar la función modularizada para encontrar regiones basadas en las coordenadas
        required_regions = await region_search.find_regions_for_coordinates(request.coordinates, all_regions)
        
        # Si no se encontraron regiones, intentar otro enfoque más general
        if not required_regions:
            logger.warning("No se encontraron regiones específicas, usando enfoque alternativo")
            
            # Extraer límites del viaje
            lats = [coord[0] for coord in request.coordinates]
            lons = [coord[1] for coord in request.coordinates]
            
            min_lat, max_lat = min(lats), max(lats)
            min_lon, max_lon = min(lons), max(lons)
            route_width = max_lon - min_lon
            
            logger.info(f"Enfoque alternativo para ruta: lat {min_lat}-{max_lat}, lon {min_lon}-{max_lon}, ancho: {route_width}°")
            
            # Para rutas amplias, buscar de forma más agresiva
            max_regions_to_find = 2 if route_width < 10 else min(8, max(3, int(route_width / 3)))
            logger.info(f"Buscando hasta {max_regions_to_find} regiones para esta ruta")
            
            # Buscar por país y regiones importantes
            search_terms = []
            
            # EEUU
            if (24 <= max_lat <= 50 and -125 <= min_lon <= -66):
                # Incluir nombre del país
                search_terms.extend(["US", "USA", "United States"])
                
                # Para rutas largas, dividir en secciones
                if route_width > 10:
                    sections = max(2, min(4, int(route_width / 10)))
                    section_width = route_width / sections
                    
                    for i in range(sections):
                        section_min_lon = min_lon + (i * section_width)
                        section_max_lon = min_lon + ((i + 1) * section_width)
                        
                        # West Coast
                        if (-125 <= section_max_lon <= -115):
                            search_terms.extend(["California", "Oregon", "Washington"])
                        
                        # Mountain West
                        if (-115 <= section_max_lon <= -105):
                            search_terms.extend(["Nevada", "Utah", "Arizona", "Colorado"])
                        
                        # Central
                        if (-105 <= section_max_lon <= -95):
                            search_terms.extend(["Colorado", "Kansas", "Nebraska"])
                        
                        # Midwest
                        if (-95 <= section_max_lon <= -85):
                            search_terms.extend(["Missouri", "Illinois", "Chicago"])
                
                # Añadir estados individuales basados en coordenadas
                if (32 <= max_lat <= 42 and -124 <= min_lon <= -114):
                    search_terms.append("California")
                if (31 <= max_lat <= 37 and -115 <= min_lon <= -109):
                    search_terms.append("Arizona")
                if (35 <= max_lat <= 42 and -120 <= min_lon <= -114):
                    search_terms.append("Nevada")
                if (37 <= max_lat <= 42 and -114 <= min_lon <= -109):
                    search_terms.append("Utah")
                if (37 <= max_lat <= 41 and -109 <= min_lon <= -102):
                    search_terms.append("Colorado")
                if (37 <= max_lat <= 40 and -102 <= min_lon <= -94.5):
                    search_terms.append("Kansas")
                if (36 <= max_lat <= 40.5 and -95.7 <= min_lon <= -89.1):
                    search_terms.append("Missouri")
                if (37 <= max_lat <= 42.5 and -91.5 <= min_lon <= -87.5):
                    search_terms.append("Illinois")
                if (41 <= max_lat <= 42.5 and -88 <= min_lon <= -87.5):
                    search_terms.append("Chicago")
                if (26 <= max_lat <= 36 and -106 <= min_lon <= -93):
                    search_terms.append("Texas")
            
            # Eliminar duplicados y registrar términos de búsqueda
            search_terms = list(set(search_terms))
            logger.info(f"Términos de búsqueda: {', '.join(search_terms)}")
            
            # Si tenemos términos de búsqueda, buscar por nombre
            if search_terms:
                # Primero buscar coincidencias exactas para los estados/ciudades
                for term in search_terms:
                    for region in all_regions:
                        if region["id"] == term or region["id"] == f"US_{term}":
                            if region not in required_regions:
                                required_regions.append(region)
                                logger.info(f"Coincidencia exacta encontrada para '{term}': {region['id']}")
                
                # Luego buscar coincidencias parciales
                if len(required_regions) < max_regions_to_find:
                    for term in search_terms:
                        matching_regions = [r for r in all_regions if term in r["id"] and r not in required_regions]
                        # Ordenar por tamaño para priorizar regiones específicas (más pequeñas)
                        matching_regions.sort(key=lambda r: r.get("size_mb", 9999))
                        
                        # Añadir las regiones más específicas primero
                        for region in matching_regions:
                            if len(required_regions) < max_regions_to_find:
                                required_regions.append(region)
                                logger.info(f"Coincidencia parcial para '{term}': {region['id']}")
                            else:
                                break
            
        # Save the request for this trip
        trip_dir = os.path.join(config.data_path, ORGANIC_MAPS_DIR, request.trip_id)
        os.makedirs(trip_dir, exist_ok=True)
        
        with open(os.path.join(trip_dir, "trip_regions.json"), "w") as f:
            json.dump({
                "trip_id": request.trip_id,
                "coordinates": request.coordinates,
                "required_regions": [r["id"] for r in required_regions],
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
            
        return {
            "trip_id": request.trip_id,
            "regions": required_regions
        }
    except Exception as e:
        logger.error(f"Error identifying regions for trip: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error identifying regions: {str(e)}")

@router.post("/download-region/{region_id}")
async def download_region_mwm(region_id: str, background_tasks: BackgroundTasks):
    """Start downloading an MWM file for a region"""
    try:
        # Check if the region is available
        regions_response = await get_available_regions()
        all_regions = regions_response.get("regions", [])
        
        region = next((r for r in all_regions if r["id"] == region_id), None)
        if not region:
            raise HTTPException(status_code=404, detail=f"Region {region_id} not found")
        
        # Create directory for the region if it doesn't exist
        region_dir = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id)
        os.makedirs(region_dir, exist_ok=True)
        
        # Check if the file already exists
        mwm_file_path = os.path.join(region_dir, f"{region_id}.mwm")
        if os.path.exists(mwm_file_path):
            return {
                "status": "already_exists",
                "region_id": region_id,
                "message": f"MWM file for {region_id} already exists",
                "file_path": mwm_file_path
            }
        
        # Initialize metadata file
        metadata = {
            "region_id": region_id,
            "name": region.get("name", region_id),
            "size_mb": region.get("size_mb", 0),
            "download_started": datetime.now().isoformat(),
            "download_completed": None,
            "status": "in_progress",
            "mwm_url": region.get("mwm_url", "")
        }
        
        # Save initial metadata
        metadata_path = os.path.join(region_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        # Start download in background
        background_tasks.add_task(
            download.download_mwm_background_task,
            region_id,
            region.get("mwm_url", ""),
            mwm_file_path,
            metadata_path
        )
        
        return {
            "status": "started",
            "region_id": region_id,
            "message": f"Download started for MWM file of {region_id}",
            "size_mb": region.get("size_mb", 0)
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error starting MWM download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error starting download: {str(e)}")

@router.get("/status/{region_id}")
async def check_mwm_download_status(region_id: str):
    """Check the status of an MWM download"""
    try:
        metadata_path = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id, "metadata.json")
        
        if not os.path.exists(metadata_path):
            return {
                "status": "not_found",
                "message": f"No download found for region {region_id}"
            }
        
        # Read metadata
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        
        return {
            "status": metadata.get("status", "unknown"),
            "progress": metadata.get("progress", 0),
            "download_started": metadata.get("download_started"),
            "download_completed": metadata.get("download_completed"),
            "message": metadata.get("message", f"Downloading region {region_id}")
        }
    except Exception as e:
        logger.error(f"Error checking download status for region {region_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking download status: {str(e)}")

@router.get("/tile/{trip_id}/{z}/{x}/{y}")
async def get_mwm_tile(trip_id: str, z: int, x: int, y: int):
    """Get a map tile rendered from MWM data for a trip"""
    try:
        # Check if we have trip regions info
        trip_regions_path = os.path.join(config.data_path, ORGANIC_MAPS_DIR, trip_id, "trip_regions.json")
        
        if not os.path.exists(trip_regions_path):
            raise HTTPException(status_code=404, detail=f"No MWM data found for trip {trip_id}")
        
        # Load trip regions
        with open(trip_regions_path, "r") as f:
            trip_data = json.load(f)
        
        required_regions = trip_data.get("required_regions", [])
        
        if not required_regions:
            raise HTTPException(status_code=404, detail=f"No regions found for trip {trip_id}")
        
        # Check if we have generated Organic Maps tiles directory (not to be confused with standard OSM tiles in offline_maps)
        tiles_dir = os.path.join(config.data_path, ORGANIC_MAPS_DIR, trip_id, "tiles")
        
        # Check if the MWM-generated tile exists in our cache
        tile_path = os.path.join(tiles_dir, str(z), str(x), f"{y}.png")
        
        if os.path.exists(tile_path):
            return FileResponse(tile_path, media_type="image/png")
        
        # If the tile doesn't exist, we need to generate it from the MWM file (landmarks, POIs)
        os.makedirs(os.path.dirname(tile_path), exist_ok=True)
        
        # Try to render the tile from the MWM file
        try:
            tile_generated = await process_and_render_mwm_tile(tile_path, z, x, y, trip_id, required_regions)
            
            # If the tile was generated successfully, return it
            if tile_generated:
                return FileResponse(tile_path, media_type="image/png")
        except Exception as e:
            logger.error(f"Error processing MWM: {str(e)}")
            # Continue to generate placeholder if MWM processing fails
        
        # If we couldn't generate the tile from MWM, create a placeholder
        await generate_placeholder_tile(tile_path, z, x, y, trip_id)
        return FileResponse(tile_path, media_type="image/png")
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error getting MWM tile {z}/{x}/{y} for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting tile: {str(e)}")

async def generate_placeholder_tile(tile_path: str, z: int, x: int, y: int, trip_id: str):
    """Generate a placeholder tile for demonstration purposes"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # Create a colored image based on zoom level
        if z < 10:
            color = (200, 230, 255)  # Light blue for low zoom
        elif z < 14:
            color = (220, 255, 220)  # Light green for mid zoom
        else:
            color = (255, 255, 220)  # Light yellow for high zoom
        
        # Create the image
        img = Image.new('RGB', (256, 256), color)
        draw = ImageDraw.Draw(img)
        
        # Add tile coordinates for debug
        text = f"OM: {z}/{x}/{y}"
        draw.text((10, 10), text, fill=(0, 0, 0))
        
        # Add trip ID
        draw.text((10, 30), f"Trip: {trip_id[:8]}", fill=(0, 0, 0))
        
        # Draw a grid
        for i in range(0, 256, 32):
            draw.line([(i, 0), (i, 256)], fill=(200, 200, 200), width=1)
            draw.line([(0, i), (256, i)], fill=(200, 200, 200), width=1)
        
        # Save the image
        os.makedirs(os.path.dirname(tile_path), exist_ok=True)
        img.save(tile_path)
        
        return tile_path
    except Exception as e:
        logger.error(f"Error generating placeholder tile: {str(e)}")
        raise

async def process_and_render_mwm_tile(tile_path: str, z: int, x: int, y: int, trip_id: str, region_ids: list):
    """
    Process MWM files and render a tile for the specified coordinates.
    
    Args:
        tile_path: Path where the generated tile should be saved
        z, x, y: Tile coordinates
        trip_id: ID of the trip
        region_ids: List of region IDs to check for the tile
        
    Returns:
        bool: True if the tile was generated successfully
    """
    try:
        # Import required libraries for MWM processing
        try:
            import mapbox_vector_tile
        except ImportError:
            logger.error("mapbox_vector_tile not installed. Please install with 'pip install mapbox-vector-tile'")
            return False
            
        from PIL import Image, ImageDraw
        
        # Calculate geographic bounds for this tile
        n = 2.0 ** z
        lon_min = x / n * 360.0 - 180.0
        lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
        lon_max = (x + 1) / n * 360.0 - 180.0
        lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
        
        logger.info(f"Processing tile {z}/{x}/{y} for trip {trip_id} with bounds: {lat_min},{lon_min} - {lat_max},{lon_max}")
        
        # Check each region for data covering this tile
        for region_id in region_ids:
            mwm_file_path = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id, f"{region_id}.mwm")
            
            if not os.path.exists(mwm_file_path):
                logger.warning(f"MWM file not found for region {region_id}")
                continue
            
            logger.info(f"Checking MWM file for region {region_id}: {mwm_file_path}")
            
            try:
                # Attempt to extract vector tile data from the MWM file
                # This is where we would integrate with a library that can read MWM format
                
                # For now, we'll implement a basic solution using the mwm_parser library if available
                try:
                    # Try to import the mwm parser library if it's available
                    sys.path.append(os.path.join(config.data_path, "tools"))
                    from mwm_extractor import MWMReader
                    
                    # Initialize parser with the MWM file
                    parser = MWMReader(mwm_file_path)
                    
                    # Get vector tile data for the requested coordinates
                    vector_data = parser.extract_tile(z, x, y)
                    
                    if vector_data:
                        logger.info(f"Successfully extracted vector data from MWM for {z}/{x}/{y}")
                        
                        # Render the vector data to an image
                        img = render_vector_tile(vector_data, 256, 256)
                        
                        # Save the generated image
                        img.save(tile_path)
                        return True
                except ImportError:
                    logger.warning("mwm_extractor library not available, trying alternative method")
                except Exception as e:
                    logger.error(f"Error using mwm_extractor: {str(e)}")
                
                # Alternative approach: use binary data extraction
                # This is a simplified approach - in a real implementation, 
                # you would need to understand the MWM file format in detail
                
                # Execute an external tool if available
                mwm_tool = os.path.join(config.data_path, "tools", "mwm_tool")
                if os.path.exists(mwm_tool):
                    cmd = [
                        mwm_tool, 
                        "extract",
                        "--input", mwm_file_path,
                        "--z", str(z),
                        "--x", str(x),
                        "--y", str(y),
                        "--output", tile_path
                    ]
                    
                    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    stdout, stderr = process.communicate()
                    
                    if process.returncode == 0 and os.path.exists(tile_path):
                        logger.info(f"Successfully generated tile using mwm_tool for {z}/{x}/{y}")
                        return True
                    else:
                        logger.error(f"mwm_tool failed: {stderr.decode('utf-8')}")
                
            except Exception as e:
                logger.error(f"Error processing MWM file {region_id}: {str(e)}")
                continue
        
        # No regions had data for this tile
        logger.warning(f"No data found in any region for tile {z}/{x}/{y}")
        return False
        
    except Exception as e:
        logger.error(f"Error in process_and_render_mwm_tile: {str(e)}")
        return False

def render_vector_tile(vector_data, width=256, height=256):
    """
    Render vector tile data to a PNG image
    
    Args:
        vector_data: Vector tile data in MVT format
        width, height: Dimensions of the output image
        
    Returns:
        PIL.Image: The rendered tile
    """
    try:
        import mapbox_vector_tile
        from PIL import Image, ImageDraw
        
        # Create a blank image
        img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        
        try:
            # Parse MVT data
            tile_data = mapbox_vector_tile.decode(vector_data)
            
            # Process each layer in the vector tile
            for layer_name, layer in tile_data.items():
                # Choose color based on layer type
                if layer_name == 'road' or layer_name == 'roads':
                    color = (120, 120, 120, 255)  # Gray for roads
                elif layer_name == 'building' or layer_name == 'buildings':
                    color = (200, 200, 200, 255)  # Light gray for buildings
                elif layer_name == 'water':
                    color = (100, 149, 237, 255)  # Cornflower blue for water
                elif layer_name == 'landuse':
                    color = (173, 216, 140, 255)  # Light green for landuse
                else:
                    color = (0, 0, 0, 255)  # Black for other features
                
                # Draw each feature in the layer
                for feature in layer['features']:
                    geometry_type = feature['type']
                    geometry = feature['geometry']
                    
                    if geometry_type == 'LineString':
                        for line in geometry:
                            points = [(p[0], p[1]) for p in line]
                            draw.line(points, fill=color, width=1)
                    elif geometry_type == 'Polygon':
                        for polygon in geometry:
                            points = [(p[0], p[1]) for p in polygon]
                            draw.polygon(points, outline=color, fill=color[:3] + (100,))
                    elif geometry_type == 'Point':
                        for point in geometry:
                            draw.ellipse((point[0]-2, point[1]-2, point[0]+2, point[1]+2), fill=color)
        
        except Exception as e:
            logger.error(f"Error rendering vector tile: {str(e)}")
            # Draw a message in the image indicating an error
            draw.text((10, 10), "Error rendering tile", fill=(255, 0, 0, 255))
        
        return img
    except ImportError as e:
        logger.error(f"Required module not found: {str(e)}")
        # Create a simple error image
        from PIL import Image, ImageDraw
        img = Image.new('RGB', (width, height), (255, 200, 200))
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), f"Module error: {str(e)}", fill=(255, 0, 0))
        return img
    except Exception as e:
        logger.error(f"Unexpected error in render_vector_tile: {str(e)}")
        # Create a simple error image
        from PIL import Image, ImageDraw
        img = Image.new('RGB', (width, height), (255, 200, 200))
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Error", fill=(255, 0, 0))
        return img

# Después de la definición de ORGANIC_MAPS_BASE_URL, añadimos:

# Esta función ahora se encuentra en el módulo server_connection

# Estas funciones ahora se encuentran en el módulo server_connection

@router.get("/check-mirrors")
async def check_mirrors_status():
    """Verificar la disponibilidad de los espejos de Organic Maps"""
    global ORGANIC_MAPS_BASE_URL
    
    try:
        results = []
        working_url = None
        
        async with aiohttp.ClientSession() as session:
            for url in ORGANIC_MAPS_URLS:
                try:
                    test_url = f"{url}/250511/planet.mwm"
                    start_time = datetime.now()
                    
                    async with session.head(test_url, timeout=5) as response:
                        end_time = datetime.now()
                        latency_ms = (end_time - start_time).total_seconds() * 1000
                        
                        mirror_info = {
                            "url": url,
                            "status": response.status,
                            "available": response.status == 200,
                            "latency_ms": round(latency_ms, 2),
                            "is_current": url == ORGANIC_MAPS_BASE_URL
                        }
                        
                        results.append(mirror_info)
                        
                        if mirror_info["available"] and not working_url:
                            working_url = url
                            
                except Exception as e:
                    results.append({
                        "url": url,
                        "status": None,
                        "available": False,
                        "error": str(e),
                        "is_current": url == ORGANIC_MAPS_BASE_URL
                    })
        
        # Si encontramos una URL funcional y la actual no funciona, actualizar la URL base
        current_base_url_working = any(r["available"] and r["is_current"] for r in results)
        if working_url and not current_base_url_working:
            ORGANIC_MAPS_BASE_URL = working_url
            
            # Agregar nota sobre el cambio
            results.append({
                "message": f"URL base actualizada automáticamente a {working_url}"
            })
            
        return {
            "mirrors": results,
            "current_base_url": ORGANIC_MAPS_BASE_URL
        }
    except Exception as e:
        logger.error(f"Error al verificar espejos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al verificar espejos: {str(e)}")

@router.get("/available-versions")
async def get_available_map_versions():
    """Obtiene una lista de las versiones de mapas disponibles en el servidor"""
    try:
        # Verificar que haya un espejo disponible
        working_url = await check_mirror_availability()
        
        if not working_url:
            raise HTTPException(status_code=503, detail="No hay espejos de Organic Maps disponibles")
        
        # Intentar obtener la página principal del espejo
        async with aiohttp.ClientSession() as session:
            async with session.get(working_url) as response:
                if response.status != 200:
                    raise HTTPException(status_code=response.status, detail=f"Error al acceder al servidor de mapas: {response.status}")
                
                html_content = await response.text()
                
                # Buscar directorios de versiones mediante expresión regular
                import re
                pattern = r'href="([0-9]+)/"'
                matches = re.findall(pattern, html_content)
                
                versions = []
                for version in matches:
                    versions.append({
                        "version": version,
                        "url": f"{working_url}/{version}/",
                        "is_current": version == "250511"  # Asumimos que 250511 es la versión más reciente
                    })
                
                # Ordenar versiones de más reciente a más antigua
                versions.sort(key=lambda v: v["version"], reverse=True)
                
                return {
                    "versions": versions,
                    "current_mirror": working_url
                }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error obteniendo versiones disponibles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo versiones disponibles: {str(e)}")

@router.get("/map-files/{version}")
async def get_map_files_by_version(version: str = "250511"):
    """Obtiene la lista de archivos de mapa disponibles para una versión específica"""
    try:
        files = await get_available_map_files(version)
        return {
            "version": version,
            "files_count": len(files),
            "files": files
        }
    except Exception as e:
        logger.error(f"Error obteniendo archivos de mapa para la versión {version}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo archivos de mapa: {str(e)}")

@router.get("/clear-region-cache")
async def clear_region_cache():
    """Limpiar la caché de búsqueda de regiones"""
    try:
        from .region_cache import region_search_cache
        
        # Guardar el tamaño actual para informar
        cache_size = len(region_search_cache)
        
        # Limpiar caché
        region_search_cache.clear()
        
        logger.info(f"Caché de regiones limpiada ({cache_size} entradas eliminadas)")
        
        return {
            "status": "success",
            "message": f"Caché de búsqueda de regiones limpiada ({cache_size} entradas eliminadas)"
        }
    except Exception as e:
        logger.error(f"Error al limpiar caché de regiones: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al limpiar caché de regiones: {str(e)}")

# Esta función ahora se encuentra en el módulo region_search

@router.post("/test-region-search")
async def test_region_search(request: CoordinatesTestRequest):
    """
    Endpoint de prueba para buscar regiones basadas en un rectángulo de coordenadas específico.
    Útil para depurar y verificar el algoritmo de búsqueda de regiones.
    
    Args:
        request: Objeto con min_lat, max_lat, min_lon, max_lon
        
    Returns:
        Lista de regiones que cubren las coordenadas especificadas
    """
    try:
        # Obtener todas las regiones disponibles
        regions_response = await get_available_regions()
        all_regions = regions_response.get("regions", [])
        
        if not all_regions:
            raise HTTPException(status_code=404, detail="No hay regiones disponibles")
            
        logger.info(f"Probando búsqueda de regiones para: lat {request.min_lat}-{request.max_lat}, lon {request.min_lon}-{request.max_lon}")
        
        # Crear una lista de puntos simulada en el rectángulo
        # Puntos en las esquinas y centro del rectángulo
        coordinates = [
            [request.min_lat, request.min_lon],  # Esquina inferior izquierda
            [request.min_lat, request.max_lon],  # Esquina inferior derecha
            [request.max_lat, request.min_lon],  # Esquina superior izquierda
            [request.max_lat, request.max_lon],  # Esquina superior derecha
            [(request.min_lat + request.max_lat)/2, (request.min_lon + request.max_lon)/2]  # Centro
        ]
        
        # Usar nuestra función de búsqueda
        regions = await find_regions_for_coordinates(coordinates, all_regions)
        
        return {
            "coordinates": {
                "min_lat": request.min_lat,
                "max_lat": request.max_lat,
                "min_lon": request.min_lon,
                "max_lon": request.max_lon,
                "width": request.max_lon - request.min_lon,
                "height": request.max_lat - request.min_lat
            },
            "regions_found": len(regions),
            "regions": regions
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error en prueba de búsqueda de regiones: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en prueba de búsqueda de regiones: {str(e)}")

@router.post("/retry-download/{region_id}")
async def retry_failed_download(region_id: str, background_tasks: BackgroundTasks):
    """Reintentar una descarga fallida de mapa"""
    try:
        # Verificar si el archivo de metadatos existe
        metadata_path = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id, "metadata.json")
        
        if not os.path.exists(metadata_path):
            raise HTTPException(status_code=404, detail=f"No se encontró información para la región {region_id}")
        
        # Leer metadatos actuales
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        
        # Verificar si es una descarga fallida
        if metadata.get("status") != "failed":
            return {
                "status": "no_retry_needed",
                "message": f"La descarga de {region_id} no necesita reintento (estado: {metadata.get('status')})"
            }
        
        # Construir ruta de salida
        output_dir = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id)
        output_path = os.path.join(output_dir, f"{region_id}.mwm")
        
        # Eliminar archivo parcial si existe
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
                logger.info(f"Eliminado archivo parcial para {region_id}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar archivo parcial: {str(e)}")
        
        # Obtener URL para la descarga
        mwm_url = metadata.get("mwm_url", "")
        if not mwm_url:
            # Si no hay URL en metadatos, buscar en regiones disponibles
            regions_response = await get_available_regions()
            all_regions = regions_response.get("regions", [])
            
            region = next((r for r in all_regions if r["id"] == region_id), None)
            if region:
                mwm_url = region.get("mwm_url", "")
            
            if not mwm_url:
                raise HTTPException(status_code=404, detail=f"No se pudo determinar la URL para {region_id}")
        
        # Actualizar metadatos para reiniciar la descarga
        metadata["status"] = "retrying"
        metadata["retry_started"] = datetime.now().isoformat()
        metadata["progress"] = 0
        metadata["message"] = f"Reiniciando descarga para {region_id}"
        
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        # Iniciar la descarga en segundo plano
        background_tasks.add_task(
            download.download_mwm_background_task,
            region_id,
            mwm_url,
            output_path,
            metadata_path
        )
        
        return {
            "status": "retry_started",
            "region_id": region_id,
            "message": f"Reintento de descarga iniciado para {region_id}"
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error al reintentar descarga: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al reintentar descarga: {str(e)}")

async def get_all_country_maps(country_code, all_regions=None):
    """
    Obtiene todos los mapas disponibles para un país específico.
    
    Args:
        country_code: Código del país (por ejemplo, 'US' para Estados Unidos)
        all_regions: Lista de todas las regiones disponibles (opcional, se obtendrá si no se proporciona)
        
    Returns:
        Lista de regiones del país
    """
    return await region_search.get_all_country_maps(country_code, all_regions)

@router.get("/country-maps/{country_code}")
async def get_country_maps(country_code: str):
    """
    Endpoint para obtener todos los mapas disponibles para un país específico.
    
    Args:
        country_code: Código del país (por ejemplo, 'US' para Estados Unidos)
    """
    try:
        country_maps = await get_all_country_maps(country_code.upper())
        
        return {
            "status": "success",
            "country": country_code.upper(),
            "maps_count": len(country_maps),
            "maps": country_maps
        }
    except Exception as e:
        logger.error(f"Error al obtener mapas de país {country_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al obtener mapas de país: {str(e)}")

@router.post("/country-maps-for-route")
async def get_country_maps_for_route(request: CountryMapsForRouteRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para obtener y descargar todos los mapas de un país basándose en una ruta.
    Útil cuando las regiones específicas no se pueden determinar o se necesita cobertura completa.
    
    Args:
        request: Objeto con lista de coordenadas
    """
    try:
        if not request.coordinates or len(request.coordinates) < 1:
            raise HTTPException(status_code=400, detail="Se requieren coordenadas para determinar el país")
        
        # Determinar país basado en coordenadas
        lats = [coord[0] for coord in request.coordinates]
        lons = [coord[1] for coord in request.coordinates]
        
        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)
        
        # Detectar país basado en las coordenadas
        country = None
        
        # EE.UU. (continental)
        if (24 <= max_lat <= 50 and -125 <= min_lon <= -66):
            country = "US"
        # Añadir más países según sea necesario
        # ...
        
        if not country:
            raise HTTPException(status_code=404, detail="No se pudo determinar el país para las coordenadas proporcionadas")
        
        # Obtener todos los mapas del país
        country_maps = await get_all_country_maps(country)
        
        if not country_maps:
            raise HTTPException(status_code=404, detail=f"No se encontraron mapas para el país {country}")            # Iniciar descargas en segundo plano
        download_results = []
        for region in country_maps[:10]:  # Limitar a 10 mapas para no sobrecargar
            result = await download.start_map_download(region["id"], region["mwm_url"], background_tasks)
            download_results.append(result)
        
        return {
            "status": "success",
            "country": country,
            "maps_count": len(country_maps),
            "maps": country_maps,
            "downloads_started": len(download_results),
            "downloads": download_results
        }
    except Exception as e:
        logger.error(f"Error al obtener mapas de país para ruta: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error al obtener mapas de país para ruta: {str(e)}")

@router.get("/check-mwm/{region_id}")
async def check_mwm_file(region_id: str):
    """
    Verifica el estado de un archivo MWM específico
    """
    try:
        # Definir las rutas de los archivos
        map_dir = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id)
        mwm_file_path = os.path.join(map_dir, f"{region_id}.mwm")
        metadata_path = os.path.join(map_dir, "metadata.json")
        
        # Verificar si existe el archivo MWM
        mwm_exists = os.path.exists(mwm_file_path)
        mwm_size = 0
        metadata = None
        
        if mwm_exists:
            mwm_size = os.path.getsize(mwm_file_path)
            
            # Verificar si existe el archivo de metadatos
            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
        
        # Verificar si está en la lista de regiones disponibles
        region_info = None
        if available_regions:
            region_info = next((r for r in available_regions if r.get("id") == region_id), None)
        
        return {
            "region_id": region_id,
            "file_exists": mwm_exists,
            "file_size_bytes": mwm_size,
            "file_size_mb": round(mwm_size / (1024 * 1024), 2) if mwm_size > 0 else 0,
            "metadata": metadata,
            "available_for_download": region_info is not None,
            "region_info": region_info
        }
    except Exception as e:
        logger.error(f"Error al verificar archivo MWM {region_id}: {str(e)}")
        return {"error": str(e), "region_id": region_id}

@router.get("/system-status")
async def get_organic_maps_system_status():
    """
    Obtiene información del estado general del sistema de Organic Maps
    """
    try:
        # Verificar la disponibilidad de los espejos
        working_url = await server_connection.check_mirror_availability()
        
        # Obtener la lista de regiones descargadas
        organic_maps_dir = os.path.join(config.data_path, ORGANIC_MAPS_DIR)
        installed_maps = []
        total_size = 0
        
        if os.path.exists(organic_maps_dir):
            for region_id in os.listdir(organic_maps_dir):
                region_dir = os.path.join(organic_maps_dir, region_id)
                
                if os.path.isdir(region_dir):
                    map_file = os.path.join(region_dir, f"{region_id}.mwm")
                    metadata_file = os.path.join(region_dir, "metadata.json")
                    
                    if os.path.exists(map_file):
                        size_bytes = os.path.getsize(map_file)
                        size_mb = size_bytes / (1024 * 1024)
                        total_size += size_bytes
                        
                        # Intentar leer metadata
                        name = region_id
                        downloaded_at = None
                        
                        if os.path.exists(metadata_file):
                            try:
                                with open(metadata_file, "r") as f:
                                    metadata = json.load(f)
                                    downloaded_at = metadata.get("download_timestamp")
                                    # Si hay name en la metadata, usarla
                                    if metadata.get("name"):
                                        name = metadata.get("name")
                            except Exception as e:
                                logger.warning(f"Error leyendo metadata de {region_id}: {str(e)}")
                        
                        # Si tenemos la región en available_regions, obtener su nombre
                        if available_regions:
                            region_info = next((r for r in available_regions if r.get("id") == region_id), None)
                            if region_info and region_info.get("name"):
                                name = region_info.get("name")
                        
                        installed_maps.append({
                            "id": region_id,
                            "name": name,
                            "size_bytes": size_bytes,
                            "size_mb": size_mb,
                            "downloaded_at": downloaded_at
                        })
        
        return {
            "working_mirror": working_url,
            "downloads_available": working_url is not None,
            "installed_maps": installed_maps,
            "total_size_bytes": total_size,
            "total_size_mb": total_size / (1024 * 1024),
            "directory": organic_maps_dir,
            "config_path": config.data_path,
            "version": "2.0"
        }
    except Exception as e:
        logger.error(f"Error obteniendo estado del sistema: {str(e)}")
        return {"error": f"Error obteniendo estado del sistema: {str(e)}"}
