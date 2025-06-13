import os
import time
import logging
import threading
import subprocess
import platform
from shutdown_control import should_continue_loop, register_thread
from enhanced_shutdown import EnhancedShutdownManager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ShutdownMonitor:
    def __init__(self, gpio_pin=17, trip_manager=None, audio_notifier=None, shutdown_controller=None):
        self.gpio_pin = gpio_pin  # Default GPIO pin for power monitoring
        self.running = False
        self.monitor_thread = None
        self.mock_mode = False
        self.trip_manager = trip_manager  # Reference to trip manager for stopping current trip
        
        # Enhanced shutdown manager
        self.enhanced_shutdown = EnhancedShutdownManager(
            audio_notifier=audio_notifier,
            led_controller=None,  # Se configurará dinámicamente
            shutdown_controller=shutdown_controller,
            trip_manager=trip_manager
        )
        
        # Estado del botón para el sistema mejorado
        self.button_pressed = False
        self.last_button_state = True  # Pull-up, así que True = no presionado
        
        # Check platform and GPIO library availability
        self._check_platform()
        
    def _check_platform(self):
        """Check platform and available GPIO libraries"""
        system = platform.system()
        logger.info(f"Detectado sistema operativo: {system}")
        
        if system == "Linux":
            # Check for Raspberry Pi and GPIO libraries
            logger.info("Verificando bibliotecas GPIO disponibles...")
            
            try:
                # Try to import RPi.GPIO first
                import RPi.GPIO as GPIO
                # Verificar versión
                gpio_version = getattr(GPIO, "VERSION", "desconocida")
                logger.info(f"Encontrada biblioteca RPi.GPIO versión {gpio_version}")
                
                self.gpio_lib = "RPi.GPIO"
                self.GPIO = GPIO
                logger.info(f"Utilizando RPi.GPIO para monitoreo de apagado en pin {self.gpio_pin} (BCM)")
                return
            except (ImportError, ModuleNotFoundError) as e:
                logger.info(f"RPi.GPIO no disponible: {e}")
                
                try:
                    # Try gpiozero as alternative
                    from gpiozero import Button
                    import gpiozero
                    # Verificar versión
                    gpiozero_version = getattr(gpiozero, "__version__", "desconocida")
                    logger.info(f"Encontrada biblioteca gpiozero versión {gpiozero_version}")
                    
                    # Configurar explícitamente el backend y modo GPIO si está disponible
                    import os
                    os.environ['GPIOZERO_PIN_FACTORY'] = 'native'
                    logger.info("Configurado GPIOZERO_PIN_FACTORY=native")
                    
                    self.gpio_lib = "gpiozero"
                    self.power_button = Button(self.gpio_pin)
                    
                    # Verificar pin factory actual
                    from gpiozero import Device
                    pin_factory = str(Device.pin_factory)
                    logger.info(f"Utilizando gpiozero con pin factory: {pin_factory} para monitoreo en pin {self.gpio_pin}")
                    return
                except (ImportError, ModuleNotFoundError) as e:
                    logger.warning(f"gpiozero no disponible: {e}")
                except Exception as e:
                    logger.warning(f"Error inicializando gpiozero: {str(e)}")
        
        # If we get here, no GPIO library is available or not on Linux
        self.gpio_lib = None
        self.mock_mode = True
        logger.warning(f"No se ha detectado soporte GPIO en {system}. Usando modo de simulación para monitoreo de apagado.")
        
    def _configure_gpio_environment(self):
        """Configurar entorno para GPIO antes de iniciar el monitoreo"""
        if self.gpio_lib == "gpiozero":
            try:
                # Configurar variables de entorno para gpiozero
                import os
                # Usar el backend nativo por defecto para evitar problemas con RPi.GPIO
                os.environ['GPIOZERO_PIN_FACTORY'] = 'native'
                logger.info("Configurado entorno para gpiozero con pin factory: native")
            except Exception as e:
                logger.error(f"Error configurando entorno gpiozero: {str(e)}")
    
    def start_monitoring(self):
        """Start monitoring for power loss"""
        if self.running:
            logger.warning("Shutdown monitor is already running")
            return False
        
        # Configurar entorno GPIO
        self._configure_gpio_environment()
            
        self.running = True
        
        # Start monitoring in a separate thread
        self.monitor_thread = threading.Thread(target=self._monitor_power, name="ShutdownMonitorThread")
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        
        # Registrar el thread en el sistema de control
        register_thread(self.monitor_thread)
        
        logger.info("Started shutdown monitoring")
        return True
        
    def stop_monitoring(self):
        """Stop monitoring for power loss"""
        if not self.running:
            logger.warning("Shutdown monitor is not running")
            return False
            
        self.running = False
        
        # Wait for thread to finish
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
            
        logger.info("Stopped shutdown monitoring")
        return True
        
    def _monitor_power(self):
        """Monitor for power loss and trigger shutdown when detected"""
        if self.mock_mode:
            # Mock mode - only for testing
            logger.info("Running shutdown monitor in mock mode")
            self._mock_monitor()
            return
            
        if self.gpio_lib == "RPi.GPIO":
            # Using RPi.GPIO library
            try:
                GPIO = self.GPIO
                
                # Set up GPIO pin
                GPIO.setmode(GPIO.BCM)
                GPIO.setup(self.gpio_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
                
                # Monitor pin state for enhanced shutdown
                while self.running:
                    current_state = GPIO.input(self.gpio_pin)
                    
                    # Detectar cambio de estado del botón
                    if current_state != self.last_button_state:
                        if current_state == GPIO.LOW and self.last_button_state == GPIO.HIGH:
                            # Botón presionado (falling edge)
                            logger.info("🔴 Botón de apagado presionado")
                            self.button_pressed = True
                            self.enhanced_shutdown.on_button_press()
                        elif current_state == GPIO.HIGH and self.last_button_state == GPIO.LOW:
                            # Botón liberado (rising edge)
                            logger.info("⬆️ Botón de apagado liberado")
                            self.button_pressed = False
                            self.enhanced_shutdown.on_button_release()
                        
                        self.last_button_state = current_state
                    
                    time.sleep(0.05)  # Polling más frecuente para mejor detección
                    
                # Clean up
                GPIO.cleanup()
                
            except Exception as e:
                logger.error(f"Error in GPIO monitoring: {str(e)}")
                
        elif self.gpio_lib == "gpiozero":
            # Using gpiozero library
            try:
                # Aseguramos que gpiozero se inicialice correctamente
                logger.info(f"Configurando gpiozero para monitorear pin {self.gpio_pin}")
                
                # Re-inicializar el botón si es necesario
                if not hasattr(self, 'power_button') or self.power_button is None:
                    from gpiozero import Button
                    self.power_button = Button(self.gpio_pin)
                
                # Set up pin monitoring with enhanced callbacks
                self.power_button.when_pressed = self._power_button_pressed
                self.power_button.when_released = self._power_button_released
                logger.info("Monitoreo con gpiozero configurado correctamente con callbacks mejorados")
                
                # Keep thread alive
                while self.running and should_continue_loop("shutdown_monitor"):
                    time.sleep(1)
                    
            except Exception as e:
                logger.error(f"Error in gpiozero monitoring: {str(e)}")
                # Si hay un error con gpiozero, volvemos al modo simulado
                self.mock_mode = True
                self._mock_monitor()
                
    def _power_button_pressed(self):
        """Callback para gpiozero cuando se presiona el botón (enhanced)"""
        logger.info("🔴 Botón de apagado presionado (gpiozero)")
        self.button_pressed = True
        self.enhanced_shutdown.on_button_press()
        
    def _power_button_released(self):
        """Callback para gpiozero cuando se libera el botón"""
        logger.info("⬆️ Botón de apagado liberado (gpiozero)")
        self.button_pressed = False
        self.enhanced_shutdown.on_button_release()
        
    def _mock_monitor(self):
        """Mock power monitoring for testing with enhanced shutdown"""
        logger.info("Mock power monitoring active. Use 'touch /tmp/trigger_shutdown' to simulate button press.")
        logger.info("Use 'touch /tmp/release_shutdown' to simulate button release.")
        
        button_pressed = False
        
        while self.running and should_continue_loop("shutdown_monitor"):
            # Check for button press trigger
            if os.path.exists("/tmp/trigger_shutdown") and not button_pressed:
                logger.info("🔴 Mock button press detected!")
                button_pressed = True
                self.enhanced_shutdown.on_button_press()
                
                # Remove trigger file
                try:
                    os.remove("/tmp/trigger_shutdown")
                except:
                    pass
            
            # Check for button release trigger
            if os.path.exists("/tmp/release_shutdown") and button_pressed:
                logger.info("⬆️ Mock button release detected!")
                button_pressed = False
                self.enhanced_shutdown.on_button_release()
                
                # Remove trigger file
                try:
                    os.remove("/tmp/release_shutdown")
                except:
                    pass
            
            # Check for immediate shutdown trigger (legacy)
            if os.path.exists("/tmp/trigger_immediate_shutdown"):
                logger.info("⚡ Mock immediate shutdown detected!")
                
                # Remove trigger file
                try:
                    os.remove("/tmp/trigger_immediate_shutdown")
                except:
                    pass
                    
                self.enhanced_shutdown.force_shutdown()
                break
                
            time.sleep(0.5)
            
    def _perform_shutdown(self):
        """Perform a safe system shutdown"""
        try:
            # Log shutdown
            logger.info("Performing safe shutdown...")
            
            # Stop current trip if trip manager is available
            self._stop_current_trip()
            
            # Execute shutdown command based on platform
            system = platform.system()
            
            if self.mock_mode:
                logger.info("MOCK SHUTDOWN: System would shut down now if not in mock mode")
                return
                
            if system == "Linux":
                # Linux shutdown command
                subprocess.call(["sudo", "shutdown", "-h", "now"])
            elif system == "Darwin":  # macOS
                subprocess.call(["sudo", "shutdown", "-h", "now"])
            elif system == "Windows":
                subprocess.call(["shutdown", "/s", "/t", "0"])
            else:
                logger.error(f"Unsupported platform for shutdown: {system}")
                
        except Exception as e:
            logger.error(f"Error performing shutdown: {str(e)}")
    
    def _stop_current_trip(self):
        """Stop the current trip before shutdown"""
        if not self.trip_manager:
            logger.warning("No trip manager available - skipping trip stop")
            return
            
        try:
            logger.info("Stopping current trip before shutdown...")
            
            # Check if there's an active trip
            active_trip = self.trip_manager.get_active_trip()
            if active_trip:
                logger.info(f"Found active trip (ID: {active_trip.id}) - ending it")
                trip_id = self.trip_manager.end_trip()
                if trip_id:
                    logger.info(f"Successfully ended trip {trip_id}")
                else:
                    logger.warning("Failed to end current trip")
            else:
                logger.info("No active trip found - nothing to stop")
                
        except Exception as e:
            logger.error(f"Error stopping current trip: {str(e)}")
            # Continue with shutdown even if trip stop fails
            
    def __del__(self):
        """Clean up resources"""
        self.stop_monitoring()
        
        # Additional cleanup for GPIO if using RPi.GPIO
        if self.gpio_lib == "RPi.GPIO" and hasattr(self, 'GPIO'):
            try:
                # Aseguramos primero que el modo esté configurado antes de limpiar
                if not hasattr(self.GPIO, '_mode') or self.GPIO._mode is None:
                    self.GPIO.setmode(self.GPIO.BCM)
                self.GPIO.cleanup()
            except Exception as e:
                logger.error(f"Error en la limpieza de GPIO: {str(e)}")
        
        # Para gpiozero, no es necesario hacer limpieza manual ya que lo hace automáticamente

    def stop(self):
        """Alias for stop_monitoring for API consistency"""
        logger.info("Stopping ShutdownMonitor")
        return self.stop_monitoring()