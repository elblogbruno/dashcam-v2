import time
import threading
import logging
import json
import math
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GPSReader:
    def __init__(self):
        self.current_location = {"lat": 0.0, "lon": 0.0, "speed": 0, "timestamp": None}
        self.gps_device = None
        self.running = False
        self.gps_thread = None
        self.gps_history = []  # Store recent GPS points for path tracking
        self.max_history_size = 100  # Keep last 100 points
        
        # Try to initialize GPS
        self.initialize_gps()
        
    def initialize_gps(self):
        """Initialize GPS device using available libraries"""
        try:
            # Try to initialize with gpsd first
            try:
                import gps
                self.gps_device = gps.gps(mode=gps.WATCH_ENABLE)
                logger.info("Initialized GPS with gpsd")
                # Start reading thread
                self._start_gpsd_thread()
                return
            except (ImportError, ModuleNotFoundError):
                logger.warning("gpsd not available, trying pyserial")
                
            # Try with pyserial
            try:
                import serial
                # Common GPS device paths
                device_paths = ['/dev/ttyUSB0', '/dev/ttyACM0', '/dev/ttyS0']
                
                for path in device_paths:
                    try:
                        self.gps_device = serial.Serial(path, 9600, timeout=1)
                        logger.info(f"Initialized GPS with pyserial on {path}")
                        # Start reading thread
                        self._start_serial_thread()
                        return
                    except serial.SerialException:
                        continue
                        
                logger.warning("No GPS device found. Using mock GPS data for testing.")
                self._start_mock_gps_thread()
                
            except (ImportError, ModuleNotFoundError):
                logger.warning("pyserial not available, using mock GPS data")
                self._start_mock_gps_thread()
                
        except Exception as e:
            logger.error(f"GPS initialization error: {str(e)}")
            self._start_mock_gps_thread()
            
    def _start_gpsd_thread(self):
        """Start a thread to read GPS data using gpsd"""
        self.running = True
        self.gps_thread = threading.Thread(target=self._read_gpsd_data)
        self.gps_thread.daemon = True
        self.gps_thread.start()
        
    def _start_serial_thread(self):
        """Start a thread to read GPS data from serial port"""
        self.running = True
        self.gps_thread = threading.Thread(target=self._read_serial_data)
        self.gps_thread.daemon = True
        self.gps_thread.start()
        
    def _start_mock_gps_thread(self):
        """Start a thread to generate mock GPS data for testing"""
        self.running = True
        self.gps_thread = threading.Thread(target=self._generate_mock_data)
        self.gps_thread.daemon = True
        self.gps_thread.start()
        
    def _read_gpsd_data(self):
        """Read data from gpsd in a loop"""
        import gps
        while self.running:
            try:
                report = self.gps_device.next()
                if report['class'] == 'TPV':
                    # Got a Time-Position-Velocity report
                    if hasattr(report, 'lat') and hasattr(report, 'lon'):
                        self.current_location = {
                            "lat": report.lat,
                            "lon": report.lon,
                            "speed": getattr(report, 'speed', 0) * 3.6,  # Convert m/s to km/h
                            "timestamp": datetime.now().isoformat()
                        }
                        self._update_gps_history()
            except Exception as e:
                logger.error(f"Error reading from gpsd: {str(e)}")
                time.sleep(1)
                
    def _read_serial_data(self):
        """Read NMEA sentences from serial port"""
        while self.running and self.gps_device:
            try:
                line = self.gps_device.readline().decode('ascii', errors='replace').strip()
                
                # Process NMEA sentences
                if line.startswith('$GPRMC'):
                    # Recommended Minimum data
                    parts = line.split(',')
                    if len(parts) >= 10 and parts[2] == 'A':  # A = data valid
                        # Parse latitude
                        lat_deg = float(parts[3][:2])
                        lat_min = float(parts[3][2:])
                        lat = lat_deg + (lat_min / 60.0)
                        if parts[4] == 'S':
                            lat = -lat
                            
                        # Parse longitude
                        lon_deg = float(parts[5][:3])
                        lon_min = float(parts[5][3:])
                        lon = lon_deg + (lon_min / 60.0)
                        if parts[6] == 'W':
                            lon = -lon
                            
                        # Parse speed (in knots, convert to km/h)
                        speed = float(parts[7]) * 1.852 if parts[7] else 0
                        
                        self.current_location = {
                            "lat": lat,
                            "lon": lon,
                            "speed": speed,
                            "timestamp": datetime.now().isoformat()
                        }
                        self._update_gps_history()
                        
            except Exception as e:
                logger.error(f"Error reading from serial GPS: {str(e)}")
                time.sleep(1)
                
    def _generate_mock_data(self):
        """Generate mock GPS data for testing"""
        # Starting point (near Grand Canyon)
        lat = 36.1
        lon = -112.1
        speed = 60.0  # km/h
        
        # Movement deltas
        delta_lat = 0.0001  # Approximately 11 meters North-South
        delta_lon = 0.0001  # Varies based on latitude
        
        while self.running:
            # Add small random movement
            import random
            lat += delta_lat * (random.random() - 0.5)
            lon += delta_lon * (random.random() - 0.5)
            speed = max(0, min(120, speed + (random.random() - 0.5) * 5))  # Random speed changes
            
            self.current_location = {
                "lat": lat,
                "lon": lon,
                "speed": speed,
                "timestamp": datetime.now().isoformat()
            }
            
            self._update_gps_history()
            time.sleep(1)  # Update once per second
            
    def _update_gps_history(self):
        """Add current location to history and trim if needed"""
        self.gps_history.append(self.current_location.copy())
        
        # Keep history limited to max size
        if len(self.gps_history) > self.max_history_size:
            self.gps_history = self.gps_history[-self.max_history_size:]
            
    def get_location(self):
        """Get current GPS location"""
        return self.current_location
        
    def get_path_history(self):
        """Get recent path history for tracking"""
        return self.gps_history
        
    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two coordinates in meters using Haversine formula"""
        # Earth radius in meters
        R = 6371000
        
        # Convert coordinates to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Differences
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        # Haversine formula
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        
        return distance
        
    def save_gps_data(self, output_file):
        """Save current GPS history to a file"""
        with open(output_file, 'w') as f:
            json.dump(self.gps_history, f)
            
    def __del__(self):
        """Clean up resources"""
        self.running = False
        
        # Close serial device if using pyserial
        if self.gps_device and hasattr(self.gps_device, 'close'):
            self.gps_device.close()