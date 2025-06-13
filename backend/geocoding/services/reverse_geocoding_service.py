#!/usr/bin/env python3
"""
Módulo de reverse geocoding para el sistema de dashcam.
Proporciona funcionalidad de reverse geocoding online (Nominatim) y offline.
"""

import asyncio
import aiohttp
import sqlite3
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple, Union
from urllib.parse import urlencode
from dataclasses import dataclass, asdict
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class LocationInfo:
    """Clase para representar información de ubicación"""
    city: Optional[str] = None
    town: Optional[str] = None
    village: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    postcode: Optional[str] = None
    road: Optional[str] = None
    house_number: Optional[str] = None
    raw_response: Optional[Dict] = None
    source: Optional[str] = None  # Nueva propiedad para indicar la fuente de datos
    
    def to_dict(self) -> Dict:
        """Convertir a diccionario sin el raw_response"""
        result = asdict(self)
        result.pop('raw_response', None)
        return result
    
    def get_display_name(self) -> str:
        """Obtener un nombre amigable para mostrar"""
        parts = []
        
        # Si tenemos información de dirección específica, usarla
        if self.road:
            road_info = self.road
            if self.house_number:
                road_info = f"{self.house_number} {road_info}"
            parts.append(road_info)
        
        # Preferir city, luego town, luego village
        location_name = None
        if self.city:
            location_name = self.city
        elif self.town:
            location_name = self.town
        elif self.village:
            location_name = self.village
        
        if location_name:
            parts.append(location_name)
        
        # Agregar código postal si está disponible y no tenemos dirección específica
        if self.postcode and not self.road:
            parts.append(f"CP {self.postcode}")
        
        # Agregar estado/provincia si es diferente de la ciudad
        if self.state and self.state != location_name:
            parts.append(self.state)
        
        # Siempre agregar país
        if self.country:
            parts.append(self.country)
        
        # Si no tenemos información específica, usar datos raw si están disponibles
        if not parts and self.raw_response:
            display_name = self.raw_response.get('display_name', '')
            if display_name:
                # Tomar solo las primeras 2-3 partes más relevantes
                display_parts = display_name.split(', ')[:3]
                return ', '.join(display_parts)
        
        return ', '.join(parts) if parts else 'Ubicación desconocida'

class ReverseGeocodingCache:
    """Cache para resultados de reverse geocoding"""
    
    def __init__(self, db_path: str, max_age_hours: int = 24 * 7):  # 1 semana por defecto
        self.db_path = db_path
        self.max_age_hours = max_age_hours
        self._init_cache_db()
    
    def _init_cache_db(self):
        """Inicializar la base de datos de cache"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS geocoding_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                location_info TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                source TEXT NOT NULL DEFAULT 'nominatim'
            )
            ''')
            
            # Crear índice para búsquedas rápidas por coordenadas
            cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_geocoding_coords 
            ON geocoding_cache (lat, lon)
            ''')
            
            conn.commit()
            conn.close()
            logger.info("Cache de reverse geocoding inicializado")
        except Exception as e:
            logger.error(f"Error inicializando cache de geocoding: {e}")
            raise
    
    def get(self, lat: float, lon: float, precision: float = 0.01) -> Optional[LocationInfo]:
        """Obtener resultado del cache"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Buscar en un área alrededor de las coordenadas
            cursor.execute('''
            SELECT location_info, timestamp FROM geocoding_cache
            WHERE lat BETWEEN ? AND ? 
            AND lon BETWEEN ? AND ?
            AND datetime(timestamp) > datetime('now', '-{} hours')
            ORDER BY 
                (ABS(lat - ?) + ABS(lon - ?)) ASC
            LIMIT 1
            '''.format(self.max_age_hours), (
                lat - precision, lat + precision,
                lon - precision, lon + precision,
                lat, lon
            ))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                location_info_dict = json.loads(result[0])
                return LocationInfo(**location_info_dict)
            
            return None
        except Exception as e:
            logger.error(f"Error obteniendo del cache: {e}")
            return None
    
    def set(self, lat: float, lon: float, location_info: LocationInfo, source: str = 'nominatim'):
        """Guardar resultado en el cache"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            INSERT INTO geocoding_cache (lat, lon, location_info, timestamp, source)
            VALUES (?, ?, ?, ?, ?)
            ''', (
                lat, lon,
                json.dumps(location_info.to_dict()),
                datetime.now().isoformat(),
                source
            ))
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error guardando en cache: {e}")
    
    def cleanup_old_entries(self):
        """Limpiar entradas antiguas del cache"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cutoff_time = datetime.now() - timedelta(hours=self.max_age_hours)
            cursor.execute(
                "DELETE FROM geocoding_cache WHERE datetime(timestamp) < ?",
                (cutoff_time.isoformat(),)
            )
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            if deleted_count > 0:
                logger.info(f"Limpieza de cache: {deleted_count} entradas eliminadas")
        except Exception as e:
            logger.error(f"Error limpiando cache: {e}")



class NominatimClient:
    """Cliente simplificado para el servicio Nominatim de OpenStreetMap"""
    
    def __init__(self, rate_limit: float = 1.0, user_agent: str = "DashcamSystem/1.0"):
        self.rate_limit = rate_limit
        self.user_agent = user_agent
        self.last_request_time = 0
    
    async def reverse_geocode(self, lat: float, lon: float) -> Optional[LocationInfo]:
        """Realizar reverse geocoding usando Nominatim"""
        await self._rate_limit_wait()
        
        try:
            params = {
                'lat': lat,
                'lon': lon,
                'format': 'json',
                'addressdetails': 1,
                'zoom': 18
            }
            
            url = f"https://nominatim.openstreetmap.org/reverse?{urlencode(params)}"
            
            async with aiohttp.ClientSession() as session:
                headers = {'User-Agent': self.user_agent}
                
                async with session.get(url, headers=headers, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_nominatim_response(data)
                    else:
                        logger.warning(f"Nominatim returned status {response.status}")
                        return None
                        
        except asyncio.TimeoutError:
            logger.warning("Timeout en request a Nominatim")
            return None
        except Exception as e:
            logger.error(f"Error en reverse geocoding: {e}")
            return None

    async def _rate_limit_wait(self):
        """Esperar para respetar el rate limit"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.rate_limit:
            wait_time = self.rate_limit - time_since_last
            await asyncio.sleep(wait_time)
        
        self.last_request_time = time.time()
    
    def _parse_nominatim_response(self, data: Dict) -> Optional[LocationInfo]:
        """Parsear respuesta de Nominatim"""
        try:
            if not data or 'address' not in data:
                return None
            
            address = data['address']
            
            # Log para debug - ver qué datos estamos recibiendo
            logger.debug(f"Nominatim response data: {json.dumps(address, indent=2)}")
            
            return LocationInfo(
                city=address.get('city'),
                town=address.get('town'),
                village=address.get('village'),
                state=address.get('state'),
                country=address.get('country'),
                country_code=address.get('country_code'),
                postcode=address.get('postcode'),
                road=address.get('road'),
                house_number=address.get('house_number'),
                raw_response=data,
                source='online'  # Marcar como fuente online
            )
        except Exception as e:
            logger.error(f"Error parseando respuesta de Nominatim: {e}")
            return None

class ReverseGeocodingService:
    """Servicio principal de reverse geocoding simplificado"""
    
    def __init__(self, 
                 cache_db_path: str,
                 enable_online: bool = True,
                 rate_limit: float = 1.0):
        self.enable_online = enable_online
        self.cache = ReverseGeocodingCache(cache_db_path)
        self.nominatim = NominatimClient(rate_limit=rate_limit)
        
        # Initialize DBStorage for offline lookup
        try:
            from geocoding.utils.db_storage import DBStorage
            self.db_storage = DBStorage(geocoding_db_path=cache_db_path)
        except ImportError:
            self.db_storage = None
            logger.warning("DBStorage not available for offline geocoding")
        
        # Statistics tracking
        self.stats = {
            'total_requests': 0,
            'cache_hits': 0,
            'offline_hits': 0,
            'online_hits': 0,
            'failed_requests': 0
        }
    
    async def get_location(self, lat: float, lon: float, 
                          force_online: bool = False) -> Optional[LocationInfo]:
        """Obtener información de ubicación para unas coordenadas"""
        self.stats['total_requests'] += 1
        
        # 1. Intentar cache primero (si no se fuerza online)
        if not force_online:
            cached_result = self.cache.get(lat, lon)
            if cached_result:
                self.stats['cache_hits'] += 1
                logger.debug(f"Cache hit para {lat}, {lon}")
                logger.info(f"CACHE RAW RESPONSE for {lat}, {lon}: {json.dumps(cached_result.to_dict(), indent=2, ensure_ascii=False)}")
                # Asegurar que tiene información de fuente
                if cached_result.source is None:
                    cached_result.source = "cache"
                return cached_result
        
        # 2. Intentar base de datos offline
        if not force_online and self.db_storage:
            try:
                offline_result = await self.db_storage.reverse_geocode(lat, lon, radius_km=2.0)
                if offline_result:
                    self.stats['offline_hits'] += 1
                    logger.debug(f"Offline DB hit para {lat}, {lon}: {offline_result['name']}")
                    logger.info(f"OFFLINE DB RAW RESPONSE for {lat}, {lon}: {json.dumps(offline_result, indent=2, ensure_ascii=False)}")
                    
                    # Convert to LocationInfo - using individual fields from repaired database
                    location_info = LocationInfo(
                        road=offline_result.get('road'),
                        house_number=offline_result.get('house_number'),
                        city=offline_result.get('city'),
                        town=offline_result.get('town'),
                        village=offline_result.get('village'),
                        state=offline_result.get('state'),
                        country=offline_result.get('country'),
                        country_code=offline_result.get('country_code'),
                        postcode=offline_result.get('postcode'),
                        raw_response=offline_result,  # Store raw response
                        source='offline'  # Marcar como fuente offline
                    )
                    
                    # Guardar en cache para futuras consultas
                    self.cache.set(lat, lon, location_info, source='offline')
                    return location_info
            except Exception as e:
                logger.warning(f"Error en búsqueda offline: {e}")
        
        # 3. Intentar servicio online (Nominatim)
        if self.enable_online or force_online:
            try:
                online_result = await self.nominatim.reverse_geocode(lat, lon)
                if online_result:
                    self.stats['online_hits'] += 1
                    logger.debug(f"Online geocoding exitoso para {lat}, {lon}")
                    logger.info(f"NOMINATIM RAW RESPONSE for {lat}, {lon}: {json.dumps(online_result.raw_response, indent=2, ensure_ascii=False)}")
                    # Asegurar que el resultado tiene marcada la fuente como online
                    if online_result.source is None:
                        online_result.source = "online"
                    # Guardar en cache
                    self.cache.set(lat, lon, online_result, source='nominatim')
                    
                    # Try to store in offline DB for future use
                    try:
                        if self.db_storage:
                            from geocoding.utils.db_storage import store_geodata_in_db
                            
                            # Crear geodata completo desde la respuesta raw de Nominatim
                            raw_response = online_result.raw_response or {}
                            
                            geodata = {
                                "lat": lat,
                                "lon": lon,
                                "place_id": raw_response.get("place_id"),
                                "licence": raw_response.get("licence"),
                                "osm_type": raw_response.get("osm_type"),
                                "osm_id": raw_response.get("osm_id"),
                                "class": raw_response.get("class"),
                                "type": raw_response.get("type"),
                                "place_rank": raw_response.get("place_rank"),
                                "importance": raw_response.get("importance"),
                                "addresstype": raw_response.get("addresstype"),
                                "name": raw_response.get("name") or online_result.city,
                                "display_name": raw_response.get("display_name"),
                                "address": raw_response.get("address", {}),
                                "boundingbox": raw_response.get("boundingbox", []),
                                "source": "nominatim",
                                "raw_response": json.dumps(raw_response)
                            }
                            
                            waypoint = {"latitude": lat, "longitude": lon}
                            await store_geodata_in_db(geodata, "cache", waypoint)
                            logger.debug(f"Stored rich geodata for {lat}, {lon} in offline database")
                    except Exception as store_error:
                        logger.warning(f"Could not store online result in offline DB: {store_error}")
                    
                    return online_result
            except Exception as e:
                logger.error(f"Error en geocoding online: {e}")
        
        # 4. No se pudo obtener información
        self.stats['failed_requests'] += 1
        logger.warning(f"No se pudo obtener ubicación para {lat}, {lon}")
        return None
    
    def get_stats(self) -> Dict:
        """Get service statistics"""
        total = self.stats['total_requests']
        if total == 0:
            return {
                **self.stats,
                'cache_hit_rate': 0.0,
                'offline_hit_rate': 0.0,
                'online_hit_rate': 0.0,
                'success_rate': 0.0
            }
        
        return {
            **self.stats,
            'cache_hit_rate': round((self.stats['cache_hits'] / total) * 100, 2),
            'offline_hit_rate': round((self.stats['offline_hits'] / total) * 100, 2),
            'online_hit_rate': round((self.stats['online_hits'] / total) * 100, 2),
            'success_rate': round(((total - self.stats['failed_requests']) / total) * 100, 2)
        }
    
    def cleanup_cache(self):
        """Limpiar cache antiguo"""
        self.cache.cleanup_old_entries()
