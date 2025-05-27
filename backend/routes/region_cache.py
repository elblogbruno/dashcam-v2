"""
Módulo para manejar el caché de búsquedas de regiones geográficas
"""
from datetime import datetime
import logging

# Configurar logging
logger = logging.getLogger(__name__)

# Caché para resultados de búsqueda de regiones
# Formato: {(min_lat, max_lat, min_lon, max_lon): {"regions": [region_id1, region_id2, ...], "timestamp": timestamp}}
region_search_cache = {}

async def cache_region_search_results(min_lat, max_lat, min_lon, max_lon, regions):
    """
    Cachea los resultados de búsqueda de regiones para coordenadas específicas
    
    Args:
        min_lat: Latitud mínima del área
        max_lat: Latitud máxima del área
        min_lon: Longitud mínima del área
        max_lon: Longitud máxima del área
        regions: Lista de regiones encontradas
        
    Returns:
        None
    """
    global region_search_cache
    
    # Redondear las coordenadas para agrupar búsquedas similares
    # Redondear a 1 decimal para latitud/longitud (~11km de precisión)
    cache_key = (
        round(min_lat, 1),
        round(max_lat, 1),
        round(min_lon, 1),
        round(max_lon, 1)
    )
    
    # Guardar en caché sólo los IDs de las regiones (más ligero)
    region_ids = [r["id"] for r in regions]
    
    # Almacenar en caché con timestamp para expiración
    region_search_cache[cache_key] = {
        "regions": region_ids,
        "timestamp": datetime.now().timestamp()
    }
    
    # Limitar el tamaño de la caché (mantener solo las 100 búsquedas más recientes)
    if len(region_search_cache) > 100:
        # Ordenar por timestamp y eliminar las más antiguas
        sorted_cache = sorted(
            region_search_cache.items(), 
            key=lambda x: x[1]["timestamp"]
        )
        # Eliminar el 20% más antiguo
        for i in range(int(len(region_search_cache) * 0.2)):
            if i < len(sorted_cache):
                del region_search_cache[sorted_cache[i][0]]
    
    logger.info(f"Cacheados resultados de búsqueda para área: {cache_key}")

async def get_cached_region_search(min_lat, max_lat, min_lon, max_lon, all_regions):
    """
    Recupera regiones cacheadas para coordenadas específicas
    
    Args:
        min_lat: Latitud mínima del área
        max_lat: Latitud máxima del área
        min_lon: Longitud mínima del área
        max_lon: Longitud máxima del área
        all_regions: Lista completa de regiones disponibles para buscar coincidencias
        
    Returns:
        Lista de regiones o None si no hay caché válida
    """
    global region_search_cache
    
    # Redondear las coordenadas igual que al cachear
    cache_key = (
        round(min_lat, 1),
        round(max_lat, 1),
        round(min_lon, 1),
        round(max_lon, 1)
    )
    
    # Verificar si existe en caché y no ha expirado (24 horas)
    cache_entry = region_search_cache.get(cache_key)
    if cache_entry:
        timestamp = cache_entry["timestamp"]
        age_hours = (datetime.now().timestamp() - timestamp) / 3600
        
        if age_hours < 24:  # Caché válida por 24 horas
            # Convertir los IDs de región a objetos región completos
            region_ids = cache_entry["regions"]
            regions = []
            
            for region_id in region_ids:
                region = next((r for r in all_regions if r["id"] == region_id), None)
                if region:
                    regions.append(region)
            
            if regions:
                logger.info(f"Usando resultados cacheados para área: {cache_key} (edad: {age_hours:.1f} horas)")
                return regions
    
    # Si llegamos aquí, no hay caché válida
    return None
