"""
Database helper utilities - Updated to use TripManager directly
"""
import os
import logging
from typing import Optional, Any, Dict, List

# Import TripManager directly
from trip_logger_package.services.trip_manager import TripManager

logger = logging.getLogger(__name__)

# Global TripManager instance
_trip_manager = None

def get_trip_manager(db_path: str = None) -> TripManager:
    """
    Get TripManager instance
    
    Args:
        db_path: Database path (optional)
        
    Returns:
        TripManager: TripManager instance
    """
    global _trip_manager
    if _trip_manager is None:
        if db_path is None:
            # Use default path
            db_path = "/root/dashcam-v2/data/recordings.db"
        _trip_manager = TripManager(db_path=db_path)
    return _trip_manager


def execute_trip_operation(operation: str, **kwargs) -> Any:
    """
    Execute a TripManager operation
    
    Args:
        operation: TripManager operation name
        **kwargs: Operation parameters
        
    Returns:
        Operation results
    """
    try:
        trip_manager = get_trip_manager()
        
        if operation == 'get_all_videos':
            return trip_manager.get_all_videos()
        elif operation == 'get_all_trips':
            return trip_manager.get_all_trips()
        elif operation == 'get_video_by_id':
            return trip_manager.get_video_by_id(kwargs.get('video_id'))
        elif operation == 'add_video':
            return trip_manager.add_video(kwargs.get('video_data'))
        elif operation == 'update_video':
            return trip_manager.update_video(kwargs.get('video_id'), kwargs.get('video_data'))
        elif operation == 'delete_video':
            return trip_manager.delete_video(kwargs.get('video_id'))
        elif operation == 'add_external_video':
            return trip_manager.add_external_video(kwargs.get('video_data'))
        else:
            logger.warning(f"Unknown TripManager operation: {operation}")
            return None
            
    except Exception as e:
        logger.error(f"Error executing TripManager operation {operation}: {str(e)}")
        raise


# Backward compatibility functions (deprecated)
def get_db_connection(db_path: str):
    """
    DEPRECATED: Get a database connection (use get_trip_logger instead)
    """
    logger.warning("get_db_connection() is deprecated. Use get_trip_logger() instead.")
    return get_trip_logger()


def execute_query(db_path: str, query: str, params: Optional[tuple] = None):
    """
    DEPRECATED: Execute a query (use execute_trip_operation instead)
    """
    logger.warning("execute_query() is deprecated. Use execute_trip_operation() instead.")
    # Try to map common queries to Trip Logger operations
    if query.strip().upper().startswith('SELECT * FROM'):
        if 'video_clips' in query or 'recordings' in query:
            return trip_logger.get_all_videos()
        elif 'trips' in query:
            return trip_logger.get_all_trips()
    
    logger.error(f"Cannot automatically map query to Trip Logger operation: {query}")
    return None
    finally:
        conn.close()


def table_exists(db_path: str, table_name: str) -> bool:
    """
    Check if a table exists in the database
    
    Args:
        db_path: Path to the database file
        table_name: Name of the table to check
        
    Returns:
        bool: True if table exists, False otherwise
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        """, (table_name,))
        return cursor.fetchone() is not None
    finally:
        conn.close()


def create_table_if_not_exists(db_path: str, table_name: str, schema: str):
    """
    Create a table if it doesn't exist
    
    Args:
        db_path: Path to the database file
        table_name: Name of the table to create
        schema: SQL schema for the table
    """
    if not table_exists(db_path, table_name):
        conn = get_db_connection(db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(f"CREATE TABLE {table_name} ({schema})")
            conn.commit()
        finally:
            conn.close()
