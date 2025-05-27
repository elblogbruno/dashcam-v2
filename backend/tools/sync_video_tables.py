#!/usr/bin/env python3
"""
Herramienta de sincronización entre las tablas video_clips y recordings.
Esta herramienta migra datos existentes y mantiene sincronización entre ambas tablas.
"""

import sqlite3
import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# Agregar el directorio padre al path para importar módulos del backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from disk_manager import DiskManager
from trip_logger import TripLogger

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
        self.trip_logger = TripLogger()
        
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
        """Migrar datos de video_clips a recordings."""
        logger.info("Iniciando migración de video_clips a recordings...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Obtener todos los video_clips que no están en recordings
            cursor.execute("""
                SELECT vc.id, vc.road_video_file, vc.interior_video_file, vc.start_time, vc.end_time, vc.trip_id, vc.quality
                FROM video_clips vc
                WHERE vc.id NOT IN (
                    SELECT DISTINCT trip_id FROM recordings WHERE trip_id IS NOT NULL
                )
            """)
            
            video_clips = cursor.fetchall()
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
                    
                    # Insertar en recordings
                    try:
                        cursor.execute("""
                            INSERT INTO recordings (
                                file_path, file_size, duration, 
                                start_time, end_time, trip_id,
                                is_archived, is_processed
                            ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)
                        """, (
                            file_path, file_size, duration,
                            start_time, end_time, str(trip_id)
                        ))
                        
                        migrated_count += 1
                        logger.debug(f"Migrado: {filename} ({camera_type})")
                        
                    except sqlite3.IntegrityError as e:
                        logger.warning(f"Error al migrar {filename}: {e}")
                        continue
            
            conn.commit()
            logger.info(f"Migración completada: {migrated_count} archivos migrados")
            
        except Exception as e:
            logger.error(f"Error durante la migración: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def sync_external_videos_to_recordings(self):
        """Sincronizar external_videos con recordings."""
        logger.info("Sincronizando external_videos con recordings...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Obtener external_videos que no están en recordings
            cursor.execute("""
                SELECT ev.id, ev.file_path, ev.upload_time, ev.source
                FROM external_videos ev
                WHERE ev.file_path NOT IN (
                    SELECT file_path FROM recordings WHERE file_path IS NOT NULL
                )
            """)
            
            external_videos = cursor.fetchall()
            logger.info(f"Encontrados {len(external_videos)} videos externos para sincronizar")
            
            synced_count = 0
            
            for video in external_videos:
                video_id, file_path, upload_time, source = video
                
                # Obtener el nombre del archivo de la ruta
                filename = os.path.basename(file_path)
                actual_file_size = self.get_file_size(file_path)
                
                # Insertar en recordings
                try:
                    cursor.execute("""
                        INSERT INTO recordings (
                            file_path, file_size, duration,
                            start_time, trip_id,
                            is_archived, is_processed
                        ) VALUES (?, ?, 0, ?, ?, 0, 0)
                    """, (
                        file_path, actual_file_size,
                        upload_time, f"external_{video_id}"
                    ))
                    
                    synced_count += 1
                    logger.debug(f"Sincronizado: {filename}")
                    
                except sqlite3.IntegrityError as e:
                    logger.warning(f"Error al sincronizar {filename}: {e}")
                    continue
            
            conn.commit()
            logger.info(f"Sincronización completada: {synced_count} videos externos sincronizados")
            
        except Exception as e:
            logger.error(f"Error durante la sincronización: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def validate_synchronization(self):
        """Validar que la sincronización se realizó correctamente."""
        logger.info("Validando sincronización...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Contar registros en cada tabla
            cursor.execute("SELECT COUNT(*) FROM video_clips")
            video_clips_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM external_videos")
            external_videos_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM recordings")
            recordings_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM recordings WHERE trip_id NOT LIKE 'external_%'")
            recordings_from_clips = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM recordings WHERE trip_id LIKE 'external_%'")
            recordings_from_external = cursor.fetchone()[0]
            
            logger.info(f"Estadísticas de sincronización:")
            logger.info(f"  video_clips: {video_clips_count}")
            logger.info(f"  external_videos: {external_videos_count}")
            logger.info(f"  recordings total: {recordings_count}")
            logger.info(f"  recordings (de clips): {recordings_from_clips}")
            logger.info(f"  recordings (externos): {recordings_from_external}")
            
            # Verificar archivos faltantes
            cursor.execute("""
                SELECT file_path FROM recordings 
                WHERE trip_id NOT LIKE 'external_%'
            """)
            
            missing_files = []
            for (file_path,) in cursor.fetchall():
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
        finally:
            conn.close()
    
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
