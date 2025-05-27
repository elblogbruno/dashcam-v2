"""
Módulo para manejar la conexión con los servidores de Organic Maps y obtener las regiones disponibles.
"""

import aiohttp
import os
import re
import json
import logging
from datetime import datetime
import asyncio

# Configurar logging
logger = logging.getLogger(__name__)

# Variables globales que serán inicializadas desde el archivo principal
config = None
ORGANIC_MAPS_DIR = "organic_maps"

# Lista de URLs de servidores Organic Maps ordenados por preferencia
ORGANIC_MAPS_URLS = [
    "https://omaps.webfreak.org/maps",  # Primer espejo (WebFreak)
    "https://omaps.wfr.software/maps",   # Segundo espejo de respaldo
    # "https://download.organicmaps.app/MapsWithMe"  # URL original (posibles problemas)
]

# URL base principal - se inicializa con la primera URL de la lista
ORGANIC_MAPS_BASE_URL = ORGANIC_MAPS_URLS[0]

# Versiones de mapas para probar en orden de preferencia
MAP_VERSIONS = ["250213", "250227", "250329", "250418", "250511"]

def init_urls():
    """Inicializa la URL base y otras configuraciones relacionadas con los servidores"""
    global ORGANIC_MAPS_BASE_URL
    # Por defecto, usar el primer espejo
    ORGANIC_MAPS_BASE_URL = ORGANIC_MAPS_URLS[0]
    logger.info(f"URL base inicializada: {ORGANIC_MAPS_BASE_URL}")
    
    # Información de configuración
    logger.info(f"Servidores disponibles: {len(ORGANIC_MAPS_URLS)}")
    logger.info(f"Versiones de mapas configuradas: {', '.join(MAP_VERSIONS)}")

async def check_mirror_availability():
    """
    Verifica la disponibilidad de los diferentes espejos de Organic Maps y devuelve
    la URL del primer espejo que responde correctamente.
    """
    global ORGANIC_MAPS_URLS, ORGANIC_MAPS_BASE_URL
    
    for url in ORGANIC_MAPS_URLS:
        try:
            logger.info(f"Verificando disponibilidad del espejo: {url}")
            
            # Verificar si podemos acceder al directorio de mapas más reciente
            # Probando con diferentes versiones
            for version in MAP_VERSIONS:
                test_url = f"{url}/{version}"

                print(f"Probando URL: {test_url}")
                
                async with aiohttp.ClientSession() as session:
                    try:
                        async with session.get(test_url, timeout=5) as response:
                            if response.status == 200:
                                logger.info(f"Espejo disponible: {url}/{version}")
                                # Actualizar la URL base global
                                ORGANIC_MAPS_BASE_URL = url
                                logger.info(f"URL base actualizada a: {ORGANIC_MAPS_BASE_URL}")
                                return f"{url}/{version}"
                    except asyncio.TimeoutError:
                        logger.warning(f"Timeout al verificar el espejo {test_url}")
                    except Exception as e:
                        logger.warning(f"Error verificando espejo {test_url}: {str(e)}")
        
        except Exception as e:
            logger.warning(f"Error verificando espejo {url}: {str(e)}")
    
    # Si llegamos aquí, ningún espejo funcionó, devolver el primer URL como fallback
    logger.error("Ningún espejo está disponible. Usando URL por defecto.")
    return f"{ORGANIC_MAPS_URLS[0]}/{MAP_VERSIONS[0]}"

async def get_available_map_files(version="250511"):
    """
    Obtiene la lista de archivos de mapas disponibles en el espejo activo.
    
    Args:
        version: Versión de los mapas a consultar (por defecto "250511")
        
    Returns:
        Lista de archivos de mapas disponibles
    """
    global ORGANIC_MAPS_BASE_URL
    
    # Primero verificar que tenemos un espejo disponible
    working_url = await check_mirror_availability()
    if not working_url:
        working_url = f"{ORGANIC_MAPS_BASE_URL}/{version}"
        logger.warning(f"No se encontraron espejos disponibles, usando URL por defecto: {working_url}")
    
    try:
        logger.info(f"Obteniendo archivos disponibles desde: {working_url}")
        version = working_url.split('/')[-1]
        base_url = working_url.rstrip(f"/{version}")
        
        files = []
        
        async with aiohttp.ClientSession() as session:
            try:
                # Intentar obtener listado del directorio
                async with session.get(f"{working_url}/", timeout=15) as response:
                    if response.status == 200:
                        directory_html = await response.text(encoding='utf-8', errors='ignore')
                        
                        # Buscar archivos .mwm usando diferentes patrones según la estructura del directorio
                        patterns = [
                            # Patrón para enlaces HTML con href
                            r'href=[\'"]?([^\'" >]+\.mwm)[\'"]?',
                            # Patrón para listados de archivos con tamaño (común en Apache/Nginx)
                            r'<a[^>]*href=[\'"]?([^\'" >]+\.mwm)[\'"]?[^>]*>\s*([^<]+)</a>\s*</td>\s*<td[^>]*>\s*([\d\.]+)\s*([KMG]?B)',
                            # Patrón para listados simples
                            r'([a-zA-Z0-9_\-\.\/]+\.mwm)'
                        ]
                        
                        # Probar cada patrón hasta encontrar coincidencias
                        matches = []
                        for pattern in patterns:
                            pattern_matches = re.findall(pattern, directory_html, re.IGNORECASE)
                            if pattern_matches:
                                matches = pattern_matches
                                logger.info(f"Encontradas {len(matches)} coincidencias con patrón")
                                break
                        
                        if not matches:
                            logger.warning("No se pudieron extraer archivos .mwm, usando datos estáticos")
                            return get_static_map_files(base_url, version)
                        
                        # Procesar las coincidencias encontradas
                        for match in matches:
                            try:
                                # Extraemos la información básica del archivo
                                if isinstance(match, tuple) and len(match) >= 4:
                                    file_path, file_name, size_value, size_unit = match
                                    
                                    # Convertimos el tamaño a MB para ser consistentes
                                    try:
                                        size_mb = float(size_value)
                                        if size_unit.upper().startswith('K'):
                                            size_mb /= 1024
                                        elif size_unit.upper().startswith('G'):
                                            size_mb *= 1024
                                    except ValueError:
                                        size_mb = 0
                                else:
                                    # Para patrones simples donde no tenemos información de tamaño
                                    file_path = match[0] if isinstance(match, tuple) else match
                                    file_name = os.path.basename(file_path)
                                    size_mb = 100  # Valor por defecto
                                
                                # Limpiar/normalizar la ruta del archivo
                                if file_path.startswith('./'):
                                    file_path = file_path[2:]
                                
                                # Si file_path es solo el nombre del archivo, usarlo directamente
                                if not file_path.endswith('.mwm'):
                                    logger.warning(f"Ruta de archivo inválida: {file_path}")
                                    continue
                                    
                                # Extraemos region_id del nombre del archivo
                                region_id = os.path.basename(file_path).replace('.mwm', '')
                                
                                # Evitar procesar archivos de índice u otros no válidos
                                if region_id in ['index', 'md5', 'timestamp', '']:
                                    continue
                                    
                                # Normalizar region_id para asegurar formato consistente
                                region_id = region_id.replace(' ', '_')
                                
                                # Creamos el diccionario con la información del archivo
                                file_info = {
                                    "id": region_id,
                                    "name": region_id.replace('_', ' '),  # Nombre más amigable
                                    "file_name": os.path.basename(file_path),
                                    "size_mb": round(size_mb, 2),
                                    "mwm_url": f"{base_url}/{version}/{file_path}",
                                    "map_version": version
                                }
                                
                                # Añadimos estructura de jerarquía si se puede determinar
                                parts = region_id.split('_')
                                if len(parts) > 1:
                                    # Determinamos el parent_id basado en la estructura del nombre
                                    if len(parts) > 2:
                                        # Ejemplo: US_California_LA -> parent: US_California
                                        file_info["parent_id"] = '_'.join(parts[:-1])
                                    else:
                                        # Ejemplo: US_California -> parent: US
                                        file_info["parent_id"] = parts[0]
                                
                                files.append(file_info)
                            except Exception as e:
                                logger.warning(f"Error procesando archivo MWM: {str(e)}")
                                continue
                        
                        # Verificar que obtuvimos archivos válidos
                        if not files:
                            logger.warning(f"No se pudieron procesar archivos .mwm válidos")
                            return get_static_map_files(base_url, version)
                        else:
                            logger.info(f"Se encontraron {len(files)} archivos MWM válidos")
                            
                            # Añadir información para mapa mundial y USA completo si no existen ya
                            us_exists = any(f["id"] in ["US", "USA", "United_States"] for f in files)
                            world_exists = any(f["id"] in ["World", "planet"] for f in files)
                            
                            if not world_exists:
                                # Añadir mapa mundial como referencia
                                files.append({
                                    "id": "World",
                                    "name": "World",
                                    "file_name": "World.mwm",
                                    "size_mb": 2048,  # Aproximado
                                    "mwm_url": f"{base_url}/{version}/World.mwm",
                                    "map_version": version
                                })
                            
                            if not us_exists:
                                # Añadir mapa de USA completo como referencia
                                files.append({
                                    "id": "USA",
                                    "name": "United States",
                                    "file_name": "USA.mwm",
                                    "size_mb": 1024,  # Aproximado
                                    "mwm_url": f"{base_url}/{version}/USA.mwm",
                                    "map_version": version
                                })
                            
                            return files
                    else:
                        logger.warning(f"No se pudo acceder al listado de directorios: {response.status}")
            except Exception as e:
                logger.warning(f"Error obteniendo listado de directorio: {str(e)}")
        
        # Si llegamos aquí, hubo un problema
        return get_static_map_files(base_url, version)
        
    except Exception as e:
        logger.error(f"Error obteniendo archivos de mapas disponibles: {str(e)}")
        return get_static_map_files(ORGANIC_MAPS_URLS[0], MAP_VERSIONS[0])

def get_static_map_files(base_url, version):
    """
    Proporciona una lista estática de archivos de mapas importantes cuando no se pueden
    obtener del servidor. Es un respaldo para asegurar que la funcionalidad siga trabajando
    incluso cuando el servidor no proporciona listados adecuados.
    
    Args:
        base_url: URL base del servidor
        version: Versión de los mapas
        
    Returns:
        Lista predeterminada de archivos de mapas
    """
    logger.info(f"Usando lista estática de archivos de mapas para {base_url}/{version}")
    
    # Lista estática de regiones importantes, principalmente para EE.UU.
    important_us_regions = [
        {"id": "World", "name": "World", "size_mb": 2048},
        {"id": "USA", "name": "United States", "size_mb": 1024},
        {"id": "US_California", "name": "US California", "size_mb": 450},
        {"id": "US_Arizona", "name": "US Arizona", "size_mb": 250},
        {"id": "US_Nevada", "name": "US Nevada", "size_mb": 200},
        {"id": "US_Texas", "name": "US Texas", "size_mb": 400},
        {"id": "US_Florida", "name": "US Florida", "size_mb": 250},
        {"id": "US_New_York", "name": "US New York", "size_mb": 200},
        {"id": "US_Illinois", "name": "US Illinois", "size_mb": 180},
        {"id": "US_Washington", "name": "US Washington", "size_mb": 170},
        {"id": "US_Oregon", "name": "US Oregon", "size_mb": 165},
    ]
    
    # Añadir URLs de descarga a cada región
    static_files = []
    for region in important_us_regions:
        region_copy = region.copy()
        region_copy["file_name"] = f"{region['id']}.mwm"
        region_copy["mwm_url"] = f"{base_url}/{version}/{region['id']}.mwm"
        region_copy["map_version"] = version
        static_files.append(region_copy)
    
    return static_files
