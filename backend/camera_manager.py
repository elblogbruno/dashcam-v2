import os
import time
import logging
import threading
import traceback
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

# Change from relative imports to absolute imports
from cameras import RoadCamera, InteriorCamera, VideoRecorder, CameraSettings
from video_metadata_injector import VideoMetadataInjector

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
        self.gps_reader = None  # GPS reader instance
        self.landmark_checker = None  # Landmark checker instance
        
        # Video metadata injector
        self.metadata_injector = VideoMetadataInjector()
        
        # GPS logging settings
        self.gps_logging_interval = 2.0  # Log GPS coordinates every 2 seconds
        self.last_gps_log_time = 0
        self.gps_logging_thread = None
        self.gps_logging_active = False
        
        # Landmark checking settings
        self.landmark_check_interval = 5.0  # Check landmarks every 5 seconds
        self.last_landmark_check = 0
        
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
            
            # Start GPS logging
            self._start_gps_logging()
        
        return result

    def stop_recording(self):
        """Stop recording from all cameras and return clip information"""
        # Stop GPS logging first
        self._stop_gps_logging()
        
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
        """Maneja un clip completado y lo guarda en la base de datos con información GPS y landmarks"""
        try:
            if not self.current_trip_id or not self.trip_logger:
                logger.warning("No se puede guardar clip - falta trip_id o trip_logger")
                return
            
            logger.info(f"Procesando clip completado: {clip_info['sequence']}")
            
            # Enrich clip with GPS and landmark information
            self._enrich_clip_with_location_data(clip_info)
            
            # Inject GPS metadata into video files
            self._inject_gps_metadata_into_videos(clip_info)
            
            # Guardar en la base de datos
            result = self.trip_logger.add_video_clips(self.current_trip_id, [clip_info])
            logger.info(f"Clip {clip_info['sequence']} añadido a la base de datos en tiempo real: {result}")
            
            # Verificar que se guardó correctamente usando Trip Logger
            try:
                # Verificar usando el nuevo sistema Trip Logger
                saved_clips = self.trip_logger.get_trip_videos(self.current_trip_id)
                clip_exists = any(
                    clip.get('sequence_num') == clip_info['sequence'] 
                    for clip in saved_clips
                )
                
                if clip_exists:
                    logger.info(f"Clip {clip_info['sequence']} guardado exitosamente")
                else:
                    logger.warning(f"No se encontró el clip {clip_info['sequence']} en la base de datos después de guardarlo")
            except Exception as verify_error:
                logger.warning(f"No se pudo verificar que el clip se guardó correctamente: {verify_error}")
                
        except Exception as e:
            logger.error(f"Error al guardar clip completado: {str(e)}")
            logger.error(traceback.format_exc())
            
    def _enrich_clip_with_location_data(self, clip_info):
        """Enrich clip information with GPS coordinates and landmark data"""
        try:
            if not self.gps_reader or not self.trip_logger:
                return
                
            # Get GPS coordinates for the clip time range
            start_time = datetime.fromisoformat(clip_info['start_time'])
            end_time = datetime.fromisoformat(clip_info['end_time'])
            
            # Get GPS track for this clip
            gps_coordinates = self.trip_logger.get_gps_coordinates_for_video(
                self.current_trip_id, start_time, end_time
            )
            
            if gps_coordinates:
                # Set start and end coordinates
                first_coord = gps_coordinates[0]
                last_coord = gps_coordinates[-1]
                
                clip_info['start_lat'] = first_coord[2]  # latitude
                clip_info['start_lon'] = first_coord[3]  # longitude
                clip_info['end_lat'] = last_coord[2]
                clip_info['end_lon'] = last_coord[3]
                
                logger.info(f"Added GPS coordinates to clip {clip_info['sequence']}: "
                          f"({first_coord[2]:.6f}, {first_coord[3]:.6f}) -> "
                          f"({last_coord[2]:.6f}, {last_coord[3]:.6f})")
                
                # Realizar reverse geocoding si está disponible
                if hasattr(self, 'reverse_geocoding_service') and self.reverse_geocoding_service:
                    self._add_reverse_geocoding_to_clip(clip_info)
                
                # Check for nearby landmarks during the clip
                if self.landmark_checker:
                    self._check_clip_landmarks(clip_info, gps_coordinates)
            else:
                logger.warning(f"No GPS coordinates found for clip {clip_info['sequence']}")
                
        except Exception as e:
            logger.error(f"Error enriching clip with location data: {str(e)}")
            
    def _check_clip_landmarks(self, clip_info, gps_coordinates):
        """Check for nearby landmarks during the clip recording"""
        try:
            nearby_landmarks = []
            priority_landmark = None
            
            # Check landmarks along the GPS track
            for coord in gps_coordinates[::5]:  # Check every 5th coordinate to avoid overload
                lat, lon = coord[2], coord[3]
                landmark = self.landmark_checker.check_nearby(lat, lon)
                
                if landmark:
                    landmark_id = landmark.get('id')
                    if landmark_id not in [l.get('id') for l in nearby_landmarks]:
                        nearby_landmarks.append(landmark)
                        
                        # Check if this is a priority landmark
                        category = landmark.get('category', 'standard')
                        if self._is_priority_landmark_category(category):
                            priority_landmark = landmark
            
            # Set landmark information in clip
            if priority_landmark:
                clip_info['near_landmark'] = True
                clip_info['landmark_id'] = priority_landmark.get('id')
                clip_info['landmark_type'] = priority_landmark.get('category', 'standard')
                logger.info(f"Clip {clip_info['sequence']} near priority landmark: {priority_landmark.get('name')}")
            elif nearby_landmarks:
                clip_info['near_landmark'] = True
                clip_info['landmark_id'] = nearby_landmarks[0].get('id')
                clip_info['landmark_type'] = nearby_landmarks[0].get('category', 'standard')
                logger.info(f"Clip {clip_info['sequence']} near landmark: {nearby_landmarks[0].get('name')}")
            else:
                clip_info['near_landmark'] = False
                
        except Exception as e:
            logger.error(f"Error checking clip landmarks: {str(e)}")

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
        
    def set_dependencies(self, trip_logger, gps_reader=None, landmark_checker=None, reverse_geocoding_service=None):
        """Configure dependencies for GPS logging and landmark checking"""
        self.trip_logger = trip_logger
        self.gps_reader = gps_reader
        self.landmark_checker = landmark_checker
        self.reverse_geocoding_service = reverse_geocoding_service
        logger.info("CameraManager dependencies configured")
        
    def _start_gps_logging(self):
        """Start continuous GPS coordinate logging"""
        if not self.gps_reader or not self.trip_logger or not self.current_trip_id:
            logger.warning("Cannot start GPS logging - missing dependencies or trip ID")
            return
            
        self.gps_logging_active = True
        self.gps_logging_thread = threading.Thread(target=self._gps_logging_loop)
        self.gps_logging_thread.daemon = True
        self.gps_logging_thread.start()
        logger.info("GPS logging started")
        
    def _stop_gps_logging(self):
        """Stop GPS coordinate logging"""
        self.gps_logging_active = False
        if self.gps_logging_thread:
            self.gps_logging_thread.join(timeout=2.0)
        logger.info("GPS logging stopped")
        
    def _gps_logging_loop(self):
        """Main GPS logging loop that runs in a separate thread"""
        while self.gps_logging_active and self.current_trip_id:
            try:
                current_time = time.time()
                
                # Log GPS coordinates at specified interval
                if current_time - self.last_gps_log_time >= self.gps_logging_interval:
                    self._log_current_gps_position()
                    self.last_gps_log_time = current_time
                    
                # Check for nearby landmarks
                if current_time - self.last_landmark_check >= self.landmark_check_interval:
                    self._check_nearby_landmarks()
                    self.last_landmark_check = current_time
                    
                time.sleep(1.0)  # Sleep for 1 second between iterations
                
            except Exception as e:
                logger.error(f"Error in GPS logging loop: {str(e)}")
                time.sleep(5.0)  # Wait longer on error
                
    def _log_current_gps_position(self):
        """Log current GPS position to database"""
        try:
            if not self.gps_reader or not self.trip_logger or not self.current_trip_id:
                return
                
            gps_data = self.gps_reader.get_location()
            if gps_data and gps_data.get('latitude') and gps_data.get('longitude'):
                # Validate GPS fix quality before logging
                fix_quality = gps_data.get('fix_quality', 0)
                if fix_quality >= 1:  # Only log if we have at least a basic GPS fix
                    self.trip_logger.log_gps_coordinate_with_calculated_speed(
                        latitude=gps_data['latitude'],
                        longitude=gps_data['longitude'],
                        altitude=gps_data.get('altitude'),
                        gps_speed=gps_data.get('speed'),
                        heading=gps_data.get('heading'),
                        satellites=gps_data.get('satellites'),
                        fix_quality=fix_quality
                    )
        except Exception as e:
            logger.error(f"Error logging GPS position: {str(e)}")
            
    def _check_nearby_landmarks(self):
        """Check for nearby landmarks and handle video recording triggers"""
        try:
            if not self.gps_reader or not self.landmark_checker or not self.trip_logger:
                return
                
            gps_data = self.gps_reader.get_gps_data()
            if not gps_data or not gps_data.get('latitude') or not gps_data.get('longitude'):
                return
                
            # Check for nearby landmarks with distance information
            nearby_landmarks = self.landmark_checker.get_nearby_landmarks(
                gps_data['latitude'], 
                gps_data['longitude'],
                radius_km=2.0  # Check within 2km for approach planning
            )
            
            if nearby_landmarks:
                for landmark_info in nearby_landmarks:
                    landmark = landmark_info.get('landmark', {})
                    distance_meters = landmark_info.get('distance_meters', float('inf'))
                    
                    # Handle landmark approach with quality upgrades
                    self._handle_landmark_approach(landmark, distance_meters)
                    
                    # Log landmark encounter if close enough
                    if distance_meters <= 200 and self.current_trip_id:
                        self.trip_logger.add_landmark_encounter(landmark)
                        
                    # Audio notification for very close landmarks
                    if distance_meters <= 100 and hasattr(self, 'audio_notifier') and self.audio_notifier:
                        self.audio_notifier.notify_landmark(landmark)
                        
        except Exception as e:
            logger.error(f"Error checking nearby landmarks: {str(e)}")
            
    def _is_priority_landmark_category(self, category):
        """Determine if a landmark category should trigger priority recording"""
        priority_categories = [
            'tourist_attraction', 'tourism', 'monument', 'museum', 'castle', 
            'viewpoint', 'attraction', 'trip_point', 'manual_waypoint',
            'heritage', 'archaeological_site', 'historic'
        ]
        return category in priority_categories
    
    def _should_upgrade_recording_quality(self, landmark_data):
        """Determine if we should upgrade recording quality for this landmark"""
        if not landmark_data:
            return False
            
        # Check if it's a priority landmark
        category = landmark_data.get('category', 'standard')
        if self._is_priority_landmark_category(category):
            return True
            
        # Check if it's marked as a special trip waypoint
        if landmark_data.get('trip_id') or landmark_data.get('is_waypoint'):
            return True
            
        return False
    
    def _handle_landmark_approach(self, landmark_data, distance_meters):
        """Handle approaching a landmark with appropriate recording adjustments"""
        try:
            if not landmark_data:
                return
                
            landmark_name = landmark_data.get('name', 'Unknown')
            
            # If we're within 500m of a priority landmark, upgrade recording quality
            if distance_meters <= 500 and self._should_upgrade_recording_quality(landmark_data):
                current_quality = getattr(self.recorder, 'recording_quality', 'normal')
                
                if current_quality != 'high':
                    logger.info(f"Upgrading recording quality to HIGH for landmark: {landmark_name}")
                    
                    # If recording is active, we need to handle the quality change
                    if hasattr(self.recorder, 'set_recording_quality'):
                        self.recorder.set_recording_quality('high')
                    
                    # Log this quality upgrade event
                    if hasattr(self.trip_logger, 'log_quality_upgrade'):
                        self.trip_logger.log_quality_upgrade(
                            landmark_id=landmark_data.get('id'),
                            landmark_name=landmark_name,
                            distance_meters=distance_meters,
                            reason='priority_landmark_approach'
                        )
                        
            # If we're within 100m, ensure we're recording and mark the clip
            if distance_meters <= 100:
                if not self.recorder.recording:
                    logger.info(f"Auto-starting recording for nearby landmark: {landmark_name}")
                    self.start_recording()
                    
                # Mark current recording segment with landmark info
                if hasattr(self.recorder, 'mark_landmark_proximity'):
                    self.recorder.mark_landmark_proximity(landmark_data)
                    
        except Exception as e:
            logger.error(f"Error handling landmark approach: {str(e)}")
            
    def _cleanup_old_gps_data(self):
        """Clean up old GPS coordinate data to manage storage"""
        try:
            if not self.trip_logger:
                return
                
            # Run cleanup once per hour
            current_time = time.time()
            if hasattr(self, 'last_gps_cleanup') and current_time - self.last_gps_cleanup < 3600:
                return
                
            # Keep GPS data for the last 30 days
            cutoff_date = datetime.now() - timedelta(days=30)
            
            if hasattr(self.trip_logger, 'cleanup_old_gps_data'):
                deleted_count = self.trip_logger.cleanup_old_gps_data(cutoff_date)
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} old GPS coordinate records")
                    
            self.last_gps_cleanup = current_time
            
        except Exception as e:
            logger.error(f"Error cleaning up old GPS data: {str(e)}")

    def _add_reverse_geocoding_to_clip(self, clip_info):
        """Añadir información de reverse geocoding al clip"""
        try:
            import asyncio
            import json
            
            # Usar coordenadas de inicio del clip
            start_lat = clip_info.get('start_lat')
            start_lon = clip_info.get('start_lon')
            
            if not start_lat or not start_lon:
                return
            
            logger.debug(f"Realizando reverse geocoding para clip {clip_info['sequence']}")
            
            # Crear un loop de evento si no existe
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # Ejecutar reverse geocoding
            location_info = loop.run_until_complete(
                self.reverse_geocoding_service.get_location(start_lat, start_lon)
            )
            
            if location_info:
                # Crear JSON con la información de ubicación
                location_json = {
                    'display_name': location_info.get_display_name(),
                    'city': location_info.city,
                    'town': location_info.town,
                    'village': location_info.village,
                    'state': location_info.state,
                    'country': location_info.country,
                    'country_code': location_info.country_code,
                    'timestamp': datetime.now().isoformat()
                }
                
                # Añadir al clip_info para que se guarde en la base de datos
                clip_info['location'] = json.dumps(location_json)
                
                logger.info(f"Reverse geocoding añadido al clip {clip_info['sequence']}: {location_info.get_display_name()}")
            else:
                logger.debug(f"No se pudo obtener ubicación para clip {clip_info['sequence']}")
                
        except Exception as e:
            logger.error(f"Error en reverse geocoding: {e}")
            # No fallar el procesamiento del clip por un error de geocoding