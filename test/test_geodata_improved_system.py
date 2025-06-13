#!/usr/bin/env python3
"""
Script de prueba para el sistema mejorado de descarga de geodatos.
Este script simula la descarga de datos geográficos para un viaje
usando APIs online y almacenándolos en formato compatible con reverse_geocoder.
"""

import asyncio
import json
import logging
import sys
import os
from pathlib import Path

# Añadir el directorio backend al path para importar módulos
sys.path.append('/root/dashcam-v2/backend')

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_improved_geodata_system():
    """Prueba del sistema mejorado de geodatos"""
    logger.info("🚀 Iniciando prueba del sistema mejorado de geodatos")
    
    try:
        # Importar las funciones necesarias
        from routes.trip_planner import (
            download_geodata_for_location,
            fetch_reverse_geocoding_from_nominatim,
            generate_comprehensive_grid_coverage,
            calculate_trip_route_coverage,
            save_geodata_to_csv,
            get_offline_geocoding_instructions
        )
        
        logger.info("✅ Módulos importados correctamente")
        
        # Simular configuración
        class MockConfig:
            data_path = "/root/dashcam-v2/data"
        
        # Establecer configuración global (hack para las pruebas)
        import routes.trip_planner as tp
        tp.config = MockConfig()
        
        # Crear directorio de prueba
        test_data_dir = Path(MockConfig.data_path) / "custom_geocoding"
        test_data_dir.mkdir(exist_ok=True, parents=True)
        
        # Coordenadas de prueba (Madrid, España)
        test_locations = [
            {"lat": 40.4168, "lon": -3.7038, "name": "Madrid Centro"},
            {"lat": 40.4165, "lon": -3.7035, "name": "Madrid Puerta del Sol"},
        ]
        
        logger.info("🔍 Probando descarga de datos geográficos...")
        
        # Probar descarga de geodatos para cada ubicación
        all_geodata = []
        for location in test_locations:
            logger.info(f"📍 Descargando geodatos para {location['name']}")
            
            geodata = await download_geodata_for_location(
                location['lat'], 
                location['lon'], 
                2.0,  # Radio de 2 km
                location['name']
            )
            
            logger.info(f"✅ Descargados {len(geodata)} registros para {location['name']}")
            all_geodata.extend(geodata)
            
            # Pequeña pausa para no sobrecargar la API
            await asyncio.sleep(1)
        
        logger.info(f"📊 Total de registros descargados: {len(all_geodata)}")
        
        # Probar cálculo de cobertura
        logger.info("🎯 Calculando cobertura de ruta...")
        
        coverage_stats = calculate_trip_route_coverage(
            test_locations, 
            all_geodata, 
            2.0
        )
        
        logger.info("📈 Estadísticas de cobertura:")
        for key, value in coverage_stats.items():
            logger.info(f"   {key}: {value}")
        
        # Probar guardado en CSV
        logger.info("💾 Guardando datos en CSV...")
        
        csv_path = await save_geodata_to_csv(
            all_geodata, 
            "test_trip_001", 
            "Prueba Madrid"
        )
        
        logger.info(f"✅ CSV guardado en: {csv_path}")
        
        # Mostrar instrucciones offline
        instructions = get_offline_geocoding_instructions(csv_path)
        logger.info("📋 Instrucciones para uso offline:")
        logger.info(instructions)
        
        # Verificar que el archivo existe y tiene contenido
        if os.path.exists(csv_path):
            file_size = os.path.getsize(csv_path)
            logger.info(f"📁 Archivo CSV creado: {file_size} bytes")
            
            # Leer las primeras líneas para verificar formato
            with open(csv_path, 'r', encoding='utf-8') as f:
                first_lines = [f.readline().strip() for _ in range(3)]
                logger.info("📄 Primeras líneas del CSV:")
                for i, line in enumerate(first_lines):
                    logger.info(f"   {i+1}: {line}")
        
        # Resumen final
        logger.info("🎉 PRUEBA COMPLETADA EXITOSAMENTE")
        logger.info("=" * 60)
        logger.info("RESUMEN DE LA PRUEBA:")
        logger.info(f"• Ubicaciones procesadas: {len(test_locations)}")
        logger.info(f"• Registros geodatos descargados: {len(all_geodata)}")
        logger.info(f"• Cobertura de ruta: {coverage_stats.get('coverage_percentage', 0):.1f}%")
        logger.info(f"• Archivo CSV: {csv_path}")
        logger.info(f"• Distancia total de ruta: {coverage_stats.get('total_route_distance_km', 0)} km")
        logger.info("=" * 60)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error durante la prueba: {str(e)}", exc_info=True)
        return False

async def test_individual_functions():
    """Prueba funciones individuales"""
    logger.info("🔧 Probando funciones individuales...")
    
    try:
        from routes.trip_planner import (
            fetch_reverse_geocoding_from_nominatim,
            generate_comprehensive_grid_coverage,
            calculate_distance_km
        )
        
        # Probar API de Nominatim
        logger.info("🌐 Probando API de Nominatim...")
        result = await fetch_reverse_geocoding_from_nominatim(40.4168, -3.7038)
        if result:
            logger.info(f"✅ Nominatim API: {result.get('display_name', 'Sin nombre')}")
        else:
            logger.warning("⚠️  No se pudo obtener datos de Nominatim")
        
        # Probar generación de grid
        logger.info("🗂️ Probando generación de grid...")
        grid_points = generate_comprehensive_grid_coverage(40.4168, -3.7038, 1.0)
        logger.info(f"✅ Grid generado: {len(grid_points)} puntos")
        
        # Probar cálculo de distancia
        logger.info("📏 Probando cálculo de distancia...")
        distance = calculate_distance_km(40.4168, -3.7038, 40.4165, -3.7035)
        logger.info(f"✅ Distancia calculada: {distance:.3f} km")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error en pruebas individuales: {str(e)}", exc_info=True)
        return False

async def main():
    """Función principal de prueba"""
    logger.info("🧪 INICIANDO PRUEBAS DEL SISTEMA MEJORADO DE GEODATOS")
    logger.info("=" * 70)
    
    # Verificar conexión a internet
    try:
        import requests
        response = requests.get("https://httpbin.org/ip", timeout=5)
        if response.status_code == 200:
            logger.info("🌐 Conexión a internet verificada")
        else:
            logger.warning("⚠️ Problema con la conexión a internet")
    except Exception as e:
        logger.warning(f"⚠️ No se pudo verificar conexión a internet: {e}")
    
    # Ejecutar pruebas
    success1 = await test_individual_functions()
    logger.info("=" * 40)
    
    success2 = await test_improved_geodata_system()
    
    # Resultado final
    if success1 and success2:
        logger.info("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE")
        logger.info("🚀 El sistema mejorado de geodatos está funcionando correctamente")
        logger.info("💡 Los datos se descargan online y se guardan para uso offline")
        logger.info("📊 Se calcula la cobertura de ruta automáticamente")
        sys.exit(0)
    else:
        logger.error("❌ ALGUNAS PRUEBAS FALLARON")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
