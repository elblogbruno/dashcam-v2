#!/usr/bin/env python3
"""
Test script para validar la funcionalidad de descarga de geodata
"""
import requests
import json
import time
import sys
import os

# Agregar el directorio backend al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

BASE_URL = "http://localhost:8000"

def test_trip_creation():
    """Crear un viaje de prueba"""
    print("🔄 Creando viaje de prueba...")
    
    trip_data = {
        "trip_name": "Test Geodata Trip",
        "start_location": "Madrid, Spain",
        "end_location": "Barcelona, Spain",
        "intermediate_waypoints": ["Zaragoza, Spain"],
        "start_date": "2024-01-15",
        "estimated_duration": 5
    }
    
    response = requests.post(f"{BASE_URL}/api/trip-planner/create", json=trip_data)
    
    if response.status_code == 200:
        trip_id = response.json()["trip_id"]
        print(f"✅ Viaje creado exitosamente con ID: {trip_id}")
        return trip_id
    else:
        print(f"❌ Error creando viaje: {response.status_code} - {response.text}")
        return None

def test_geodata_download(trip_id):
    """Probar la descarga de geodata"""
    print(f"🔄 Iniciando descarga de geodata para viaje {trip_id}...")
    
    geodata_request = {
        "radius_km": 5.0,
        "format": "csv"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata",
        json=geodata_request
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Descarga iniciada: {result}")
        return True
    else:
        print(f"❌ Error iniciando descarga: {response.status_code} - {response.text}")
        return False

def test_geodata_status(trip_id):
    """Monitorear el estado de la descarga"""
    print(f"🔄 Monitoreando estado de descarga para viaje {trip_id}...")
    
    max_attempts = 30
    attempt = 0
    
    while attempt < max_attempts:
        response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata-status")
        
        if response.status_code == 200:
            status = response.json()
            print(f"📊 Estado: {status}")
            
            if status["status"] == "completed":
                print("✅ Descarga completada!")
                return True
            elif status["status"] == "failed":
                print(f"❌ Descarga falló: {status.get('error_message', 'Error desconocido')}")
                return False
            
        time.sleep(2)
        attempt += 1
    
    print("⏰ Timeout esperando completar la descarga")
    return False

def test_csv_file_exists(trip_id):
    """Verificar que el archivo CSV fue creado"""
    csv_path = f"/root/dashcam-v2/backend/data/geodata/trip_{trip_id}_geodata.csv"
    
    if os.path.exists(csv_path):
        print(f"✅ Archivo CSV creado: {csv_path}")
        
        # Verificar contenido del archivo
        with open(csv_path, 'r') as f:
            lines = f.readlines()
            print(f"📄 Archivo tiene {len(lines)} líneas")
            if len(lines) > 1:
                print(f"📄 Primera línea (header): {lines[0].strip()}")
                print(f"📄 Segunda línea (ejemplo): {lines[1].strip()}")
                return True
    else:
        print(f"❌ Archivo CSV no encontrado: {csv_path}")
        return False

def check_server_status():
    """Verificar que el servidor está corriendo"""
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code == 200:
            print("✅ Servidor backend está corriendo")
            return True
        else:
            print(f"❌ Servidor responde con código: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ No se puede conectar al servidor: {e}")
        return False

def main():
    """Función principal de prueba"""
    print("🚀 Iniciando pruebas de funcionalidad de geodata\n")
    
    # 1. Verificar que el servidor está corriendo
    if not check_server_status():
        print("❌ El servidor no está disponible. Inicia el backend primero.")
        return False
    
    # 2. Crear un viaje de prueba
    trip_id = test_trip_creation()
    if not trip_id:
        return False
    
    # 3. Iniciar descarga de geodata
    if not test_geodata_download(trip_id):
        return False
    
    # 4. Monitorear estado
    if not test_geodata_status(trip_id):
        return False
    
    # 5. Verificar archivo CSV
    if not test_csv_file_exists(trip_id):
        return False
    
    print("\n🎉 ¡Todas las pruebas pasaron exitosamente!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
