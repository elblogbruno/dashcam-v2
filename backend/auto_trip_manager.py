import logging
import datetime
from typing import List, Optional
import asyncio
import time
from shutdown_control import should_continue_loop, interruptible_sleep

# Configure logging
logger = logging.getLogger(__name__)

class AutoTripManager:
    """
    Class to manage automatic trip starting and monitoring.
    This class checks for planned trips that should start based on current date
    and provides functionality to start/stop trips.
    """
    
    def __init__(self):
        # Will be initialized from main.py
        self.trip_logger = None
        self.landmark_checker = None
        self.camera_manager = None
        self.gps_reader = None
        self.audio_notifier = None
        
        # Active trip info
        self.active_planned_trip_id = None
        self.active_trip_id = None
        self.is_active = False
        
        # Callback to update system recording state
        self.set_recording_state_callback = None
        
    def initialize(self, trip_logger, landmark_checker, camera_manager, 
                  gps_reader, audio_notifier, set_recording_state_callback):
        """Initialize with required components"""
        self.trip_logger = trip_logger
        self.landmark_checker = landmark_checker
        self.camera_manager = camera_manager
        self.gps_reader = gps_reader
        self.audio_notifier = audio_notifier
        self.set_recording_state_callback = set_recording_state_callback
        
        logger.info("Auto Trip Manager initialized")
        
    def check_for_trips_to_start(self, planned_trips) -> Optional[dict]:
        """
        Check if any trips should start automatically based on current date.
        Returns the trip that should start or None.
        """
        if not planned_trips:
            return None
            
        today = datetime.date.today().isoformat()
        current_time = datetime.datetime.now().time()
        
        # Find trips scheduled to start today
        for trip in planned_trips:
            # Skip trips that are already completed
            if trip.completed:
                continue
                
            # Check if trip should start today
            if trip.start_date == today:
                logger.info(f"Found trip scheduled for today: {trip.name}")
                return trip
                
        return None
        
    async def start_scheduled_trip(self, trip):
        """Start a scheduled trip"""
        if self.is_active:
            logger.warning("Cannot start scheduled trip - another trip is already active")
            return False
            
        try:
            # Announce trip starting
            self.audio_notifier.announce(f"Iniciando viaje programado: {trip.name}")
            
            # Log trip start
            self.active_trip_id = self.trip_logger.start_trip(planned_trip_id=trip.id)
            
            # Start recording
            self.camera_manager.start_recording()
            
            # Set active trip info
            self.active_planned_trip_id = trip.id
            self.is_active = True
            
            # Update global recording state
            if self.set_recording_state_callback:
                self.set_recording_state_callback(True)
                
            # Start monitoring trip in background
            asyncio.create_task(self.monitor_trip_loop())
            
            logger.info(f"Started scheduled trip: {trip.name} (ID: {trip.id})")
            return True
            
        except Exception as e:
            logger.error(f"Error starting scheduled trip: {str(e)}")
            return False
    
    def start_trip_manually(self, planned_trip_id=None):
        """
        Start a trip manually, optionally with a planned trip ID.
        Returns the trip ID if successful, None otherwise.
        """
        if self.is_active:
            logger.warning("Cannot start trip - another trip is already active")
            return None
            
        try:
            # Start the trip in the trip logger
            self.active_trip_id = self.trip_logger.start_trip(planned_trip_id=planned_trip_id)
            
            # Store the planned trip ID if provided
            if planned_trip_id:
                self.active_planned_trip_id = planned_trip_id
                # Load landmarks for this planned trip
                if self.landmark_checker:
                    self.landmark_checker.set_active_trip_id(planned_trip_id)
            
            # Start recording
            self.camera_manager.start_recording()
            
            # Mark as active
            self.is_active = True
            
            # Update global recording state
            if self.set_recording_state_callback:
                self.set_recording_state_callback(True)
                
            # Start monitoring trip in background
            asyncio.create_task(self.monitor_trip_loop())
            
            logger.info(f"Started trip {self.active_trip_id} manually" + 
                      (f" (Planned trip: {planned_trip_id})" if planned_trip_id else ""))
            return self.active_trip_id
            
        except Exception as e:
            logger.error(f"Error starting trip manually: {str(e)}")
            return None
    
    def end_trip(self):
        """End the current trip"""
        if not self.is_active:
            logger.warning("Cannot end trip - no active trip")
            return False
            
        try:
            # Update trip end location if GPS available
            location = self.gps_reader.get_location()
            if location and "latitude" in location and "longitude" in location:
                self.trip_logger.end_trip(location["latitude"], location["longitude"])
            else:
                self.trip_logger.end_trip()
            
            # Stop recording
            self.camera_manager.stop_recording()
            
            # Clear active trip info
            ended_trip_id = self.active_trip_id
            self.active_trip_id = None
            self.active_planned_trip_id = None
            self.is_active = False
            
            # Update global recording state
            if self.set_recording_state_callback:
                self.set_recording_state_callback(False)
            
            # Announce trip ending
            self.audio_notifier.announce("Viaje finalizado")
            
            logger.info(f"Ended trip {ended_trip_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error ending trip: {str(e)}")
            return False
            
    def get_active_trip_info(self):
        """Get information about the active trip"""
        if not self.is_active:
            return None
            
        return {
            "trip_id": self.active_trip_id,
            "planned_trip_id": self.active_planned_trip_id,
            "is_active": self.is_active
        }

    async def update_trip_recording_quality(self):
        """
        Actualiza la calidad de grabación basada en la posición actual y landmarks cercanos.
        Esta función debe ser ejecutada periódicamente mientras un viaje está activo.
        """
        if not self.is_active or not self.camera_manager or not self.landmark_checker or not self.gps_reader:
            return
            
        try:
            # Obtener ubicación actual
            location = self.gps_reader.get_location()
            if not location or "latitude" not in location or "longitude" not in location:
                return
                
            # Determinar calidad de grabación según la proximidad a landmarks
            quality, nearby_landmark = self.landmark_checker.get_recording_quality_for_position(
                location["latitude"], location["longitude"]
            )
            
            # Aplicar la calidad de grabación
            self.camera_manager.set_recording_quality(quality)
            
            # Si estamos cerca de un landmark, registrarlo y actualizar la base de datos
            if nearby_landmark and self.active_trip_id:
                self.trip_logger.add_landmark_encounter(nearby_landmark)
                
                # Notificar por audio que se está grabando en alta calidad
                if quality == "high":
                    self.audio_notifier.announce(f"Grabando en alta calidad cerca de {nearby_landmark['name']}")
                    
        except Exception as e:
            logger.error(f"Error actualizando calidad de grabación: {str(e)}")
            
    async def monitor_trip_loop(self):
        """
        Bucle de monitoreo de viaje que se ejecuta mientras un viaje está activo.
        Actualiza la calidad de grabación y gestiona otras tareas periódicas.
        """
        while self.is_active and should_continue_loop("auto_trip"):
            # Actualizar calidad de grabación
            await self.update_trip_recording_quality()
            
            # Sleep interrumpible de 10 segundos
            await interruptible_sleep(10.0, "auto_trip")

# Create a singleton instance
auto_trip_manager = AutoTripManager()
