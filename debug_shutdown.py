#!/usr/bin/env python3
"""
Script de diagnóstico para identificar qué procesos están bloqueando el cierre del servidor
"""
import asyncio
import time
import psutil
import os
import sys
import signal
import threading
from pathlib import Path

# Añadir el directorio backend al path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

def monitor_server_shutdown():
    """Monitorear el proceso de cierre del servidor"""
    print("🔍 Iniciando monitoreo de cierre del servidor...")
    
    # Buscar el proceso del servidor
    server_pid = None
    print("🔍 Buscando procesos del servidor...")
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info['cmdline']
            if cmdline:
                cmdline_str = ' '.join(cmdline)
                print(f"   Revisando PID {proc.info['pid']}: {cmdline_str[:80]}...")
                
                # Buscar uvicorn o main.py
                if any(keyword in cmdline_str for keyword in ['uvicorn', 'main.py', 'fastapi']):
                    server_pid = proc.info['pid']
                    print(f"📍 Proceso servidor encontrado: PID {server_pid}")
                    print(f"    Comando completo: {cmdline_str}")
                    break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if not server_pid:
        print("❌ No se encontró el proceso del servidor")
        return
    
    try:
        server_proc = psutil.Process(server_pid)
        print(f"🎯 Monitoreando proceso: {server_proc.name()} (PID: {server_pid})")
        
        # Enviar señal SIGTERM para iniciar cierre
        print("📤 Enviando SIGTERM al servidor...")
        server_proc.send_signal(signal.SIGTERM)
        
        # Monitorear el proceso durante el cierre
        start_time = time.time()
        last_status_time = start_time
        
        while server_proc.is_running():
            current_time = time.time()
            elapsed = current_time - start_time
            
            # Mostrar estado cada 2 segundos
            if current_time - last_status_time >= 2.0:
                try:
                    # Obtener información del proceso
                    memory_info = server_proc.memory_info()
                    threads = server_proc.num_threads()
                    cpu_percent = server_proc.cpu_percent()
                    
                    print(f"⏱️ Tiempo transcurrido: {elapsed:.1f}s | Threads: {threads} | CPU: {cpu_percent:.1f}% | Memoria: {memory_info.rss // 1024 // 1024}MB")
                    
                    # Listar hijos del proceso
                    try:
                        children = server_proc.children(recursive=True)
                        if children:
                            print(f"👶 Procesos hijos activos: {len(children)}")
                            for child in children[:3]:  # Mostrar solo los primeros 3
                                print(f"   - {child.name()} (PID: {child.pid})")
                    except psutil.NoSuchProcess:
                        pass
                    
                    last_status_time = current_time
                except psutil.NoSuchProcess:
                    break
            
            time.sleep(0.5)
            
            # Timeout después de 30 segundos
            if elapsed > 30:
                print("⚠️ TIMEOUT: El proceso no terminó en 30 segundos")
                try:
                    print("🔪 Forzando terminación con SIGKILL...")
                    server_proc.kill()
                except psutil.NoSuchProcess:
                    pass
                break
        
        end_time = time.time()
        total_time = end_time - start_time
        
        if server_proc.is_running():
            print(f"❌ El servidor aún está ejecutándose después de {total_time:.1f}s")
        else:
            print(f"✅ Servidor terminado exitosamente en {total_time:.1f}s")
            
    except psutil.NoSuchProcess:
        print("❌ El proceso del servidor ya no existe")
    except Exception as e:
        print(f"❌ Error monitoreando el proceso: {e}")

def analyze_running_processes():
    """Analizar procesos relacionados con el proyecto"""
    print("\n🔍 Analizando procesos relacionados con el proyecto...")
    
    related_processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info['cmdline']
            if cmdline:
                cmdline_str = ' '.join(cmdline)
                if any(keyword in cmdline_str.lower() for keyword in ['dashcam', 'main.py', 'uvicorn', 'fastapi']):
                    related_processes.append({
                        'pid': proc.info['pid'],
                        'name': proc.info['name'],
                        'cmdline': cmdline_str[:100] + '...' if len(cmdline_str) > 100 else cmdline_str
                    })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if related_processes:
        print(f"📋 Encontrados {len(related_processes)} procesos relacionados:")
        for proc in related_processes:
            print(f"   - PID {proc['pid']}: {proc['name']} | {proc['cmdline']}")
    else:
        print("📋 No se encontraron procesos relacionados")

if __name__ == "__main__":
    print("🚀 Script de diagnóstico de cierre del servidor")
    print("=" * 60)
    
    analyze_running_processes()
    
    print("\nPresiona Enter para iniciar el monitoreo de cierre...")
    input()
    
    monitor_server_shutdown()
    
    print("\n🏁 Diagnóstico completado")
