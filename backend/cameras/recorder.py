import os
import time
import threading
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class VideoRecorder:
    """Handles video recording for multiple cameras"""
    
    def __init__(self, base_dir="../data"):
        self.recording = False
        self.recording_thread = None
        self.cameras = {}
        self.output_files = {}
        self.current_output_folder = None
        self.base_dir = base_dir
        self.clip_duration = 60  # Duración de cada clip en segundos
        self.clip_start_time = None
        self.current_clip_sequence = 0
        self.video_quality = "normal"  # Calidad de grabación: "normal" o "high"
        self.last_quality_change = None
        self.completed_clips = []  # Lista para almacenar los clips completados
        self.clip_completed_callback = None  # Callback para cuando se completa un clip
    
    def add_camera(self, name, camera):
        """Add a camera to be managed by this recorder"""
        self.cameras[name] = camera
    
    def start_recording(self):
        """Start recording from all cameras"""
        if self.recording:
            logger.warning("Recording is already in progress")
            return False
            
        try:
            # Create output folder
            self.current_output_folder = self._create_output_folder()
            
            # Reset clip sequence counter and start time
            self.current_clip_sequence = 0
            self.clip_start_time = datetime.now()
            
            # Reiniciar la lista de clips completados
            self.completed_clips = []
            
            # Start first clip
            self._start_new_clip()
            
            # Start recording thread
            self.recording = True
            self.recording_thread = threading.Thread(target=self._record_video)
            self.recording_thread.daemon = True
            self.recording_thread.start()
            
            logger.info(f"Recording started in {self.current_output_folder}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting recording: {str(e)}")
            self.recording = False
            return False
            
    def _start_new_clip(self):
        """Start a new video clip"""
        try:
            # Generate filenames for each camera with sequence number
            timestamp = datetime.now().strftime("%H-%M-%S")
            self.output_files = {}
            
            # Stop recording on each camera if they're already recording
            for camera_name, camera in self.cameras.items():
                if hasattr(camera, 'is_recording') and camera.is_recording:
                    camera.stop_recording()
            
            # Generate new filenames with sequence number
            self.current_clip_sequence += 1
            quality_suffix = "HQ" if self.video_quality == "high" else "NQ"
            
            for camera_name in self.cameras:
                filename = f"{timestamp}_seq{self.current_clip_sequence:03d}_{quality_suffix}_{camera_name}.mp4"
                self.output_files[camera_name] = os.path.join(self.current_output_folder, filename)
                
            # Start recording on each camera
            for camera_name, camera in self.cameras.items():
                if camera_name in self.output_files:
                    # Aplicar configuración de calidad según el valor actual
                    quality_config = self._get_quality_config(camera_name)
                    camera.start_recording(self.output_files[camera_name], quality_config)
            
            # Reset clip start time
            self.clip_start_time = datetime.now()
            
            logger.info(f"Started new clip sequence {self.current_clip_sequence} with quality {self.video_quality}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting new clip: {str(e)}")
            return False
            
    def _get_quality_config(self, camera_name):
        """Get quality configuration based on current quality setting"""
        if self.video_quality == "high":
            return {
                'road': {'resolution': (1920, 1080), 'bitrate': 3000000},
                'interior': {'resolution': (1280, 720), 'bitrate': 2000000}
            }.get(camera_name)
        else:  # normal
            return {
                'road': {'resolution': (1280, 720), 'bitrate': 1500000},
                'interior': {'resolution': (640, 480), 'bitrate': 800000}
            }.get(camera_name)
            
    def set_recording_quality(self, quality):
        """Change recording quality, applies on next clip"""
        if quality not in ["normal", "high"]:
            logger.warning(f"Invalid quality setting: {quality}")
            return False
            
        if quality != self.video_quality:
            logger.info(f"Changing recording quality from {self.video_quality} to {quality}")
            self.video_quality = quality
            self.last_quality_change = datetime.now()
            
            # Start a new clip immediately with the new quality
            if self.recording:
                self._start_new_clip()
            
        return True
    
    def stop_recording(self):
        """Stop recording from all cameras and return clip information"""
        if not self.recording:
            logger.warning("No recording in progress")
            return []
            
        try:
            # Crear información para el clip actual antes de detener la grabación
            current_time = datetime.now()
            current_clip = {
                'start_time': self.clip_start_time.isoformat() if self.clip_start_time else current_time.isoformat(),
                'end_time': current_time.isoformat(),
                'files': dict(self.output_files) if self.output_files else {},
                'sequence': self.current_clip_sequence,
                'quality': self.video_quality
            }
            
            # Detener la grabación
            self.recording = False
            
            # Detener todas las cámaras manualmente
            for camera_name, camera in self.cameras.items():
                if hasattr(camera, 'is_recording') and camera.is_recording:
                    try:
                        camera.stop_recording()
                        logger.info(f"Camera {camera_name} stopped recording")
                    except Exception as e:
                        logger.error(f"Error stopping camera {camera_name}: {e}")
            
            if self.recording_thread:
                logger.info("Waiting for recording thread to finish...")
                self.recording_thread.join(timeout=5.0)
                logger.info("Recording thread joined")
            
            # Verificar que los archivos existan
            valid_files = {}
            for camera_name, file_path in current_clip['files'].items():
                if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                    valid_files[camera_name] = file_path
                else:
                    logger.warning(f"Video file {file_path} is missing or empty")
            
            # Actualizar con archivos válidos solamente
            current_clip['files'] = valid_files
            
            # Combinar el clip actual con los clips completados previamente durante la grabación
            all_clips = self.completed_clips + [current_clip]
            
            logger.info("Recording stopped")
            logger.info(f"Returning {len(all_clips)} clips including the current clip")
            logger.info(f"Completed clips content: {self.completed_clips}")
            logger.info(f"Current clip content: {current_clip}")
            
            return all_clips
            
        except Exception as e:
            logger.error(f"Error stopping recording: {str(e)}")
            return []
    
    def _create_output_folder(self):
        """Create folder for daily recordings inside videos folder"""
        today = datetime.now().strftime("%Y-%m-%d")
        # Crear la carpeta en base_dir/videos/fecha
        output_folder = os.path.join(self.base_dir, "videos", today)
        
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            
        return output_folder
    
    def _record_video(self):
        """Recording thread function"""
        self.completed_clips = []  # Reiniciar la lista de clips completados
        
        try:
            # For the interior camera (OpenCV), we need to handle frame-by-frame recording
            while self.recording:
                # Check if we need to start a new clip
                current_time = datetime.now()
                elapsed = (current_time - self.clip_start_time).total_seconds()
                
                if elapsed >= self.clip_duration:
                    # Save current clip info before starting new one
                    clip_info = {
                        'start_time': self.clip_start_time.isoformat(),
                        'end_time': current_time.isoformat(),
                        'files': dict(self.output_files),
                        'sequence': self.current_clip_sequence,
                        'quality': self.video_quality
                    }
                    self.completed_clips.append(clip_info)
                    logger.info(f"Completed clip {self.current_clip_sequence}, starting new clip")
                    
                    # Verificar que los archivos existan
                    valid_files = {}
                    for camera_name, file_path in self.output_files.items():
                        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                            valid_files[camera_name] = file_path
                        else:
                            logger.warning(f"Video file {file_path} is missing or empty")
                            
                    # Actualizar con archivos válidos solamente
                    clip_info['files'] = valid_files
                    
                    # Si hay un callback configurado, notificar que se completó un clip
                    if self.clip_completed_callback and callable(self.clip_completed_callback):
                        try:
                            self.clip_completed_callback(clip_info)
                        except Exception as e:
                            logger.error(f"Error en clip_completed_callback: {str(e)}")
                    
                    # Start new clip
                    self._start_new_clip()
                
                # Handle interior camera frame-by-frame recording
                if "interior" in self.cameras:
                    self.cameras["interior"].record_frame()
                    
                time.sleep(1/30)  # ~30fps
                
            # Stop recording on each camera
            for camera_name, camera in self.cameras.items():
                if hasattr(camera, 'is_recording') and camera.is_recording:
                    camera.stop_recording()
            
            # Add final clip to completed list
            current_time = datetime.now()
            clip_info = {
                'start_time': self.clip_start_time.isoformat(),
                'end_time': current_time.isoformat(),
                'files': dict(self.output_files),
                'sequence': self.current_clip_sequence,
                'quality': self.video_quality
            }
            self.completed_clips.append(clip_info)
            
            logger.info(f"Recording thread finished with {len(self.completed_clips)} completed clips")
                    
        except Exception as e:
            logger.error(f"Error in recording thread: {str(e)}")
            self.recording = False
            return completed_clips

    def set_clip_completed_callback(self, callback):
        """Establece una función de callback que se llamará cuando se complete un clip
        
        Args:
            callback: Función que recibe como parámetro la información del clip completado
        """
        self.clip_completed_callback = callback
        logger.info("Callback de clips completados configurado")
