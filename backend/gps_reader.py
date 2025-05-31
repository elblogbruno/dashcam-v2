import serial
import time
import pynmea2
import threading
import logging
import queue
from datetime import datetime
from shutdown_control import should_continue_loop, register_thread

logger = logging.getLogger(__name__)

class GPSReader:
    def __init__(self, serial_port='/dev/ttyACM0', baud_rate=9600, use_gpsd=True):
        self.serial_port = serial_port
        self.baud_rate = baud_rate
        self.use_gpsd = use_gpsd
        self.gps_data = {
            'latitude': None,
            'longitude': None,
            'speed': None,
            'altitude': None,
            'timestamp': None,
            'satellites': None,
            'fix_quality': None,
            'heading': None,
            'last_update': None
        }
        self.running = False
        self.connected = False
        self.serial_device = None
        self.gpsd_socket = None
        self.update_thread = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 5  # segundos
        self.error_count = 0
        self.max_error_count = 10  # número máximo de errores antes de intentar reconectar
        self.error_reset_time = 60  # segundos para resetear contador de errores
        self.last_error_time = None
        self.read_timeout = 1.0  # timeout en segundos para lectura serial
        self.data_queue = queue.Queue(maxsize=10)  # cola para procesar datos GPS en thread separado
        
        self.initialize_gps()

    def initialize_gps(self):
        """Inicializa el GPS con el método preferido (gpsd o serial directo)"""
        if self.use_gpsd:
            self._init_gpsd()
        else:
            self._init_serial()
            
        # Iniciar hilo de actualización
        self.running = True
        self.update_thread = threading.Thread(target=self._update_loop)
        self.update_thread.daemon = True
        self.update_thread.start()
        register_thread(self.update_thread)
        
        # Iniciar hilo procesador de datos
        self.processor_thread = threading.Thread(target=self._process_data_loop)
        self.processor_thread.daemon = True
        self.processor_thread.start()
        register_thread(self.processor_thread)

    def _init_gpsd(self):
        """Inicializa conexión usando gpsd"""
        try:
            import gps
            self.gpsd_socket = gps.gps(mode=gps.WATCH_ENABLE)
            logger.info("Initialized GPS with gpsd")
            self.connected = True
            self.use_gpsd = True
        except (ImportError, ConnectionRefusedError) as e:
            logger.warning(f"gpsd not available, trying pyserial")
            self.use_gpsd = False
            self._init_serial()

    def _init_serial(self):
        """Inicializa conexión serial directa"""
        try:
            # Cerrar conexión anterior si existe
            self._close_serial()
            
            # Abrir nueva conexión con timeout
            self.serial_device = serial.Serial(
                self.serial_port, 
                self.baud_rate, 
                timeout=self.read_timeout
            )
            
            # Verificar si está abierto
            if self.serial_device.is_open:
                logger.info(f"Initialized GPS with pyserial on {self.serial_port}")
                self.connected = True
                # Pequeña pausa para estabilizar la conexión
                time.sleep(0.5)
                # Limpiar buffer de entrada
                self.serial_device.reset_input_buffer()
                self.reconnect_attempts = 0  # resetear contador de intentos
            else:
                logger.error(f"Failed to open {self.serial_port}")
                self.connected = False
                
        except Exception as e:
            logger.error(f"Error initializing GPS: {str(e)}")
            self.connected = False
            
            # Si ya hemos intentado el puerto principal, intentar puertos alternativos
            if self.reconnect_attempts >= 2 and self.serial_port == '/dev/ttyACM0':
                alternate_ports = ['/dev/ttyUSB0', '/dev/ttyS0', '/dev/ttyAMA0']
                for port in alternate_ports:
                    try:
                        logger.info(f"Trying alternate GPS port: {port}")
                        self.serial_port = port
                        self.serial_device = serial.Serial(port, self.baud_rate, timeout=self.read_timeout)
                        if self.serial_device.is_open:
                            logger.info(f"Connected to GPS on alternate port {port}")
                            self.connected = True
                            time.sleep(0.5)
                            self.serial_device.reset_input_buffer()
                            break
                    except Exception:
                        continue

    def _close_serial(self):
        """Cierra la conexión serial si está abierta"""
        if self.serial_device and hasattr(self.serial_device, 'is_open') and self.serial_device.is_open:
            try:
                self.serial_device.close()
                logger.debug("Closed serial GPS connection")
            except Exception as e:
                logger.error(f"Error closing serial connection: {str(e)}")

    def _update_loop(self):
        """Hilo principal de actualización de datos GPS"""
        logger.info("GPS update loop started")
        while should_continue_loop("gps_update"):
            try:
                if not self.connected:
                    self._attempt_reconnect()
                    time.sleep(1)
                    continue
                    
                if self.use_gpsd and self.gpsd_socket:
                    self._read_gpsd()
                elif self.serial_device:
                    self._read_serial()
                else:
                    time.sleep(0.5)
                    
            except Exception as e:
                logger.error(f"Error in GPS update loop: {str(e)}")
                self._handle_error()
                time.sleep(1)
        
        logger.info("GPS update loop terminated")

    def _process_data_loop(self):
        """Hilo separado para procesar datos GPS"""
        logger.info("GPS data processing loop started")
        while should_continue_loop("gps_processor"):
            try:
                # Consumir de la cola con timeout para no bloquear
                try:
                    data = self.data_queue.get(timeout=1.0)
                    self._parse_nmea(data)
                    self.data_queue.task_done()
                except queue.Empty:
                    # No hay datos a procesar, continuar
                    pass
            except Exception as e:
                logger.error(f"Error in GPS data processing: {str(e)}")
                time.sleep(0.5)
        
        logger.info("GPS data processing loop terminated")

    def _read_gpsd(self):
        """Lee datos desde gpsd"""
        try:
            self.gpsd_socket.next()
            if hasattr(self.gpsd_socket, 'fix') and hasattr(self.gpsd_socket.fix, 'mode') and self.gpsd_socket.fix.mode > 1:
                # Tenemos un fix GPS
                self.gps_data['latitude'] = self.gpsd_socket.fix.latitude
                self.gps_data['longitude'] = self.gpsd_socket.fix.longitude
                self.gps_data['altitude'] = self.gpsd_socket.fix.altitude
                self.gps_data['speed'] = self.gpsd_socket.fix.speed * 3.6  # m/s a km/h
                self.gps_data['heading'] = self.gpsd_socket.fix.track
                self.gps_data['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self.gps_data['last_update'] = time.time()
                
                if hasattr(self.gpsd_socket, 'satellites') and self.gpsd_socket.satellites:
                    # Contar satélites usados
                    self.gps_data['satellites'] = sum(1 for sat in self.gpsd_socket.satellites if sat.used)
                
                self.gps_data['fix_quality'] = self.gpsd_socket.fix.mode
            
            # Pequeña pausa para no saturar CPU
            time.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error reading from GPSD: {str(e)}")
            self._handle_error()

    def _read_serial(self):
        """Lee datos seriales directamente con manejo de errores mejorado"""
        if not self.serial_device or not hasattr(self.serial_device, 'is_open') or not self.serial_device.is_open:
            logger.debug("Serial device not available for reading")
            self.connected = False
            return
            
        try:
            # Leer una línea con timeout
            line = self.serial_device.readline().decode('ascii', errors='replace').strip()
            
            # Verificar si recibimos datos
            if line:
                # Recibimos datos, resetear contador de errores
                self.error_count = 0
                self.last_error_time = None
                
                # Poner en la cola para procesamiento en otro hilo
                try:
                    self.data_queue.put_nowait(line)
                except queue.Full:
                    # La cola está llena, descartar datos más antiguos
                    try:
                        _ = self.data_queue.get_nowait()
                        self.data_queue.put_nowait(line)
                    except:
                        pass
            else:
                # Si no hay datos disponibles, usar manejo de errores silencioso
                self._handle_no_data_error()
                
        except serial.SerialException as e:
            # Error serio con el puerto serial, necesita reconexión
            error_msg = str(e)
            if "device reports readiness" in error_msg:
                self._handle_no_data_error()
            else:
                logger.error(f"Error reading from serial GPS: {error_msg}")
                self._handle_error()
                time.sleep(0.5)
        except Exception as e:
            logger.error(f"Unexpected error reading from serial GPS: {str(e)}")
            self._handle_error()
            time.sleep(0.5)
    
    def _handle_no_data_error(self):
        """Maneja errores específicos de 'no data available' para reducir spam en logs"""
        now = time.time()
        
        # Incrementar contador de errores
        self.error_count += 1
        
        # Limitar los mensajes a uno cada 60 segundos para no llenar los logs
        if self.last_error_time is None or now - self.last_error_time > 60:
            logger.warning(f"No data received from GPS (count: {self.error_count})")
            self.last_error_time = now
            
        # Si hay demasiados errores, intentar reconectar
        if self.error_count >= self.max_error_count:
            logger.warning(f"Too many GPS read errors ({self.error_count}), attempting reconnection")
            self.connected = False
            self.error_count = 0
            self._close_serial()  # Cerrar correctamente antes de reconectar

    def _parse_nmea(self, nmea_str):
        """Procesa sentencias NMEA"""
        if not nmea_str.startswith('$'):
            return
            
        try:
            # Parse NMEA sentence
            msg = pynmea2.parse(nmea_str)
            
            # GGA - Posición y fix
            if isinstance(msg, pynmea2.GGA):
                if msg.latitude and msg.longitude:
                    self.gps_data['latitude'] = msg.latitude
                    self.gps_data['longitude'] = msg.longitude
                    self.gps_data['altitude'] = msg.altitude
                    self.gps_data['fix_quality'] = msg.gps_qual
                    self.gps_data['satellites'] = msg.num_sats
                    self.gps_data['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    self.gps_data['last_update'] = time.time()
                    
            # RMC - Velocidad y rumbo
            elif isinstance(msg, pynmea2.RMC):
                if msg.status == 'A':  # A = active
                    if msg.latitude and msg.longitude:
                        self.gps_data['latitude'] = msg.latitude
                        self.gps_data['longitude'] = msg.longitude
                    self.gps_data['speed'] = msg.spd_over_grnd * 1.852  # knots a km/h
                    self.gps_data['heading'] = msg.true_course
                    self.gps_data['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    self.gps_data['last_update'] = time.time()
                    
            # VTG - Velocidad y rumbo alternativo
            elif isinstance(msg, pynmea2.VTG):
                if msg.spd_over_grnd_kmph:
                    self.gps_data['speed'] = msg.spd_over_grnd_kmph
                if msg.true_track:
                    self.gps_data['heading'] = msg.true_track
                
            # GSA - Satélites y precisión
            elif isinstance(msg, pynmea2.GSA):
                if msg.mode_fix_type:
                    self.gps_data['fix_quality'] = msg.mode_fix_type
                    
        except pynmea2.ParseError:
            # Ignora sentencias NMEA malformadas
            pass
        except Exception as e:
            logger.debug(f"Error parsing NMEA: {str(e)}")

    def _handle_error(self, is_critical=False):
        """Maneja los errores incrementando contadores y registrando eventos"""
        if self.last_error_time is None or time.time() - self.last_error_time > 30:
            # Registrar errores con un límite de frecuencia para no saturar los logs
            if is_critical:
                logger.error(f"GPS error crítico. Intentando reconectar...")
            self.last_error_time = time.time()
            
        self.error_count += 1
        
        # Si hay demasiados errores consecutivos, intentar reiniciar
        if self.error_count > 15:
            logger.warning(f"Detectados {self.error_count} errores consecutivos de GPS. Reiniciando conexión...")
            self.error_count = 0  # Reiniciar contador
            self._close_serial()
            time.sleep(2)
            self._init_serial()

    def _attempt_reconnect(self):
        """Intenta reconectar al GPS"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            if self.reconnect_attempts == self.max_reconnect_attempts:
                logger.error(f"Failed to reconnect to GPS after {self.reconnect_attempts} attempts.")
                self.reconnect_attempts += 1  # incrementar para no mostrar este mensaje repetidamente
            # Esperar antes de intentar nuevamente
            time.sleep(self.reconnect_delay)
            return
            
        logger.info(f"Attempting to reconnect to GPS (attempt {self.reconnect_attempts + 1}/{self.max_reconnect_attempts})")
        self.reconnect_attempts += 1
        
        # Reintentar con el método actual
        if self.use_gpsd:
            self._init_gpsd()
        else:
            self._init_serial()
            
        # Esperar antes de verificar si fue exitoso
        time.sleep(self.reconnect_delay)

    def get_location(self):
        """Devuelve los datos actuales de localización"""
        # Verificar si los datos son recientes (< 10 segundos)
        if self.gps_data['last_update'] and time.time() - self.gps_data['last_update'] < 10:
            return {
                'latitude': self.gps_data['latitude'],
                'longitude': self.gps_data['longitude'],
                'altitude': self.gps_data['altitude'],
                'speed': self.gps_data['speed'],
                'heading': self.gps_data['heading'],
                'satellites': self.gps_data['satellites'],
                'fix_quality': self.gps_data['fix_quality'],
                'timestamp': self.gps_data['timestamp'],
                'status': 'active' if self.connected else 'inactive'
            }
        else:
            # Datos no actualizados, posiblemente GPS sin señal
            return {
                'latitude': self.gps_data['latitude'],
                'longitude': self.gps_data['longitude'],
                'altitude': self.gps_data['altitude'],
                'speed': self.gps_data['speed'],
                'heading': self.gps_data['heading'],
                'satellites': self.gps_data['satellites'],
                'fix_quality': self.gps_data['fix_quality'],
                'timestamp': self.gps_data['timestamp'],
                'status': 'stale' if self.connected else 'inactive'
            }

    def shutdown(self):
        """Detener y limpiar recursos"""
        self.running = False
        
        # Esperar a que los hilos terminen
        if self.update_thread and self.update_thread.is_alive():
            self.update_thread.join(timeout=2.0)
            
        if self.processor_thread and self.processor_thread.is_alive():
            self.processor_thread.join(timeout=2.0)
            
        # Cerrar conexión serial
        self._close_serial()
        
        # Cerrar conexión gpsd
        if self.gpsd_socket:
            self.gpsd_socket = None
        
        logger.info("GPS reader shutdown completed")