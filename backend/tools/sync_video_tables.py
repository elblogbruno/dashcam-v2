#!/usr/bin/env python3
"""
Herramienta de sincronización entre las tablas video_clips y recordings.
Esta herramienta migra datos existentes y mantiene sincronización entre ambas tablas.
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# Agregar el directorio padre al path para importar módulos del backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from disk_manager import DiskManager
from trip_logger_package.trip_logger import TripLogger

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class VideoTableSynchronizer:
    def __init__(self, db_path="/root/dashcam-v2/data/recordings.db"):
        self.db_path = db_path
        self.disk_manager = DiskManager()
        self.trip_logger = TripLogger(db_path=db_path)
        
    def get_file_size(self, file_path):
        """Obtener el tamaño de un archivo en bytes."""
        try:
            if os.path.exists(file_path):
                return os.path.getsize(file_path)
            return 0
        except Exception as e:
            logger.warning(f"No se pudo obtener el tamaño de {file_path}: {e}")
            return 0
            
    def migrate_video_clips_to_recordings(self):
        """Migrar datos de video_clips a recordings usando Trip Logger."""
        logger.info("Iniciando migración de video_clips a recordings...")
        
        try:
            # Obtener todos los videos existentes
            all_videos = self.trip_logger.get_trip_videos()
            existing_trip_ids = {video.get('trip_id') for video in all_videos if video.get('trip_id')}
            
            # Usar SQLAlchemy session para consultar video_clips que no han sido migrados
            with self.trip_logger.get_session() as session:
                # Query raw video_clips table to find unmigrated clips
                result = session.execute("""
                    SELECT vc.id, vc.road_video_file, vc.interior_video_file, 
                           vc.start_time, vc.end_time, vc.trip_id, vc.quality
                    FROM video_clips vc
                    WHERE vc.trip_id NOT IN :existing_ids
                """, {'existing_ids': tuple(existing_trip_ids) if existing_trip_ids else ('',)})
                
                video_clips = result.fetchall()
                logger.info(f"Encontrados {len(video_clips)} video clips para migrar")
                
                migrated_count = 0
                
                for clip in video_clips:
                    clip_id, road_video_file, interior_video_file, start_time, end_time, trip_id, quality = clip
                    
                    # Procesar ambos archivos de video si existen
                    video_files = []
                    if road_video_file:
                        video_files.append(('road', road_video_file))
                    if interior_video_file:
                        video_files.append(('interior', interior_video_file))
                    
                    for camera_type, filename in video_files:
                        # Construir la ruta completa del archivo
                        file_path = f"/root/dashcam-v2/data/videos/{filename}"
                        file_size = self.get_file_size(file_path)
                        
                        # Calcular duración
                        try:
                            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                            duration = int((end_dt - start_dt).total_seconds())
                        except Exception as e:
                            logger.warning(f"No se pudo calcular duración para {filename}: {e}")
                            duration = 0
                        
                        # Usar Trip Logger para agregar la grabación
                        try:
                            recording_data = {
                                'file_path': file_path,
                                'file_size': file_size,
                                'duration': duration,
                                'start_time': start_time,
                                'end_time': end_time,
                                'trip_id': str(trip_id),
                                'is_archived': False,
                                'is_processed': False
                            }
                            
                            self.trip_logger.add_recording(recording_data)
                            migrated_count += 1
                            logger.debug(f"Migrado: {filename} ({camera_type})")
                            
                        except Exception as e:
                            logger.warning(f"Error al migrar {filename}: {e}")
                            continue
                
                logger.info(f"Migración completada: {migrated_count} archivos migrados")
                
        except Exception as e:
            logger.error(f"Error durante la migración: {e}")
            raise
    
    def sync_external_videos_to_recordings(self):
        """Sincronizar external_videos con recordings usando Trip Logger."""
        logger.info("Sincronizando external_videos con recordings...")
        
        try:
            # Obtener todos los videos externos existentes usando Trip Logger
            all_recordings = self.trip_logger.get_all_recordings()
            existing_file_paths = {rec.get('file_path') for rec in all_recordings if rec.get('file_path')}
            
            # Usar SQLAlchemy session para consultar external_videos
            with self.trip_logger.get_session() as session:
                result = session.execute("""
                    SELECT ev.id, ev.file_path, ev.upload_time, ev.source
                    FROM external_videos ev
                    WHERE ev.file_path NOT IN :existing_paths
                """, {'existing_paths': tuple(existing_file_paths) if existing_file_paths else ('',)})
                
                external_videos = result.fetchall()
                logger.info(f"Encontrados {len(external_videos)} videos externos para sincronizar")
                
                synced_count = 0
                
                for video in external_videos:
                    video_id, file_path, upload_time, source = video
                    
                    # Obtener el nombre del archivo de la ruta
                    filename = os.path.basename(file_path)
                    actual_file_size = self.get_file_size(file_path)
                    
                    # Usar Trip Logger para agregar la grabación
                    try:
                        recording_data = {
                            'file_path': file_path,
                            'file_size': actual_file_size,
                            'duration': 0,  # No conocemos la duración de videos externos
                            'start_time': upload_time,
                            'trip_id': f"external_{video_id}",
                            'is_archived': False,
                            'is_processed': False
                        }
                        
                        self.trip_logger.add_recording(recording_data)
                        synced_count += 1
                        logger.debug(f"Sincronizado: {filename}")
                        
                    except Exception as e:
                        logger.warning(f"Error al sincronizar {filename}: {e}")
                        continue
                
                logger.info(f"Sincronización completada: {synced_count} videos externos sincronizados")
                
        except Exception as e:
            logger.error(f"Error durante la sincronización: {e}")
            raise
    
    def validate_synchronization(self):
        """Validar que la sincronización se realizó correctamente usando Trip Logger."""
        logger.info("Validando sincronización...")
        
        try:
            # Usar SQLAlchemy session para obtener estadísticas
            with self.trip_logger.get_session() as session:
                # Contar registros en cada tabla
                video_clips_count = session.execute("SELECT COUNT(*) FROM video_clips").scalar()
                external_videos_count = session.execute("SELECT COUNT(*) FROM external_videos").scalar()
                recordings_count = session.execute("SELECT COUNT(*) FROM recordings").scalar()
                recordings_from_clips = session.execute(
                    "SELECT COUNT(*) FROM recordings WHERE trip_id NOT LIKE 'external_%'"
                ).scalar()
                recordings_from_external = session.execute(
                    "SELECT COUNT(*) FROM recordings WHERE trip_id LIKE 'external_%'"
                ).scalar()
                
                logger.info(f"Estadísticas de sincronización:")
                logger.info(f"  video_clips: {video_clips_count}")
                logger.info(f"  external_videos: {external_videos_count}")
                logger.info(f"  recordings total: {recordings_count}")
                logger.info(f"  recordings (de clips): {recordings_from_clips}")
                logger.info(f"  recordings (externos): {recordings_from_external}")
                
                # Verificar archivos faltantes
                result = session.execute("""
                    SELECT file_path FROM recordings 
                    WHERE trip_id NOT LIKE 'external_%'
                """)
                
                missing_files = []
                for (file_path,) in result.fetchall():
                    if not os.path.exists(file_path):
                        missing_files.append(file_path)
                
                if missing_files:
                    logger.warning(f"Archivos faltantes: {len(missing_files)}")
                    for file_path in missing_files[:5]:  # Mostrar solo los primeros 5
                        logger.warning(f"  - {file_path}")
                    if len(missing_files) > 5:
                        logger.warning(f"  ... y {len(missing_files) - 5} más")
                else:
                    logger.info("Todos los archivos referenciados existen")
                    
        except Exception as e:
            logger.error(f"Error durante la validación: {e}")
    
    def run_full_sync(self):
        """Ejecutar sincronización completa."""
        logger.info("=== Iniciando sincronización completa de tablas de video ===")
        
        try:
            # 1. Migrar video_clips a recordings
            self.migrate_video_clips_to_recordings()
            
            # 2. Sincronizar external_videos a recordings
            self.sync_external_videos_to_recordings()
            
            # 3. Validar la sincronización
            self.validate_synchronization()
            
            logger.info("=== Sincronización completa exitosa ===")
            
        except Exception as e:
            logger.error(f"Error durante la sincronización: {e}")
            return False
        
        return True

def main():
    """Función principal."""
    print("=== Herramienta de Sincronización de Tablas de Video ===")
    print("Esta herramienta sincronizará las tablas video_clips y external_videos con recordings")
    
    response = input("¿Desea continuar? (s/N): ").strip().lower()
    if response not in ['s', 'si', 'sí', 'y', 'yes']:
        print("Operación cancelada")
        return
    
    synchronizer = VideoTableSynchronizer()
    success = synchronizer.run_full_sync()
    
    if success:
        print("\n✅ Sincronización completada exitosamente")
        print("Las tablas ahora están sincronizadas y el sistema de backup debería funcionar correctamente")
    else:
        print("\n❌ Error durante la sincronización")
        print("Revise los logs para más detalles")

if __name__ == "__main__":
    main()
