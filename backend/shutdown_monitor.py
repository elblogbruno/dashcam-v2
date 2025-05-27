import os
import time
import logging
import threading
import subprocess
import platform

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ShutdownMonitor:
    def __init__(self, gpio_pin=17):
        self.gpio_pin = gpio_pin  # Default GPIO pin for power monitoring
        self.running = False
        self.monitor_thread = None
        self.mock_mode = False
        
        # Check platform and GPIO library availability
        self._check_platform()
        
    def _check_platform(self):
        """Check platform and available GPIO libraries"""
        system = platform.system()
        
        if system == "Linux":
            # Check for Raspberry Pi and GPIO libraries
            try:
                # Try to import RPi.GPIO first
                import RPi.GPIO as GPIO
                self.gpio_lib = "RPi.GPIO"
                self.GPIO = GPIO
                logger.info("Using RPi.GPIO for shutdown monitoring")
                return
            except (ImportError, ModuleNotFoundError):
                try:
                    # Try gpiozero as alternative
                    from gpiozero import Button
                    self.gpio_lib = "gpiozero"
                    self.power_button = Button(self.gpio_pin)
                    logger.info("Using gpiozero for shutdown monitoring")
                    return
                except (ImportError, ModuleNotFoundError):
                    logger.warning("No GPIO library found. Using mock mode for shutdown monitoring.")
        
        # If we get here, no GPIO library is available or not on Linux
        self.gpio_lib = None
        self.mock_mode = True
        logger.warning(f"No GPIO support on {system}. Using mock shutdown monitoring mode.")
        
    def start_monitoring(self):
        """Start monitoring for power loss"""
        if self.running:
            logger.warning("Shutdown monitor is already running")
            return False
            
        self.running = True
        
        # Start monitoring in a separate thread
        self.monitor_thread = threading.Thread(target=self._monitor_power)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        
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
                
                # Monitor pin state
                while self.running:
                    if GPIO.input(self.gpio_pin) == GPIO.LOW:
                        # Power loss detected
                        logger.info("Power loss detected! Triggering safe shutdown...")
                        self._perform_shutdown()
                        break
                    
                    time.sleep(0.1)
                    
                # Clean up
                GPIO.cleanup()
                
            except Exception as e:
                logger.error(f"Error in GPIO monitoring: {str(e)}")
                
        elif self.gpio_lib == "gpiozero":
            # Using gpiozero library
            try:
                # Set up pin monitoring with callback
                self.power_button.when_pressed = self._power_button_pressed
                
                # Keep thread alive
                while self.running:
                    time.sleep(1)
                    
            except Exception as e:
                logger.error(f"Error in gpiozero monitoring: {str(e)}")
                
    def _power_button_pressed(self):
        """Callback for gpiozero when power button is pressed (power loss)"""
        logger.info("Power loss detected via gpiozero! Triggering safe shutdown...")
        self._perform_shutdown()
        
    def _mock_monitor(self):
        """Mock power monitoring for testing"""
        logger.info("Mock power monitoring active. Use 'touch /tmp/trigger_shutdown' to simulate power loss.")
        
        while self.running:
            # Check for existence of trigger file
            if os.path.exists("/tmp/trigger_shutdown"):
                logger.info("Mock power loss detected! Triggering safe shutdown...")
                
                # Remove trigger file
                try:
                    os.remove("/tmp/trigger_shutdown")
                except:
                    pass
                    
                self._perform_shutdown()
                break
                
            time.sleep(1)
            
    def _perform_shutdown(self):
        """Perform a safe system shutdown"""
        try:
            # Log shutdown
            logger.info("Performing safe shutdown...")
            
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
            
    def __del__(self):
        """Clean up resources"""
        self.stop_monitoring()
        
        # Additional cleanup for GPIO if using RPi.GPIO
        if hasattr(self, 'GPIO') and self.gpio_lib == "RPi.GPIO":
            try:
                self.GPIO.cleanup()
            except:
                pass

    def stop(self):
        """Alias for stop_monitoring for API consistency"""
        logger.info("Stopping ShutdownMonitor")
        return self.stop_monitoring()