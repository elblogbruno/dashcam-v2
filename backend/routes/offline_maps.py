from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Form, File, UploadFile, Query, Depends, Response
from fastapi.responses import JSONResponse, FileResponse
import os
import json
import requests
import logging
import aiohttp
import aiofiles
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import asyncio
import tempfile
import shutil
from datetime import datetime
import zipfile
import io
import math
import random
import sqlite3
from pathlib import Path

# Define router
router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Will be initialized from main.py
config = None

# Base directory for offline maps
OFFLINE_MAPS_DIR = "offline_maps"

class MapTileRequest(BaseModel):
    z: int
    x: int
    y: int
    s: Optional[str] = "a"

class OfflineMapRequest(BaseModel):
    trip_id: str
    bounds: Dict[str, float]
    zoom_levels: List[int]

@router.post("/download-tiles")
async def download_map_tiles(request: OfflineMapRequest, background_tasks: BackgroundTasks):
    """Download map tiles for offline use"""
    try:
        logger.info(f"Starting map tiles download for trip: {request.trip_id}")
        
        # Validate zoom levels (limit to 8-16 to prevent excessive downloads)
        allowed_zoom_levels = [z for z in request.zoom_levels if 8 <= z <= 16]
        
        if not allowed_zoom_levels:
            raise HTTPException(status_code=400, detail="Invalid zoom levels. Must be between 8 and 16")
        
        # Calculate required tiles
        tiles = calculate_tiles_for_bounds(request.bounds, allowed_zoom_levels)
        
        # Estimar el tamaño aproximado de la descarga (5KB por tile en promedio)
        estimated_size_mb = len(tiles) * 5 / 1024  # Tamaño en MB
        estimated_size_gb = estimated_size_mb / 1024  # Tamaño en GB
        
        # Permitir hasta ~30GB de tiles (aproximadamente 6 millones de tiles)
        max_total_tiles = 6000000  # 6 millones de tiles ≈ 30GB
        
        if len(tiles) > max_total_tiles:
            raise HTTPException(
                status_code=400, 
                detail=f"Demasiados tiles solicitados: {len(tiles)} (aproximadamente {estimated_size_gb:.2f} GB). El límite máximo es de aproximadamente 30GB."
            )
            
        # Advertir si la descarga es grande pero está permitida
        if estimated_size_gb > 5:  # Advertir si es más de 5GB
            logger.warning(f"Descarga grande solicitada: {len(tiles)} tiles, aprox. {estimated_size_gb:.2f} GB")
        
        # Create directory for trip maps if it doesn't exist
        trip_maps_dir = os.path.join(config.data_path, OFFLINE_MAPS_DIR, request.trip_id)
        os.makedirs(trip_maps_dir, exist_ok=True)
        
        # Initialize metadata file
        metadata = {
            "trip_id": request.trip_id,
            "bounds": request.bounds,
            "zoom_levels": allowed_zoom_levels,
            "total_tiles": len(tiles),
            "downloaded_tiles": 0,
            "download_started": datetime.now().isoformat(),
            "download_completed": None,
            "status": "in_progress"
        }
        
        # Save initial metadata
        metadata_path = os.path.join(trip_maps_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        # Start download in background
        background_tasks.add_task(
            download_tiles_background_task,
            request.trip_id,
            tiles,
            trip_maps_dir,
            metadata_path
        )
        
        return {
            "status": "success",
            "message": f"Download of {len(tiles)} tiles started in the background",
            "trip_id": request.trip_id,
            "total_tiles": len(tiles),
            "zoom_levels": allowed_zoom_levels
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error starting map tiles download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error starting download: {str(e)}")

@router.get("/status/{trip_id}")
async def check_download_status(trip_id: str):
    """Check the status of a map tiles download"""
    try:
        metadata_path = os.path.join(config.data_path, OFFLINE_MAPS_DIR, trip_id, "metadata.json")
        
        if not os.path.exists(metadata_path):
            return {
                "status": "not_found",
                "message": f"No download found for trip {trip_id}"
            }
        
        # Read metadata
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        
        # Calculate progress
        progress = 0
        if metadata.get("total_tiles", 0) > 0:
            progress = metadata.get("downloaded_tiles", 0) / metadata["total_tiles"] * 100
        
        status_info = {
            "status": metadata.get("status", "unknown"),
            "progress": round(progress, 1),
            "downloaded_tiles": metadata.get("downloaded_tiles", 0),
            "failed_tiles": metadata.get("failed_tiles", 0),
            "total_tiles": metadata.get("total_tiles", 0),
            "zoom_levels": metadata.get("zoom_levels", []),
            "bounds": metadata.get("bounds", {}),
            "download_started": metadata.get("download_started"),
            "download_completed": metadata.get("download_completed"),
            "trip_id": trip_id
        }
        
        # Add error info if present
        if "error" in metadata:
            status_info["error"] = metadata["error"]
            
        # Add success rate if download is completed or failed
        if metadata.get("status") in ["completed", "failed"]:
            downloaded = metadata.get("downloaded_tiles", 0)
            failed = metadata.get("failed_tiles", 0)
            total = downloaded + failed
            if total > 0:
                status_info["success_rate"] = round(downloaded / total * 100, 1)
            else:
                status_info["success_rate"] = 0
                
        # Add estimated size info
        if metadata.get("total_tiles", 0) > 0:
            # Estimate average tile size (~5KB per tile)
            avg_tile_size_kb = 5
            estimated_size_mb = round(metadata.get("total_tiles", 0) * avg_tile_size_kb / 1024, 2)
            status_info["estimated_size_mb"] = estimated_size_mb
            
        return status_info
    except Exception as e:
        logger.error(f"Error checking download status for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking download status: {str(e)}")

@router.get("/tile/{trip_id}/{z}/{x}/{y}")
async def get_map_tile(trip_id: str, z: int, x: int, y: int):
    """Get a map tile for a trip"""
    try:
        # Check if the tile exists locally
        tile_path = os.path.join(config.data_path, OFFLINE_MAPS_DIR, trip_id, f"{z}", f"{x}", f"{y}.png")
        
        if os.path.exists(tile_path):
            logger.debug(f"Serving cached tile {z}/{x}/{y} for trip {trip_id}")
            return FileResponse(tile_path, media_type="image/png")
        
        # If not, fetch it from OpenStreetMap
        logger.debug(f"Fetching tile {z}/{x}/{y} from OSM for trip {trip_id}")
        tile_url = f"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
        response = requests.get(tile_url)
        
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Tile not found")
        
        # Save tile for future use
        try:
            # Create directories if they don't exist
            os.makedirs(os.path.dirname(tile_path), exist_ok=True)
            
            # Save the tile
            with open(tile_path, "wb") as f:
                f.write(response.content)
                
            logger.debug(f"Saved tile {z}/{x}/{y} for trip {trip_id}")
        except Exception as save_error:
            logger.warning(f"Could not save tile {z}/{x}/{y} for trip {trip_id}: {str(save_error)}")
        
        # Return the tile
        return Response(content=response.content, media_type="image/png")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error getting map tile {z}/{x}/{y} for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting map tile: {str(e)}")

@router.delete("/{trip_id}")
async def delete_offline_map(trip_id: str):
    """Delete offline map for a trip"""
    try:
        trip_maps_dir = os.path.join(config.data_path, OFFLINE_MAPS_DIR, trip_id)
        
        if not os.path.exists(trip_maps_dir):
            raise HTTPException(status_code=404, detail=f"No offline map found for trip {trip_id}")
        
        # Delete the directory
        shutil.rmtree(trip_maps_dir)
        
        return {
            "status": "success",
            "message": f"Offline map for trip {trip_id} deleted successfully"
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error deleting offline map for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting offline map: {str(e)}")

@router.get("/export/{trip_id}")
async def export_offline_map(trip_id: str):
    """Export the offline map for a trip as a zip file"""
    try:
        trip_maps_dir = os.path.join(config.data_path, OFFLINE_MAPS_DIR, trip_id)
        
        if not os.path.exists(trip_maps_dir):
            raise HTTPException(status_code=404, detail=f"No offline map found for trip {trip_id}")
        
        # Create a temporary zip file
        zip_path = os.path.join(tempfile.gettempdir(), f"offline_map_{trip_id}.zip")
        
        # Create the zip file
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(trip_maps_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, trip_maps_dir)
                    zipf.write(file_path, arcname)
        
        # Return the zip file
        return FileResponse(
            zip_path, 
            media_type="application/zip",
            filename=f"offline_map_{trip_id}.zip"
        )
    except Exception as e:
        logger.error(f"Error exporting offline map for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting offline map: {str(e)}")

async def download_tiles_background_task(trip_id: str, tiles: List[Dict[str, int]], output_dir: str, metadata_path: str):
    """Background task to download map tiles"""
    downloaded = 0
    failed = 0
    
    # Read metadata
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    
    try:
        # Optimizamos la configuración de conexión para mejorar la velocidad
        # - Aumentamos el límite de conexiones, pero manteniendo un valor razonable para evitar bloqueos
        # - Usamos keep-alive para reutilizar conexiones y reducir la latencia
        connector = aiohttp.TCPConnector(limit=15, limit_per_host=5, force_close=False, enable_cleanup_closed=True)
        
        # Create aiohttp session with optimized connector
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=30, sock_connect=10, sock_read=20)
        ) as session:
            # Process tiles in batches to balance speed and server load
            # Control de variables para el progreso
            total_tiles = len(tiles)
            
            # Ajustar el tamaño del lote según la cantidad total de tiles
            # Lotes más grandes para descargas pequeñas, lotes más pequeños para descargas grandes
            if total_tiles < 1000:
                batch_size = 20  # Mayor velocidad para pocas tiles
            elif total_tiles < 10000:
                batch_size = 15  # Velocidad media para descargas moderadas
            else:
                batch_size = 10  # Velocidad controlada para descargas grandes
                
            num_batches = (total_tiles + batch_size - 1) // batch_size
            
            # Agrupar tiles por nivel de zoom para el registro
            tiles_by_zoom = {}
            for tile in tiles:
                z = tile['z']
                if z not in tiles_by_zoom:
                    tiles_by_zoom[z] = []
                tiles_by_zoom[z].append(tile)
            
            zoom_counts = {z: len(tiles_list) for z, tiles_list in tiles_by_zoom.items()}
            logger.info(f"Downloading tiles for trip {trip_id}: total={total_tiles}, by zoom: {zoom_counts}")
            
            # Procesar por nivel de zoom (de menor a mayor) para tener primero los mapas menos detallados
            for zoom_level in sorted(tiles_by_zoom.keys()):
                zoom_tiles = tiles_by_zoom[zoom_level]
                zoom_total = len(zoom_tiles)
                
                logger.info(f"Processing zoom level {zoom_level}: {zoom_total} tiles")
                
                # Procesar en lotes
                for i in range(0, zoom_total, batch_size):
                    # Extraer el lote actual
                    batch = zoom_tiles[i:i + batch_size]
                    batch_num = i // batch_size + 1
                    batch_total = (zoom_total + batch_size - 1) // batch_size
                    
                    logger.debug(f"Processing batch {batch_num}/{batch_total} for zoom {zoom_level}")
                    
                    # Preparación eficiente: crear directorios para todo el lote de una vez
                    tile_dirs = set()
                    for tile in batch:
                        tile_dir = os.path.join(output_dir, f"{tile['z']}", f"{tile['x']}")
                        tile_dirs.add(tile_dir)
                    
                    # Crear directorios en paralelo
                    for tile_dir in tile_dirs:
                        os.makedirs(tile_dir, exist_ok=True)
                    
                    # Crear tareas para este lote con distribución inteligente de carga
                    tasks = []
                    for i, tile in enumerate(batch):
                        # Usar un servidor aleatorio pero con distribución inteligente para balancear carga
                        server_index = (i + zoom_level) % 3  # Distribución cíclica con offset por nivel de zoom
                        server = chr(ord('a') + server_index)  # a, b, c
                        tile_url = f"https://{server}.tile.openstreetmap.org/{tile['z']}/{tile['x']}/{tile['y']}.png"
                        tile_path = os.path.join(output_dir, f"{tile['z']}", f"{tile['x']}", f"{tile['y']}.png")
                        
                        # Crear la tarea de descarga
                        tasks.append(download_single_tile(session, tile_url, tile_path))
                    
                    # Añadir retraso global antes de comenzar el lote - más eficiente que retrasos individuales
                    # Variar según el nivel de zoom para distribuir la carga de manera escalonada
                    base_delay = 0.5 if zoom_level > 12 else 0.3
                    await asyncio.sleep(base_delay * (1 + 0.1 * (batch_num % 3)))
                    
                    # Ejecutar las tareas del lote en paralelo
                    batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                    
                    # Procesar resultados eficientemente
                    success_count = 0
                    fail_count = 0
                    for result in batch_results:
                        if isinstance(result, Exception):
                            fail_count += 1
                        elif result is True:
                            success_count += 1
                        else:
                            fail_count += 1
                    
                    downloaded += success_count
                    failed += fail_count
                    
                    # Actualizar metadatos con corrección atómica usando archivos temporales
                    # Esto evita corrupción de datos si hay interrupciones
                    metadata["downloaded_tiles"] = downloaded
                    metadata["failed_tiles"] = failed
                    
                    # Usar un archivo temporal para garantizar escritura atómica
                    temp_metadata_path = f"{metadata_path}.tmp"
                    with open(temp_metadata_path, "w") as f:
                        json.dump(metadata, f, indent=2)
                    # Renombrar de forma atómica
                    shutil.move(temp_metadata_path, metadata_path)
                    
                    # Log progress periodically con más detalles sobre la eficiencia
                    if batch_num % 5 == 0 or batch_num == batch_total:
                        progress_pct = (batch_num / batch_total) * 100
                        success_rate = (success_count / len(batch)) * 100 if batch else 0
                        logger.info(f"Zoom {zoom_level}: {progress_pct:.1f}% ({batch_num}/{batch_total}) | "
                                   f"Lote: {success_count}/{len(batch)} ({success_rate:.1f}%) | "
                                   f"Total: {downloaded}/{total_tiles} descargados, {failed} fallidos")
                    
                    # Ajuste dinámico del retraso entre lotes según la tasa de éxito
                    # Si la tasa de fallo aumenta, incrementamos el retraso para evitar bloqueos
                    if fail_count == 0 or len(batch) == 0:
                        # Seguimos normalmente con retraso mínimo si todo va bien
                        await asyncio.sleep(1.0)
                    elif fail_count / len(batch) > 0.3:  
                        # Muchos fallos, posible rate limit, esperar más
                        logger.warning(f"Alta tasa de fallos ({fail_count}/{len(batch)}). Aumentando retraso.")
                        await asyncio.sleep(3.0)
                    else:
                        # Algunos fallos, esperar proporcionalmente
                        await asyncio.sleep(1.5)
        
        # Update final metadata
        metadata["status"] = "completed"
        metadata["download_completed"] = datetime.now().isoformat()
        metadata["success_rate"] = round((downloaded / (downloaded + failed) * 100) if downloaded + failed > 0 else 0, 1)
        
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
            
        logger.info(f"Download completed for trip {trip_id}: {downloaded} tiles downloaded, {failed} failed ({metadata['success_rate']}% success)")
        
    except Exception as e:
        logger.error(f"Error in background download for trip {trip_id}: {str(e)}", exc_info=True)
        
        try:
            # Update metadata to indicate failure
            metadata["status"] = "failed"
            metadata["error"] = str(e)
            metadata["download_completed"] = datetime.now().isoformat()
            metadata["success_rate"] = round((downloaded / (downloaded + failed) * 100) if downloaded + failed > 0 else 0, 1)
            
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2)
        except Exception as metadata_error:
            logger.error(f"Failed to update metadata for trip {trip_id}: {str(metadata_error)}")

async def download_single_tile(session, url, output_path, max_retries=2, timeout=15):
    """Download a single tile with improved retry logic and error handling"""
    try:
        # Check if file already exists
        if os.path.exists(output_path):
            return True
        
        # Ensure the parent directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Try to download with retries
        retry_count = 0
        while retry_count <= max_retries:
            try:
                # Configurar headers optimizados para respetar la política de uso de OpenStreetMap
                headers = {
                    'User-Agent': 'DashCam Offline Map Downloader/1.0 (https://dashcam.app)',
                    'Accept': 'image/png,image/*;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Connection': 'keep-alive',
                    'Referer': 'https://dashcam.app/'
                }
                
                # Download tile with increased timeout for better performance
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                    status = response.status
                    
                    # Manejar diferentes códigos de estado HTTP con estrategias específicas
                    if status == 200:
                        # Éxito - guardar el tile
                        async with aiofiles.open(output_path, "wb") as f:
                            await f.write(await response.read())
                        
                        # Log successful download occasionally
                        if random.random() < 0.05:  # Log ~5% of successful downloads to reduce noise
                            logger.debug(f"Successfully downloaded tile {url}")
                        
                        return True
                    elif status == 404:
                        # Tile no encontrado - no tiene sentido reintentar
                        logger.info(f"Tile not found at {url} (404 Not Found)")
                        return False
                    elif status == 429:
                        # Too Many Requests - backoff exponencial
                        retry_count += 1
                        wait_time = min(30, (2 ** retry_count) + random.uniform(1, 5))
                        logger.warning(f"Rate limited (429) for {url}, backing off for {wait_time:.1f}s")
                        await asyncio.sleep(wait_time)
                        continue
                    elif status >= 500:
                        # Error del servidor - reintentar después de una espera
                        retry_count += 1
                        if retry_count <= max_retries:
                            wait_time = retry_count * 3 + random.uniform(1, 3)
                            logger.warning(f"Server error {status} for {url}, retrying in {wait_time:.1f}s")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Persistent server error {status} for {url} after {max_retries} retries")
                            return False
                    else:
                        # Otro código de estado - reintentar una vez más
                        retry_count += 1
                        if retry_count <= max_retries:
                            wait_time = retry_count * 2 + random.uniform(0.5, 1.5)
                            logger.warning(f"Unexpected status {status} for {url}, retrying in {wait_time:.1f}s")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Failed to download {url}: status {status} after {max_retries} retries")
                            return False
                            
            except asyncio.TimeoutError:
                # Timeout específico - incrementar el tiempo de espera en reintentos
                retry_count += 1
                if retry_count <= max_retries:
                    wait_time = retry_count * 3 + random.uniform(1, 2)
                    logger.debug(f"Timeout downloading {url}, retrying in {wait_time:.1f}s (attempt {retry_count}/{max_retries})")
                    await asyncio.sleep(wait_time)
                else:
                    logger.warning(f"Timeout downloading {url} after {max_retries} retries")
                    return False
                    
            except aiohttp.ClientConnectorError as e:
                # Error de conexión - posible problema de red
                retry_count += 1
                if retry_count <= max_retries:
                    wait_time = retry_count * 2.5 + random.uniform(1, 3)
                    logger.debug(f"Connection error for {url}: {str(e)}, retrying in {wait_time:.1f}s")
                    await asyncio.sleep(wait_time)
                else:
                    logger.warning(f"Connection error for {url} after {max_retries} retries: {str(e)}")
                    return False
                    
            except aiohttp.ClientError as e:
                # Otros errores del cliente HTTP
                retry_count += 1
                if retry_count <= max_retries:
                    wait_time = retry_count * 2 + random.uniform(0.5, 1.5)
                    logger.debug(f"Client error for {url}: {str(e)}, retrying in {wait_time:.1f}s")
                    await asyncio.sleep(wait_time)
                else:
                    logger.warning(f"Failed to download {url} after {max_retries} retries: {str(e)}")
                    return False
                    
    except Exception as e:
        logger.warning(f"Unexpected error downloading tile {url}: {str(e)}")
        return False

def calculate_tiles_for_bounds(bounds, zoom_levels):
    """Calculate the tiles needed to cover the given bounds at the specified zoom levels,
    with optimizations for coverage and incremental detail"""
    def lat_lon_to_tile(lat, lon, zoom):
        """Convert lat/lon to tile coordinates"""
        try:
            # Ensure lat and lon are within valid ranges
            lat = max(min(lat, 85.0511), -85.0511)  # Mercator projection limits
            lon = lon % 360  # Normalize longitude to 0-360
            if lon > 180:
                lon -= 360  # Convert to range -180 to 180
            
            lat_rad = lat * math.pi / 180
            n = 2.0 ** zoom
            x = int((lon + 180.0) / 360.0 * n)
            y = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
            return x, y
        except Exception as e:
            logger.error(f"Error converting lat/lon ({lat},{lon}) to tile: {str(e)}")
            # Return fallback values to avoid breaking the process
            return 0, 0
    
    def estimate_tiles_count(bounds, zoom):
        """Estimar la cantidad de tiles para un nivel de zoom dado"""
        try:
            # Obtener coordenadas de tiles para las esquinas
            nw_x, nw_y = lat_lon_to_tile(float(bounds["north"]), float(bounds["west"]), zoom)
            se_x, se_y = lat_lon_to_tile(float(bounds["south"]), float(bounds["east"]), zoom)
            
            # Asegurar el orden correcto
            min_x = min(nw_x, se_x)
            max_x = max(nw_x, se_x)
            min_y = min(nw_y, se_y)
            max_y = max(nw_y, se_y)
            
            # Calcular cantidad de tiles
            tile_count = (max_x - min_x + 1) * (max_y - min_y + 1)
            return tile_count, (max_x - min_x), (max_y - min_y)
        except Exception:
            return float('inf'), 0, 0
    
    def is_urban_area(bounds):
        """Detecta si un área probablemente es urbana basándose en su tamaño y características"""
        try:
            # Calcular dimensiones del área
            lat_diff = abs(float(bounds["north"]) - float(bounds["south"]))
            lon_diff = abs(float(bounds["east"]) - float(bounds["west"]))
            area = lat_diff * lon_diff
            
            # Convertir a km² aproximadamente (1 grado ≈ 111 km en el ecuador)
            area_km2 = area * (111 * 111)
            
            # Clasificar según el tamaño:
            # - Áreas muy pequeñas (< 100 km²): Probablemente centros urbanos densos
            # - Áreas pequeñas-medianas (< 500 km²): Ciudades medianas o zonas metropolitanas
            # - Áreas grandes: Probablemente rurales o regiones completas
            
            # Aumentamos significativamente el umbral para permitir áreas urbanas más grandes
            # como ciudades enteras o áreas metropolitanas
            is_urban = area < 0.2  # ~2200 km² (~47km x 47km)
            
            logger.debug(f"Área analizada: {area_km2:.2f} km² - Clasificada como {'urbana' if is_urban else 'rural'}")
            return is_urban
            
        except Exception as e:
            logger.error(f"Error detectando área urbana: {str(e)}")
            return False
    
    # Ordenar niveles de zoom de menor a mayor (más amplio a más detallado)
    sorted_zoom_levels = sorted(zoom_levels)
    
    # Determinar si es un área urbana para ajustar los límites
    is_urban = is_urban_area(bounds)
    
    # Valores basados en GB aproximados a descargar:
    # - 1 tile ≈ 5KB
    # - 1GB = ~200,000 tiles
    
    # Ajustar los niveles de zoom según el tamaño del área
    # Usar límites mucho más altos para permitir descargas más completas
    max_tiles_per_zoom = 40000 if is_urban else 20000  # Máximo de tiles por nivel de zoom
    
    # Incrementar niveles de zoom si es necesario
    if not sorted_zoom_levels:
        # Si no hay niveles especificados, usar un rango predeterminado
        sorted_zoom_levels = [8, 10, 12, 14, 16]
        
    # Asegurarnos de tener niveles de zoom suficientes para buena cobertura
    # Si solo hay pocos niveles, añadir niveles intermedios
    if len(sorted_zoom_levels) <= 2:
        min_zoom = min(sorted_zoom_levels)
        max_zoom = max(sorted_zoom_levels)
        
        # Añadimos niveles intermedios para mejor cobertura
        extra_levels = []
        for z in range(min_zoom + 1, max_zoom):
            if (z - min_zoom) % 2 == 0:  # Añadir cada 2 niveles
                extra_levels.append(z)
                
        sorted_zoom_levels = sorted(set(sorted_zoom_levels + extra_levels))
    
    # Estimar el tamaño del área y ajustar los niveles de zoom
    tiles = []
    actual_zoom_levels_used = []
    
    try:
        # Calcular el máximo nivel de zoom disponible
        max_available_zoom = max(sorted_zoom_levels) if sorted_zoom_levels else 16
        
        # Estrategia mejorada para añadir niveles de zoom incrementalmente
        # 1. Primero estimamos tamaños para los niveles de zoom solicitados
        zoom_estimates = {}
        for zoom in sorted_zoom_levels:
            est_count, width, height = estimate_tiles_count(bounds, zoom)
            zoom_estimates[zoom] = (est_count, width, height)
            logger.info(f"Zoom {zoom}: estimado {est_count} tiles ({width}x{height})")
        
        # 2. Intentar añadir niveles intermedios no solicitados para mejor cobertura
        # Explorar posibles niveles adicionales (incrementales)
        additional_zooms = []
        for z in range(8, max_available_zoom + 3):  # Ir hasta 3 niveles más que el máximo solicitado
            if z not in zoom_estimates and z <= 18:  # Limite máximo absoluto de 18
                est_count, width, height = estimate_tiles_count(bounds, z) 
                zoom_estimates[z] = (est_count, width, height)
                additional_zooms.append(z)
                logger.info(f"Nivel adicional {z}: estimado {est_count} tiles ({width}x{height})")
        
        # 3. Seleccionar niveles iniciales que no excedan el límite por nivel
        candidate_levels = []
        
        # Primero, incluir siempre los niveles de zoom bajos (8-10) para tener una visión general
        for zoom in range(8, 11):
            if zoom in zoom_estimates:
                est_count, width, height = zoom_estimates[zoom]
                # Para niveles bajos, ser más permisivos con el límite
                if est_count <= max_tiles_per_zoom * 2:  # El doble para niveles bajos
                    candidate_levels.append(zoom)
        
        # Luego añadir niveles medios y altos
        for zoom, (est_count, width, height) in sorted(zoom_estimates.items()):
            if zoom not in candidate_levels:  # No duplicar los que ya añadimos
                if est_count <= max_tiles_per_zoom and width <= 800 and height <= 800:
                    candidate_levels.append(zoom)
                else:
                    logger.warning(f"Zoom {zoom} excede el límite ({est_count} tiles), considerando para reducción")
        
        candidate_levels.sort()  # Mantener el orden
        
        # 4. Calcular cuántos tiles supondría en total
        total_estimated_tiles = sum(zoom_estimates[z][0] for z in candidate_levels)
        estimated_size_gb = total_estimated_tiles * 5 / 1024 / 1024  # En GB
        
        logger.info(f"Estimación inicial: {total_estimated_tiles} tiles ({estimated_size_gb:.2f} GB) para niveles {candidate_levels}")
        
        # 5. Estrategia de límite global - aprox. 30GB máximo (6 millones de tiles)
        final_zoom_levels = []
        accumulated_tiles = 0
        gb_limit = 30  # ~6 millones de tiles
        tiles_limit = gb_limit * 1024 * 1024 / 5  # Convertir GB a tiles
        
        # Priorizar niveles específicos:
        # 1. Primero, niveles base (8-10) para garantizar cobertura general
        # 2. Luego, niveles medios y los específicamente solicitados
        # 3. Finalmente, niveles altos para máximo detalle
        
        # Separar los niveles en categorías
        base_levels = [z for z in candidate_levels if 8 <= z <= 10]
        requested_levels = [z for z in sorted_zoom_levels if z in candidate_levels]
        other_levels = [z for z in candidate_levels if z not in base_levels and z not in requested_levels]
        
        # Añadir en orden de prioridad
        priority_order = base_levels + [z for z in requested_levels if z not in base_levels] + other_levels
        
        # Añadir niveles hasta acercarse al límite
        for zoom in priority_order:
            est_count = zoom_estimates[zoom][0]
            if accumulated_tiles + est_count <= tiles_limit:
                final_zoom_levels.append(zoom)
                accumulated_tiles += est_count
                logger.info(f"Añadiendo zoom {zoom}: {est_count} tiles (acumulado: {accumulated_tiles})")
            else:
                logger.warning(f"Omitiendo zoom {zoom}: excedería el límite global de {gb_limit}GB")
        
        # Si no hay ningún nivel seleccionado, al menos incluir un nivel base
        if not final_zoom_levels and candidate_levels:
            min_zoom = min(candidate_levels)
            final_zoom_levels = [min_zoom]
            logger.warning(f"Todos los niveles exceden límites. Usando al menos nivel {min_zoom}")
        
        # Calcular estadísticas finales
        total_final_tiles = sum(zoom_estimates[z][0] for z in final_zoom_levels)
        final_size_gb = total_final_tiles * 5 / 1024 / 1024
        
        logger.info(f"Selección final de niveles: {final_zoom_levels} - {total_final_tiles} tiles ({final_size_gb:.2f} GB)")
            
        # Ahora procesar los niveles de zoom seleccionados
        for zoom in final_zoom_levels:
            # Validate zoom level
            if not isinstance(zoom, int) or zoom < 0 or zoom > 20:
                logger.warning(f"Invalid zoom level {zoom}, skipping")
                continue
                
            # Validate bounds
            if not all(key in bounds for key in ["north", "south", "east", "west"]):
                logger.error(f"Invalid bounds format: {bounds}, missing required keys")
                continue
                
            try:
                # Get tile coordinates for corners
                northwest_x, northwest_y = lat_lon_to_tile(float(bounds["north"]), float(bounds["west"]), zoom)
                southeast_x, southeast_y = lat_lon_to_tile(float(bounds["south"]), float(bounds["east"]), zoom)
                
                # Ensure correct order
                min_x = min(northwest_x, southeast_x)
                max_x = max(northwest_x, southeast_x)
                min_y = min(northwest_y, southeast_y)
                max_y = max(northwest_y, southeast_y)
                
                # Limit number of tiles per zoom level to avoid excessive downloads
                num_tiles = (max_x - min_x + 1) * (max_y - min_y + 1)
                
                # Determinar si es un área urbana para ajustar límites
                is_urban = is_urban_area(bounds)
                max_tiles_per_zoom = 20000 if is_urban else 10000  # Límites mucho más altos
                
                # En niveles de zoom bajos (< 10), permitir aún más tiles para tener buena cobertura básica
                if zoom < 10:
                    max_tiles_per_zoom = max_tiles_per_zoom * 2
                
                if num_tiles > max_tiles_per_zoom:
                    logger.warning(f"Too many tiles ({num_tiles}) for zoom level {zoom}, skipping this zoom level")
                    continue
                    
                # Add safety check for absurdly large areas (aumentados significativamente)
                max_dimension = 800 if is_urban else 400  # Dimensiones mucho mayores
                
                # Para niveles de zoom bajos, permitimos áreas aún más grandes
                if zoom <= 10:
                    max_dimension = max_dimension * 2
                    
                if max_x - min_x > max_dimension or max_y - min_y > max_dimension:
                    logger.warning(f"Área demasiado grande en nivel de zoom {zoom}: x={min_x}-{max_x}, y={min_y}-{max_y}, omitiendo")
                    continue
                
                # Add tiles (dentro del mismo bloque try)
                for x in range(min_x, max_x + 1):
                    for y in range(min_y, max_y + 1):
                        tiles.append({
                            "x": x,
                            "y": y,
                            "z": zoom
                        })
            except Exception as e:
                logger.error(f"Error calculating tiles for zoom level {zoom}: {str(e)}")
                continue
    except Exception as e:
        logger.error(f"Error calculating tiles: {str(e)}", exc_info=True)
    
    # Agrupar por nivel de zoom para el registro
    tiles_by_zoom = {}
    for tile in tiles:
        z = tile["z"]
        if z not in tiles_by_zoom:
            tiles_by_zoom[z] = 0
        tiles_by_zoom[z] += 1
    
    zoom_summary = ", ".join([f"{z}:{count}" for z, count in tiles_by_zoom.items()])
    logger.info(f"Calculated {len(tiles)} tiles across {len(tiles_by_zoom)} zoom levels: {zoom_summary}")
    
    return tiles

@router.get("/mbtiles/metadata")
async def get_mbtiles_metadata():
    """Get metadata from the MBTiles file"""
    try:
        logger.info("[get_mbtiles_metadata] Starting metadata request...")
        
        # Find the MBTiles file
        mbtiles_path = find_mbtiles_file()
        logger.info(f"[get_mbtiles_metadata] Found MBTiles file: {mbtiles_path}")
        if not mbtiles_path:
            logger.error("[get_mbtiles_metadata] No MBTiles file found")
            raise HTTPException(status_code=404, detail="No MBTiles file found")
        
        logger.info(f"[get_mbtiles_metadata] Found MBTiles file: {mbtiles_path}")
        
        # Read metadata from MBTiles
        logger.info("[get_mbtiles_metadata] Creating MBTilesReader...")
        try:
            with MBTilesReader(mbtiles_path) as reader:
                logger.info("[get_mbtiles_metadata] MBTilesReader initialized successfully")
                metadata = reader.get_metadata()
                logger.info(f"[get_mbtiles_metadata] Metadata retrieved successfully: {metadata}")
                
                return {
                    "status": "success",
                    "file_path": mbtiles_path,
                    "metadata": metadata
                }
        except sqlite3.Error as db_error:
            logger.error(f"[get_mbtiles_metadata] SQLite error: {str(db_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")
        except Exception as reader_error:
            logger.error(f"[get_mbtiles_metadata] MBTilesReader error: {str(reader_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Reader error: {str(reader_error)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[get_mbtiles_metadata] Error getting MBTiles metadata: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting metadata: {str(e)}")


@router.get("/mbtiles-list")
async def get_mbtiles_list():
    """Get list of available MBTiles files for offline maps"""
    try:
        logger.info("[get_mbtiles_list] Starting MBTiles file listing...")
        
        if not config:
            logger.error("[get_mbtiles_list] Configuration not initialized")
            raise HTTPException(status_code=500, detail="Configuration not initialized")
        
        logger.info(f"[get_mbtiles_list] Config data_path: {config.data_path}")
        offline_maps_path = os.path.join(config.data_path, OFFLINE_MAPS_DIR)
        logger.info(f"[get_mbtiles_list] Looking for MBTiles in: {offline_maps_path}")
        
        mbtiles_files = []
        
        if os.path.exists(offline_maps_path):
            logger.info(f"[get_mbtiles_list] Directory exists, listing contents...")
            files_in_dir = os.listdir(offline_maps_path)
            logger.info(f"[get_mbtiles_list] Files found in directory: {files_in_dir}")
            
            for filename in files_in_dir:
                logger.info(f"[get_mbtiles_list] Processing file: {filename}")
                if filename.endswith('.mbtiles'):
                    file_path = os.path.join(offline_maps_path, filename)
                    logger.info(f"[get_mbtiles_list] Found MBTiles file: {file_path}")
                    
                    try:
                        file_size = os.path.getsize(file_path)
                        file_size_mb = round(file_size / (1024 * 1024), 2)
                        logger.info(f"[get_mbtiles_list] File size: {file_size} bytes ({file_size_mb} MB)")
                        
                        mbtiles_files.append({
                            "filename": filename,
                            "path": file_path,
                            "size_bytes": file_size,
                            "size_mb": file_size_mb
                        })
                    except Exception as file_error:
                        logger.error(f"[get_mbtiles_list] Error processing file {filename}: {str(file_error)}")
        else:
            logger.warning(f"[get_mbtiles_list] Directory does not exist: {offline_maps_path}")
        
        logger.info(f"[get_mbtiles_list] Found {len(mbtiles_files)} MBTiles files total")
        
        result = {
            "status": "success",
            "mbtiles_files": mbtiles_files,
            "count": len(mbtiles_files)
        }
        logger.info(f"[get_mbtiles_list] Returning result: {result}")
        
        return result
        
    except Exception as e:
        logger.error(f"[get_mbtiles_list] Error listing MBTiles files: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error listing MBTiles files: {str(e)}")

@router.get("/mbtiles/{filename}")
async def serve_mbtiles_file(filename: str):
    """Serve MBTiles file for frontend consumption"""
    try:
        if not config:
            raise HTTPException(status_code=500, detail="Configuration not initialized")
        
        # Validate filename to prevent directory traversal
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        offline_maps_path = os.path.join(config.data_path, OFFLINE_MAPS_DIR)
        file_path = os.path.join(offline_maps_path, filename)
        
        if not os.path.exists(file_path) or not file_path.endswith('.mbtiles'):
            raise HTTPException(status_code=404, detail="MBTiles file not found")
        
        return FileResponse(
            path=file_path,
            media_type="application/x-sqlite3",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving MBTiles file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving MBTiles file: {str(e)}")

# MBTiles helper functions
class MBTilesReader:
    """Helper class to read tiles from MBTiles files"""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self._conn = None
        logger.info(f"[MBTilesReader.__init__] Initializing with file: {file_path}")
    
    def __enter__(self):
        logger.info(f"[MBTilesReader.__enter__] Opening SQLite connection to: {self.file_path}")
        try:
            # Check if file exists and is readable
            if not os.path.exists(self.file_path):
                logger.error(f"[MBTilesReader.__enter__] File does not exist: {self.file_path}")
                raise FileNotFoundError(f"MBTiles file not found: {self.file_path}")
            
            if not os.access(self.file_path, os.R_OK):
                logger.error(f"[MBTilesReader.__enter__] File is not readable: {self.file_path}")
                raise PermissionError(f"Cannot read MBTiles file: {self.file_path}")
            
            file_size = os.path.getsize(self.file_path)
            logger.info(f"[MBTilesReader.__enter__] File size: {file_size} bytes")
            
            # Connect to the SQLite database
            self._conn = sqlite3.connect(self.file_path)
            logger.info(f"[MBTilesReader.__enter__] SQLite connection established successfully")
            
            # Test the connection by checking database structure
            cursor = self._conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            table_names = [table[0] for table in tables]
            logger.info(f"[MBTilesReader.__enter__] Database tables found: {table_names}")
            
            # Check if essential tables exist
            required_tables = ['metadata', 'tiles']
            missing_tables = [table for table in required_tables if table not in table_names]
            if missing_tables:
                logger.error(f"[MBTilesReader.__enter__] Missing required tables: {missing_tables}")
                raise ValueError(f"Invalid MBTiles file - missing tables: {missing_tables}")
            
            logger.info("[MBTilesReader.__enter__] MBTiles database validation successful")
            return self
            
        except Exception as e:
            logger.error(f"[MBTilesReader.__enter__] Error opening database: {str(e)}", exc_info=True)
            if self._conn:
                self._conn.close()
                self._conn = None
            raise
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._conn:
            self._conn.close()
    
    def get_tile(self, z: int, x: int, y: int) -> Optional[bytes]:
        """Get a tile from the MBTiles database"""
        if not self._conn:
            logger.error(f"[MBTilesReader.get_tile] No database connection for tile z={z}, x={x}, y={y}")
            return None
        
        try:
            # MBTiles uses TMS tiling scheme, convert from XYZ to TMS
            tms_y = (2 ** z) - 1 - y
            logger.debug(f"[MBTilesReader.get_tile] Converting XYZ({z},{x},{y}) to TMS({z},{x},{tms_y})")
            
            cursor = self._conn.cursor()
            logger.debug(f"[MBTilesReader.get_tile] Executing SQL query for tile z={z}, x={x}, tms_y={tms_y}")
            
            cursor.execute(
                "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
                (z, x, tms_y)
            )
            result = cursor.fetchone()
            
            if result:
                tile_size = len(result[0])
                logger.debug(f"[MBTilesReader.get_tile] Found tile data, size: {tile_size} bytes")
                return result[0]
            else:
                logger.warning(f"[MBTilesReader.get_tile] No tile found for z={z}, x={x}, tms_y={tms_y}")
                return None
            
        except Exception as e:
            logger.error(f"[MBTilesReader.get_tile] Error getting tile z={z}, x={x}, y={y}: {str(e)}", exc_info=True)
            return None
    
    def get_metadata(self) -> Dict[str, Any]:
        """Get metadata from the MBTiles file"""
        if not self._conn:
            logger.error("[MBTilesReader.get_metadata] No database connection")
            return {}
        
        try:
            logger.debug("[MBTilesReader.get_metadata] Executing metadata query...")
            cursor = self._conn.cursor()
            cursor.execute("SELECT name, value FROM metadata")
            metadata_rows = cursor.fetchall()
            metadata = dict(metadata_rows)
            logger.info(f"[MBTilesReader.get_metadata] Retrieved {len(metadata)} metadata entries: {list(metadata.keys())}")
            return metadata
        except Exception as e:
            logger.error(f"[MBTilesReader.get_metadata] Error getting metadata: {str(e)}", exc_info=True)
            return {}
    
    def get_available_tiles_info(self) -> Dict[str, Any]:
        """Get information about available tiles in the MBTiles database"""
        if not self._conn:
            logger.error("[MBTilesReader.get_available_tiles_info] No database connection")
            return {}
        
        try:
            cursor = self._conn.cursor()
            
            # Get zoom level range
            cursor.execute("SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles")
            zoom_range = cursor.fetchone()
            
            # Get tile count per zoom level
            cursor.execute("SELECT zoom_level, COUNT(*) FROM tiles GROUP BY zoom_level ORDER BY zoom_level")
            tiles_per_zoom = dict(cursor.fetchall())
            
            # Get bounds for each zoom level
            bounds_info = {}
            for zoom in tiles_per_zoom.keys():
                cursor.execute("""
                    SELECT MIN(tile_column), MAX(tile_column), MIN(tile_row), MAX(tile_row) 
                    FROM tiles WHERE zoom_level = ?
                """, (zoom,))
                min_x, max_x, min_y, max_y = cursor.fetchone()
                bounds_info[zoom] = {
                    'min_x': min_x, 'max_x': max_x,
                    'min_y': min_y, 'max_y': max_y,
                    'count': tiles_per_zoom[zoom]
                }
            
            info = {
                'zoom_range': zoom_range,
                'tiles_per_zoom': tiles_per_zoom,
                'bounds_per_zoom': bounds_info,
                'total_tiles': sum(tiles_per_zoom.values())
            }
            
            logger.info(f"[MBTilesReader.get_available_tiles_info] MBTiles info: {info}")
            return info
            
        except Exception as e:
            logger.error(f"[MBTilesReader.get_available_tiles_info] Error: {str(e)}", exc_info=True)
            return {}

def find_mbtiles_file() -> Optional[str]:
    """Find the first available MBTiles file"""
    try:
        logger.info("[find_mbtiles_file] Starting search for MBTiles files...")
        
        if not config:
            logger.error("[find_mbtiles_file] Config not initialized!")
            return None
        
        logger.info(f"[find_mbtiles_file] Config data_path: {config.data_path}")
        offline_maps_path = os.path.join(config.data_path, OFFLINE_MAPS_DIR)
        logger.info(f"[find_mbtiles_file] Looking in directory: {offline_maps_path}")
        
        if not os.path.exists(offline_maps_path):
            logger.error(f"[find_mbtiles_file] Directory does not exist: {offline_maps_path}")
            return None
        
        files_found = os.listdir(offline_maps_path)
        logger.info(f"[find_mbtiles_file] Files in directory: {files_found}")
        
        for filename in files_found:
            logger.info(f"[find_mbtiles_file] Checking file: {filename}")
            if filename.endswith('.mbtiles'):
                file_path = os.path.join(offline_maps_path, filename)
                logger.info(f"[find_mbtiles_file] Found MBTiles file: {file_path}")
                if os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    logger.info(f"[find_mbtiles_file] File exists and size is: {file_size} bytes")
                    return file_path
                else:
                    logger.warning(f"[find_mbtiles_file] File path exists in listing but not accessible: {file_path}")
        
        logger.warning("[find_mbtiles_file] No MBTiles files found in directory")
        return None
    except Exception as e:
        logger.error(f"[find_mbtiles_file] Error finding MBTiles file: {str(e)}", exc_info=True)
        return None

@router.get("/mbtiles/tile/{z}/{x}/{y}")
async def get_mbtiles_tile(z: int, x: int, y: int):
    """Get a tile from MBTiles in XYZ format for Leaflet"""
    try:
        logger.info(f"[get_mbtiles_tile] Requested tile: z={z}, x={x}, y={y}")
        
        # Find the MBTiles file
        mbtiles_path = find_mbtiles_file()
        if not mbtiles_path:
            logger.error("[get_mbtiles_tile] No MBTiles file found")
            raise HTTPException(status_code=404, detail="No MBTiles file found")
        
        logger.info(f"[get_mbtiles_tile] Using MBTiles file: {mbtiles_path}")
        
        # Read the tile from MBTiles
        logger.info(f"[get_mbtiles_tile] Creating MBTilesReader for file: {mbtiles_path}")
        try:
            with MBTilesReader(mbtiles_path) as reader:
                logger.info(f"[get_mbtiles_tile] MBTilesReader initialized successfully")
                tile_data = reader.get_tile(z, x, y)
                
                if tile_data is None:
                    # Get some context about what tiles are available near this coordinate
                    cursor = reader._conn.cursor()
                    
                    # Check if any tiles exist at this zoom level
                    cursor.execute("SELECT COUNT(*) FROM tiles WHERE zoom_level = ?", (z,))
                    tiles_at_zoom = cursor.fetchone()[0]
                    
                    # Check what zoom levels are available
                    cursor.execute("SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level")
                    available_zooms = [row[0] for row in cursor.fetchall()]
                    
                    # Check bounds at this zoom level
                    cursor.execute("""
                        SELECT MIN(tile_column), MAX(tile_column), MIN(tile_row), MAX(tile_row) 
                        FROM tiles WHERE zoom_level = ?
                    """, (z,))
                    bounds_result = cursor.fetchone()
                    
                    tms_y = (2 ** z) - 1 - y  # Convert to TMS for logging
                    
                    logger.warning(f"[get_mbtiles_tile] Tile not found: z={z}, x={x}, y={y} (TMS: z={z}, x={x}, tms_y={tms_y})")
                    logger.info(f"[get_mbtiles_tile] Available zoom levels: {available_zooms}")
                    logger.info(f"[get_mbtiles_tile] Tiles at zoom {z}: {tiles_at_zoom}")
                    
                    if bounds_result and bounds_result[0] is not None:
                        min_x, max_x, min_y, max_y = bounds_result
                        logger.info(f"[get_mbtiles_tile] Bounds at zoom {z}: x=[{min_x}-{max_x}], tms_y=[{min_y}-{max_y}]")
                        
                        # Check if requested coordinates are outside bounds
                        if x < min_x or x > max_x:
                            logger.warning(f"[get_mbtiles_tile] Requested x={x} is outside bounds [{min_x}-{max_x}]")
                        if tms_y < min_y or tms_y > max_y:
                            logger.warning(f"[get_mbtiles_tile] Requested tms_y={tms_y} is outside bounds [{min_y}-{max_y}]")
                    
                    raise HTTPException(status_code=404, detail=f"Tile not found at z={z}, x={x}, y={y}")
                
                logger.info(f"[get_mbtiles_tile] Found tile data, size: {len(tile_data)} bytes")
                
                # Determine content type based on the tile data
                if tile_data.startswith(b'\x89PNG'):
                    content_type = "image/png"
                elif tile_data.startswith(b'\xff\xd8\xff'):
                    content_type = "image/jpeg"
                elif tile_data.startswith(b'RIFF') and b'WEBP' in tile_data[:12]:
                    content_type = "image/webp"
                else:
                    content_type = "image/png"  # Default fallback
                
                logger.info(f"[get_mbtiles_tile] Returning tile with content type: {content_type}")
                
                return Response(
                    content=tile_data,
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
                        "Access-Control-Allow-Origin": "*"
                    }
                )
        except sqlite3.Error as db_error:
            logger.error(f"[get_mbtiles_tile] SQLite error: {str(db_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")
        except Exception as reader_error:
            logger.error(f"[get_mbtiles_tile] MBTilesReader error: {str(reader_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Reader error: {str(reader_error)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[get_mbtiles_tile] Error serving MBTiles tile z={z}, x={x}, y={y}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error serving tile: {str(e)}")

@router.get("/mbtiles/info")
async def get_mbtiles_info():
    """Get detailed information about available tiles in the MBTiles file"""
    try:
        logger.info("[get_mbtiles_info] Starting MBTiles info request...")
        
        # Find the MBTiles file
        mbtiles_path = find_mbtiles_file()
        if not mbtiles_path:
            logger.error("[get_mbtiles_info] No MBTiles file found")
            raise HTTPException(status_code=404, detail="No MBTiles file found")
        
        logger.info(f"[get_mbtiles_info] Found MBTiles file: {mbtiles_path}")
        
        # Read info from MBTiles
        try:
            with MBTilesReader(mbtiles_path) as reader:
                logger.info("[get_mbtiles_info] MBTilesReader initialized successfully")
                metadata = reader.get_metadata()
                tiles_info = reader.get_available_tiles_info()
                
                return {
                    "status": "success",
                    "file_path": mbtiles_path,
                    "metadata": metadata,
                    "tiles_info": tiles_info
                }
        except Exception as reader_error:
            logger.error(f"[get_mbtiles_info] MBTilesReader error: {str(reader_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Reader error: {str(reader_error)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[get_mbtiles_info] Error getting MBTiles info: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting info: {str(e)}")

