#!/usr/bin/env python3
"""
Script de prueba para verificar que el manejo de señales funciona correctamente
"""
import subprocess
import time
import signal
import os
import sys

def test_dev_script_shutdown():
    """Test que el script dev.sh maneja correctamente Ctrl+C"""
    print("Iniciando test de shutdown para dev.sh...")
    
    # Iniciar el script en background
    process = subprocess.Popen(['./dev.sh'], 
                             stdout=subprocess.PIPE, 
                             stderr=subprocess.STDOUT,
                             text=True,
                             preexec_fn=os.setsid)  # Crear nuevo grupo de procesos
    
    try:
        # Esperar un poco para que inicie
        print("Esperando que el script inicie...")
        time.sleep(10)
        
        # Verificar que está ejecutándose
        if process.poll() is not None:
            print(f"ERROR: El proceso terminó prematuramente con código {process.returncode}")
            stdout, _ = process.communicate()
            print("Output:")
            print(stdout)
            return False
        
        print("Script iniciado correctamente. Enviando SIGINT (Ctrl+C)...")
        
        # Enviar SIGINT (equivalente a Ctrl+C) al grupo de procesos
        os.killpg(os.getpgid(process.pid), signal.SIGINT)
        
        # Esperar que termine (timeout de 15 segundos)
        try:
            stdout, _ = process.communicate(timeout=15)
            print(f"Script terminó con código: {process.returncode}")
            print("Output:")
            print(stdout)
            
            # Verificar que terminó limpiamente
            if process.returncode == 0:
                print("✓ SUCCESS: El script manejó correctamente Ctrl+C y terminó limpiamente")
                return True
            else:
                print(f"WARNING: El script terminó con código no-cero: {process.returncode}")
                return False
                
        except subprocess.TimeoutExpired:
            print("ERROR: El script no terminó dentro del tiempo esperado")
            # Forzar terminación
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            return False
            
    except Exception as e:
        print(f"ERROR durante el test: {e}")
        # Cleanup
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except:
            pass
        return False

if __name__ == '__main__':
    os.chdir('/root/dashcam-v2')
    success = test_dev_script_shutdown()
    sys.exit(0 if success else 1)
