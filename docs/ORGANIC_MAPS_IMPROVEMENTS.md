# Mejoras en la gestión de mapas de Organic Maps

Este documento describe las mejoras implementadas para resolver los problemas con la descarga de mapas de Organic Maps en la aplicación de dashcam.

## Problemas resueltos

1. **URLs de descarga actualizadas**: Implementado un sistema que utiliza múltiples espejos alternativos cuando el dominio oficial (download.organicmaps.app) no está disponible.

2. **Detección dinámica de archivos disponibles**: Nueva función que obtiene la lista real de archivos .mwm disponibles desde el servidor utilizando expresiones regulares para analizar el directorio del espejo.

3. **Búsqueda mejorada de regiones**: Algoritmo completamente rediseñado para encontrar regiones de mapas relevantes para rutas largas, especialmente las que atraviesan múltiples estados en EE.UU.

4. **Sistema de caché**: Implementado un sistema de caché para almacenar los resultados de búsqueda de mapas más frecuentes, mejorando el rendimiento y reduciendo la carga en el servidor.

5. **Gestión de descargas robusta**: Sistema mejorado de descarga que intenta múltiples espejos, varias versiones de mapas, y proporciona información detallada sobre el progreso y la velocidad.

## Nuevos endpoints

1. `/check-mirrors`: Verifica la disponibilidad de los espejos configurados
2. `/available-versions`: Obtiene la lista de versiones de mapas disponibles en el servidor
3. `/map-files/{version}`: Obtiene la lista de archivos de mapas para una versión específica
4. `/retry-download/{region_id}`: Permite reintentar una descarga fallida
5. `/test-region-search`: Endpoint de prueba para verificar la búsqueda de regiones con coordenadas específicas
6. `/clear-region-cache`: Limpia la caché de búsqueda de regiones

## Archivos modificados

- **organic_maps.py**: Implementación principal de todas las mejoras
- **region_cache.py**: Nuevo módulo para manejar el caché de resultados de búsqueda

## Pruebas y validación

Para probar el funcionamiento correcto de estas mejoras se recomienda:

1. Comprobar la disponibilidad de los espejos:
   - Acceder a `/check-mirrors` para verificar qué espejos están funcionando

2. Obtener la lista de mapas disponibles:
   - Acceder a `/available-versions` para ver las versiones de mapas
   - Usar `/map-files/250511` para ver los archivos de la última versión

3. Probar la búsqueda de regiones para diferentes rutas:
   - Usar `/test-region-search` con las coordenadas de prueba

4. Probar la descarga de un mapa:
   - Crear una ruta con coordenadas conocidas
   - Usar `/regions-for-trip` para identificar las regiones necesarias
   - Descargar una región con `/download-region/{region_id}`

## Notas adicionales

- La caché de regiones expira después de 24 horas para asegurar que siempre se tenga información actualizada
- Si una descarga falla, se puede reintentar con `/retry-download/{region_id}`
- El sistema probará múltiples espejos y versiones de mapas si la fuente principal no está disponible
