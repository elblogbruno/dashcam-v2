# Mejora del Sistema de Apagado - Detener Viaje Actual

## Resumen

Se ha implementado una mejora en el sistema de apagado para asegurar que cualquier viaje activo se detenga correctamente antes de que el sistema se apague. Esto garantiza que no se pierdan datos de grabación y que todos los archivos se cierren apropiadamente.

## Cambios Realizados

### 1. Modificación del `ShutdownMonitor`

**Archivo:** `backend/shutdown_monitor.py`

- **Constructor actualizado:** Ahora acepta una referencia opcional al `trip_manager`
- **Nuevo método `_stop_current_trip()`:** Se encarga de detener el viaje activo antes del apagado
- **Método `_perform_shutdown()` mejorado:** Ahora llama a `_stop_current_trip()` antes de ejecutar el apagado del sistema

#### Funcionalidad del método `_stop_current_trip()`:
- Verifica si hay un trip manager disponible
- Busca viajes activos
- Si encuentra un viaje activo, lo finaliza correctamente
- Registra todas las acciones en los logs
- Maneja errores de forma graceful para no interrumpir el proceso de apagado

### 2. Actualización del `TripManager`

**Archivo:** `backend/trip_logger_package/services/trip_manager.py`

- **Nuevo método `cleanup()`:** Implementa la limpieza ordenada del TripManager
- **Compatibilidad con el sistema de cleanup existente:** Se integra con el proceso de shutdown de la aplicación principal

#### Funcionalidad del método `cleanup()`:
- Finaliza cualquier viaje activo
- Limpia recursos de la base de datos
- Registra todas las operaciones de limpieza
- Maneja errores de forma robusta

### 3. Integración en `main.py`

**Archivo:** `backend/main.py`

- **Inicialización actualizada:** El `ShutdownMonitor` ahora recibe una referencia al `trip_logger`
- **Compatibilidad mantenida:** Los procesos de cleanup existentes siguen funcionando

## Flujo de Apagado Mejorado

1. **Detección de pérdida de energía** (GPIO o trigger manual en modo mock)
2. **Inicio del proceso de apagado seguro**
3. **✅ NUEVO: Detener viaje actual**
   - Buscar viajes activos
   - Finalizar grabación
   - Guardar metadatos del viaje
   - Cerrar archivos de vídeo
4. **Apagado del sistema operativo**

## Beneficios

1. **Integridad de datos:** Los viajes se finalizan correctamente sin pérdida de datos
2. **Archivos de vídeo seguros:** Se cierran apropiadamente sin corrupción
3. **Metadatos completos:** Se guardan correctamente los datos del viaje
4. **Logs completos:** Toda la actividad queda registrada para debugging
5. **Robustez:** El sistema continúa con el apagado incluso si hay errores al detener el viaje

## Compatibilidad

- ✅ **Modo mock:** Funciona correctamente para testing y desarrollo
- ✅ **Modo GPIO real:** Compatible con Raspberry Pi y detección de pérdida de energía
- ✅ **Sin viajes activos:** Maneja gracefully el caso donde no hay viajes activos
- ✅ **Errores de TripManager:** El apagado continúa incluso si hay problemas con el trip manager

## Testing

Se ha creado un script de pruebas completo (`test_shutdown_trip_stop.py`) que verifica:

1. **Detener viaje activo:** Verifica que los viajes activos se detienen correctamente
2. **Sin viajes activos:** Confirma que no hay errores cuando no hay viajes activos
3. **Simulación completa:** Prueba todo el proceso de apagado mock

## Uso

### En Producción
El sistema funciona automáticamente. No se requiere configuración adicional.

### Para Testing
```bash
# Simular pérdida de energía en modo mock
touch /tmp/trigger_shutdown

# Ejecutar tests
python3 test_shutdown_trip_stop.py
```

## Logs de Ejemplo

```
2025-06-13 19:14:28 - shutdown_monitor - INFO - Performing safe shutdown...
2025-06-13 19:14:28 - shutdown_monitor - INFO - Stopping current trip before shutdown...
2025-06-13 19:14:28 - shutdown_monitor - INFO - Found active trip (ID: 1) - ending it
2025-06-13 19:14:28 - trip_logger_package.trip_manager - INFO - Ended trip 1
2025-06-13 19:14:28 - shutdown_monitor - INFO - Successfully ended trip 1
```

## Consideraciones Futuras

1. **Timeout de finalización:** Podría agregarse un timeout para la finalización del viaje
2. **Notificaciones de emergencia:** Podría enviarse una notificación cuando se detecta apagado de emergencia
3. **Backup de emergencia:** Posible implementación de backup rápido de datos críticos
