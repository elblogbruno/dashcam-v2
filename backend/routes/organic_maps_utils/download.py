"""
Módulo para gestionar la descarga y almacenamiento de archivos de mapas.
"""

import os
import json
import logging
import aiohttp
import asyncio
import shutil
import time
from datetime import datetime

# Configurar logging
logger = logging.getLogger(__name__)

# Variables globales que serán inicializadas desde el archivo principal
config = None
ORGANIC_MAPS_DIR = "organic_maps"

# Lista de descargas activas
active_downloads = {}

async def get_available_regions():
    """
    Obtiene la lista de regiones disponibles, ya sea desde una caché o del servidor.
    
    Returns:
        Dict con regiones disponibles
    """
    global available_regions
    
    try:
        from .server_connection import check_mirror_availability, get_available_map_files
        
        # Verificar la disponibilidad de los espejos
        working_url = await check_mirror_availability()
        
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
                # Obtener la lista de archivos disponibles
                available_regions = await get_available_map_files(working_url)
                logger.info(f"Fetched {len(available_regions)} regions from {working_url}")
                
                # Cache the regions list
                try:
                    os.makedirs(os.path.dirname(regions_cache_path), exist_ok=True)
                    with open(regions_cache_path, "w") as f:
                        cache_data = {
                            "timestamp": datetime.now().isoformat(),
                            "regions": available_regions
                        }
                        json.dump(cache_data, f)
                    logger.info(f"Cached regions list to {regions_cache_path}")
                except Exception as e:
                    logger.warning(f"Failed to cache regions list: {str(e)}")
        
        return {
            "working_url": working_url,
            "regions_count": len(available_regions) if available_regions else 0,
            "regions": available_regions or []
        }
        
    except Exception as e:
        logger.error(f"Error getting available regions: {str(e)}")
        return {"error": str(e), "regions": []}

async def download_map_file(region_id, mwm_url, temp_path, metadata_path):
    """
    Descarga un archivo de mapa específico.
    
    Args:
        region_id: ID de la región a descargar
        mwm_url: URL del archivo .mwm
        temp_path: Ruta temporal para guardar el archivo durante la descarga
        metadata_path: Ruta para el archivo de metadatos
        
    Returns:
        Dict con información sobre el resultado de la descarga
    """
    global active_downloads
    
    # Inicializar o actualizar estado de descarga
    download_state = active_downloads.get(region_id, {
        "status": "initializing",
        "progress": 0,
        "message": "Iniciando descarga...",
        "start_time": time.time(),
        "total_bytes": 0,
        "downloaded_bytes": 0,
        "speed_kbps": 0
    })
    
    active_downloads[region_id] = download_state
    
    try:
        # Asegurarnos de que existe el directorio temporal
        os.makedirs(os.path.dirname(temp_path), exist_ok=True)
        
        logger.info(f"Descargando mapa {region_id} desde {mwm_url}")
        
        # Variables para trackeo de velocidad
        last_update_time = time.time()
        last_bytes = 0
        
        async with aiohttp.ClientSession() as session:
            async with session.get(mwm_url, timeout=60) as response:
                if response.status != 200:
                    error_msg = f"Error al descargar mapa: HTTP {response.status}"
                    logger.error(error_msg)
                    
                    download_state["status"] = "error"
                    download_state["message"] = error_msg
                    return {"success": False, "error": error_msg}
                
                total_size = int(response.headers.get("Content-Length", 0))
                if total_size == 0:
                    # Si no tenemos tamaño, usar un valor estimado
                    total_size = 50 * 1024 * 1024  # 50MB estimado
                
                download_state["total_bytes"] = total_size
                
                with open(temp_path, "wb") as f:
                    downloaded = 0
                    async for chunk in response.content.iter_chunked(8192):
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        # Actualizar progreso
                        progress = min(100, int(downloaded * 100 / total_size)) if total_size > 0 else 0
                        download_state["downloaded_bytes"] = downloaded
                        download_state["progress"] = progress
                        
                        # Actualizar velocidad cada segundo
                        current_time = time.time()
                        if current_time - last_update_time >= 1:
                            # Calcular velocidad en KB/s
                            time_diff = current_time - last_update_time
                            byte_diff = downloaded - last_bytes
                            speed_kbps = byte_diff / time_diff / 1024
                            
                            download_state["speed_kbps"] = round(speed_kbps, 2)
                            download_state["message"] = f"Descargando... {progress}% ({round(speed_kbps, 1)} KB/s)"
                            
                            # Actualizar variables para la próxima medición
                            last_update_time = current_time
                            last_bytes = downloaded
                
                # Verificar si la descarga se completó
                if os.path.getsize(temp_path) < 1024:
                    error_msg = "El archivo descargado es demasiado pequeño, posiblemente inválido"
                    logger.error(error_msg)
                    
                    download_state["status"] = "error"
                    download_state["message"] = error_msg
                    return {"success": False, "error": error_msg}
                
                # Descarga completada, actualizar metadata y mover archivo a ubicación final
                download_state["status"] = "finalizing"
                download_state["message"] = "Finalizando descarga..."
                download_state["progress"] = 100
                
                # Crear metadata
                map_dir = os.path.dirname(temp_path)
                final_path = os.path.join(map_dir, f"{region_id}.mwm")
                
                # Mover archivo a ubicación final
                shutil.move(temp_path, final_path)
                
                # Obtener tamaño real del archivo
                file_size = os.path.getsize(final_path)
                file_size_mb = round(file_size / (1024 * 1024), 2)
                
                # Guardar metadatos
                metadata = {
                    "id": region_id,
                    "url": mwm_url,
                    "download_timestamp": datetime.now().isoformat(),
                    "file_path": final_path,
                    "size_bytes": file_size,
                    "size_mb": file_size_mb
                }
                
                with open(metadata_path, "w") as f:
                    json.dump(metadata, f, indent=2)
                
                download_state["status"] = "completed"
                download_state["message"] = "Descarga completada"
                
                logger.info(f"Descarga completa: {region_id} ({file_size_mb} MB)")
                return {
                    "success": True,
                    "file_path": final_path,
                    "size_mb": file_size_mb,
                    "metadata": metadata
                }
                
    except Exception as e:
        error_msg = f"Error durante la descarga: {str(e)}"
        logger.error(error_msg)
        
        download_state["status"] = "error"
        download_state["message"] = error_msg
        
        return {"success": False, "error": error_msg}

async def start_map_download(region_id, mwm_url, background_tasks=None):
    """
    Inicia la descarga de un mapa en segundo plano.
    
    Args:
        region_id: ID de la región a descargar
        mwm_url: URL del archivo .mwm
        background_tasks: Gestor de tareas en segundo plano (optional)
        
    Returns:
        Dict con información sobre el estado inicial de la descarga
    """
    global active_downloads
    
    # Comprobar si ya hay una descarga activa para esta región
    if region_id in active_downloads and active_downloads[region_id].get("status") in ["downloading", "initializing"]:
        return {
            "status": "already_downloading",
            "message": f"Ya hay una descarga en curso para {region_id}",
            "progress": active_downloads[region_id].get("progress", 0)
        }
    
    # Crear estructura de directorios para la región
    map_dir = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id)
    os.makedirs(map_dir, exist_ok=True)
    
    # Definir rutas
    temp_path = os.path.join(map_dir, f"{region_id}.mwm.temp")
    final_path = os.path.join(map_dir, f"{region_id}.mwm")
    metadata_path = os.path.join(map_dir, "metadata.json")
    
    # Comprobar si el archivo ya existe y es válido
    if os.path.exists(final_path) and os.path.getsize(final_path) > 1024 * 1024:  # >1MB
        try:
            # Verificar si tenemos metadata
            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                
                file_size = os.path.getsize(final_path)
                file_size_mb = round(file_size / (1024 * 1024), 2)
                
                return {
                    "status": "already_exists",
                    "message": f"El mapa ya está descargado ({file_size_mb} MB)",
                    "file_path": final_path,
                    "size_mb": file_size_mb,
                    "metadata": metadata
                }
            else:
                # Crear metadata si no existe
                file_size = os.path.getsize(final_path)
                file_size_mb = round(file_size / (1024 * 1024), 2)
                
                metadata = {
                    "id": region_id,
                    "url": mwm_url,
                    "download_timestamp": datetime.now().isoformat(),
                    "file_path": final_path,
                    "size_bytes": file_size,
                    "size_mb": file_size_mb
                }
                
                with open(metadata_path, "w") as f:
                    json.dump(metadata, f, indent=2)
                
                return {
                    "status": "already_exists",
                    "message": f"El mapa ya está descargado ({file_size_mb} MB)",
                    "file_path": final_path,
                    "size_mb": file_size_mb,
                    "metadata": metadata
                }
        except Exception as e:
            logger.warning(f"Error verificando mapa existente: {str(e)}. Se descargará de nuevo.")
    
    # Inicializar estado de descarga
    active_downloads[region_id] = {
        "status": "initializing",
        "progress": 0,
        "message": "Iniciando descarga...",
        "start_time": time.time(),
        "region_id": region_id
    }
    
    # Iniciar descarga en segundo plano
    if background_tasks:
        # Si se proporcionó un objeto background_tasks, usarlo para iniciar la descarga
        background_tasks.add_task(download_map_file, region_id, mwm_url, temp_path, metadata_path)
    else:
        # Caso contrario, iniciar como tarea asyncio
        asyncio.create_task(download_map_file(region_id, mwm_url, temp_path, metadata_path))
    
    return {
        "status": "download_started",
        "message": f"Descarga iniciada para {region_id}",
        "region_id": region_id
    }

def get_download_status(region_id):
    """
    Obtiene el estado actual de una descarga.
    
    Args:
        region_id: ID de la región
        
    Returns:
        Dict con información sobre el estado de la descarga
    """
    global active_downloads
    
    if region_id in active_downloads:
        return active_downloads[region_id]
    
    # Si no hay descarga activa, verificar si el archivo existe
    map_path = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id, f"{region_id}.mwm")
    metadata_path = os.path.join(config.data_path, ORGANIC_MAPS_DIR, region_id, "metadata.json")
    
    if os.path.exists(map_path):
        file_size = os.path.getsize(map_path)
        file_size_mb = round(file_size / (1024 * 1024), 2)
        
        metadata = None
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
            except:
                pass
        
        return {
            "status": "completed",
            "progress": 100,
            "message": f"Descarga completada ({file_size_mb} MB)",
            "region_id": region_id,
            "file_path": map_path,
            "size_mb": file_size_mb,
            "metadata": metadata
        }
    
    return {
        "status": "not_found",
        "message": f"No hay información de descarga para {region_id}"
    }

async def download_mwm_background_task(region_id, mwm_url, file_path, metadata_path):
    """
    Función para descargar un archivo MWM en segundo plano.
    Esta función es llamada desde las tareas en segundo plano.
    
    Args:
        region_id: ID de la región a descargar
        mwm_url: URL del archivo MWM a descargar
        file_path: Ruta donde se guardará el archivo final
        metadata_path: Ruta al archivo de metadatos para actualizarlo
    """
    logger.info(f"Iniciando descarga en segundo plano para {region_id} desde {mwm_url}")
    
    try:
        # Crear un archivo temporal para la descarga
        temp_file = f"{file_path}.temp"
        
        # Iniciar descarga
        result = await download_map_file(region_id, mwm_url, temp_file, metadata_path)
        
        if result.get("success", False):
            # Cargar metadata actual
            try:
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                
                # Actualizar metadata
                metadata["download_completed"] = datetime.now().isoformat()
                metadata["status"] = "completed"
                metadata["size_mb"] = result.get("size_mb", 0)
                
                # Guardar metadata actualizada
                with open(metadata_path, "w") as f:
                    json.dump(metadata, f, indent=2)
                
                logger.info(f"Descarga completada para {region_id}")
            except Exception as e:
                logger.error(f"Error al actualizar metadata: {str(e)}")
        else:
            # La descarga falló
            error_msg = result.get("error", "Error desconocido")
            logger.error(f"Descarga fallida para {region_id}: {error_msg}")
            
            # Actualizar metadata con el error
            try:
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                
                metadata["status"] = "error"
                metadata["error"] = error_msg
                
                with open(metadata_path, "w") as f:
                    json.dump(metadata, f, indent=2)
            except Exception as e:
                logger.error(f"Error al actualizar metadata: {str(e)}")
    except Exception as e:
        logger.error(f"Error en la tarea de descarga en segundo plano: {str(e)}")
        
        # Intentar actualizar metadata con el error
        try:
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
            
            metadata["status"] = "error"
            metadata["error"] = str(e)
            
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2)
        except:
            pass
