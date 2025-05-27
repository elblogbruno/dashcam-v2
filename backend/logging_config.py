"""
Configuración avanzada de logging para el backend
"""
import logging
import sys
import os
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler

def setup_logging(level=logging.INFO):
    """Configura el sistema de logging con opciones avanzadas"""
    
    # Crear directorio de logs si no existe
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    # Generar nombre de archivo con fecha
    current_date = datetime.now().strftime("%Y%m%d")
    log_file = os.path.join(log_dir, f"backend_{current_date}.log")
    
    # Configurar formato detallado para los logs
    log_format = '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'
    
    formatter = logging.Formatter(fmt=log_format, datefmt=date_format)
    
    # Handler para consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Handler para archivo con rotación (10MB máximo, 5 archivos de respaldo)
    file_handler = RotatingFileHandler(
        log_file, 
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    
    # Configuración del logger raíz
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Eliminar handlers existentes para evitar duplicados
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Añadir nuevos handlers
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    # Crear logger específico para API
    api_logger = logging.getLogger('dashcam-api')
    api_logger.setLevel(level)
    
    # Logger para acceso
    access_logger = logging.getLogger('dashcam-access')
    access_logger.setLevel(level)
    
    return {
        'root': root_logger,
        'api': api_logger,
        'access': access_logger
    }

class RequestLogger:
    """Middleware para registro detallado de solicitudes"""
    
    def __init__(self):
        self.logger = logging.getLogger('dashcam-access')
    
    async def __call__(self, request, call_next):
        # Crear ID único para la solicitud
        request_id = f"{time.time():.6f}"
        
        # Logging de inicio de solicitud
        start_time = time.time()
        self.logger.info(f"[{request_id}] Request {request.method} {request.url.path} started")
        
        # Procesar la solicitud
        try:
            response = await call_next(request)
            
            # Logging de finalización
            process_time = time.time() - start_time
            self.logger.info(
                f"[{request_id}] Request completed: {response.status_code} in {process_time:.3f}s"
            )
            
            return response
        except Exception as e:
            # Logging de error
            process_time = time.time() - start_time
            self.logger.error(
                f"[{request_id}] Request failed after {process_time:.3f}s: {str(e)}",
                exc_info=True
            )
            raise
