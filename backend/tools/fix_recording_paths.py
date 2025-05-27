#!/usr/bin/env python3
"""
Script para corregir las rutas duplicadas en la tabla recordings.
"""

import sqlite3
import os
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PathFixer:
    def __init__(self, db_path="/root/dashcam-v2/data/recordings.db"):
        self.db_path = db_path
        self.data_path = "/root/dashcam-v2/data"
        
    def fix_duplicate_paths(self):
        """Corregir rutas duplicadas en la tabla recordings."""
        logger.info("Iniciando corrección de rutas duplicadas...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Encontrar rutas con patrones problemáticos que necesitan corrección
            cursor.execute("""
                SELECT id, file_path FROM recordings 
                WHERE file_path LIKE '%data/videos/../data/videos/%'
            """)
            
            problematic_paths = cursor.fetchall()
            logger.info(f"Encontradas {len(problematic_paths)} rutas para corregir")
            
            fixed_count = 0
            
            for record_id, file_path in problematic_paths:
                # Corregir el patrón "data/videos/../data/videos/" 
                if "data/videos/../data/videos/" in file_path:
                    # Reemplazar el patrón duplicado
                    new_path = file_path.replace("data/videos/../data/videos/", "data/videos/")
                    
                    # Verificar que el archivo existe
                    full_path = os.path.join("/root/dashcam-v2", new_path)
                    
                    if os.path.exists(full_path):
                        # Actualizar la base de datos
                        cursor.execute("""
                            UPDATE recordings 
                            SET file_path = ? 
                            WHERE id = ?
                        """, (new_path, record_id))
                        
                        logger.info(f"Corregido: {file_path} -> {new_path}")
                        fixed_count += 1
                    else:
                        logger.warning(f"Archivo no encontrado: {full_path}")
            
            conn.commit()
            logger.info(f"Se corrigieron {fixed_count} rutas")
            
            return fixed_count
            
        except Exception as e:
            logger.error(f"Error corrigiendo rutas: {e}")
            conn.rollback()
            return 0
        finally:
            conn.close()
    
    def validate_paths(self):
        """Validar que las rutas corregidas son correctas."""
        logger.info("Validando rutas corregidas...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT id, file_path FROM recordings LIMIT 10")
            sample_paths = cursor.fetchall()
            
            valid_count = 0
            for record_id, file_path in sample_paths:
                full_path = os.path.join("/root/dashcam-v2", file_path)
                if os.path.exists(full_path):
                    valid_count += 1
                    logger.info(f"✓ Válido: {file_path}")
                else:
                    logger.warning(f"✗ No encontrado: {file_path}")
            
            logger.info(f"Rutas válidas: {valid_count}/{len(sample_paths)}")
            return valid_count == len(sample_paths)
            
        except Exception as e:
            logger.error(f"Error validando rutas: {e}")
            return False
        finally:
            conn.close()

if __name__ == "__main__":
    fixer = PathFixer()
    
    # Corregir rutas
    fixed = fixer.fix_duplicate_paths()
    
    if fixed > 0:
        # Validar correcciones
        if fixer.validate_paths():
            logger.info("✅ Corrección de rutas completada exitosamente")
        else:
            logger.warning("⚠️ Algunas rutas siguen siendo inválidas")
    else:
        logger.info("No se encontraron rutas para corregir")
