#!/usr/bin/env python3
"""
Script de prueba para el sistema MJPEG nativo optimizado
"""
import sys
import os

# Agregar el directorio backend al path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import asyncio
import logging
import time
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import uvicorn

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crear aplicación FastAPI simple
app = FastAPI(title="Test MJPEG Nativo")

# Importar el router MJPEG
from routes.mjpeg_stream import router as mjpeg_router, initialize_mjpeg
import routes.mjpeg_stream as mjpeg_module

# Incluir el router MJPEG
app.include_router(mjpeg_router, prefix="/api/mjpeg", tags=["mjpeg"])

# Crear un mock del camera_manager para las pruebas
class MockCamera:
    def __init__(self, camera_type):
        self.camera_type = camera_type
        self.is_initialized = True
        self.streaming_output = None
        self.is_mjpeg_streaming = False
    
    def start_mjpeg_stream(self, quality=None):
        """Simular inicio de streaming MJPEG"""
        from cameras.base_camera import StreamingOutput
        import threading
        import time
        
        if self.is_mjpeg_streaming:
            return self.streaming_output
            
        self.streaming_output = StreamingOutput()
        self.is_mjpeg_streaming = True
        
        # Iniciar un thread que genere frames de prueba
        self.mjpeg_thread = threading.Thread(target=self._generate_test_frames)
        self.mjpeg_thread.daemon = True
        self.mjpeg_thread.start()
        
        logger.info(f"Mock MJPEG streaming iniciado para {self.camera_type}")
        return self.streaming_output
    
    def stop_mjpeg_stream(self):
        """Simular parada de streaming MJPEG"""
        self.is_mjpeg_streaming = False
        self.streaming_output = None
        logger.info(f"Mock MJPEG streaming detenido para {self.camera_type}")
        return True
    
    def _generate_test_frames(self):
        """Generar frames de prueba"""
        import cv2
        import numpy as np
        
        frame_count = 0
        while self.is_mjpeg_streaming and self.streaming_output:
            try:
                # Crear frame de prueba
                img = np.zeros((480, 640, 3), dtype=np.uint8)
                
                # Agregar texto
                font = cv2.FONT_HERSHEY_SIMPLEX
                text = f"{self.camera_type.upper()} CAMERA - Frame {frame_count}"
                cv2.putText(img, text, (50, 100), font, 1, (0, 255, 0), 2)
                
                # Agregar timestamp
                timestamp = time.strftime("%H:%M:%S")
                cv2.putText(img, timestamp, (50, 200), font, 1, (255, 255, 255), 2)
                
                # Agregar indicador de calidad
                cv2.putText(img, "MOCK STREAM", (50, 300), font, 1, (255, 0, 0), 2)
                
                # Encodificar como JPEG
                _, jpeg_buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                jpeg_data = jpeg_buffer.tobytes()
                
                # Escribir al streaming output
                self.streaming_output.write(jpeg_data)
                
                frame_count += 1
                time.sleep(1.0 / 15.0)  # 15 FPS
                
            except Exception as e:
                logger.error(f"Error generando frame de prueba: {e}")
                break

class MockCameraManager:
    def __init__(self):
        self.road_camera = MockCamera("road")
        self.interior_camera = MockCamera("interior")

@app.on_event("startup")
async def startup_event():
    """Inicializar el sistema al arranque"""
    logger.info("🚀 Iniciando aplicación de prueba MJPEG...")
    
    # Configurar mock camera manager
    mjpeg_module.camera_manager = MockCameraManager()
    
    # Inicializar MJPEG
    await initialize_mjpeg()
    
    logger.info("✅ Aplicación de prueba MJPEG iniciada correctamente")

@app.get("/", response_class=HTMLResponse)
async def home():
    """Página de inicio con enlaces de prueba"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test MJPEG Nativo</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .stream-container { margin: 20px 0; }
            img { border: 1px solid #ccc; margin: 10px; }
        </style>
    </head>
    <body>
        <h1>Test Sistema MJPEG Nativo</h1>
        <p>Prueba del nuevo sistema de streaming MJPEG nativo optimizado</p>
        
        <div class="stream-container">
            <h2>Cámara Road (Carretera)</h2>
            <img src="/api/mjpeg/stream/road" width="640" height="480" alt="Road Camera Stream">
            <br>
            <a href="/api/mjpeg/stream/road" target="_blank">Abrir stream directo - Road</a>
        </div>
        
        <div class="stream-container">
            <h2>Cámara Interior</h2>
            <img src="/api/mjpeg/stream/interior" width="640" height="480" alt="Interior Camera Stream">
            <br>
            <a href="/api/mjpeg/stream/interior" target="_blank">Abrir stream directo - Interior</a>
        </div>
        
        <div class="stream-container">
            <h2>Estado del Sistema</h2>
            <a href="/api/mjpeg/status" target="_blank">Ver estado MJPEG</a>
        </div>
        
        <div class="stream-container">
            <h2>Opciones de Calidad</h2>
            <p>Prueba diferentes calidades:</p>
            <ul>
                <li><a href="/api/mjpeg/stream/road?quality=low" target="_blank">Road - Baja calidad</a></li>
                <li><a href="/api/mjpeg/stream/road?quality=medium" target="_blank">Road - Calidad media</a></li>
                <li><a href="/api/mjpeg/stream/road?quality=high" target="_blank">Road - Alta calidad</a></li>
            </ul>
        </div>
    </body>
    </html>
    """
    return html_content

if __name__ == "__main__":
    try:
        logger.info("🚀 Iniciando servidor de prueba MJPEG en puerto 8001...")
        print("🚀 Iniciando servidor de prueba MJPEG en puerto 8001...")
        print("📱 Abre http://localhost:8001 en tu navegador para ver la prueba")
        uvicorn.run("test_mjpeg_native:app", host="0.0.0.0", port=8001, reload=False)
    except KeyboardInterrupt:
        logger.info("⏹️ Servidor detenido por el usuario")
    except Exception as e:
        logger.error(f"❌ Error iniciando servidor: {e}")
