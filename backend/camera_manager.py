import os
import time
import logging
import threading
from typing import Dict, Any, Optional

# Change from relative imports to absolute imports
from cameras import RoadCamera, InteriorCamera, VideoRecorder, CameraSettings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CameraManager:
    def __init__(self):
        # Initialize camera components
        self.road_camera = RoadCamera()
        self.interior_camera = InteriorCamera(device_path="/dev/video0")
        
        # Settings and recorder
        self.settings = CameraSettings()
        self.recorder = VideoRecorder(base_dir="../data")
        
        # Add cameras to recorder
        self.recorder.add_camera("road", self.road_camera)
        self.recorder.add_camera("interior", self.interior_camera)
        
        # Camera errors list
        self.camera_errors = []
        
        # Failure counters for each camera
        self.road_camera_failures = 0
        self.interior_camera_failures = 0
        
        # Threshold for consecutive failures before reset
        self.reset_threshold = 5
        
        # Variables para manejo de clips
        self.current_trip_id = None  # ID del viaje actual
        self.trip_logger = None  # Será configurado desde main.py
        
        # Initialize cameras
        self.initialize_cameras()
        
    def initialize_cameras(self):
        """Initialize all cameras in parallel for faster startup"""
        self.camera_errors = []
        
        # Define initialization functions
        def init_road_camera():
            logger.info("Initializing road camera with PiCamera2")
            if not self.road_camera.initialize():
                logger.error("Could not initialize road camera")
                self.camera_errors.append("Could not initialize PiCamera2")
        
        def init_interior_camera():
            logger.info("Initializing interior camera with OpenCV")
            if not self.interior_camera.initialize():
                logger.warning("Could not initialize interior camera")
                self.camera_errors.append("Could not initialize interior camera")
        
        # Create threads for parallel initialization
        road_thread = threading.Thread(target=init_road_camera)
        interior_thread = threading.Thread(target=init_interior_camera)
        
        # Start threads
        road_thread.start()
        interior_thread.start()
        
        # Wait for both to complete
        road_thread.join()
        interior_thread.join()
        
        logger.info("Camera initialization complete")
        
    def reinitialize_camera(self, camera_type="road"):
        """
        Reinitialize a specific camera
        
        Args:
            camera_type: 'road' or 'interior'
            
        Returns:
            bool: True if initialization was successful, False otherwise
        """
        try:
            if camera_type == "road":
                logger.info("Reinitializing road camera")
                self.road_camera.release()
                time.sleep(1.0)  # Pause to ensure resources are released
                success = self.road_camera.initialize()
                if success:
                    logger.info("Road camera reinitialized successfully")
                    self.road_camera_failures = 0
                else:
                    logger.error("Failed to reinitialize road camera")
                return success
            elif camera_type == "interior":
                logger.info("Reinitializing interior camera")
                self.interior_camera.release()
                time.sleep(1.0)  # Pause to ensure resources are released
                success = self.interior_camera.initialize()
                if success:
                    logger.info("Interior camera reinitialized successfully")
                    self.interior_camera_failures = 0
                else:
                    logger.error("Failed to reinitialize interior camera")
                return success
            else:
                logger.error(f"Invalid camera type for reinitialization: {camera_type}")
                return False
        except Exception as e:
            logger.error(f"Error during camera reinitialization ({camera_type}): {str(e)}")
            return False

    def get_preview_frame(self, camera_type="road"):
        """Get preview frame from specified camera with optimized error handling"""
        try:
            # OPTIMIZACIÓN: Cache para reducir logging excesivo
            if not hasattr(self, '_last_log_time'):
                self._last_log_time = {"road": 0, "interior": 0}
            
            current_time = time.time()
            
            if camera_type == "road":
                if not self.road_camera.is_initialized:
                    # Log solo cada 10 segundos para evitar spam
                    if current_time - self._last_log_time["road"] > 10:
                        logger.warning("Road camera not initialized")
                        self._last_log_time["road"] = current_time
                    self._reset_camera("road")
                    return None
                
                frame = self.road_camera.capture_frame()
                if frame is None:
                    # Increment failure counter
                    self.road_camera_failures += 1
                    
                    # Log solo cada 5 fallos para reducir overhead
                    if self.road_camera_failures % 5 == 1:
                        logger.warning(f"Failed to get road camera frame ({self.road_camera_failures}/{self.reset_threshold})")
                    
                    # Only reset if we've reached the threshold
                    if self.road_camera_failures >= self.reset_threshold:
                        logger.warning(f"Road camera failed {self.road_camera_failures} times in a row, resetting")                    
                        self._reset_camera("road")
                        self.road_camera_failures = 0  # Reset counter after reset attempt
                    return None
                else:
                    # Reset failure counter on success
                    if self.road_camera_failures > 0:
                        logger.info("Road camera recovered without reset")
                        self.road_camera_failures = 0
                    return frame
                    
            elif camera_type == "interior":
                if not self.interior_camera.is_initialized:
                    # Log solo cada 10 segundos para evitar spam
                    if current_time - self._last_log_time["interior"] > 10:
                        logger.warning("Interior camera not initialized")
                        self._last_log_time["interior"] = current_time
                    self._reset_camera("interior")
                    return None
                
                frame = self.interior_camera.capture_frame()
                if frame is None:
                    # Increment failure counter
                    self.interior_camera_failures += 1
                    
                    # Log solo cada 5 fallos para reducir overhead
                    if self.interior_camera_failures % 5 == 1:
                        logger.warning(f"Failed to get interior camera frame ({self.interior_camera_failures}/{self.reset_threshold})")
                    
                    # Only reset if we've reached the threshold
                    if self.interior_camera_failures >= self.reset_threshold:
                        logger.warning(f"Interior camera failed {self.interior_camera_failures} times in a row, resetting")
                        self._reset_camera("interior")
                        self.interior_camera_failures = 0  # Reset counter after reset attempt
                    return None
                else:
                    # Reset failure counter on success
                    if self.interior_camera_failures > 0:
                        logger.info("Interior camera recovered without reset")
                        self.interior_camera_failures = 0
                    return frame
            else:
                # Log solo cada 30 segundos para tipos de cámara inválidos
                if current_time - self._last_log_time.get(camera_type, 0) > 30:
                    logger.warning(f"Camera '{camera_type}' not available")
                    self._last_log_time[camera_type] = current_time
                return None
                
        except Exception as e:
            # Log solo cada 15 segundos para errores generales para evitar spam
            if current_time - self._last_log_time.get('general_error', 0) > 15:
                logger.error(f"Error in get_preview_frame: {str(e)}")
                self._last_log_time['general_error'] = current_time
            return None

    def _reset_camera(self, camera_type):
        """Reset a problematic camera"""
        logger.info(f"Resetting {camera_type} camera")
        
        # Usar el método reinitialize_camera implementado previamente
        return self.reinitialize_camera(camera_type)

    def start_recording(self):
        """Start recording from all cameras"""
        # Configurar el callback para clips completados
        self.recorder.set_clip_completed_callback(self.handle_completed_clip)
        logger.info("Callback de clips completados configurado")
        
        result = self.recorder.start_recording()
        
        # Si la grabación inició correctamente, guardamos el trip_id
        if result and self.trip_logger:
            self.current_trip_id = self.trip_logger.start_trip()
            logger.info(f"Grabación iniciada con trip_id: {self.current_trip_id}")
        
        return result

    def stop_recording(self):
        """Stop recording from all cameras and return clip information"""
        # Eliminar el callback para evitar llamadas futuras
        self.recorder.set_clip_completed_callback(None)
        
        # Guardar el trip_id actual antes de finalizar
        trip_id = self.current_trip_id
        self.current_trip_id = None
        
        # Obtener los clips completados
        completed_clips = self.recorder.stop_recording()
        
        # Registrar el último clip si es necesario y hay un trip_id válido
        if completed_clips and trip_id and self.trip_logger:
            # Filtrar solo el último clip (no queremos duplicar los que ya se han guardado)
            if len(completed_clips) > 0:
                last_clip = completed_clips[-1]
                logger.info(f"Guardando último clip {last_clip['sequence']} al detener grabación")
                self.trip_logger.add_video_clips(trip_id, [last_clip])
        
        return completed_clips
    
    def set_recording_quality(self, quality):
        """Change the recording quality (normal or high)"""
        return self.recorder.set_recording_quality(quality)
        
    def apply_settings(self, settings: Dict[str, Any]):
        """Apply new camera settings"""
        return self.settings.apply_settings(settings)

    def handle_completed_clip(self, clip_info):
        """Maneja un clip completado durante la grabación
        
        Args:
            clip_info: Diccionario con la información del clip completado
        """
        if not self.trip_logger or not self.current_trip_id:
            logger.warning("No se puede guardar clip: trip_logger o current_trip_id no configurados")
            return
            
        try:
            # Guardar el clip en la base de datos inmediatamente
            result = self.trip_logger.add_video_clips(self.current_trip_id, [clip_info])
            logger.info(f"Clip {clip_info['sequence']} añadido a la base de datos en tiempo real: {result}")
            
            # Verificar que se guardó correctamente
            import sqlite3
            conn = sqlite3.connect(self.trip_logger.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM video_clips WHERE trip_id = ? AND sequence_num = ?", 
                (self.current_trip_id, clip_info['sequence'])
            )
            result = cursor.fetchone()
            conn.close()
            
            if result:
                logger.info(f"Clip guardado exitosamente con ID: {result[0]}")
            else:
                logger.warning(f"No se encontró el clip en la base de datos después de guardarlo")
                
        except Exception as e:
            logger.error(f"Error al guardar clip completado: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())

    def cleanup(self):
        """Release all resources"""
        try:
            if self.recorder.recording:
                logger.info("Stopping recording during cleanup")
                self.recorder.stop_recording()
                
            self.road_camera.release()
            self.interior_camera.release()
                
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
            
    def __del__(self):
        """Destructor"""
        self.cleanup()

    def set_trip_logger(self, trip_logger):
        """Configura el trip_logger para ser usado al guardar clips
        
        Args:
            trip_logger: Instancia de TripLogger
        """
        self.trip_logger = trip_logger
        logger.info("TripLogger configurado en CameraManager")