"""
Módulo para buscar y detectar regiones de mapas basadas en coordenadas GPS.
"""

import logging
from datetime import datetime
import sys
import os

# Configurar logging
logger = logging.getLogger(__name__)

# Variables globales que serán inicializadas desde el archivo principal
config = None

async def find_regions_for_coordinates(coordinates, all_regions, max_regions=5):
    """
    Busca las regiones de mapas que cubren un conjunto de coordenadas.
    
    Args:
        coordinates: Lista de coordenadas [lat, lon]
        all_regions: Lista de todas las regiones disponibles
        max_regions: Número máximo de regiones a devolver
        
    Returns:
        Lista de regiones que cubren las coordenadas
    """
    if not coordinates or len(coordinates) == 0:
        logger.warning("No se proporcionaron coordenadas para buscar regiones")
        return []
    
    if not all_regions:
        logger.warning("No hay regiones disponibles para buscar")
        return []
    
    # Extraer latitudes y longitudes
    lats = [coord[0] for coord in coordinates]
    lons = [coord[1] for coord in coordinates]
    
    # Calcular el rectángulo que contiene todas las coordenadas
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    
    # Tamaño del rectángulo en grados (como aproximación de la distancia)
    # Esto nos da una idea de si es una ruta larga que cruza múltiples regiones
    route_width = max_lon - min_lon
    route_height = max_lat - min_lat
    
    logger.info(f"Buscando regiones para coordenadas: lat {min_lat:.4f} a {max_lat:.4f}, lon {min_lon:.4f} a {max_lon:.4f}")
    logger.info(f"Tamaño de ruta: {route_width:.4f}° x {route_height:.4f}°")
    
    # Intentar obtener de caché primero
    try:
        from ..region_cache import get_cached_region_search
        cached_regions = await get_cached_region_search(min_lat, max_lat, min_lon, max_lon, all_regions)
        
        if cached_regions:
            logger.info(f"Usando {len(cached_regions)} regiones desde caché")
            return cached_regions
    except Exception as e:
        logger.warning(f"Error al buscar en caché: {str(e)}")
    
    logger.info(f"Buscando hasta {max_regions} regiones para esta ruta")
    
    # Determinar a qué país pertenece la ruta
    country = None
    
    # EE.UU. (continental)
    if (24 <= max_lat <= 50 and -125 <= min_lon <= -66):
        country = "US"
        logger.info("Ruta detectada en Estados Unidos")
    
    # Lista de regiones a buscar en orden de prioridad
    search_regions = []
    
    # Si la ruta es en EE.UU.
    if country == "US":
        # Primero incluir siempre el país completo como respaldo
        search_regions.extend(["US", "USA", "United_States", "United States"])
        
        # Para rutas que atraviesan múltiples estados, dividir la ruta en secciones
        if route_width >= 5:
            # Número de secciones basado en el ancho de la ruta
            num_sections = max(2, min(6, int(route_width / 5)))
            section_width = route_width / num_sections
            
            logger.info(f"Dividiendo ruta en {num_sections} secciones para análisis")
            
            for i in range(num_sections):
                section_min_lon = min_lon + (i * section_width)
                section_max_lon = min_lon + ((i + 1) * section_width)
                section_mid_lon = (section_min_lon + section_max_lon) / 2
                
                logger.info(f"Analizando sección {i+1}/{num_sections}: longitud {section_min_lon:.4f} a {section_max_lon:.4f}")
                
                # Revisar en qué región del país estamos
                # West Coast
                if (-125 <= section_mid_lon <= -115):
                    if (32 <= max_lat <= 42):
                        search_regions.append("US_California")
                        # Ciudades importantes de California
                        if (33.7 <= max_lat <= 34.5 and -118.6 <= section_mid_lon <= -118):
                            search_regions.extend(["US_California_Los_Angeles", "US_California_LA", "Los_Angeles"])
                        elif (37.7 <= max_lat <= 38.5 and -122.5 <= section_mid_lon <= -122):
                            search_regions.extend(["US_California_San_Francisco", "San_Francisco"])
                        elif (32.5 <= max_lat <= 33.5 and -117.3 <= section_mid_lon <= -117):
                            search_regions.extend(["US_California_San_Diego", "San_Diego"])
                    if (42 <= max_lat <= 47):
                        search_regions.append("US_Oregon")
                    if (47 <= max_lat <= 49.5):
                        search_regions.append("US_Washington")
                
                # Mountain West
                elif (-115 <= section_mid_lon <= -105):
                    if (35 <= max_lat <= 42 and -115 <= section_mid_lon <= -114):
                        search_regions.append("US_Nevada")
                        # Las Vegas
                        if (35.9 <= max_lat <= 36.5 and -115.5 <= section_mid_lon <= -115):
                            search_regions.extend(["US_Nevada_Las_Vegas", "Las_Vegas"])
                    if (37 <= max_lat <= 42 and -114 <= section_mid_lon <= -109):
                        search_regions.append("US_Utah")
                        # Salt Lake City
                        if (40.5 <= max_lat <= 41.5 and -112 <= section_mid_lon <= -111.5):
                            search_regions.extend(["US_Utah_Salt_Lake_City", "Salt_Lake_City"])
                    if (31 <= max_lat <= 37 and -115 <= section_mid_lon <= -109):
                        search_regions.append("US_Arizona")
                        # Phoenix
                        if (33 <= max_lat <= 34 and -112.5 <= section_mid_lon <= -111.5):
                            search_regions.extend(["US_Arizona_Phoenix", "Phoenix"])
                        # Tucson
                        if (32 <= max_lat <= 32.5 and -111 <= section_mid_lon <= -110.5):
                            search_regions.extend(["US_Arizona_Tucson", "Tucson"])
                    if (37 <= max_lat <= 41 and -109 <= section_mid_lon <= -102):
                        search_regions.append("US_Colorado")
                        # Denver
                        if (39.5 <= max_lat <= 40 and -105.2 <= section_mid_lon <= -104.8):
                            search_regions.extend(["US_Colorado_Denver", "Denver"])
                
                # Central Plains
                elif (-105 <= section_mid_lon <= -95):
                    if (37 <= max_lat <= 43 and -104 <= section_mid_lon <= -98):
                        search_regions.extend(["US_Nebraska", "Nebraska"])
                    if (37 <= max_lat <= 40 and -102 <= section_mid_lon <= -94.5):
                        search_regions.extend(["US_Kansas", "Kansas"])
                    if (34 <= max_lat <= 37 and -103 <= section_mid_lon <= -94):
                        search_regions.extend(["US_Oklahoma", "Oklahoma"])
                    if (26 <= max_lat <= 36.5 and -107 <= section_mid_lon <= -93):
                        search_regions.extend(["US_Texas", "Texas"])
                        # Principales ciudades de Texas
                        if (29 <= max_lat <= 30.5 and -96 <= section_mid_lon <= -95):
                            search_regions.extend(["US_Texas_Houston", "Houston"])
                        elif (32.5 <= max_lat <= 33.5 and -97.5 <= section_mid_lon <= -96.5):
                            search_regions.extend(["US_Texas_Dallas", "Dallas"])
                
                # Midwest
                elif (-95 <= section_mid_lon <= -87):
                    if (36 <= max_lat <= 40.5 and -95.7 <= section_mid_lon <= -89.1):
                        search_regions.extend(["US_Missouri", "Missouri"])
                    if (41 <= max_lat <= 43.5 and -96.6 <= section_mid_lon <= -89.5):
                        search_regions.extend(["US_Iowa", "Iowa"])
                    if (37 <= max_lat <= 42.5 and -91.5 <= section_mid_lon <= -87.5):
                        search_regions.extend(["US_Illinois", "Illinois"])
                        # Chicago
                        if (41.5 <= max_lat <= 42 and -88 <= section_mid_lon <= -87.5):
                            search_regions.extend(["US_Illinois_Chicago", "Chicago"])
                
                # Great Lakes
                elif (-87 <= section_mid_lon <= -80):
                    if (41 <= max_lat <= 45 and -87 <= section_mid_lon <= -82):
                        search_regions.extend(["US_Michigan", "Michigan"])
                        # Detroit
                        if (42 <= max_lat <= 42.5 and -83.3 <= section_mid_lon <= -82.9):
                            search_regions.extend(["US_Michigan_Detroit", "Detroit"])
                    if (39 <= max_lat <= 42 and -85 <= section_mid_lon <= -80):
                        search_regions.extend(["US_Ohio", "Ohio"])
                        # Cleveland
                        if (41 <= max_lat <= 41.6 and -81.8 <= section_mid_lon <= -81.5):
                            search_regions.extend(["US_Ohio_Cleveland", "Cleveland"])
                
                # Northeast
                elif (-80 <= section_mid_lon <= -66):
                    if (39 <= max_lat <= 43 and -80 <= section_mid_lon <= -73):
                        search_regions.extend(["US_New_York", "New_York", "New York"])
                        # NYC
                        if (40.5 <= max_lat <= 41 and -74.2 <= section_mid_lon <= -73.7):
                            search_regions.extend(["US_New_York_New_York_City", "New_York_City", "NYC"])
                    if (38 <= max_lat <= 43 and -79 <= section_mid_lon <= -69):
                        search_regions.append("US_Pennsylvania")
                    if (41 <= max_lat <= 43 and -74 <= section_mid_lon <= -70):
                        search_regions.append("US_Massachusetts")
                        # Boston
                        if (42.2 <= max_lat <= 42.5 and -71.2 <= section_mid_lon <= -70.8):
                            search_regions.extend(["US_Massachusetts_Boston", "Boston"])
                
                # Southeast
                elif (-95 <= section_mid_lon <= -75):
                    if (30 <= max_lat <= 37 and -92 <= section_mid_lon <= -75):
                        search_regions.extend(["US_North_Carolina", "North_Carolina"])
                    if (30 <= max_lat <= 35 and -88 <= section_mid_lon <= -80):
                        search_regions.extend(["US_Georgia", "Georgia"])
                        # Atlanta
                        if (33.5 <= max_lat <= 34 and -84.5 <= section_mid_lon <= -84):
                            search_regions.extend(["US_Georgia_Atlanta", "Atlanta"])
                    if (24 <= max_lat <= 31 and -88 <= section_mid_lon <= -80):
                        search_regions.extend(["US_Florida", "Florida"])
                        # Miami
                        if (25.5 <= max_lat <= 26.5 and -80.5 <= section_mid_lon <= -80):
                            search_regions.extend(["US_Florida_Miami", "Miami"])
        else:
            # Para rutas pequeñas, usar una coincidencia más específica basada en las coordenadas
            if (-125 <= min_lon <= -115) and (32 <= min_lat <= 42):
                search_regions.append("US_California")
            elif (-115 <= min_lon <= -109) and (31 <= min_lat <= 37):
                search_regions.append("US_Arizona")
            # ... y así sucesivamente para todos los estados principales
    
    # Aquí podríamos añadir más regiones para otros países
    
    # Buscar coincidencias exactas primero
    matched_regions = []
    
    # Eliminar duplicados preservando el orden
    search_regions_unique = []
    for region_id in search_regions:
        if region_id not in search_regions_unique:
            search_regions_unique.append(region_id)
    
    search_regions = search_regions_unique
    
    if search_regions:
        logger.info(f"Buscando coincidencias para regiones: {', '.join(search_regions[:10])}{' y más' if len(search_regions) > 10 else ''}")
    else:
        logger.warning("No se identificaron regiones para buscar")
    
    # Buscar coincidencias exactas
    for search_term in search_regions:
        # Buscar coincidencia exacta
        exact_match = next((r for r in all_regions if r["id"] == search_term), None)
        if exact_match and exact_match not in matched_regions:
            matched_regions.append(exact_match)
            logger.info(f"Coincidencia exacta: {exact_match['id']}")
    
    # Si no hay suficientes coincidencias exactas, buscar coincidencias parciales
    if len(matched_regions) < max_regions:
        for search_term in search_regions:
            # Comprobar si ya tenemos suficientes regiones
            if len(matched_regions) >= max_regions:
                break
                
            # Buscar coincidencias parciales
            partial_matches = []
            for region in all_regions:
                if search_term in region["id"] and region not in matched_regions:
                    partial_matches.append(region)
            
            if partial_matches:
                # Ordenar primero por si es una coincidencia al inicio del ID
                # y luego por tamaño para priorizar regiones específicas (más pequeñas)
                partial_matches.sort(key=lambda r: (0 if r["id"].startswith(search_term) else 1, r.get("size_mb", 9999)))
                
                # Añadir la mejor coincidencia si no está ya en matched_regions
                best_match = partial_matches[0]
                if best_match not in matched_regions:
                    matched_regions.append(best_match)
                    logger.info(f"Coincidencia parcial: '{search_term}' -> {best_match['id']}")
    
    # Para rutas muy largas en EE.UU., asegurarse de incluir un mapa global o de país completo
    if country == "US" and route_width > 15:
        # Buscar mapa de EE.UU. completo si no está ya incluido
        usa_maps = [r for r in all_regions if r["id"] in ["US", "USA", "United_States"] and r not in matched_regions]
        if usa_maps:
            # Ordenar por tamaño y añadir el más pequeño
            usa_maps.sort(key=lambda r: r.get("size_mb", 9999))
            matched_regions.append(usa_maps[0])
            logger.info(f"Añadido mapa completo de EE.UU. para ruta larga: {usa_maps[0]['id']}")
    
    # Si aún no hay regiones o tenemos muy pocas, incluir las regiones más grandes que puedan contener nuestra ruta
    if len(matched_regions) < 2 and all_regions:
        logger.warning(f"Pocas regiones encontradas ({len(matched_regions)}), añadiendo regiones adicionales")
        
        # Si estamos en EE.UU. y tenemos pocas coincidencias, descargar todos los archivos de EE.UU.
        if country == "US" and route_width > 5:
            # Buscar todas las regiones que empiezan con "US_"
            us_regions = [r for r in all_regions if r["id"].startswith("US_") and r not in matched_regions]
            
            # Ordenar por tamaño para priorizar las regiones más importantes/pequeñas primero
            us_regions.sort(key=lambda r: r.get("size_mb", 9999))
            
            # Limitar a un número razonable de regiones (máximo 10)
            max_regions_to_add = min(10, len(us_regions))
            
            if us_regions:
                logger.info(f"Añadiendo {max_regions_to_add} regiones de EE.UU. para una cobertura completa")
                for i in range(max_regions_to_add):
                    if i < len(us_regions):
                        matched_regions.append(us_regions[i])
                        logger.info(f"Añadida región de EE.UU.: {us_regions[i]['id']}")
            
        # Priorizar mapas de país completo o continentales primero
        usa_map = next((r for r in all_regions if r["id"] in ["US", "USA", "United_States"] and r not in matched_regions), None)
        if usa_map:
            matched_regions.append(usa_map)
            logger.info(f"Añadido mapa adicional de país: {usa_map['id']}")
        
        # Si sigue sin haber suficientes regiones, añadir mapas mundiales
        if len(matched_regions) < 1:
            world_map = next((r for r in all_regions if r["id"] in ["World", "planet"] and r not in matched_regions), None)
            if world_map:
                matched_regions.append(world_map)
                logger.info(f"Añadido mapa mundial: {world_map['id']}")
    
    # Registrar resultados
    if matched_regions:
        region_names = ", ".join([r["id"] for r in matched_regions])
        logger.info(f"Se encontraron {len(matched_regions)} regiones para la ruta: {region_names}")
        
        # Cachear los resultados para futuras búsquedas similares
        try:
            from ..region_cache import cache_region_search_results
            await cache_region_search_results(min_lat, max_lat, min_lon, max_lon, matched_regions)
        except Exception as e:
            logger.warning(f"Error al cachear resultados de búsqueda: {str(e)}")
    else:
        logger.warning("No se encontró ninguna región adecuada para la ruta")
    
    return matched_regions

async def get_all_country_maps(country_code, all_regions=None):
    """
    Obtiene todos los mapas disponibles para un país específico.
    
    Args:
        country_code: Código del país (por ejemplo, 'US' para Estados Unidos)
        all_regions: Lista de todas las regiones disponibles (opcional, se obtendrá si no se proporciona)
        
    Returns:
        Lista de regiones del país
    """
    # Si no se proporciona all_regions, intentar importar la función para obtenerlos
    if all_regions is None:
        try:
            # Importamos esta función aquí para evitar importaciones circulares
            from .download import get_available_regions
            regions_response = await get_available_regions()
            all_regions = regions_response.get("regions", [])
        except Exception as e:
            logger.error(f"Error al obtener regiones disponibles: {str(e)}")
            return []
    
    # Buscar el mapa del país completo
    country_map = next((r for r in all_regions if r["id"] == country_code), None)
    country_maps = []
    
    if country_map:
        country_maps.append(country_map)
        logger.info(f"Añadido mapa completo de país: {country_map['id']}")
    
    # Buscar mapas de regiones que pertenecen a este país
    region_prefix = f"{country_code}_"
    country_regions = [r for r in all_regions if r["id"].startswith(region_prefix)]
    
    if country_regions:
        # Ordenar por tamaño para priorizar regiones más pequeñas/específicas
        country_regions.sort(key=lambda r: r.get("size_mb", 9999))
        
        # Añadir hasta un límite máximo de regiones
        max_regions = min(15, len(country_regions))
        for i in range(max_regions):
            if i < len(country_regions):  # Verificar que i está en rango
                country_maps.append(country_regions[i])
        
        logger.info(f"Añadidas {min(max_regions, len(country_regions))} regiones adicionales para {country_code}")
    
    return country_maps
