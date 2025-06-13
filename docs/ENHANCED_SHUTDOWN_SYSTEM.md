# Sistema de Apagado Mejorado - Guía de Uso

## Descripción General

El sistema de apagado mejorado proporciona una experiencia más intuitiva y segura para apagar el dashcam, incluyendo notificaciones de audio y efectos visuales con LEDs.

## Características Principales

### 1. Confirmación de Botón
- **Primer beep**: Al presionar el botón de apagado, se reproduce un beep de confirmación (800Hz, 0.1s)
- **Indicación**: Confirma que el sistema ha detectado la presión del botón

### 2. Secuencia de LEDs Progresiva
Durante el mantenimiento del botón presionado (3 segundos por defecto):
- **LED 1 (Rojo)**: Se enciende después de 1 segundo
- **LED 2 (Amarillo)**: Se enciende después de 2 segundos  
- **LED 3 (Verde)**: Se enciende después de 3 segundos

### 3. Anuncios de Voz
- **Inicio**: "Iniciando apagado del sistema dashcam. Guardando datos..."
- **Finalización**: "Sistema listo para apagar. Apagando en 3, 2, 1..."

### 4. Proceso de Apagado Seguro
1. Detiene el trip actual si está en curso
2. Guarda todos los datos pendientes
3. Realiza limpieza de recursos
4. Ejecuta el apagado del sistema

## Uso del Sistema

### Apagado Normal
1. **Presionar** el botón de apagado → Escucharás un beep de confirmación
2. **Mantener presionado** por 3 segundos → Los LEDs se encenderán progresivamente
3. **Completar secuencia** → El sistema iniciará el proceso de apagado con anuncios

### Cancelación
- **Liberar el botón** antes de completar los 3 segundos → Los LEDs se apagarán y se reproducirá un beep de cancelación

## Configuración

### Tiempo de Mantenimiento del Botón
- **Por defecto**: 3.0 segundos
- **Rango válido**: 1.0 - 10.0 segundos
- **Modificación**: A través del endpoint `/api/system/shutdown/config`

### Pin GPIO
- **Por defecto**: GPIO 17 (BCM)
- **Configuración**: Pull-up interno habilitado
- **Detección**: Falling edge (presión) y rising edge (liberación)

## Endpoints API para Pruebas

### Estado del Sistema
```bash
GET /api/system/shutdown/status
```
Devuelve información sobre el estado actual del sistema de apagado.

### Configuración
```bash
GET /api/system/shutdown/config
POST /api/system/shutdown/config
```
Ver o modificar la configuración del sistema.

### Pruebas de Funcionalidad
```bash
# Simular presión de botón
POST /api/system/shutdown/test-button-press

# Simular liberación de botón
POST /api/system/shutdown/test-button-release

# Simular secuencia completa
POST /api/system/shutdown/test-full-sequence

# Forzar apagado inmediato
POST /api/system/shutdown/force
```

## Pruebas en Modo Mock

Para probar sin hardware GPIO real:

### Simular Presión de Botón
```bash
touch /tmp/trigger_shutdown
```

### Simular Liberación de Botón
```bash
touch /tmp/release_shutdown
```

### Apagado Inmediato
```bash
touch /tmp/trigger_immediate_shutdown
```

## Componentes del Sistema

### EnhancedShutdownManager
- Gestiona la lógica de secuencia de apagado
- Coordina audio, LEDs y apagado del sistema
- Maneja los timeouts y cancelaciones

### ShutdownMonitor (Modificado)
- Detecta eventos del botón de hardware
- Integra el sistema mejorado
- Soporta modo mock para pruebas

### AudioNotifier (Mejorado)
- Función `beep()` para notificaciones sonoras rápidas
- Soporte para múltiples frecuencias y duraciones
- Anuncios de voz para el proceso de apagado

### LEDController (Mejorado)
- Función `shutdown_sequence()` para efectos visuales
- Control progresivo de LEDs individuales
- Colores personalizables para la secuencia

## Compatibilidad

### Librerías GPIO Soportadas
- **RPi.GPIO**: Soporte completo con detección de edge
- **gpiozero**: Soporte completo con callbacks
- **Modo Mock**: Para pruebas sin hardware

### Sistemas de Audio
- **Piper TTS**: Voz neural de alta calidad (español)
- **pyttsx3**: TTS multiplataforma
- **sox/aplay**: Generación de beeps en Linux
- **Fallback**: Bell del sistema

### Hardware LED
- **ReSpeaker 2-mic HAT**: 3 LEDs RGB via SPI
- **APA102**: Control directo de LEDs individuales

## Logs y Monitoreo

### Eventos Registrados
- Presiones y liberaciones del botón
- Progreso de la secuencia de LEDs
- Estados del proceso de apagado
- Errores y fallbacks

### Niveles de Log
- **INFO**: Eventos normales del sistema
- **WARNING**: Fallbacks y modo mock
- **ERROR**: Fallos de hardware o configuración

## Solución de Problemas

### LEDs No Funcionan
1. Verificar inicialización del hardware SPI
2. Revisar permisos GPIO
3. Comprobar conexiones del ReSpeaker HAT

### Audio No Funciona
1. Verificar instalación de Piper TTS
2. Comprobar configuración de audio del sistema
3. Revisar permisos de audio

### Botón No Responde
1. Verificar conexión del pin GPIO 17
2. Comprobar configuración pull-up
3. Usar modo mock para pruebas

### Apagado No Ejecuta
1. Verificar permisos sudo
2. Comprobar configuración del sistema
3. Revisar logs del ShutdownController

## Ejemplo de Uso Completo

```python
# En el código del sistema
enhanced_shutdown = EnhancedShutdownManager(
    audio_notifier=audio_notifier,
    led_controller=led_controller,
    shutdown_controller=shutdown_controller,
    trip_manager=trip_manager
)

# Configurar tiempo personalizado
enhanced_shutdown.button_hold_threshold = 4.0  # 4 segundos

# Iniciar monitoreo
enhanced_shutdown.start_monitoring()
```

## Futuras Mejoras

### Posibles Extensiones
1. **Configuración de colores LED personalizables**
2. **Múltiples patrones de secuencia**
3. **Integración con notificaciones push**
4. **Historial de apagados**
5. **Modo de apagado programado**

### Optimizaciones Pendientes
1. **Reducir latencia de detección**
2. **Mejorar eficiencia energética**
3. **Soporte para múltiples botones**
4. **Integración con watchdog del sistema**
