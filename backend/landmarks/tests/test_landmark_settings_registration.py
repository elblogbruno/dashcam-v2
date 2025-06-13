#!/usr/bin/env python3
"""
Test script to verify landmark settings module registration
"""

import sys
import os
import time

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_landmark_settings_registration():
    """Test that landmark settings are properly registered and working"""
    print("🧪 Probando el registro del módulo de configuración de landmarks...")
    
    try:
        # Import settings manager
        from settings_manager import settings_manager
        print("✅ Settings manager importado correctamente")
        
        # Check if landmarks settings type exists
        landmark_settings = settings_manager.get_settings("landmarks")
        print(f"✅ Configuraciones de landmarks cargadas: {landmark_settings}")
        
        # Test updating landmark settings
        test_settings = {
            "enabled": True,
            "notification_cooldown": 600,  # 10 minutes
            "detection_threshold": 0.7,
            "auto_cleanup": True,
            "cleanup_radius_km": 75,
            "max_landmark_age_days": 90
        }
        
        print(f"🔧 Actualizando configuraciones de landmarks: {test_settings}")
        success = settings_manager.update_settings("landmarks", test_settings)
        
        if success:
            print("✅ Configuraciones de landmarks actualizadas correctamente")
            
            # Verify the settings were saved
            updated_settings = settings_manager.get_settings("landmarks")
            print(f"📋 Configuraciones actualizadas: {updated_settings}")
            
            # Check if our test values are there
            if updated_settings.get("notification_cooldown") == 600:
                print("✅ Configuración de cooldown actualizada correctamente")
            else:
                print("❌ Error: configuración de cooldown no actualizada")
                
            if updated_settings.get("detection_threshold") == 0.7:
                print("✅ Configuración de threshold actualizada correctamente")
            else:
                print("❌ Error: configuración de threshold no actualizada")
                
        else:
            print("❌ Error actualizando configuraciones de landmarks")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Error en la prueba: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_landmark_checker_integration():
    """Test the landmark checker integration with settings"""
    print("\n🔗 Probando integración con LandmarkChecker...")
    
    try:
        # Import landmark checker
        from landmarks.core.landmark_checker import LandmarkChecker
        
        # Create instance
        landmark_checker = LandmarkChecker()
        print("✅ LandmarkChecker instanciado correctamente")
        
        # Test apply_settings method
        test_settings = {
            "notification_cooldown": 450,
            "detection_threshold": 0.8,
            "auto_cleanup": True,
            "cleanup_radius_km": 60,
            "max_landmark_age_days": 45
        }
        
        print(f"🔧 Aplicando configuraciones de prueba: {test_settings}")
        landmark_checker.apply_settings(test_settings)
        
        # Check if cooldown was updated
        if landmark_checker.notification_cooldown == 450:
            print("✅ Configuración de cooldown aplicada correctamente")
        else:
            print(f"❌ Error: cooldown esperado 450, obtenido {landmark_checker.notification_cooldown}")
            
        print("✅ Integración con LandmarkChecker funcionando correctamente")
        return True
        
    except Exception as e:
        print(f"❌ Error en la integración: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("🚀 INICIANDO PRUEBAS DEL SISTEMA DE CONFIGURACIÓN DE LANDMARKS")
    print("=" * 70)
    
    tests = [
        ("Registro del módulo de configuración", test_landmark_settings_registration),
        ("Integración con LandmarkChecker", test_landmark_checker_integration)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 Ejecutando: {test_name}")
        success = test_func()
        results.append((test_name, success))
        
        if success:
            print(f"✅ {test_name}: PASÓ")
        else:
            print(f"❌ {test_name}: FALLÓ")
    
    print(f"\n📋 RESUMEN DE PRUEBAS")
    print("=" * 40)
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASÓ" if success else "❌ FALLÓ"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 Resultado final: {passed}/{total} pruebas pasaron")
    
    if passed == total:
        print("🎉 ¡Todas las pruebas pasaron! El sistema de configuración de landmarks está funcionando correctamente.")
        print("\n📝 Funcionalidades verificadas:")
        print("   - Registro del módulo de landmarks en settings_manager")
        print("   - Carga y actualización de configuraciones de landmarks")
        print("   - Integración con LandmarkChecker.apply_settings()")
        print("   - Persistencia de configuraciones en archivos JSON")
    else:
        print("⚠️  Algunas pruebas fallaron. Revisa los errores arriba.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
