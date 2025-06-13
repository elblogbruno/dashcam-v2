#!/usr/bin/env python3
"""
Prueba de funcionalidad de pausa/reanudación para descargas de landmarks y geodatos
"""

import asyncio
import aiohttp
import json
import time
import sys
import os

# Agregar el directorio del backend al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Base URL del servidor
BASE_URL = "http://localhost:8000"

async def test_landmarks_pause_resume():
    """Prueba la funcionalidad de pausa/reanudación para landmarks"""
    print("🧪 Iniciando prueba de pausa/reanudación de landmarks...")
    
    async with aiohttp.ClientSession() as session:
        # 1. Crear un viaje de prueba
        trip_data = {
            "name": "Test Trip - Pause/Resume",
            "start_location": {"lat": 40.4168, "lon": -3.7038},  # Madrid
            "end_location": {"lat": 41.3851, "lon": 2.1734},     # Barcelona
            "waypoints": [
                {"lat": 40.9631, "lon": -2.8523, "name": "Guadalajara"},
                {"lat": 41.1239, "lon": -1.2445, "name": "Zaragoza"}
            ]
        }
        
        try:
            # Crear viaje
            async with session.post(f"{BASE_URL}/api/trip-planner/trips", json=trip_data) as resp:
                if resp.status != 200:
                    print(f"❌ Error creando viaje: {resp.status}")
                    return False
                trip = await resp.json()
                trip_id = trip["id"]
                print(f"✅ Viaje creado con ID: {trip_id}")
            
            # 2. Iniciar descarga de landmarks
            async with session.post(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks") as resp:
                if resp.status != 200:
                    print(f"❌ Error iniciando descarga de landmarks: {resp.status}")
                    return False
                print("✅ Descarga de landmarks iniciada")
            
            # 3. Esperar un poco y pausar
            await asyncio.sleep(2)
            
            async with session.post(f"{BASE_URL}/api/trip-planner/{trip_id}/pause-landmarks-download") as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"✅ Landmarks pausados: {result.get('message', 'Sin mensaje')}")
                else:
                    print(f"❌ Error pausando landmarks: {resp.status}")
                    return False
            
            # 4. Verificar estado pausado
            async with session.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks-status") as resp:
                if resp.status == 200:
                    status = await resp.json()
                    if status.get("status") == "paused":
                        print("✅ Estado de landmarks confirmado como pausado")
                    else:
                        print(f"❌ Estado esperado 'paused', obtenido: {status.get('status')}")
                        return False
                else:
                    print(f"❌ Error verificando estado: {resp.status}")
                    return False
            
            # 5. Reanudar descarga
            await asyncio.sleep(1)
            
            async with session.post(f"{BASE_URL}/api/trip-planner/{trip_id}/resume-landmarks-download") as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"✅ Landmarks reanudados: {result.get('message', 'Sin mensaje')}")
                else:
                    print(f"❌ Error reanudando landmarks: {resp.status}")
                    return False
            
            # 6. Verificar que se reanudó
            await asyncio.sleep(1)
            
            async with session.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-landmarks-status") as resp:
                if resp.status == 200:
                    status = await resp.json()
                    current_status = status.get("status")
                    if current_status in ["downloading", "complete"]:
                        print(f"✅ Estado de landmarks después de reanudar: {current_status}")
                    else:
                        print(f"❌ Estado inesperado después de reanudar: {current_status}")
                        return False
                else:
                    print(f"❌ Error verificando estado después de reanudar: {resp.status}")
                    return False
            
            print("✅ Prueba de pausa/reanudación de landmarks completada exitosamente")
            return True
            
        except Exception as e:
            print(f"❌ Error en prueba de landmarks: {str(e)}")
            return False

async def test_geodata_pause_resume():
    """Prueba la funcionalidad de pausa/reanudación para geodatos"""
    print("\n🧪 Iniciando prueba de pausa/reanudación de geodatos...")
    
    async with aiohttp.ClientSession() as session:
        # 1. Crear un viaje de prueba
        trip_data = {
            "name": "Test Trip - Geodata Pause/Resume",
            "start_location": {"lat": 40.4168, "lon": -3.7038},  # Madrid
            "end_location": {"lat": 41.3851, "lon": 2.1734},     # Barcelona
            "waypoints": [
                {"lat": 40.9631, "lon": -2.8523, "name": "Guadalajara"}
            ]
        }
        
        try:
            # Crear viaje
            async with session.post(f"{BASE_URL}/api/trip-planner/trips", json=trip_data) as resp:
                if resp.status != 200:
                    print(f"❌ Error creando viaje: {resp.status}")
                    return False
                trip = await resp.json()
                trip_id = trip["id"]
                print(f"✅ Viaje creado con ID: {trip_id}")
            
            # 2. Iniciar descarga de geodatos
            geodata_request = {
                "radius_km": 5.0,
                "format": "both"
            }
            
            async with session.post(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata", json=geodata_request) as resp:
                if resp.status != 200:
                    print(f"❌ Error iniciando descarga de geodatos: {resp.status}")
                    return False
                print("✅ Descarga de geodatos iniciada")
            
            # 3. Esperar un poco y pausar
            await asyncio.sleep(2)
            
            async with session.post(f"{BASE_URL}/api/trip-planner/{trip_id}/pause-geodata-download") as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"✅ Geodatos pausados: {result.get('message', 'Sin mensaje')}")
                else:
                    print(f"❌ Error pausando geodatos: {resp.status}")
                    return False
            
            # 4. Verificar estado pausado
            async with session.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata-status") as resp:
                if resp.status == 200:
                    status = await resp.json()
                    if status.get("status") == "paused":
                        print("✅ Estado de geodatos confirmado como pausado")
                    else:
                        print(f"❌ Estado esperado 'paused', obtenido: {status.get('status')}")
                        return False
                else:
                    print(f"❌ Error verificando estado: {resp.status}")
                    return False
            
            # 5. Reanudar descarga
            await asyncio.sleep(1)
            
            async with session.post(f"{BASE_URL}/api/trip-planner/{trip_id}/resume-geodata-download") as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"✅ Geodatos reanudados: {result.get('message', 'Sin mensaje')}")
                else:
                    print(f"❌ Error reanudando geodatos: {resp.status}")
                    return False
            
            # 6. Verificar que se reanudó
            await asyncio.sleep(1)
            
            async with session.get(f"{BASE_URL}/api/trip-planner/{trip_id}/download-geodata-status") as resp:
                if resp.status == 200:
                    status = await resp.json()
                    current_status = status.get("status")
                    if current_status in ["downloading", "in_progress", "complete"]:
                        print(f"✅ Estado de geodatos después de reanudar: {current_status}")
                    else:
                        print(f"❌ Estado inesperado después de reanudar: {current_status}")
                        return False
                else:
                    print(f"❌ Error verificando estado después de reanudar: {resp.status}")
                    return False
            
            print("✅ Prueba de pausa/reanudación de geodatos completada exitosamente")
            return True
            
        except Exception as e:
            print(f"❌ Error en prueba de geodatos: {str(e)}")
            return False

async def check_server_status():
    """Verifica si el servidor está corriendo"""
    print("🔍 Verificando estado del servidor...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/api/system/status") as resp:
                if resp.status == 200:
                    print("✅ Servidor está corriendo")
                    return True
                else:
                    print(f"❌ Servidor responde con código: {resp.status}")
                    return False
    except Exception as e:
        print(f"❌ No se puede conectar al servidor: {str(e)}")
        print("💡 Asegúrate de que el servidor esté corriendo en http://localhost:8000")
        return False

async def main():
    """Función principal de pruebas"""
    print("🚀 Iniciando pruebas de funcionalidad de pausa/reanudación")
    print("="*60)
    
    # Verificar que el servidor esté corriendo
    if not await check_server_status():
        return
    
    # Ejecutar pruebas
    landmarks_success = await test_landmarks_pause_resume()
    geodata_success = await test_geodata_pause_resume()
    
    print("\n" + "="*60)
    print("📊 RESUMEN DE PRUEBAS:")
    print(f"   🏷️  Landmarks pause/resume: {'✅ EXITOSA' if landmarks_success else '❌ FALLIDA'}")
    print(f"   🌍 Geodatos pause/resume:  {'✅ EXITOSA' if geodata_success else '❌ FALLIDA'}")
    
    if landmarks_success and geodata_success:
        print("\n🎉 ¡TODAS LAS PRUEBAS PASARON! La funcionalidad de pausa/reanudación está funcionando correctamente.")
        return True
    else:
        print("\n⚠️  ALGUNAS PRUEBAS FALLARON. Revisa los logs para más detalles.")
        return False

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
