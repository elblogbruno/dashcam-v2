import fractions
import av
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack, RTCIceCandidate
from aiortc.contrib.media import MediaRelay, MediaStreamError
import asyncio
import json
import logging
import traceback
import numpy as np
import threading
import time
import uuid
import cv2
from shutdown_control import should_continue_loop, register_task

# Import our custom modules
from .webrtc_modules.camera_frame_provider import CameraFrameProvider
from .webrtc_modules.webrtc_utils import (
    create_video_frame, parse_sdp_offer, create_custom_sdp_offer,
    create_custom_sdp_answer, parse_ice_candidate
)
from .webrtc_modules.webrtc_helper import webrtc_manager, initialize_webrtc_helper

logger = logging.getLogger(__name__)
router = APIRouter()

# These variables will be initialized from main.py
camera_manager = None

# MediaRelay to handle media tracks for multiple connections
relay = MediaRelay()  # Maneja frames para múltiples conexiones

# Estado del streaming WebRTC (desactivado por defecto)
streaming_enabled = {
    "road": False,
    "interior": False
}

# Configuración para mejorar rendimiento
WEBRTC_CONNECTION_TIMEOUT = 30  # segundos
MAX_ICE_GATHERING_TIMEOUT = 10000  # milisegundos
HEARTBEAT_TIMEOUT = 15  # segundos - tiempo máximo sin heartbeat antes de cerrar la conexión
HEARTBEAT_CHECK_INTERVAL = 5  # segundos - intervalo para verificar heartbeats

# Store active RTCPeerConnection instances
peer_connections = {}
# Almacena el último tiempo de heartbeat de cada conexión
connection_last_heartbeat = {}

# Create frame provider
frame_provider = None

# Initialize frame provider when this module is imported
async def initialize_webrtc():
    """Initialize the WebRTC system"""
    global frame_provider
    
    logger.info("🚀 Initializing WebRTC module with improved stability...")
    
    # CRÍTICO: Verificar que camera_manager esté disponible antes de inicializar
    if camera_manager is None:
        logger.error("❌ camera_manager no está disponible, WebRTC no puede inicializar correctamente")
        return False
    
    frame_provider = CameraFrameProvider(camera_manager=camera_manager)
    
    # OPTIMIZACIÓN: No iniciar worker de captura duplicado si MJPEG ya está activo
    # Esto evita la saturación de FPS causada por múltiples workers
    try:
        # Verificar si el sistema MJPEG ya está capturando frames
        from backend.routes import mjpeg_stream
        if hasattr(mjpeg_stream, 'active_clients') and any(mjpeg_stream.active_clients.values()):
            logger.info("🔄 MJPEG worker already active, using shared frames instead of starting duplicate worker")
        else:
            # Solo iniciar worker si no hay sistema MJPEG activo
            frame_capture_task = asyncio.create_task(frame_provider.capture_frame_worker())
            register_task(frame_capture_task, "webrtc_frame_capture")
            logger.info("✅ Started WebRTC frame capture worker")
    except Exception as e:
        # Fallback: iniciar worker si no se puede verificar MJPEG
        logger.warning(f"Could not check MJPEG status, starting WebRTC worker anyway: {e}")
        frame_capture_task = asyncio.create_task(frame_provider.capture_frame_worker())
        register_task(frame_capture_task, "webrtc_frame_capture")
    
    # Iniciar worker de verificación de heartbeats
    heartbeat_task = asyncio.create_task(check_inactive_connections())
    register_task(heartbeat_task, "webrtc_heartbeat")
    
    # Initialize the WebRTC helper
    await initialize_webrtc_helper()
    
    logger.info("✓ WebRTC module initialized successfully")

@router.post("/close_connections")
async def close_webrtc_connections():
    """Cierra todas las conexiones WebRTC activas
    
    Este endpoint se utiliza cuando se cambia el modo de streaming a MJPEG
    para liberar recursos y evitar múltiples conexiones simultáneas.
    """
    global peer_connections
    
    try:
        logger.info(f"Cerrando {len(peer_connections)} conexiones WebRTC activas")
        
        # Crear una copia de claves para evitar cambios durante la iteración
        connection_ids = list(peer_connections.keys())
        
        # Cerrar cada conexión
        for pc_id in connection_ids:
            if pc_id in peer_connections:
                pc = peer_connections[pc_id]
                await pc.close()
                logger.info(f"Conexión WebRTC cerrada: {pc_id}")
        
        # Limpiar el diccionario
        peer_connections.clear()
        
        return {"status": "success", "message": f"Cerradas {len(connection_ids)} conexiones WebRTC"}
    except Exception as e:
        logger.error(f"Error cerrando conexiones WebRTC: {str(e)}")
        return {"status": "error", "message": f"Error: {str(e)}"}
    
async def check_inactive_connections():
    """
    Worker que verifica periódicamente las conexiones inactivas 
    y cierra aquellas que no han enviado heartbeat en el tiempo establecido.
    """
    logger.info("🔍 Iniciando worker de monitoreo de conexiones WebRTC inactivas")
    
    while should_continue_loop("webrtc"):
        try:
            current_time = time.time()
            connections_to_close = []
            
            # Verificar todas las conexiones activas
            for connection_id, last_heartbeat in connection_last_heartbeat.items():
                if current_time - last_heartbeat > HEARTBEAT_TIMEOUT:
                    logger.info(f"Conexión WebRTC {connection_id} inactiva por {HEARTBEAT_TIMEOUT}s, cerrando...")
                    connections_to_close.append(connection_id)
            
            # Cerrar las conexiones inactivas
            for connection_id in connections_to_close:
                await cleanup_connection(connection_id)
                
        except Exception as e:
            logger.error(f"Error en worker de monitoreo de conexiones: {str(e)}")
        
        # Esperar antes de la próxima verificación
        await asyncio.sleep(HEARTBEAT_CHECK_INTERVAL)
    
    logger.info("🛑 Worker de monitoreo WebRTC terminado")

# Endpoint to check WebRTC status
@router.get("/status")
async def get_webrtc_status():
    """Get status of WebRTC subsystem"""
    global frame_provider
    
    # Verify frame provider is running
    frame_provider_ok = frame_provider is not None
    
    # Get information about active peers
    active_connections = len(webrtc_manager.active_peers)
    camera_info = {}
    
    if camera_manager:
        camera_info = {
            "road": {
                "available": camera_manager.road_camera is not None,
                "initialized": getattr(camera_manager.road_camera, "is_initialized", False) if camera_manager.road_camera else False
            },
            "interior": {
                "available": camera_manager.interior_camera is not None,
                "initialized": getattr(camera_manager.interior_camera, "is_initialized", False) if camera_manager.interior_camera else False
            }
        }
    
    return {
        "status": "ok" if frame_provider_ok else "error",
        "active_connections": active_connections,
        "camera_status": camera_info,
        "uptime": time.time() - webrtc_manager.start_time if hasattr(webrtc_manager, "start_time") else 0,
        "streaming_enabled": streaming_enabled
    }

class CameraStreamTrack(MediaStreamTrack):
    """Video track that captures frames from a camera."""
    kind = "video"
    
    def __init__(self, camera_type="road"):
        super().__init__()
        self.camera_type = camera_type
        self.frame_counter = 0
        self._last_frame_time = time.time()
        self._running = True
        self._last_frame = None
        self.target_fps = 12  # Reducido para mejorar la estabilidad y reducir el lag
        self.min_frame_interval = 1.0 / 20  # Maximum 20fps (minimum interval)
        self.frame_interval = 1.0 / self.target_fps
        self.frame_stats = {"queue": 0, "buffer": 0, "stale_buffer": 0, "default": 0, "cached": 0}
        self._cached_frame = None
        self._cached_frame_time = 0
        
    async def recv(self):
        """Get the next frame with improved frame timing control."""
        # Check if streaming is enabled for this camera type
        if not streaming_enabled.get(self.camera_type, False):
            # Create a frame indicating streaming is disabled
            import cv2
            import numpy as np
            
            # Create a visual message for the user
            img = np.zeros((480, 640, 3), dtype=np.uint8)
            font = cv2.FONT_HERSHEY_SIMPLEX
            cv2.putText(img, "Streaming WebRTC desactivado", (120, 240), font, 1, (255, 255, 255), 2)
            cv2.putText(img, "Active el streaming desde el botón", (100, 280), font, 1, (255, 255, 255), 2)
            cv2.putText(img, f"Cámara: {self.camera_type}", (240, 320), font, 1, (0, 120, 255), 2)
            
            # Convert to av.VideoFrame
            av_frame = av.VideoFrame.from_ndarray(img, format="bgr24")
            av_frame.time_base = fractions.Fraction(1, 90000)
            av_frame.pts = self.frame_counter
            self.frame_counter += 90000 // self.target_fps
            
            # Short sleep to avoid high CPU usage
            await asyncio.sleep(0.5)
            
            return av_frame
        
        # Calculate time since last frame
        current_time = time.time()
        elapsed = current_time - self._last_frame_time
        
        # Dynamic throttling based on how recently we received a frame
        if elapsed < self.min_frame_interval:
            # Short sleep for high framerate scenarios
            await asyncio.sleep(self.min_frame_interval - elapsed)
        elif elapsed < self.frame_interval:
            # Normal throttle for target framerate
            await asyncio.sleep(self.frame_interval - elapsed)
            
        # Check if track is still active
        if not self._running:
            raise MediaStreamError("Track has ended")
        
        self._last_frame_time = time.time()
        
        try:
            # Get frame from provider with enhanced caching
            frame, source = await frame_provider.get_frame(self.camera_type)
            
            # Update stats for monitoring
            if source in self.frame_stats:
                self.frame_stats[source] += 1
            
            # Cache the frame if it's a good quality one (from queue or fresh buffer)
            if source in ["queue", "buffer"] and frame is not None:
                self._cached_frame = frame.copy()
                self._cached_frame_time = time.time()
            
            # If we got a default/error frame but have a recent cached frame, use it instead
            if source in ["default", "stale_buffer"] and self._cached_frame is not None:
                # Reducir el tiempo máximo de caché a 1 segundo para evitar mostrar frames antiguos
                if (time.time() - self._cached_frame_time) < 1.0:
                    frame = self._cached_frame.copy()
                    # Mark frame as cached with timestamp
                    h, w = frame.shape[:2]
                    cache_age_ms = int((time.time() - self._cached_frame_time) * 1000)
                    cv2.putText(
                        frame, f"CACHED ({cache_age_ms}ms)", (w//2 - 100, h - 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 1, cv2.LINE_AA
                    )
                    source = "cached"
                    if "cached" not in self.frame_stats:
                        self.frame_stats["cached"] = 0
                    self.frame_stats["cached"] += 1
            
            # Convert to av.VideoFrame with better error handling
            try:
                # Check if frame has 4 channels (RGBA/BGRA) and convert to 3 channels (BGR)
                if frame is not None and len(frame.shape) == 3 and frame.shape[2] == 4:
                    logger.debug(f"Converting RGBA/BGRA frame to BGR (shape before: {frame.shape})")
                    frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                    
                av_frame = av.VideoFrame.from_ndarray(frame, format="bgr24")
                # Assign time_base and pts for timing
                av_frame.time_base = fractions.Fraction(1, 90000)  # Standard for video
                av_frame.pts = self.frame_counter
                self.frame_counter += 90000 // self.target_fps
                
                # Cache last successful frame
                self._last_frame = av_frame
                return av_frame
                
            except Exception as frame_error:
                logger.error(f"Error converting frame: {str(frame_error)}")
                raise
            
        except Exception as e:
            logger.error(f"Error in CameraStreamTrack.recv: {str(e)}")
            
            # Use last successful frame if available (better than default error frame)
            if self._last_frame:
                return self._last_frame
                
            # Create error frame only as last resort
            error_frame, self.frame_counter = create_video_frame(
                np.zeros((480,640,3), dtype=np.uint8), 
                self.frame_counter,
                self.target_fps
            )
            return error_frame
    
    def stop(self):
        """Stop the video track."""
        self._running = False
        logger.info(f"Frame source stats for {self.camera_type}: {self.frame_stats}")

@router.websocket("/{camera_type}")
async def webrtc_endpoint(websocket: WebSocket, camera_type: str):
    """WebSocket endpoint for establishing a WebRTC connection."""
    if camera_type not in ["road", "interior"]:
        await websocket.close(code=4000, reason="Invalid camera type")
        return
        
    # Generate unique ID for this connection
    connection_id = str(uuid.uuid4())
    
    try:
        await websocket.accept()
        logger.info(f"New WebRTC connection for {camera_type} camera. ID: {connection_id}")
        
        # Set up RTCPeerConnection
        pc = RTCPeerConnection()
        peer_connections[connection_id] = pc
        
        # Inicializar el tiempo de heartbeat
        connection_last_heartbeat[connection_id] = time.time()
        
        # Enviar el ID de conexión al cliente para que pueda usarlo en los heartbeats
        await websocket.send_text(json.dumps({
            "type": "connection-id",
            "id": connection_id
        }))
        
        # Set up event handlers
        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"WebRTC connection {connection_id} state: {pc.connectionState}")
            if pc.connectionState in ["failed", "closed"]:
                await cleanup_connection(connection_id)
        
        @pc.on("iceconnectionstatechange")
        async def on_iceconnectionstatechange():
            logger.info(f"ICE state {connection_id}: {pc.iceConnectionState}")
        
        # Add video track
        video_track = CameraStreamTrack(camera_type=camera_type)
        relay_track = relay.subscribe(video_track)
        pc.addTrack(relay_track)
        
        # Wait for SDP offer from client
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                
                # Process SDP offer
                if data.get("type") == "offer":
                    await process_offer(pc, data, websocket)
                
                # Process ICE candidate
                elif data.get("type") == "ice-candidate":
                    candidate = parse_ice_candidate(data)
                    if candidate:
                        await pc.addIceCandidate(candidate)
                        logger.info(f"ICE candidate processed successfully")
                
                # Handle close request
                elif data.get("type") == "close":
                    logger.info(f"Client requested to close connection {connection_id}")
                    await cleanup_connection(connection_id)
                    break
                    
            except json.JSONDecodeError:
                logger.error(f"Error decoding JSON message")
            except Exception as e:
                logger.error(f"Error processing WebRTC message: {str(e)}")
                logger.error(traceback.format_exc())
        
    except WebSocketDisconnect:
        logger.info(f"WebRTC client disconnected. ID: {connection_id}")
    except Exception as e:
        logger.error(f"Error in WebRTC connection: {str(e)}")
        logger.error(traceback.format_exc())
    finally:
        # Clean up resources
        await cleanup_connection(connection_id)

async def process_offer(pc, data, websocket):
    """Process SDP offer and create answer."""
    try:
        # Parse the offer
        offer = RTCSessionDescription(sdp=data["sdp"], type=data["type"])
        offer_info = parse_sdp_offer(offer)
        
        logger.info(f"Offer received - media sections: {offer_info['media_sections']}")
        
        # Check if offer is valid
        if not offer_info["is_valid"]:
            logger.warning("Invalid SDP offer received. Creating basic offer.")
            offer = create_custom_sdp_offer()
            offer_info = parse_sdp_offer(offer)
            logger.info(f"New offer - media sections: {offer_info['media_sections']}")
        
        # Set remote description
        await pc.setRemoteDescription(offer)
        
        # Create answer
        try:
            answer = await pc.createAnswer()
            
            # Set local description
            await pc.setLocalDescription(answer)
            logger.info("Local description set successfully")
            
        except Exception as e:
            logger.error(f"Error creating/setting answer: {str(e)}")
            
            # Create custom answer
            custom_answer = create_custom_sdp_answer(offer.sdp)
            
            # Try to set it as local description
            try:
                await pc.setLocalDescription(custom_answer)
            except Exception:
                # If that fails, use direct assignment
                object.__setattr__(pc, "_localDescription", custom_answer)
                
            logger.info("Custom answer created after error")
        
        # Verify local description is set
        if pc.localDescription is None:
            logger.error("Failed to set valid local description")
            error_response = {
                "type": "error",
                "error": "Failed to create valid SDP answer"
            }
            await websocket.send_text(json.dumps(error_response))
            return
        
        # Send answer to client
        response = {
            "type": pc.localDescription.type,
            "sdp": pc.localDescription.sdp
        }
        await websocket.send_text(json.dumps(response))
    
    except Exception as e:
        logger.error(f"Error processing offer: {str(e)}")
        logger.error(traceback.format_exc())

@router.post("/heartbeat/{connection_id}")
async def receive_heartbeat(connection_id: str, disconnect: bool = False):
    """
    Recibe un heartbeat de un cliente WebRTC para mantener la conexión activa.
    Este endpoint debe ser llamado regularmente por el cliente mientras esté viendo el stream.
    
    Si se especifica disconnect=true, la conexión se cerrará inmediatamente.
    """
    if connection_id in peer_connections:
        if disconnect:
            # Si se solicita desconexión explícita, cerrar la conexión inmediatamente
            logger.info(f"Solicitud de desconexión explícita recibida para WebRTC {connection_id}")
            await cleanup_connection(connection_id)
            return {"status": "ok", "message": "Conexión cerrada explícitamente"}
        else:
            # Actualizar tiempo de último heartbeat
            connection_last_heartbeat[connection_id] = time.time()
            return {"status": "ok"}
    else:
        return {"status": "error", "message": "Conexión no encontrada"}

@router.post("/toggle/{camera_type}")
async def toggle_webrtc_streaming(camera_type: str):
    """Activa o desactiva el streaming WebRTC para una cámara específica"""
    if camera_type not in ["road", "interior"]:
        return {"status": "error", "message": "Tipo de cámara no válido. Use 'road' o 'interior'."}
    
    # Cambiar estado del streaming para la cámara específica
    streaming_enabled[camera_type] = not streaming_enabled[camera_type]
    
    return {
        "status": "ok",
        "camera_type": camera_type,
        "enabled": streaming_enabled[camera_type]
    }

async def cleanup_connection(connection_id: str):
    """Clean up resources associated with a connection."""
    pc = peer_connections.pop(connection_id, None)
    # También eliminar el registro de heartbeat
    connection_last_heartbeat.pop(connection_id, None)
    
    if pc:
        # Close video tracks
        for transceiver in pc.getTransceivers():
            if transceiver.sender and transceiver.sender.track:
                if hasattr(transceiver.sender.track, "stop"):
                    transceiver.sender.track.stop()
        
        # Close connection
        await pc.close()
        logger.info(f"WebRTC connection closed and resources released. ID: {connection_id}")

def get_active_connections():
    """Return the number of active connections."""
    return len(peer_connections)