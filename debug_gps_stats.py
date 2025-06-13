#!/usr/bin/env python3
"""
Debug script para investigar el problema con get_gps_statistics
"""

import sys
import os
sys.path.append('/root/dashcam-v2/backend')

from trip_logger_package.database.connection import DatabaseManager
from trip_logger_package.database.repository import TripRepository, GpsRepository
from trip_logger_package.models.db_models import GpsCoordinate
from sqlalchemy import func, text
import logging

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_gps_statistics():
    print("=== Testing GPS Statistics ===")
    
    # Initialize database
    db_manager = DatabaseManager('/root/dashcam-v2/data/recordings.db')
    session = db_manager.get_session()
    
    # Test direct SQL query
    print("\n1. Direct SQL count for trip_id=8:")
    result = session.execute(text("SELECT COUNT(*) FROM gps_coordinates WHERE trip_id = 8")).fetchone()
    print(f"   Result: {result[0] if result else 'None'}")
    
    # Test SQLAlchemy query using the model
    print("\n2. SQLAlchemy count for trip_id=8:")
    count = session.query(GpsCoordinate).filter(GpsCoordinate.trip_id == 8).count()
    print(f"   Result: {count}")
    
    # Test the repository method
    print("\n3. Repository method for trip_id=8:")
    gps_repo = GpsRepository(session)
    stats = gps_repo.get_gps_statistics(trip_id=8)
    print(f"   Result: {stats}")
    
    # Test the TripManager method
    print("\n4. TripManager method for trip_id=8:")
    from trip_logger_package.services.trip_manager import TripManager
    trip_manager = TripManager('/root/dashcam-v2/data/recordings.db')
    trip_stats = trip_manager.get_gps_statistics(trip_id=8)
    print(f"   Result: {trip_stats}")
    print(f"   Type: {type(trip_stats)}")
    print(f"   total_points: {getattr(trip_stats, 'total_points', 'NOT_FOUND')}")
    print(f"   avg_speed: {getattr(trip_stats, 'avg_speed', 'NOT_FOUND')}")
    print(f"   max_speed: {getattr(trip_stats, 'max_speed', 'NOT_FOUND')}")
    
    # Test general statistics
    print("\n5. All GPS coordinates count:")
    total_count = session.query(GpsCoordinate).count()
    print(f"   Result: {total_count}")
    
    # Test the specific query from the repository method
    print("\n6. Direct repository query test:")
    try:
        query = session.query(
            func.count().label('total_points'),
            func.min(GpsCoordinate.timestamp).label('first_point'),
            func.max(GpsCoordinate.timestamp).label('last_point'),
            func.avg(GpsCoordinate.speed).label('avg_speed'),
            func.max(GpsCoordinate.speed).label('max_speed'),
            func.avg(GpsCoordinate.satellites).label('avg_satellites'),
            func.count().filter(GpsCoordinate.fix_quality >= 3).label('high_quality_fixes')
        ).filter(GpsCoordinate.trip_id == 8)
        
        result = query.first()
        print(f"   Query result: {result}")
        if result:
            print(f"   total_points: {result.total_points}")
            print(f"   first_point: {result.first_point}")
            print(f"   last_point: {result.last_point}")
            print(f"   avg_speed: {result.avg_speed}")
            print(f"   max_speed: {result.max_speed}")
            print(f"   avg_satellites: {result.avg_satellites}")
            print(f"   high_quality_fixes: {result.high_quality_fixes}")
    except Exception as e:
        print(f"   Error: {e}")
        
    # Show some sample GPS data
    print("\n7. Sample GPS data for trip_id=8:")
    samples = session.query(GpsCoordinate).filter(GpsCoordinate.trip_id == 8).limit(5).all()
    for sample in samples:
        print(f"   ID: {sample.id}, Lat: {sample.latitude}, Lon: {sample.longitude}, Time: {sample.timestamp}")
    
    session.close()

if __name__ == "__main__":
    test_gps_statistics()
