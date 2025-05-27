#!/usr/bin/env python3
# Herramienta para convertir videos a un formato más compatible

import os
import sys
import subprocess
import argparse
import logging
from datetime import datetime
import glob

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("fix_videos")

def convert_video(input_path, output_path=None, overwrite=False):
    """
    Convierte un video a formato H.264 para mayor compatibilidad
    
    Args:
        input_path: Ruta al video original
        output_path: Ruta para el video convertido (opcional)
        overwrite: Si se debe sobreescribir el archivo original
    
    Returns:
        bool: True si la conversión fue exitosa, False en caso contrario
    """
    try:
        # Si no se especifica output_path, crear uno usando el nombre original
        if not output_path:
            dirname = os.path.dirname(input_path)
            basename = os.path.splitext(os.path.basename(input_path))[0]
            output_path = os.path.join(dirname, f"{basename}_fixed.mp4")
        
        # Si el archivo convertido ya existe, saltarlo
        if os.path.exists(output_path) and not overwrite:
            logger.info(f"El archivo {output_path} ya existe, saltando")
            return True
            
        logger.info(f"Convirtiendo {input_path} a {output_path}")
        
        # Verificar que el archivo de entrada existe
        if not os.path.exists(input_path):
            logger.error(f"El archivo {input_path} no existe")
            return False
            
        # Convertir el video usando ffmpeg con codec H.264
        cmd = [
            "ffmpeg", "-i", input_path, 
            "-c:v", "libx264", "-preset", "fast",
            "-crf", "23", "-vsync", "1", 
            "-y", output_path
        ]
        
        process = subprocess.run(cmd, 
                                capture_output=True, 
                                text=True,
                                check=False)
                                
        if process.returncode != 0:
            logger.error(f"Error convirtiendo {input_path}: {process.stderr}")
            return False
            
        # Si overwrite está habilitado, reemplazar el archivo original
        if overwrite:
            # Hacer backup del original primero
            backup_path = f"{input_path}.bak"
            os.rename(input_path, backup_path)
            os.rename(output_path, input_path)
            logger.info(f"Archivo original respaldado como {backup_path}")
            
        return True
        
    except Exception as e:
        logger.error(f"Error procesando {input_path}: {str(e)}")
        return False

def process_directory(directory, pattern="*interior.mp4", overwrite=False):
    """
    Procesa todos los videos en un directorio que coinciden con el patrón
    
    Args:
        directory: El directorio a procesar
        pattern: Patrón glob para los archivos de video
        overwrite: Si se deben sobreescribir los archivos originales
        
    Returns:
        tuple: (cantidad de éxitos, cantidad de fallos)
    """
    success_count = 0
    failure_count = 0
    
    # Buscar todos los archivos que coinciden con el patrón
    search_path = os.path.join(directory, pattern)
    video_files = glob.glob(search_path)
    
    if not video_files:
        logger.info(f"No se encontraron archivos que coincidan con {pattern} en {directory}")
        return 0, 0
        
    logger.info(f"Encontrados {len(video_files)} archivos para procesar")
    
    # Procesar cada archivo
    for video_file in video_files:
        if convert_video(video_file, overwrite=overwrite):
            success_count += 1
        else:
            failure_count += 1
    
    return success_count, failure_count

def main():
    parser = argparse.ArgumentParser(description="Convierte videos al formato H.264 para mejor compatibilidad")
    parser.add_argument("--dir", required=True, help="Directorio que contiene los videos a convertir")
    parser.add_argument("--pattern", default="*interior.mp4", 
                       help="Patrón para buscar archivos (default: *interior.mp4)")
    parser.add_argument("--overwrite", action="store_true", 
                       help="Sobreescribe los archivos originales (hace un backup)")
    parser.add_argument("--recursive", action="store_true",
                      help="Buscar videos de manera recursiva en subdirectorios")
    
    args = parser.parse_args()
    
    # Verificar que el directorio existe
    if not os.path.isdir(args.dir):
        logger.error(f"El directorio {args.dir} no existe")
        return 1
    
    # Si es recursivo, buscar en todos los subdirectorios
    if args.recursive:
        total_success = 0
        total_failure = 0
        
        # Recorrer todos los subdirectorios
        for root, _, _ in os.walk(args.dir):
            logger.info(f"Procesando directorio: {root}")
            success, failure = process_directory(root, args.pattern, args.overwrite)
            total_success += success
            total_failure += failure
            
        logger.info(f"Proceso completado: {total_success} videos convertidos con éxito, {total_failure} fallos")
    else:
        # Procesar solo el directorio especificado
        success, failure = process_directory(args.dir, args.pattern, args.overwrite)
        logger.info(f"Proceso completado: {success} videos convertidos con éxito, {failure} fallos")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
