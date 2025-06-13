"""
Centralized logging system for trip logger
"""

import logging
import os
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class LogLevel(str, Enum):
    """Log levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class TripLoggerFormatter(logging.Formatter):
    """Custom formatter for trip logger"""
    
    def __init__(self):
        super().__init__(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    def format(self, record):
        # Add trip context if available
        if hasattr(record, 'trip_id'):
            record.msg = f"[Trip {record.trip_id}] {record.msg}"
        
        return super().format(record)


class TripLogManager:
    """Central logging manager for trip operations"""
    
    def __init__(self, log_file: Optional[str] = None, level: LogLevel = LogLevel.INFO):
        """Initialize the logging manager
        
        Args:
            log_file: Optional log file path
            level: Logging level
        """
        self.log_file = log_file or os.path.join(
            os.environ.get('DASHCAM_DATA_PATH', '/tmp'), 
            'trip_logger.log'
        )
        self.level = level
        self.loggers: Dict[str, logging.Logger] = {}
        
        # Ensure log directory exists
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        
        # Setup root logger for trip logger package
        self._setup_root_logger()
    
    def _setup_root_logger(self):
        """Setup the root logger for trip logger package"""
        logger = logging.getLogger('trip_logger_package')
        logger.setLevel(getattr(logging, self.level.value))
        
        # Clear existing handlers
        logger.handlers.clear()
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(logging, self.level.value))
        console_handler.setFormatter(TripLoggerFormatter())
        logger.addHandler(console_handler)
        
        # File handler
        try:
            file_handler = logging.FileHandler(self.log_file)
            file_handler.setLevel(logging.DEBUG)  # Log everything to file
            file_handler.setFormatter(TripLoggerFormatter())
            logger.addHandler(file_handler)
        except Exception as e:
            logger.warning(f"Could not setup file logging: {str(e)}")
        
        self.loggers['root'] = logger
    
    def get_logger(self, name: str) -> logging.Logger:
        """Get a logger instance for a specific component
        
        Args:
            name: Logger name (e.g., 'gps', 'landmarks', 'video')
            
        Returns:
            Logger instance
        """
        full_name = f'trip_logger_package.{name}'
        
        if full_name not in self.loggers:
            logger = logging.getLogger(full_name)
            logger.setLevel(getattr(logging, self.level.value))
            self.loggers[full_name] = logger
        
        return self.loggers[full_name]
    
    def log_trip_event(self, trip_id: Optional[int], level: LogLevel, message: str, 
                      component: str = 'trip', **kwargs):
        """Log a trip-specific event
        
        Args:
            trip_id: Trip ID (if available)
            level: Log level
            message: Log message
            component: Component name (gps, landmarks, video, etc.)
            **kwargs: Additional context data
        """
        logger = self.get_logger(component)
        
        # Create log record with trip context
        extra = {'trip_id': trip_id} if trip_id else {}
        extra.update(kwargs)
        
        # Format message with context
        if kwargs:
            context_str = ', '.join([f"{k}={v}" for k, v in kwargs.items()])
            message = f"{message} ({context_str})"
        
        # Log at appropriate level
        log_method = getattr(logger, level.value.lower())
        log_method(message, extra=extra)
    
    def log_gps_event(self, trip_id: Optional[int], latitude: float, longitude: float, 
                     quality: Optional[int] = None, speed: Optional[float] = None):
        """Log GPS-specific events"""
        self.log_trip_event(
            trip_id=trip_id,
            level=LogLevel.DEBUG,
            message=f"GPS coordinate logged",
            component='gps',
            lat=latitude,
            lon=longitude,
            quality=quality,
            speed=speed
        )
    
    def log_landmark_event(self, trip_id: Optional[int], landmark_name: str, 
                          landmark_type: str, is_priority: bool = False):
        """Log landmark-specific events"""
        self.log_trip_event(
            trip_id=trip_id,
            level=LogLevel.INFO,
            message=f"Landmark encountered: {landmark_name}",
            component='landmarks',
            landmark_type=landmark_type,
            is_priority=is_priority
        )
    
    def log_video_event(self, trip_id: Optional[int], event_type: str, 
                       video_file: Optional[str] = None, quality: Optional[str] = None):
        """Log video-specific events"""
        self.log_trip_event(
            trip_id=trip_id,
            level=LogLevel.INFO,
            message=f"Video event: {event_type}",
            component='video',
            video_file=video_file,
            quality=quality
        )
    
    def log_quality_upgrade(self, trip_id: Optional[int], reason: str, 
                           landmark_name: Optional[str] = None):
        """Log quality upgrade events"""
        self.log_trip_event(
            trip_id=trip_id,
            level=LogLevel.INFO,
            message=f"Quality upgraded: {reason}",
            component='quality',
            landmark_name=landmark_name
        )
    
    def log_database_operation(self, operation: str, table: str, success: bool, 
                             error: Optional[str] = None, **context):
        """Log database operations"""
        level = LogLevel.INFO if success else LogLevel.ERROR
        message = f"Database {operation} on {table}: {'SUCCESS' if success else 'FAILED'}"
        
        kwargs = {'success': success, 'table': table}
        if error:
            kwargs['error'] = error
        kwargs.update(context)
        
        self.log_trip_event(
            trip_id=context.get('trip_id'),
            level=level,
            message=message,
            component='database',
            **kwargs
        )
    
    def log_system_event(self, event_type: str, message: str, level: LogLevel = LogLevel.INFO, **context):
        """Log system-level events"""
        self.log_trip_event(
            trip_id=None,
            level=level,
            message=f"System {event_type}: {message}",
            component='system',
            **context
        )
    
    def create_trip_context_logger(self, trip_id: int, component: str = 'trip') -> 'TripContextLogger':
        """Create a context logger for a specific trip
        
        Args:
            trip_id: Trip ID
            component: Component name
            
        Returns:
            Context logger instance
        """
        return TripContextLogger(self, trip_id, component)
    
    def set_level(self, level: LogLevel):
        """Change logging level"""
        self.level = level
        numeric_level = getattr(logging, level.value)
        
        for logger in self.loggers.values():
            logger.setLevel(numeric_level)
            for handler in logger.handlers:
                if isinstance(handler, logging.StreamHandler) and not isinstance(handler, logging.FileHandler):
                    handler.setLevel(numeric_level)
    
    def rotate_logs(self):
        """Rotate log files (for large deployments)"""
        try:
            if os.path.exists(self.log_file):
                # Create backup with timestamp
                backup_name = f"{self.log_file}.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                os.rename(self.log_file, backup_name)
                
                # Recreate logging setup
                self._setup_root_logger()
                
                self.log_system_event('log_rotation', f"Logs rotated, backup: {backup_name}")
                
        except Exception as e:
            self.log_system_event('log_rotation', f"Failed to rotate logs: {str(e)}", LogLevel.ERROR)


class TripContextLogger:
    """Context logger for specific trip operations"""
    
    def __init__(self, log_manager: TripLogManager, trip_id: int, component: str):
        self.log_manager = log_manager
        self.trip_id = trip_id
        self.component = component
    
    def debug(self, message: str, **kwargs):
        self.log_manager.log_trip_event(self.trip_id, LogLevel.DEBUG, message, self.component, **kwargs)
    
    def info(self, message: str, **kwargs):
        self.log_manager.log_trip_event(self.trip_id, LogLevel.INFO, message, self.component, **kwargs)
    
    def warning(self, message: str, **kwargs):
        self.log_manager.log_trip_event(self.trip_id, LogLevel.WARNING, message, self.component, **kwargs)
    
    def error(self, message: str, **kwargs):
        self.log_manager.log_trip_event(self.trip_id, LogLevel.ERROR, message, self.component, **kwargs)
    
    def critical(self, message: str, **kwargs):
        self.log_manager.log_trip_event(self.trip_id, LogLevel.CRITICAL, message, self.component, **kwargs)


# Global log manager instance
_log_manager: Optional[TripLogManager] = None


def get_log_manager(log_file: Optional[str] = None, level: LogLevel = LogLevel.INFO) -> TripLogManager:
    """Get the global log manager instance"""
    global _log_manager
    
    if _log_manager is None:
        _log_manager = TripLogManager(log_file, level)
    
    return _log_manager


def get_logger(component: str) -> logging.Logger:
    """Get a component-specific logger"""
    log_manager = get_log_manager()
    return log_manager.get_logger(component)


def init_logging(log_file: Optional[str] = None, level: LogLevel = LogLevel.INFO):
    """Initialize the logging system"""
    global _log_manager
    _log_manager = TripLogManager(log_file, level)
    return _log_manager
