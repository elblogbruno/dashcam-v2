# Solución de Problemas con Mapas Offline

Este documento proporciona soluciones para problemas comunes relacionados con la descarga y visualización de mapas offline en la aplicación DashCam.

## Problemas de Descarga

### 1. La descarga no se inicia

**Posibles causas:**
- Ya existe una descarga en curso para el mismo viaje
- Error de conexión a internet
- Área demasiado grande para descargar

**Soluciones:**
- Verifica el estado de descargas actuales en la interfaz de depuración
- Comprueba tu conexión a internet
- Reduce el área seleccionada o el rango de niveles de zoom
- Revisa los logs del backend para errores específicos

### 2. Descarga incompleta o con errores

**Posibles causas:**
- Interrupción de la conexión durante la descarga
- Límites de tasa del servidor de tiles
- Espacio insuficiente en el dispositivo

**Soluciones:**
- Reinicia la descarga después de un tiempo
- Reduce el número de tiles descargando áreas más pequeñas
- Libera espacio en el dispositivo
- Revisa los logs para tiles específicos que están fallando

## Problemas con el Indicador de Nivel de Zoom

### 1. El indicador de zoom no aparece

**Posibles causas:**
- Conflicto con otros componentes de Leaflet
- Error en la inicialización del contexto del mapa
- CSS no cargado correctamente

**Soluciones:**
- Verifica que el componente esté correctamente importado en `RealTimeMap.jsx`
- Asegúrate de que el archivo `ZoomLevelIndicator.css` se esté cargando
- Comprueba la consola del navegador para errores relacionados
- Verifica que el indicador no esté oculto por otro elemento (z-index)

### 2. El indicador no responde a clics o no muestra información expandida

**Posibles causas:**
- Propagación de eventos bloqueada por otros componentes
- Error en el manejo del estado `expanded`
- CSS de animación no compatible con el navegador

**Soluciones:**
- Verifica que la función `toggleExpanded()` esté siendo llamada al hacer clic
- Comprueba si hay errores en la consola del navegador
- Intenta aumentar el z-index del componente en caso de superposición
- Asegúrate de que los estilos CSS se aplican correctamente

### 3. El cambio de nivel de zoom mediante los botones no funciona

**Posibles causas:**
- Error en la referencia al objeto mapa
- Propagación de eventos detenida
- Límites de zoom del mapa configurados restrictivamente

**Soluciones:**
- Verifica que `map.setZoom(level)` se esté llamando correctamente
- Asegúrate de que el evento de clic usa `e.stopPropagation()`
- Comprueba los límites de zoom configurados en el MapContainer
- Revisa la consola del navegador para posibles errores

## Problemas de Visualización de Tiles

### 1. Tiles no se muestran correctamente

**Posibles causas:**
- Archivos de tiles corruptos
- Base de datos de tiles dañada
- Incompatibilidad en el formato de tiles

**Soluciones:**
- Usa el depurador de tiles para verificar tiles específicos
- Elimina y vuelve a descargar los mapas para el viaje
- Verifica que los tiles descargados son accesibles desde la API

### 2. Rendimiento lento al usar mapas offline

**Posibles causas:**
- Demasiados tiles en la base de datos
- Dispositivo con recursos limitados
- Problemas de caché del navegador

**Soluciones:**
- Elimina mapas antiguos que no necesites
- Reduce la cantidad de tiles descargados por área
- Limpia la caché del navegador

## Problemas en Áreas Urbanas

**Problema:** En áreas urbanas grandes, el mapa muestra poco detalle o faltan elementos importantes.

**Causa:** Las áreas urbanas requieren más niveles de zoom y tiles debido a su mayor densidad de información.

**Soluciones:**
- Utiliza la nueva interfaz de selección de niveles de zoom para elegir específicamente niveles altos (14-16)
- Usa el botón de "Selección Optimizada" cuando estés visualizando un área urbana
- Para ciudades muy grandes, divide el área en secciones más pequeñas y descarga cada una por separado
- Asegúrate de incluir al menos un nivel bajo (8-10) para tener visión general y un nivel alto (14-16) para detalles

## Errores Comunes

### Error: "Demasiados tiles solicitados"

Este error ocurre cuando se intenta descargar un área extremadamente grande que excede el límite de aproximadamente 30GB (6 millones de tiles).

**Soluciones:**
- Reduce el tamaño del área seleccionada
- Disminuye la cantidad de niveles de zoom seleccionados
- Divide la descarga en múltiples operaciones para áreas más pequeñas
- Considera que las descargas muy grandes pueden tardar muchas horas y consumir mucho espacio de almacenamiento

### Error: "Rate limited (429)"

El servidor de mapas está limitando las solicitudes debido a un exceso de peticiones.

**Soluciones:**
- Espera unos minutos y vuelve a intentar
- Reduce la velocidad de descarga (esta opción se implementará en futuras versiones)
- Intenta en otro momento cuando el servidor pueda tener menos carga

## Herramientas de Diagnóstico

### Depurador de Tiles Offline

El componente `OfflineTileDebugger` proporciona varias herramientas para diagnosticar problemas:

1. **Ver nivel de zoom actual**: Muestra el nivel de zoom en el que te encuentras
2. **Seleccionar niveles de zoom**: Permite elegir qué niveles de zoom descargar
3. **Ver tiles visibles**: Muestra los tiles actualmente visibles en el mapa
4. **Probar tiles específicos**: Permite verificar si un tile está disponible offline
5. **Comprobar API directa**: Verifica la respuesta del backend para un tile específico
6. **Ver estado de descarga**: Muestra el progreso actual de las descargas

Para acceder a estas herramientas, asegúrate de estar en modo de desarrollo y el depurador aparecerá en la esquina inferior derecha del mapa.

### Optimización de Descargas

Puedes optimizar las descargas siguiendo estas recomendaciones:

1. **Para áreas grandes con poco detalle**: Selecciona solo niveles de zoom bajos (8-10)
2. **Para áreas urbanas con detalle**: Usa la selección optimizada o elige niveles 8, 12 y 14-16
3. **Para evitar problemas de velocidad**: Intenta descargar por partes, empezando con niveles bajos
4. **Para comprobar el tamaño**: Observa el contador de tiles en el estado de la descarga

## Contacto para Soporte

Si continúas experimentando problemas con los mapas offline después de intentar estas soluciones, por favor contacta al soporte técnico proporcionando:

- Capturas de pantalla del error
- Logs del sistema (si están disponibles)
- Pasos exactos para reproducir el problema
- Información sobre el dispositivo y navegador utilizados
