#!/usr/bin/env python3
"""
Punto de entrada para el servidor de desarrollo
Este archivo resuelve los problemas de importaciones relativas
"""

import sys
import os

# Agregar el directorio backend al path de Python
backend_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(backend_dir)
sys.path.insert(0, backend_dir)
sys.path.insert(0, parent_dir)

# Importar y ejecutar la aplicación principal
if __name__ == "__main__":
    # Cambiar las importaciones relativas por absolutas temporalmente
    import main
    
    # Ejecutar el servidor
    import uvicorn
    uvicorn.run(
        main.app, 
        host="0.0.0.0", 
        port=8000, 
        log_level="info",
        reload=True,
        reload_dirs=[backend_dir],
        timeout_keep_alive=120,
        ws_max_size=16777216,
        ws_ping_interval=30.0,
        ws_ping_timeout=60.0,
    )
