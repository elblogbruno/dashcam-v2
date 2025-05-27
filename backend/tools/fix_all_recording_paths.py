#!/usr/bin/env python3
"""
Script para corregir las rutas duplicadas en todas las tablas de la base de datos.
Actualizado para trabajar con la estructura actual de la base de datos.
"""

import sqlite3
import os
import re
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabasePathFixer:
    def __init__(self, db_path="/root/dashcam-v2/backend/data/recordings.db"):
        self.db_path = db_path
        self.base_path = "/root/dashcam-v2"
        # Patrón para detectar rutas duplicadas
        self.duplicate_pattern = re.compile(r'(/[^/]+)?/data/videos/\.\./data/videos/')
        
    def normalize_path(self, path):
        """Normalizar y corregir rutas duplicadas."""
        if not path:
            return path
            
        # Usar regex para reemplazar patrones duplicados
        normalized = self.duplicate_pattern.sub('/data/videos/', path)
        
        # Aplicar normalización adicional
        normalized = os.path.normpath(normalized)
        
        return normalized
    
    def fix_external_videos_paths(self):
        """Corregir rutas en la tabla external_videos."""
        logger.info("Verificando rutas en external_videos...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Buscar rutas con patrones problemáticos
            cursor.execute("""
                SELECT id, file_path FROM external_videos 
                WHERE file_path LIKE '%/../data/videos/%'
            """)
            
            problematic_paths = cursor.fetchall()
            logger.info(f"Encontradas {len(problematic_paths)} rutas problemáticas en external_videos")
            
            fixed_count = 0
            for record_id, file_path in problematic_paths:
                new_path = self.normalize_path(file_path)
                
                if new_path != file_path:
                    cursor.execute("""
                        UPDATE external_videos
                        SET file_path = ? 
                        WHERE id = ?
                    """, (new_path, record_id))
                    
                    logger.info(f"Corregido external_videos: {file_path} -> {new_path}")
                    fixed_count += 1
            
            conn.commit()
            return fixed_count
            
        except Exception as e:
            logger.error(f"Error corrigiendo external_videos: {e}")
            conn.rollback()
            return 0
        finally:
            conn.close()
    
    def fix_video_clips_paths(self):
        """Corregir rutas en la tabla video_clips."""
        logger.info("Verificando rutas en video_clips...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Buscar rutas problemáticas en road_video_file
            cursor.execute("""
                SELECT id, road_video_file, interior_video_file FROM video_clips 
                WHERE road_video_file LIKE '%/../data/videos/%' 
                   OR interior_video_file LIKE '%/../data/videos/%'
            """)
            
            problematic_clips = cursor.fetchall()
            logger.info(f"Encontrados {len(problematic_clips)} clips con rutas problemáticas")
            
            fixed_count = 0
            for record_id, road_video, interior_video in problematic_clips:
                new_road = self.normalize_path(road_video) if road_video else road_video
                new_interior = self.normalize_path(interior_video) if interior_video else interior_video
                
                if new_road != road_video or new_interior != interior_video:
                    cursor.execute("""
                        UPDATE video_clips
                        SET road_video_file = ?, interior_video_file = ?
                        WHERE id = ?
                    """, (new_road, new_interior, record_id))
                    
                    if new_road != road_video:
                        logger.info(f"Corregido road_video: {road_video} -> {new_road}")
                    if new_interior != interior_video:
                        logger.info(f"Corregido interior_video: {interior_video} -> {new_interior}")
                    
                    fixed_count += 1
            
            conn.commit()
            return fixed_count
            
        except Exception as e:
            logger.error(f"Error corrigiendo video_clips: {e}")
            conn.rollback()
            return 0
        finally:
            conn.close()
    
    def fix_trips_paths(self):
        """Corregir rutas en la tabla trips."""
        logger.info("Verificando rutas en trips...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Buscar rutas problemáticas en video_files y summary_file
            cursor.execute("""
                SELECT id, video_files, summary_file FROM trips 
                WHERE video_files LIKE '%/../data/videos/%' 
                   OR summary_file LIKE '%/../data/videos/%'
            """)
            
            problematic_trips = cursor.fetchall()
            logger.info(f"Encontrados {len(problematic_trips)} trips con rutas problemáticas")
            
            fixed_count = 0
            for record_id, video_files, summary_file in problematic_trips:
                new_video_files = self.normalize_path(video_files) if video_files else video_files
                new_summary = self.normalize_path(summary_file) if summary_file else summary_file
                
                if new_video_files != video_files or new_summary != summary_file:
                    cursor.execute("""
                        UPDATE trips
                        SET video_files = ?, summary_file = ?
                        WHERE id = ?
                    """, (new_video_files, new_summary, record_id))
                    
                    if new_video_files != video_files:
                        logger.info(f"Corregido video_files: {video_files} -> {new_video_files}")
                    if new_summary != summary_file:
                        logger.info(f"Corregido summary_file: {summary_file} -> {new_summary}")
                    
                    fixed_count += 1
            
            conn.commit()
            return fixed_count
            
        except Exception as e:
            logger.error(f"Error corrigiendo trips: {e}")
            conn.rollback()
            return 0
        finally:
            conn.close()
    
    def validate_database_integrity(self):
        """Validar la integridad de todas las rutas en la base de datos."""
        logger.info("Validando integridad de la base de datos...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Verificar que no quedan rutas duplicadas
            tables_to_check = [
                ("external_videos", "file_path"),
                ("video_clips", "road_video_file"),
                ("video_clips", "interior_video_file"),
                ("trips", "video_files"),
                ("trips", "summary_file")
            ]
            
            total_duplicates = 0
            for table, column in tables_to_check:
                cursor.execute(f"""
                    SELECT COUNT(*) FROM {table} 
                    WHERE {column} LIKE '%/../data/videos/%'
                """)
                duplicates = cursor.fetchone()[0]
                total_duplicates += duplicates
                
                if duplicates > 0:
                    logger.warning(f"Quedan {duplicates} rutas duplicadas en {table}.{column}")
                else:
                    logger.info(f"✓ {table}.{column} - Sin rutas duplicadas")
            
            if total_duplicates == 0:
                logger.info("✅ Base de datos completamente limpia - sin rutas duplicadas")
                return True
            else:
                logger.warning(f"⚠️ Quedan {total_duplicates} rutas duplicadas en total")
                return False
                
        except Exception as e:
            logger.error(f"Error validando base de datos: {e}")
            return False
        finally:
            conn.close()
    
    def get_database_stats(self):
        """Obtener estadísticas de la base de datos."""
        logger.info("Obteniendo estadísticas de la base de datos...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Contar registros en cada tabla
            cursor.execute("SELECT COUNT(*) FROM external_videos")
            external_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM video_clips")
            clips_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM trips")
            trips_count = cursor.fetchone()[0]
            
            logger.info(f"Estadísticas de la base de datos:")
            logger.info(f"  - external_videos: {external_count} registros")
            logger.info(f"  - video_clips: {clips_count} registros")
            logger.info(f"  - trips: {trips_count} registros")
            
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
        finally:
            conn.close()

if __name__ == "__main__":
    fixer = DatabasePathFixer()
    
    # Mostrar estadísticas iniciales
    fixer.get_database_stats()
    
    # Corregir rutas en todas las tablas
    logger.info("=== Iniciando corrección de rutas ===")
    
    external_fixed = fixer.fix_external_videos_paths()
    clips_fixed = fixer.fix_video_clips_paths()
    trips_fixed = fixer.fix_trips_paths()
    
    total_fixed = external_fixed + clips_fixed + trips_fixed
    
    if total_fixed > 0:
        logger.info(f"=== Resumen de correcciones ===")
        logger.info(f"  - external_videos: {external_fixed} rutas corregidas")
        logger.info(f"  - video_clips: {clips_fixed} rutas corregidas")
        logger.info(f"  - trips: {trips_fixed} rutas corregidas")
        logger.info(f"  - Total: {total_fixed} rutas corregidas")
    else:
        logger.info("No se encontraron rutas para corregir")
    
    # Validar integridad final
    if fixer.validate_database_integrity():
        logger.info("✅ Corrección de rutas completada exitosamente")
    else:
        logger.warning("⚠️ Algunas rutas siguen necesitando corrección")
