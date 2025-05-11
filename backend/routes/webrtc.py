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

# Import our custom modules
from .webrtc_modules.camera_frame_provider import CameraFrameProvider
from .webrtc_modules.webrtc_utils import (
    create_video_frame, parse_sdp_offer, create_custom_sdp_offer,
    create_custom_sdp_answer, parse_ice_candidate
)

logger = logging.getLogger(__name__)
router = APIRouter()

# These variables will be initialized from main.py
camera_manager = None

# MediaRelay to handle media tracks for multiple connections
relay = MediaRelay()

# Store active RTCPeerConnection instances
peer_connections = {}

# Create frame provider
frame_provider = None

# Initialize frame provider when this module is imported
async def initialize_webrtc():
    """Initialize the WebRTC system"""
    global frame_provider
    
    logger.info("🚀 Initializing WebRTC module...")
    frame_provider = CameraFrameProvider(camera_manager=camera_manager)
    
    # Start the background worker
    asyncio.create_task(frame_provider.capture_frame_worker())
    logger.info("✓ WebRTC module initialized successfully")

# Create task to initialize
asyncio.create_task(initialize_webrtc())

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
        self.target_fps = 15  # Reduced from higher values for stability
        self.min_frame_interval = 1.0 / 30  # Maximum 30fps (minimum interval)
        self.frame_interval = 1.0 / self.target_fps
        self.frame_stats = {"queue": 0, "buffer": 0, "stale_buffer": 0, "default": 0}
        self._cached_frame = None
        self._cached_frame_time = 0
        
    async def recv(self):
        """Get the next frame with improved frame timing control."""
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
                # Only use cached frame if it's not too old (less than 2 seconds)
                if (time.time() - self._cached_frame_time) < 2.0:
                    frame = self._cached_frame.copy()
                    # Mark frame as cached
                    h, w = frame.shape[:2]
                    cv2.putText(
                        frame, "CACHED FRAME", (w//2 - 80, h - 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 1, cv2.LINE_AA
                    )
            
            # Convert to av.VideoFrame with better error handling
            try:
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
                np.zeros((480, 640, 3), dtype=np.uint8), 
                self.frame_counter,
                self.target_fps
            )
            return error_frame
    
    def stop(self):
        """Stop the video track."""
        self._running = False
        logger.info(f"Frame source stats for {self.camera_type}: {self.frame_stats}")

@router.websocket("/webrtc/{camera_type}")
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

async def cleanup_connection(connection_id: str):
    """Clean up resources associated with a connection."""
    pc = peer_connections.pop(connection_id, None)
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