#!/usr/bin/env python3
"""
Gestión de bases de datos offline para reverse geocoding.
Integración con el trip planner para descargar datos geográficos.
"""

import asyncio
import aiohttp
import sqlite3
import json
import logging
import os
import zipfile
import tempfile
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from urllib.parse import urlencode

from .reverse_geocoding_service import LocationInfo
from ..utils.db_storage import DBStorage

logger = logging.getLogger(__name__)

class OfflineGeoDataManager:
    """Gestor de datos geográficos offline"""
    
    def __init__(self, offline_db_path: str, data_dir: str):
        self.offline_db_path = offline_db_path  # Guardar el path para acceso directo
        self.db_storage = DBStorage()
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # URLs de fuentes de datos geográficos
        self.data_sources = {
            'natural_earth': {
                'countries': 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_0_countries.zip',
                'states': 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_1_states_provinces.zip',
                'populated_places': 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_populated_places.zip'
            }
        }
    
    async def download_region_data(self, bounds: Dict[str, float], 
                                 progress_callback=None) -> Dict:
        """Descargar datos geográficos para una región específica"""
        try:
            logger.info(f"Descargando datos para región: {bounds}")
            
            # Para esta implementación inicial, usaremos Nominatim para obtener
            # algunas ubicaciones de muestra en la región
            locations_added = await self._download_nominatim_region_data(bounds, progress_callback)
            
            return {
                'success': True,
                'locations_added': locations_added,
                'bounds': bounds,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error descargando datos de región: {e}")
            return {
                'success': False,
                'error': str(e),
                'bounds': bounds
            }
    
    async def _download_nominatim_region_data(self, bounds: Dict[str, float], 
                                            progress_callback=None) -> int:
        """Descargar datos de una región usando Nominatim"""
        locations_added = 0
        
        # Crear una grilla de puntos en la región
        lat_step = (bounds['max_lat'] - bounds['min_lat']) / 10
        lon_step = (bounds['max_lon'] - bounds['min_lon']) / 10
        
        total_points = 11 * 11  # Grilla de 11x11
        processed_points = 0
        
        async with aiohttp.ClientSession() as session:
            for i in range(11):
                for j in range(11):
                    lat = bounds['min_lat'] + (i * lat_step)
                    lon = bounds['min_lon'] + (j * lon_step)
                    
                    try:
                        # Llamar a Nominatim para este punto
                        raw_response = await self._get_nominatim_raw_response(session, lat, lon)
                        
                        if raw_response and raw_response.get('address'):
                            # Preparar datos completos para enhanced storage
                            geodata = {
                                'lat': lat,
                                'lon': lon,
                                'raw_response': raw_response,  # Complete Nominatim response
                                'source': 'nominatim_offline_download',
                                'timestamp': datetime.now().isoformat(),
                                # Legacy fields for backward compatibility
                                'name': raw_response.get('display_name', ''),
                                'admin1': raw_response.get('address', {}).get('state', ''),
                                'admin2': raw_response.get('address', {}).get('country', ''),
                                'cc': raw_response.get('address', {}).get('country_code', '').upper()
                            }
                            
                            waypoint = {'lat': lat, 'lon': lon}
                            
                            # Almacenar usando enhanced storage
                            try:
                                await self.db_storage.store_geodata_in_db(geodata, "offline_download", waypoint)
                                locations_added += 1
                                logger.debug(f"Añadida ubicación: {raw_response.get('display_name', f'{lat},{lon}')}")
                            except Exception as store_error:
                                logger.warning(f"Error almacenando ubicación {lat}, {lon}: {store_error}")
                        
                        processed_points += 1
                        
                        if progress_callback:
                            progress = (processed_points / total_points) * 100
                            progress_callback(progress)
                        
                        # Rate limiting
                        await asyncio.sleep(1.2)
                        
                    except Exception as e:
                        logger.warning(f"Error obteniendo datos para {lat}, {lon}: {e}")
                        processed_points += 1
                        continue
        
        logger.info(f"Descarga completada: {locations_added} ubicaciones añadidas")
        return locations_added
    
    async def _get_nominatim_raw_response(self, session, lat: float, lon: float) -> Optional[Dict]:
        """Obtener respuesta completa desde Nominatim para enhanced storage"""
        try:
            params = {
                'lat': lat,
                'lon': lon,
                'format': 'json',
                'addressdetails': 1,
                'extratags': 1,
                'namedetails': 1,
                'zoom': 18  # High detail level for enhanced storage
            }
            
            url = f"https://nominatim.openstreetmap.org/reverse?{urlencode(params)}"
            headers = {'User-Agent': 'DashcamSystem/1.0 Enhanced Offline Data Downloader'}
            
            async with session.get(url, headers=headers, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and 'display_name' in data:
                        return data
                
        except Exception as e:
            logger.debug(f"Error en request Nominatim raw: {e}")
        
        return None
    
    async def _get_nominatim_location(self, session, lat: float, lon: float) -> Optional[LocationInfo]:
        """Obtener ubicación desde Nominatim"""
        try:
            params = {
                'lat': lat,
                'lon': lon,
                'format': 'json',
                'addressdetails': 1,
                'zoom': 10
            }
            
            url = f"https://nominatim.openstreetmap.org/reverse?{urlencode(params)}"
            headers = {'User-Agent': 'DashcamSystem/1.0 Offline Data Downloader'}
            
            async with session.get(url, headers=headers, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_nominatim_response(data)
                
        except Exception as e:
            logger.debug(f"Error en request Nominatim: {e}")
        
        return None
    
    def _parse_nominatim_response(self, data: Dict) -> Optional[LocationInfo]:
        """Parsear respuesta de Nominatim"""
        try:
            if not data or 'address' not in data:
                return None
            
            address = data['address']
            
            return LocationInfo(
                city=address.get('city'),
                town=address.get('town'),
                village=address.get('village'),
                state=address.get('state'),
                country=address.get('country'),
                country_code=address.get('country_code')
            )
        except Exception as e:
            logger.error(f"Error parseando respuesta: {e}")
            return None
    
    def get_coverage_stats(self) -> Dict:
        """Obtener estadísticas de cobertura offline"""
        try:
            # Usar DBStorage para obtener estadísticas de las tablas disponibles
            available_dbs = self.db_storage.get_available_databases()
            
            total_locations = 0
            countries = set()
            states = set()
            cities = set()
            all_bounds = []
            
            for db_info in available_dbs:
                db_path = db_info['path']
                tables = db_info['tables']
                
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    
                    for table in tables:
                        # Intentar obtener datos de cada tabla
                        try:
                            columns = db_info.get('columns', {}).get(table, [])
                            
                            # Buscar columnas de ubicación
                            lat_col = next((col for col in columns if 'lat' in col.lower()), None)
                            lon_col = next((col for col in columns if 'lon' in col.lower()), None)
                            name_col = next((col for col in columns if col.lower() in ['name', 'city', 'admin1']), None)
                            country_col = next((col for col in columns if col.lower() in ['country', 'admin2', 'cc']), None)
                            
                            if lat_col and lon_col:
                                # Contar ubicaciones
                                cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
                                count = cursor.fetchone()[0]
                                total_locations += count
                                
                                # Obtener bounds
                                cursor.execute(f'SELECT MIN({lat_col}), MAX({lat_col}), MIN({lon_col}), MAX({lon_col}) FROM "{table}"')
                                bounds = cursor.fetchone()
                                if bounds and all(b is not None for b in bounds):
                                    all_bounds.extend([bounds[0], bounds[1], bounds[2], bounds[3]])
                                
                                # Obtener ubicaciones únicas
                                if name_col:
                                    cursor.execute(f'SELECT DISTINCT {name_col} FROM "{table}" WHERE {name_col} IS NOT NULL')
                                    cities.update(row[0] for row in cursor.fetchall())
                                
                                if country_col:
                                    cursor.execute(f'SELECT DISTINCT {country_col} FROM "{table}" WHERE {country_col} IS NOT NULL')
                                    countries.update(row[0] for row in cursor.fetchall())
                                    
                        except Exception as table_error:
                            logger.debug(f"Error procesando tabla {table}: {table_error}")
                            continue
                    
                    conn.close()
                    
                except Exception as db_error:
                    logger.debug(f"Error procesando base de datos {db_path}: {db_error}")
                    continue
            
            # Calcular bounds globales
            global_bounds = None
            if all_bounds:
                lats = all_bounds[::2] + all_bounds[1::2]  # Todas las latitudes
                lons = all_bounds[2::2] + all_bounds[3::2]  # Todas las longitudes
                global_bounds = {
                    'min_lat': min(lats),
                    'max_lat': max(lats),
                    'min_lon': min(lons),
                    'max_lon': max(lons)
                }
            
            return {
                'total_locations': total_locations,
                'countries': len(countries),
                'states': len(states),
                'cities': len(cities),
                'bounds': global_bounds,
                'available_databases': len(available_dbs)
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            return {'error': str(e)}
    
    def clear_region_data(self, bounds: Optional[Dict[str, float]] = None) -> int:
        """Limpiar datos de una región específica o todos"""
        try:
            # Usar DBStorage para limpiar datos
            available_dbs = self.db_storage.get_available_databases()
            total_deleted = 0
            
            for db_info in available_dbs:
                db_path = db_info['path']
                tables = db_info['tables']
                
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    
                    for table in tables:
                        try:
                            columns = db_info.get('columns', {}).get(table, [])
                            lat_col = next((col for col in columns if 'lat' in col.lower()), None)
                            lon_col = next((col for col in columns if 'lon' in col.lower()), None)
                            
                            if lat_col and lon_col and bounds:
                                # Eliminar datos dentro de los bounds especificados
                                cursor.execute(f'''
                                DELETE FROM "{table}"
                                WHERE {lat_col} BETWEEN ? AND ?
                                AND {lon_col} BETWEEN ? AND ?
                                ''', (
                                    bounds['min_lat'], bounds['max_lat'],
                                    bounds['min_lon'], bounds['max_lon']
                                ))
                                total_deleted += cursor.rowcount
                            elif not bounds:
                                # Eliminar todos los datos
                                cursor.execute(f'DELETE FROM "{table}"')
                                total_deleted += cursor.rowcount
                                
                        except Exception as table_error:
                            logger.debug(f"Error limpiando tabla {table}: {table_error}")
                            continue
                    
                    conn.commit()
                    conn.close()
                    
                except Exception as db_error:
                    logger.warning(f"Error limpiando base de datos {db_path}: {db_error}")
                    continue
            
            logger.info(f"Eliminadas {total_deleted} ubicaciones de las bases de datos offline")
            return total_deleted
            
        except Exception as e:
            logger.error(f"Error limpiando datos: {e}")
            return 0
    
    async def download_area_data(self, north: float, south: float, east: float, west: float) -> bool:
        """
        Download geodata for a specific area defined by bounds
        
        Args:
            north: Northern latitude bound
            south: Southern latitude bound  
            east: Eastern longitude bound
            west: Western longitude bound
            
        Returns:
            bool: True if download was successful, False otherwise
        """
        try:
            bounds = {
                'max_lat': north,
                'min_lat': south,
                'max_lon': east,
                'min_lon': west
            }
            
            logger.info(f"Starting download for area: N{north:.4f} S{south:.4f} E{east:.4f} W{west:.4f}")
            
            # Download region data using existing method
            result = await self.download_region_data(bounds)
            
            if result.get('success', False):
                logger.info(f"Successfully downloaded data for area, added {result.get('locations_added', 0)} locations")
                return True
            else:
                logger.error(f"Failed to download area data: {result.get('error', 'Unknown error')}")
                return False
                
        except Exception as e:
            logger.error(f"Error downloading area data: {e}")
            return False

class TripGeoDataManager:
    """Gestor de datos geográficos específicos para viajes planificados"""
    
    def __init__(self, landmarks_db, offline_geo_manager: OfflineGeoDataManager):
        self.landmarks_db = landmarks_db
        self.offline_geo_manager = offline_geo_manager
    
    async def download_trip_region_data(self, trip_id: str, 
                                      buffer_km: float = 50.0,
                                      progress_callback=None) -> Dict:
        """Descargar datos geográficos para un viaje específico"""
        try:
            # Obtener información del viaje
            trip = self.landmarks_db.get_trip_by_id(trip_id)
            if not trip:
                return {'success': False, 'error': 'Viaje no encontrado'}
            
            # Calcular bounds del viaje con buffer
            bounds = self._calculate_trip_bounds(trip, buffer_km)
            
            # Descargar datos para la región
            result = await self.offline_geo_manager.download_region_data(bounds, progress_callback)
            
            if result['success']:
                # Marcar el viaje como con datos descargados
                self._mark_trip_geo_downloaded(trip_id)
            
            return result
            
        except Exception as e:
            logger.error(f"Error descargando datos para viaje {trip_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def _calculate_trip_bounds(self, trip: Dict, buffer_km: float) -> Dict[str, float]:
        """Calcular bounds geográficos de un viaje con buffer"""
        # Coordenadas del viaje
        start_lat = trip['start_location']['lat']
        start_lon = trip['start_location']['lon']
        end_lat = trip['end_location']['lat']
        end_lon = trip['end_location']['lon']
        
        # Incluir waypoints si los hay
        all_lats = [start_lat, end_lat]
        all_lons = [start_lon, end_lon]
        
        if 'waypoints' in trip and trip['waypoints']:
            for wp in trip['waypoints']:
                all_lats.append(wp['lat'])
                all_lons.append(wp['lon'])
        
        # Calcular bounds
        min_lat = min(all_lats)
        max_lat = max(all_lats)
        min_lon = min(all_lons)
        max_lon = max(all_lons)
        
        # Añadir buffer (aproximadamente)
        # 1 grado ≈ 111 km, entonces buffer_km/111 grados
        buffer_degrees = buffer_km / 111.0
        
        return {
            'min_lat': min_lat - buffer_degrees,
            'max_lat': max_lat + buffer_degrees,
            'min_lon': min_lon - buffer_degrees,
            'max_lon': max_lon + buffer_degrees
        }
    
    def _mark_trip_geo_downloaded(self, trip_id: str):
        """Marcar un viaje como con datos geográficos descargados"""
        try:
            self.landmarks_db.update_trip(trip_id, {'geo_data_downloaded': True})
            logger.info(f"Viaje {trip_id} marcado con datos geo descargados")
        except Exception as e:
            logger.error(f"Error marcando viaje: {e}")
    
    def get_trips_with_geo_data(self) -> List[Dict]:
        """Obtener viajes que tienen datos geográficos descargados"""
        try:
            trips = self.landmarks_db.get_all_trips()
            return [trip for trip in trips if trip.get('geo_data_downloaded', False)]
        except Exception as e:
            logger.error(f"Error obteniendo viajes con geo data: {e}")
            return []

# Alias para compatibilidad con los imports existentes
OfflineGeoManager = OfflineGeoDataManager
