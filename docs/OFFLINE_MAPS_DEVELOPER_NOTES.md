# Notas para Desarrolladores: Mejoras en el Sistema de Mapas Offline

Este documento describe las mejoras técnicas realizadas en el sistema de mapas offline para desarrolladores que trabajen en mantener o extender esta funcionalidad.

## Cambios en la Interfaz de Usuario

### Componente ZoomLevelIndicator

Se ha creado el nuevo componente `ZoomLevelIndicator.jsx` con las siguientes características:

1. **Visualización dinámica del nivel de zoom**
   - Utiliza el hook `useMap()` de react-leaflet para acceder al mapa
   - Se actualiza automáticamente cuando el nivel de zoom cambia
   - Muestra el nivel de zoom con precisión decimal

2. **Interfaz expandible**
   - Estado `expanded` controlado por la función `toggleExpanded()`
   - Cuando se expande, muestra información adicional y opciones de cambio de zoom
   - Animación suave al expandirse y contraerse

3. **Categorización de niveles de zoom**
   - Muestra descripción del nivel de zoom actual (Detalle máximo, Calles detalladas, etc.)
   - Categoriza el zoom en: Urbano detallado, Urbano general, Suburbano, Rural, Regional

4. **Navegación rápida entre niveles**
   - Botones para cambiar directamente a niveles predefinidos (6, 8, 10, 12, 14, 16, 18)
   - Resalta visualmente el nivel de zoom actual 
   - Implementa `map.setZoom(level)` para cambios inmediatos

5. **Efectos visuales**
   - Animación de pulso al cambiar de zoom para mejor retroalimentación
   - Modo temporal o permanente según la prop `showAlways`
   - Posicionamiento configurable mediante la prop `position`

### Componente OfflineTileDebugger

Se ha mejorado el componente `OfflineTileDebugger.jsx` con:

1. **Visualización del nivel de zoom actual**
   - Se añadió el estado `currentZoom` que se actualiza automáticamente al mover el mapa
   - Se muestra de forma prominente en la interfaz

2. **Selección de niveles de zoom**
   - Implementada con un conjunto de botones para cada nivel posible (8-16)
   - Estado controlado por `selectedZoomLevels` y la función `toggleZoomLevel()`
   - Los niveles seleccionados se resaltan visualmente

3. **Selección optimizada automática**
   - Función `selectOptimizedRange()` que calcula una combinación óptima de niveles
   - Prioriza: nivel actual, niveles base y niveles de detalle
   - Adaptada según el nivel actual de zoom

4. **Botón de descarga dinámico**
   - Muestra los niveles seleccionados en el botón
   - Si no hay selección, usa la estrategia automática

## Integración en el Mapa Principal

### Integración de ZoomLevelIndicator en RealTimeMap

Se ha implementado la integración del componente ZoomLevelIndicator en la página principal de mapa:

1. **Importación y Posicionamiento**
   - Importado en `RealTimeMap.jsx` desde su ubicación en `/components/Maps/`
   - Colocado dentro del `MapContainer` para acceder al contexto del mapa
   - Configurado con `position="bottomright"` y `showAlways={true}` para máxima visibilidad

2. **Integración con Estilos CSS**
   - Archivo CSS dedicado (`ZoomLevelIndicator.css`) para mantener estilos separados
   - Animaciones CSS personalizadas para transiciones suaves
   - Estructura de clases compatible con Tailwind y Leaflet

3. **Consideraciones de Rendimiento**
   - Optimizado para actualizarse solo cuando cambia el nivel de zoom
   - Evita renderizados innecesarios mediante memoización interna
   - Manejo eficiente de eventos de mapa para evitar fugas de memoria

4. **Interactividad y Experiencia de Usuario**
   - Interface intuitiva que permite ver y cambiar el nivel de zoom
   - Retroalimentación visual inmediata al usuario sobre el contexto de visualización
   - Complementa el sistema de descarga de mapas offline proporcionando información sobre los niveles disponibles

## Mejoras en el Backend

### Estrategia de Selección de Niveles de Zoom

Se ha implementado una estrategia mejorada en `calculate_tiles_for_bounds()`:

1. **Priorización por categorías**
   - Niveles base (8-10) para cobertura general
   - Niveles específicamente solicitados por el usuario
   - Niveles adicionales hasta llegar al límite

2. **Exploración de niveles adicionales**
   - El sistema explora niveles no solicitados explícitamente
   - Evalúa cada nivel por cantidad de tiles y dimensiones
   - Intenta incluir niveles incrementales hasta llegar al límite de 30GB

3. **Balance interno**
   - Si un nivel alto consume demasiados recursos, se omite
   - Se garantiza siempre al menos un nivel base

### Optimización de Velocidad de Descarga

Se ha mejorado la función `download_tiles_background_task()`:

1. **Configuración TCP optimizada**
   ```python
   connector = aiohttp.TCPConnector(
       limit=15,               # Más conexiones simultáneas
       limit_per_host=5,       # Más conexiones por host
       force_close=False,      # Mantener conexiones abiertas
       enable_cleanup_closed=True  # Limpiar conexiones cerradas
   )
   ```

2. **Tamaño de lote adaptativo**
   ```python
   if total_tiles < 1000:
       batch_size = 20  # Mayor velocidad para pocas tiles
   elif total_tiles < 10000:
       batch_size = 15  # Velocidad media para descargas moderadas
   else:
       batch_size = 10  # Velocidad controlada para descargas grandes
   ```

3. **Procesamiento eficiente de directorios**
   - Precreación de directorios para todo el lote
   - Eliminación de esperas innecesarias entre tiles

4. **Distribución de carga entre servidores**
   - Asignación cíclica de servidores con offset por nivel de zoom
   - Evita sobrecargar un solo servidor

5. **Retroalimentación dinámica**
   - Ajuste del retraso entre lotes según la tasa de éxito
   - Mayor retraso si se detectan muchos fallos (posible rate limit)

### Sistemas de Protección

1. **Escritura atómica de metadatos**
   ```python
   # Usar un archivo temporal para garantizar escritura atómica
   temp_metadata_path = f"{metadata_path}.tmp"
   with open(temp_metadata_path, "w") as f:
       json.dump(metadata, f, indent=2)
   # Renombrar de forma atómica
   shutil.move(temp_metadata_path, metadata_path)
   ```

2. **Manejo mejorado de errores HTTP**
   - Estrategias específicas para códigos 404, 429, 5xx
   - Reintento exponencial para rate limiting

## Parámetros Configurables

Los siguientes parámetros pueden ajustarse para optimizar el rendimiento:

1. **Límites de tiles por nivel**
   ```python
   max_tiles_per_zoom = 40000 if is_urban else 20000
   ```

2. **Límite global en GB**
   ```python
   gb_limit = 30  # ~6 millones de tiles
   tiles_limit = gb_limit * 1024 * 1024 / 5  # Convertir GB a tiles
   ```

3. **Conexiones simultáneas**
   ```python
   connector = aiohttp.TCPConnector(limit=15, limit_per_host=5)
   ```

4. **Tamaño de lotes**
   ```python
   batch_size = 20/15/10  # Según tamaño total
   ```

## Posibles Futuras Mejoras

1. **Detección avanzada de áreas urbanas**
   - Utilizar APIs externas o archivos GeoJSON para clasificación más precisa

2. **Caching de estimaciones**
   - Guardar estimaciones de tiles para consultas recurrentes

3. **Descarga por prioridad visual**
   - Priorizar tiles en el centro de la pantalla o a lo largo de rutas

4. **Comprensión de tiles**
   - Implementar compresión para reducir espacio de almacenamiento

5. **Configuración personalizada**
   - Permitir al usuario configurar límites de tamaño o número de tiles
