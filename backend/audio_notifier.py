import logging
import threading
import subprocess
import os
import platform
import asyncio
from typing import Dict, Any, Set, Optional, List

from fastapi import WebSocket

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AudioNotifier:
    def __init__(self):
        self.enabled = True
        self.volume = 80  # Default volume level (0-100)
        self.audio_thread = None
        self.tts_engine = None
        self.connected_clients: Set[WebSocket] = None  # Se inicializa desde main.py
        
        # Initialize TTS engine
        self._init_tts_engine()
        
    def _init_tts_engine(self):
        """Initialize the appropriate text-to-speech engine based on available libraries"""
        
        # Try Piper first (high-quality neural TTS via pip package)
        try:
            import subprocess
            # Check if piper command is available (from pip install piper-tts)
            result = subprocess.run(["piper", "--help"], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE,
                                  text=True)
            if result.returncode == 0:
                self.tts_engine = "piper"
                # Use Spanish model for better natural voice
                self.piper_model = "es_ES-carlfm-x_low"
                logger.info(f"Initialized audio notifier with Piper using model: {self.piper_model}")
                return
        except Exception as e:
            logger.warning(f"Could not initialize Piper: {str(e)}")
        
        # Try pyttsx3 second (cross-platform)
        try:
            import pyttsx3
            self.tts_engine = "pyttsx3"
            self._pyttsx3_engine = pyttsx3.init()
            logger.info("Initialized audio notifier with pyttsx3")
            return
        except (ImportError, ModuleNotFoundError, Exception) as e:
            logger.warning(f"Could not initialize pyttsx3: {str(e)}")
            
        # Try espeak (Linux)
        try:
            # Check if espeak is installed
            if platform.system() == "Linux":
                result = subprocess.run(["which", "espeak"], 
                                      stdout=subprocess.PIPE, 
                                      stderr=subprocess.PIPE,
                                      text=True)
                if result.returncode == 0:
                    self.tts_engine = "espeak"
                    logger.info("Initialized audio notifier with espeak")
                    return
        except Exception as e:
            logger.warning(f"Could not find espeak: {str(e)}")
            
        # Try say (macOS)
        try:
            if platform.system() == "Darwin":  # macOS
                result = subprocess.run(["which", "say"], 
                                      stdout=subprocess.PIPE, 
                                      stderr=subprocess.PIPE,
                                      text=True)
                if result.returncode == 0:
                    self.tts_engine = "say"
                    logger.info("Initialized audio notifier with macOS say command")
                    return
        except Exception as e:
            logger.warning(f"Could not find say command: {str(e)}")
            
        # Fallback to a dummy engine (no audio)
        self.tts_engine = "dummy"
        logger.warning("No text-to-speech engine available. Audio notifications will be logged only.")
        
    def announce(self, text, title=None, notification_type="info", send_notification=True):
        """
        Announce a message using text-to-speech and optionally send a UI notification
        
        Args:
            text: The text to announce
            title: Optional title for the notification
            notification_type: Type of notification (info, success, error, warning)
            send_notification: Whether to send a visual notification to the UI
        """
        
        # Log the announcement
        logger.info(f"Announcement: {text}" + (f" (Title: {title})" if title else ""))
        
        # Speak the announcement if audio is enabled
        if self.enabled:
            # Start in a separate thread to avoid blocking
            self.audio_thread = threading.Thread(target=self._speak, args=(text,))
            self.audio_thread.daemon = True
            self.audio_thread.start()
        else:
            logger.info(f"Audio disabled, would have announced: {text}")
        
        # Send visual notification if requested
        if send_notification and self.connected_clients:
            self._schedule_notification(
                message=text,
                title=title or "Notificación",
                notification_type=notification_type
            )
        
        return True
        
    def _schedule_notification(self, message, title="Notificación", notification_type="info"):
        """
        Thread-safe method to schedule a notification to be sent to WebSocket clients
        
        Args:
            message: The notification message
            title: The notification title
            notification_type: Type of notification (info, success, error, warning)
        """
        try:
            import threading
            
            # Check if we're in the main thread
            if threading.current_thread() == threading.main_thread():
                # We're in the main thread, try to create task directly
                try:
                    loop = asyncio.get_running_loop()
                    asyncio.create_task(self._send_notification(message, title, notification_type))
                    logger.debug(f"Notification scheduled from main thread: {title} - {message}")
                except RuntimeError:
                    # No event loop running
                    logger.info(f"NOTIFICATION (no loop): {title} - {message}")
            else:
                # We're in a different thread (like the HDD copy thread)
                # For thread safety, just log the notification
                logger.info(f"NOTIFICATION (from thread): {title} - {message}")
                
        except Exception as e:
            logger.error(f"Error in _schedule_notification: {str(e)}")
            # Always log as fallback
            logger.info(f"NOTIFICATION (error fallback): {title} - {message}")
        
        return True
        
    async def _send_notification(self, message, title="Notificación", notification_type="info"):
        """
        Send a notification to all connected WebSocket clients
        
        Args:
            message: The notification message
            title: The notification title
            notification_type: Type of notification (info, success, error, warning)
        """
        if not self.connected_clients:
            logger.warning("No hay clientes conectados para enviar notificación")
            return
            
        notification = {
            "notification": {
                "message": message,
                "title": title,
                "type": notification_type,
                "timestamp": str(asyncio.get_event_loop().time())
            }
        }
        
        # Send to all connected clients
        for client in list(self.connected_clients):
            try:
                await client.send_json(notification)
                logger.debug(f"Notificación enviada a cliente WebSocket: {message}")
            except Exception as e:
                logger.warning(f"Error enviando notificación a cliente WebSocket: {str(e)}")
                # No intentamos eliminar el cliente, ya que esto se maneja en el endpoint WebSocket
        
        return True
        
    def _speak(self, text):
        """Use the appropriate TTS engine to speak the text"""
        try:
            if self.tts_engine == "piper":
                # Use Piper for high-quality neural TTS with automatic model download
                try:
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                        temp_audio_path = temp_audio.name
                    
                    # Generate audio with Piper using pip-installed version
                    # This will automatically download the model on first use
                    piper_process = subprocess.Popen(
                        ["piper", "--model", self.piper_model, "--output_file", temp_audio_path],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True
                    )
                    
                    # Send text to Piper
                    stdout, stderr = piper_process.communicate(input=text)
                    
                    if piper_process.returncode == 0:
                        # Play the generated audio
                        if platform.system() == "Linux":
                            # Try different audio players
                            audio_players = ["aplay", "paplay", "mpv", "ffplay"]
                            for player in audio_players:
                                try:
                                    result = subprocess.run(["which", player], 
                                                          stdout=subprocess.PIPE, 
                                                          stderr=subprocess.PIPE)
                                    if result.returncode == 0:
                                        subprocess.run([player, temp_audio_path],
                                                     stdout=subprocess.PIPE,
                                                     stderr=subprocess.PIPE)
                                        break
                                except:
                                    continue
                        elif platform.system() == "Darwin":  # macOS
                            subprocess.run(["afplay", temp_audio_path],
                                         stdout=subprocess.PIPE,
                                         stderr=subprocess.PIPE)
                        
                        # Clean up temp file
                        try:
                            os.unlink(temp_audio_path)
                        except:
                            pass
                    else:
                        logger.error(f"Piper TTS failed: {stderr}")
                        # Fallback to dummy
                        logger.info(f"AUDIO ANNOUNCEMENT (Piper failed): {text}")
                        
                except Exception as e:
                    logger.error(f"Error using Piper TTS: {str(e)}")
                    logger.info(f"AUDIO ANNOUNCEMENT (Piper error): {text}")
                
            elif self.tts_engine == "pyttsx3":
                # Use a separate thread for pyttsx3 to avoid event loop conflicts
                def run_tts():
                    self._pyttsx3_engine.setProperty('volume', self.volume / 100.0)
                    self._pyttsx3_engine.say(text)
                    self._pyttsx3_engine.runAndWait()
                
                # Run in a separate thread to avoid "run loop already started" error
                tts_thread = threading.Thread(target=run_tts)
                tts_thread.daemon = True
                tts_thread.start()
                tts_thread.join()  # Wait for completion
                
            elif self.tts_engine == "espeak":
                # Adjust volume (0-200 for espeak)
                volume = int(self.volume * 2)
                subprocess.run(["espeak", f"-a{volume}", text],
                             stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE)
                             
            elif self.tts_engine == "say":
                subprocess.run(["say", text],
                             stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE)
                             
            else:
                # Dummy engine - just log
                logger.info(f"AUDIO ANNOUNCEMENT: {text}")
                
            logger.info(f"Announced: {text}")
            return True
            
        except Exception as e:
            logger.error(f"Error announcing text: {str(e)}")
            return False
            
    def apply_settings(self, settings: Dict[str, Any]):
        """
        Apply new settings received from the settings manager
        
        Args:
            settings: Dictionary containing audio settings from the settings manager
        """
        try:
            # Update enabled status if provided
            if "enabled" in settings:
                self.enabled = bool(settings["enabled"])
                logger.info(f"Audio notifications {'enabled' if self.enabled else 'disabled'}")
                
            # Update volume if provided
            if "volume" in settings:
                self.set_volume(int(settings["volume"]))
                
            # Update voice model if provided (for Piper)
            if "voice_model" in settings and self.tts_engine == "piper":
                self.piper_model = settings["voice_model"]
                logger.info(f"Piper voice model updated to: {self.piper_model}")
                
            # Update engine if provided
            if "engine" in settings and settings["engine"] != self.tts_engine:
                # Store current engine
                old_engine = self.tts_engine
                self.tts_engine = settings["engine"]
                
                # Try to initialize the specified engine
                if self.tts_engine == "piper":
                    # Test Piper availability
                    try:
                        result = subprocess.run(["piper", "--help"], 
                                              stdout=subprocess.PIPE, 
                                              stderr=subprocess.PIPE,
                                              text=True)
                        if result.returncode == 0:
                            self.piper_model = settings.get("voice_model", "es_ES-carlfm-x_low")
                            logger.info("Switched to Piper engine")
                        else:
                            raise Exception("Piper command not available")
                    except Exception as e:
                        logger.error(f"Failed to initialize Piper engine: {str(e)}")
                        self.tts_engine = old_engine  # Revert to previous engine
                elif self.tts_engine == "pyttsx3":
                    try:
                        import pyttsx3
                        self._pyttsx3_engine = pyttsx3.init()
                        self._pyttsx3_engine.setProperty('volume', self.volume / 100.0)
                        logger.info("Switched to pyttsx3 engine")
                    except Exception as e:
                        logger.error(f"Failed to initialize pyttsx3 engine: {str(e)}")
                        self.tts_engine = old_engine  # Revert to previous engine
                
                logger.info(f"Audio engine updated to {self.tts_engine}")
                
            logger.info("Applied audio settings successfully")
            return True
        except Exception as e:
            logger.error(f"Error applying audio settings: {str(e)}")
            return False

    def set_volume(self, volume):
        """Set the volume level (0-100)"""
        if 0 <= volume <= 100:
            self.volume = volume
            
            # Update pyttsx3 engine if available
            if self.tts_engine == "pyttsx3":
                self._pyttsx3_engine.setProperty('volume', volume / 100.0)
                
            logger.info(f"Audio volume set to {volume}")
            return True
        return False
        
    def enable(self):
        """Enable audio notifications"""
        self.enabled = True
        logger.info("Audio notifications enabled")
        
    def disable(self):
        """Disable audio notifications"""
        self.enabled = False
        logger.info("Audio notifications disabled")
        
    def get_status(self):
        """Get the current status of the audio notifier"""
        status = {
            "enabled": self.enabled,
            "volume": self.volume,
            "engine": self.tts_engine
        }
        
        # Add model info for Piper
        if self.tts_engine == "piper" and hasattr(self, 'piper_model'):
            status["voice_model"] = self.piper_model
            
        return status
        
    def test_audio(self):
        """Test the audio system by speaking a test message"""
        return self.announce("This is a test of the dashcam audio system")
        
    def cleanup(self):
        """Properly clean up resources before shutdown"""
        logger.info("Cleaning up AudioNotifier resources")
        
        # Clean up the pyttsx3 engine if it was initialized
        if self.tts_engine == "pyttsx3" and hasattr(self, '_pyttsx3_engine'):
            try:
                # Stop any ongoing speech
                if self.audio_thread and self.audio_thread.is_alive():
                    self.audio_thread.join(timeout=1.0)
                    
                # Some engines need specific cleanup
                if hasattr(self._pyttsx3_engine, 'stop'):
                    self._pyttsx3_engine.stop()
                    
                logger.info("Closed pyttsx3 engine successfully")
            except Exception as e:
                logger.error(f"Error cleaning up pyttsx3 engine: {str(e)}")
        
        logger.info("AudioNotifier cleanup completed")
