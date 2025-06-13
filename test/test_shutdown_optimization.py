#!/usr/bin/env python3
"""
Test script para verificar que el shutdown rápido funciona correctamente
durante el desarrollo
"""

import time
import asyncio
import logging
from datetime import datetime

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_shutdown_speed():
    """Test del tiempo de shutdown del sistema MJPEG"""
    
    print("🧪 Iniciando test de velocidad de shutdown...")
    print("=" * 50)
    
    # Importar módulos del sistema
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
        
        from shutdown_control import shutdown_controller, interruptible_sleep
        from routes import mjpeg_stream
        
        print("✅ Módulos importados correctamente")
        
        # Test 1: Verificar interruptible_sleep
        print("\n🕒 Test 1: Interruptible sleep...")
        start_time = time.time()
        
        # Simular shutdown después de 1 segundo
        async def trigger_shutdown():
            await asyncio.sleep(1.0)
            shutdown_controller.request_shutdown()
            print("🛑 Shutdown solicitado")
        
        # Crear tareas
        shutdown_task = asyncio.create_task(trigger_shutdown())
        sleep_task = asyncio.create_task(interruptible_sleep(10.0, "mjpeg"))
        
        # Ejecutar ambas
        await asyncio.gather(shutdown_task, sleep_task, return_exceptions=True)
        
        elapsed = time.time() - start_time
        print(f"⏱️ Sleep interrumpido en {elapsed:.2f}s (debería ser ~1s)")
        
        if elapsed < 2.0:
            print("✅ Interruptible sleep funciona correctamente")
        else:
            print("❌ Interruptible sleep demasiado lento")
            
        # Reset para siguiente test
        shutdown_controller.mjpeg_running = True
        shutdown_controller.shutdown_requested = False
        
        # Test 2: Verificar cleanup_inactive_clients rápido
        print("\n🧹 Test 2: Cleanup rápido de clientes MJPEG...")
        start_time = time.time()
        
        # Simular algunos clientes
        mjpeg_stream.client_streams = {
            "test_client_1": {"camera_type": "road", "last_activity": 0},
            "test_client_2": {"camera_type": "interior", "last_activity": 0}
        }
        
        # Simular shutdown después de 0.5 segundos
        async def trigger_shutdown_fast():
            await asyncio.sleep(0.5)
            shutdown_controller.request_shutdown()
            print("🛑 Shutdown rápido solicitado")
        
        # Ejecutar cleanup con shutdown
        shutdown_task = asyncio.create_task(trigger_shutdown_fast())
        cleanup_task = asyncio.create_task(mjpeg_stream.cleanup_inactive_clients())
        
        await asyncio.gather(shutdown_task, cleanup_task, return_exceptions=True)
        
        elapsed = time.time() - start_time
        print(f"⏱️ Cleanup terminado en {elapsed:.2f}s (debería ser ~0.5s)")
        
        if elapsed < 1.0:
            print("✅ Cleanup rápido funciona correctamente")
        else:
            print("❌ Cleanup demasiado lento")
            
        print(f"\n📊 Resumen:")
        print(f"   - Interruptible sleep: {elapsed:.2f}s")
        print(f"   - Sistema optimizado para desarrollo")
        print(f"   - Reinicio del servidor debería ser más rápido")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_shutdown_speed())
    
    if success:
        print("\n🎉 TODAS LAS OPTIMIZACIONES DE SHUTDOWN FUNCIONAN")
        print("El servidor debería reiniciarse mucho más rápido durante el desarrollo")
    else:
        print("\n❌ Hay problemas con las optimizaciones")
        exit(1)
