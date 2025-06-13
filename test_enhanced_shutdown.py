#!/usr/bin/env python3
"""
Script de prueba para el sistema de apagado mejorado
"""
import os
import sys
import time

# Añadir el directorio backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_enhanced_shutdown():
    """Probar el sistema de apagado mejorado en modo mock"""
    print("🧪 Iniciando prueba del sistema de apagado mejorado")
    print()
    
    # Test 1: Simular presión corta (cancelación)
    print("📝 Test 1: Presión corta del botón (debe cancelarse)")
    print("   Ejecuta: touch /tmp/trigger_shutdown")
    print("   Espera 1 segundo...")
    print("   Ejecuta: touch /tmp/release_shutdown")
    print()
    
    # Test 2: Simular presión larga (apagado completo)
    print("📝 Test 2: Presión larga del botón (secuencia completa)")
    print("   Ejecuta: touch /tmp/trigger_shutdown")
    print("   Espera 4 segundos (sin liberar)...")
    print("   El sistema debería iniciar la secuencia de apagado")
    print()
    
    # Test 3: Apagado forzado
    print("📝 Test 3: Apagado forzado")
    print("   Ejecuta: touch /tmp/trigger_immediate_shutdown")
    print("   El sistema debería apagar inmediatamente")
    print()
    
    print("🔧 Para probar usando API endpoints:")
    print("   curl -X POST http://localhost:8000/api/system/shutdown/test-button-press")
    print("   curl -X POST http://localhost:8000/api/system/shutdown/test-button-release")
    print("   curl -X POST http://localhost:8000/api/system/shutdown/test-full-sequence")
    print("   curl -X GET http://localhost:8000/api/system/shutdown/status")
    print()
    
    print("📊 Para ver el estado:")
    print("   curl -X GET http://localhost:8000/api/system/shutdown/status")
    print("   curl -X GET http://localhost:8000/api/system/shutdown/config")
    print()
    
    print("⚙️  Para cambiar configuración:")
    print("   curl -X POST http://localhost:8000/api/system/shutdown/config \\")
    print("        -H 'Content-Type: application/json' \\")
    print("        -d '{\"button_hold_threshold\": 5.0}'")
    print()

def create_mock_files():
    """Crear archivos mock para pruebas manuales"""
    print("🔧 Creando archivos de prueba...")
    
    # Script para presión corta
    with open('/tmp/test_short_press.sh', 'w') as f:
        f.write("""#!/bin/bash
echo "🔴 Simulando presión corta del botón..."
touch /tmp/trigger_shutdown
echo "   Botón presionado"
sleep 1
touch /tmp/release_shutdown  
echo "   Botón liberado (después de 1s)"
echo "✅ Presión corta completada"
""")
    
    # Script para presión larga
    with open('/tmp/test_long_press.sh', 'w') as f:
        f.write("""#!/bin/bash
echo "🔴 Simulando presión larga del botón..."
touch /tmp/trigger_shutdown
echo "   Botón presionado"
echo "   Esperando 4 segundos..."
sleep 4
echo "🛑 Secuencia de apagado debería haber iniciado"
""")
    
    # Script para apagado forzado
    with open('/tmp/test_force_shutdown.sh', 'w') as f:
        f.write("""#!/bin/bash
echo "⚡ Simulando apagado forzado..."
touch /tmp/trigger_immediate_shutdown
echo "🛑 Apagado forzado activado"
""")
    
    # Hacer ejecutables
    os.chmod('/tmp/test_short_press.sh', 0o755)
    os.chmod('/tmp/test_long_press.sh', 0o755)
    os.chmod('/tmp/test_force_shutdown.sh', 0o755)
    
    print("✅ Scripts de prueba creados:")
    print("   /tmp/test_short_press.sh   - Presión corta")
    print("   /tmp/test_long_press.sh    - Presión larga")
    print("   /tmp/test_force_shutdown.sh - Apagado forzado")
    print()

if __name__ == "__main__":
    print("🚀 Sistema de Apagado Mejorado - Guía de Pruebas")
    print("=" * 50)
    print()
    
    test_enhanced_shutdown()
    create_mock_files()
    
    print("📖 Para más información, consulta:")
    print("   docs/ENHANCED_SHUTDOWN_SYSTEM.md")
    print()
    print("🏃 Para iniciar el servidor:")
    print("   ./dev.sh")
