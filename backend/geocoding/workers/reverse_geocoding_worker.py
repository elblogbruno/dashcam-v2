#!/usr/bin/env python3
"""
Worker en segundo plano para procesar reverse geocoding de clips sin ubicación.
"""

import asyncio
import os
import sys
import logging
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
from pathlib import Path
from sqlalchemy import text

# Agregar el directorio backend al path para importar módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from geocoding.services.reverse_geocoding_service import ReverseGeocodingService, LocationInfo
from trip_logger_package.services.trip_manager import TripManager

logger = logging.getLogger(__name__)

class ReverseGeocodingWorker:
    """Worker para procesar clips sin reverse geocoding"""
    
    def __init__(self, 
                 reverse_geocoding_service: ReverseGeocodingService,
                 trip_manager: TripManager,
                 batch_size: int = 10,
                 delay_between_batches: float = 60.0,
                 connected_clients: Optional[Set] = None):
        self.reverse_geocoding_service = reverse_geocoding_service
        self.trip_manager = trip_manager
        self.batch_size = batch_size
        self.delay_between_batches = delay_between_batches
        self.running = False
        self.worker_thread = None
        self.connected_clients = connected_clients or set()
        
        # Estadísticas del worker
        self.stats = {
            'clips_processed': 0,
            'clips_failed': 0,
            'last_batch_time': None,
            'last_batch_count': 0,
            'start_time': datetime.now().isoformat()
        }
        
        logger.info("ReverseGeocodingWorker inicializado")
    
    
    async def start(self):
        """Iniciar el worker en segundo plano"""
        if self.running:
            logger.warning("Worker ya está ejecutándose")
            return
        
        self.running = True
        
        # Ejecutar el worker loop directamente en el event loop actual
        await self._worker_loop_async()
        
        logger.info("ReverseGeocodingWorker iniciado")
    
    def stop(self):
        """Detener el worker"""
        self.running = False
        logger.info("ReverseGeocodingWorker detenido")
    
    async def _worker_loop_async(self):
        """Bucle principal del worker (versión async)"""
        logger.info("Worker loop iniciado")
        
        while self.running:
            try:
                # Procesar un lote de clips
                processed = await self._process_batch()
                
                if processed > 0:
                    logger.info(f"Procesados {processed} clips en este lote")
                    self.stats['last_batch_count'] = processed
                    self.stats['last_batch_time'] = datetime.now().isoformat()
                    
                    # Enviar notificación a los clientes conectados
                    await self._send_notification({
                        'type': 'geocoding_progress',
                        'message': f'Procesados {processed} clips con información de ubicación',
                        'title': 'Geocodificación Completada',
                        'clips_processed': processed,
                        'timestamp': datetime.now().isoformat()
                    })
                else:
                    logger.debug("No hay clips pendientes de procesar")
                
                # Esperar antes del siguiente lote usando asyncio.sleep
                for _ in range(int(self.delay_between_batches * 10)):
                    if not self.running:
                        break
                    await asyncio.sleep(0.1)
                    
            except Exception as e:
                logger.error(f"Error en worker loop: {e}")
                await asyncio.sleep(30)  # Esperar más tiempo si hay error
    
    def _worker_loop(self):
        """Bucle principal del worker"""
        logger.info("Worker loop iniciado")
        
        while self.running:
            try:
                # Procesar un lote de clips
                processed = asyncio.run(self._process_batch())
                
                if processed > 0:
                    logger.info(f"Procesados {processed} clips en este lote")
                else:
                    logger.debug("No hay clips pendientes de procesar")
                
                # Esperar antes del siguiente lote
                for _ in range(int(self.delay_between_batches * 10)):
                    if not self.running:
                        break
                    time.sleep(0.1)
                    
            except Exception as e:
                logger.error(f"Error en worker loop: {e}")
                time.sleep(30)  # Esperar más tiempo si hay error
    
    async def _process_batch(self) -> int:
        """Procesar un lote de clips sin ubicación"""
        clips_to_process = self._get_clips_without_location()
        
        if not clips_to_process:
            return 0
        
        processed_count = 0
        
        for clip in clips_to_process[:self.batch_size]:
            try:
                success = await self._process_clip(clip)
                if success:
                    processed_count += 1
                    self.stats['clips_processed'] += 1
                else:
                    self.stats['clips_failed'] += 1
            except Exception as e:
                logger.error(f"Error procesando clip {clip['id']}: {e}")
                self.stats['clips_failed'] += 1
        
        # Actualizar estadísticas del lote
        self.stats['last_batch_time'] = datetime.now().isoformat()
        self.stats['last_batch_count'] = processed_count
        
        # Enviar notificación sobre el procesamiento completado
        if processed_count > 0:
            await self._send_notification({
                "title": "Geocodificación completada",
                "message": f"Procesados {processed_count} clips de video con información de ubicación",
                "type": "success",
                "data": {
                    "clips_processed": processed_count,
                    "total_processed": self.stats['clips_processed'],
                    "total_failed": self.stats['clips_failed'],
                    "batch_time": self.stats['last_batch_time']
                }
            })
        
        return processed_count
    
    async def _send_notification(self, notification_data: Dict):
        """Enviar notificación a todos los clientes WebSocket conectados"""
        if not self.connected_clients:
            return
        
        message = {
            "type": "notification",
            "notification": notification_data
        }
        
        # Enviar a todos los clientes conectados
        clients_to_remove = []
        
        for client in list(self.connected_clients):
            try:
                if hasattr(client, 'client_state') and client.client_state.name == "DISCONNECTED":
                    clients_to_remove.append(client)
                    continue
                    
                await asyncio.wait_for(client.send_json(message), timeout=1.0)
            except Exception as e:
                logger.warning(f"Error enviando notificación a cliente WebSocket: {e}")
                clients_to_remove.append(client)
        
        # Remover clientes desconectados
        for client in clients_to_remove:
            self.connected_clients.discard(client)
        
        if clients_to_remove:
            logger.debug(f"Removidos {len(clients_to_remove)} clientes WebSocket desconectados")
    
    def _get_clips_without_location(self) -> List[Dict]:
        """Obtener clips que no tienen información de ubicación"""
        try:
            with self.trip_manager.db_manager.session_scope() as session:
                # Buscar clips que tienen coordenadas GPS pero no tienen location
                result = session.execute(text('''
                SELECT id, start_lat, start_lon, end_lat, end_lon, start_time, end_time
                FROM video_clips
                WHERE (start_lat IS NOT NULL AND start_lon IS NOT NULL)
                AND (location IS NULL OR location = '')
                ORDER BY start_time DESC
                LIMIT :batch_limit
                '''), {"batch_limit": self.batch_size * 2})  # Obtener el doble para tener buffer
                
                clips = [dict(row._mapping) for row in result.fetchall()]
                
                return clips
                
        except Exception as e:
            logger.error(f"Error obteniendo clips sin ubicación: {e}")
            return []
    
    async def _process_clip(self, clip: Dict) -> bool:
        """Procesar un clip individual"""
        try:
            clip_id = clip['id']
            start_lat = clip['start_lat']
            start_lon = clip['start_lon']
            end_lat = clip['end_lat']
            end_lon = clip['end_lon']
            
            logger.debug(f"Procesando clip {clip_id}")
            
            # Usar coordenadas de inicio como principal
            if start_lat and start_lon:
                location_info = await self.reverse_geocoding_service.get_location(start_lat, start_lon)
                
                if location_info:
                    # Actualizar la base de datos con la información de ubicación
                    success = self._update_clip_location(clip_id, location_info)
                    if success:
                        logger.info(f"Clip {clip_id} actualizado con ubicación: {location_info.get_display_name()}")
                        return True
                else:
                    logger.debug(f"No se pudo obtener ubicación para clip {clip_id}")
            
            return False
            
        except Exception as e:
            logger.error(f"Error procesando clip: {e}")
            return False
    
    def _update_clip_location(self, clip_id: int, location_info: LocationInfo) -> bool:
        """Actualizar la ubicación de un clip en la base de datos"""
        try:
            with self.trip_manager.db_manager.session_scope() as session:
                # Primero verificar si la columna 'location' existe
                result = session.execute(text("PRAGMA table_info(video_clips)"))
                columns = [column[1] for column in result.fetchall()]
                
                if 'location' not in columns:
                    # Añadir la columna location si no existe
                    session.execute(text("ALTER TABLE video_clips ADD COLUMN location TEXT"))
                    logger.info("Columna 'location' añadida a video_clips")
                
                # Crear JSON con la información de ubicación
                location_json = {
                    'display_name': location_info.get_display_name(),
                    'city': location_info.city,
                    'town': location_info.town,
                    'village': location_info.village,
                    'state': location_info.state,
                    'country': location_info.country,
                    'country_code': location_info.country_code,
                    'timestamp': datetime.now().isoformat()
                }
                
                # Actualizar el clip
                result = session.execute(text('''
                UPDATE video_clips 
                SET location = :location_json
                WHERE id = :clip_id
                '''), {"location_json": json.dumps(location_json), "clip_id": clip_id})
                
                return result.rowcount > 0
                
        except Exception as e:
            logger.error(f"Error actualizando ubicación del clip: {e}")
            return False
    def process_single_clip(self, clip_id: int) -> bool:
        """Procesar un clip específico inmediatamente"""
        try:
            with self.trip_manager.db_manager.session_scope() as session:
                result = session.execute(text('''
                SELECT id, start_lat, start_lon, end_lat, end_lon, start_time, end_time
                FROM video_clips
                WHERE id = :clip_id
                '''), {"clip_id": clip_id})
                
                clip = result.fetchone()
                
                if clip:
                    return asyncio.run(self._process_clip(dict(clip._mapping)))
                
                return False
                
        except Exception as e:
            logger.error(f"Error procesando clip individual {clip_id}: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Obtener estadísticas del worker"""
        stats = {
            'worker_running': self.running,
            'worker_stats': self.stats
        }
        
        # Añadir estadísticas de clips pendientes
        try:
            with self.trip_manager.db_manager.session_scope() as session:
                result = session.execute(text('''
                SELECT COUNT(*) FROM video_clips
                WHERE (start_lat IS NOT NULL AND start_lon IS NOT NULL)
                AND (location IS NULL OR location = '')
                '''))
                
                pending_count = result.fetchone()[0]
                stats['clips_pending'] = pending_count
                
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            stats['clips_pending'] = -1
        
        return stats
