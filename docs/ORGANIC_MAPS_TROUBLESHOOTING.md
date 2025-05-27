# Solución de problemas con descarga de mapas Organic Maps

Este documento proporciona instrucciones para diagnosticar y solucionar problemas con la descarga de mapas de Organic Maps en la aplicación dashcam.

## Problemas detectados

- Los servidores de Organic Maps a veces no responden o tienen problemas de conectividad
- El dominio oficial (download.organicmaps.app) parece no estar funcionando en este momento
- La detección de regiones de mapas para rutas largas no estaba funcionando correctamente
- No se estaba manejando adecuadamente el fallo de servidores

## Soluciones implementadas

1. Sistema mejorado con múltiples espejos para descargar mapas
2. Detección dinámica de servidores disponibles
3. Manejo de errores y reintentos automáticos
4. Algoritmo mejorado para encontrar regiones de mapas para rutas largas
5. Sistema de caché para búsquedas frecuentes

## Cómo utilizar las mejoras

### 1. Asegúrate de tener todas las dependencias instaladas

```bash
cd /root/dashcam-v2
sudo backend/tools/install_organic_maps_deps.sh
```

### 2. Ejecutar diagnóstico para verificar conectividad a servidores

```bash
cd /root/dashcam-v2
python3 backend/tools/diagnose_organic_maps.py
```

Este script verificará todos los espejos configurados y te mostrará cuál está funcionando mejor.

### 3. Modificar la configuración si es necesario

Si el diagnóstico indica que deberías usar un espejo diferente, puedes modificar el archivo `backend/routes/organic_maps.py` para cambiar la lista de URLs:

```python
ORGANIC_MAPS_URLS = [
    "https://omaps.wfr.software/maps",  # URL que funciona mejor según diagnóstico
    "https://omaps.webfreak.org/maps",
    "https://download.organicmaps.app/MapsWithMe"
]
```

Coloca la URL más confiable primero en la lista.

## Verificar que las rutas funcionan correctamente

Para probar la funcionalidad de búsqueda de regiones puedes usar el endpoint `test-region-search` con coordenadas específicas:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"min_lat": 33.4484, "max_lat": 41.8756, "min_lon": -122.4193, "max_lon": -87.6244}' http://localhost:8000/api/organic-maps/test-region-search
```

Esto simula una ruta larga a través de múltiples estados de Estados Unidos y debería devolver varias regiones relevantes.

## Limpieza de caché si es necesario

Si necesitas resetear la caché de búsqueda de regiones:

```bash
curl http://localhost:8000/api/organic-maps/clear-region-cache
```

## Solución de problemas comunes

### No se encuentran regiones para una ruta

1. Verifica la conectividad con los servidores usando el script de diagnóstico
2. Comprueba que las coordenadas de la ruta son correctas
3. Prueba limpiar la caché de regiones
4. Revisa los logs para ver si hay errores específicos

### Las descargas fallan

1. Verifica que los directorios de datos tengan los permisos correctos
2. Ejecuta el script de instalación de dependencias para asegurar que todas están instaladas
3. Prueba reintentar la descarga con el endpoint `/retry-download/{region_id}`
4. Verifica la conectividad a Internet

### Los mapas no se muestran correctamente

1. Verifica que las dependencias de procesamiento de imágenes estén instaladas
2. Comprueba los logs para errores específicos de renderizado
3. Intenta limpiar la caché y volver a descargar los mapas necesarios

## Archivos relevantes

- `backend/routes/organic_maps.py` - Implementación principal
- `backend/routes/region_cache.py` - Sistema de caché de búsquedas
- `backend/tools/diagnose_organic_maps.py` - Script de diagnóstico
- `backend/tools/install_organic_maps_deps.sh` - Instalador de dependencias

## Notas adicionales

- Los mapas de Organic Maps se actualizan periódicamente. La versión más reciente es la 250511
- Si ningún espejo funciona, se utilizará una lista estática de regiones predefinidas
- Para rutas que atraviesan múltiples estados de EE.UU., el sistema divide la ruta en secciones para encontrar las regiones adecuadas
