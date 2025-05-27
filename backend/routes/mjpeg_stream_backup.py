import asyncio
import logging
import time
import cv2
import numpy as np
from fastapi import APIRouter, Response, Request
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Optional

from backend.utils.image_optimizer import ImageOptimizer

logger = logging.getLogger(__name__)
router = APIRouter()

optimizer = ImageOptimizer()

# Esta variable será inicializada desde main.py
camera_manager = None

# Colas de frames por cliente - CRÍTICO: Variable requerida para el sistema
frame_queues: Dict[str, Dict[str, Any]] = {}

# Cliente activos por tipo de cámara
active_clients = {"road": 0, "interior": 0}

# Últimos frames capturados - OPTIMIZACIÓN: Cache más eficiente
last_frames = {"road": None, "interior": None}
last_frame_time = {"road": 0, "interior": 0}

# OPTIMIZACIÓN CRÍTICA: Tamaño de cola ULTRA-reducido para latencia mínima
QUEUE_SIZE = 1  # ULTRA-AGRESIVO: Solo 1 frame para latencia ULTRA-baja

# Estadísticas
stats = {
    "frames_served": 0,
    "clients_connected": 0,
    "start_time": time.time()
}

# OPTIMIZACIÓN: Tiempo de inactividad reducido para limpieza más rápida
MAX_CLIENT_INACTIVITY = 20  # ULTRA-AGRESIVO: Reducido de 30 a 20 segundos

# OPTIMIZACIÓN: Control de FPS adaptativo ULTRA-agresivo para eliminar latencia
TARGET_FPS = 12  # ULTRA-AGRESIVO: Reducido de 15 a 12 FPS para eliminar lag completamente
FRAME_SKIP_THRESHOLD = 0.3  # ULTRA-AGRESIVO: Saltar frames cuando las colas están 30% llenas (antes 80%)

async def initialize_mjpeg():
    """Inicializar el sistema de streaming MJPEG"""
    logger.info("🚀 Inicializando módulo de streaming MJPEG...")
    
    # Iniciar el worker de captura de frames
    asyncio.create_task(frame_capture_worker())
    
    # Iniciar verificador de clientes inactivos
    asyncio.create_task(check_inactive_clients())
    
    # Preparar frames por defecto para respuestas rápidas
    for camera_type in ["road", "interior"]:
        if camera_type not in last_frames or last_frames[camera_type] is None:
            last_frames[camera_type] = generate_default_frame(
                camera_type, 
                "Iniciando cámara...",
                (640, 480)
            )
    
    logger.info("✓ Módulo MJPEG inicializado correctamente")

# Crear tarea para inicializar
asyncio.create_task(initialize_mjpeg())

async def frame_capture_worker():
    """Worker para capturar frames de las cámaras"""
    global last_frames, last_frame_time
    
    logger.info("🎥 Iniciando worker de captura de frames MJPEG")
    
    # Inicializar contadores y estadísticas
    failed_captures = {"road": 0, "interior": 0}
    target_fps = TARGET_FPS  # Usar FPS optimizado globalmente
    frame_interval = 1.0 / target_fps
    worker_runs = 0  # Contador de ejecuciones del worker
    last_activity_check = time.time()  # Para optimizar verificaciones de actividad
    
    while True:
        try:
            loop_start = time.time()
            current_time = loop_start  # Define current_time variable
            worker_runs += 1
            
            # Log periódico del estado del worker (cada 600 iteraciones ~ 30 segundos a 20fps)
            if worker_runs % 600 == 0:
                logger.debug(f"Worker MJPEG: ejecutando con normalidad. Iteración {worker_runs}. Clientes: Road={active_clients.get('road', 0)}, Interior={active_clients.get('interior', 0)}")
            
            # Solo capturar si hay clientes conectados o si han pasado más de 5 segundos desde la última captura
            road_clients = active_clients.get("road", 0)
            interior_clients = active_clients.get("interior", 0)
            
            # OPTIMIZACIÓN: Solo verificar actividad cada 5 segundos para reducir overhead
            current_time = time.time()
            should_check_activity = (current_time - last_activity_check) > 5.0
            if should_check_activity:
                last_activity_check = current_time
            
            for camera_type in ["road", "interior"]:
                # OPTIMIZACIÓN CRÍTICA: Solo capturar si hay clientes activos
                clients_for_camera = road_clients if camera_type == "road" else interior_clients
                
                # Saltar captura si no hay clientes y no es momento de verificar actividad
                if clients_for_camera == 0 and not should_check_activity:
                    continue
                
                # Solo capturar si hay clientes para este tipo de cámara o si han pasado más de 10 segundos
                if clients_for_camera > 0 or \
                   (should_check_activity and time.time() - last_frame_time.get(camera_type, 0) > 10):
                    
                    frame = None
                    
                    try:
                        # Verificar si el camera_manager está disponible
                        if camera_manager is None:
                            logger.warning(f"Camera manager no disponible para {camera_type}")
                            failed_captures[camera_type] += 1
                            continue
                        
                        # Obtener atributo de cámara correspondiente
                        camera_attr = f"{camera_type}_camera"
                        if not hasattr(camera_manager, camera_attr) or getattr(camera_manager, camera_attr) is None:
                            logger.warning(f"Cámara {camera_type} no disponible")
                            failed_captures[camera_type] += 1
                            continue
                        
                        # Capturar frame
                        frame = camera_manager.get_preview_frame(camera_type=camera_type)
                        
                        # Procesar frame
                        if frame is not None:
                            # Validar que sea un array numpy válido
                            if not isinstance(frame, np.ndarray):
                                if hasattr(frame, 'get_result'):  # Manejar objetos Job de PiCamera2
                                    try:
                                        frame = frame.get_result()
                                    except Exception as e:
                                        logger.error(f"Error obteniendo resultado de frame: {e}")
                                        frame = None
                                else:
                                    frame = None
                            
                            # Actualizar frame válido y reset contador de fallos
                            if frame is not None and isinstance(frame, np.ndarray) and frame.size > 0:
                                # Agregar timestamp al frame
                                frame = add_timestamp_to_frame(frame, camera_type)
                                
                                # Actualizar frame
                                last_frames[camera_type] = frame
                                last_frame_time[camera_type] = time.time()
                                
                                # Si hubo fallos previos, loggear recuperación
                                if failed_captures[camera_type] > 0:
                                    logger.info(f"✅ Cámara {camera_type} recuperada después de {failed_captures[camera_type]} fallos")
                                    failed_captures[camera_type] = 0
                                
                                # Enviar frame a todas las colas de este tipo de cámara
                                await broadcast_frame(camera_type, frame)
                                
                    except Exception as e:
                        logger.error(f"Error capturando frame de {camera_type}: {str(e)}")
                        failed_captures[camera_type] += 1
                        
                        # Log cada 30 fallos para no spammear
                        if failed_captures[camera_type] % 30 == 1:
                            logger.warning(f"⚠️ Fallos consecutivos en cámara {camera_type}: {failed_captures[camera_type]}")
            
            # OPTIMIZACIÓN CRÍTICA: Control dinámico de FPS basado en carga de clientes
            # Ajustar FPS según el estado de las colas para evitar saturación
            active_client_count = sum(active_clients.values())
            if active_client_count > 0:
                # Calcular el porcentaje de colas llenas
                full_queues = sum(1 for info in frame_queues.values() 
                                if info.get("active", True) and info["queue"].full())
                total_queues = sum(1 for info in frame_queues.values() 
                                 if info.get("active", True))
                
                if total_queues > 0:
                    queue_saturation = full_queues / total_queues
                    
                    # ULTRA-AGRESIVO: Ajuste dinámico del FPS con umbrales más bajos
                    if queue_saturation > 0.3:  # ULTRA: Más del 30% de colas llenas (antes 70%)
                        target_fps = max(6, TARGET_FPS - 6)  # ULTRA: Reducir muy agresivamente
                    elif queue_saturation > 0.15:  # ULTRA: Más del 15% de colas llenas (antes 40%) 
                        target_fps = max(8, TARGET_FPS - 4)  # ULTRA: Reducir agresivamente
                    elif queue_saturation > 0.05:  # ULTRA: Más del 5% de colas llenas (antes 20%)
                        target_fps = max(10, TARGET_FPS - 2)  # ULTRA: Reducir moderadamente
                        target_fps = max(12, TARGET_FPS - 2)  # Reducir levemente
                    else:
                        target_fps = TARGET_FPS  # FPS normal
                else:
                    target_fps = TARGET_FPS
            else:
                # Sin clientes activos, usar FPS reducido para ahorrar recursos
                target_fps = max(5, TARGET_FPS // 3)
                
            # Recalcular el intervalo de frame dinámicamente
            frame_interval = 1.0 / target_fps
            
            # Calcular tiempo transcurrido y dormir lo necesario para mantener el FPS objetivo
            elapsed = time.time() - loop_start
            sleep_time = max(0.001, frame_interval - elapsed)
            
            # Log FPS efectivo cada 30 segundos para monitoreo
            if worker_runs % (target_fps * 30) == 0:
                effective_fps = 1.0 / (elapsed + sleep_time) if (elapsed + sleep_time) > 0 else 0
                logger.info(f"📊 MJPEG Worker: Target={target_fps:.1f} FPS, Effective={effective_fps:.1f} FPS, "
                          f"Clients={active_client_count}, Queues={queue_saturation:.1%} full")
            
            await asyncio.sleep(sleep_time)
            
        except Exception as e:
            logger.error(f"Error en worker de captura de frames: {str(e)}")
            await asyncio.sleep(1)  # Esperar un segundo antes de reintentar

def add_timestamp_to_frame(frame, camera_type):
    """Añadir timestamp y tipo de cámara a un frame"""
    if frame is None:
        return frame
        
    try:
        import cv2
        
        # Asegurarse de que el frame esté en formato BGR (OpenCV usa BGR por defecto)
        if len(frame.shape) == 3 and frame.shape[2] == 4:  # Si tiene 4 canales (RGBA o BGRA)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            
        h, w = frame.shape[:2]
        now = time.time()
        
        # Incluir milisegundos para mayor precisión
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now))
        ms = int((now - int(now)) * 1000)
        timestamp = f"{timestamp}.{ms:03d}"
        
        # Añadir timestamp
        cv2.putText(
            frame, timestamp, (10, h - 20), 
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA
        )
        
        # Añadir tipo de cámara
        cv2.putText(
            frame, f"{camera_type.upper()} CAMERA", (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 120, 255), 2, cv2.LINE_AA
        )
        
        return frame
    except Exception as e:
        logger.error(f"Error añadiendo timestamp: {str(e)}")
        return frame

async def broadcast_frame(camera_type, frame):
    """Enviar frame a todos los clientes conectados para este tipo de cámara"""
    if frame is None:
        return
    
    # Contar exactamente cuántos clientes activos hay para este tipo de cámara
    clients_count = 0
    clients_with_full_queue = 0
    
    for queue_info in frame_queues.values():
        if queue_info["camera_type"] == camera_type and queue_info.get("active", True):
            clients_count += 1
            # Verificar si la cola está llena
            if queue_info["queue"].full():
                clients_with_full_queue += 1
    
    # Si no hay clientes activos, no procesamos el frame para ahorrar recursos
    if clients_count == 0:
        return
    
    # OPTIMIZACIÓN ULTRA-CRÍTICA: Con colas de 1 frame, cualquier frame = cola llena
    # Estrategia ULTRA-AGRESIVA: Saltar broadcast si más del 20% tienen colas llenas
    queue_full_ratio = clients_with_full_queue / max(clients_count, 1)
    if queue_full_ratio > 0.2:  # ULTRA-AGRESIVO: 20% en lugar de 60%
        # Rate limiting ULTRA-agresivo
        if hasattr(broadcast_frame, "last_skip_check"):
            time_since_last_skip = time.time() - broadcast_frame.last_skip_check
            if time_since_last_skip < 0.020:  # ULTRA: 20ms en lugar de 33ms
                return  # Saltar este frame completamente
        broadcast_frame.last_skip_check = time.time()
    
    # Log ULTRA-frecuente para detectar problemas inmediatamente
    if clients_with_full_queue > 0 and queue_full_ratio > 0.1:  # ULTRA: 10% umbral
        current_time = time.time()
        if not hasattr(broadcast_frame, "last_warning_time") or current_time - broadcast_frame.last_warning_time > 5:  # ULTRA: 5s
            logger.warning(f"🚨 Cola saturada: {clients_with_full_queue}/{clients_count} clientes de {camera_type} ({queue_full_ratio:.1%} llenas)")
            broadcast_frame.last_warning_time = current_time
    
    # Determinar nivel de optimización basado en la carga
    force_level = None
    if queue_full_ratio > 0.7:  # Más del 70% tienen colas llenas
        force_level = 3  # Optimización fuerte
    elif queue_full_ratio > 0.4:  # Más del 40% tienen colas llenas  
        force_level = 2  # Optimización moderada
    elif queue_full_ratio > 0.2:  # Más del 20% tienen colas llenas
        force_level = 1  # Optimización leve
        
    # Optimizar el frame
    optimized_frame, quality = optimizer.optimize_frame(frame, clients_count, force_level)
    
    # Comprimir frame a JPEG para streaming con calidad optimizada
    _, jpeg_frame = cv2.imencode('.jpg', optimized_frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    jpeg_bytes = jpeg_frame.tobytes()
    
    # Formato MJPEG: cada frame precedido por un boundary y headers
    mjpeg_frame = b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpeg_bytes + b'\r\n'
    
    # MEJORA: Usar un solo frame para todos los clientes para reducir memoria
    # En lugar de copiar los bytes en cada cola, hacer referencia al mismo objeto
    
    # Obtener clientes activos y ordenarlos por tamaño de cola (priorizar los que tienen menos)
    client_queues = sorted(
        [(client_id, info) for client_id, info in frame_queues.items() 
         if info["camera_type"] == camera_type and info.get("active", True)],
        key=lambda x: x[1]["queue"].qsize()  # Ordenar por tamaño de cola (menor primero)
    )
    
    frames_sent = 0
    to_remove = []
    
    # Procesar cada cliente con enfoque adaptativo
    for client_id, queue_info in client_queues:
        try:
            queue = queue_info["queue"]
            
            # OPTIMIZACIÓN ULTRA-EXTREMA: Con colas de 1 frame, ser INMEDIATAMENTE agresivo
            queue_size = queue.qsize()
            queue_max = queue.maxsize
            queue_percentage = queue_size / queue_max
            
            # Con colas de SOLO 1 frame, cualquier frame existente = 100% lleno
            if queue_size > 0:  # ULTRA: Si hay CUALQUIER frame en la cola de 1
                # INMEDIATA limpieza: reemplazar frame existente con el más reciente
                try:
                    queue.get_nowait()  # Sacar el frame viejo inmediatamente
                except asyncio.QueueEmpty:
                    pass
                
                # Enviar el frame fresco inmediatamente
                try:
                    queue.put_nowait(mjpeg_frame)
                    frames_sent += 1
                except asyncio.QueueFull:
                    # Esto no debería pasar con cola de 1, pero por si acaso
                    pass
                    
            # Cola vacía - envío normal inmediato
            else:
                try:
                    queue.put_nowait(mjpeg_frame)
                    frames_sent += 1
                except asyncio.QueueFull:
                    # Si se llena entre check y put (race condition), limpiar y reintentar
                    try:
                        queue.get_nowait()  # Limpiar inmediatamente
                        queue.put_nowait(mjpeg_frame)  # Reintentar
                        frames_sent += 1
                    except (asyncio.QueueEmpty, asyncio.QueueFull):
                        pass  # Abandonar si aún falla
                
        except Exception as e:
            logger.error(f"Error enviando frame a cliente {client_id}: {str(e)}")
            to_remove.append(client_id)
    
    # Actualizar estadísticas
    stats["frames_served"] += frames_sent
    
    # Eliminar clientes con error
    for client_id in to_remove:
        if client_id in frame_queues:
            logger.info(f"Eliminando cliente {client_id} de la lista de destinatarios por error")
            camera = frame_queues[client_id]["camera_type"]
            active_clients[camera] = max(0, active_clients[camera] - 1)
            
            # Liberar recursos de la cola
            try:
                queue = frame_queues[client_id]["queue"]
                # Marcar como inactivo para que no reciba más frames
                frame_queues[client_id]["active"] = False
                
                # Vaciar la cola completamente
                while not queue.empty():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break
            except Exception as e:
                logger.error(f"Error limpiando cola para cliente {client_id}: {e}")
                
            del frame_queues[client_id]
            stats["clients_connected"] -= 1

def generate_default_frame(camera_type, message="Cámara no disponible", size=(640, 480)):
    """Generar un frame por defecto con mensaje de error"""
    img = np.zeros((size[1], size[0], 3), dtype=np.uint8)
    
    # Añadir texto centrado
    font = cv2.FONT_HERSHEY_SIMPLEX
    textsize = cv2.getTextSize(message, font, 1, 2)[0]
    textX = (size[0] - textsize[0]) // 2
    textY = (size[1] + textsize[1]) // 2
    cv2.putText(img, message, (textX, textY), font, 1, (255, 255, 255), 2, cv2.LINE_AA)
    
    # Añadir indicador de tipo de cámara
    cv2.putText(img, f"{camera_type.upper()} CAMERA", (10, 30), font, 0.7, (0, 120, 255), 2, cv2.LINE_AA)
    
    # Añadir timestamp
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(img, timestamp, (10, size[1] - 20), font, 0.5, (150, 150, 150), 1, cv2.LINE_AA)
    
    return img

async def cleanup_client_resources(client_id: str, reason: str = "desconexión"):
    """Función optimizada para limpiar completamente los recursos de un cliente"""
    if client_id not in frame_queues:
        return
    
    try:
        # Obtener información antes de limpiar
        queue_info = frame_queues[client_id]
        camera_type = queue_info["camera_type"]
        frames_sent = queue_info.get("frames_sent", 0)
        connection_duration = time.time() - queue_info.get("connection_time", time.time())
        
        # PASO 1: Marcar como inactivo inmediatamente para evitar nuevos frames
        frame_queues[client_id]["active"] = False
        
        # PASO 2: Limpiar la cola agresivamente para liberar memoria
        queue = queue_info["queue"]
        frames_cleared = 0
        while not queue.empty():
            try:
                queue.get_nowait()
                frames_cleared += 1
            except asyncio.QueueEmpty:
                break
        
        # PASO 3: Decrementar contadores atómicamente
        if camera_type in active_clients:
            active_clients[camera_type] = max(0, active_clients[camera_type] - 1)
        stats["clients_connected"] = max(0, stats["clients_connected"] - 1)
        
        # PASO 4: Eliminar completamente la entrada
        del frame_queues[client_id]
        
        # Log de limpieza exitosa
        logger.info(f"✓ Cliente {client_id} limpiado por {reason}. "
                   f"Duración: {connection_duration:.1f}s, Frames: {frames_sent}, "
                   f"Cola limpiada: {frames_cleared} frames, "
                   f"Restantes {camera_type}: {active_clients.get(camera_type, 0)}")
        
    except Exception as e:
        logger.error(f"Error limpiando recursos del cliente {client_id}: {e}")

async def mjpeg_generator(request: Request, camera_type: str, client_id: str):
    """Generador de streaming MJPEG optimizado para latencia mínima"""
    # Comprobar si ya hay demasiados clientes activos para este tipo de cámara
    current_clients = active_clients.get(camera_type, 0)
    
    if current_clients > 5:  # Limitar clientes por tipo de cámara 
        logger.warning(f"Demasiados clientes activos para {camera_type}, rechazando nueva conexión")
        # Mostrar mensaje de advertencia y cerrar
        warning_frame = generate_default_frame(camera_type, 
                                              "Demasiadas conexiones activas. Reintente más tarde.", 
                                              (640, 480))
        _, jpeg = cv2.imencode('.jpg', warning_frame)
        warning_bytes = jpeg.tobytes()
        yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + warning_bytes + b'\r\n'
        return
    
    # Comprobar conexiones duplicadas
    client_ip = getattr(request.client, "host", "unknown")
    user_agent = request.headers.get("user-agent", "unknown")
    # Crear un hash aproximado del cliente - CORREGIDO: cameraType a camera_type
    client_hash = f"{client_ip}_{camera_type}"
    
    # Si hay una reconexión reciente (menos de 1s) desde el mismo cliente, esperar un poco
    recent_connections = [
        q_id for q_id, q_info in frame_queues.items() 
        if q_info.get("camera_type") == camera_type and 
        q_info.get("ip") == client_ip and
        time.time() - q_info.get("connection_time", 0) < 1
    ]
    
    if recent_connections:
        logger.warning(f"Posible reconexión rápida desde {client_ip} para {camera_type}, esperando...")
        await asyncio.sleep(1.0)  # Pequeña pausa para estabilizar
    
    try:
        # OPTIMIZACIÓN ULTRA: Cola extremadamente pequeña para latencia ultra-baja
        # Reducido a solo 2 frames para eliminar completamente la latencia de buffer
        queue_size = QUEUE_SIZE  # Usar constante global para consistencia
        client_queue = asyncio.Queue(maxsize=queue_size)
        
        frame_queues[client_id] = {
            "queue": client_queue,
            "camera_type": camera_type,
            "last_activity": time.time(),
            "active": True,
            "visible": True,  # Por defecto consideramos que está visible
            "connection_time": time.time(),
            "frames_sent": 0,
            "ip": client_ip,
            "user_agent": user_agent,
            "is_new": True,
            "client_hash": client_hash
        }
        
        # Incrementar contador de clientes
        active_clients[camera_type] += 1
        stats["clients_connected"] += 1
        
        logger.info(f"Nuevo cliente MJPEG conectado para cámara {camera_type}. ID: {client_id}. Total: {active_clients[camera_type]}")
        
        # Enviar un primer frame inmediato
        initial_frame = last_frames.get(camera_type)
        if initial_frame is not None:
            _, jpeg = cv2.imencode('.jpg', initial_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            initial_bytes = jpeg.tobytes()
            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + initial_bytes + b'\r\n'
            frame_queues[client_id]["frames_sent"] += 1
            await asyncio.sleep(0.05)
        else:
            default_frame = generate_default_frame(camera_type, "Iniciando cámara...", (640, 480))
            _, jpeg = cv2.imencode('.jpg', default_frame)
            initial_bytes = jpeg.tobytes()
            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + initial_bytes + b'\r\n'
            frame_queues[client_id]["frames_sent"] += 1
            await asyncio.sleep(0.05)
        
        # Marcar que ya no es cliente nuevo
        if client_id in frame_queues:
            frame_queues[client_id]["is_new"] = False
            frame_queues[client_id]["last_activity"] = time.time()
        
        # Bucle principal de streaming
        keep_alive_counter = 0
        was_visible = True
        consecutive_empties = 0  # Contador para detectar problemas de consumo
        
        while True:
            if await request.is_disconnected():
                logger.info(f"Cliente MJPEG desconectado por cierre de conexión. ID: {client_id}")
                break
            
            # Verificar si el cliente aún está activo
            if client_id not in frame_queues or not frame_queues[client_id].get("active", False):
                logger.info(f"Cliente MJPEG {client_id} inactivo, finalizando stream")
                break
            
            # Comprobar si el cliente está visible
            is_visible = frame_queues[client_id].get("visible", True)
            
            # Si hay cambio de visibilidad, registrarlo
            if is_visible != was_visible:
                logger.debug(f"Cambio de visibilidad en cliente {client_id}: {is_visible}")
                was_visible = is_visible
            
            try:
                # Esperar el próximo frame con timeout adaptativo
                timeout = 3.0 if is_visible else 10.0
                
                if is_visible:
                    # OPTIMIZACIÓN: Timeout más agresivo para clientes visibles
                    try:
                        frame_data = await asyncio.wait_for(client_queue.get(), timeout=1.0)  # Reducido de 3.0 a 1.0
                        yield frame_data
                        consecutive_empties = 0
                        
                        # Actualizar estadísticas
                        if client_id in frame_queues:
                            frame_queues[client_id]["last_activity"] = time.time()
                            frame_queues[client_id]["frames_sent"] += 1
                        
                        # OPTIMIZACIÓN CRÍTICA: Limpiar cola si tiene demasiados frames para reducir latencia
                        if client_id in frame_queues:
                            queue = frame_queues[client_id]["queue"]
                            queue_size = queue.qsize()
                            
                            # Si la cola está medio llena o más, limpiar frames antiguos
                            if queue_size >= 2:  # Cola de 3, limpiar si tiene 2 o más
                                frames_dropped = 0
                                while queue.qsize() > 1 and frames_dropped < 2:  # Mantener solo 1 frame
                                    try:
                                        queue.get_nowait()
                                        frames_dropped += 1
                                    except asyncio.QueueEmpty:
                                        break
                                
                                if frames_dropped > 0:
                                    logger.debug(f"Limpiado {frames_dropped} frames antiguos de {client_id} para reducir latencia")
                        
                    except asyncio.TimeoutError:
                        consecutive_empties += 1
                        
                        # Si hemos tenido muchos timeouts consecutivos, enviar keep-alive
                        if consecutive_empties >= 2:  # Reducido de más timeouts
                            logger.debug(f"Enviando keep-alive para cliente {client_id} tras {consecutive_empties} timeouts")
                            keepalive_frame = generate_default_frame(
                                camera_type, 
                                f"Esperando frames... ({time.strftime('%H:%M:%S')})",
                                (320, 240)  # Tamaño reducido para menos overhead
                            )
                            _, jpeg = cv2.imencode('.jpg', keepalive_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
                            keepalive_bytes = jpeg.tobytes()
                            
                            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + keepalive_bytes + b'\r\n'
                            if client_id in frame_queues:
                                frame_queues[client_id]["last_activity"] = time.time()
                                frame_queues[client_id]["frames_sent"] += 1
                            consecutive_empties = 0
                        # Esto sacrifica algunos frames para mantener la transmisión cerca del tiempo real
                        queue_size = client_queue.qsize()
                        if queue_size > 2:  # Si hay más de 2 frames en espera
                            frames_to_skip = min(queue_size - 1, 3)  # Mantener al menos 1 frame, saltar máximo 3
                            for _ in range(frames_to_skip):
                                # Descartar frames intermedios para reducir latencia
                                try:
                                    client_queue.get_nowait()
                                except asyncio.QueueEmpty:
                                    break
                                    
                    except asyncio.TimeoutError:
                        consecutive_empties += 1
                        
                        # Si tenemos muchos timeouts consecutivos, podría haber un problema
                        if consecutive_empties > 3:
                            # Enviar un frame de keep-alive en lugar de perder la conexión
                            logger.info(f"Cola vacía consistentemente para cliente {client_id}, enviando keep-alive")
                            keepalive_frame = generate_default_frame(
                                camera_type, 
                                f"Esperando nuevos frames... ({time.strftime('%H:%M:%S')})",
                                (480, 360)  # Más pequeño para ahorrar ancho de banda
                            )
                            _, jpeg = cv2.imencode('.jpg', keepalive_frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
                            keepalive_bytes = jpeg.tobytes()
                            
                            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + keepalive_bytes + b'\r\n'
                            if client_id in frame_queues:
                                frame_queues[client_id]["last_activity"] = time.time()
                                frame_queues[client_id]["frames_sent"] += 1
                            consecutive_empties = 0  # Resetear contador
                        
                else:
                    # Cliente no visible: enviar solo keep-alive cada ~10 segundos
                    await asyncio.sleep(8.0)
                    keep_alive_counter += 1
                    
                    if keep_alive_counter % 3 == 1:  # Aproximadamente cada ~24 segundos
                        # Enviar frame de keep-alive minimalista para mantener conexión
                        keepalive_frame = generate_default_frame(
                            camera_type, 
                            f"Stream pausado - No visible ({time.strftime('%H:%M:%S')})", 
                            (320, 240)  # Tamaño reducido para ahorrar ancho de banda
                        )
                        _, jpeg = cv2.imencode('.jpg', keepalive_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
                        keepalive_bytes = jpeg.tobytes()
                        
                        yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + keepalive_bytes + b'\r\n'
                        if client_id in frame_queues:
                            frame_queues[client_id]["last_activity"] = time.time()
                            frame_queues[client_id]["frames_sent"] += 1
                    
            except asyncio.TimeoutError:
                # Enviar keep-alive
                keep_alive_counter += 1
                
                # Log solo la primera vez para evitar spam
                if keep_alive_counter == 1:
                    logger.info(f"Enviando keep-alive para cliente {client_id}")
                
                # Generar frame de keep-alive
                keepalive_frame = generate_default_frame(
                    camera_type, 
                    f"Manteniendo conexión... ({time.strftime('%H:%M:%S')})"
                )
                _, jpeg = cv2.imencode('.jpg', keepalive_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                keepalive_bytes = jpeg.tobytes()
                
                yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + keepalive_bytes + b'\r\n'
                if client_id in frame_queues:
                    frame_queues[client_id]["last_activity"] = time.time()
                    frame_queues[client_id]["frames_sent"] += 1
                    
                # Si enviamos muchos keep-alive consecutivos con cliente visible, puede haber un problema
                if keep_alive_counter >= 5 and is_visible:
                    logger.warning(f"Muchos keep-alive para cliente {client_id}, posible problema con la cámara")
            
            except Exception as e:
                logger.error(f"Error en streaming MJPEG para cliente {client_id}: {str(e)}")
                break
    
    except Exception as e:
        logger.error(f"Error iniciando streaming MJPEG para cliente {client_id}: {str(e)}")
    
    finally:
        # OPTIMIZACIÓN: Usar función centralizada de limpieza
        await cleanup_client_resources(client_id, "desconexión del generador")

@router.get("/stream/{camera_type}")
async def mjpeg_stream(request: Request, camera_type: str):
    """Endpoint para streaming MJPEG de las cámaras"""
    # Validar tipo de cámara
    if camera_type not in ["road", "interior"]:
        return Response(
            content="Tipo de cámara no válido. Use 'road' o 'interior'.",
            status_code=400
        )
    
    # Extraer parámetros importantes para evitar que causen problemas
    params = dict(request.query_params)
    is_initial_connection = 'initial' in params or 'init' in params or 'stable' in params
    is_reconnection = 'reconnect' in params
    
    # Asegurar que procesamos correctamente clientes estables
    client_stable_id = params.get('stableId', None)
    
    # Generar ID único para este cliente
    timestamp = int(time.time())
    # Si tenemos un ID estable, usarlo como parte del identificador
    suffix = f"_{client_stable_id}" if client_stable_id else f"_{id(request)}"
    client_id = f"{camera_type}_{timestamp}{suffix}"
    
    # Log adicional para conexiones iniciales y reconexiones
    if is_initial_connection:
        logger.info(f"Nueva conexión inicial para {camera_type}. Cliente: {getattr(request.client, 'host', 'unknown')}. Parámetros: {params}")
    elif is_reconnection:
        logger.info(f"Reconexión para {camera_type}. Cliente: {getattr(request.client, 'host', 'unknown')}. Parámetros: {params}")
    
    # Establecer headers para evitar problemas de almacenamiento en caché y CORS
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Connection": "close",  # Importante para conexiones chunked
        "X-Accel-Buffering": "no", # Desactivar buffering en Nginx
        # Agregar CORS headers para permitir el acceso desde el frontend
        "Access-Control-Allow-Origin": "*",  # En producción, limitar al dominio específico
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type"
    }
    
    # OPTIMIZACIÓN: Verificar si el cliente especifica preferencias de calidad
    quality_param = request.query_params.get('quality', '').lower()
    if quality_param in ['low', 'medium', 'high']:
        # Aplicaremos estas preferencias al generar los frames
        params['quality_preference'] = quality_param
    
    # OPTIMIZACIÓN: Verificar límite de conexiones por cliente para prevenir sobrecarga
    client_ip = getattr(request.client, "host", "unknown")
    active_connections_from_ip = sum(
        1 for info in frame_queues.values() 
        if info.get("ip") == client_ip and info.get("active", True)
    )
    
    # Limitar conexiones por IP (máximo 3 por IP)
    if active_connections_from_ip >= 3:
        return Response(
            content="Demasiadas conexiones activas desde su dirección IP.",
            status_code=429  # Too Many Requests
        )
    
    return StreamingResponse(
        mjpeg_generator(request, camera_type, client_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers=headers
    )

@router.get("/status")
async def get_mjpeg_status():
    """Obtener estado del subsistema MJPEG"""
    uptime = time.time() - stats["start_time"]
    
    camera_info = {}
    if camera_manager:
        camera_info = {
            "road": {
                "available": camera_manager.road_camera is not None,
                "initialized": getattr(camera_manager.road_camera, "is_initialized", False) if camera_manager.road_camera else False,
                "clients": active_clients.get("road", 0)
            },
            "interior": {
                "available": camera_manager.interior_camera is not None,
                "initialized": getattr(camera_manager.interior_camera, "is_initialized", False) if camera_manager.interior_camera else False,
                "clients": active_clients.get("interior", 0)
            }
        }
    
    return {
        "status": "ok",
        "active_clients": stats["clients_connected"],
        "frames_served": stats["frames_served"],
        "camera_status": camera_info,
        "uptime": uptime
    }

@router.post("/heartbeat/{client_id}")
async def mjpeg_heartbeat(client_id: str, request: Request, disconnect: bool = False):
    """Endpoint para recibir heartbeats de clientes MJPEG"""
    # Intentar extraer el estado visible del cuerpo de la solicitud
    visible = True  # Por defecto consideramos que está visible
    try:
        if request.headers.get('content-type') == 'application/json':
            body = await request.json()
            if 'visible' in body:
                visible = bool(body['visible'])
    except Exception:
        # Si hay error al procesar JSON, asumir que está visible
        pass

    # Solo registrar logs cuando sea necesario para evitar spam
    if disconnect:
        logger.info(f"Desconexión explícita recibida para cliente MJPEG {client_id}")
    
    # Extraer tipo de cámara del ID del cliente para aceptar incluso IDs temporales
    camera_type = None
    if "_" in client_id:
        parts = client_id.split("_")
        if len(parts) > 0 and parts[0] in ["road", "interior"]:
            camera_type = parts[0]
    
    # Comprobar si es un ID temporal
    is_temp_id = "temp" in client_id.lower()
    
    # Buscar el cliente exacto o uno compatible basado en el tipo de cámara
    client_found = client_id in frame_queues
    
    # Si el cliente no se encuentra pero tenemos el tipo de cámara, buscar clientes del mismo tipo
    matching_client_id = None
    if not client_found and camera_type:
        # Buscar un cliente activo del mismo tipo de cámara
        for queue_id, queue_info in frame_queues.items():
            if queue_info["camera_type"] == camera_type and queue_info.get("active", True):
                matching_client_id = queue_id
                client_found = True
                # Si es un ID temporal, registrar la asociación
                if is_temp_id:
                    logger.debug(f"ID temporal {client_id} asociado con cliente existente {matching_client_id}")
                break
    
    if client_found:
        actual_client_id = matching_client_id or client_id
        
        if disconnect:
            # Desconexión explícita del cliente - USAR FUNCIÓN OPTIMIZADA
            if actual_client_id in frame_queues:
                await cleanup_client_resources(actual_client_id, "desconexión explícita")
                logger.info(f"Cliente MJPEG desconectado explícitamente. ID: {actual_client_id}")
            
            return {"status": "ok", "message": "Cliente desconectado explícitamente"}
        else:
            # Actualizar tiempo de actividad solo si el cliente sigue visible
            # Esto permite mantener la conexión pero pausarla cuando no está visible
            if actual_client_id in frame_queues:
                frame_queues[actual_client_id]["last_activity"] = time.time()
                # Evitar cambiar active a False pero sí permitir cambios de visibilidad
                if visible or not frame_queues[actual_client_id].get("active", True):
                    frame_queues[actual_client_id]["active"] = visible
                frame_queues[actual_client_id]["visible"] = visible
                
                # Log cuando cambia la visibilidad
                if "visible" in frame_queues[actual_client_id] and frame_queues[actual_client_id]["visible"] != visible:
                    logger.debug(f"Cliente {actual_client_id} cambió visibilidad a {visible}")
                
            return {"status": "ok", "client_id": actual_client_id}
    elif camera_type:
        # Si no encontramos el cliente pero tenemos un tipo de cámara válido, 
        # devolver OK para evitar que el cliente se desconecte prematuramente
        logger.debug(f"Heartbeat para cliente no existente {client_id}, pero con tipo válido {camera_type}")
        return {"status": "ok", "message": "Cliente no encontrado pero tipo de cámara válido"}
    else:
        return {"status": "error", "message": "Cliente no encontrado"}

async def check_inactive_clients():
    """Verificar periódicamente clientes inactivos y cerrar sus conexiones"""
    logger.info("🔍 Iniciando worker de monitoreo de clientes MJPEG inactivos")
    
    while True:
        try:
            current_time = time.time()
            to_remove = []
            
            # Verificar estado general del sistema de streaming
            total_clients = sum(active_clients.values())
            if total_clients > 0:
                logger.debug(f"Estado del sistema de streaming: {total_clients} clientes activos. (Road: {active_clients.get('road', 0)}, Interior: {active_clients.get('interior', 0)})")
            
            # Verificar clientes inactivos
            for client_id, queue_info in frame_queues.items():
                last_activity = queue_info.get("last_activity", 0)
                
                # Si no hay actividad reciente, marcar para eliminación
                if (current_time - last_activity) > MAX_CLIENT_INACTIVITY:
                    logger.info(f"Cliente MJPEG {client_id} inactivo por {MAX_CLIENT_INACTIVITY}s, removiendo...")
                    to_remove.append(client_id)
                    # Marcar como inactivo inmediatamente para evitar envío de frames
                    frame_queues[client_id]["active"] = False
            
            # Eliminar clientes inactivos usando la función optimizada
            for client_id in to_remove:
                if client_id in frame_queues:
                    await cleanup_client_resources(client_id, "inactividad")
            
            # Verificar colas de mensajes para asegurar que no crezcan demasiado
            for client_id, queue_info in list(frame_queues.items()):
                if client_id in frame_queues and queue_info.get("active", True):  # Asegurar que el cliente sigue activo
                    queue = queue_info["queue"]
                    queue_size = queue.qsize()
                    queue_max = queue.maxsize
                    
                    # Detectar clientes muy lentos (colas casi llenas)
                    if queue_size > (queue_max * 0.8):  # 80% llena o más
                        log_level = logging.WARNING if queue_size > (queue_max * 0.9) else logging.DEBUG
                        logger.log(log_level, f"Cola de cliente {client_id} casi llena ({queue_size}/{queue_max})")
                        
                        # Estrategia de limpieza progresiva basada en cuánto está llena la cola
                        try:
                            # Si está muy llena (>90%), ser más agresivo en la limpieza
                            if queue_size > (queue_max * 0.9):
                                keep_frames = 1  # Dejar solo 1 frame en colas muy llenas
                                logger.warning(f"Cola de cliente {client_id} críticamente llena ({queue_size}/{queue_max}), limpieza agresiva")
                            # Si está moderadamente llena (>80%), ser menos agresivo
                            else:
                                keep_frames = 2  # Dejar 2 frames en colas moderadamente llenas
                                
                            # Vaciar manteniendo solo los frames más recientes según lo determinado
                            while queue.qsize() > keep_frames:
                                queue.get_nowait()
                                
                            logger.debug(f"Cola de cliente {client_id} limpiada. Nuevo tamaño: {queue.qsize()}/{queue_max}")
                        except asyncio.QueueEmpty:
                            pass
        
        except Exception as e:
            logger.error(f"Error en worker de verificación de clientes inactivos: {str(e)}")
        
        # Verificar cada 5 segundos
        await asyncio.sleep(5)

@router.get("/thread_stats")
async def get_thread_stats():
    """Obtener estadísticas sobre threads activos relacionados con MJPEG"""
    import threading
    
    thread_count = 0
    mjpeg_threads = 0
    
    # Contar threads activos relacionados con MJPEG
    for thread in threading.enumerate():
        thread_count += 1
        thread_name = thread.name.lower()
        if "mjpeg" in thread_name or "stream" in thread_name:
            mjpeg_threads += 1
    
    # Otras estadísticas relevantes del sistema
    queue_stats = {
        "total_queues": len(frame_queues),
        "total_queue_items": sum(queue_info["queue"].qsize() if "queue" in queue_info else 0 
                               for queue_info in frame_queues.values())
    }
    
    return {
        "status": "ok",
        "total_threads": thread_count,
        "mjpeg_related_threads": mjpeg_threads,
        "active_clients": dict(active_clients),
        "clients_connected": stats["clients_connected"],
        "frames_served": stats["frames_served"],
        "queue_stats": queue_stats,
        "uptime": time.time() - stats["start_time"]
    }

class ImageOptimizer:
    """
    Versión optimizada para evitar errores de importación.
    Optimiza las imágenes para streaming MJPEG adaptándose a la carga.
    """
    def __init__(self):
        self.processing_times = []
        self.last_optimization = time.time()
        self.optimization_level = 0
        self.quality_levels = {0: 88, 1: 80, 2: 70, 3: 60}
        self.resize_factors = {0: 1.0, 1: 0.9, 2: 0.8, 3: 0.7}
        
        # Configuración adicional para mejor rendimiento
        self.target_fps = 15  # FPS objetivo máximo
        self.last_frame_time = time.time()
        self.frame_count = 0
        self.fps_history = []
        
    def optimize_frame(self, frame, client_count=1, force_level=None):
        """Optimizar frame según carga y condiciones"""
        if frame is None:
            return None, 85
        
        # NUEVA CARACTERÍSTICA: Control de FPS adaptativo
        # Si estamos generando frames demasiado rápido, saltear algunos
        current_time = time.time()
        time_since_last = current_time - self.last_frame_time
        
        # Calcular FPS actual
        if time_since_last > 0:
            current_fps = 1.0 / time_since_last
            
            # Mantener historial de FPS
            self.fps_history.append(current_fps)
            if len(self.fps_history) > 10:
                self.fps_history = self.fps_history[-10:]
            
            # FPS promedio reciente
            avg_fps = sum(self.fps_history) / len(self.fps_history)
            
            # Si el FPS es demasiado alto, reducirlo (excepto cuando se fuerza un nivel)
            if force_level is None and avg_fps > self.target_fps * 1.2:
                # Incrementar nivel de optimización para reducir carga
                force_level = min(self.optimization_level + 1, 3)
            
        # Actualizar tiempo del último frame
        self.last_frame_time = current_time
        self.frame_count += 1
            
        # Determinar nivel de optimización
        if force_level is not None:
            level = min(max(force_level, 0), 3)
        else:
            level = self._determine_optimization_level(client_count)
        
        # Aplicar optimizaciones según nivel
        quality = self.quality_levels.get(level, 85)
        resize_factor = self.resize_factors.get(level, 1.0)
        
        # Si el nivel es 3 (muy alto), reducir aún más la resolución
        if level == 3 and client_count >= 2:
            resize_factor *= 0.8  # Reducción adicional del 20%
        
        # Aplicar resize si es necesario
        if resize_factor < 1.0 and frame is not None:
            try:
                h, w = frame.shape[:2]
                new_w = max(int(w * resize_factor), 320)  # Mínimo ancho 320px
                new_h = max(int(h * resize_factor), 240)  # Mínimo altura 240px
                frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
            except Exception as e:
                logger.error(f"Error durante el resize de imagen: {e}")
        
        # Actualizar estado para próximos frames
        self.optimization_level = level
        
        return frame, quality
    
    def _determine_optimization_level(self, client_count):
        """Determina el nivel de optimización según métricas actuales"""
        # Nivel base según número de clientes
        if client_count > 4:
            level = 3  # Optimización máxima para muchos clientes
        elif client_count > 2:
            level = 2  # Optimización moderada
        elif client_count > 1:
            level = 1  # Optimización leve
        else:
            level = 0  # Sin optimización para un solo cliente
            
        return level

async def shutdown_mjpeg():
    """Función para apagar limpiamente el sistema MJPEG y limpiar todos los recursos"""
    global frame_queues, active_clients
    
    logger.info("🛑 Iniciando apagado del sistema MJPEG...")
    
    try:
        # Marcar todos los clientes como inactivos
        for client_id in list(frame_queues.keys()):
            if client_id in frame_queues:
                frame_queues[client_id]["active"] = False
        
        # Limpiar todos los clientes usando la función optimizada
        cleanup_tasks = []
        for client_id in list(frame_queues.keys()):
            cleanup_tasks.append(cleanup_client_resources(client_id, "apagado del sistema"))
        
        # Ejecutar limpieza en paralelo
        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
        
        # Resetear contadores
        active_clients = {"road": 0, "interior": 0}
        
        # Limpiar frames cache
        last_frames.clear()
        last_frame_time.clear()
        
        logger.info("✓ Sistema MJPEG apagado correctamente")
        
    except Exception as e:
        logger.error(f"Error durante el apagado del sistema MJPEG: {e}")

def get_shared_frame(camera_type: str):
    """
    Función para que otros módulos (como WebRTC) accedan a los frames 
    ya capturados por el worker MJPEG, evitando duplicación de captura
    """
    if camera_type in last_frames and last_frames[camera_type] is not None:
        # Verificar que el frame no sea muy antiguo (máximo 1 segundo)
        if time.time() - last_frame_time.get(camera_type, 0) < 1.0:
            return last_frames[camera_type].copy()
    
    # Si no hay frame reciente, generar uno por defecto
    return generate_default_frame(camera_type, "Frame no disponible", (640, 480))

def is_mjpeg_worker_active():
    """Verificar si el worker MJPEG está activo y capturando frames"""
    return any(active_clients.values()) or (
        time.time() - max(last_frame_time.values(), default=0) < 5.0
    )

async def native_mjpeg_generator(request: Request, camera_type: str, client_id: str):
    """Generador MJPEG nativo usando encoders hardware/software nativos"""
    # Verificar límite de clientes
    current_clients = active_clients.get(camera_type, 0)
    
    if current_clients > 5:
        logger.warning(f"Demasiados clientes activos para {camera_type}, rechazando nueva conexión")
        warning_frame = generate_default_frame(camera_type, 
                                              "Demasiadas conexiones activas. Reintente más tarde.", 
                                              (640, 480))
        _, jpeg = cv2.imencode('.jpg', warning_frame)
        warning_bytes = jpeg.tobytes()
        yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + warning_bytes + b'\r\n'
        return

    try:
        # Obtener la cámara correspondiente
        if camera_manager is None:
            logger.error("Camera manager no disponible")
            return
            
        camera_attr = f"{camera_type}_camera"
        if not hasattr(camera_manager, camera_attr):
            logger.error(f"Cámara {camera_type} no disponible en camera_manager")
            return
            
        camera = getattr(camera_manager, camera_attr)
        if camera is None:
            logger.error(f"Cámara {camera_type} es None")
            return

        # Determinar calidad basada en parámetros del request
        quality_param = request.query_params.get('quality', 'medium').lower()
        if quality_param not in ['low', 'medium', 'high']:
            quality_param = 'medium'

        # Iniciar streaming nativo
        streaming_output = camera.start_mjpeg_stream(quality=quality_param)
        if streaming_output is None:
            logger.error(f"No se pudo iniciar streaming nativo para {camera_type}")
            return

        # Registrar cliente
        client_ip = getattr(request.client, "host", "unknown")
        frame_queues[client_id] = {
            "camera_type": camera_type,
            "last_activity": time.time(),
            "active": True,
            "connection_time": time.time(),
            "frames_sent": 0,
            "ip": client_ip,
            "native_stream": True
        }
        
        active_clients[camera_type] += 1
        stats["clients_connected"] += 1
        
        logger.info(f"Cliente MJPEG nativo conectado para {camera_type}. ID: {client_id}")

        # Generar frames desde el streaming nativo
        consecutive_timeouts = 0
        max_timeouts = 10
        
        while True:
            if await request.is_disconnected():
                logger.info(f"Cliente MJPEG nativo desconectado. ID: {client_id}")
                break
                
            # Verificar si el cliente aún está activo
            if client_id not in frame_queues or not frame_queues[client_id].get("active", False):
                break
                
            try:
                # Leer frame del streaming output con timeout
                frame_data = streaming_output.read(timeout=1.0)
                
                if frame_data:
                    # Enviar frame en formato MJPEG
                    yield (b"--frame\r\n"
                           b"Content-Type: image/jpeg\r\n"
                           b"Content-Length: " + f"{len(frame_data)}".encode() + b"\r\n"
                           b"\r\n" + frame_data + b"\r\n")
                    
                    # Actualizar estadísticas
                    if client_id in frame_queues:
                        frame_queues[client_id]["last_activity"] = time.time()
                        frame_queues[client_id]["frames_sent"] += 1
                    
                    consecutive_timeouts = 0
                else:
                    consecutive_timeouts += 1
                    if consecutive_timeouts >= max_timeouts:
                        logger.warning(f"Demasiados timeouts consecutivos para {client_id}")
                        break
                    
                    # Pequeña pausa en caso de timeout
                    await asyncio.sleep(0.1)
                    
            except Exception as e:
                logger.error(f"Error en streaming nativo para {client_id}: {e}")
                break

    except Exception as e:
        logger.error(f"Error en generador MJPEG nativo: {e}")
    finally:
        # Limpiar recursos
        try:
            if camera_manager and hasattr(camera_manager, camera_attr):
                camera = getattr(camera_manager, camera_attr)
                if camera:
                    camera.stop_mjpeg_stream()
        except Exception as e:
            logger.error(f"Error deteniendo streaming nativo: {e}")
            
        # Limpiar cliente
        if client_id in frame_queues:
            del frame_queues[client_id]
        if camera_type in active_clients:
            active_clients[camera_type] = max(0, active_clients[camera_type] - 1)
            
        logger.info(f"Cliente MJPEG nativo {client_id} limpiado")
