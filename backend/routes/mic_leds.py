from fastapi import APIRouter, HTTPException
import subprocess
import logging
import threading
import time
import json
from typing import Dict, List, Optional
import os

 
router = APIRouter()

# Configurar logging adecuado
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

 
try:
    # Configurar entorno gpiozero antes de importar
    os.environ['GPIOZERO_PIN_FACTORY'] = 'native'
    
    import gpiozero
    import spidev
    import gc
    logger.info("LED Controller running in HARDWARE MODE with native pin factory")
except ImportError as e:
    logger.warning(f"Failed to import hardware libraries: {e}")
    gpiozero = None
    spidev = None
 

# Configuración de LED para ReSpeaker 2mic HAT
NUM_LEDS = 3
LEDS_GPIO = 12
RGB_MAP = {
    "rgb": [3, 2, 1],
    "rbg": [3, 1, 2],
    "grb": [2, 3, 1],
    "gbr": [2, 1, 3],
    "brg": [1, 3, 2],
    "bgr": [1, 2, 3],
}

# Colores predefinidos
COLORS = {
    "black": (0, 0, 0),
    "white": (255, 255, 255),
    "red": (255, 0, 0),
    "green": (0, 255, 0),
    "blue": (0, 0, 255),
    "yellow": (255, 255, 0),
    "purple": (128, 0, 128),
    "orange": (255, 165, 0),
    "pink": (255, 192, 203),
    "teal": (0, 128, 128),
}

# Singleton para el controlador de LED
class LEDController:
    _instance = None
    _lock = threading.Lock()
    
    @staticmethod
    def get_instance():
        with LEDController._lock:
            if LEDController._instance is None:
                LEDController._instance = LEDController()
            return LEDController._instance
    
    def __init__(self):
        self.led_power = None
        self.leds = None
        self.animation_thread = None
        self.stop_animation = threading.Event()
        self.running_animation = None
        self.initialized = False
        
    def initialize(self, brightness=31):
        """Inicializar el controlador de LEDs"""
        # Si ya está inicializado, limpiar primero para evitar errores de pin en uso
        if self.initialized:
            self.cleanup()
        
        try:
            # Verificar y configurar pin factory
            from gpiozero import Device
            current_factory = str(Device.pin_factory)
            logger.info(f"Usando pin factory: {current_factory}")
            
            # Modo de hardware real
            logger.info(f"Initializing real LED controller with brightness {brightness}")
            # Encender alimentación a los LEDs
            self.led_power = gpiozero.LED(LEDS_GPIO, active_high=False)
            self.led_power.on()
            
            # Inicializar controlador APA102
            self.leds = APA102(num_led=NUM_LEDS, global_brightness=brightness)
            
            self.initialized = True
            return True
        except Exception as e:
            logger.error(f"Error inicializando LEDs: {e}", exc_info=True)
            return False
    
    def cleanup(self):
        """Limpiar y apagar los LEDs"""
        if not self.initialized:
            return
        
        logger.info("Iniciando limpieza de recursos LED")
            
        if self.animation_thread and self.animation_thread.is_alive():
            logger.info("Deteniendo animación en curso")
            self.stop_animation.set()
            self.animation_thread.join(1.0)
            
        if self.leds:
            try:
                # Apagar todos los LEDs
                logger.info("Apagando todos los LEDs")
                self.set_color((0, 0, 0))
                self.leds.cleanup()
                self.leds = None
            except Exception as e:
                logger.error(f"Error limpiando LEDs: {e}", exc_info=True)
            
        if self.led_power:
            try:
                logger.info(f"Apagando y liberando GPIO {LEDS_GPIO}")
                self.led_power.off()
                
                # Verificamos que no haya referencias circulares antes de cerrar
                import gc
                gc.collect()
                
                # Liberamos el recurso GPIO de manera segura
                self.led_power.close()  # Liberar el recurso GPIO
                self.led_power = None
            except Exception as e:
                logger.error(f"Error limpiando GPIO: {e}", exc_info=True)
            
        self.initialized = False
        self.running_animation = None
        logger.info("Limpieza de recursos LED completada")
    
    def set_color(self, rgb, led_index=None):
        """Configurar un color para todos los LEDs o uno específico"""
        if not self.initialized:
            return False
            
        # Detener cualquier animación en curso
        self.stop_animation_if_running()
            
        r, g, b = rgb
        
        if led_index is not None:
            # Configurar un solo LED
            if 0 <= led_index < NUM_LEDS:
                self.leds.set_pixel(led_index, r, g, b)
        else:
            # Configurar todos los LEDs
            for i in range(NUM_LEDS):
                self.leds.set_pixel(i, r, g, b)
                
        self.leds.show()
        return True
        
    def stop_animation_if_running(self):
        """Detener cualquier animación en curso"""
        if self.animation_thread and self.animation_thread.is_alive():
            self.stop_animation.set()
            self.animation_thread.join(1.0)
            self.stop_animation.clear()
            self.running_animation = None
    
    def start_animation(self, animation_type, **kwargs):
        """Iniciar una animación en los LEDs"""
        if not self.initialized:
            return False
            
        # Detener animación anterior si existe
        self.stop_animation_if_running()
        
        # Crear y comenzar el hilo de animación
        self.running_animation = animation_type
        self.animation_thread = threading.Thread(
            target=self._run_animation, 
            args=(animation_type,),
            kwargs=kwargs
        )
        self.animation_thread.daemon = True
        self.animation_thread.start()
        return True
        
    def _run_animation(self, animation_type, **kwargs):
        """Ejecutar la animación especificada"""
        if animation_type == "rotate":
            self._rotate_animation(**kwargs)
        elif animation_type == "pulse":
            self._pulse_animation(**kwargs)
        elif animation_type == "rainbow":
            self._rainbow_animation(**kwargs)
        elif animation_type == "blink":
            self._blink_animation(**kwargs)
    
    def _rotate_animation(self, colors=None, delay=0.2):
        """Animación de rotación de colores"""
        if colors is None:
            colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
            
        color_index = 0
        while not self.stop_animation.is_set():
            for i in range(NUM_LEDS):
                current_color = colors[(color_index + i) % len(colors)]
                self.leds.set_pixel(i, *current_color)
            self.leds.show()
            color_index = (color_index + 1) % len(colors)
            time.sleep(delay)
    
    def _pulse_animation(self, color=None, min_brightness=5, max_brightness=100, step=5, delay=0.05):
        """Animación de pulso (fade in/out)"""
        if color is None:
            color = (0, 0, 255)  # Azul por defecto
            
        r, g, b = color
        
        while not self.stop_animation.is_set():
            # Fade in
            for brightness in range(min_brightness, max_brightness, step):
                if self.stop_animation.is_set():
                    break
                for i in range(NUM_LEDS):
                    self.leds.set_pixel(i, r, g, b, brightness)
                self.leds.show()
                time.sleep(delay)
                
            # Fade out
            for brightness in range(max_brightness, min_brightness, -step):
                if self.stop_animation.is_set():
                    break
                for i in range(NUM_LEDS):
                    self.leds.set_pixel(i, r, g, b, brightness)
                self.leds.show()
                time.sleep(delay)
    
    def _rainbow_animation(self, delay=0.05, cycles=1):
        """Animación de arcoíris"""
        def wheel(pos):
            """Generador de color de rueda para el efecto arcoíris"""
            pos = 255 - pos
            if pos < 85:
                return (255 - pos * 3, 0, pos * 3)
            elif pos < 170:
                pos -= 85
                return (0, pos * 3, 255 - pos * 3)
            else:
                pos -= 170
                return (pos * 3, 255 - pos * 3, 0)
        
        for j in range(256 * cycles):
            if self.stop_animation.is_set():
                break
            for i in range(NUM_LEDS):
                pos = (i * 256 // NUM_LEDS + j) % 256
                r, g, b = wheel(pos)
                self.leds.set_pixel(i, r, g, b)
            self.leds.show()
            time.sleep(delay)
    
    def _blink_animation(self, color=None, off_color=(0,0,0), count=5, on_time=0.5, off_time=0.5):
        """Animación de parpadeo"""
        if color is None:
            color = (255, 0, 0)  # Rojo por defecto
        
        r, g, b = color
        off_r, off_g, off_b = off_color
        
        for _ in range(count):
            if self.stop_animation.is_set():
                break
                
            # Encender
            for i in range(NUM_LEDS):
                self.leds.set_pixel(i, r, g, b)
            self.leds.show()
            time.sleep(on_time)
            
            # Apagar
            for i in range(NUM_LEDS):
                self.leds.set_pixel(i, off_r, off_g, off_b)
            self.leds.show()
            time.sleep(off_time)


class APA102:
    """
    Driver para LEDs APA102 (aka "DotStar").
    (c) Martin Erzberger 2016-2017, adaptado para la API
    """

    # Constantes
    MAX_BRIGHTNESS = 0b11111  # Valor de seguridad
    LED_START = 0b11100000  # Tres bits "1", seguidos de 5 bits de brillo

    def __init__(
        self,
        num_led,
        global_brightness,
        order="rgb",
        bus=0,
        device=1,
        max_speed_hz=8000000,
    ):
        self.num_led = num_led  # Número de LEDs en la tira
        order = order.lower()
        self.rgb = RGB_MAP.get(order, RGB_MAP["rgb"])
        # Limitar el brillo al máximo si se establece más alto
        if global_brightness > self.MAX_BRIGHTNESS:
            self.global_brightness = self.MAX_BRIGHTNESS
        else:
            self.global_brightness = global_brightness

        self.leds = [self.LED_START, 0, 0, 0] * self.num_led  # Buffer de píxeles
        try:
            self.spi = spidev.SpiDev()  # Inicializar el dispositivo SPI
            self.spi.open(bus, device)  # Abrir puerto SPI 0, dispositivo esclavo (CS) 1
            # Aumentar la velocidad para que los LEDs se actualicen más rápido
            if max_speed_hz:
                self.spi.max_speed_hz = max_speed_hz
        except Exception as e:
            logging.error(f"Error inicializando SPI: {e}")
            raise

    def clock_start_frame(self):
        """Envía un frame de inicio a la tira LED."""
        self.spi.xfer2([0] * 4)  # Frame de inicio, 32 bits a cero

    def clock_end_frame(self):
        """Envía un frame final a la tira LED."""
        self.spi.xfer2([0xFF] * 4)

    def set_pixel(self, led_num, red, green, blue, bright_percent=100):
        """Establece el color de un píxel en la tira LED.
        
        El píxel cambiado todavía no se muestra en la tira,
        solo se escribe en el buffer de píxeles.
        Los colores se pasan individualmente.
        """
        if led_num < 0 or led_num >= self.num_led:
            return  # Píxel invisible, ignorar

        # Calcular brillo del píxel como porcentaje del brillo global
        brightness = int((bright_percent * self.global_brightness / 100.0) + 0.5)
        brightness = max(0, min(brightness, self.MAX_BRIGHTNESS))

        # Frame de inicio LED: tres bits "1", seguidos de 5 bits de brillo
        ledstart = (brightness & 0b00011111) | self.LED_START

        start_index = 4 * led_num
        self.leds[start_index] = ledstart
        self.leds[start_index + self.rgb[0]] = red
        self.leds[start_index + self.rgb[1]] = green
        self.leds[start_index + self.rgb[2]] = blue

    def set_pixel_rgb(self, led_num, rgb_color, bright_percent=100):
        """Establece el color de un píxel usando un valor RGB combinado."""
        self.set_pixel(
            led_num,
            (rgb_color & 0xFF0000) >> 16,
            (rgb_color & 0x00FF00) >> 8,
            rgb_color & 0x0000FF,
            bright_percent,
        )

    def rotate(self, positions=1):
        """Rota los LEDs por el número especificado de posiciones."""
        cutoff = 4 * (positions % self.num_led)
        self.leds = self.leds[cutoff:] + self.leds[:cutoff]

    def show(self):
        """Envía el contenido del buffer de píxeles a la tira."""
        try:
            self.clock_start_frame()
            # xfer2 destruye la lista, por lo que debe copiarse primero
            data = list(self.leds)
            while data:
                self.spi.xfer2(data[:32])
                data = data[32:]
            self.clock_end_frame()
        except Exception as e:
            logging.error(f"Error mostrando LEDs: {e}")

    def cleanup(self):
        """Libera el dispositivo SPI; llame a este método al final"""
        try:
            # Intentamos apagar todos los LEDs antes de cerrar
            try:
                # Enviar un frame de 0s para apagar todos los LEDs
                self.clock_start_frame()
                data = [0] * (self.num_led * 4)  # 4 bytes por LED (inicio + RGB)
                while data:
                    self.spi.xfer2(data[:32])
                    data = data[32:]
                self.clock_end_frame()
            except Exception:
                pass  # Ignoramos errores al intentar apagar los LEDs
                
            # Cerrar puerto SPI
            if hasattr(self, 'spi') and self.spi:
                logging.info("Cerrando dispositivo SPI")
                self.spi.close()
        except Exception as e:
            logging.error(f"Error en cleanup de SPI: {e}", exc_info=True)


# Endpoints para controlar los LEDs
@router.post("/init")
async def initialize_leds(brightness: Optional[int] = 31):
    """Inicializar el controlador de LEDs"""
    # Asegurarnos de que brightness sea un entero válido
    try:
        if brightness is not None:
            brightness = int(brightness)
            brightness = max(1, min(brightness, 31))  # Limitar entre 1 y 31
        else:
            brightness = 31
    except (TypeError, ValueError):
        brightness = 31
    
    controller = LEDController.get_instance()
    
    # Limpiar recursos primero si ya estaba inicializado
    if controller.initialized:
        controller.cleanup()
    
    success = controller.initialize(brightness)
    if success:
        return {"status": "success", "message": "LED controller initialized"}
    else:
        raise HTTPException(status_code=500, detail="Failed to initialize LED controller")

@router.post("/off")
async def leds_off():
    """Apagar todos los LEDs"""
    controller = LEDController.get_instance()
    if not controller.initialized:
        controller.initialize()
    
    success = controller.set_color((0, 0, 0))
    if success:
        return {"status": "success", "message": "LEDs turned off"}
    else:
        raise HTTPException(status_code=500, detail="Failed to turn off LEDs")

@router.post("/color")
async def set_led_color(r: int, g: int, b: int, led_index: Optional[int] = None):
    """Establecer un color para los LEDs"""
    controller = LEDController.get_instance()
    if not controller.initialized:
        controller.initialize()
    
    # Validar valores RGB
    r = max(0, min(r, 255))
    g = max(0, min(g, 255))
    b = max(0, min(b, 255))
    
    success = controller.set_color((r, g, b), led_index)
    if success:
        target = f"LED {led_index}" if led_index is not None else "all LEDs"
        return {"status": "success", "message": f"Color set for {target}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to set LED color")

@router.post("/preset")
async def set_preset_color(color_name: str, led_index: Optional[int] = None):
    """Establecer un color predefinido para los LEDs"""
    if color_name not in COLORS:
        available_colors = ", ".join(COLORS.keys())
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid color name. Available colors: {available_colors}"
        )
    
    controller = LEDController.get_instance()
    if not controller.initialized:
        controller.initialize()
    
    success = controller.set_color(COLORS[color_name], led_index)
    if success:
        target = f"LED {led_index}" if led_index is not None else "all LEDs"
        return {"status": "success", "message": f"Color '{color_name}' set for {target}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to set preset color")

@router.post("/animation")
async def start_animation(
    animation_type: str = "rotate",
    delay: float = 0.2,
    colors: Optional[List[Dict[str, int]]] = None,
    color: Optional[Dict[str, int]] = None,
):
    """
    Iniciar una animación en los LEDs
    
    animation_type: tipo de animación - "rotate", "pulse", "rainbow", "blink"
    colors: lista de colores RGB para animaciones que usan múltiples colores
    delay: tiempo de espera entre actualizaciones de la animación
    color: color RGB para animaciones que usan un solo color
    """
    valid_animations = ["rotate", "pulse", "rainbow", "blink"]
    if animation_type not in valid_animations:
        available_animations = ", ".join(valid_animations)
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid animation type. Available animations: {available_animations}"
        )
    
    controller = LEDController.get_instance()
    if not controller.initialized:
        controller.initialize()
    
    # Procesar parámetros de animación
    kwargs = {"delay": delay}
    
    if color:
        r = max(0, min(color.get("r", 0), 255))
        g = max(0, min(color.get("g", 0), 255))
        b = max(0, min(color.get("b", 0), 255))
        kwargs["color"] = (r, g, b)
        
    if colors:
        processed_colors = []
        for color_item in colors:
            r = max(0, min(color_item.get("r", 0), 255))
            g = max(0, min(color_item.get("g", 0), 255))
            b = max(0, min(color_item.get("b", 0), 255))
            processed_colors.append((r, g, b))
        
        if processed_colors:
            kwargs["colors"] = processed_colors
    
    success = controller.start_animation(animation_type, **kwargs)
    if success:
        return {
            "status": "success", 
            "message": f"Animation '{animation_type}' started"
        }
    else:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to start animation '{animation_type}'"
        )

@router.post("/stop")
async def stop_animation():
    """Detener cualquier animación en curso"""
    controller = LEDController.get_instance()
    if not controller.initialized:
        controller.initialize()
    
    controller.stop_animation_if_running()
    return {"status": "success", "message": "Animation stopped"}

@router.get("/status")
async def led_status():
    """Obtener estado actual del controlador LED"""
    controller = LEDController.get_instance()
    return {
        "initialized": controller.initialized,
        "animation_running": controller.running_animation is not None,
        "animation_type": controller.running_animation,
        "leds_count": NUM_LEDS
    }

@router.post("/cleanup")
async def cleanup_leds():
    """Limpiar y apagar los LEDs"""
    controller = LEDController.get_instance()
    controller.cleanup()
    return {"status": "success", "message": "LED controller cleaned up"}
