import os
import shutil
import logging
import time
import threading
import json
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable

# Add backend directory to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import Trip Manager and VideoRepository from the new system
from trip_logger_package.services.trip_manager import TripManager
from trip_logger_package.database.repository import VideoRepository
from trip_logger_package.database.connection import get_database_manager

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('hdd_copy_module')

class HDDCopyModule:
    """Módulo para copiar videos de dashcam a un disco duro externo"""
    
    def __init__(self, disk_manager, camera_manager, audio_notifier):
        """
        Inicializar el módulo de copia con las dependencias necesarias.
        
        Args:
            disk_manager: Instancia de DiskManager para operaciones de disco
            camera_manager: Instancia de CameraManager para control de grabación
            audio_notifier: Instancia de AudioNotifier para notificaciones por audio
        """
        self.disk_manager = disk_manager
        self.camera_manager = camera_manager
        self.audio_notifier = audio_notifier
        
        # Initialize Trip Manager for database operations
        self.trip_manager = TripManager(disk_manager.db_path if disk_manager else None)
        self.db_manager = get_database_manager(disk_manager.db_path if disk_manager else None)
        
        # Estado interno
        self.is_copying = False
        self.copy_thread = None
        self.copy_progress = 0  # 0-100
        self.copy_status = "idle"  # idle, copying, completed, error
        self.current_file = ""
        self.copy_stats = {
            "total_files": 0,
            "copied_files": 0,
            "total_size": 0,
            "copied_size": 0,
            "start_time": None,
            "end_time": None,
            "error": None
        }
        self.cancel_copy = False
        
        # LEDs controller
        self.led_controller = None
        try:
            from routes.mic_leds import LEDController
            self.led_controller = LEDController.get_instance()
            
            # Verificar si está inicializado y si no, inicializarlo
            if self.led_controller and not getattr(self.led_controller, 'initialized', False):
                logger.info("LEDController no estaba inicializado, inicializando...")
                try:
                    self.led_controller.initialize()
                    logger.info("LEDController inicializado correctamente")
                except Exception as init_error:
                    logger.error(f"Error inicializando LEDController: {str(init_error)}")
                    self.led_controller = None
            elif self.led_controller and getattr(self.led_controller, 'initialized', False):
                logger.info("LEDController ya estaba inicializado")
            else:
                logger.warning("No se pudo obtener la instancia del LEDController")
                
        except (ImportError, AttributeError) as e:
            logger.warning(f"No se pudo importar el controlador de LEDs: {str(e)}")
            self.led_controller = None
            
        # Callbacks
        self.progress_callback = None
    
    def start_copy_to_hdd(self, destination: Optional[str] = None) -> Dict[str, Any]:
        """
        Inicia el proceso de copia de videos a un disco duro externo.
        
        Args:
            destination: Ruta de destino opcional (si es None, se detecta automáticamente)
            
        Returns:
            Dict con el estado de la operación
        """
        if self.is_copying:
            return {
                "success": False,
                "message": "Ya hay una operación de copia en progreso"
            }
            
        # Detectar discos USB
        usb_drives = self.disk_manager.detect_usb_drives()
        logger.info(f"Discos USB detectados: {usb_drives}")
        if not usb_drives:
            return {
                "success": False,
                "message": "No se detectaron discos USB"
            }
        
        # Si no se especificó destino, buscar el primer disco USB con espacio
        if not destination:
            logger.info("Buscando disco USB válido para la copia...")
            for drive in usb_drives:
                logger.info(f"Evaluando disco: {drive}")
                # Primero verificar si el disco ya está montado
                if drive["mounted"]:
                    # Si el disco está montado, usar su punto de montaje
                    if drive.get("mountpoint"):
                        destination = drive["mountpoint"]
                        logger.info(f"Usando punto de montaje del disco: {destination}")
                        break
                
                # Verificar particiones montadas
                for partition in drive.get("partitions", []):
                    logger.info(f"Evaluando partición: {partition}")
                    if partition["mounted"] and partition.get("mountpoint"):
                        destination = partition["mountpoint"]
                        logger.info(f"Usando punto de montaje de la partición: {destination}")
                        break
                
                if destination:
                    break
                
                # Si no está montado, intentar montarlo
                if not drive["mounted"]:
                    if self._mount_drive(drive):
                        # Después de montar, verificar nuevamente
                        for partition in drive.get("partitions", []):
                            if partition["mounted"]:
                                details = self.disk_manager.get_disk_details(partition["name"])
                                if details.get("mounted") and details.get("mountpoint"):
                                    destination = details["mountpoint"]
                                    break
                
                if destination:
                    break
            
            if not destination:
                logger.error("No se encontró un disco USB válido para la copia")
                return {
                    "success": False,
                    "message": "No se encontró un disco USB válido para la copia"
                }
        
        # Iniciar copia en un hilo separado
        logger.info(f"Iniciando copia hacia destino: {destination}")
        self.copy_thread = threading.Thread(
            target=self._copy_thread,
            args=(destination,),
            daemon=True
        )
        self.copy_thread.start()
        
        return {
            "success": True,
            "message": "Iniciando copia de videos al disco externo"
        }
    
    def _mount_drive(self, drive: Dict[str, Any]) -> bool:
        """
        Intenta montar una unidad USB
        
        Args:
            drive: Información de la unidad a montar
            
        Returns:
            bool: True si se montó correctamente, False en caso contrario
        """
        try:
            # Si no tiene particiones, montar la unidad completa
            if not drive.get("partitions"):
                return self.disk_manager.mount_drive(drive["name"])
            
            # Si tiene particiones, montar la primera
            for partition in drive["partitions"]:
                if not partition["mounted"]:
                    return self.disk_manager.mount_drive(partition["name"])
            
            # Si todas las particiones están montadas, retornar True
            return True
        except Exception as e:
            logger.error(f"Error montando unidad: {str(e)}")
            return False
    
    def _copy_thread(self, destination: str):
        """
        Función principal del hilo de copia
        
        Args:
            destination: Ruta de destino para la copia
        """
        was_recording = False  # Inicializar fuera del try
        
        try:
            # Marcar inicio
            self.is_copying = True
            self.copy_status = "preparing"
            self.copy_progress = 0
            self.copy_stats = {
                "total_files": 0,
                "copied_files": 0,
                "total_size": 0,
                "copied_size": 0,
                "start_time": datetime.now().isoformat(),
                "end_time": None,
                "error": None
            }
            self.cancel_copy = False
            self._update_progress()
            
            # Notificar por audio
            self.audio_notifier.announce("Iniciando copia de videos al disco externo. Se detendrá la grabación temporalmente.")
            
            # Detener grabación y trip correctamente
            was_recording = self.camera_manager.recorder.recording if self.camera_manager.recorder else False
            if was_recording:
                logger.info("Deteniendo grabación para realizar copia")
                
                # Primero finalizar el trip actual y detener la grabación
                # Esto es similar a como se hace en la ruta /stop
                if hasattr(self.camera_manager, 'trip_logger') and self.camera_manager.trip_logger:
                    logger.info("Finalizando trip actual antes de la copia")
                    trip_id = self.camera_manager.trip_logger.end_trip()
                    logger.info(f"Trip finalizado con ID: {trip_id}")
                
                # Detener la grabación (esto también guardará el último clip)
                completed_clips = self.camera_manager.stop_recording()
                logger.info(f"Grabación detenida, clips completados: {len(completed_clips) if completed_clips else 0}")
                
                # Esperar más tiempo para que se procesen todos los clips
                logger.info("Esperando a que se procesen todos los clips...")
                self.audio_notifier.announce("Procesando clips finales antes de la copia.")
                
                # Esperar hasta 30 segundos para que se procesen los clips
                max_wait_time = 30
                wait_interval = 1
                waited_time = 0
                
                while waited_time < max_wait_time:
                    # Verificar si hay clips pendientes de procesar
                    if hasattr(self.camera_manager, 'recorder') and self.camera_manager.recorder:
                        if hasattr(self.camera_manager.recorder, 'recording_thread') and self.camera_manager.recorder.recording_thread:
                            if self.camera_manager.recorder.recording_thread.is_alive():
                                logger.debug(f"Esperando que termine el hilo de grabación... ({waited_time}s)")
                                time.sleep(wait_interval)
                                waited_time += wait_interval
                                continue
                    
                    # Verificar si trip_logger está procesando clips
                    if hasattr(self.camera_manager, 'trip_logger') and self.camera_manager.trip_logger:
                        if hasattr(self.camera_manager.trip_logger, 'processing_clips') and self.camera_manager.trip_logger.processing_clips:
                            logger.debug(f"Esperando que se procesen los clips... ({waited_time}s)")
                            time.sleep(wait_interval)
                            waited_time += wait_interval
                            continue
                    
                    # Si no hay hilos activos, salir del bucle
                    break
                    
                logger.info(f"Clips procesados después de {waited_time} segundos")
                
                # Tiempo adicional de seguridad para asegurar que la base de datos se actualice
                time.sleep(3)
            
            # Crear directorio en el destino si no existe
            backup_folder = os.path.join(
                destination, 
                f"dashcam_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            )
            os.makedirs(backup_folder, exist_ok=True)
            
            # Get videos list from database using VideoRepository
            with self.db_manager.session_scope() as session:
                video_repo = VideoRepository(session)
                
                # Get all video clips and external videos
                video_clips = video_repo.get_all_video_clips()
                external_videos = video_repo.get_all_external_videos()
                
                all_videos = list(video_clips) + list(external_videos)
                
                if not all_videos:
                    self._finish_copy(False, "No hay videos en la base de datos")
                    return
                
                # Filter videos that have not been backed up
                videos = []
                for video in all_videos:
                    if not getattr(video, 'backed_up', False):
                        videos.append((
                            video.id,
                            video.file_path,
                            video.file_size or 0
                        ))
                
                # Sort by start_time if available
                videos_with_time = []
                for video_tuple in videos:
                    video_id = video_tuple[0]
                    # Find the full video data to get start_time
                    full_video = next((v for v in all_videos if v.id == video_id), None)
                    start_time = full_video.start_time if full_video else None
                    videos_with_time.append((video_tuple, start_time))
                
                # Sort by start_time, videos without time go to the end
                videos_with_time.sort(key=lambda x: x[1] if x[1] else datetime.max)
                videos = [item[0] for item in videos_with_time]
            
            logger.info(f"Videos encontrados para copia: {len(videos)}")
            for i, (video_id, file_path, file_size) in enumerate(videos):
                logger.info(f"Video {i+1}: ID={video_id}, Path={file_path}, Size={file_size}")
            
            if not videos:
                self._finish_copy(True, "No hay videos nuevos para copiar")
                
                # Reiniciar grabación si estaba activa
                if was_recording:
                    self.camera_manager.start_recording()
                return
            
            # Update status
            self.copy_status = "copying"
            self.copy_stats["total_files"] = len(videos)
            self.copy_stats["total_size"] = sum(video[2] for video in videos if video[2])
            self._update_progress()
            
            # Notificar por audio
            self.audio_notifier.announce(f"Copiando {len(videos)} videos al disco externo.")
            
            # Setup LED indicators
            self._set_led_progress(0)
            
            # Start copying
            for i, (video_id, file_path, file_size) in enumerate(videos):
                if self.cancel_copy:
                    self._finish_copy(False, "Copia cancelada por el usuario")
                    break
                
                # Actualizar estado
                self.current_file = file_path
                
                try:
                    # Log de debug para este archivo
                    logger.info(f"Procesando archivo {i+1}/{len(videos)}: {file_path}")
                    
                    # Normalizar la ruta para manejar casos como ../data/videos/
                    if os.path.isabs(file_path):
                        # Normalizar ruta absoluta para eliminar ../ innecesarios
                        source_path = os.path.normpath(file_path)
                        logger.debug(f"Ruta absoluta normalizada: {source_path}")
                    else:
                        # Para rutas relativas, construir desde data_path
                        source_path = os.path.normpath(os.path.join(self.disk_manager.data_path, file_path))
                        logger.debug(f"Ruta relativa construida y normalizada: {source_path}")
                    
                    # Verificación adicional: si la ruta normalizada sigue siendo problemática,
                    # manejar diferentes tipos de duplicación
                    if '/videos/../data/videos/' in source_path:
                        # Extraer la parte después del último /videos/
                        video_part = source_path.split('/videos/')[-1]
                        source_path = os.path.join('/root/dashcam-v2/data/videos', video_part)
                        logger.debug(f"Ruta corregida para duplicación de videos: {source_path}")
                    elif '/data/data/videos/' in source_path:
                        # Manejar duplicación de /data/data/
                        video_part = source_path.split('/data/data/videos/')[-1]
                        source_path = os.path.join('/root/dashcam-v2/data/videos', video_part)
                        logger.debug(f"Ruta corregida para duplicación de data: {source_path}")
                    elif source_path.count('/data/') > 1:
                        # Manejar cualquier otra duplicación de /data/
                        # Encontrar la última ocurrencia de /data/videos/
                        if '/data/videos/' in source_path:
                            parts = source_path.split('/data/videos/')
                            if len(parts) > 1:
                                video_part = parts[-1]
                                source_path = os.path.join('/root/dashcam-v2/data/videos', video_part)
                                logger.debug(f"Ruta corregida para múltiple duplicación de data: {source_path}")
                    
                    logger.debug(f"Verificando existencia de archivo: {source_path}")
                    if os.path.exists(source_path):
                        logger.info(f"Archivo existe, iniciando copia: {source_path}")
                        
                        # Crear subdirectorios si es necesario
                        # Extraer la ruta relativa basada en el nombre del archivo
                        if os.path.isabs(file_path):
                            # Si es ruta absoluta, extraer solo la parte relativa a partir de 'videos'
                            rel_path = file_path.split('/videos/')[-1] if '/videos/' in file_path else os.path.basename(file_path)
                            rel_path = os.path.dirname(rel_path)
                        else:
                            rel_path = os.path.dirname(file_path)
                        
                        dest_dir = os.path.join(backup_folder, rel_path)
                        os.makedirs(dest_dir, exist_ok=True)
                        logger.debug(f"Directorio de destino creado: {dest_dir}")
                        
                        # Copiar archivo - usar solo el nombre del archivo para el destino
                        filename = os.path.basename(file_path)
                        dest_path = os.path.join(dest_dir, filename)
                        logger.info(f"Copiando desde {source_path} hacia {dest_path}")
                        shutil.copy2(source_path, dest_path)
                        logger.info(f"Archivo copiado exitosamente: {filename}")
                        
                        # Actualizar estado
                        self.copy_stats["copied_files"] += 1
                        self.copy_stats["copied_size"] += file_size if file_size else 0
                        
                        # Actualizar base de datos usando VideoRepository
                        with self.db_manager.session_scope() as update_session:
                            update_video_repo = VideoRepository(update_session)
                            
                            # Find the video to update
                            video_to_update = None
                            video_clips = update_video_repo.get_all_video_clips()
                            external_videos = update_video_repo.get_all_external_videos()
                            
                            for video in list(video_clips) + list(external_videos):
                                if video.id == video_id:
                                    video_to_update = video
                                    break
                            
                            if video_to_update:
                                # Update the backup information
                                video_to_update.backed_up = True
                                video_to_update.backup_path = dest_path
                                update_session.commit()
                                logger.debug(f"Base de datos actualizada para archivo ID {video_id}")
                            else:
                                logger.warning(f"No se encontró el video con ID {video_id} para actualizar")
                    else:
                        logger.warning(f"Archivo no encontrado: {source_path}")
                        # Continuar con el siguiente archivo en lugar de fallar
                        
                    # Calcular y actualizar progreso
                    progress = min(int((i + 1) * 100 / len(videos)), 100)
                    self.copy_progress = progress
                    self._update_progress()
                    
                    # Actualizar LEDs
                    self._set_led_progress(progress)
                    
                    # Notificación de audio cada 25%
                    if progress == 25:
                        self.audio_notifier.announce("25 por ciento completado")
                    elif progress == 50:
                        self.audio_notifier.announce("50 por ciento completado")
                    elif progress == 75:
                        self.audio_notifier.announce("75 por ciento completado")
                except Exception as e:
                    logger.error(f"Error copiando archivo {file_path}: {str(e)}")
                    # Continuamos con el siguiente archivo
            
            # Finalizar
            logger.info("Proceso de copia finalizado exitosamente")
            
            # Notificar completado
            if not self.cancel_copy:
                self._finish_copy(True, f"Copia completada: {self.copy_stats['copied_files']} archivos copiados")
        
        except Exception as e:
            logger.error(f"Error en proceso de copia: {str(e)}")
            self._finish_copy(False, f"Error en proceso de copia: {str(e)}")
        
        finally:
            # Reiniciar grabación si estaba activa
            if was_recording:
                self.camera_manager.start_recording()
    
    def _finish_copy(self, success: bool, message: str):
        """
        Finalizar proceso de copia y actualizar estado
        
        Args:
            success: Si la copia fue exitosa
            message: Mensaje descriptivo
        """
        # Actualizar estado
        self.copy_status = "completed" if success else "error"
        self.copy_stats["end_time"] = datetime.now().isoformat()
        self.copy_stats["error"] = None if success else message
        self.is_copying = False
        
        # Notificación de audio
        if success:
            self.audio_notifier.announce(f"Copia completada. Se copiaron {self.copy_stats['copied_files']} videos.")
            # Todos los LEDs en verde
            self._set_all_leds("green")
        else:
            self.audio_notifier.announce(f"Error en la copia. {message}")
            # Todos los LEDs en rojo
            self._set_all_leds("red")
        
        logger.info(f"Proceso de copia finalizado: {message}")
        self._update_progress()
        
        # Mantener los LEDs por 5 segundos y luego apagarlos
        time.sleep(5)
        self._set_all_leds("black")
    
    def _update_progress(self):
        """Actualizar el progreso y notificar mediante callback si existe"""
        if self.progress_callback and callable(self.progress_callback):
            try:
                self.progress_callback({
                    "status": self.copy_status,
                    "progress": self.copy_progress,
                    "current_file": self.current_file,
                    "stats": self.copy_stats
                })
            except Exception as e:
                logger.error(f"Error en callback de progreso: {str(e)}")
    
    def _set_led_progress(self, progress: int):
        """
        Configurar LEDs para mostrar progreso
        
        Args:
            progress: Porcentaje de progreso (0-100)
        """
        if not self.led_controller:
            logger.debug("LEDController no disponible")
            return
            
        if not getattr(self.led_controller, 'initialized', False):
            logger.debug("LEDController no está inicializado")
            return
            
        try:
            logger.debug(f"Configurando LEDs para progreso: {progress}%")
            
            # Mapeo de colores a valores RGB
            colors = {
                "black": (0, 0, 0),
                "blue": (0, 0, 255),
                "green": (0, 255, 0),
                "red": (255, 0, 0)
            }
            
            # Determinar cuántos LEDs encender basado en el progreso
            num_leds_on = 0
            if progress >= 33:
                num_leds_on = 1
            if progress >= 66:
                num_leds_on = 2
            if progress >= 99:
                num_leds_on = 3
            
            logger.debug(f"Encendiendo {num_leds_on} LEDs")
            
            # Verificar si el método existe antes de llamarlo
            if hasattr(self.led_controller, 'set_color'):
                # Configurar cada LED individualmente
                for i in range(3):
                    if i < num_leds_on:
                        success = self.led_controller.set_color(colors["blue"], i)
                        logger.debug(f"LED {i} configurado en azul: {success}")
                    else:
                        success = self.led_controller.set_color(colors["black"], i)
                        logger.debug(f"LED {i} apagado: {success}")
            else:
                logger.warning("LEDController no tiene el método set_color")
                
        except Exception as e:
            logger.error(f"Error configurando LEDs para progreso: {str(e)}")
    
    def _set_all_leds(self, color: str):
        """
        Configurar todos los LEDs con un color
        
        Args:
            color: Color a configurar
        """
        if not self.led_controller:
            logger.debug("LEDController no disponible")
            return
            
        if not getattr(self.led_controller, 'initialized', False):
            logger.debug("LEDController no está inicializado")
            return
            
        try:
            logger.debug(f"Configurando todos los LEDs en color: {color}")
            
            # Mapeo de colores a valores RGB
            colors = {
                "black": (0, 0, 0),
                "blue": (0, 0, 255),
                "green": (0, 255, 0),
                "red": (255, 0, 0)
            }
            
            # Verificar si el método existe antes de llamarlo
            if hasattr(self.led_controller, 'set_color'):
                rgb_color = colors.get(color, (0, 0, 0))
                for i in range(3):
                    success = self.led_controller.set_color(rgb_color, i)
                    logger.debug(f"LED {i} configurado en {color}: {success}")
            else:
                logger.warning("LEDController no tiene el método set_color")
                
        except Exception as e:
            logger.error(f"Error configurando todos los LEDs: {str(e)}")
    
    def cancel_copy_operation(self) -> Dict[str, Any]:
        """
        Cancelar la operación de copia en progreso
        
        Returns:
            Dict con el estado de la operación
        """
        if not self.is_copying:
            return {
                "success": False,
                "message": "No hay una operación de copia en progreso"
            }
            
        self.cancel_copy = True
        return {
            "success": True,
            "message": "Se ha enviado la señal de cancelación"
        }
    
    def get_copy_status(self) -> Dict[str, Any]:
        """
        Obtener el estado actual de la operación de copia
        
        Returns:
            Dict con el estado completo
        """
        return {
            "is_copying": self.is_copying,
            "status": self.copy_status,
            "progress": self.copy_progress,
            "current_file": self.current_file,
            "stats": self.copy_stats
        }
    
    def set_progress_callback(self, callback: Callable):
        """
        Configurar un callback para notificar sobre el progreso
        
        Args:
            callback: Función a llamar con las actualizaciones
        """
        self.progress_callback = callback
    
    def safely_eject_after_copy(self, device_path: str) -> Dict[str, Any]:
        """
        Expulsar de forma segura un disco después de la copia
        
        Args:
            device_path: Ruta del dispositivo a expulsar
            
        Returns:
            Dict con el estado de la operación
        """
        if self.is_copying:
            return {
                "success": False, 
                "message": "No se puede expulsar mientras hay una copia en progreso"
            }
            
        # Notificar por audio
        self.audio_notifier.announce("Expulsando disco de forma segura")
        
        # Expulsar disco
        result = self.disk_manager.safely_eject_drive(device_path)
        
        if result["success"]:
            self.audio_notifier.announce("Disco expulsado correctamente. Ya puede desconectar el disco.")
        else:
            self.audio_notifier.announce(f"Error al expulsar el disco. {result.get('message', '')}")
            
        return result
        
    def cleanup(self):
        """
        Limpia los recursos utilizados por el módulo de copia
        """
        logger.info("Limpiando recursos del módulo de copia a HDD")
        
        try:
            # Cancelar cualquier copia en progreso
            if self.is_copying:
                logger.info("Cancelando operación de copia en progreso...")
                self.cancel_copy = True
                
                # Esperar un poco por si el proceso de copia está en un punto crítico
                time.sleep(1)
                
                # Actualizar estado
                self.is_copying = False
                self.copy_status = "cancelled"
                self.copy_stats["end_time"] = datetime.now().isoformat()
                self.copy_stats["error"] = "La copia fue cancelada durante el apagado del sistema"
                
        except Exception as e:
            logger.error(f"Error cancelando copia: {str(e)}")
        
        try:
            # Apagar los LEDs de forma segura
            self._set_all_leds("black")
        except Exception as e:
            logger.error(f"Error apagando LEDs durante cleanup: {str(e)}")
        
        try:
            # Limpiar otras referencias
            self.progress_callback = None
        except Exception as e:
            logger.error(f"Error limpiando referencias: {str(e)}")
            
        logger.info("Limpieza de HDDCopyModule completada")
