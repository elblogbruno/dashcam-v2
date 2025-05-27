import asyncio
import cv2
import logging
import numpy as np
import time
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class CameraFrameProvider:
    """Handles camera frame capture and processing for WebRTC streams"""
    
    def __init__(self, camera_manager=None, max_queue_size=15):  # Reducido de 30 a 15 para menor latencia
        self.camera_manager = camera_manager
        self.frame_queue = asyncio.Queue(maxsize=max_queue_size)
        self.capture_running = True
        self.last_valid_frames = {"road": None, "interior": None}
        self.failed_captures = {"road": 0, "interior": 0}
        self.last_warning_time = {"road": 0, "interior": 0}
        self.warning_interval = 30.0  # Only log warnings every 30 seconds per camera
        
        # Performance metrics
        self.frames_processed = 0
        self.frames_consumed = 0
        self.last_metrics_time = time.time()
        
        # Frame buffering for higher throughput
        self.frame_buffer = {
            "road": None,
            "interior": None,
            "timestamp": 0
        }
        self.buffer_last_updated = 0
        self.buffer_ttl = 0.03  # Reducido de 50ms a 30ms TTL para el buffer, para reducir lag
        
        # Default frames
        self.default_frames = {
            "road": self._generate_default_frame("road"),
            "interior": self._generate_default_frame("interior")
        }
        
        # Adaptive frame rate control
        self.target_fps = 15  # Reducido de 20 a 15 fps para mejorar estabilidad
        self.last_frame_time = time.time()
        self.frame_interval = 1.0 / self.target_fps
        self.load_factor = 0.3  # Reducido de 0.5 a 0.3 para usar menos CPU
        
    def _generate_default_frame(self, camera_type, message="Camera not available", size=(640, 480)):
        """Generate a default frame with an error message"""
        img = np.zeros((size[1], size[0], 3), dtype=np.uint8)
        # Add centered text
        font = cv2.FONT_HERSHEY_SIMPLEX
        textsize = cv2.getTextSize(message, font, 1, 2)[0]
        textX = (size[0] - textsize[0]) // 2
        textY = (size[1] + textsize[1]) // 2
        cv2.putText(img, message, (textX, textY), font, 1, (255, 255, 255), 2, cv2.LINE_AA)
        
        # Add camera type indicator
        cv2.putText(img, f"{camera_type.upper()} CAMERA", (10, 30), font, 0.7, (0, 120, 255), 2, cv2.LINE_AA)
        
        # Add timestamp
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(img, timestamp, (10, size[1] - 20), font, 0.5, (150, 150, 150), 1, cv2.LINE_AA)
        
        return img
    
    def log_camera_warning(self, camera_type, message):
        """Log warnings for camera with rate limiting"""
        current_time = time.time()
        if current_time - self.last_warning_time.get(camera_type, 0) > self.warning_interval:
            logger.warning(f"⚠️ {message}")
            self.last_warning_time[camera_type] = current_time
    
    async def get_frame(self, camera_type):
        """Get the most recent frame from queue or buffer with optimized strategy"""
        current_time = time.time()
        
        # Try our buffered frame first if it's recent enough (50ms TTL)
        if (self.frame_buffer[camera_type] is not None and 
            current_time - self.buffer_last_updated < self.buffer_ttl):
            return self.frame_buffer[camera_type].copy(), "buffer"
            
        try:
            # Check if there are frames in the queue without blocking
            if not self.frame_queue.empty():
                frames = self.frame_queue.get_nowait()
                if frames and camera_type in frames:
                    # Update our buffer before returning
                    if frames[camera_type] is not None:
                        self.frame_buffer = frames
                        self.buffer_last_updated = current_time
                        self.frames_consumed += 1
                        return frames[camera_type].copy(), "queue"
            
            # If queue is empty but we have a valid buffered frame (older than TTL)
            if self.frame_buffer[camera_type] is not None:
                # Add a warning indicator to the frame since it's stale
                frame_copy = self.frame_buffer[camera_type].copy()
                h, w = frame_copy.shape[:2]
                cv2.putText(
                    frame_copy, "LOW FRAME BUFFER", (w//2 - 100, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2, cv2.LINE_AA
                )
                return frame_copy, "stale_buffer"
                
        except Exception:
            pass
        
        # Return default frame if we couldn't get one from the queue or buffer
        return self.default_frames[camera_type].copy(), "default"
    
    async def capture_frame_worker(self):
        """Background worker to capture camera frames with adaptive timing"""
        logger.info("🎥 Starting camera frame capture worker for WebRTC...")
        
        try:
            while self.capture_running:
                loop_start_time = time.time()
                
                # Dynamically adjust processing based on queue fullness
                queue_fullness = self.frame_queue.qsize() / self.frame_queue.maxsize
                
                # Estrategia de ajuste de FPS más agresiva para reducir lag
                if queue_fullness < 0.3:  # Reducido de 0.5 a 0.3
                    # Si la cola está muy vacía, aumentar FPS más rápidamente
                    self.target_fps = min(20, self.target_fps + 2)  # Más agresivo, +2 en lugar de +1
                    self.load_factor = min(0.8, self.load_factor + 0.1)  # Más agresivo
                    
                    if queue_fullness < 0.15:  # Critical low queue, reducido de 0.2 a 0.15
                        current_time = time.time()
                        if current_time - self.last_warning_time.get("queue_low", 0) > self.warning_interval:
                            logger.warning(f"⚠️ WebRTC frame queue running low: {self.frame_queue.qsize()}/{self.frame_queue.maxsize}")
                            self.last_warning_time["queue_low"] = current_time
                            
                elif queue_fullness > 0.7:  # Reducido de 0.8 a 0.7 para ser más proactivo
                    # Reduce capture rate to avoid buffer bloat when queue is more than 70% full
                    self.target_fps = max(10, self.target_fps - 2)  # Más agresivo en la reducción
                    self.load_factor = max(0.2, self.load_factor - 0.1)  # Reduce CPU usage more aggressively
                
                self.frame_interval = 1.0 / self.target_fps
                
                # Process each camera
                frames = {
                    "timestamp": time.time()
                }
                
                # Only process if we need to refill queue, or it's time for a new frame
                if queue_fullness < 0.8 or (time.time() - self.last_frame_time) >= self.frame_interval:
                    for camera_type in ["road", "interior"]:
                        frame = await self._capture_single_camera_frame(camera_type)
                        if frame is not None:
                            frames[camera_type] = frame
                    
                    # Add frames to the queue if we have any camera frames
                    if "road" in frames or "interior" in frames:
                        await self._add_frames_to_queue(frames)
                        self.last_frame_time = time.time()
                
                # Log performance metrics periodically
                self._log_performance_metrics()
                
                # Calculate how long to sleep based on target frame rate and processing time
                elapsed = time.time() - loop_start_time
                
                # Adaptive sleep: sleep less when queue is low, more when queue is high
                target_sleep = max(0.001, self.frame_interval - elapsed) * (1.0 - self.load_factor)
                
                # Short sleep to avoid CPU overload but still be responsive
                await asyncio.sleep(target_sleep)
                
        except Exception as e:
            logger.error(f"❌ Fatal error in capture frame worker: {str(e)}")
        finally:
            logger.info("🛑 Camera frame capture worker terminated")
    
    async def _capture_single_camera_frame(self, camera_type):
        """Capture frame from a single camera with optimization for shared frames"""
        frame = None
        
        try:
            # OPTIMIZACIÓN: Intentar usar frame compartido del worker MJPEG primero
            try:
                from backend.routes import mjpeg_stream
                if hasattr(mjpeg_stream, 'is_mjpeg_worker_active') and mjpeg_stream.is_mjpeg_worker_active():
                    shared_frame = mjpeg_stream.get_shared_frame(camera_type)
                    if shared_frame is not None:
                        # Log uso de frame compartido (rate limited)
                        current_time = time.time()
                        if current_time - self.last_warning_time.get(f"shared_{camera_type}", 0) > 60:
                            logger.info(f"🔄 Using shared frame from MJPEG worker for {camera_type}")
                            self.last_warning_time[f"shared_{camera_type}"] = current_time
                        return shared_frame
            except Exception as e:
                # Si falla acceso a frame compartido, continuar con captura normal
                pass
            
            # Captura normal si no hay frame compartido disponible
            if self.camera_manager is None:
                return self.default_frames[camera_type].copy()
                
            # Get appropriate camera
            camera_attr = f"{camera_type}_camera"
            if not hasattr(self.camera_manager, camera_attr) or getattr(self.camera_manager, camera_attr) is None:
                return self.default_frames[camera_type].copy()
            
            # Try to capture frame
            frame = self.camera_manager.get_preview_frame(camera_type=camera_type)
            
            # Process the frame
            if frame is not None:
                # Ensure it's a valid numpy array
                if not isinstance(frame, np.ndarray):
                    if hasattr(frame, 'get_result'):  # Handle PiCamera2 Job objects
                        try:
                            frame = frame.get_result()
                        except Exception:
                            frame = None
                    else:
                        frame = None
                
                # Update tracking for valid frames
                if frame is not None and isinstance(frame, np.ndarray) and frame.size > 0:
                    # Store a copy of the valid frame
                    self.last_valid_frames[camera_type] = frame.copy()
                    
                    # Log recovery after failures
                    if self.failed_captures[camera_type] > 0:
                        logger.info(f"✅ {camera_type.capitalize()} camera recovered after {self.failed_captures[camera_type]} failures")
                    
                    # Reset failure counter
                    self.failed_captures[camera_type] = 0
                    
                    # Add timestamp to the frame
                    self._add_timestamp_to_frame(frame, camera_type)
                    return frame
            
            # Handle failed capture
            self.failed_captures[camera_type] += 1
            
            # Log failure (rate-limited)
            if self.failed_captures[camera_type] == 1 or self.failed_captures[camera_type] % 30 == 0:
                self.log_camera_warning(
                    camera_type, 
                    f"Failed to get {camera_type} camera frame ({self.failed_captures[camera_type]} failures)"
                )
            
            # Try to use the last valid frame if available
            if self.last_valid_frames[camera_type] is not None and self.failed_captures[camera_type] < 10:
                frame = self.last_valid_frames[camera_type].copy()
                self._add_timestamp_to_frame(frame, camera_type)
                return frame
            
            # Use default frame as last resort
            return self.default_frames[camera_type].copy()
            
        except Exception as e:
            # Use rate-limited logging for errors
            self.log_camera_warning(camera_type, f"Error capturing {camera_type} camera frame: {str(e)}")
            return self.default_frames[camera_type].copy()
    
    def _add_timestamp_to_frame(self, frame, camera_type):
        """Add timestamp and camera type to a frame"""
        if frame is None:
            return
            
        try:
            h, w = frame.shape[:2]
            now = time.time()
            # Incluir milisegundos en el timestamp para mayor precisión
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now))
            ms = int((now - int(now)) * 1000)
            timestamp = f"{timestamp}.{ms:03d}"
            
            # Add timestamp
            cv2.putText(
                frame, timestamp, (10, h - 20), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA
            )
            
            # Add camera type
            cv2.putText(
                frame, f"{camera_type.upper()} CAMERA", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 120, 255), 2, cv2.LINE_AA
            )
        except Exception:
            pass
    
    async def _add_frames_to_queue(self, frames):
        """Add frames to the queue with dynamic overflow handling"""
        try:
            # Handle queue overflow with progressive dropping strategy
            queue_size = self.frame_queue.qsize()
            
            if queue_size >= self.frame_queue.maxsize:
                # If the queue is completely full, remove the oldest item
                try:
                    _ = self.frame_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                    
            # Try to add the new frames with a short timeout
            try:
                # Use a short timeout to avoid blocking if queue is full
                await asyncio.wait_for(self.frame_queue.put(frames), 0.01)
                self.frames_processed += 1
            except asyncio.TimeoutError:
                # If timeout, update buffer directly without adding to queue
                self.frame_buffer = frames
                self.buffer_last_updated = time.time()
                self.frames_processed += 1
                logger.debug("⏭️ Queue full, updated buffer directly")
                
        except Exception as e:
            logger.warning(f"Failed to add frames to queue: {str(e)}")
    
    def _log_performance_metrics(self):
        """Log performance metrics periodically"""
        current_time = time.time()
        if current_time - self.last_metrics_time > 30:
            elapsed = current_time - self.last_metrics_time
            fps_produced = self.frames_processed / elapsed if elapsed > 0 else 0
            fps_consumed = self.frames_consumed / elapsed if elapsed > 0 else 0
            
            logger.info(
                f"📊 WebRTC performance: {fps_produced:.2f} FPS produced | " 
                f"{fps_consumed:.2f} FPS consumed | "
                f"Queue: {self.frame_queue.qsize()}/{self.frame_queue.maxsize} | "
                f"Target FPS: {self.target_fps}"
            )
            
            # Reset metrics
            self.last_metrics_time = current_time
            self.frames_processed = 0
            self.frames_consumed = 0
