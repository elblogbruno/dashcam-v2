#!/usr/bin/env python3
"""
Script para corregir las rutas duplicadas en la tabla recordings.
"""

import os
import sys
import logging
from pathlib import Path

# Agregar el directorio backend al path para importar módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from trip_logger_package.trip_logger import TripLogger

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PathFixer:
    def __init__(self, db_path="/root/dashcam-v2/data/recordings.db"):
        self.db_path = db_path
        self.data_path = "/root/dashcam-v2/data"
        self.trip_logger = TripLogger(db_path)
        
    def fix_duplicate_paths(self):
        """Corregir rutas duplicadas en la tabla recordings usando Trip Logger."""
        logger.info("Iniciando corrección de rutas duplicadas...")
        
        try:
            # Usar SQLAlchemy session para operaciones de base de datos
            with self.trip_logger.get_session() as session:
                # Encontrar rutas con patrones problemáticos que necesitan corrección
                result = session.execute("""
                    SELECT id, file_path FROM recordings 
                    WHERE file_path LIKE '%data/videos/../data/videos/%'
                """)
                
                problematic_paths = result.fetchall()
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
                            session.execute("""
                                UPDATE recordings
                                SET file_path = :new_path
                                WHERE id = :record_id
                            """, {'new_path': new_path, 'record_id': record_id})
                            
                            fixed_count += 1
                            logger.info(f"Corregida ruta: {file_path} -> {new_path}")
                        else:
                            logger.warning(f"Archivo no encontrado para ruta corregida: {full_path}")
                
                logger.info(f"Corrección completada: {fixed_count} rutas corregidas")
                return fixed_count
                
        except Exception as e:
            logger.error(f"Error corrigiendo rutas: {e}")
            return 0
    
    def validate_paths(self):
        """Validar que las rutas corregidas son correctas usando Trip Logger."""
        logger.info("Validando rutas corregidas...")
        
        try:
            with self.trip_logger.get_session() as session:
                result = session.execute("SELECT id, file_path FROM recordings LIMIT 10")
                sample_paths = result.fetchall()
                
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

if __name__ == "__main__":
    fixer = PathFixer()
    
    print("=== Corrector de Rutas de Grabaciones ===")
    print("Este script corregirá rutas duplicadas en la tabla recordings")
    
    response = input("¿Desea continuar? (s/N): ").strip().lower()
    if response not in ['s', 'si', 'sí', 'y', 'yes']:
        print("Operación cancelada")
        exit()
    
    # Corregir rutas
    fixed_count = fixer.fix_duplicate_paths()
    
    if fixed_count > 0:
        print(f"\n✅ Se corrigieron {fixed_count} rutas")
        
        # Validar las correcciones
        print("\nValidando correcciones...")
        is_valid = fixer.validate_paths()
        
        if is_valid:
            print("✅ Todas las rutas muestreadas son válidas")
        else:
            print("⚠️ Algunas rutas pueden tener problemas")
    else:
        print("\n✅ No se encontraron rutas que corregir")
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
