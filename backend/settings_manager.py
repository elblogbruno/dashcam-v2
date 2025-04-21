import os
import json
import logging
import threading
import time
from typing import Dict, List, Callable, Any, Set
from config import config

# Configure logging
logger = logging.getLogger("settings_manager")

class SettingsManager:
    """
    Central manager for settings that handles loading, saving,
    and notifying components when settings change.
    """
    
    def __init__(self):
        self.settings: Dict[str, Dict[str, Any]] = {
            "storage": {},
            "audio": {},
            "video": {},
            "wifi": {}
        }
        
        # Mapping from settings type to file path
        self.settings_paths = {
            "storage": config.storage_settings_path,
            "audio": config.audio_settings_path,
            "video": config.video_settings_path,
            "wifi": config.wifi_settings_path
        }
        
        # File modification timestamps to detect changes
        self.file_timestamps: Dict[str, float] = {}
        
        # Subscribers for each setting type
        self.subscribers: Dict[str, List[Callable[[Dict[str, Any]], None]]] = {
            "storage": [],
            "audio": [],
            "video": [],
            "wifi": []
        }
        
        # Module references that have registered for updates
        self.registered_modules: Set[str] = set()
        
        # Load initial settings
        self.load_all_settings()
        
        # Start the file watcher thread
        self.watcher_active = True
        self.watcher_thread = threading.Thread(target=self._watch_settings_files, daemon=True)
        self.watcher_thread.start()
        
        logger.info("Settings manager initialized")
    
    def load_all_settings(self):
        """Load all settings from their respective files"""
        for settings_type in self.settings_paths:
            self.load_settings(settings_type)
    
    def load_settings(self, settings_type: str) -> Dict[str, Any]:
        """Load settings of a specific type from file"""
        path = self.settings_paths.get(settings_type)
        if not path:
            logger.error(f"Unknown settings type: {settings_type}")
            return {}
            
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(path), exist_ok=True)
            
            # If file exists, load it
            if os.path.exists(path):
                with open(path, 'r') as f:
                    self.settings[settings_type] = json.load(f)
                    # Update timestamp
                    self.file_timestamps[settings_type] = os.path.getmtime(path)
                    logger.debug(f"Loaded {settings_type} settings from {path}")
            else:
                # Create default settings if file doesn't exist
                if settings_type == "storage":
                    self.settings[settings_type] = {
                        "autoCleanEnabled": False,
                        "autoCleanThreshold": 90,
                        "autoCleanDays": 30,
                        "mainDrive": "/dev/sda1",
                        "mountPoint": "/mnt/dashcam_storage"
                    }
                elif settings_type == "audio":
                    self.settings[settings_type] = {
                        "enabled": True,
                        "volume": 80,
                        "engine": "pyttsx3"
                    }
                elif settings_type == "video":
                    self.settings[settings_type] = {
                        "roadQuality": "high",
                        "interiorQuality": "medium",
                        "autoStartRecording": True,
                        "roadCamera": "/dev/video0",
                        "interiorCamera": "/dev/video1"
                    }
                elif settings_type == "wifi":
                    self.settings[settings_type] = {
                        "ssid": "DashCam",
                        "password": "",
                        "enabled": True
                    }
                
                # Save default settings
                self.save_settings(settings_type)
                logger.info(f"Created default {settings_type} settings at {path}")
            
            return self.settings[settings_type]
                
        except Exception as e:
            logger.error(f"Error loading {settings_type} settings: {str(e)}")
            return {}
    
    def save_settings(self, settings_type: str) -> bool:
        """Save settings of a specific type to file"""
        path = self.settings_paths.get(settings_type)
        if not path:
            logger.error(f"Unknown settings type: {settings_type}")
            return False
            
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(path), exist_ok=True)
            
            # Save settings to file
            with open(path, 'w') as f:
                json.dump(self.settings[settings_type], f, indent=2)
            
            # Update timestamp
            self.file_timestamps[settings_type] = os.path.getmtime(path)
            
            logger.debug(f"Saved {settings_type} settings to {path}")
            return True
                
        except Exception as e:
            logger.error(f"Error saving {settings_type} settings: {str(e)}")
            return False
    
    def update_settings(self, settings_type: str, new_settings: Dict[str, Any]) -> bool:
        """Update settings of a specific type and notify subscribers"""
        if settings_type not in self.settings:
            logger.error(f"Unknown settings type: {settings_type}")
            return False
            
        # Update settings
        current_settings = self.settings[settings_type]
        current_settings.update(new_settings)
        
        # Save to file
        success = self.save_settings(settings_type)
        
        if success:
            # Notify subscribers
            self._notify_subscribers(settings_type)
            
        return success
    
    def get_settings(self, settings_type: str) -> Dict[str, Any]:
        """Get settings of a specific type"""
        return self.settings.get(settings_type, {})
    
    def register_module(self, module_name: str, settings_type: str, callback: Callable[[Dict[str, Any]], None]):
        """Register a module to receive updates for a specific settings type"""
        if settings_type not in self.subscribers:
            logger.error(f"Unknown settings type: {settings_type}")
            return
            
        self.subscribers[settings_type].append(callback)
        self.registered_modules.add(module_name)
        logger.info(f"Registered module {module_name} for {settings_type} settings updates")
        
        # Immediately provide current settings to the module
        callback(self.settings[settings_type])
    
    def _notify_subscribers(self, settings_type: str):
        """Notify all subscribers of a settings change"""
        if settings_type not in self.subscribers:
            return
            
        settings = self.settings[settings_type]
        for callback in self.subscribers[settings_type]:
            try:
                callback(settings)
            except Exception as e:
                logger.error(f"Error notifying subscriber of {settings_type} settings change: {str(e)}")
        
        logger.debug(f"Notified {len(self.subscribers[settings_type])} subscribers of {settings_type} settings change")
    
    def _watch_settings_files(self):
        """Watch settings files for changes and reload when necessary"""
        while self.watcher_active:
            try:
                for settings_type, path in self.settings_paths.items():
                    if os.path.exists(path):
                        # Check if file was modified
                        current_mtime = os.path.getmtime(path)
                        last_mtime = self.file_timestamps.get(settings_type, 0)
                        
                        if current_mtime > last_mtime:
                            logger.info(f"Detected change in {settings_type} settings file")
                            self.load_settings(settings_type)
                            self._notify_subscribers(settings_type)
            except Exception as e:
                logger.error(f"Error in settings file watcher: {str(e)}")
                
            # Check every 2 seconds
            time.sleep(2)
    
    def stop(self):
        """Stop the settings manager and its watcher thread"""
        self.watcher_active = False
        if self.watcher_thread.is_alive():
            self.watcher_thread.join(timeout=1)
        logger.info("Settings manager stopped")

# Create a global instance of the settings manager
settings_manager = SettingsManager()