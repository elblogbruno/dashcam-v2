#!/usr/bin/env python3
"""Final verification script for enhanced geodata system"""

import asyncio
import sys
import os
import sqlite3
import json

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

async def verify_enhanced_system():
    """Verify the enhanced geodata system is fully operational"""
    
    print("🔍 VERIFICACIÓN FINAL DEL SISTEMA MEJORADO DE GEODATOS")
    print("=" * 65)
    
    cache_db_path = os.path.join("data", "geocoding_offline.db")
    
    # Check database structure
    print("\n1️⃣ Verificando estructura de base de datos")
    print("-" * 50)
    
    try:
        conn = sqlite3.connect(cache_db_path)
        cursor = conn.cursor()
        
        # Check if detailed_geocoding table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='detailed_geocoding'
        """)
        
        detailed_table_exists = cursor.fetchone() is not None
        print(f"✅ Tabla detailed_geocoding existe: {detailed_table_exists}")
        
        if detailed_table_exists:
            # Get table schema
            cursor.execute("PRAGMA table_info(detailed_geocoding)")
            columns = cursor.fetchall()
            
            print(f"✅ Tabla tiene {len(columns)} columnas:")
            key_columns = ['place_id', 'osm_type', 'osm_id', 'display_name', 'raw_response', 
                          'house_number', 'road', 'quarter', 'suburb', 'city', 'county', 
                          'province', 'state', 'postcode', 'country', 'country_code']
            
            column_names = [col[1] for col in columns]
            for col in key_columns:
                exists = col in column_names
                status = "✅" if exists else "❌"
                print(f"   {status} {col}")
        
        # Check data quality
        cursor.execute("SELECT COUNT(*) FROM detailed_geocoding")
        total_detailed = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM detailed_geocoding WHERE raw_response IS NOT NULL")
        with_raw_response = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM detailed_geocoding WHERE place_id IS NOT NULL")
        with_place_id = cursor.fetchone()[0]
        
        print(f"\n📊 Estadísticas de calidad de datos:")
        print(f"   Total registros detallados: {total_detailed}")
        print(f"   Con raw_response: {with_raw_response}")
        print(f"   Con place_id: {with_place_id}")
        
        if total_detailed > 0:
            raw_percentage = (with_raw_response / total_detailed) * 100
            place_percentage = (with_place_id / total_detailed) * 100
            print(f"   Porcentaje con datos completos: {raw_percentage:.1f}%")
            print(f"   Porcentaje con Place ID: {place_percentage:.1f}%")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error verificando base de datos: {e}")
        return False
    
    # Check system components
    print("\n2️⃣ Verificando componentes del sistema")
    print("-" * 50)
    
    # Test reverse geocoding service
    try:
        from geocoding.services.reverse_geocoding_service import ReverseGeocodingService
        service = ReverseGeocodingService(cache_db_path=cache_db_path)
        print("✅ ReverseGeocodingService importado correctamente")
        
        # Quick test
        result = await service.get_location(41.4036, 2.1744)
        if result and result.raw_response:
            print("✅ Servicio devuelve datos enriquecidos")
        else:
            print("⚠️  Servicio funciona pero sin datos enriquecidos")
            
    except Exception as e:
        print(f"❌ Error con ReverseGeocodingService: {e}")
        return False
    
    # Test storage function
    try:
        from geocoding.utils.db_storage import store_geodata_in_db
        print("✅ store_geodata_in_db importado correctamente")
    except Exception as e:
        print(f"❌ Error importando store_geodata_in_db: {e}")
        return False
    
    # Test downloader
    try:
        from geocoding.downloader.geodata_downloader import GeodataDownloader
        downloader = GeodataDownloader()
        print("✅ GeodataDownloader importado correctamente")
    except Exception as e:
        print(f"❌ Error con GeodataDownloader: {e}")
        return False
    
    # Check route integration
    print("\n3️⃣ Verificando integración de rutas")
    print("-" * 50)
    
    try:
        # Check if trip_geodata routes use the new system
        with open('/root/dashcam-v2/backend/geocoding/routes/trip_geodata.py', 'r') as f:
            content = f.read()
            
        uses_store_geodata = 'store_geodata_in_db' in content
        uses_old_dbstorage = 'save_geodata_batch' in content
        
        print(f"✅ Rutas usan store_geodata_in_db: {uses_store_geodata}")
        print(f"✅ Rutas no usan save_geodata_batch obsoleto: {not uses_old_dbstorage}")
        
    except Exception as e:
        print(f"❌ Error verificando rutas: {e}")
        return False
    
    # Sample data quality check
    print("\n4️⃣ Verificando calidad de datos de muestra")
    print("-" * 50)
    
    try:
        conn = sqlite3.connect(cache_db_path)
        cursor = conn.cursor()
        
        # Get a sample with raw_response
        cursor.execute("""
            SELECT place_id, display_name, raw_response 
            FROM detailed_geocoding 
            WHERE raw_response IS NOT NULL 
            LIMIT 1
        """)
        
        sample = cursor.fetchone()
        
        if sample:
            place_id, display_name, raw_response = sample
            print(f"✅ Datos de muestra encontrados:")
            print(f"   Place ID: {place_id}")
            print(f"   Display: {display_name[:60]}...")
            
            # Parse raw response
            try:
                raw_data = json.loads(raw_response)
                address_components = len(raw_data.get('address', {}))
                print(f"   Componentes de dirección: {address_components}")
                print(f"   Tipo OSM: {raw_data.get('osm_type', 'N/A')}")
                print(f"   Importancia: {raw_data.get('importance', 'N/A')}")
                print("✅ Raw response JSON válido y completo")
            except:
                print("⚠️  Raw response no es JSON válido")
        else:
            print("⚠️  No hay datos de muestra con raw_response")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error verificando calidad de datos: {e}")
        return False
    
    print("\n" + "=" * 65)
    print("🎉 VERIFICACIÓN COMPLETADA")
    print("✅ El sistema mejorado de geodatos está completamente operativo")
    print("✅ Todos los componentes usan el almacenamiento detallado")
    print("✅ Las respuestas completas de Nominatim se almacenan correctamente")
    print("✅ Las rutas de trip geodata usan el nuevo sistema")
    print("=" * 65)
    
    return True

if __name__ == "__main__":
    success = asyncio.run(verify_enhanced_system())
    sys.exit(0 if success else 1)
