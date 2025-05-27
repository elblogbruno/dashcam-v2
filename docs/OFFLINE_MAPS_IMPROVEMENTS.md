# Mejoras en la Descarga de Mapas Offline

Este documento describe las mejoras realizadas al sistema de descarga de mapas offline en la aplicación DashCam.

## Problemas Abordados

1. Soporte mejorado para áreas urbanas que requieren niveles de zoom adicionales.
2. Manejo optimizado de errores en la descarga de tiles.
3. Eliminación de dependencias específicas a Organic Maps para usar un sistema más genérico.

## Cambios Realizados

### 1. Nuevo Componente `ZoomLevelIndicator`

- Se creó un nuevo componente `ZoomLevelIndicator.jsx` para mostrar el nivel de zoom actual en el mapa.
- Características:
  - Muestra el nivel de zoom actual con una descripción (Detalle máximo, Calles detalladas, etc.)
  - Permite cambiar rápidamente entre niveles predefinidos de zoom
  - Proporciona información sobre la categoría de zoom (Urbano detallado, Rural, etc.)
  - Se anima al cambiar el nivel de zoom para mejor retroalimentación visual

### 2. Nuevo Componente `OfflineTileDebugger`

- Se creó un nuevo componente `OfflineTileDebugger.jsx` basado en el anterior `OrganicTileDebugger.jsx`.
- Se eliminaron todas las referencias a Organic Maps.
- Se agregaron funcionalidades para depuración y descarga manual de áreas específicas.

### 2. Mejoras en el Backend de Mapas Offline

- Implementada la detección de áreas urbanas mediante la función `is_urban_area`, que analiza el tamaño del área.
- Ajuste automático de niveles de zoom y cantidad de tiles según el área detectada:
  - Áreas urbanas: Hasta 40,000 tiles por nivel de zoom y hasta 8 niveles de zoom
  - Áreas rurales: Hasta 20,000 tiles por nivel de zoom y hasta 5 niveles de zoom
- Optimización de los márgenes para áreas urbanas (800px vs 400px para áreas rurales)
- Límite global de descarga de aproximadamente 30GB (6 millones de tiles).
- Nueva estrategia de adición incremental de niveles de zoom:
  - Priorización de niveles base (8-10) para cobertura general
  - Inclusión de niveles solicitados específicamente por el usuario
  - Adición de niveles hasta acercarse al límite de 30GB
- Optimización de velocidad de descarga con balance para evitar límites de tasa:
  - Tamaño de lote dinámico según el tamaño total de la descarga
  - Retrasos adaptativos basados en la tasa de fallos
  - Conexiones TCP optimizadas para mejorar el rendimiento

### 3. Mejora en la Descarga de Tiles

- Implementada una función `download_single_tile` mejorada con:
  - Manejo específico de códigos de estado HTTP (404, 429, 500, etc.)
  - Backoff exponencial para reintentos
  - Headers optimizados para interactuar con servidores de mapas
  - Timeouts ajustados para condiciones de red variables

### 4. Servicios Frontend

- Se agregó la función `downloadMapsForAreaManually` al servicio `offlineMapService.js` para permitir descargas específicas de áreas.
- Verificación de descargas en curso para evitar iniciar múltiples descargas simultáneas.

## Cómo Usar

### Indicador de Nivel de Zoom

1. El mapa ahora muestra un indicador de nivel de zoom en la esquina inferior derecha.
2. Funcionalidades del indicador:
   - Muestra el nivel de zoom actual con una descripción (ej. "Calles detalladas")
   - Haciendo clic en él se expande para mostrar opciones adicionales
   - En modo expandido permite:
     - Ver la categoría de zoom actual (Urbano detallado, Rural, etc.)
     - Cambiar rápidamente entre niveles predefinidos (6, 8, 10, 12, 14, 16, 18)
   - Se anima visualmente al cambiar de zoom para mejor retroalimentación

### Nueva Interfaz de Usuario de Descarga

1. En modo desarrollador, el mapa muestra el depurador de tiles offline en la esquina inferior derecha.
2. La interfaz ahora muestra:
   - El nivel de zoom actual del mapa
   - Selector de niveles de zoom específicos para descarga
   - Botón para selección automática optimizada de niveles

### Descarga Manual de Mapas

1. Para descargar los tiles del área visible actual:
   - Navega hasta el área deseada
   - Ajusta el nivel de zoom aproximado
   - Selecciona los niveles de zoom específicos que deseas descargar o usa "Selección Optimizada"
   - Haz clic en "Descargar Tiles de Área Visible" (o el botón que muestra los niveles seleccionados)

### Selección de Niveles de Zoom

1. Selección Manual:
   - Haz clic en los botones numerados para seleccionar/deseleccionar niveles de zoom específicos
   - Los niveles seleccionados aparecerán resaltados en azul
   
2. Selección Optimizada:
   - Haz clic en "Selección Optimizada" para que el sistema sugiera niveles basados en:
     - El nivel de zoom actual como nivel principal
     - Niveles base (8-10) para visión general
     - Niveles adicionales cercanos para mayor detalle

### Verificación de Tiles

1. Selecciona un tile desde la lista de tiles visibles.
2. Haz clic en "Probar Offline" para verificar si el tile está disponible localmente.
3. Haz clic en "API Directa" para verificar la respuesta directa del backend.

## Notas para Desarrolladores

- El componente `OrganicTileDebugger.jsx` ha sido marcado como obsoleto y será eliminado en futuras versiones.
- Para nuevas implementaciones, utilizar siempre `OfflineTileDebugger.jsx`.
- La detección automática de áreas urbanas puede ajustarse modificando el umbral en la función `is_urban_area`.

## Futuras Mejoras

- Implementar un sistema de caché más eficiente para reducir descargas repetidas.
- Añadir soporte para descarga previa de rutas completas basadas en navegación.
- Mejorar el sistema de priorización de tiles según patrones de uso.
