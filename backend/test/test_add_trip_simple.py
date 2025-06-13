#!/usr/bin/env python3

import logging
import traceback
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Probar específicamente el método add_trip"""
    try:
        from landmarks.core.landmarks_db import LandmarksDB
        db = LandmarksDB()
        
        # Crear un viaje de prueba simple
        trip_id = str(uuid.uuid4())[:8]
        print(f"ID del viaje de prueba: {trip_id}")
        
        test_trip = {
            'id': trip_id,
            'name': 'Prueba add_trip',
            'start_location': {'lat': 40.0, 'lon': -74.0},
            'end_location': {'lat': 37.0, 'lon': -122.0},
            'start_date': '2025-06-01',
            'end_date': '2025-06-05',
            'waypoints': []
        }
        
        # Llamar al método add_trip
        print("Llamando a add_trip...")
        result = db.add_trip(test_trip)
        
        print(f"Resultado: {result is not None}")
        
        # Verificar que el viaje se haya añadido
        all_trips = db.get_all_trips()
        print(f"Total de viajes en la base de datos: {len(all_trips)}")
        
        # Verificar si nuestro viaje está en la lista
        found = any(trip['id'] == trip_id for trip in all_trips)
        print(f"¿Se encontró el viaje añadido? {found}")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        print(traceback.format_exc())

if __name__ == "__main__":
    main()
