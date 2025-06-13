"""
Sistema de apagado mejorado con notificaciones de audio y visuales
"""
import time
import logging
import threading
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

class EnhancedShutdownManager:
    """Gestor de apagado mejorado con efectos de audio y LEDs"""
    
    def __init__(self, audio_notifier=None, led_controller=None, shutdown_controller=None, trip_manager=None):
        self.audio_notifier = audio_notifier
        self.led_controller = led_controller
        self.shutdown_controller = shutdown_controller
        self.trip_manager = trip_manager
        
        # Estado del proceso de apagado
        self.shutdown_in_progress = False
        self.button_press_start = None
        self.button_hold_threshold = 3.0  # Segundos que hay que mantener presionado
        
        # Thread para monitoreo del botón
        self.button_monitor_thread = None
        self.monitoring = False
        
        logger.info("🔧 EnhancedShutdownManager inicializado")
    
    def start_monitoring(self):
        """Iniciar el monitoreo mejorado del botón de apagado"""
        if self.monitoring:
            logger.warning("Enhanced shutdown monitoring ya está activo")
            return False
            
        self.monitoring = True
        logger.info("🔧 Iniciando monitoreo mejorado de apagado")
        return True
    
    def stop_monitoring(self):
        """Detener el monitoreo del botón de apagado"""
        self.monitoring = False
        logger.info("🔧 Deteniendo monitoreo mejorado de apagado")
    
    def on_button_press(self):
        """
        Manejar el evento de presión inicial del botón
        Reproduce un beep para confirmar la detección
        """
        if self.shutdown_in_progress:
            return
            
        logger.info("🔴 Botón de apagado presionado - reproduciendo beep de confirmación")
        
        # Reproducir beep de confirmación
        if self.audio_notifier:
            self.audio_notifier.beep(frequency=800, duration=0.1)
        
        # Registrar el tiempo de inicio de presión
        self.button_press_start = time.time()
        
        # Iniciar monitoreo de mantenimiento del botón
        self._start_hold_monitoring()
    
    def on_button_release(self):
        """
        Manejar el evento de liberación del botón
        Si no se mantuvo lo suficiente, cancelar el apagado
        """
        if not self.button_press_start or self.shutdown_in_progress:
            return
            
        hold_duration = time.time() - self.button_press_start
        logger.info(f"🔴 Botón liberado después de {hold_duration:.1f}s")
        
        if hold_duration < self.button_hold_threshold:
            logger.info("⏱️ Botón no mantenido lo suficiente - cancelando apagado")
            self._cancel_shutdown_sequence()
        
        self.button_press_start = None
    
    def _start_hold_monitoring(self):
        """Iniciar el monitoreo de mantenimiento del botón en un hilo separado"""
        if self.button_monitor_thread and self.button_monitor_thread.is_alive():
            return
            
        self.button_monitor_thread = threading.Thread(
            target=self._monitor_button_hold,
            name="ButtonHoldMonitor"
        )
        self.button_monitor_thread.daemon = True
        self.button_monitor_thread.start()
    
    def _monitor_button_hold(self):
        """
        Monitorear si el botón se mantiene presionado
        Activar secuencia de LEDs y proceder con apagado si se mantiene
        """
        if not self.button_press_start:
            return
            
        logger.info(f"🔍 Monitoreando mantenimiento del botón por {self.button_hold_threshold}s")
        
        # Esperar el tiempo de threshold mientras monitoreamos
        start_time = self.button_press_start
        led_step_duration = self.button_hold_threshold / 3  # Dividir en 3 pasos para 3 LEDs
        
        # Paso 1: Primer LED (rojo)
        time.sleep(led_step_duration)
        if not self._is_button_still_pressed():
            return
            
        logger.info("🔴 Activando primer LED (rojo)")
        self._activate_led(0, (255, 0, 0))  # Rojo
        
        # Paso 2: Segundo LED (amarillo)
        time.sleep(led_step_duration)
        if not self._is_button_still_pressed():
            return
            
        logger.info("🟡 Activando segundo LED (amarillo)")
        self._activate_led(1, (255, 255, 0))  # Amarillo
        
        # Paso 3: Tercer LED (verde)
        time.sleep(led_step_duration)
        if not self._is_button_still_pressed():
            return
            
        logger.info("🟢 Activando tercer LED (verde)")
        self._activate_led(2, (0, 255, 0))  # Verde
        
        # Si llegamos aquí, el botón se mantuvo presionado el tiempo suficiente
        logger.info("✅ Botón mantenido el tiempo suficiente - iniciando apagado")
        self._initiate_shutdown()
    
    def _is_button_still_pressed(self):
        """Verificar si el botón sigue presionado"""
        # En este contexto, si button_press_start es None, significa que el botón fue liberado
        return self.button_press_start is not None
    
    def _activate_led(self, led_index, color):
        """Activar un LED específico con un color"""
        if not self.led_controller:
            logger.warning("No hay controlador de LED disponible")
            return
            
        try:
            # Intentar importar y obtener la instancia del controlador
            from routes.mic_leds import LEDController
            led_controller = LEDController.get_instance()
            
            if not led_controller.initialized:
                led_controller.initialize()
            
            if led_controller.initialized:
                r, g, b = color
                led_controller.leds.set_pixel(led_index, int(r), int(g), int(b))
                led_controller.leds.show()
                logger.info(f"LED {led_index} activado con color {color}")
            else:
                logger.warning("No se pudo inicializar el controlador de LEDs")
                
        except Exception as e:
            logger.error(f"Error activando LED {led_index}: {e}")
    
    def _cancel_shutdown_sequence(self):
        """Cancelar la secuencia de apagado y apagar los LEDs"""
        logger.info("❌ Cancelando secuencia de apagado")
        
        # Apagar todos los LEDs
        try:
            from routes.mic_leds import LEDController
            led_controller = LEDController.get_instance()
            if led_controller.initialized:
                led_controller.set_color((0, 0, 0))  # Apagar todos
                logger.info("LEDs apagados")
        except Exception as e:
            logger.error(f"Error apagando LEDs: {e}")
        
        # Reproducir beep de cancelación
        if self.audio_notifier:
            self.audio_notifier.beep(frequency=400, duration=0.3)
    
    def _initiate_shutdown(self):
        """Iniciar el proceso de apagado completo"""
        if self.shutdown_in_progress:
            return
            
        self.shutdown_in_progress = True
        logger.info("🛑 INICIANDO PROCESO DE APAGADO MEJORADO")
        
        try:
            # 1. Anunciar por audio
            if self.audio_notifier:
                self.audio_notifier.announce(
                    "Iniciando apagado del sistema dashcam. Guardando datos...",
                    title="Apagado del Sistema",
                    notification_type="warning"
                )
            
            # 2. Mostrar secuencia de LEDs completa
            try:
                from routes.mic_leds import LEDController
                led_controller = LEDController.get_instance()
                if led_controller.initialized:
                    led_controller.shutdown_sequence(delay=0.5)
            except Exception as e:
                logger.error(f"Error en secuencia de LEDs: {e}")
            
            # 3. Detener trip actual si existe
            if self.trip_manager:
                try:
                    logger.info("🛑 Deteniendo trip actual...")
                    active_trip = self.trip_manager.get_active_trip()
                    if active_trip:
                        self.trip_manager.stop_trip()
                        if self.audio_notifier:
                            self.audio_notifier.announce("Trip actual guardado correctamente")
                except Exception as e:
                    logger.error(f"Error deteniendo trip: {e}")
            
            # 4. Dar tiempo para que se guarden los datos
            logger.info("⏳ Esperando finalización de guardado de datos...")
            time.sleep(2.0)
            
            # 5. Anunciar apagado final
            if self.audio_notifier:
                self.audio_notifier.announce(
                    "Sistema listo para apagar. Apagando en 3, 2, 1...",
                    title="Apagado Inminente",
                    notification_type="error"
                )
            
            # 6. Esperar a que termine el anuncio
            time.sleep(4.0)
            
            # 7. Activar el apagado del sistema a través del controlador estándar
            if self.shutdown_controller:
                logger.info("🔌 Activando apagado del sistema...")
                self.shutdown_controller.request_shutdown()
            
            # 8. Como último recurso, ejecutar apagado del sistema
            self._perform_system_shutdown()
            
        except Exception as e:
            logger.error(f"Error durante proceso de apagado: {e}")
            # Intentar apagado de emergencia
            if self.shutdown_controller:
                self.shutdown_controller.request_shutdown()
    
    def _perform_system_shutdown(self):
        """Ejecutar el apagado físico del sistema"""
        try:
            import subprocess
            import platform
            
            system = platform.system()
            logger.info(f"🔌 Ejecutando apagado del sistema ({system})")
            
            if system == "Linux":
                subprocess.call(["sudo", "shutdown", "-h", "now"])
            elif system == "Darwin":  # macOS
                subprocess.call(["sudo", "shutdown", "-h", "now"])
            elif system == "Windows":
                subprocess.call(["shutdown", "/s", "/t", "0"])
            else:
                logger.error(f"Sistema no soportado para apagado: {system}")
                
        except Exception as e:
            logger.error(f"Error ejecutando apagado del sistema: {e}")
    
    def force_shutdown(self):
        """Forzar apagado inmediato (para casos de emergencia)"""
        logger.warning("⚠️ APAGADO FORZADO ACTIVADO")
        
        if self.audio_notifier:
            self.audio_notifier.announce("Apagado de emergencia activado")
        
        # Esperar un momento para el anuncio
        time.sleep(1.5)
        
        # Activar apagado inmediato
        if self.shutdown_controller:
            self.shutdown_controller.request_shutdown()
        
        self._perform_system_shutdown()
