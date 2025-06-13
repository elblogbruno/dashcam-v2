"""
Endpoints para el sistema de apagado mejorado
"""
from fastapi import APIRouter, HTTPException
import logging
import threading
import time

router = APIRouter()
logger = logging.getLogger(__name__)

# Variable global para acceder al shutdown monitor desde main.py
shutdown_monitor_instance = None

def set_shutdown_monitor(monitor):
    """Configurar la instancia del shutdown monitor para los endpoints"""
    global shutdown_monitor_instance
    shutdown_monitor_instance = monitor

@router.post("/system/shutdown/test-button-press")
async def test_button_press():
    """Simular presión del botón de apagado para pruebas"""
    if not shutdown_monitor_instance:
        raise HTTPException(status_code=500, detail="Shutdown monitor no disponible")
    
    try:
        logger.info("🧪 Endpoint: Simulando presión de botón de apagado")
        shutdown_monitor_instance.enhanced_shutdown.on_button_press()
        return {"status": "success", "message": "Presión de botón simulada"}
    except Exception as e:
        logger.error(f"Error simulando presión de botón: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/shutdown/test-button-release")
async def test_button_release():
    """Simular liberación del botón de apagado para pruebas"""
    if not shutdown_monitor_instance:
        raise HTTPException(status_code=500, detail="Shutdown monitor no disponible")
    
    try:
        logger.info("🧪 Endpoint: Simulando liberación de botón de apagado")
        shutdown_monitor_instance.enhanced_shutdown.on_button_release()
        return {"status": "success", "message": "Liberación de botón simulada"}
    except Exception as e:
        logger.error(f"Error simulando liberación de botón: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/shutdown/test-full-sequence")
async def test_full_shutdown_sequence():
    """Simular secuencia completa de apagado (presión sostenida)"""
    if not shutdown_monitor_instance:
        raise HTTPException(status_code=500, detail="Shutdown monitor no disponible")
    
    try:
        logger.info("🧪 Endpoint: Simulando secuencia completa de apagado")
        
        def simulate_long_press():
            # Simular presión del botón
            shutdown_monitor_instance.enhanced_shutdown.on_button_press()
            
            # Esperar más tiempo que el threshold para activar la secuencia
            time.sleep(shutdown_monitor_instance.enhanced_shutdown.button_hold_threshold + 0.5)
            
            # Si la secuencia no se ha cancelado, debería proceder al apagado
            # (En un entorno de prueba, esto podría no ejecutar el apagado real)
        
        # Ejecutar en hilo separado para no bloquear la respuesta
        test_thread = threading.Thread(target=simulate_long_press, name="ShutdownTest")
        test_thread.daemon = True
        test_thread.start()
        
        return {
            "status": "success", 
            "message": f"Secuencia de apagado iniciada. El botón será 'mantenido' por {shutdown_monitor_instance.enhanced_shutdown.button_hold_threshold + 0.5}s"
        }
    except Exception as e:
        logger.error(f"Error simulando secuencia de apagado: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/shutdown/force")
async def force_shutdown():
    """Forzar apagado inmediato del sistema"""
    if not shutdown_monitor_instance:
        raise HTTPException(status_code=500, detail="Shutdown monitor no disponible")
    
    try:
        logger.warning("🧪 Endpoint: Forzando apagado inmediato")
        
        def force_shutdown_thread():
            shutdown_monitor_instance.enhanced_shutdown.force_shutdown()
        
        # Ejecutar en hilo separado
        force_thread = threading.Thread(target=force_shutdown_thread, name="ForceShutdown")
        force_thread.daemon = True
        force_thread.start()
        
        return {"status": "success", "message": "Apagado forzado iniciado"}
    except Exception as e:
        logger.error(f"Error forzando apagado: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/shutdown/status")
async def get_shutdown_status():
    """Obtener estado del sistema de apagado"""
    if not shutdown_monitor_instance:
        raise HTTPException(status_code=500, detail="Shutdown monitor no disponible")
    
    try:
        enhanced = shutdown_monitor_instance.enhanced_shutdown
        return {
            "status": "success",
            "data": {
                "monitoring": shutdown_monitor_instance.running,
                "mock_mode": shutdown_monitor_instance.mock_mode,
                "gpio_lib": getattr(shutdown_monitor_instance, 'gpio_lib', 'unknown'),
                "shutdown_in_progress": enhanced.shutdown_in_progress,
                "button_pressed": getattr(shutdown_monitor_instance, 'button_pressed', False),
                "button_hold_threshold": enhanced.button_hold_threshold,
                "button_press_start": enhanced.button_press_start is not None
            }
        }
    except Exception as e:
        logger.error(f"Error obteniendo estado de apagado: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/shutdown/config")
async def get_shutdown_config():
    """Obtener configuración del sistema de apagado"""
    if not shutdown_monitor_instance:
        raise HTTPException(status_code=500, detail="Shutdown monitor no disponible")
    
    try:
        enhanced = shutdown_monitor_instance.enhanced_shutdown
        return {
            "status": "success",
            "config": {
                "button_hold_threshold": enhanced.button_hold_threshold,
                "gpio_pin": shutdown_monitor_instance.gpio_pin,
                "has_audio_notifier": enhanced.audio_notifier is not None,
                "has_led_controller": enhanced.led_controller is not None,
                "has_shutdown_controller": enhanced.shutdown_controller is not None,
                "has_trip_manager": enhanced.trip_manager is not None
            }
        }
    except Exception as e:
        logger.error(f"Error obteniendo configuración: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/shutdown/config")
async def update_shutdown_config(config_data: dict):
    """Actualizar configuración del sistema de apagado"""
    if not shutdown_monitor_instance:
        raise HTTPException(status_code=500, detail="Shutdown monitor no disponible")
    
    try:
        enhanced = shutdown_monitor_instance.enhanced_shutdown
        
        if "button_hold_threshold" in config_data:
            threshold = float(config_data["button_hold_threshold"])
            if 1.0 <= threshold <= 10.0:  # Validar rango razonable
                enhanced.button_hold_threshold = threshold
                logger.info(f"Button hold threshold actualizado a {threshold}s")
            else:
                raise HTTPException(status_code=400, detail="Threshold debe estar entre 1.0 y 10.0 segundos")
        
        return {
            "status": "success",
            "message": "Configuración actualizada",
            "new_config": {
                "button_hold_threshold": enhanced.button_hold_threshold
            }
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Threshold debe ser un número válido")
    except Exception as e:
        logger.error(f"Error actualizando configuración: {e}")
        raise HTTPException(status_code=500, detail=str(e))
