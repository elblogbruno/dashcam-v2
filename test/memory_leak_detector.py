#!/usr/bin/env python3
"""
Detector de Memory Leaks para el sistema MJPEG
"""

import asyncio
import aiohttp
import tracemalloc
import gc
import time
import threading
from collections import defaultdict

class MemoryLeakDetector:
    def __init__(self):
        self.snapshots = []
        self.start_time = None
        
    def start_tracing(self):
        """Inicia el rastreo de memoria"""
        tracemalloc.start()
        self.start_time = time.time()
        print("🔍 Rastreo de memoria iniciado")
        
    def take_snapshot(self, label=""):
        """Toma una instantánea de memoria"""
        if not tracemalloc.is_tracing():
            print("❌ Rastreo no iniciado")
            return
            
        snapshot = tracemalloc.take_snapshot()
        self.snapshots.append({
            'snapshot': snapshot,
            'label': label,
            'time': time.time() - self.start_time,
            'gc_objects': len(gc.get_objects())
        })
        print(f"📸 Snapshot '{label}' tomado en t={self.snapshots[-1]['time']:.1f}s")
        
    def analyze_leaks(self):
        """Analiza posibles memory leaks"""
        if len(self.snapshots) < 2:
            print("❌ Se necesitan al menos 2 snapshots para analizar")
            return
            
        print("\n🔬 ANÁLISIS DE MEMORY LEAKS")
        print("=" * 50)
        
        for i in range(1, len(self.snapshots)):
            prev_snap = self.snapshots[i-1]
            curr_snap = self.snapshots[i]
            
            print(f"\n📊 Comparación: '{prev_snap['label']}' -> '{curr_snap['label']}'")
            
            # Comparar statistics
            top_stats = curr_snap['snapshot'].compare_to(
                prev_snap['snapshot'], 'lineno'
            )
            
            print("TOP 10 DIFERENCIAS:")
            for index, stat in enumerate(top_stats[:10], 1):
                print(f"  {index:2d}. {stat}")
            
            # Objetos de GC
            gc_diff = curr_snap['gc_objects'] - prev_snap['gc_objects']
            print(f"📈 Diferencia objetos GC: {gc_diff:+d}")
            
            # Memory usage por archivo
            print("\n📁 TOP ARCHIVOS CON MÁS MEMORIA:")
            file_stats = defaultdict(int)
            for stat in top_stats:
                if stat.size_diff > 0:  # Solo incrementos
                    filename = stat.traceback.format()[0].split('"')[1] if stat.traceback.format() else "unknown"
                    file_stats[filename] += stat.size_diff
            
            for filename, size_diff in sorted(file_stats.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"  📄 {filename}: +{size_diff/1024:.1f}KB")

async def test_memory_leaks():
    """Test principal para detectar memory leaks"""
    detector = MemoryLeakDetector()
    
    try:
        # Iniciar rastreo
        detector.start_tracing()
        detector.take_snapshot("inicio")
        
        async with aiohttp.ClientSession() as session:
            
            # Activar streaming
            print("📷 Activando streaming MJPEG...")
            async with session.post('http://localhost:8000/api/mjpeg/toggle/road') as resp:
                print(f"Respuesta activación: {resp.status}")
                
            await asyncio.sleep(2)
            detector.take_snapshot("mjpeg_activado")
            
            # Test 1: Streaming corto
            print("\n🎥 Test 1: Streaming corto (10 segundos)")
            stream_task = asyncio.create_task(stream_for_duration(session, 10))
            await stream_task
            
            detector.take_snapshot("stream_corto")
            await asyncio.sleep(2)  # Tiempo para cleanup
            gc.collect()  # Forzar garbage collection
            
            detector.take_snapshot("post_cleanup_1")
            
            # Test 2: Múltiples ciclos de streaming
            print("\n🔄 Test 2: Múltiples ciclos de streaming")
            for cycle in range(3):
                print(f"  Ciclo {cycle + 1}/3")
                stream_task = asyncio.create_task(stream_for_duration(session, 5))
                await stream_task
                await asyncio.sleep(1)
                gc.collect()
                
            detector.take_snapshot("multiples_ciclos")
            
            # Test 3: Streaming con peticiones concurrentes
            print("\n⚡ Test 3: Streaming + peticiones concurrentes")
            stream_task = asyncio.create_task(stream_for_duration(session, 15))
            requests_task = asyncio.create_task(concurrent_requests(session, 15))
            
            await asyncio.gather(stream_task, requests_task)
            
            detector.take_snapshot("concurrente")
            
            # Cleanup final
            await asyncio.sleep(2)
            gc.collect()
            detector.take_snapshot("final_cleanup")
            
            # Desactivar streaming
            async with session.post('http://localhost:8000/api/mjpeg/toggle/road') as resp:
                print(f"📷 Streaming MJPEG desactivado: {resp.status}")
                
    finally:
        # Analizar resultados
        detector.analyze_leaks()

async def stream_for_duration(session, duration):
    """Stream MJPEG por una duración específica"""
    try:
        async with session.get('http://localhost:8000/api/mjpeg/stream/road') as resp:
            start_time = time.time()
            frame_count = 0
            
            async for chunk in resp.content.iter_chunked(8192):
                frame_count += 1
                if time.time() - start_time >= duration:
                    break
                    
            print(f"  📹 Stream completado: {frame_count} frames en {duration}s")
            
    except Exception as e:
        print(f"  ❌ Error en stream: {e}")

async def concurrent_requests(session, duration):
    """Realiza peticiones concurrentes por una duración específica"""
    start_time = time.time()
    request_count = 0
    
    try:
        while time.time() - start_time < duration:
            async with session.get('http://localhost:8000/api/recording/status') as resp:
                if resp.status == 200:
                    request_count += 1
                    
            await asyncio.sleep(0.2)  # 5 req/seg
            
        print(f"  🔄 Peticiones completadas: {request_count}")
        
    except Exception as e:
        print(f"  ❌ Error en peticiones: {e}")

if __name__ == "__main__":
    print("🕵️  Detector de Memory Leaks - Dashcam MJPEG")
    print("=" * 50)
    
    try:
        asyncio.run(test_memory_leaks())
    except KeyboardInterrupt:
        print("\n🛑 Análisis interrumpido por usuario")
    except Exception as e:
        print(f"❌ Error general: {e}")
        import traceback
        traceback.print_exc()
