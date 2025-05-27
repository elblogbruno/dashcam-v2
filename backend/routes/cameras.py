from fastapi import APIRouter, HTTPException, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
import io
import cv2
import numpy as np
from typing import Optional, List, Dict
import time
import asyncio
import threading
import queue

router = APIRouter()

# Estas variables serán inicializadas desde main.py
camera_manager = None

# Colas para almacenar los frames más recientes
road_frame_queue = queue.Queue(maxsize=1)
interior_frame_queue = queue.Queue(maxsize=1)
is_capturing = False
capture_thread = None

def capture_frames():
    """Captura frames en un hilo separado para no bloquear el servidor"""
    global is_capturing
    
    fps_target = 15  # Frames por segundo objetivo (aumentado para mejor fluidez)
    frame_time = 1.0 / fps_target
    error_count = 0
    max_errors = 10  # Número máximo de errores consecutivos antes de detener el hilo
    
    # Variables para control de rendimiento
    last_fps_log = time.time()
    frames_captured = 0
    
    try:
        while is_capturing:
            try:
                start_time = time.time()
                
                # Obtener frame de la cámara de carretera
                if camera_manager and camera_manager.road_camera:
                    frame = camera_manager.get_preview_frame(camera_type="road")
                    if frame is not None:
                        # Reducir resolución para mejorar rendimiento
                        scale_factor = 0.5  # 50% del tamaño original
                        width = int(frame.shape[1] * scale_factor)
                        height = int(frame.shape[0] * scale_factor)
                        frame = cv2.resize(frame, (width, height))
                        
                        # Optimizar calidad JPEG para mejor rendimiento
                        # Usamos 75 para un buen balance entre calidad y rendimiento
                        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
                        success, buffer = cv2.imencode('.jpg', frame, encode_param)
                        if success:
                            # Actualizar el frame en la cola (elimina cualquier frame antiguo)
                            try:
                                # Vaciar la cola sin bloquear
                                while not road_frame_queue.empty():
                                    road_frame_queue.get_nowait()
                                # Añadir el nuevo frame
                                road_frame_queue.put(buffer.tobytes(), block=False)
                                frames_captured += 1
                                error_count = 0  # Reiniciar contador de errores si todo va bien
                            except queue.Full:
                                # La cola está llena pero no es un error
                                pass
                            except Exception as e:
                                print(f"Error al actualizar cola de frames para cámara frontal: {str(e)}")
                
                # Obtener frame de la cámara interior
                if camera_manager and camera_manager.interior_camera:
                    frame = camera_manager.get_preview_frame(camera_type="interior")
                    if frame is not None:
                        # Reducir resolución para mejorar rendimiento
                        scale_factor = 0.5  # 50% del tamaño original
                        width = int(frame.shape[1] * scale_factor)
                        height = int(frame.shape[0] * scale_factor)
                        frame = cv2.resize(frame, (width, height))
                        
                        # Optimizar calidad JPEG para mejor rendimiento
                        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
                        success, buffer = cv2.imencode('.jpg', frame, encode_param)
                        if success:
                            # Actualizar el frame en la cola (elimina cualquier frame antiguo)
                            try:
                                # Vaciar la cola sin bloquear
                                while not interior_frame_queue.empty():
                                    interior_frame_queue.get_nowait()
                                # Añadir el nuevo frame
                                interior_frame_queue.put(buffer.tobytes(), block=False)
                                frames_captured += 1
                                error_count = 0  # Reiniciar contador de errores si todo va bien
                            except queue.Full:
                                # La cola está llena pero no es un error
                                pass
                            except Exception as e:
                                print(f"Error al actualizar cola de frames para cámara interior: {str(e)}")
                
                # Registrar FPS efectivo cada 10 segundos para monitoreo
                now = time.time()
                if now - last_fps_log > 10:
                    elapsed = now - last_fps_log
                    if elapsed > 0:
                        effective_fps = frames_captured / elapsed
                        print(f"[Info] FPS efectivo del servidor: {effective_fps:.2f} frames/s")
                        frames_captured = 0
                        last_fps_log = now
                
                # Mantener la velocidad de captura deseada
                elapsed = time.time() - start_time
                sleep_time = max(0, frame_time - elapsed)
                
                # Registrar FPS efectivo cada 10 segundos para monitoreo
                now = time.time()
                if now - last_fps_log > 10:
                    elapsed_log = now - last_fps_log
                    if elapsed_log > 0 and frames_captured > 0:
                        effective_fps = frames_captured / elapsed_log
                        print(f"[Info] FPS efectivo del servidor: {effective_fps:.2f} frames/s")
                        frames_captured = 0
                        last_fps_log = now
                
                # Solo dormimos si es necesario para mantener el FPS objetivo
                if sleep_time > 0.001:  # Ignorar tiempos muy pequeños
                    time.sleep(sleep_time)
                
            except Exception as e:
                # Incrementar contador de errores y pausar brevemente
                error_count += 1
                print(f"Error en captura de frames: {str(e)}. Error #{error_count}")
                
                # Si hay demasiados errores seguidos, detenemos el hilo
                if error_count >= max_errors:
                    print(f"Demasiados errores consecutivos ({error_count}), deteniendo hilo de captura")
                    is_capturing = False
                    break
                    
                # Pausa breve para no consumir recursos en caso de error continuo
                time.sleep(0.5)
                
    except Exception as e:
        print(f"Error fatal en hilo de captura: {str(e)}")
    finally:
        is_capturing = False
        print("Hilo de captura de frames finalizado")

def start_capture_thread():
    """Inicia el hilo de captura si no está corriendo"""
    global is_capturing, capture_thread
    
    if not is_capturing:
        is_capturing = True
        capture_thread = threading.Thread(target=capture_frames)
        capture_thread.daemon = True
        capture_thread.start()

def get_frames(camera_type: str):
    """Generador que devuelve frames MJPEG para streaming"""
    global is_capturing
    
    # Asegurar que el hilo de captura esté funcionando
    if not is_capturing:
        start_capture_thread()
    
    frame_queue = road_frame_queue if camera_type == "road" else interior_frame_queue
    
    # Variables para manejar timeout en caso de no recibir frames
    last_valid_frame_time = time.time()
    timeout_seconds = 5  # Segundos sin frames antes de considerar error
    connection_id = f"{camera_type}_{int(time.time())}"
    
    # Registrar nueva conexión para diagnóstico
    print(f"Nueva conexión MJPEG iniciada para cámara {camera_type} - ID: {connection_id}")
    
    # Para evitar procesamiento excesivo en caso de múltiples clientes
    frame_throttle = 0.03  # 30ms mínimo entre frames para mejor rendimiento
    last_frame_sent = 0
    
    try:
        while True:
            current_time = time.time()
            frame_bytes = None
            
            # Control de frecuencia de envío para no saturar la red
            since_last_frame = current_time - last_frame_sent
            if since_last_frame < frame_throttle:
                # Esperar menos tiempo para ser más responsivo
                time.sleep(frame_throttle / 3)
                continue
            
            # Verificar si ha pasado demasiado tiempo sin frames válidos
            if current_time - last_valid_frame_time > timeout_seconds:
                print(f"Timeout esperando frames de la cámara {camera_type} - ID: {connection_id}")
                # Enviar un mensaje de error como imagen
                error_message = f"Camera timeout: No frames received for {timeout_seconds} seconds"
                error_frame = create_error_frame(error_message)
                if error_frame is not None:
                    yield error_frame
                    # Reiniciar temporizador para no enviar errores constantemente
                    last_valid_frame_time = current_time
                    last_frame_sent = current_time
                    continue
            
            # Intentar obtener un frame de la cola sin bloquear
            try:
                if not frame_queue.empty():
                    frame_bytes = frame_queue.get_nowait()
                    # Si obtenemos un frame válido, actualizamos el timestamp
                    if frame_bytes:
                        last_valid_frame_time = current_time
            except queue.Empty:
                # Cola vacía, esperamos un poco
                time.sleep(frame_throttle)
                continue
            except Exception as e:
                print(f"Error obteniendo frame de la cola: {str(e)}")
                time.sleep(frame_throttle)
                continue
            
            # Si tenemos un frame válido, lo enviamos
            if frame_bytes:
                try:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n'
                           b'Content-Length: ' + f"{len(frame_bytes)}".encode() + b'\r\n'
                           b'\r\n' + frame_bytes + b'\r\n')
                    last_frame_sent = current_time
                except Exception as e:
                    print(f"Error enviando frame: {str(e)}")
            else:
                # Sin frame, pequeña pausa para no saturar la CPU
                # Usar un tiempo de espera menor para ser más responsivo
                time.sleep(frame_throttle / 2)
    except Exception as e:
        print(f"Error en generador de frames para {camera_type} (ID: {connection_id}): {str(e)}")
    finally:
        # No detenemos el hilo de captura aquí, ya que puede haber múltiples clientes
        print(f"Stream de {camera_type} finalizado - ID: {connection_id}")

def create_error_frame(message: str):
    """Crea un frame con un mensaje de error para mostrar al cliente"""
    try:
        # Crear una imagen negra de 640x480
        height, width = 480, 640
        image = np.zeros((height, width, 3), np.uint8)
        
        # Añadir texto
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.7
        color = (255, 255, 255)  # Blanco
        thickness = 2
        
        # Dividir el mensaje en líneas
        words = message.split(' ')
        lines = []
        current_line = ""
        
        for word in words:
            test_line = current_line + " " + word if current_line else word
            # Limitar la longitud de línea
            if len(test_line) > 40:
                lines.append(current_line)
                current_line = word
            else:
                current_line = test_line
                
        if current_line:
            lines.append(current_line)
        
        # Dibujar cada línea
        y_position = height // 2 - len(lines) * 20
        for line in lines:
            # Obtener tamaño del texto para centrarlo
            text_size = cv2.getTextSize(line, font, font_scale, thickness)[0]
            x_position = (width - text_size[0]) // 2
            y_position += 40  # Espacio entre líneas
            
            cv2.putText(image, line, (x_position, y_position), 
                        font, font_scale, color, thickness)
        
        # Convertir a JPEG
        success, buffer = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if success:
            frame_bytes = buffer.tobytes()
            return (b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n'
                    b'Content-Length: ' + f"{len(frame_bytes)}".encode() + b'\r\n'
                    b'\r\n' + frame_bytes + b'\r\n')
        return None
    except Exception as e:
        print(f"Error creando frame de error: {str(e)}")
        return None

# Ruta para streaming MJPEG de la cámara frontal (carretera)
@router.get("/road/stream")
async def get_road_camera_stream():
    """
    Retorna un stream MJPEG de la cámara frontal (carretera)
    """
    if not camera_manager:
        raise HTTPException(status_code=503, detail="Camera system not initialized")
    
    # Incluso si la cámara no está disponible, intentamos ofrecer un stream con mensaje de error
    # en lugar de fallar inmediatamente
    if not camera_manager.road_camera:
        # Verificar si la cámara tiene errores específicos
        error_message = "Road camera not available"
        if hasattr(camera_manager, 'camera_errors') and camera_manager.camera_errors:
            # Añadir detalles específicos del error
            camera_errors = [err for err in camera_manager.camera_errors if "road" in err.lower()]
            if camera_errors:
                error_message += f": {camera_errors[0]}"
        
        # Retornar un stream con un mensaje de error visual
        try:
            def error_stream():
                while True:
                    yield create_error_frame(error_message)
                    time.sleep(1)  # Actualizar el mensaje cada segundo
                    
            return StreamingResponse(
                error_stream(),
                media_type="multipart/x-mixed-replace; boundary=frame",
                headers={"X-Stream-ID": f"road_error_{int(time.time())}"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating error stream: {str(e)}")
    
    try:
        # Añadir un encabezado con ID único para ayudar a diagnosticar conexiones
        return StreamingResponse(
            get_frames(camera_type="road"),
            media_type="multipart/x-mixed-replace; boundary=frame",
            headers={"X-Stream-ID": f"road_{int(time.time())}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Camera error: {str(e)}")

# Ruta para streaming MJPEG de la cámara interior
@router.get("/interior/stream")
async def get_interior_camera_stream():
    """
    Retorna un stream MJPEG de la cámara interior
    """
    if not camera_manager:
        raise HTTPException(status_code=503, detail="Camera system not initialized")
    
    # Incluso si la cámara no está disponible, intentamos ofrecer un stream con mensaje de error
    # en lugar de fallar inmediatamente
    if not camera_manager.interior_camera:
        # Verificar si la cámara tiene errores específicos
        error_message = "Interior camera not available"
        if hasattr(camera_manager, 'camera_errors') and camera_manager.camera_errors:
            # Añadir detalles específicos del error
            camera_errors = [err for err in camera_manager.camera_errors if "interior" in err.lower()]
            if camera_errors:
                error_message += f": {camera_errors[0]}"
        
        # Retornar un stream con un mensaje de error visual
        try:
            def error_stream():
                while True:
                    yield create_error_frame(error_message)
                    time.sleep(1)  # Actualizar el mensaje cada segundo
                    
            return StreamingResponse(
                error_stream(),
                media_type="multipart/x-mixed-replace; boundary=frame",
                headers={"X-Stream-ID": f"interior_error_{int(time.time())}"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating error stream: {str(e)}")
    
    try:
        # Añadir un encabezado con ID único para ayudar a diagnosticar conexiones
        return StreamingResponse(
            get_frames(camera_type="interior"),
            media_type="multipart/x-mixed-replace; boundary=frame",
            headers={"X-Stream-ID": f"interior_{int(time.time())}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Camera error: {str(e)}")

# Para compatibilidad, mantenemos los endpoints que devuelven un solo fotograma
@router.get("/road/frame")
async def get_road_camera_frame():
    """
    Retorna un fotograma único de la cámara frontal (carretera)
    """
    if not camera_manager:
        raise HTTPException(status_code=503, detail="Camera system not initialized")
    
    # Si la cámara no está disponible, creamos una imagen de error
    if not camera_manager.road_camera:
        error_message = "Road camera not available"
        # Verificar si la cámara tiene errores específicos
        if hasattr(camera_manager, 'camera_errors') and camera_manager.camera_errors:
            camera_errors = [err for err in camera_manager.camera_errors if "road" in err.lower()]
            if camera_errors:
                error_message += f": {camera_errors[0]}"
                
        # Retornar imagen de error
        return Response(
            content=create_error_image(error_message),
            media_type="image/jpeg"
        )
    
    try:
        # Intentar obtener el frame de la cola primero (más rápido que capturar uno nuevo)
        if not road_frame_queue.empty():
            try:
                frame_bytes = road_frame_queue.get_nowait()
                if frame_bytes:
                    return Response(
                        content=frame_bytes,
                        media_type="image/jpeg"
                    )
            except Exception:
                # Si falla, continuamos con el método normal
                pass
        
        # Si no hay frame en la cola, intentamos obtener uno nuevo
        frame = camera_manager.get_preview_frame(camera_type="road")
        
        if frame is None:
            # Si no se puede obtener frame, retornar imagen de error
            return Response(
                content=create_error_image("Failed to get camera frame"),
                media_type="image/jpeg"
            )
        
        # Reducir resolución para mejorar rendimiento
        scale_factor = 0.5
        width = int(frame.shape[1] * scale_factor)
        height = int(frame.shape[0] * scale_factor)
        frame = cv2.resize(frame, (width, height))
        
        # Usar menor calidad JPEG para transmisión más rápida
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        success, buffer = cv2.imencode('.jpg', frame, encode_param)
        
        if not success:
            return Response(
                content=create_error_image("Could not encode image"),
                media_type="image/jpeg"
            )
        
        # Convertir a bytes y retornar
        return Response(
            content=buffer.tobytes(),
            media_type="image/jpeg"
        )
    except Exception as e:
        # En caso de error, retornar imagen de error
        error_msg = f"Camera error: {str(e)}"
        return Response(
            content=create_error_image(error_msg),
            media_type="image/jpeg",
            status_code=500
        )

@router.get("/interior/frame")
async def get_interior_camera_frame():
    """
    Retorna un fotograma único de la cámara interior
    """
    if not camera_manager:
        raise HTTPException(status_code=503, detail="Camera system not initialized")
    
    # Si la cámara no está disponible, creamos una imagen de error
    if not camera_manager.interior_camera:
        error_message = "Interior camera not available"
        # Verificar si la cámara tiene errores específicos
        if hasattr(camera_manager, 'camera_errors') and camera_manager.camera_errors:
            camera_errors = [err for err in camera_manager.camera_errors if "interior" in err.lower()]
            if camera_errors:
                error_message += f": {camera_errors[0]}"
        
        # Retornar imagen de error
        return Response(
            content=create_error_image(error_message),
            media_type="image/jpeg"
        )
    
    try:
        # Intentar obtener el frame de la cola primero (más rápido que capturar uno nuevo)
        if not interior_frame_queue.empty():
            try:
                frame_bytes = interior_frame_queue.get_nowait()
                if frame_bytes:
                    return Response(
                        content=frame_bytes,
                        media_type="image/jpeg"
                    )
            except Exception:
                # Si falla, continuamos con el método normal
                pass
        
        # Si no hay frame en la cola, intentamos obtener uno nuevo
        frame = camera_manager.get_preview_frame(camera_type="interior")
        
        if frame is None:
            # Si no se puede obtener frame, retornar imagen de error
            return Response(
                content=create_error_image("Failed to get camera frame"),
                media_type="image/jpeg"
            )
        
        # Reducir resolución para mejorar rendimiento
        scale_factor = 0.5
        width = int(frame.shape[1] * scale_factor)
        height = int(frame.shape[0] * scale_factor)
        frame = cv2.resize(frame, (width, height))
        
        # Usar menor calidad JPEG para transmisión más rápida
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        success, buffer = cv2.imencode('.jpg', frame, encode_param)
        
        if not success:
            return Response(
                content=create_error_image("Could not encode image"),
                media_type="image/jpeg"
            )
        
        # Convertir a bytes y retornar
        return Response(
            content=buffer.tobytes(),
            media_type="image/jpeg"
        )
    except Exception as e:
        # En caso de error, retornar imagen de error
        error_msg = f"Camera error: {str(e)}"
        return Response(
            content=create_error_image(error_msg),
            media_type="image/jpeg",
            status_code=500
        )

def create_error_image(message: str):
    """
    Crea una imagen con un mensaje de error y la retorna como bytes JPEG
    """
    try:
        # Crear una imagen negra de 640x480
        height, width = 480, 640
        image = np.zeros((height, width, 3), np.uint8)
        font = cv2.FONT_HERSHEY_SIMPLEX
        
        # Dividir mensaje en líneas
        lines = []
        words = message.split(' ')
        current_line = ""
        
        for word in words:
            test_line = current_line + " " + word if current_line else word
            if len(test_line) > 40:
                lines.append(current_line)
                current_line = word
            else:
                current_line = test_line
                
        if current_line:
            lines.append(current_line)
        
        # Dibujar cada línea
        y_position = height // 2 - len(lines) * 20
        for line in lines:
            text_size = cv2.getTextSize(line, font, 0.7, 2)[0]
            x_position = (width - text_size[0]) // 2
            y_position += 40
            cv2.putText(image, line, (x_position, y_position), 
                        font, 0.7, (255, 255, 255), 2)
        
        # Convertir a JPEG
        success, buffer = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if success:
            return buffer.tobytes()
        
        # Si falla, retornar una imagen de error muy simple
        return b""
    except Exception as e:
        print(f"Error creating error image: {str(e)}")
        return b""

# DESHABILITADO: Worker de captura duplicado que causa saturación de FPS
# Al usar múltiples workers (MJPEG + WebRTC + este), se crean frames a ~25 FPS
# en lugar del objetivo de 15 FPS, saturando las colas de clientes
# start_capture_thread()