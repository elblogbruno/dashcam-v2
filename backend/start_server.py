#!/usr/bin/env python3
# start_server.py - Script separado para iniciar el servidor FastAPI
# Este archivo ejecuta directamente el servidor uvicorn para la Raspberry Pi

import os
import sys
import uvicorn
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("../backend_log.txt")
    ]
)
logger = logging.getLogger("dashcam-starter")

# Añadir el directorio actual al path para que podamos importar los módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    try:
        logger.info("====== INICIANDO SERVIDOR FASTAPI DESDE SCRIPT INDEPENDIENTE ======")
        logger.info("Iniciando servidor Uvicorn en puerto 8000...")
        print("Iniciando servidor Uvicorn en puerto 8000...")
        
        # Ejecutar el servidor con configuración explícita
        # Esto garantiza que el script se ejecute correctamente en la Raspberry Pi
        uvicorn.run(
            "main:app", 
            host="0.0.0.0", 
            port=8000, 
            log_level="info",
            reload=False,  # Deshabilitar recarga automática para entorno de producción
            workers=1,     # Force single worker to avoid multiprocessing issues
            loop="asyncio" # Use asyncio event loop explicitly
        )
    except KeyboardInterrupt:
        logger.info("Servidor detenido manualmente con Ctrl+C")
        print("Servidor detenido manualmente con Ctrl+C")
    except Exception as e:
        logger.critical(f"Error fatal al iniciar Uvicorn: {e}", exc_info=True)
        print(f"Error fatal al iniciar Uvicorn: {e}")
        sys.exit(1)