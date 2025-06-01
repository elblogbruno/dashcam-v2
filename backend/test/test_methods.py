#!/usr/bin/env python3

import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_method(name, func):
    """Probar un método específico y capturar errores"""
    try:
        print(f"Probando método: {name}")
        result = func()
        print(f"Resultado: {result}")
        print("Éxito\n")
        return True
    except Exception as e:
        print(f"ERROR en {name}: {str(e)}")
        print(traceback.format_exc())
        print("\n")
        return False

def main():
    """Probar métodos individualmente"""
    from landmarks_db import LandmarksDB
    db = LandmarksDB()
    
    # Probar métodos uno por uno
    methods = [
        ("get_all_landmarks", lambda: db.get_all_landmarks()),
        ("get_all_trips", lambda: db.get_all_trips()),
        ("get_trip_by_id", lambda: db.get_trip_by_id("nonexistent")),  # ID no existente, pero no debería fallar
    ]
    
    success = 0
    for name, func in methods:
        if test_method(name, func):
            success += 1
    
    print(f"Completado: {success}/{len(methods)} pruebas exitosas")

if __name__ == "__main__":
    main()
