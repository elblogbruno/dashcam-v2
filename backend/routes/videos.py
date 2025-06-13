from fastapi import APIRouter, HTTPException, UploadFile, Form, File, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
import os
import time
import shutil
import subprocess
import tempfile
from datetime import datetime
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be initialized from main.py
trip_logger = None
video_maker = None
config = None

# Route to generate daily summary video
@router.post("/generate-summary")
async def generate_summary(day: str, background_tasks: BackgroundTasks):
    try:
        target_date = datetime.strptime(day, "%Y-%m-%d").date()
        # Asynchronously generate the video
        background_tasks.add_task(video_maker.create_daily_summary, target_date)
        return {"status": "success", "message": f"Started generating summary for {day}"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

# Route to upload Insta360 videos
@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    date: str = Form(...),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    source: Optional[str] = Form('external'),
    tags: Optional[str] = Form(None)
):
    start_time = time.time()
    logger.info(f"[UPLOAD] Iniciando proceso de carga para archivo: {file.filename} (tamaño: {file.size if hasattr(file, 'size') else 'desconocido'})")
    
    # Validate date format
    try:
        logger.debug(f"[UPLOAD] Validando formato de fecha: {date}")
        upload_date = datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        logger.error(f"[UPLOAD] Formato de fecha inválido: {date}")
        return JSONResponse(
            status_code=400,
            content={"detail": "Invalid date format. Use YYYY-MM-DD"}
        )
    
    # Create upload directory with proper path from config
    year_month = upload_date.strftime('%Y-%m')
    upload_dir = os.path.join(config.upload_path, year_month)
    logger.info(f"[UPLOAD] Directorio de destino: {upload_dir}")
    
    # Verificar espacio disponible
    try:
        import shutil
        total, used, free = shutil.disk_usage(os.path.dirname(upload_dir))
        logger.info(f"[UPLOAD] Espacio en disco: Total={total/1024/1024/1024:.1f}GB, Usado={used/1024/1024/1024:.1f}GB, Libre={free/1024/1024/1024:.1f}GB")
    except Exception as e:
        logger.warning(f"[UPLOAD] No se pudo verificar espacio en disco: {str(e)}")
    
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save the file with a timestamp-based filename
    timestamp = int(time.time())
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{timestamp}{file_extension}"
    file_path = os.path.join(upload_dir, filename)
    
    logger.info(f"[UPLOAD] Guardando archivo como: {file_path}")
    file_save_start = time.time()
    
    try:
        # Registrar memoria antes de la operación
        import psutil
        process = psutil.Process(os.getpid())
        logger.debug(f"[UPLOAD] Memoria antes de guardar: {process.memory_info().rss / 1024 / 1024:.2f}MB")
        
        # Controlar el tamaño del buffer para evitar problemas de memoria
        CHUNK_SIZE = 1024 * 1024  # 1MB chunks
        bytes_copied = 0
        
        with open(file_path, "wb") as buffer:
            logger.debug(f"[UPLOAD] Copiando archivo por chunks de {CHUNK_SIZE/1024}KB")
            
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                buffer.write(chunk)
                bytes_copied += len(chunk)
                
                # Cada 10MB, log de progreso
                if bytes_copied % (10 * 1024 * 1024) == 0:
                    logger.debug(f"[UPLOAD] Progreso: {bytes_copied/1024/1024:.2f}MB copiados")
        
        logger.info(f"[UPLOAD] Archivo guardado correctamente. Bytes copiados: {bytes_copied/1024/1024:.2f}MB en {time.time() - file_save_start:.2f} segundos")
        
        # Registrar memoria después de la operación
        logger.debug(f"[UPLOAD] Memoria después de guardar: {process.memory_info().rss / 1024 / 1024:.2f}MB")
    except Exception as e:
        logger.error(f"[UPLOAD] Error guardando archivo: {str(e)}", exc_info=True)
        # Si hay error al guardar, intentar limpiar archivo parcial
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"[UPLOAD] Archivo parcial eliminado: {file_path}")
            except:
                pass
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error saving file: {str(e)}"}
        )
    
    # Add to database with proper metadata
    logger.info(f"[UPLOAD] Añadiendo registro a base de datos")
    metadata = {
        'file_path': file_path,
        'original_filename': file.filename,
        'lat': lat,
        'lon': lon,
        'source': source,
        'tags': tags
    }
    
    try:
        video_id = trip_logger.add_external_video(upload_date, metadata)
        logger.info(f"[UPLOAD] Video añadido a la base de datos con ID: {video_id}")
    except Exception as e:
        logger.error(f"[UPLOAD] Error añadiendo video a la base de datos: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error adding video to database: {str(e)}"}
        )
    
    total_time = time.time() - start_time
    logger.info(f"[UPLOAD] Proceso completado en {total_time:.2f} segundos")
    
    return {
        "id": video_id,
        "filename": filename,
        "original_filename": file.filename,
        "date": date,
        "status": "uploaded",
        "processing_time": f"{total_time:.2f}s"
    }

# New API endpoint for bulk uploads with processing status tracking
@router.post("/bulk-upload")
async def bulk_upload_videos(
    files: List[UploadFile] = File(...),
    dates: List[str] = Form(...),
    lats: Optional[List[float]] = Form(None),
    lons: Optional[List[float]] = Form(None)
):
    results = []
    
    # Make sure we have the same number of dates as files
    if len(files) != len(dates):
        return JSONResponse(
            status_code=400,
            content={"detail": "Number of files and dates must match"}
        )
    
    # Process each file
    for i, file in enumerate(files):
        try:
            date = dates[i]
            
            # Get coordinates if available
            lat = lats[i] if lats and i < len(lats) else None
            lon = lons[i] if lons and i < len(lons) else None
            
            # Validate date format
            try:
                upload_date = datetime.strptime(date, '%Y-%m-%d')
            except ValueError:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": "Invalid date format. Use YYYY-MM-DD"
                })
                continue
                
            # Create upload directory with proper path from config
            year_month = upload_date.strftime('%Y-%m')
            upload_dir = os.path.join(config.upload_path, year_month)
            os.makedirs(upload_dir, exist_ok=True)
            
            # Save the file with a timestamp-based filename
            timestamp = int(time.time())
            file_extension = os.path.splitext(file.filename)[1]
            filename = f"{timestamp}{file_extension}"
            file_path = os.path.join(upload_dir, filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Add to database with proper metadata
            metadata = {
                'file_path': file_path,
                'original_filename': file.filename,
                'lat': lat,
                'lon': lon,
                'source': 'external'
            }
            
            video_id = trip_logger.add_external_video(upload_date, metadata)
            
            results.append({
                "id": video_id,
                "filename": filename,
                "original_filename": file.filename,
                "date": date,
                "success": True
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    return {"results": results}

# Ruta para obtener miniaturas de videos externos
@router.get("/thumbnail/external/{video_id}")
async def get_external_video_thumbnail(video_id: str):
    """
    Genera y sirve una miniatura para un video externo almacenado en la base de datos
    
    Args:
        video_id: ID del video externo
    """
    try:
        # Obtener la información del video desde la base de datos
        logger.info(f"Buscando video externo con ID: {video_id}")
        video_info = trip_logger.get_external_video(video_id)
        
        if not video_info:
            logger.error(f"No se encontró video externo con ID: {video_id}")
            raise HTTPException(status_code=404, detail="Video externo no encontrado")
        
        # Obtener la ruta al archivo de video
        video_path = video_info.get("file_path")
        logger.info(f"Ruta del archivo de video externo: {video_path}")
        
        if not video_path:
            logger.error(f"Video externo con ID {video_id} no tiene ruta de archivo definida")
            raise HTTPException(status_code=404, detail="Ruta de archivo no definida para video externo")
            
        if not os.path.isfile(video_path):
            logger.error(f"Archivo de video externo no encontrado en la ruta: {video_path}")
            raise HTTPException(status_code=404, detail="Archivo de video externo no encontrado")
        
        # Crear directorio para miniaturas si no existe
        thumbnails_dir = os.path.join(config.data_path, "thumbnails", "external")
        os.makedirs(thumbnails_dir, exist_ok=True)
        
        # Ruta para la miniatura
        thumbnail_path = os.path.join(
            thumbnails_dir,
            f"{video_id}.jpg"
        )
        
        # Generar miniatura si no existe
        if not os.path.exists(thumbnail_path):
            logger.info(f"Generando miniatura para video externo {video_id}")
            generated_path = generate_thumbnail(video_path, thumbnail_path)
            if not generated_path:
                logger.error(f"Error al generar miniatura para video externo {video_id}")
                raise HTTPException(status_code=500, detail="No se pudo generar la miniatura")
            logger.info(f"Miniatura generada correctamente: {generated_path}")
        else:
            logger.info(f"Se encontró miniatura existente: {thumbnail_path}")
        
        # Devolver la imagen de miniatura
        return FileResponse(thumbnail_path, media_type="image/jpeg")
        
    except Exception as e:
        logger.error(f"Error sirviendo miniatura para video externo {video_id}: {str(e)}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error al procesar la solicitud: {str(e)}")

# Ruta para obtener miniaturas de videos (incluye externos)
@router.get("/thumbnail/{path:path}")
async def get_video_thumbnail(path: str):
    """
    Genera y sirve una miniatura para un archivo de video, incluyendo externos.
    
    Args:
        path: Ruta relativa o absoluta al archivo de video.
    """
    try:
        # Si la ruta es absoluta y el archivo existe, úsala directamente
        if os.path.isabs(path) and os.path.isfile(path):
            full_path = path
            # Guardar miniaturas de externos en un subdirectorio especial
            thumbnails_dir = os.path.join(config.data_path, "thumbnails", "external")
            os.makedirs(thumbnails_dir, exist_ok=True)
            thumbnail_name = f"{os.path.splitext(os.path.basename(path))[0]}.jpg"
            thumbnail_path = os.path.join(thumbnails_dir, thumbnail_name)
        else:
            # Normalizar la ruta: eliminar path relativo y data/videos si existen
            if path.startswith("../"):
                path = path.replace("../", "", 1)
            
            # Si el path comienza con "external/", redirigir al endpoint específico
            if path.startswith("external/"):
                video_id = path.split("external/")[1]
                logger.info(f"Redirigiendo solicitud de miniatura a endpoint específico para video_id: {video_id}")
                return RedirectResponse(url=f"/api/videos/thumbnail/external/{video_id}")
                
            # Si es un video externo (en uploads), buscar en uploads
            if path.startswith("uploads/") or "/uploads/" in path:
                # Quitar cualquier prefijo innecesario
                uploads_path = path
                if uploads_path.startswith("uploads/"):
                    uploads_path = uploads_path[len("uploads/"):]
                elif "/uploads/" in uploads_path:
                    uploads_path = uploads_path.split("/uploads/", 1)[1]
                full_path = os.path.join(config.upload_path, uploads_path)
                thumbnails_dir = os.path.join(config.data_path, "thumbnails", "external")
                os.makedirs(thumbnails_dir, exist_ok=True)
                thumbnail_name = f"{os.path.splitext(os.path.basename(path))[0]}.jpg"
                thumbnail_path = os.path.join(thumbnails_dir, thumbnail_name)
            else:
                if path.startswith("data/videos/"):
                    path = path.replace("data/videos/", "", 1)
                # Componer la ruta completa al archivo de video
                full_path = os.path.join(config.data_path, "videos", path)
                thumbnails_dir = os.path.join(config.data_path, "thumbnails")
                os.makedirs(thumbnails_dir, exist_ok=True)
                thumbnail_name = f"{os.path.splitext(os.path.basename(path))[0]}.jpg"
                thumbnail_path = os.path.join(thumbnails_dir, thumbnail_name)

        logger.info(f"Intentando generar miniatura para: {full_path}")

        # Verificar si el archivo existe
        if not os.path.isfile(full_path):
            logger.error(f"Archivo de video no encontrado para miniatura: {full_path}")
            raise HTTPException(status_code=404, detail="Archivo de video no encontrado")

        # Generar miniatura si no existe
        if not os.path.exists(thumbnail_path):
            generated_path = generate_thumbnail(full_path, thumbnail_path)
            if not generated_path:
                raise HTTPException(status_code=500, detail="No se pudo generar la miniatura")

        # Devolver la imagen de miniatura
        return FileResponse(thumbnail_path, media_type="image/jpeg")

    except Exception as e:
        logger.error(f"Error sirviendo miniatura para {path}: {str(e)}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error al procesar la solicitud: {str(e)}")

# Endpoint para acceder a videos externos por ID
@router.get("/external/{video_id}")
async def get_external_video(video_id: str):
    """
    Sirve un video externo almacenado en la base de datos
    """
    try:
        # Obtener información del video desde la base de datos
        video_info = trip_logger.get_external_video(video_id)
        
        if not video_info:
            raise HTTPException(status_code=404, detail="Video externo no encontrado")
        
        # Obtener ruta al archivo de video
        video_path = video_info.get("file_path")
        if not video_path or not os.path.isfile(video_path):
            raise HTTPException(status_code=404, detail="Archivo de video externo no encontrado en disco")
        
        # Devolver el archivo de video
        return FileResponse(
            path=video_path, 
            media_type="video/mp4",
            filename=os.path.basename(video_path)
        )
    
    except Exception as e:
        logger.error(f"Error sirviendo video externo {video_id}: {str(e)}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error al procesar la solicitud: {str(e)}")

# Endpoint para servir archivos de video directamente
@router.get("/{path:path}", include_in_schema=True)
async def get_video_file(path: str):
    """
    Sirve un archivo de video directamente
    
    Args:
        path: Ruta relativa al archivo de video
    """
    try:
        # Normalizar la ruta: eliminar path relativo y data/videos si existen
        if path.startswith("../"):
            path = path.replace("../", "", 1)
        
        if path.startswith("data/videos/"):
            path = path.replace("data/videos/", "", 1)
        
        # Componer la ruta completa al archivo de video
        full_path = os.path.join(config.data_path, "videos", path)
        
        logger.info(f"Intentando servir video desde: {full_path}")
        
        # Verificar si el archivo existe
        if not os.path.isfile(full_path):
            logger.error(f"Video no encontrado: {full_path}")
            raise HTTPException(status_code=404, detail="Archivo de video no encontrado")
        
        # Devolver el archivo de video
        return FileResponse(
            path=full_path, 
            media_type="video/mp4",
            filename=os.path.basename(full_path)
        )
        
    except Exception as e:
        logger.error(f"Error sirviendo video {path}: {str(e)}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error al procesar la solicitud: {str(e)}")

# Utilidad para generar miniaturas de videos
def generate_thumbnail(video_path, output_path=None, time_offset="00:00:03"):
    """
    Genera una miniatura de un archivo de video usando ffmpeg
    
    Args:
        video_path: Ruta al archivo de video
        output_path: Ruta donde guardar la miniatura (opcional)
        time_offset: Tiempo en el video para tomar el fotograma (default: 3 segundos)
        
    Returns:
        La ruta a la miniatura generada
    """
    try:
        # Si no se especifica ruta de salida, crear una basada en el video original
        if output_path is None:
            thumbnail_dir = os.path.join(os.path.dirname(os.path.dirname(video_path)), "thumbnails")
            os.makedirs(thumbnail_dir, exist_ok=True)
            output_path = os.path.join(
                thumbnail_dir,
                f"{os.path.splitext(os.path.basename(video_path))[0]}.jpg"
            )
        
        # Si la miniatura ya existe, devolverla directamente
        if os.path.exists(output_path):
            logger.info(f"Usando miniatura existente: {output_path}")
            return output_path
        
        # Verificar que el video existe y es accesible
        if not os.path.exists(video_path) or not os.access(video_path, os.R_OK):
            logger.error(f"Video no existe o no es accesible: {video_path}")
            return generate_fallback_thumbnail(output_path)
            
        # Primero probar formato estándar MP4
        try:
            # Ejecutar ffmpeg para generar la miniatura con opciones adicionales para evitar bloqueos
            cmd = [
                "ffmpeg", "-ss", time_offset, "-i", video_path, 
                "-vframes", "1", "-q:v", "2", "-vf", "scale=320:-1",
                "-y", "-nostdin", "-loglevel", "error", "-threads", "1",
                output_path
            ]
            
            # Añadir timeout y capturar salida para diagnóstico
            process = subprocess.run(
                cmd, 
                check=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                timeout=10  # Reducir el timeout a 10 segundos
            )
            logger.info(f"Miniatura generada exitosamente: {output_path}")
            return output_path
            
        except subprocess.CalledProcessError as e:
            # Si hay error del demuxer, intentar con otras opciones
            error_output = e.stderr.decode('utf-8', errors='replace')
            logger.warning(f"Error generando miniatura con ffmpeg: {error_output}")
            
            # Intentar con opciones alternativas para cualquier error
            try:
                # Intentar con opciones adicionales para formatos no estándar y problemas
                cmd_alt = [
                    "ffmpeg", "-fflags", "discardcorrupt", "-err_detect", "ignore_err",
                    "-ss", time_offset, "-i", video_path, "-threads", "1",
                    "-vframes", "1", "-q:v", "2", "-vf", "scale=320:-1",
                    "-y", "-nostdin", "-loglevel", "error",
                    output_path
                ]
                
                # Ejecutar con las nuevas opciones y un timeout más corto
                process_alt = subprocess.run(
                    cmd_alt, 
                    check=True, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE,
                    timeout=8
                )
                logger.info(f"Miniatura generada con opciones alternativas: {output_path}")
                return output_path
                
            except Exception as e2:
                logger.error(f"Error en segundo intento de generar miniatura: {str(e2)}")
                return generate_fallback_thumbnail(output_path)
                
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout generando miniatura para {video_path}")
            return generate_fallback_thumbnail(output_path)
            
    except Exception as e:
        logger.error(f"Error generando miniatura para {video_path}: {str(e)}")
        return generate_fallback_thumbnail(output_path)

# Función para generar una miniatura de fallback
def generate_fallback_thumbnail(output_path):
    """
    Genera una imagen de fallback para cuando no se puede generar la miniatura real
    """
    try:
        # Crear un canvas y dibujar un mensaje básico
        from PIL import Image, ImageDraw, ImageFont
        
        # Crear una imagen negra básica
        img = Image.new('RGB', (320, 180), color=(0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Dibujar texto
        draw.text((160, 90), "Vista previa no disponible", fill=(255, 255, 255), anchor="mm")
        
        # Guardar la imagen
        img.save(output_path)
        logger.info(f"Miniatura de fallback generada: {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"Error generando miniatura de fallback: {str(e)}")
        return None