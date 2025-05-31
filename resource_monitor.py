#!/usr/bin/env python3
"""
Monitor de recursos para identificar problemas de memoria y CPU
durante el streaming MJPEG
"""

import asyncio
import aiohttp
import psutil
import time
import threading
import gc
import sys
import os
from datetime import datetime

class ResourceMonitor:
    def __init__(self):
        self.process = psutil.Process()
        self.monitoring = False
        self.data = []
        
    def get_memory_info(self):
        """Obtiene información detallada de memoria"""
        memory_info = self.process.memory_info()
        memory_percent = self.process.memory_percent()
        
        # Información del sistema
        virtual_memory = psutil.virtual_memory()
        
        return {
            'process_rss': memory_info.rss / 1024 / 1024,  # MB
            'process_vms': memory_info.vms / 1024 / 1024,  # MB
            'process_percent': memory_percent,
            'system_available': virtual_memory.available / 1024 / 1024,  # MB
            'system_percent': virtual_memory.percent,
            'gc_objects': len(gc.get_objects()),
            'threads': threading.active_count()
        }
    
    def get_cpu_info(self):
        """Obtiene información de CPU"""
        return {
            'process_cpu': self.process.cpu_percent(),
            'system_cpu': psutil.cpu_percent(),
            'load_avg': os.getloadavg() if hasattr(os, 'getloadavg') else (0, 0, 0)
        }
    
    def start_monitoring(self, interval=1.0):
        """Inicia el monitoreo en background"""
        self.monitoring = True
        
        def monitor_loop():
            while self.monitoring:
                try:
                    timestamp = datetime.now()
                    memory_info = self.get_memory_info()
                    cpu_info = self.get_cpu_info()
                    
                    entry = {
                        'timestamp': timestamp,
                        'memory': memory_info,
                        'cpu': cpu_info
                    }
                    
                    self.data.append(entry)
                    
                    # Log crítico si el uso de memoria es muy alto
                    if memory_info['process_rss'] > 500:  # >500MB
                        print(f"⚠️  MEMORIA ALTA: {memory_info['process_rss']:.1f}MB RSS")
                    
                    if memory_info['system_percent'] > 90:
                        print(f"🚨 SISTEMA CRÍTICO: {memory_info['system_percent']:.1f}% memoria usada")
                    
                    # Mantener solo los últimos 300 registros (5 minutos a 1 seg/intervalo)
                    if len(self.data) > 300:
                        self.data = self.data[-300:]
                        
                except Exception as e:
                    print(f"Error en monitoreo: {e}")
                
                time.sleep(interval)
        
        self.monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.monitor_thread.start()
        print("🔍 Monitoreo de recursos iniciado")
    
    def stop_monitoring(self):
        """Detiene el monitoreo"""
        self.monitoring = False
        print("⏹️  Monitoreo de recursos detenido")
    
    def get_summary(self):
        """Obtiene un resumen del monitoreo"""
        if not self.data:
            return "No hay datos de monitoreo"
        
        # Calcular estadísticas
        memory_values = [d['memory']['process_rss'] for d in self.data]
        cpu_values = [d['cpu']['process_cpu'] for d in self.data]
        threads_values = [d['memory']['threads'] for d in self.data]
        
        summary = f"""
📊 RESUMEN DE RECURSOS ({len(self.data)} muestras):

MEMORIA:
  - RSS Promedio: {sum(memory_values)/len(memory_values):.1f}MB
  - RSS Máximo: {max(memory_values):.1f}MB
  - RSS Mínimo: {min(memory_values):.1f}MB
  
CPU:
  - CPU Promedio: {sum(cpu_values)/len(cpu_values):.1f}%
  - CPU Máximo: {max(cpu_values):.1f}%
  
THREADS:
  - Threads Promedio: {sum(threads_values)/len(threads_values):.1f}
  - Threads Máximo: {max(threads_values)}
  
ÚLTIMA MUESTRA:
  - RSS: {self.data[-1]['memory']['process_rss']:.1f}MB
  - CPU: {self.data[-1]['cpu']['process_cpu']:.1f}%
  - Threads: {self.data[-1]['memory']['threads']}
  - Objetos GC: {self.data[-1]['memory']['gc_objects']}
"""
        return summary

async def test_mjpeg_with_monitoring():
    """
    Prueba el streaming MJPEG con monitoreo intensivo de recursos
    """
    monitor = ResourceMonitor()
    
    try:
        # Iniciar monitoreo
        monitor.start_monitoring(interval=0.5)  # Cada 500ms
        
        print("🚀 Iniciando prueba de MJPEG con monitoreo de recursos...")
        
        async with aiohttp.ClientSession() as session:
            
            # Paso 1: Activar streaming MJPEG
            print("📷 Activando streaming MJPEG...")
            async with session.post('http://localhost:8000/api/mjpeg/toggle/road') as resp:
                if resp.status == 200:
                    toggle_data = await resp.json()
                    print(f"✅ Streaming MJPEG: {toggle_data}")
                else:
                    print(f"❌ Error activando streaming: {resp.status}")
                    return
            
            await asyncio.sleep(2)  # Dar tiempo a la cámara
            print(monitor.get_summary())
            
            # Paso 2: Iniciar streaming
            print("🎥 Iniciando streaming MJPEG...")
            
            # Crear tarea de streaming
            streaming_task = asyncio.create_task(stream_mjpeg(session))
            
            # Crear tareas de peticiones concurrentes
            api_tasks = []
            for i in range(5):
                task = asyncio.create_task(make_concurrent_requests(session, f"worker-{i}"))
                api_tasks.append(task)
            
            # Ejecutar por 30 segundos
            await asyncio.sleep(30)
            
            # Cancelar tareas
            streaming_task.cancel()
            for task in api_tasks:
                task.cancel()
            
            # Esperar cancelaciones
            try:
                await asyncio.gather(streaming_task, *api_tasks, return_exceptions=True)
            except Exception:
                pass
        
        # Deactivar streaming
        async with aiohttp.ClientSession() as session:
            async with session.post('http://localhost:8000/api/mjpeg/toggle/road') as resp:
                print(f"📷 Streaming MJPEG desactivado: {resp.status}")
    
    finally:
        monitor.stop_monitoring()
        print(monitor.get_summary())
        
        # Forzar garbage collection
        gc.collect()
        final_memory = monitor.get_memory_info()
        print(f"🧹 Memoria después de GC: {final_memory['process_rss']:.1f}MB")

async def stream_mjpeg(session):
    """Tarea de streaming MJPEG"""
    try:
        print("🎬 Iniciando stream MJPEG...")
        async with session.get('http://localhost:8000/api/mjpeg/stream/road') as resp:
            frame_count = 0
            async for chunk in resp.content.iter_chunked(8192):
                frame_count += 1
                if frame_count % 30 == 0:  # Log cada 30 frames
                    print(f"📹 Frames recibidos: {frame_count}")
                    
    except asyncio.CancelledError:
        print("🛑 Stream cancelado")
    except Exception as e:
        print(f"❌ Error en stream: {e}")

async def make_concurrent_requests(session, worker_id):
    """Realiza peticiones concurrentes durante el streaming"""
    try:
        request_count = 0
        while True:
            try:
                async with session.get('http://localhost:8000/api/recording/status') as resp:
                    if resp.status == 200:
                        request_count += 1
                        if request_count % 10 == 0:
                            print(f"🔄 {worker_id}: {request_count} peticiones completadas")
                    else:
                        print(f"⚠️  {worker_id}: Status {resp.status}")
                        
                await asyncio.sleep(0.5)  # 2 req/seg por worker
                
            except Exception as e:
                print(f"❌ {worker_id}: Error en petición: {e}")
                await asyncio.sleep(1)
                
    except asyncio.CancelledError:
        print(f"🛑 {worker_id}: Worker cancelado, total: {request_count} peticiones")

if __name__ == "__main__":
    print("🔬 Monitor de Recursos - Dashcam MJPEG")
    print("=" * 50)
    
    try:
        asyncio.run(test_mjpeg_with_monitoring())
    except KeyboardInterrupt:
        print("\n🛑 Prueba interrumpida por usuario")
    except Exception as e:
        print(f"❌ Error general: {e}")
