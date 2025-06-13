"""
Disk Space Monitor Module
Monitors disk space usage and controls LEDs based on free space percentage.
Uses the existing LED controller from routes/mic_leds.py
"""

import logging
import threading
import time
import shutil
import os
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('disk_space_monitor')

class DiskSpaceMonitor:
    """
    Monitors disk space and controls 3 LEDs based on free space percentage:
    - LED 0 (Green): 70%+ free space
    - LED 1 (Yellow): 30-70% free space  
    - LED 2 (Red): <30% free space
    
    When space is very low (<10%), all LEDs flash red as a warning.
    """
    
    def __init__(self, 
                 data_path: str = None,
                 check_interval: int = 30,
                 enable_leds: bool = True):
        """
        Initialize the disk space monitor.
        
        Args:
            data_path: Path to monitor for disk space. If None, uses current working directory.
            check_interval: Seconds between disk space checks (default: 30)
            enable_leds: Whether to control LEDs (default: True)
        """
        self.data_path = data_path or os.getcwd()
        self.check_interval = check_interval
        self.enable_leds = enable_leds
        
        # Threading control
        self._stop_event = threading.Event()
        self._monitor_thread: Optional[threading.Thread] = None
        self._running = False
        
        # LED controller instance
        self._led_controller = None
        
        # Current status
        self.last_status = {
            'free_space_percent': 0,
            'free_space_bytes': 0,
            'total_space_bytes': 0,
            'used_space_bytes': 0,
            'led_status': 'unknown',
            'timestamp': None
        }
        
        # LED thresholds (percentage of free space)
        self.thresholds = {
            'critical': 10,  # <10% free - flash all red
            'low': 30,       # <30% free - red LED
            'medium': 70     # <70% free - yellow LED, >70% - green LED
        }
        
        logger.info(f"DiskSpaceMonitor initialized for path: {self.data_path}")
        logger.info(f"Check interval: {self.check_interval} seconds")
        logger.info(f"LED control enabled: {self.enable_leds}")
        
    def _get_led_controller(self):
        """Get LED controller instance."""
        if self._led_controller is None and self.enable_leds:
            try:
                from routes.mic_leds import LEDController
                self._led_controller = LEDController.get_instance()
                
                # Initialize if not already done
                if not self._led_controller.initialized:
                    success = self._led_controller.initialize()
                    if not success:
                        logger.error("Failed to initialize LED controller")
                        self._led_controller = None
                        return None
                        
                logger.info("LED controller initialized successfully")
            except Exception as e:
                logger.error(f"Error getting LED controller: {e}")
                self._led_controller = None
                
        return self._led_controller
    
    def get_disk_usage(self) -> Dict[str, Any]:
        """
        Get current disk usage information.
        
        Returns:
            Dictionary with disk usage stats
        """
        try:
            usage = shutil.disk_usage(self.data_path)
            
            total = usage.total
            used = usage.used
            free = usage.free
            free_percent = (free / total * 100) if total > 0 else 0
            used_percent = (used / total * 100) if total > 0 else 0
            
            return {
                'total_bytes': total,
                'used_bytes': used,
                'free_bytes': free,
                'free_percent': free_percent,
                'used_percent': used_percent,
                'path': self.data_path,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting disk usage: {e}")
            return {
                'total_bytes': 0,
                'used_bytes': 0,
                'free_bytes': 0,
                'free_percent': 0,
                'used_percent': 0,
                'path': self.data_path,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _determine_led_status(self, free_percent: float) -> str:
        """
        Determine LED status based on free space percentage.
        
        Args:
            free_percent: Percentage of free space (0-100)
            
        Returns:
            LED status string
        """
        if free_percent < self.thresholds['critical']:
            return 'critical'  # <10% - flash all red
        elif free_percent < self.thresholds['low']:
            return 'low'       # <30% - red LED
        elif free_percent < self.thresholds['medium']:
            return 'medium'    # <70% - yellow LED
        else:
            return 'good'      # >70% - green LED
    
    def _update_leds(self, led_status: str):
        """
        Update LED colors based on status.
        
        Args:
            led_status: LED status ('critical', 'low', 'medium', 'good')
        """
        if not self.enable_leds:
            return
            
        led_controller = self._get_led_controller()
        if not led_controller:
            return
            
        try:
            # Stop any running animations first
            led_controller.stop_animation_if_running()
            
            if led_status == 'critical':
                # Flash all LEDs red for critical warning
                logger.info("CRITICAL: Very low disk space - flashing all LEDs red")
                logger.debug("Starting blink animation with red color (255, 0, 0)")
                led_controller.start_animation(
                    'blink', 
                    color=(255, 0, 0),  # Red as tuple
                    count=999,  # Nearly infinite
                    on_time=0.5,
                    off_time=0.5
                )
                
            elif led_status == 'low':
                # Light up LED 2 (red) only
                logger.info("LOW: Low disk space - lighting red LED")
                led_controller.set_color((0, 0, 0), 0)     # LED 0 off
                led_controller.set_color((0, 0, 0), 1)     # LED 1 off  
                led_controller.set_color((255, 0, 0), 2)   # LED 2 red
                
            elif led_status == 'medium':
                # Light up LED 1 (yellow) only
                logger.info("MEDIUM: Medium disk space - lighting yellow LED")
                led_controller.set_color((0, 0, 0), 0)       # LED 0 off
                led_controller.set_color((255, 255, 0), 1)   # LED 1 yellow
                led_controller.set_color((0, 0, 0), 2)       # LED 2 off
                
            elif led_status == 'good':
                # Light up LED 0 (green) only
                logger.info("GOOD: Good disk space - lighting green LED")
                led_controller.set_color((0, 255, 0), 0)   # LED 0 green
                led_controller.set_color((0, 0, 0), 1)     # LED 1 off
                led_controller.set_color((0, 0, 0), 2)     # LED 2 off
                
        except Exception as e:
            logger.error(f"Error updating LEDs: {e}")
    
    def _monitor_loop(self):
        """Main monitoring loop that runs in a separate thread."""
        logger.info("Disk space monitoring started")
        
        while not self._stop_event.is_set():
            try:
                # Get current disk usage
                usage = self.get_disk_usage()
                free_percent = usage['free_percent']
                
                # Determine LED status
                led_status = self._determine_led_status(free_percent)
                
                # Update status
                self.last_status = {
                    'free_space_percent': free_percent,
                    'free_space_bytes': usage['free_bytes'],
                    'total_space_bytes': usage['total_bytes'],
                    'used_space_bytes': usage['used_bytes'],
                    'led_status': led_status,
                    'timestamp': usage['timestamp']
                }
                
                # Update LEDs if status changed
                if led_status != getattr(self, '_last_led_status', None):
                    logger.info(f"Disk space: {free_percent:.1f}% free - Status: {led_status}")
                    self._update_leds(led_status)
                    self._last_led_status = led_status
                
                # Log periodic status
                if hasattr(self, '_last_log_time'):
                    if (datetime.now() - self._last_log_time).total_seconds() > 300:  # Every 5 minutes
                        logger.info(f"Disk space status: {free_percent:.1f}% free ({self._format_bytes(usage['free_bytes'])} / {self._format_bytes(usage['total_bytes'])})")
                        self._last_log_time = datetime.now()
                else:
                    self._last_log_time = datetime.now()
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
            
            # Wait for next check or stop signal
            self._stop_event.wait(self.check_interval)
            
        logger.info("Disk space monitoring stopped")
    
    def _format_bytes(self, bytes_value: int) -> str:
        """Format bytes to human readable string."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_value < 1024.0:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024.0
        return f"{bytes_value:.1f} PB"
    
    def start(self):
        """Start the disk space monitoring."""
        if self._running:
            logger.warning("Disk space monitor is already running")
            return
            
        logger.info("Starting disk space monitor...")
        
        # Reset stop event
        self._stop_event.clear()
        
        # Start monitoring thread
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            name="DiskSpaceMonitor",
            daemon=True
        )
        self._monitor_thread.start()
        self._running = True
        
        logger.info("Disk space monitor started successfully")
    
    def stop(self):
        """Stop the disk space monitoring."""
        if not self._running:
            logger.warning("Disk space monitor is not running")
            return
            
        logger.info("Stopping disk space monitor...")
        
        # Signal stop
        self._stop_event.set()
        
        # Wait for thread to finish
        if self._monitor_thread and self._monitor_thread.is_alive():
            self._monitor_thread.join(timeout=5.0)
            
        self._running = False
        
        # Turn off LEDs when stopping
        if self.enable_leds and self._led_controller:
            try:
                self._led_controller.stop_animation_if_running()
                self._led_controller.set_color((0, 0, 0))  # Turn off all LEDs
                logger.info("LEDs turned off")
            except Exception as e:
                logger.error(f"Error turning off LEDs: {e}")
        
        logger.info("Disk space monitor stopped successfully")
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get current monitoring status.
        
        Returns:
            Dictionary with current status information
        """
        return {
            'running': self._running,
            'enable_leds': self.enable_leds,
            'check_interval': self.check_interval,
            'data_path': self.data_path,
            'thresholds': self.thresholds,
            'last_status': self.last_status.copy(),
            'led_controller_available': self._get_led_controller() is not None
        }
    
    def update_thresholds(self, critical: int = None, low: int = None, medium: int = None):
        """
        Update LED thresholds.
        
        Args:
            critical: Critical threshold percentage (default: 10)
            low: Low threshold percentage (default: 30)
            medium: Medium threshold percentage (default: 70)
        """
        if critical is not None:
            self.thresholds['critical'] = max(0, min(100, critical))
        if low is not None:
            self.thresholds['low'] = max(0, min(100, low))
        if medium is not None:
            self.thresholds['medium'] = max(0, min(100, medium))
            
        logger.info(f"Updated thresholds: {self.thresholds}")
    
    def test_leds(self):
        """Test all LED states for demonstration."""
        if not self.enable_leds:
            logger.warning("LED control is disabled")
            return
            
        logger.info("Testing LED states...")
        
        led_controller = self._get_led_controller()
        if not led_controller:
            logger.error("LED controller not available for testing")
            return
            
        try:
            # Test each state
            states = [
                ('good', 'Green LED (good disk space)'),
                ('medium', 'Yellow LED (medium disk space)'),
                ('low', 'Red LED (low disk space)'),
                ('critical', 'Flashing red LEDs (critical disk space)')
            ]
            
            for state, description in states:
                logger.info(f"Testing: {description}")
                self._update_leds(state)
                time.sleep(3)
                
            # Turn off all LEDs at the end
            led_controller.set_color((0, 0, 0))
            logger.info("LED test completed")
            
        except Exception as e:
            logger.error(f"Error during LED test: {e}")
    
    def __del__(self):
        """Cleanup when object is destroyed."""
        if self._running:
            self.stop()


# Global instance for the application
_disk_space_monitor: Optional[DiskSpaceMonitor] = None

def get_disk_space_monitor(data_path: str = None, 
                          check_interval: int = 30,
                          enable_leds: bool = True) -> DiskSpaceMonitor:
    """
    Get or create the global disk space monitor instance.
    
    Args:
        data_path: Path to monitor for disk space
        check_interval: Seconds between checks
        enable_leds: Whether to control LEDs
        
    Returns:
        DiskSpaceMonitor instance
    """
    global _disk_space_monitor
    
    if _disk_space_monitor is None:
        _disk_space_monitor = DiskSpaceMonitor(
            data_path=data_path,
            check_interval=check_interval,
            enable_leds=enable_leds
        )
    
    return _disk_space_monitor

def cleanup_disk_space_monitor():
    """Cleanup the global disk space monitor."""
    global _disk_space_monitor
    
    if _disk_space_monitor:
        _disk_space_monitor.stop()
        _disk_space_monitor = None
