import time
import logging
import numpy as np
import cv2
import os
import subprocess
from .base_camera import BaseCamera

logger = logging.getLogger(__name__)

class RoadCamera(BaseCamera):
    """PiCamera implementation for road-facing camera"""
    
    def __init__(self):
        super().__init__()
        self.camera_id = 0
    
    def initialize(self):
        """Initialize PiCamera2"""
        try:
            from picamera2 import Picamera2
            
            # Ensure resources are released
            self.release()
            time.sleep(1.0)  # Reduced from 2.0
            
            # Initialize camera
            try:
                self.camera = Picamera2(self.camera_id)
            except Exception as e:
                logger.error(f"Error creating Picamera2 instance: {str(e)}")
                self.camera = None
                return False
            
            if self.camera is None:
                logger.error("Could not create Picamera2 instance")
                return False
                
            # Configure resolution, format and fps
            try:
                # Usar una configuración más estable para grabación
                config = self.camera.create_video_configuration(
                    main={"size": (1280, 720), "format": "RGB888"},
                    buffer_count=4,  # Más buffers para estabilidad
                    controls={
                        "FrameRate": 30.0,
                        "AwbMode": 0,  # Auto (0 es el modo automático)
                        "AwbEnable": 1,  # Habilitar balance de blancos automático
                        "Brightness": 0.0,  # Valor neutral
                        "Contrast": 1.0,   # Valor neutral
                        "Saturation": 1.0, # Valor neutral
                        "Sharpness": 1.0   # Valor neutral
                    }
                )
                self.camera.configure(config)
                time.sleep(0.5)  # Dar tiempo para que la cámara se estabilice
            except Exception as e:
                logger.error(f"Error configuring Picamera2: {str(e)}")
                self.release()
                return False
            
            # Start camera
            try:
                self.camera.start()
                # Shorter stabilization time
                time.sleep(1.0)  # Reduced from 2.0
            except Exception as e:
                logger.error(f"Error starting Picamera2: {str(e)}")
                self.release()
                return False
            
            # Test that it works
            try:
                # Use wait=True to ensure capture completes
                test_frame = self.camera.capture_array(wait=True)
                if test_frame is None:
                    raise Exception("Could not capture test frame")
            except Exception as e:
                logger.error(f"Error capturing test frame: {str(e)}")
                self.release()
                return False
                
            logger.info("PiCamera2 initialized successfully")
            self.is_initialized = True
            return True
            
        except (ImportError, ModuleNotFoundError) as e:
            logger.error(f"PiCamera2 not available: {str(e)}")
            self.camera = None
            return False
        except Exception as e:
            logger.error(f"Error in PiCamera2 initialization: {str(e)}")
            if hasattr(self, 'camera') and self.camera is not None:
                self.camera.close()
            self.camera = None
            return False
    
    def release(self):
        """Release PiCamera2 resources"""
        if hasattr(self, 'camera') and self.camera is not None:
            try:
                if hasattr(self.camera, 'close'):
                    self.camera.close()
                    logger.info("PiCamera2 released")
            except Exception as e:
                logger.warning(f"Error releasing PiCamera2: {str(e)}")
            self.camera = None
            self.is_initialized = False
    
    def capture_frame(self):
        """Capture a single frame from PiCamera2"""
        import cv2
        
        if not self.is_initialized or self.camera is None:
            logger.warning("PiCamera2 not initialized")
            return None
        
        try:
            # Capture frame with additional verification
            try:
                # Use wait=True to ensure an array is returned
                frame = self.camera.capture_array(wait=True)
                
                # If we get a Job instead of an array, wait for completion
                if hasattr(frame, 'get_result'):
                    logger.info("Frame is a Job, waiting for result...")
                    try:
                        frame = frame.get_result()
                    except Exception as e:
                        logger.error(f"Error getting Job result: {str(e)}")
                        return None
            except AttributeError as e:
                logger.error(f"Error in PiCamera2: {str(e)}")
                return None
            
            # Verify frame is valid
            if frame is None:
                logger.warning("PiCamera2 frame is None")
                return None
            
            # Process frame
            if isinstance(frame, np.ndarray) and frame.size > 0:
                # Corregir el manejo del espacio de color
                # La PiCamera captura en RGB888, pero ya que trabajamos con OpenCV (que usa BGR),
                # NO debemos convertir de RGB a BGR porque esto invierte los canales incorrectamente
                # y causa el tinte azul en las imágenes
                
                # Verificar si necesitamos convertir el formato de color
                if len(frame.shape) == 3 and frame.shape[2] == 3:
                    # Si la imagen ya está en formato BGR, no hacemos nada
                    # Si está en RGB, la dejamos así para el streaming MJPEG (que espera RGB)
                    # Los navegadores esperan RGB para mostrar correctamente
                    pass
                
                # Resize if needed
                frame = cv2.resize(frame, (640, 480))
                
                # Debug para detectar problemas de color
                logger.debug(f"Frame format: shape={frame.shape}, dtype={frame.dtype}")
                
                return frame
            else:
                logger.warning(f"PiCamera2 frame is not a valid array: {type(frame)}")
                return None
        except Exception as e:
            logger.error(f"Error capturing frame from PiCamera2: {str(e)}")
            return None
    
    def start_recording(self, output_file, quality):
        """Start recording video with PiCamera2"""
        if not self.is_initialized or self.camera is None:
            logger.warning("PiCamera2 not initialized")
            return False
            
        try:
            from picamera2.encoders import H264Encoder
            from picamera2.outputs import FfmpegOutput
            
            # Detener grabación previa si existe
            try:
                if hasattr(self, 'is_recording') and self.is_recording:
                    logger.info("Stopping previous recording before starting new one")
                    self.camera.stop_recording()
                    time.sleep(0.5)  # Breve pausa para asegurar que se liberó correctamente
            except Exception as e:
                logger.warning(f"Error stopping previous recording: {e}")
            
            # Asegurar que la carpeta de salida existe
            import os
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            
            # Determinar configuración de calidad
            bitrate = quality["bitrate"] if quality and "bitrate" in quality else 1500000
            
            # Configure encoder con ajustes más robustos
            encoder = H264Encoder(
                bitrate=bitrate,
                repeat=False,
                iperiod=30  # Un keyframe cada segundo a 30fps
            )
            
            # Configure output con opciones adicionales para mejor compatibilidad
            output = FfmpegOutput(
                output_file,
                audio=False,  # Sin audio para reducir complejidad
                pts=None  # Usar timestamps automáticos
            )
            
            # Start recording
            self.camera.start_recording(encoder=encoder, output=output)
            self.is_recording = True
            logger.info(f"PiCamera2 recording started to {output_file} with bitrate {bitrate}")
            return True
        except Exception as e:
            logger.error(f"Error starting PiCamera2 recording: {str(e)}")
            return False
    
    def stop_recording(self):
        """Stop recording video with PiCamera2"""
        if not self.is_initialized or self.camera is None:
            logger.warning("PiCamera2 not initialized")
            return False
        
        if not hasattr(self, 'is_recording') or not self.is_recording:
            logger.info("PiCamera2 was not recording")
            return True
            
        try:
            if hasattr(self.camera, 'stop_recording'):
                # Intentar detener la grabación con tiempo de espera
                self.camera.stop_recording()
                time.sleep(0.5)  # Dar tiempo para completar la operación
                
                # Marcar como no grabando
                self.is_recording = False
                
                logger.info("PiCamera2 recording stopped successfully")
                return True
            else:
                logger.warning("PiCamera2 doesn't have stop_recording method")
                self.is_recording = False
                return False
        except Exception as e:
            logger.error(f"Error stopping PiCamera2 recording: {str(e)}")
            self.is_recording = False
            
            # Intentar reiniciar la cámara en caso de error persistente
            try:
                logger.info("Attempting to reinitialize camera after recording error")
                self.release()
                time.sleep(1.0)
                self.initialize()
            except Exception as reinit_error:
                logger.error(f"Error reinitializing camera: {reinit_error}")
                
            return False
    
    def _start_mjpeg_internal(self, quality=None):
        """Start native MJPEG streaming using PiCamera2's MJPEGEncoder"""
        if not self.is_initialized or self.camera is None:
            logger.warning("PiCamera2 not initialized for MJPEG streaming")
            return False
            
        try:
            from picamera2.encoders import MJPEGEncoder, Quality
            from picamera2.outputs import FileOutput
            
            # Stop any existing recording
            try:
                if hasattr(self.camera, 'stop_recording'):
                    self.camera.stop_recording()
            except Exception as e:
                logger.debug(f"No active recording to stop: {e}")
            
            # Determine quality settings
            if quality == "high":
                mjpeg_quality = Quality.VERY_HIGH
            elif quality == "medium":  
                mjpeg_quality = Quality.MEDIUM
            elif quality == "low":
                mjpeg_quality = Quality.LOW
            else:
                mjpeg_quality = Quality.HIGH  # Default
            
            # Start MJPEG recording to streaming output
            self.camera.start_recording(
                MJPEGEncoder(), 
                FileOutput(self.streaming_output), 
                mjpeg_quality
            )
            
            logger.info(f"PiCamera2 MJPEG streaming started with quality: {mjpeg_quality}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting PiCamera2 MJPEG streaming: {e}")
            return False
    
    def _stop_mjpeg_internal(self):
        """Stop native MJPEG streaming"""
        if not self.is_initialized or self.camera is None:
            return True
            
        try:
            if hasattr(self.camera, 'stop_recording'):
                self.camera.stop_recording()
            logger.info("PiCamera2 MJPEG streaming stopped")
            return True
        except Exception as e:
            logger.error(f"Error stopping PiCamera2 MJPEG streaming: {e}")
            return False
