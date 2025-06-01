#!/usr/bin/env python3

import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Función de prueba básica para la base de datos"""
    try:
        print("1. Importando LandmarksDB...")
        from landmarks_db import LandmarksDB
        print("Importación exitosa")
        
        print("2. Creando instancia de LandmarksDB...")
        db = LandmarksDB()
        print("Instanciación exitosa")
        
        print("3. Probando método get_all_landmarks...")
        landmarks = db.get_all_landmarks()
        print(f"Número de landmarks: {len(landmarks)}")
        
        print("4. Probando método get_all_trips...")
        trips = db.get_all_trips()
        print(f"Número de viajes: {len(trips)}")
        
        print("Prueba completada con éxito")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        print(traceback.format_exc())

if __name__ == "__main__":
    main()
