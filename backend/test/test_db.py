#!/usr/bin/env python3

from landmarks_db import LandmarksDB
import json
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Función principal para probar la base de datos"""
    try:
        # Crear una instancia de la base de datos
        db = LandmarksDB()
        
        # Crear un viaje de prueba
        trip_id = str(uuid.uuid4())[:8]
        test_trip = {
            'id': trip_id,
            'name': 'Viaje de prueba',
            'start_location': {'lat': 40.7128, 'lon': -74.0060},
            'end_location': {'lat': 37.7749, 'lon': -122.4194},
            'origin_name': 'Nueva York',
            'destination_name': 'San Francisco',
            'start_date': '2025-05-11',
            'end_date': '2025-05-15',
            'notes': 'Un viaje de prueba para verificar la base de datos',
            'landmarks_downloaded': False,
            'completed': False,
            'waypoints': [
                {'lat': 39.9526, 'lon': -75.1652, 'name': 'Philadelphia'},
                {'lat': 41.8781, 'lon': -87.6298, 'name': 'Chicago'}
            ]
        }
        
        # Añadir el viaje a la base de datos
        print('Añadiendo viaje...')
        result = db.add_trip(test_trip)
        print(f'Resultado: {result is not None}')
        
        # Recuperar el viaje por ID
        print(f'Recuperando viaje con ID {trip_id}...')
        retrieved_trip = db.get_trip_by_id(trip_id)
        
        if retrieved_trip:
            print('Viaje encontrado:')
            print(json.dumps(retrieved_trip, indent=2))
            
            # Verificar waypoints
            print(f'El viaje tiene {len(retrieved_trip["waypoints"])} waypoints:')
            for i, wp in enumerate(retrieved_trip['waypoints']):
                print(f'  {i+1}. {wp.get("name", "Sin nombre")} ({wp["lat"]}, {wp["lon"]})')
        else:
            print('Error: El viaje no se encontró en la base de datos')
        
        # Obtener todos los viajes
        print('\nObteniendo todos los viajes...')
        all_trips = db.get_all_trips()
        print(f'Se encontraron {len(all_trips)} viajes en la base de datos')
        
        # Actualizar el estado del viaje
        print('\nActualizando estado del viaje...')
        db.update_trip_status(trip_id, landmarks_downloaded=True, completed=True)
        
        # Verificar la actualización
        updated_trip = db.get_trip_by_id(trip_id)
        print(f'Viaje actualizado - landmarks_downloaded: {updated_trip.get("landmarks_downloaded")}, completed: {updated_trip.get("completed")}')
        
        # Eliminar el viaje de prueba
        print('\nEliminando viaje de prueba...')
        deleted = db.remove_trip(trip_id)
        print(f'Viaje eliminado: {deleted}')
        
    except Exception as e:
        logger.error(f"Error en la prueba: {str(e)}", exc_info=True)

if __name__ == "__main__":
    main()
