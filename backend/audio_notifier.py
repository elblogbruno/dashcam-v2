import logging
import threading
import subprocess
import os
import platform
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AudioNotifier:
    def __init__(self):
        self.enabled = True
        self.volume = 80  # Default volume level (0-100)
        self.audio_thread = None
        self.tts_engine = None
        
        # Initialize TTS engine
        self._init_tts_engine()
        
    def _init_tts_engine(self):
        """Initialize the appropriate text-to-speech engine based on available libraries"""
        
        # Try pyttsx3 first (cross-platform)
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
        
    def announce(self, text):
        """Announce text through the speaker"""
        if not self.enabled:
            logger.info(f"Audio disabled, would have announced: {text}")
            return False
            
        # Start in a separate thread to avoid blocking
        self.audio_thread = threading.Thread(target=self._speak, args=(text,))
        self.audio_thread.daemon = True
        self.audio_thread.start()
        
        return True
        
    def _speak(self, text):
        """Use the appropriate TTS engine to speak the text"""
        try:
            if self.tts_engine == "pyttsx3":
                self._pyttsx3_engine.setProperty('volume', self.volume / 100.0)
                self._pyttsx3_engine.say(text)
                self._pyttsx3_engine.runAndWait()
                
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
                
            # Update engine if provided
            if "engine" in settings and settings["engine"] != self.tts_engine:
                # Store current engine
                old_engine = self.tts_engine
                self.tts_engine = settings["engine"]
                
                # Try to initialize the specified engine
                if self.tts_engine == "pyttsx3":
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
        return {
            "enabled": self.enabled,
            "volume": self.volume,
            "engine": self.tts_engine
        }
        
    def test_audio(self):
        """Test the audio system by speaking a test message"""
        return self.announce("This is a test of the dashcam audio system")