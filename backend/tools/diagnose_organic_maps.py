#!/usr/bin/env python3
"""
Script de diagnóstico para conexión a servidores de Organic Maps
Este script verifica la conectividad con los diferentes espejos de Organic Maps
y muestra información útil para la depuración.
"""

import aiohttp
import asyncio
import os
import sys
import json
import time
from datetime import datetime

# Añadir directorio raíz al path para importar módulos
parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(parent_dir)

# URLs de los espejos de Organic Maps
MIRRORS = [
    "https://omaps.webfreak.org/maps",
    "https://omaps.wfr.software/maps",
    "https://download.organicmaps.app/MapsWithMe"
]

# Versiones de mapas a probar
MAP_VERSIONS = ["250511", "240317", "230214"]

# Regiones importantes para pruebas
TEST_REGIONS = ["USA", "US_California", "World", "US_Arizona", "US_Nevada"]

async def check_mirror_url(url, timeout=10):
    """Verifica si un espejo está disponible"""
    print(f"Probando URL: {url}")
    try:
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            async with session.head(url, timeout=timeout, allow_redirects=True) as response:
                elapsed = time.time() - start_time
                print(f"  Status: {response.status}, Tiempo: {elapsed:.2f}s")
                return {
                    "url": url,
                    "status": response.status,
                    "elapsed_seconds": round(elapsed, 2),
                    "ok": response.status == 200,
                    "headers": dict(response.headers)
                }
    except Exception as e:
        print(f"  Error: {str(e)}")
        return {
            "url": url,
            "status": None,
            "error": str(e),
            "ok": False
        }

async def check_map_file(mirror_url, version, region):
    """Verifica si un archivo de mapa específico está disponible"""
    file_url = f"{mirror_url}/{version}/{region}.mwm"
    print(f"Comprobando mapa: {file_url}")
    try:
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            async with session.head(file_url, timeout=8, allow_redirects=True) as response:
                elapsed = time.time() - start_time
                print(f"  Status: {response.status}, Tiempo: {elapsed:.2f}s")
                
                if response.status == 200:
                    content_length = response.headers.get("Content-Length", "unknown")
                    content_type = response.headers.get("Content-Type", "unknown")
                    print(f"  Tamaño: {content_length} bytes, Tipo: {content_type}")
                
                return {
                    "file_url": file_url,
                    "status": response.status,
                    "elapsed_seconds": round(elapsed, 2),
                    "ok": response.status == 200,
                    "size": response.headers.get("Content-Length")
                }
    except Exception as e:
        print(f"  Error: {str(e)}")
        return {
            "file_url": file_url,
            "status": None,
            "error": str(e),
            "ok": False
        }

async def get_directory_listing(mirror_url, version):
    """Intenta obtener un listado del directorio de mapas"""
    url = f"{mirror_url}/{version}/"
    print(f"Obteniendo listado de directorio: {url}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=15, allow_redirects=True) as response:
                if response.status == 200:
                    content = await response.text(encoding='utf-8', errors='ignore')
                    print(f"  Contenido recibido: {len(content)} bytes")
                    
                    # Buscar archivos .mwm en el contenido
                    mwm_count = content.count(".mwm")
                    print(f"  Menciones a archivos .mwm encontradas: {mwm_count}")
                    
                    # Guardar contenido para análisis posterior
                    output_dir = os.path.join(parent_dir, "data", "organic_maps")
                    os.makedirs(output_dir, exist_ok=True)
                    
                    with open(os.path.join(output_dir, f"directory_{mirror_url.split('/')[-2]}_{version}.html"), "w") as f:
                        f.write(content)
                    
                    return {
                        "url": url,
                        "status": response.status,
                        "content_length": len(content),
                        "mwm_count": mwm_count,
                        "ok": mwm_count > 0
                    }
                else:
                    print(f"  Error: status {response.status}")
                    return {
                        "url": url,
                        "status": response.status,
                        "ok": False
                    }
    except Exception as e:
        print(f"  Error: {str(e)}")
        return {
            "url": url,
            "status": None,
            "error": str(e),
            "ok": False
        }

async def main():
    print("=" * 60)
    print("DIAGNÓSTICO DE CONEXIÓN A ORGANIC MAPS")
    print("=" * 60)
    print(f"Fecha y hora: {datetime.now().isoformat()}")
    print("\n1. Verificando conexión básica a los espejos...\n")
    
    # Verificar todos los espejos
    mirror_results = []
    for mirror in MIRRORS:
        result = await check_mirror_url(mirror)
        mirror_results.append(result)
    
    working_mirrors = [m["url"] for m in mirror_results if m.get("ok")]
    if not working_mirrors:
        print("\n❌ No se pudo conectar con ningún espejo. Verificar conectividad a Internet.")
    else:
        print(f"\n✅ Se pudieron contactar {len(working_mirrors)}/{len(MIRRORS)} espejos.")
    
    print("\n2. Verificando versiones de mapas disponibles...\n")
    
    # Para cada espejo disponible, verificar las versiones de mapas
    version_results = []
    for mirror in working_mirrors:
        for version in MAP_VERSIONS:
            version_url = f"{mirror}/{version}/"
            result = await check_mirror_url(version_url)
            version_results.append(result)
            
            if result.get("ok"):
                # Si la versión está disponible, obtener listado del directorio
                dir_result = await get_directory_listing(mirror, version)
    
    working_versions = [(r["url"], r.get("ok")) for r in version_results]
    print(f"\nVersiones disponibles:")
    for url, ok in working_versions:
        status = "✅" if ok else "❌"
        print(f"  {status} {url}")
    
    print("\n3. Verificando archivos de mapas específicos...\n")
    
    # Para cada combinación de espejo y versión disponible, verificar archivos específicos
    file_results = []
    best_mirror = None
    best_version = None
    
    for mirror in working_mirrors:
        for version in MAP_VERSIONS:
            version_url = f"{mirror}/{version}/"
            version_result = next((r for r in version_results if r["url"] == version_url), None)
            
            if version_result and version_result.get("ok"):
                print(f"\nProbando archivos en {mirror}/{version}/:")
                success_count = 0
                
                for region in TEST_REGIONS:
                    file_result = await check_map_file(mirror, version, region)
                    file_results.append(file_result)
                    if file_result.get("ok"):
                        success_count += 1
                
                if success_count > 0:
                    print(f"  ✅ {success_count}/{len(TEST_REGIONS)} archivos disponibles")
                    if not best_mirror:
                        best_mirror = mirror
                        best_version = version
                else:
                    print(f"  ❌ No se encontró ningún archivo")
    
    print("\n" + "=" * 60)
    print("RESULTADOS")
    print("=" * 60)
    
    if best_mirror:
        print(f"\n✅ Mejor configuración encontrada:")
        print(f"  Mirror: {best_mirror}")
        print(f"  Versión: {best_version}")
        print(f"  URL Base: {best_mirror}/{best_version}/")
        
        print("\nPara usar esta configuración, modifica la variable ORGANIC_MAPS_URLS en organic_maps.py:")
        print(f"""
ORGANIC_MAPS_URLS = [
    "{best_mirror}",  # Espejo principal
    # Otros espejos de respaldo
]
        """)
    else:
        print("\n❌ No se encontró ninguna configuración funcional.")
        print("  Verifica la conectividad a Internet o prueba más tarde.")
    
    # Guardar resultados completos para referencia
    results = {
        "timestamp": datetime.now().isoformat(),
        "mirrors": mirror_results,
        "versions": version_results,
        "files": file_results,
        "best_mirror": best_mirror,
        "best_version": best_version
    }
    
    output_dir = os.path.join(parent_dir, "data", "organic_maps")
    os.makedirs(output_dir, exist_ok=True)
    
    with open(os.path.join(output_dir, "diagnostic_results.json"), "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResultados guardados en data/organic_maps/diagnostic_results.json")
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
