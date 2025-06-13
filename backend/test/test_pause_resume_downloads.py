#!/usr/bin/env python3
"""
Test script para validar la funcionalidad de pausa/reanudación de descargas
de landmarks y geodatos
"""
import requests
import json
import time
import sys
import os
import asyncio

# Agregar el directorio backend al path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

BASE_URL = "http://localhost:8000"

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

def create_test_trip():
    """Crear un viaje de prueba con múltiples waypoints"""
    print("🔄 Creando viaje de prueba para funcionalidad de pausa/reanudación...")
    
    trip_data = {
        "name": "Test Pause Resume Trip",
        "origin_name": "Madrid Centro",
        "destination_name": "Barcelona Sagrada Familia",
        "start_location": {
            "lat": 40.4168,
            "lon": -3.7038
        },
        "end_location": {
            "lat": 41.4036,
            "lon": 2.1744
        },
        "waypoints": [
            {
                "lat": 41.6561,
                "lon": -0.8773,
                "name": "Zaragoza Centro"
            },
            {
                "lat": 41.8919,
                "lon": 0.6349,
                "name": "Lleida"
            }
        ],
        "start_date": "2024-01-20",
        "estimated_duration": 7
    }
    
    response = requests.post(f"{BASE_URL}/api/trip-planner", json=trip_data)
    
    if response.status_code == 200:
        trip = response.json()
        trip_id = trip["id"]
        print(f"✅ Viaje creado exitosamente con ID: {trip_id}")
        return trip_id
    else:
        print(f"❌ Error creando viaje: {response.status_code} - {response.text}")
        return None

def test_landmarks_pause_resume(trip_id):
    """Probar pausa y reanudación de descarga de landmarks"""
    print(f"\n🔄 Probando pausa/reanudación de descarga de landmarks para viaje {trip_id}...")
    
    # 1. Iniciar descarga de landmarks
    print("📥 Iniciando descarga de landmarks...")
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks?radius_km=5")
    
    if response.status_code != 200:
        print(f"❌ Error iniciando descarga de landmarks: {response.status_code} - {response.text}")
        return False
    
    print("✅ Descarga de landmarks iniciada")
    
    # 2. Esperar un poco para que la descarga progrese
    print("⏳ Esperando 3 segundos para que la descarga progrese...")
    time.sleep(3)
    
    # 3. Verificar estado antes de pausar
    response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks-status")
    if response.status_code == 200:
        status = response.json()
        print(f"📊 Estado antes de pausar: {status}")
    
    # 4. Pausar la descarga
    print("⏸️ Pausando descarga de landmarks...")
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/pause-landmarks-download")
    
    if response.status_code != 200:
        print(f"❌ Error pausando descarga: {response.status_code} - {response.text}")
        return False
    
    result = response.json()
    print(f"✅ Descarga pausada: {result}")
    
    # 5. Verificar que el estado es 'paused'
    print("🔍 Verificando estado de pausa...")
    time.sleep(1)
    response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks-status")
    
    if response.status_code == 200:
        status = response.json()
        print(f"📊 Estado después de pausar: {status}")
        
        if status.get("status") != "paused":
            print("❌ El estado no cambió a 'paused'")
            return False
        else:
            print("✅ Estado correctamente cambiado a 'paused'")
    else:
        print(f"❌ Error obteniendo estado: {response.status_code}")
        return False
    
    # 6. Reanudar la descarga
    print("▶️ Reanudando descarga de landmarks...")
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/resume-landmarks-download")
    
    if response.status_code != 200:
        print(f"❌ Error reanudando descarga: {response.status_code} - {response.text}")
        return False
    
    result = response.json()
    print(f"✅ Descarga reanudada: {result}")
    
    # 7. Verificar que el estado volvió a 'downloading'
    print("🔍 Verificando reanudación...")
    time.sleep(1)
    response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks-status")
    
    if response.status_code == 200:
        status = response.json()
        print(f"📊 Estado después de reanudar: {status}")
        
        if status.get("status") not in ["downloading", "in_progress"]:
            print("❌ El estado no cambió a 'downloading' o 'in_progress'")
            return False
        else:
            print("✅ Estado correctamente cambiado a 'downloading'")
    
    # 8. Esperar a que termine la descarga
    print("⏳ Esperando completar descarga de landmarks...")
    max_attempts = 30
    attempt = 0
    
    while attempt < max_attempts:
        response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks-status")
        
        if response.status_code == 200:
            status = response.json()
            
            if status.get("status") == "complete":
                print("✅ Descarga de landmarks completada después de reanudar!")
                return True
            elif status.get("status") == "error":
                print(f"❌ Descarga falló: {status}")
                return False
        
        time.sleep(2)
        attempt += 1
    
    print("⏰ Timeout esperando completar la descarga de landmarks")
    return False

def test_geodata_pause_resume(trip_id):
    """Probar pausa y reanudación de descarga de geodatos"""
    print(f"\n🔄 Probando pausa/reanudación de descarga de geodatos para viaje {trip_id}...")
    
    # 1. Iniciar descarga de geodatos
    print("📥 Iniciando descarga de geodatos...")
    geodata_request = {
        "radius_km": 3.0,
        "format": "both"
    }
    
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata", json=geodata_request)
    
    if response.status_code != 200:
        print(f"❌ Error iniciando descarga de geodatos: {response.status_code} - {response.text}")
        return False
    
    print("✅ Descarga de geodatos iniciada")
    
    # 2. Esperar un poco para que la descarga progrese
    print("⏳ Esperando 4 segundos para que la descarga progrese...")
    time.sleep(4)
    
    # 3. Verificar estado antes de pausar
    response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata-status")
    if response.status_code == 200:
        status = response.json()
        print(f"📊 Estado antes de pausar: {status}")
    
    # 4. Pausar la descarga
    print("⏸️ Pausando descarga de geodatos...")
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/pause-geodata-download")
    
    if response.status_code != 200:
        print(f"❌ Error pausando descarga: {response.status_code} - {response.text}")
        return False
    
    result = response.json()
    print(f"✅ Descarga pausada: {result}")
    
    # 5. Verificar que el estado es 'paused'
    print("🔍 Verificando estado de pausa...")
    time.sleep(1)
    response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata-status")
    
    if response.status_code == 200:
        status = response.json()
        print(f"📊 Estado después de pausar: {status}")
        
        if status.get("status") != "paused":
            print("❌ El estado no cambió a 'paused'")
            return False
        else:
            print("✅ Estado correctamente cambiado a 'paused'")
    else:
        print(f"❌ Error obteniendo estado: {response.status_code}")
        return False
    
    # 6. Reanudar la descarga
    print("▶️ Reanudando descarga de geodatos...")
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/resume-geodata-download")
    
    if response.status_code != 200:
        print(f"❌ Error reanudando descarga: {response.status_code} - {response.text}")
        return False
    
    result = response.json()
    print(f"✅ Descarga reanudada: {result}")
    
    # 7. Verificar que el estado volvió a 'downloading'
    print("🔍 Verificando reanudación...")
    time.sleep(1)
    response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata-status")
    
    if response.status_code == 200:
        status = response.json()
        print(f"📊 Estado después de reanudar: {status}")
        
        if status.get("status") not in ["downloading", "in_progress"]:
            print("❌ El estado no cambió a 'downloading' o 'in_progress'")
            return False
        else:
            print("✅ Estado correctamente cambiado a 'downloading'")
    
    # 8. Esperar a que termine la descarga
    print("⏳ Esperando completar descarga de geodatos...")
    max_attempts = 45  # Más tiempo para geodatos
    attempt = 0
    
    while attempt < max_attempts:
        response = requests.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata-status")
        
        if response.status_code == 200:
            status = response.json()
            print(f"📊 Estado actual: {status.get('status')} - Progreso: {status.get('progress', 0)}%")
            
            if status.get("status") == "complete":
                print("✅ Descarga de geodatos completada después de reanudar!")
                return True
            elif status.get("status") == "error":
                print(f"❌ Descarga falló: {status}")
                return False
        
        time.sleep(3)
        attempt += 1
    
    print("⏰ Timeout esperando completar la descarga de geodatos")
    return False

def test_edge_cases(trip_id):
    """Probar casos extremos"""
    print(f"\n🔄 Probando casos extremos para viaje {trip_id}...")
    
    # 1. Intentar pausar cuando no hay descarga activa
    print("🧪 Intentando pausar cuando no hay descarga activa...")
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/pause-landmarks-download")
    
    if response.status_code == 200:
        result = response.json()
        if result.get("status") == "not_found":
            print("✅ Respuesta correcta: no hay descarga para pausar")
        else:
            print(f"⚠️ Respuesta inesperada: {result}")
    
    # 2. Intentar reanudar cuando no hay descarga pausada
    print("🧪 Intentando reanudar cuando no hay descarga pausada...")
    response = requests.post(f"{BASE_URL}/api/trip-planner/{trip_id}/resume-landmarks-download")
    
    if response.status_code == 200:
        result = response.json()
        if result.get("status") in ["not_found", "invalid_state"]:
            print("✅ Respuesta correcta: no hay descarga para reanudar")
        else:
            print(f"⚠️ Respuesta inesperada: {result}")
    
    return True

def cleanup_test_trip(trip_id):
    """Limpiar el viaje de prueba"""
    print(f"\n🧹 Limpiando viaje de prueba {trip_id}...")
    
    response = requests.delete(f"{BASE_URL}/api/trip-planner/{trip_id}")
    
    if response.status_code == 200:
        print("✅ Viaje de prueba eliminado")
        return True
    else:
        print(f"⚠️ Error eliminando viaje: {response.status_code} - {response.text}")
        return False

def main():
    """Función principal de prueba"""
    print("🚀 Iniciando pruebas de funcionalidad de pausa/reanudación\n")
    
    # 1. Verificar que el servidor está corriendo
    if not check_server_status():
        print("❌ El servidor no está disponible. Inicia el backend primero.")
        return False
    
    # 2. Crear un viaje de prueba
    trip_id = create_test_trip()
    if not trip_id:
        return False
    
    try:
        # 3. Probar pausa/reanudación de landmarks
        if not test_landmarks_pause_resume(trip_id):
            print("❌ Falló la prueba de pausa/reanudación de landmarks")
            return False
        
        # 4. Probar pausa/reanudación de geodatos
        if not test_geodata_pause_resume(trip_id):
            print("❌ Falló la prueba de pausa/reanudación de geodatos")
            return False
        
        # 5. Probar casos extremos
        if not test_edge_cases(trip_id):
            print("❌ Falló la prueba de casos extremos")
            return False
        
    finally:
        # 6. Limpiar viaje de prueba
        cleanup_test_trip(trip_id)
    
    print("\n🎉 ¡Todas las pruebas de pausa/reanudación pasaron exitosamente!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
