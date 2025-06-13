import asyncio
import logging
import time
from fastapi import APIRouter, Response, Request
from fastapi.responses import StreamingResponse
from typing import Dict, Any
from shutdown_control import should_continue_loop, register_task, interruptible_sleep

logger = logging.getLogger(__name__)
router = APIRouter()

# Esta variable será inicializada desde main.py
camera_manager = None

# Tracking de clientes activos
active_clients = {"road": 0, "interior": 0}
client_streams: Dict[str, Dict[str, Any]] = {}

# Estado del streaming MJPEG (desactivado por defecto)
streaming_enabled = {
    "road": False,
    "interior": False
}

# Estadísticas
stats = {
    "clients_connected": 0,
    "start_time": time.time()
}

async def initialize_mjpeg():
    """Inicializar el sistema de streaming MJPEG nativo"""
    logger.info("🚀 Inicializando módulo de streaming MJPEG nativo...")
    
    # Iniciar limpieza periódica de clientes inactivos
    cleanup_task = asyncio.create_task(cleanup_inactive_clients())
    register_task(cleanup_task, "mjpeg_cleanup")
    
    logger.info("✓ Módulo MJPEG nativo inicializado correctamente")

async def cleanup_inactive_clients():
    """Limpiar clientes inactivos periódicamente"""
    while should_continue_loop("mjpeg"):
        try:
            current_time = time.time()
            to_remove = []
            
            for client_id, info in client_streams.items():
                # Remover clientes inactivos por más de 30 segundos
                if current_time - info.get("last_activity", 0) > 30:
                    to_remove.append(client_id)
            
            for client_id in to_remove:
                logger.info(f"Limpiando cliente inactivo: {client_id}")
                await cleanup_client(client_id, "inactividad")
            
            # Sleep interrumpible de 10 segundos
            await interruptible_sleep(10.0, "mjpeg")
            
        except Exception as e:
            logger.error(f"Error en limpieza de clientes: {e}")
            # Sleep interrumpible de 5 segundos para errores
            await interruptible_sleep(5.0, "mjpeg")
    
    logger.info("🛑 Cleanup de clientes MJPEG terminado")

async def cleanup_client(client_id: str, reason: str = "desconexión"):
    """Limpiar recursos de un cliente"""
    if client_id not in client_streams:
        return
    
    try:
        info = client_streams[client_id]
        camera_type = info.get("camera_type")
        
        # Decrementar contador
        if camera_type in active_clients:
            active_clients[camera_type] = max(0, active_clients[camera_type] - 1)
        
        # Detener streaming nativo si es el último cliente de este tipo
        if active_clients.get(camera_type, 0) == 0 and camera_manager:
            camera_attr = f"{camera_type}_camera"
            if hasattr(camera_manager, camera_attr):
                camera = getattr(camera_manager, camera_attr)
                if camera:
                    camera.stop_mjpeg_stream()
        
        del client_streams[client_id]
        stats["clients_connected"] = max(0, stats["clients_connected"] - 1)
        
        logger.info(f"Cliente {client_id} limpiado por {reason}")
        
    except Exception as e:
        logger.error(f"Error limpiando cliente {client_id}: {e}")

@router.get("/stream/{camera_type}")
async def mjpeg_stream(request: Request, camera_type: str):
    """Endpoint para streaming MJPEG nativo de las cámaras"""
    # Validar tipo de cámara
    if camera_type not in ["road", "interior"]:
        return Response(
            content="Tipo de cámara no válido. Use 'road' o 'interior'.",
            status_code=400
        )
    
    # Verificar límite de clientes
    if active_clients.get(camera_type, 0) >= 5:
        return Response(
            content="Demasiados clientes activos para este tipo de cámara.",
            status_code=429
        )
    
    # Verificar límite por IP
    client_ip = getattr(request.client, "host", "unknown")
    connections_from_ip = sum(
        1 for info in client_streams.values() 
        if info.get("ip") == client_ip
    )
    
    if connections_from_ip >= 3:
        return Response(
            content="Demasiadas conexiones desde su IP.",
            status_code=429
        )
    
    # Generar ID único para cliente
    timestamp = int(time.time())
    client_id = f"{camera_type}_{timestamp}_{id(request)}"
    
    # Headers para streaming
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Connection": "close",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type"
    }
    
    return StreamingResponse(
        native_mjpeg_generator(request, camera_type, client_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers=headers
    )

async def native_mjpeg_generator(request: Request, camera_type: str, client_id: str):
    """Generador MJPEG nativo usando encoders hardware/software nativos"""
    try:
        # Verificar si el streaming está habilitado para esta cámara
        if not streaming_enabled[camera_type]:
            logger.info(f"Streaming MJPEG está desactivado para la cámara {camera_type}")
            # Generar un frame indicando que el streaming está desactivado
            import cv2
            import numpy as np
            
            # Crear un mensaje visual para el usuario
            img = np.zeros((480, 640, 3), dtype=np.uint8)
            font = cv2.FONT_HERSHEY_SIMPLEX
            cv2.putText(img, "Streaming MJPEG desactivado", (120, 240), font, 1, (255, 255, 255), 2)
            cv2.putText(img, "Active el streaming desde el botón", (100, 280), font, 1, (255, 255, 255), 2)
            cv2.putText(img, f"Cámara: {camera_type}", (240, 320), font, 1, (0, 120, 255), 2)
            
            # Enviar un solo frame con el mensaje
            _, jpeg = cv2.imencode('.jpg', img)
            frame_bytes = jpeg.tobytes()
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n"
                   b"Content-Length: " + f"{len(frame_bytes)}".encode() + b"\r\n"
                   b"\r\n" + frame_bytes + b"\r\n")
            return

        # Verificar camera_manager
        if camera_manager is None:
            logger.error("Camera manager no disponible")
            return
            
        # Obtener la cámara
        camera_attr = f"{camera_type}_camera"
        if not hasattr(camera_manager, camera_attr):
            logger.error(f"Cámara {camera_type} no disponible")
            return
            
        camera = getattr(camera_manager, camera_attr)
        if camera is None:
            logger.error(f"Cámara {camera_type} es None")
            return

        # Obtener calidad del request
        quality_param = request.query_params.get('quality', 'medium').lower()
        logger.info(f"Calidad solicitada: {quality_param} para {camera_type}")
        if quality_param not in ['low', 'medium', 'high']:
            quality_param = 'medium'

        # Iniciar streaming nativo
        streaming_output = camera.start_mjpeg_stream(quality=quality_param)
        if streaming_output is None:
            logger.error(f"No se pudo iniciar streaming nativo para {camera_type}")
            return

        # Registrar cliente
        client_ip = getattr(request.client, "host", "unknown")
        client_streams[client_id] = {
            "camera_type": camera_type,
            "last_activity": time.time(),
            "connection_time": time.time(),
            "frames_sent": 0,
            "ip": client_ip
        }
        
        active_clients[camera_type] += 1
        stats["clients_connected"] += 1
        
        logger.info(f"Cliente MJPEG nativo conectado para {camera_type}. ID: {client_id}")

        # Stream de frames
        consecutive_timeouts = 0
        max_timeouts = 10
        
        while True:
            # Verificar si cliente se desconectó
            if await request.is_disconnected():
                logger.info(f"Cliente {client_id} desconectado")
                break
                
            # Verificar si el cliente aún está activo
            if client_id not in client_streams:
                break
                
            try:
                # SOLUCIÓN MEJORADA: Usar método optimizado para contextos async
                # que minimiza el tiempo de bloqueo
                frame_data = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: streaming_output.read_async_friendly(timeout=0.1)
                )
                
                if frame_data:
                    # Enviar frame en formato MJPEG
                    yield (b"--frame\r\n"
                           b"Content-Type: image/jpeg\r\n"
                           b"Content-Length: " + f"{len(frame_data)}".encode() + b"\r\n"
                           b"\r\n" + frame_data + b"\r\n")
                    
                    # Actualizar estadísticas
                    if client_id in client_streams:
                        client_streams[client_id]["last_activity"] = time.time()
                        client_streams[client_id]["frames_sent"] += 1
                    
                    consecutive_timeouts = 0
                else:
                    consecutive_timeouts += 1
                    if consecutive_timeouts >= max_timeouts:
                        logger.warning(f"Demasiados timeouts para {client_id}")
                        break
                    
                    # Pausa muy corta en caso de timeout para no bloquear
                    await asyncio.sleep(0.01)  # Reducido de 0.1 a 0.01 segundos
                    
            except Exception as e:
                logger.error(f"Error en streaming para {client_id}: {e}")
                break

    except Exception as e:
        logger.error(f"Error en generador MJPEG nativo: {e}")
    finally:
        # Limpiar recursos
        await cleanup_client(client_id, "finalización")

@router.get("/status")
async def get_mjpeg_status():
    """Obtener estado del subsistema MJPEG"""
    uptime = time.time() - stats["start_time"]
    
    total_clients = sum(active_clients.values())
    
    return {
        "status": "active",
        "uptime_seconds": round(uptime, 2),
        "total_clients": total_clients,
        "clients_by_camera": active_clients.copy(),
        "total_connections": stats["clients_connected"],
        "streaming_mode": "native",
        "streaming_enabled": streaming_enabled
    }

@router.post("/toggle/{camera_type}")
async def toggle_mjpeg_streaming(camera_type: str):
    """Activa o desactiva el streaming MJPEG para una cámara específica"""
    if camera_type not in ["road", "interior"]:
        return {"status": "error", "message": "Tipo de cámara no válido. Use 'road' o 'interior'."}
    
    # Cambiar estado del streaming para la cámara específica
    streaming_enabled[camera_type] = not streaming_enabled[camera_type]
    
    # Si desactivamos el streaming, detener la cámara
    if not streaming_enabled[camera_type] and camera_manager:
        camera_attr = f"{camera_type}_camera"
        if hasattr(camera_manager, camera_attr):
            camera = getattr(camera_manager, camera_attr)
            if camera:
                camera.stop_mjpeg_stream()
    
    return {
        "status": "ok",
        "camera_type": camera_type,
        "enabled": streaming_enabled[camera_type]
    }

@router.post("/heartbeat/{client_id}")
async def mjpeg_heartbeat(client_id: str):
    """Heartbeat para mantener conexión activa"""
    if client_id in client_streams:
        client_streams[client_id]["last_activity"] = time.time()
        return {"status": "ok"}
    return {"status": "not_found"}

async def shutdown_mjpeg():
    """Apagar limpiamente el sistema MJPEG"""
    logger.info("🛑 Apagando sistema MJPEG nativo...")
    
    try:
        # Limpiar todos los clientes
        for client_id in list(client_streams.keys()):
            await cleanup_client(client_id, "shutdown")
        
        # Resetear contadores
        active_clients.clear()
        active_clients.update({"road": 0, "interior": 0})
        
        logger.info("✓ Sistema MJPEG nativo apagado correctamente")
        
    except Exception as e:
        logger.error(f"Error apagando sistema MJPEG: {e}")

# Función para compatibilidad con otros módulos
def get_shared_frame(camera_type: str):
    """Función de compatibilidad - no usada en sistema nativo"""
    import numpy as np
    import cv2
    
    # Generar frame por defecto
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(img, "Frame no disponible", (200, 240), font, 1, (255, 255, 255), 2)
    cv2.putText(img, f"{camera_type.upper()} CAMERA", (10, 30), font, 0.7, (0, 120, 255), 2)
    return img

def is_mjpeg_worker_active():
    """Verificar si hay clientes activos"""
    return sum(active_clients.values()) > 0
