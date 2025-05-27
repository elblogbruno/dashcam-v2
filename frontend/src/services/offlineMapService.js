import { API_BASE_URL } from '../config';
import { showInfo, showSuccess, showError } from './notificationService';

const OFFLINE_MAPS_BASE_URL = `${API_BASE_URL}/offline-maps`;
const TILE_LAYER_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILES_DB_NAME = 'offline_maps_tiles';
const METADATA_DB_NAME = 'offline_maps_metadata';
const DB_VERSION = 1;

/**
 * Clase para gestionar la descarga y almacenamiento de mapas offline
 */
class OfflineMapManager {
  constructor() {
    this._db = null;
    this._metadataDb = null;
    this._isInitialized = false;
    this._currentTripId = null; // Almacenamos el ID del viaje actual
  }

  /**
   * Inicializa las bases de datos IndexedDB
   */
  async init() {
    if (this._isInitialized) return true;

    try {
      // Base de datos para los tiles del mapa
      this._db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(TILES_DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('tiles')) {
            db.createObjectStore('tiles', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });

      // Base de datos para metadatos de los mapas
      this._metadataDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open(METADATA_DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('maps')) {
            const store = db.createObjectStore('maps', { keyPath: 'tripId' });
            store.createIndex('tripId', 'tripId', { unique: true });
          }
        };
        
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });

      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing offline map databases:', error);
      this._isInitialized = false;
      return false;
    }
  }

  /**
   * Descarga y almacena los tiles del mapa para una ruta de viaje
   * @param {Object} trip - Objeto con los datos del viaje
   * @param {Function} onProgress - Callback para notificar el progreso (0-100)
   * @returns {Promise<Object>} - Resultado de la descarga
   */
  async downloadMapTilesForTrip(trip, onProgress = null) {
    if (!trip || !trip.id) {
      throw new Error('Se requiere un viaje válido con ID');
    }

    try {
      await this.init();
      
      // Notificar inicio
      if (onProgress) onProgress(0, "Iniciando descarga del mapa...");
      
      const showNotification = showInfo('Iniciando descarga del mapa...', {
        title: 'Descarga de Mapas Offline',
        timeout: 3000
      });

      // Calcular la ruta completa (origen, waypoints, destino)
      const coordinates = [
        [trip.start_location.lat, trip.start_location.lon],
        ...(trip.waypoints || []).map(wp => [wp.lat, wp.lon]),
        [trip.end_location.lat, trip.end_location.lon]
      ];

      // Obtener los límites (bounds) de la ruta
      const bounds = this._calculateBounds(coordinates);
      
      // Determinar niveles de zoom a descargar (8 al 16 para equilibrar tamaño y detalle)
      const zoomLevels = [8, 10, 12, 14, 16];
      
      // Calcular los tiles necesarios
      const tilesToDownload = this._calculateRequiredTiles(bounds, zoomLevels);
      
      if (onProgress) onProgress(10, `Calculados ${tilesToDownload.length} tiles para descargar...`);
      
      // Descargar los tiles
      const totalTiles = tilesToDownload.length;
      let downloadedTiles = 0;
      let failedTiles = 0;
      
      // Guardamos metadatos del mapa
      await this._saveMapMetadata(trip.id, {
        tripId: trip.id,
        tripName: trip.name,
        bounds: bounds,
        zoomLevels: zoomLevels,
        totalTiles: totalTiles,
        downloadDate: new Date().toISOString()
      });

      // Crear array de promesas para descargar tiles por lotes
      const batchSize = 10;
      let currentBatch = 0;
      
      while (currentBatch * batchSize < totalTiles) {
        const start = currentBatch * batchSize;
        const end = Math.min(start + batchSize, totalTiles);
        const batch = tilesToDownload.slice(start, end);
        
        await Promise.all(
          batch.map(async (tile) => {
            try {
              await this._downloadAndStoreTile(tile);
              downloadedTiles++;
            } catch (error) {
              console.error(`Error downloading tile ${tile.id}:`, error);
              failedTiles++;
            }
            
            // Actualizar progreso
            const progress = Math.round((downloadedTiles + failedTiles) / totalTiles * 90) + 10;
            if (onProgress && progress % 5 === 0) {
              onProgress(
                progress, 
                `Descargando tiles ${downloadedTiles}/${totalTiles} (${failedTiles} fallidos)`
              );
            }
          })
        );
        
        currentBatch++;
      }
      
      // Notificación final
      showSuccess(`Mapa descargado: ${downloadedTiles} tiles (${failedTiles} fallidos)`, {
        title: 'Descarga Completada',
        timeout: 5000
      });
      
      if (onProgress) onProgress(100, `Mapa descargado: ${downloadedTiles} tiles (${failedTiles} fallidos)`);
      
      return {
        success: true,
        tripId: trip.id,
        downloadedTiles,
        failedTiles,
        totalTiles
      };
    } catch (error) {
      console.error('Error downloading map tiles:', error);
      showError(`Error al descargar el mapa: ${error.message}`, {
        title: 'Error de Descarga',
        timeout: 8000
      });
      
      if (onProgress) onProgress(0, `Error: ${error.message}`);
      
      throw error;
    }
  }

  /**
   * Comprueba si hay un mapa offline disponible para un viaje
   * @param {string} tripId - ID del viaje
   * @returns {Promise<boolean>} - true si existe un mapa para el viaje
   */
  /**
   * Establece el ID del viaje actual
   * @param {string} tripId - ID del viaje
   */
  setCurrentTripId(tripId) {
    this._currentTripId = tripId;
    console.log(`[OfflineMapService] Estableciendo viaje actual: ${tripId}`);
  }
  
  /**
   * Obtiene el ID del viaje actual
   * @returns {Promise<string|null>} - ID del viaje actual
   */
  async _getCurrentTripId() {
    if (this._currentTripId) {
      return this._currentTripId;
    }
    return null;
  }
  
  /**
   * Solicita la descarga de mapas offline para un viaje
   * @param {string} tripId - ID del viaje
   * @returns {Promise<boolean>} - True si la descarga se inició correctamente
   */
  async downloadMapsForTrip(tripId) {
    try {
      console.log(`[OfflineMapService] Solicitando descarga de mapas para el viaje ${tripId}`);
      
      // Primero obtenemos la información del viaje para conocer sus bounds
      // Verificamos si es un viaje planeado (IDs de viajes planeados comienzan con 'planned-')
      const isPlannedTrip = true; // tripId.startsWith('planned-');
      // const endpoint = isPlannedTrip ? `${API_BASE_URL}/trip-planner/${tripId}` : `${API_BASE_URL}/trips/${tripId}`;
      const endpoint =  `${API_BASE_URL}/trip-planner/${tripId}`;
      console.log(`[OfflineMapService] Usando endpoint: ${endpoint} para ${isPlannedTrip ? 'viaje planeado' : 'viaje normal'}`);
      
      const tripResponse = await fetch(endpoint);
      if (!tripResponse.ok) {
        throw new Error(`Error obteniendo información del viaje: ${tripResponse.statusText}`);
      }
      
      const trip = await tripResponse.json();

      console.log(`[OfflineMapService] Información del viaje:`, trip);
      
      // Ya tenemos la variable isPlannedTrip definida arriba
      let coordinates = [];
      
      if (isPlannedTrip) {
        // Para viajes planeados, extraer coordenadas de start_location, waypoints y end_location
        if (!trip.start_location || !trip.end_location) {
          showError('El viaje planeado no tiene coordenadas completas para generar mapas offline');
          return false;
        }
        
        coordinates.push({
          lat: trip.start_location.lat,
          lng: trip.start_location.lon
        });
        
        // Añadir waypoints si existen
        if (trip.waypoints && Array.isArray(trip.waypoints)) {
          for (const waypoint of trip.waypoints) {
            coordinates.push({
              lat: waypoint.lat,
              lng: waypoint.lon
            });
          }
        }
        
        coordinates.push({
          lat: trip.end_location.lat,
          lng: trip.end_location.lon
        });
      } else {
        // Para viajes normales, usar el path
        if (!trip.path || trip.path.length === 0) {
          showError('El viaje no tiene coordenadas para generar mapas offline');
          return false;
        }
        coordinates = trip.path;
      }
      
      console.log(`[OfflineMapService] Procesando ${coordinates.length} coordenadas para el viaje ${tripId}`);
      
      // Calculamos los bounds del viaje (extensión del mapa)
      let north = -90, south = 90, east = -180, west = 180;
      
      for (const point of coordinates) {
        if (point.lat > north) north = point.lat;
        if (point.lat < south) south = point.lat;
        if (point.lng > east) east = point.lng;
        if (point.lng < west) west = point.lng;
      }
      
      // Añadimos un pequeño margen
      const margin = 0.02;
      north += margin;
      south -= margin;
      east += margin;
      west -= margin;
      
      // Estimar el tamaño del área para elegir los niveles de zoom adecuados
      const latDiff = north - south;
      const lonDiff = east - west;
      const areaSize = latDiff * lonDiff;
      
      // Seleccionar niveles de zoom según el tamaño del área
      let zoomLevels;
      
      if (areaSize > 1) { // Área muy grande (> 1 grado²)
        zoomLevels = [8, 9, 10, 11];
      } else if (areaSize > 0.1) { // Área grande (0.1-1 grado²)
        zoomLevels = [9, 10, 11, 12];
      } else if (areaSize > 0.01) { // Área mediana (0.01-0.1 grado²)
        zoomLevels = [10, 11, 12, 13];
      } else if (areaSize > 0.001) { // Área pequeña (0.001-0.01 grado²)
        zoomLevels = [11, 12, 13, 14];
      } else { // Área muy pequeña (< 0.001 grado²)
        zoomLevels = [12, 13, 14, 15];
      }
      
      console.log(`[OfflineMapService] Área: ${areaSize.toFixed(6)} grados² - Niveles de zoom seleccionados: ${zoomLevels.join(', ')}`);
      
      // Logging de la solicitud para debug
      console.log(`[OfflineMapService] Enviando solicitud de descarga con bounds: N=${north}, S=${south}, E=${east}, W=${west}, Zoom: [${zoomLevels.join(', ')}]`);
      
      // Solicitamos la descarga de los tiles al backend
      const response = await fetch(`${API_BASE_URL}/offline-maps/download-tiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trip_id: tripId,
          bounds: {
            north,
            south,
            east,
            west
          },
          zoom_levels: zoomLevels
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      showInfo(`Descarga de mapas offline iniciada. Se descargarán ${data.total_tiles} tiles.`);
      
      // Esperar un momento y actualizar la disponibilidad
      setTimeout(async () => {
        await this.hasOfflineMapForTrip(tripId);
      }, 2000);
      
      return true;
    } catch (error) {
      console.error('[OfflineMapService] Error solicitando descarga de mapas:', error);
      showError(`Error al solicitar la descarga de mapas: ${error.message}`);
      return false;
    }
  }

  /**
   * Solicita la descarga de mapas offline para un área específica (manual)
   * @param {string} tripId - ID del viaje
   * @param {Object} bounds - Límites geográficos del área (north, south, east, west)
   * @param {Array<number>} zoomLevels - Niveles de zoom a descargar
   * @returns {Promise<boolean>} - True si la descarga se inició correctamente
   */
  async downloadMapsForAreaManually(tripId, bounds, zoomLevels) {
    try {
      console.log(`[OfflineMapService] Solicitando descarga manual de mapas para área específica - Viaje: ${tripId}`);
      console.log(`[OfflineMapService] Bounds: N=${bounds.north}, S=${bounds.south}, E=${bounds.east}, W=${bounds.west}`);
      console.log(`[OfflineMapService] Zoom levels: ${zoomLevels.join(', ')}`);
      
      // Verificar si hay una descarga en progreso
      const statusResponse = await fetch(`${API_BASE_URL}/offline-maps/status/${tripId}`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.status === 'in_progress') {
          console.warn('[OfflineMapService] Ya hay una descarga en curso para este viaje');
          showInfo('Ya hay una descarga en progreso para este viaje');
          return false;
        }
      }

      // Solicitamos la descarga de los tiles al backend
      const response = await fetch(`${API_BASE_URL}/offline-maps/download-tiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trip_id: tripId,
          bounds: bounds,
          zoom_levels: zoomLevels
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      showInfo(`Descarga de mapas offline iniciada. Se descargarán ${data.total_tiles} tiles.`);
      
      // Actualizar el estado después de un momento
      setTimeout(async () => {
        await this.hasOfflineMapForTrip(tripId);
      }, 2000);
      
      return true;
    } catch (error) {
      console.error('[OfflineMapService] Error solicitando descarga manual de mapas:', error);
      showError(`Error al solicitar la descarga manual de mapas: ${error.message}`);
      return false;
    }
  }

  async hasOfflineMapForTrip(tripId) {
    if (!tripId) return false;
    
    try {
      await this.init();
      
      // Almacenar el ID del viaje actual
      this.setCurrentTripId(tripId);
      
      // Comprobar si existe en los metadatos
      return new Promise((resolve) => {
        const transaction = this._metadataDb.transaction(['maps'], 'readonly');
        const store = transaction.objectStore('maps');
        const request = store.get(tripId);
        
        request.onsuccess = () => {
          resolve(!!request.result);
        };
        
        request.onerror = () => {
          resolve(false);
        };
      });
    } catch (error) {
      console.error(`Error checking offline map for trip ${tripId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene la URL para un tile específico, priorizando la versión offline
   * @param {Object} coords - Coordinadas del tile (x, y, z)
   * @returns {Promise<string|Blob>} - URL o Blob del tile
   */
  async getTileUrl(coords) {
    try {
      await this.init();
      
      // Intentar obtener el tile de la base de datos
      const tileId = `${coords.z}:${coords.x}:${coords.y}`;
      
      try {
        const tile = await new Promise((resolve, reject) => {
          const transaction = this._db.transaction(['tiles'], 'readonly');
          const store = transaction.objectStore('tiles');
          const request = store.get(tileId);
          
          request.onsuccess = () => {
            resolve(request.result ? request.result.data : null);
          };
          
          request.onerror = (e) => reject(e.target.error);
        });
        
        // Si encontramos el tile offline, devolver blob URL
        if (tile) {
          return URL.createObjectURL(tile);
        }
      } catch (error) {
        console.warn(`Error retrieving tile ${tileId} from offline storage:`, error);
      }
    } catch (error) {
      console.warn('Error accessing offline tile storage:', error);
    }
    
    // Si no hay tile offline o falla, intentar obtenerlo del backend
    // El backend devolverá el tile si lo tiene descargado o lo obtendrá de OSM si no
    const tripId = await this._getCurrentTripId();
    if (tripId) {
      return `${OFFLINE_MAPS_BASE_URL}/tile/${tripId}/${coords.z}/${coords.x}/${coords.y}`;
    }      // Si no hay un tripId activo o el servidor no está disponible, usar la URL online como fallback
      // Usamos un servidor aleatorio entre a, b, c para distribuir la carga
      const server = String.fromCharCode(97 + Math.floor(Math.random() * 3)); // 97 es 'a' en ASCII
      return TILE_LAYER_URL
        .replace('{s}', server)
        .replace('{z}', coords.z)
        .replace('{x}', coords.x)
        .replace('{y}', coords.y);
  }

  /**
   * Obtiene la lista de mapas offline almacenados
   * @returns {Promise<Array>} - Lista de mapas offline con sus detalles
   */
  async getOfflineMaps() {
    try {
      await this.init();
      
      return new Promise((resolve, reject) => {
        const transaction = this._metadataDb.transaction(['maps'], 'readonly');
        const store = transaction.objectStore('maps');
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        
        request.onerror = (e) => {
          reject(e.target.error);
        };
      });
    } catch (error) {
      console.error('Error getting offline maps:', error);
      return [];
    }
  }

  /**
   * Calcula los límites geográficos de una lista de coordenadas
   * @private
   * @param {Array} coordinates - Lista de pares [lat, lon]
   * @returns {Object} - Objeto con los límites (north, south, east, west)
   */
  _calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return { north: 0, south: 0, east: 0, west: 0 };
    }
    
    const bounds = {
      north: coordinates[0][0],
      south: coordinates[0][0],
      east: coordinates[0][1],
      west: coordinates[0][1]
    };
    
    coordinates.forEach(([lat, lon]) => {
      bounds.north = Math.max(bounds.north, lat);
      bounds.south = Math.min(bounds.south, lat);
      bounds.east = Math.max(bounds.east, lon);
      bounds.west = Math.min(bounds.west, lon);
    });
    
    // Agregar un margen del 20% para mostrar el área alrededor de la ruta
    const latMargin = (bounds.north - bounds.south) * 0.2;
    const lonMargin = (bounds.east - bounds.west) * 0.2;
    
    bounds.north += latMargin;
    bounds.south -= latMargin;
    bounds.east += lonMargin;
    bounds.west -= lonMargin;
    
    return bounds;
  }

  /**
   * Calcula los tiles necesarios para cubrir un área en los niveles de zoom especificados
   * @private
   * @param {Object} bounds - Límites geográficos
   * @param {Array<number>} zoomLevels - Niveles de zoom a descargar
   * @returns {Array<Object>} - Lista de objetos de tiles (x, y, z)
   */
  _calculateRequiredTiles(bounds, zoomLevels) {
    const tiles = [];
    
    // Primero, analizar cada nivel de zoom propuesto
    const zoomEstimates = [];
    
    for (const zoom of zoomLevels) {
      try {
        // Convertir límites geográficos a coordenadas de tiles
        const minTile = this._latLonToTile(bounds.north, bounds.west, zoom);
        const maxTile = this._latLonToTile(bounds.south, bounds.east, zoom);
        
        // Asegurar que los valores están en el orden correcto
        const xStart = Math.min(minTile.x, maxTile.x);
        const xEnd = Math.max(minTile.x, maxTile.x);
        const yStart = Math.min(minTile.y, maxTile.y);
        const yEnd = Math.max(minTile.y, maxTile.y);
        
        const width = xEnd - xStart + 1;
        const height = yEnd - yStart + 1;
        const tilesCount = width * height;
        
        zoomEstimates.push({
          zoom,
          xStart,
          xEnd,
          yStart,
          yEnd,
          width,
          height,
          tilesCount
        });
        
        console.log(`Zoom ${zoom}: ${tilesCount} tiles (${width}x${height})`);
      } catch (e) {
        console.error(`Error estimating tiles for zoom ${zoom}:`, e);
      }
    }
    
    // Ordenar de menor a mayor nivel de zoom
    zoomEstimates.sort((a, b) => a.zoom - b.zoom);
    
    // Establecer un límite razonable de tiles por nivel de zoom
    const maxTilesPerZoom = 500;
    
    // Filtrar niveles de zoom que no excedan el límite
    const validZoomLevels = zoomEstimates.filter(z => 
      z.tilesCount <= maxTilesPerZoom && z.width <= 100 && z.height <= 100
    );
    
    // Si no hay niveles válidos, tomar el menor y reducir el área
    let finalZoomLevels = validZoomLevels;
    
    if (finalZoomLevels.length === 0 && zoomEstimates.length > 0) {
      // Tomar el nivel más bajo y limitar el área
      const minZoom = zoomEstimates[0];
      console.warn(`All zoom levels exceed limit, using only zoom ${minZoom.zoom} with reduced area`);
      finalZoomLevels = [minZoom];
    }
    
    // Si hay muchos niveles válidos, distribuirlos
    if (finalZoomLevels.length > 3) {
      // Seleccionar una distribución representativa
      const step = Math.floor(finalZoomLevels.length / 3);
      const selected = [];
      
      // Siempre incluir el nivel más bajo
      selected.push(finalZoomLevels[0]);
      
      // Añadir niveles intermedios
      for (let i = 1; i < finalZoomLevels.length - 1; i += step) {
        selected.push(finalZoomLevels[i]);
      }
      
      // Añadir el nivel más alto si no está ya
      if (selected[selected.length - 1] !== finalZoomLevels[finalZoomLevels.length - 1]) {
        selected.push(finalZoomLevels[finalZoomLevels.length - 1]);
      }
      
      finalZoomLevels = selected;
    }
    
    console.log(`Selected zoom levels: ${finalZoomLevels.map(z => z.zoom).join(', ')}`);
    
    // Ahora generar los tiles para los niveles seleccionados
    for (const zoomLevel of finalZoomLevels) {
      const { zoom, xStart, xEnd, yStart, yEnd } = zoomLevel;
      
      // Generar la lista de tiles
      for (let x = xStart; x <= xEnd; x++) {
        for (let y = yStart; y <= yEnd; y++) {
          tiles.push({
            x,
            y,
            z: zoom,
            id: `${zoom}:${x}:${y}`
          });
        }
      }
    }
    
    return tiles;
  }

  /**
   * Convierte coordenadas lat/lon a coordenadas de tile
   * @private
   * @param {number} lat - Latitud
   * @param {number} lon - Longitud
   * @param {number} zoom - Nivel de zoom
   * @returns {Object} - Coordenadas del tile (x, y)
   */
  _latLonToTile(lat, lon, zoom) {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
  }

  /**
   * Descarga y almacena un tile en IndexedDB
   * @private
   * @param {Object} tile - Objeto que describe el tile (x, y, z)
   * @returns {Promise<void>}
   */
  async _downloadAndStoreTile(tile) {
    const url = TILE_LAYER_URL
      .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)])
      .replace('{z}', tile.z)
      .replace('{x}', tile.x)
      .replace('{y}', tile.y);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Guardar en IndexedDB
      await new Promise((resolve, reject) => {
        const transaction = this._db.transaction(['tiles'], 'readwrite');
        const store = transaction.objectStore('tiles');
        
        const request = store.put({
          id: tile.id,
          x: tile.x,
          y: tile.y,
          z: tile.z,
          data: blob,
          timestamp: Date.now()
        });
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
    } catch (error) {
      console.warn(`Error downloading tile ${tile.id}:`, error);
      throw error;
    }
  }

  /**
   * Guarda los metadatos de un mapa descargado
   * @private
   * @param {string} tripId - ID del viaje
   * @param {Object} metadata - Metadatos del mapa
   * @returns {Promise<void>}
   */
  async _saveMapMetadata(tripId, metadata) {
    return new Promise((resolve, reject) => {
      const transaction = this._metadataDb.transaction(['maps'], 'readwrite');
      const store = transaction.objectStore('maps');
      const request = store.put(metadata);
      
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Elimina los mapas offline de un viaje
   * @param {string} tripId - ID del viaje
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteOfflineMapForTrip(tripId) {
    try {
      await this.init();
      
      // Primero, obtener los metadatos del mapa
      const metadata = await new Promise((resolve, reject) => {
        const transaction = this._metadataDb.transaction(['maps'], 'readonly');
        const store = transaction.objectStore('maps');
        const request = store.get(tripId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
      
      if (!metadata) {
        return false; // No hay mapa para este viaje
      }
      
      // Eliminar los tiles del mapa
      // Nota: Esto podría ser ineficiente para mapas grandes, pero es más seguro que mantener un índice separado
      const transaction = this._db.transaction(['tiles'], 'readwrite');
      const store = transaction.objectStore('tiles');
      
      // No podemos eliminar directamente por tripId porque no tenemos un índice,
      // necesitaríamos recorrer todos los tiles y comprobar si pertenecen a este viaje.
      // Por ahora, dejamos los tiles (ocuparán espacio pero no afectarán funcionalidad)
      
      // Eliminar los metadatos
      await new Promise((resolve, reject) => {
        const metaTransaction = this._metadataDb.transaction(['maps'], 'readwrite');
        const metaStore = metaTransaction.objectStore('maps');
        const request = metaStore.delete(tripId);
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
      
      return true;
    } catch (error) {
      console.error(`Error deleting offline map for trip ${tripId}:`, error);
      return false;
    }
  }
}

// Singleton instance
const offlineMapManager = new OfflineMapManager();

export default offlineMapManager;
