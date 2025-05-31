"""
Sistema de control de cierre para loops infinitos y background tasks
Este módulo proporciona banderas globales para controlar el cierre ordenado de todos los loops
"""
import asyncio
import logging
import signal
import threading
from typing import Set, Dict, Any
import time

logger = logging.getLogger(__name__)

class ShutdownController:
    """Controlador centralizado para el cierre ordenado del servidor"""
    
    def __init__(self):
        # Bandera principal de cierre
        self.shutdown_requested = False
        
        # Banderas específicas para cada módulo
        self.mjpeg_running = True
        self.webrtc_running = True
        self.location_updates_running = True
        self.websocket_running = True
        self.shutdown_monitor_running = True
        
        # Tracking de tasks activos
        self.active_tasks: Set[asyncio.Task] = set()
        self.background_threads: Set[threading.Thread] = set()
        
        # Lock para thread safety
        self.lock = threading.Lock()
        
        logger.info("🔧 ShutdownController inicializado")
    
    def setup_signal_handlers(self):
        """Configurar manejadores de señales para cierre ordenado"""
        def signal_handler(signum, frame):
            logger.info(f"🛑 Señal recibida: {signum}, iniciando cierre ordenado...")
            self.request_shutdown()
        
        # Registrar manejadores para SIGINT (Ctrl+C) y SIGTERM
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        logger.info("🔧 Manejadores de señales configurados")
    
    def request_shutdown(self):
        """Solicitar cierre ordenado de todos los componentes"""
        with self.lock:
            if self.shutdown_requested:
                return  # Ya se solicitó el cierre
                
            logger.info("🛑 INICIANDO CIERRE ORDENADO DEL SERVIDOR...")
            self.shutdown_requested = True
            
            # Deshabilitar todos los loops
            self.mjpeg_running = False
            self.webrtc_running = False
            self.location_updates_running = False
            self.websocket_running = False
            self.shutdown_monitor_running = False
            
            logger.info("✓ Todas las banderas de cierre activadas")
    
    def register_task(self, task: asyncio.Task, name: str = ""):
        """Registrar una tarea asyncio para tracking"""
        with self.lock:
            self.active_tasks.add(task)
            logger.debug(f"📝 Tarea registrada: {name or task.get_name()}")
    
    def unregister_task(self, task: asyncio.Task):
        """Desregistrar una tarea asyncio"""
        with self.lock:
            self.active_tasks.discard(task)
    
    def register_thread(self, thread: threading.Thread):
        """Registrar un thread para tracking"""
        with self.lock:
            self.background_threads.add(thread)
            logger.debug(f"📝 Thread registrado: {thread.name}")
    
    def unregister_thread(self, thread: threading.Thread):
        """Desregistrar un thread"""
        with self.lock:
            self.background_threads.discard(thread)
    
    async def cancel_all_tasks(self, timeout: float = 5.0):
        """Cancelar todas las tareas registradas"""
        with self.lock:
            tasks_to_cancel = list(self.active_tasks)
        
        if not tasks_to_cancel:
            logger.info("✓ No hay tareas asyncio para cancelar")
            return
        
        logger.info(f"🔄 Cancelando {len(tasks_to_cancel)} tareas asyncio...")
        
        # Cancelar todas las tareas
        for task in tasks_to_cancel:
            if not task.done():
                task.cancel()
        
        # Esperar a que se cancelen con timeout
        try:
            await asyncio.wait_for(
                asyncio.gather(*tasks_to_cancel, return_exceptions=True),
                timeout=timeout
            )
            logger.info("✓ Todas las tareas asyncio canceladas")
        except asyncio.TimeoutError:
            logger.warning(f"⚠️ Timeout cancelando tareas después de {timeout}s")
        
        # Limpiar la lista
        with self.lock:
            self.active_tasks.clear()
    
    def stop_all_threads(self, timeout: float = 3.0):
        """Detener todos los threads registrados"""
        with self.lock:
            threads_to_stop = list(self.background_threads)
        
        if not threads_to_stop:
            logger.info("✓ No hay threads para detener")
            return
        
        logger.info(f"🔄 Deteniendo {len(threads_to_stop)} threads...")
        
        # Solicitar que todos los threads se detengan (ya se hizo con las banderas)
        # Esperar a que terminen
        for thread in threads_to_stop:
            if thread.is_alive():
                thread.join(timeout=timeout)
                if thread.is_alive():
                    logger.warning(f"⚠️ Thread {thread.name} no terminó en {timeout}s")
                else:
                    logger.debug(f"✓ Thread {thread.name} terminado correctamente")
        
        # Limpiar la lista
        with self.lock:
            self.background_threads.clear()
    
    def is_shutdown_requested(self) -> bool:
        """Verificar si se solicitó el cierre"""
        return self.shutdown_requested
    
    def get_status(self) -> Dict[str, Any]:
        """Obtener estado del controlador"""
        with self.lock:
            return {
                "shutdown_requested": self.shutdown_requested,
                "active_tasks": len(self.active_tasks),
                "background_threads": len(self.background_threads),
                "module_flags": {
                    "mjpeg_running": self.mjpeg_running,
                    "webrtc_running": self.webrtc_running,
                    "location_updates_running": self.location_updates_running,
                    "websocket_running": self.websocket_running,
                    "shutdown_monitor_running": self.shutdown_monitor_running
                }
            }

# Instancia global del controlador
shutdown_controller = ShutdownController()

# Funciones de conveniencia para usar en otros módulos
def is_shutdown_requested() -> bool:
    """Verificar si se solicitó el cierre del servidor"""
    return shutdown_controller.is_shutdown_requested()

def should_continue_loop(module_name: str) -> bool:
    """Verificar si un loop específico debe continuar ejecutándose"""
    if shutdown_controller.is_shutdown_requested():
        return False
    
    # Verificar banderas específicas por módulo
    if module_name == "mjpeg":
        return shutdown_controller.mjpeg_running
    elif module_name == "webrtc":
        return shutdown_controller.webrtc_running
    elif module_name == "location":
        return shutdown_controller.location_updates_running
    elif module_name == "websocket":
        return shutdown_controller.websocket_running
    elif module_name == "shutdown_monitor":
        return shutdown_controller.shutdown_monitor_running
    else:
        return not shutdown_controller.is_shutdown_requested()

def register_task(task: asyncio.Task, name: str = ""):
    """Registrar una tarea asyncio"""
    shutdown_controller.register_task(task, name)

def register_thread(thread: threading.Thread):
    """Registrar un thread"""
    shutdown_controller.register_thread(thread)

def request_shutdown():
    """Solicitar cierre del servidor"""
    shutdown_controller.request_shutdown()
