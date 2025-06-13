from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
import logging
import asyncio
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

# Referencias globales que se configurarán desde main.py
shutdown_monitor = None
audio_notifier = None
led_controller = None

def get_shutdown_monitor():
    """Dependency para obtener el shutdown monitor"""
    if shutdown_monitor is None:
        raise HTTPException(status_code=503, detail="Shutdown monitor no disponible")
    return shutdown_monitor

def get_audio_notifier():
    """Dependency para obtener el audio notifier"""
    return audio_notifier

def get_led_controller():
    """Dependency para obtener el LED controller"""
    return led_controller

@router.post("/shutdown/graceful")
async def graceful_shutdown(
    shutdown_mon = Depends(get_shutdown_monitor),
    audio = Depends(get_audio_notifier)
):
    """
    Iniciar un apagado ordenado del sistema con notificaciones
    """
    try:
        logger.info("🛑 Apagado ordenado solicitado desde interfaz web")
        
        # Verificar que tenemos el enhanced shutdown manager
        if not hasattr(shutdown_mon, 'enhanced_shutdown'):
            raise HTTPException(status_code=503, detail="Sistema de apagado mejorado no disponible")
        
        # Anunciar que se va a apagar
        if audio:
            audio.announce(
                "Apagado del sistema solicitado desde la interfaz web. Iniciando proceso de apagado.",
                title="Apagado Manual",
                notification_type="warning"
            )
        
        # Iniciar apagado en un hilo separado para no bloquear la respuesta
        def delayed_shutdown():
            time.sleep(2)  # Dar tiempo para que la respuesta llegue al cliente
            shutdown_mon.enhanced_shutdown._initiate_shutdown()
        
        shutdown_thread = threading.Thread(target=delayed_shutdown, daemon=True)
        shutdown_thread.start()
        
        return JSONResponse({
            "status": "success",
            "message": "Proceso de apagado iniciado. El sistema se apagará en unos momentos.",
            "action": "shutdown"
        })
        
    except Exception as e:
        logger.error(f"Error iniciando apagado ordenado: {e}")
        raise HTTPException(status_code=500, detail=f"Error iniciando apagado: {str(e)}")

@router.post("/shutdown/force")
async def force_shutdown(
    shutdown_mon = Depends(get_shutdown_monitor),
    audio = Depends(get_audio_notifier)
):
    """
    Forzar apagado inmediato del sistema
    """
    try:
        logger.warning("⚠️ Apagado forzado solicitado desde interfaz web")
        
        # Verificar que tenemos el enhanced shutdown manager
        if not hasattr(shutdown_mon, 'enhanced_shutdown'):
            raise HTTPException(status_code=503, detail="Sistema de apagado mejorado no disponible")
        
        # Anunciar apagado forzado
        if audio:
            audio.announce(
                "Apagado forzado del sistema. Apagando inmediatamente.",
                title="Apagado Forzado",
                notification_type="error"
            )
        
        # Iniciar apagado forzado en un hilo separado
        def delayed_force_shutdown():
            time.sleep(1)  # Mínimo tiempo para respuesta
            shutdown_mon.enhanced_shutdown.force_shutdown()
        
        shutdown_thread = threading.Thread(target=delayed_force_shutdown, daemon=True)
        shutdown_thread.start()
        
        return JSONResponse({
            "status": "success",
            "message": "Apagado forzado iniciado. El sistema se apagará inmediatamente.",
            "action": "force_shutdown"
        })
        
    except Exception as e:
        logger.error(f"Error iniciando apagado forzado: {e}")
        raise HTTPException(status_code=500, detail=f"Error iniciando apagado forzado: {str(e)}")

@router.post("/reboot")
async def reboot_system(
    audio = Depends(get_audio_notifier)
):
    """
    Reiniciar el sistema
    """
    try:
        logger.info("🔄 Reinicio del sistema solicitado desde interfaz web")
        
        # Anunciar reinicio
        if audio:
            audio.announce(
                "Reinicio del sistema solicitado. El sistema se reiniciará en unos momentos.",
                title="Reinicio del Sistema",
                notification_type="info"
            )
        
        # Iniciar reinicio en un hilo separado
        def delayed_reboot():
            import subprocess
            import platform
            
            time.sleep(2)  # Dar tiempo para la respuesta
            
            try:
                system = platform.system()
                logger.info(f"🔄 Ejecutando reinicio del sistema ({system})")
                
                if system == "Linux":
                    subprocess.call(["sudo", "reboot"])
                elif system == "Darwin":  # macOS
                    subprocess.call(["sudo", "reboot"])
                elif system == "Windows":
                    subprocess.call(["shutdown", "/r", "/t", "0"])
                else:
                    logger.error(f"Sistema no soportado para reinicio: {system}")
                    
            except Exception as e:
                logger.error(f"Error ejecutando reinicio del sistema: {e}")
        
        reboot_thread = threading.Thread(target=delayed_reboot, daemon=True)
        reboot_thread.start()
        
        return JSONResponse({
            "status": "success",
            "message": "Reinicio del sistema iniciado. El sistema se reiniciará en unos momentos.",
            "action": "reboot"
        })
        
    except Exception as e:
        logger.error(f"Error iniciando reinicio: {e}")
        raise HTTPException(status_code=500, detail=f"Error iniciando reinicio: {str(e)}")

@router.get("/shutdown/status")
async def get_shutdown_status(
    shutdown_mon = Depends(get_shutdown_monitor)
):
    """
    Obtener el estado del sistema de apagado
    """
    try:
        status = {
            "shutdown_monitor_active": shutdown_mon.running if shutdown_mon else False,
            "enhanced_shutdown_available": hasattr(shutdown_mon, 'enhanced_shutdown') if shutdown_mon else False,
            "gpio_mode": getattr(shutdown_mon, 'gpio_lib', 'unknown') if shutdown_mon else 'unknown',
            "mock_mode": getattr(shutdown_mon, 'mock_mode', True) if shutdown_mon else True
        }
        
        if shutdown_mon and hasattr(shutdown_mon, 'enhanced_shutdown'):
            enhanced = shutdown_mon.enhanced_shutdown
            status.update({
                "shutdown_in_progress": enhanced.shutdown_in_progress,
                "audio_available": enhanced.audio_notifier is not None,
                "led_controller_available": enhanced.led_controller is not None
            })
        
        return JSONResponse({
            "status": "success",
            "data": status
        })
        
    except Exception as e:
        logger.error(f"Error obteniendo estado de apagado: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo estado: {str(e)}")

@router.post("/test/shutdown-sequence")
async def test_shutdown_sequence(
    shutdown_mon = Depends(get_shutdown_monitor),
    audio = Depends(get_audio_notifier),
    led_ctrl = Depends(get_led_controller)
):
    """
    Probar la secuencia de apagado sin apagar realmente el sistema
    """
    try:
        logger.info("🧪 Probando secuencia de apagado (modo de prueba)")
        
        # Anunciar prueba
        if audio:
            audio.announce(
                "Probando secuencia de apagado. El sistema NO se apagará.",
                title="Prueba de Apagado",
                notification_type="info"
            )
        
        # Probar secuencia de LEDs si está disponible
        if led_ctrl:
            try:
                from routes.mic_leds import LEDController
                led_controller = LEDController.get_instance()
                if not led_controller.initialized:
                    led_controller.initialize()
                
                if led_controller.initialized:
                    # Ejecutar secuencia de LEDs en un hilo separado
                    def test_led_sequence():
                        led_controller.shutdown_sequence(delay=0.5)
                        time.sleep(2)
                        led_controller.set_color((0, 0, 0))  # Apagar al final
                    
                    led_thread = threading.Thread(target=test_led_sequence, daemon=True)
                    led_thread.start()
            except Exception as e:
                logger.warning(f"No se pudo probar secuencia de LEDs: {e}")
        
        # Probar beep
        if audio:
            def test_beeps():
                time.sleep(1)
                audio.beep(frequency=800, duration=0.2)
                time.sleep(0.5)
                audio.beep(frequency=600, duration=0.2)
                time.sleep(0.5)
                audio.beep(frequency=400, duration=0.3)
            
            beep_thread = threading.Thread(target=test_beeps, daemon=True)
            beep_thread.start()
        
        return JSONResponse({
            "status": "success",
            "message": "Secuencia de prueba iniciada. Revisa los LEDs y escucha los sonidos.",
            "action": "test"
        })
        
    except Exception as e:
        logger.error(f"Error en prueba de secuencia: {e}")
        raise HTTPException(status_code=500, detail=f"Error en prueba: {str(e)}")
