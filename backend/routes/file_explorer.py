from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import os
import logging
import datetime
import shutil
from pathlib import Path
import subprocess
import json

router = APIRouter()
logger = logging.getLogger(__name__)

# Referencias a módulos que serán inicializados desde main.py
disk_manager = None

# Modelos para los parámetros
class FileMoveRequest(BaseModel):
    source_path: str
    target_path: str

class DeleteRequest(BaseModel):
    path: str
    is_directory: bool = False

class IndexFileRequest(BaseModel):
    file_path: str
    file_date: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tags: Optional[str] = None
    source: str = "external"

class ListDirectoryRequest(BaseModel):
    path: str
    filter_video: bool = False

def get_file_extension(filename: str) -> str:
    """Devuelve la extensión de un archivo en minúsculas"""
    return os.path.splitext(filename)[1].lower()

def is_video_file(filename: str) -> bool:
    """Determina si el archivo es un video basado en su extensión"""
    video_extensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.insv', '.mts', '.m2ts']
    return get_file_extension(filename) in video_extensions

def get_file_info(file_path: str) -> Dict[str, Any]:
    """Obtiene información detallada sobre un archivo"""
    try:
        if not os.path.exists(file_path):
            return {
                "name": os.path.basename(file_path),
                "path": file_path,
                "error": "El archivo no existe"
            }
            
        stat_info = os.stat(file_path)
        is_dir = os.path.isdir(file_path)
        
        try:
            mtime = datetime.datetime.fromtimestamp(stat_info.st_mtime).isoformat()
        except (ValueError, OverflowError, OSError):
            mtime = datetime.datetime.now().isoformat()
            
        try:
            ctime = datetime.datetime.fromtimestamp(stat_info.st_ctime).isoformat()
        except (ValueError, OverflowError, OSError):
            ctime = datetime.datetime.now().isoformat()
        
        file_info = {
            "name": os.path.basename(file_path) or "Unknown",
            "path": file_path,
            "is_directory": is_dir,
            "size": 0 if is_dir else stat_info.st_size,
            "modified": mtime,
            "created": ctime,
        }
        
        # Agregar información específica para archivos de video
        if not is_dir:
            try:
                if is_video_file(file_path):
                    file_info["is_video"] = True
                    file_info["mime_type"] = get_mime_type(file_path)
                    # La duración se podría obtener con un método más avanzado si es necesario
            except Exception as video_error:
                logger.warning(f"Error al determinar tipo de video para {file_path}: {video_error}")
                # No marcar como video en caso de error
        
        return file_info
    except Exception as e:
        logger.error(f"Error al obtener información del archivo {file_path}: {e}")
        return {
            "name": os.path.basename(file_path) or "Error",
            "path": file_path,
            "error": str(e)
        }

def get_mime_type(file_path: str) -> str:
    """Intenta determinar el tipo MIME de un archivo"""
    extension = get_file_extension(file_path)
    mime_types = {
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.insv': 'video/mp4',  # Insta360 usa contenedores MP4
        '.mts': 'video/mp2t',
        '.m2ts': 'video/mp2t'
    }
    return mime_types.get(extension, 'application/octet-stream')

def get_normalized_path(base_path: str, rel_path: str) -> str:
    """Normaliza una ruta relativa combinándola con la base y validando que no salga del directorio base"""
    # Convertir posibles barras invertidas a normales
    rel_path = rel_path.replace('\\', '/')
    
    # Eliminar cualquier intento de subir en la jerarquía de directorios
    while '/../' in rel_path or rel_path.startswith('../'):
        rel_path = rel_path.replace('/../', '/').replace('../', '')
    
    # Construir ruta absoluta
    full_path = os.path.normpath(os.path.join(base_path, rel_path))
    
    # Validar que la ruta resultante esté dentro del directorio base
    if not full_path.startswith(base_path):
        raise ValueError(f"Intento de acceso fuera del directorio base: {full_path}")
    
    return full_path

@router.get("/list")
async def list_directory(path: str, filter_video: bool = False):
    """Lista el contenido de un directorio"""
    try:
        # Verificar primero si es una ruta predefinida
        if path == "videos":
            # Directorio de videos interno
            base_dir = os.path.join(disk_manager.data_path, "videos")
        elif path == "external":
            # Directorio montado externo
            if not disk_manager or not disk_manager.settings:
                raise HTTPException(status_code=500, detail="El administrador de disco no está inicializado")
            
            mount_point = disk_manager.settings.get("mountPoint")
            if not mount_point or not os.path.isdir(mount_point):
                raise HTTPException(status_code=404, detail="No hay disco externo montado")
            
            base_dir = mount_point
        else:
            # Verificar si se está intentando navegar en un subdirectorio
            if path.startswith("videos/"):
                # Subdirectorio dentro de videos interno
                base_dir = os.path.join(disk_manager.data_path, path)
            elif path.startswith("external/"):
                # Subdirectorio dentro del disco externo
                if not disk_manager or not disk_manager.settings:
                    raise HTTPException(status_code=500, detail="El administrador de disco no está inicializado")
                
                mount_point = disk_manager.settings.get("mountPoint")
                if not mount_point or not os.path.isdir(mount_point):
                    raise HTTPException(status_code=404, detail="No hay disco externo montado")
                
                # Extraer la parte relativa
                rel_path = path.replace("external/", "", 1)
                base_dir = os.path.join(mount_point, rel_path)
            else:
                # Ruta absoluta (para compatibilidad)
                base_dir = path
                
                # Validar que no se esté accediendo a rutas sensibles
                sensitive_paths = ["/etc", "/root", "/home", "/var/log", "/boot"]
                if any(base_dir.startswith(sp) for sp in sensitive_paths):
                    raise HTTPException(status_code=403, detail="Acceso a directorios sensibles del sistema no permitido")
        
        # Verificar que el directorio existe
        if not os.path.exists(base_dir) or not os.path.isdir(base_dir):
            logger.warning(f"Directorio no encontrado o no es un directorio: {base_dir}")
            # En lugar de lanzar una excepción, devolvemos un directorio vacío
            return {
                "current_directory": {
                    "path": base_dir,
                    "name": os.path.basename(base_dir) or base_dir,
                    "parent_path": os.path.dirname(base_dir) if base_dir != "/" else None
                },
                "entries": [],
                "items": [],  # Formato antiguo
                "current_path": base_dir  # Formato antiguo
            }
        
        # Listar contenido
        entries = []
        try:
            with os.scandir(base_dir) as it:
                try:
                    sorted_entries = sorted(it, key=lambda e: (not e.is_dir(), e.name))
                except Exception as sort_err:
                    logger.error(f"Error al ordenar entradas del directorio {base_dir}: {sort_err}")
                    # Intentar listar sin ordenar
                    it.seekable() and it.seek(0)
                    sorted_entries = list(it)
                
                for entry in sorted_entries:
                    try:
                        # Si se solicita solo videos y el elemento actual no es un directorio ni un video, continuar
                        if filter_video and not entry.is_dir() and not is_video_file(entry.name):
                            continue
                        
                        # Obtener información del archivo
                        entry_info = get_file_info(entry.path)
                        entries.append(entry_info)
                    except Exception as e:
                        logger.warning(f"Error procesando entrada {entry.path}: {e}")
                        # Incluir entrada con error para depuración
                        entries.append({
                            "name": entry.name,
                            "path": entry.path,
                            "error": str(e)
                        })
        except Exception as dir_error:
            logger.error(f"Error al escanear directorio {base_dir}: {dir_error}")
            # Agregar una entrada de error
            entries.append({
                "name": "Error",
                "path": base_dir,
                "error": f"Error al acceder al directorio: {str(dir_error)}"
            })
        
        # Incluir información sobre el directorio actual
        current_dir_info = {
            "path": base_dir,
            "name": os.path.basename(base_dir) or base_dir,
            "parent_path": os.path.dirname(base_dir) if base_dir != "/" else None
        }
        
        # Para compatibilidad con ambos formatos (antiguo y nuevo)
        response_data = {
            "current_directory": current_dir_info,
            "entries": entries,
            "items": entries,  # Formato antiguo
            "current_path": base_dir  # Formato antiguo
        }
        
        return response_data
    except ValueError as ve:
        logger.error(f"Valor inválido al listar directorio {path}: {ve}")
        # Devolver una respuesta con error en lugar de lanzar una excepción
        return {
            "current_directory": {
                "path": path,
                "name": os.path.basename(path) or path,
                "parent_path": os.path.dirname(path) if path != "/" else None
            },
            "entries": [{
                "name": "Error",
                "path": path,
                "error": f"Valor inválido: {str(ve)}"
            }],
            "items": [{
                "name": "Error",
                "path": path,
                "error": f"Valor inválido: {str(ve)}"
            }],  # Formato antiguo
            "current_path": path  # Formato antiguo
        }
    except Exception as e:
        logger.error(f"Error al listar directorio {path}: {e}")
        # Devolver una respuesta con error en lugar de lanzar una excepción
        return {
            "current_directory": {
                "path": path,
                "name": os.path.basename(path) or path,
                "parent_path": os.path.dirname(path) if path != "/" else None
            },
            "entries": [{
                "name": "Error",
                "path": path,
                "error": f"Error al listar directorio: {str(e)}"
            }],
            "items": [{
                "name": "Error",
                "path": path,
                "error": f"Error al listar directorio: {str(e)}"
            }],  # Formato antiguo
            "current_path": path  # Formato antiguo
        }

@router.post("/move")
async def move_file(request: FileMoveRequest):
    """Mueve un archivo o directorio a una nueva ubicación"""
    try:
        source_path = request.source_path
        target_path = request.target_path
        
        # Validar rutas
        if not os.path.exists(source_path):
            raise HTTPException(status_code=404, detail=f"Archivo de origen no encontrado: {source_path}")
        
        # Crear directorio de destino si no existe
        target_dir = os.path.dirname(target_path)
        os.makedirs(target_dir, exist_ok=True)
        
        # Mover el archivo
        shutil.move(source_path, target_path)
        
        return {"success": True, "message": f"Archivo movido exitosamente de {source_path} a {target_path}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moviendo archivo: {e}")
        raise HTTPException(status_code=500, detail=f"Error moviendo archivo: {str(e)}")

@router.post("/delete")
async def delete_file(request: DeleteRequest):
    """Elimina un archivo o directorio"""
    try:
        path = request.path
        is_directory = request.is_directory
        
        # Validar que el elemento existe
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"Ruta no encontrada: {path}")
        
        # Verificar que sea el tipo correcto (archivo o directorio)
        actual_is_dir = os.path.isdir(path)
        if is_directory != actual_is_dir:
            type_name = "directorio" if actual_is_dir else "archivo"
            raise HTTPException(status_code=400, 
                               detail=f"Tipo de elemento incorrecto. La ruta especificada es un {type_name}")
        
        # Eliminar según el tipo
        if is_directory:
            shutil.rmtree(path)
        else:
            os.remove(path)
        
        return {"success": True, "message": f"Elemento eliminado exitosamente: {path}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error eliminando elemento: {e}")
        raise HTTPException(status_code=500, detail=f"Error eliminando elemento: {str(e)}")

@router.post("/index-video")
async def index_external_video(request: IndexFileRequest):
    """
    Indexa un video externo en la base de datos para que aparezca en el calendario
    sin necesidad de copiarlo a la carpeta interna.
    """
    try:
        file_path = request.file_path
        
        # Validar que el archivo existe y es un video
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {file_path}")
        
        if not is_video_file(file_path):
            raise HTTPException(status_code=400, detail=f"El archivo no es un video: {file_path}")
        
        # Obtener tamaño del archivo
        file_size = os.path.getsize(file_path)
        
        # Obtener fecha del video (usar la proporcionada o la fecha de modificación)
        if request.file_date:
            file_date = request.file_date
        else:
            # Usar la fecha de modificación del archivo
            mtime = os.path.getmtime(file_path)
            file_date = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')
        
        # Indexar en la base de datos
        import sqlite3
        conn = sqlite3.connect(disk_manager.db_path)
        cursor = conn.cursor()
        
        # Comprobar si la tabla recordings existe
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='recordings'
        """)
        
        if not cursor.fetchone():
            # Crear la tabla si no existe
            cursor.execute("""
                CREATE TABLE recordings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT,
                    file_size INTEGER,
                    start_time TEXT,
                    end_time TEXT,
                    latitude REAL,
                    longitude REAL,
                    distance_km REAL,
                    source TEXT,
                    tags TEXT,
                    backed_up INTEGER,
                    backup_path TEXT
                )
            """)
            conn.commit()
        
        # Insertar el registro
        cursor.execute("""
            INSERT INTO recordings 
            (file_path, file_size, start_time, end_time, latitude, longitude, source, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_path,
            file_size,
            f"{file_date} 00:00:00",  # Usar medianoche como hora de inicio
            f"{file_date} 23:59:59",  # Usar final del día como hora de fin
            request.latitude,
            request.longitude,
            request.source or "external",
            request.tags
        ))
        
        video_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Generar miniatura (en segundo plano)
        try:
            thumbnails_dir = os.path.join(disk_manager.data_path, "thumbnails", "external")
            os.makedirs(thumbnails_dir, exist_ok=True)
            
            thumbnail_name = f"external_{video_id}.jpg"
            thumbnail_path = os.path.join(thumbnails_dir, thumbnail_name)
            
            # Usar ffmpeg para generar la miniatura
            subprocess.run([
                "ffmpeg", "-i", file_path, 
                "-ss", "00:00:05", "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y", thumbnail_path
            ], capture_output=True, timeout=30)
        except Exception as thumb_err:
            logger.warning(f"Error generando miniatura para {file_path}: {thumb_err}")
        
        return {
            "success": True,
            "message": f"Video indexado exitosamente",
            "video_id": video_id,
            "file_path": file_path,
            "file_date": file_date
        }
    except sqlite3.Error as sql_err:
        logger.error(f"Error de base de datos: {sql_err}")
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(sql_err)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error indexando video externo: {e}")
        raise HTTPException(status_code=500, detail=f"Error indexando video: {str(e)}")

@router.get("/disk-status")
async def get_disk_status():
    """Obtiene el estado de los discos internos y externos"""
    try:
        if not disk_manager:
            logger.warning("El administrador de disco no está inicializado, devolviendo datos predeterminados")
            # Devolver estructura predeterminada en lugar de lanzar excepción
            # Intentar obtener información de uso del disco incluso sin disk_manager
            try:
                data_path = "/mnt/dashcam_storage"
                disk_usage = shutil.disk_usage(data_path)
                return {
                    "internal": {
                        "mountPoint": "/mnt/dashcam_storage",
                        "mounted": True,  # El sistema está funcionando, así que el disco está montado
                        "total": disk_usage.total,
                        "used": disk_usage.used,
                        "free": disk_usage.free,
                        "percent": int(disk_usage.used * 100 / max(disk_usage.total, 1))
                    },
                    "external": []
                }
            except Exception:
                # Si falló obteniendo información de uso, usar valores predeterminados conservadores
                return {
                    "internal": {
                        "mountPoint": "/mnt/dashcam_storage",
                        "mounted": True,  # El sistema está funcionando, así que el disco está montado
                        "total": 100 * 1024 * 1024 * 1024,  # 100 GB como valor predeterminado
                        "used": 10 * 1024 * 1024 * 1024,    # 10 GB usado
                        "free": 90 * 1024 * 1024 * 1024     # 90 GB libre
                    },
                    "external": []
                }
        
        # Obtener información del disco interno
        try:
            # Primero obtenemos información del disco interno usando get_disk_info
            internal_disk = disk_manager.get_disk_info() or {}
            
            # Como sabemos que el disco interno está siempre montado (es el disco del sistema),
            # forzamos mounted=True si estamos usando el punto de montaje por defecto
            # del sistema, aunque os.path.ismount() pueda fallar en detectarlo
            data_path = disk_manager.data_path
            default_mount = "/mnt/dashcam_storage"
            
            # Si el sistema está funcionando, significa que el disco interno está montado
            if os.path.exists(data_path) and os.path.isdir(data_path):
                internal_disk["mounted"] = True
                
                # Obtener información real de uso del disco usando shutil.disk_usage
                try:
                    # Usar la ruta de datos para obtener información de uso del disco
                    disk_usage = shutil.disk_usage(data_path)
                    internal_disk["total"] = disk_usage.total
                    internal_disk["used"] = disk_usage.used
                    internal_disk["free"] = disk_usage.free
                    internal_disk["percent"] = int(disk_usage.used * 100 / max(disk_usage.total, 1))
                except Exception as disk_err:
                    logger.error(f"Error obteniendo información de uso del disco: {disk_err}")
                
            # Asegurar que internal_disk tenga todos los campos necesarios
            if "mountPoint" not in internal_disk:
                internal_disk["mountPoint"] = default_mount
        except Exception as e:
            logger.error(f"Error obteniendo información del disco interno: {e}")
            internal_disk = {
                "mountPoint": "/mnt/dashcam_storage",
                "mounted": True,  # El sistema está funcionando, así que el disco está montado
                "total": 0,
                "used": 0,
                "free": 0
            }
        
        # Detectar discos USB
        try:
            usb_drives = disk_manager.detect_usb_drives() or []
            
            # Asegurar que cada disco USB tenga todos los campos necesarios
            for drive in usb_drives:
                # Asegurar que siempre existe un device
                if "device" not in drive or not drive["device"]:
                    drive["device"] = drive.get("name", "usb")
                
                # Establecer valores por defecto para los campos importantes si no existen
                if not drive.get("mounted", False):
                    # Si no está montado, establecer valores por defecto
                    drive["total"] = 0
                    drive["used"] = 0
                    drive["free"] = 0
                else:
                    # Si está montado pero no tiene información de uso
                    if "total" not in drive or not drive["total"]:
                        try:
                            # Intentar obtener información del punto de montaje
                            if drive.get("mountpoint"):
                                disk_usage = shutil.disk_usage(drive["mountpoint"])
                                drive["total"] = disk_usage.total
                                drive["used"] = disk_usage.used
                                drive["free"] = disk_usage.free
                        except Exception as usage_err:
                            logger.warning(f"No se pudo obtener uso del disco para {drive.get('device', 'desconocido')}: {usage_err}")
                            # Establecer valores por defecto
                            drive["total"] = 0
                            drive["used"] = 0
                            drive["free"] = 0
                
                # Asegurar que existe un modelo o etiqueta
                if "model" not in drive or not drive["model"]:
                    drive["model"] = "Disco Externo"
                
                # Eliminar caracteres no deseados del modelo (espacios al final, etc)
                if "model" in drive and isinstance(drive["model"], str):
                    drive["model"] = drive["model"].strip()
        except Exception as e:
            logger.error(f"Error detectando discos USB: {e}")
            usb_drives = []
        
        return {
            "internal": internal_disk,
            "external": usb_drives
        }
    except Exception as e:
        logger.error(f"Error obteniendo estado de discos: {e}")
        # Devolver estructura predeterminada en lugar de lanzar excepción
        # Intentar obtener información de uso del disco incluso en caso de error
        try:
            data_path = "/mnt/dashcam_storage"
            if disk_manager:
                data_path = disk_manager.data_path
                
            disk_usage = shutil.disk_usage(data_path)
            return {
                "internal": {
                    "mountPoint": "/mnt/dashcam_storage",
                    "mounted": True,  # El sistema está funcionando, así que el disco está montado
                    "total": disk_usage.total,
                    "used": disk_usage.used,
                    "free": disk_usage.free,
                    "percent": int(disk_usage.used * 100 / max(disk_usage.total, 1))
                },
                "external": []
            }
        except Exception:
            # Si falló obteniendo información de uso, usar valores predeterminados conservadores
            return {
                "internal": {
                    "mountPoint": "/mnt/dashcam_storage",
                    "mounted": True,  # El sistema está funcionando, así que el disco está montado
                    "total": 100 * 1024 * 1024 * 1024,  # 100 GB como valor predeterminado
                    "used": 10 * 1024 * 1024 * 1024,    # 10 GB usado
                    "free": 90 * 1024 * 1024 * 1024     # 90 GB libre
                },
                "external": []
            } 
