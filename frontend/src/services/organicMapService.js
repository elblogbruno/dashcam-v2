// Service for managing Organic Maps (.mwm files) integration with the application
import { API_BASE_URL } from '../config';
import { showInfo, showSuccess, showError } from './notificationService';

/**
 * Service for managing Organic Maps (.mwm files)
 * This service handles downloading, converting, and serving .mwm files to be used with Leaflet
 */
class OrganicMapManager {
  constructor() {
    this._isInitialized = false;
    this._db = null;
    this._metadataDb = null;
    this.ORGANIC_MAPS_DIR = 'organic_maps';
    this.ORGANIC_MAPS_API = `${API_BASE_URL}/organic-maps`;
    this.DB_NAME = 'organic_maps_data';
    this.METADATA_DB_NAME = 'organic_maps_metadata';
    this.DB_VERSION = 1;
  }

  /**
   * Initializes the databases for storing organic maps data
   */
  async init() {
    if (this._isInitialized) return true;

    try {
      // Initialize the database for storing map tile data
      this._db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('tiles')) {
            db.createObjectStore('tiles', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('mwm_files')) {
            db.createObjectStore('mwm_files', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });

      // Initialize the database for storing metadata
      this._metadataDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.METADATA_DB_NAME, this.DB_VERSION);
        
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('regions')) {
            const store = db.createObjectStore('regions', { keyPath: 'regionId' });
            store.createIndex('regionId', 'regionId', { unique: true });
          }
          if (!db.objectStoreNames.contains('trips')) {
            const store = db.createObjectStore('trips', { keyPath: 'tripId' });
            store.createIndex('tripId', 'tripId', { unique: true });
          }
        };
        
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });

      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing Organic Maps databases:', error);
      this._isInitialized = false;
      return false;
    }
  }

  /**
   * Download MWM files for a specific region
   * @param {string} regionId - ID of the region to download
   * @param {Function} onProgress - Optional callback to track download progress
   * @returns {Promise<Object>} - Result of the download
   */
  async downloadRegionMWM(regionId, onProgress = null) {
    try {
      await this.init();
      
      if (onProgress) onProgress(0, "Iniciando descarga de mapas Organic...");
      
      showInfo('Iniciando descarga de mapas Organic...', {
        title: 'Descarga de Mapas Organic',
        timeout: 3000
      });

      // Request the backend to start downloading the MWM file for the region
      const response = await fetch(`${this.ORGANIC_MAPS_API}/download-region/${regionId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        // Si hay un error, verificamos si puede ser un problema con los espejos
        if (response.status === 500 || response.status === 404) {
          // Verificar el estado de los espejos
          showInfo('Verificando espejos disponibles de Organic Maps...', {
            title: 'Verificación de espejos',
            timeout: 3000
          });
          
          await this.checkMirrorStatus();
          
          // Intentar nuevamente la descarga después de verificar espejos
          const retryResponse = await fetch(`${this.ORGANIC_MAPS_API}/download-region/${regionId}`, {
            method: 'POST'
          });
          
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(`Error al iniciar la descarga (después de verificar espejos): ${errorText}`);
          }
          
          return await retryResponse.json();
        } else {
          const errorText = await response.text();
          throw new Error(`Error al iniciar la descarga: ${errorText}`);
        }
      }
      
      const data = await response.json();
      
      // Periodically check the download status
      let status = 'in_progress';
      let progress = 0;
      
      while (status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`${this.ORGANIC_MAPS_API}/status/${regionId}`);
        const statusData = await statusResponse.json();
        
        status = statusData.status;
        progress = statusData.progress || 0;
        
        if (onProgress) onProgress(progress, statusData.message || `Descargando región ${regionId}...`);
      }
      
      // If the download was successful, save metadata
      if (status === 'completed') {
        await this._saveRegionMetadata(regionId, {
          regionId: regionId,
          downloadDate: new Date().toISOString(),
          bounds: data.bounds,
          size: data.size
        });
        
        showSuccess(`Mapa de Organic Maps descargado para la región ${regionId}`, {
          title: 'Descarga Completada',
          timeout: 5000
        });
        
        if (onProgress) onProgress(100, `Mapa descargado para la región ${regionId}`);
      } else {
        throw new Error(`Descarga fallida: ${data.message || 'Error desconocido'}`);
      }
      
      return {
        success: status === 'completed',
        regionId: regionId,
        status: status
      };
    } catch (error) {
      console.error('Error downloading Organic Maps region:', error);
      showError(`Error al descargar el mapa: ${error.message}`, {
        title: 'Error de Descarga',
        timeout: 8000
      });
      
      if (onProgress) onProgress(0, `Error: ${error.message}`);
      
      throw error;
    }
  }
  
  /**
   * Download MWM files for a trip (covers all regions along the trip)
   * @param {Object} trip - Trip object with route information
   * @param {Function} onProgress - Optional callback for tracking download progress
   * @returns {Promise<Object>} - Result of the download
   */
  async downloadMWMForTrip(trip, onProgress = null) {
    if (!trip || !trip.id) {
      throw new Error('Se requiere un viaje válido con ID');
    }

    try {
      await this.init();
      
      if (onProgress) onProgress(0, "Analizando regiones para el viaje...");
      
      // Calculate the route coordinates
      const coordinates = [
        [trip.start_location.lat, trip.start_location.lon],
        ...(trip.waypoints || []).map(wp => [wp.lat, wp.lon]),
        [trip.end_location.lat, trip.end_location.lon]
      ];

      // Call backend to identify which MWM regions are needed for this trip
      const response = await fetch(`${this.ORGANIC_MAPS_API}/regions-for-trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trip_id: trip.id,
          coordinates: coordinates
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error identificando regiones: ${errorText}`);
      }
      
      const data = await response.json();
      const regions = data.regions || [];
      
      if (regions.length === 0) {
        throw new Error('No se encontraron regiones para este viaje');
      }
      
      if (onProgress) onProgress(10, `Se requieren ${regions.length} regiones para este viaje`);
      
      // Download each region
      let completedRegions = 0;
      for (const region of regions) {
        try {
          if (onProgress) {
            onProgress(
              10 + (completedRegions / regions.length) * 80,
              `Descargando región ${region.name} (${completedRegions + 1}/${regions.length})`
            );
          }
          
          // Check if we already have this region
          const hasRegion = await this.hasRegionMWM(region.id);
          if (!hasRegion) {
            // Download the region
            await this.downloadRegionMWM(region.id, (progress, message) => {
              // Adjust progress to fit within the allotted range for this region
              const adjustedProgress = 10 + 
                ((completedRegions + progress / 100) / regions.length) * 80;
              
              if (onProgress) onProgress(adjustedProgress, message);
            });
          }
          
          completedRegions++;
        } catch (error) {
          console.error(`Error downloading region ${region.id}:`, error);
          // Continue with other regions
        }
      }
      
      // Save trip metadata
      await this._saveTripMetadata(trip.id, {
        tripId: trip.id,
        tripName: trip.name,
        regions: regions.map(r => r.id),
        downloadDate: new Date().toISOString()
      });
      
      if (onProgress) onProgress(100, `Mapas descargados para el viaje ${trip.name}`);
      
      return {
        success: true,
        tripId: trip.id,
        regionsTotal: regions.length,
        regionsDownloaded: completedRegions
      };
    } catch (error) {
      console.error('Error downloading MWM for trip:', error);
      if (onProgress) onProgress(0, `Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if we have MWM files for a specific region
   * @param {string} regionId - ID of the region
   * @returns {Promise<boolean>} - True if the region is available
   */
  async hasRegionMWM(regionId) {
    try {
      await this.init();
      
      return new Promise((resolve) => {
        const transaction = this._metadataDb.transaction(['regions'], 'readonly');
        const store = transaction.objectStore('regions');
        const request = store.get(regionId);
        
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error(`Error checking MWM for region ${regionId}:`, error);
      return false;
    }
  }

  /**
   * Check if MWM files are available for a trip
   * @param {string} tripId - ID of the trip
   * @returns {Promise<boolean>} - True if MWM files are available
   */
  async hasMWMForTrip(tripId) {
    if (!tripId) return false;
    
    try {
      await this.init();
      
      // Check if the trip exists in metadata
      return new Promise((resolve) => {
        const transaction = this._metadataDb.transaction(['trips'], 'readonly');
        const store = transaction.objectStore('trips');
        const request = store.get(tripId);
        
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error(`Error checking MWM for trip ${tripId}:`, error);
      return false;
    }
  }

  /**
   * Get tile from MWM for Leaflet
   * @param {Object} coords - Tile coordinates (x, y, z)
   * @param {string} tripId - ID of the trip
   * @returns {Promise<Blob>} - The tile image data
   */
  async getTileFromMWM(coords, tripId) {
    try {
      await this.init();

      // Check if the trip has MWM data
      const hasMWM = await this.hasMWMForTrip(tripId);
      if (!hasMWM) {
        console.log(`[OrganicMapService] No MWM data for trip ${tripId}`);
        return null;
      }

      // Try to get tile from local cache first
      const tileId = `${tripId}_${coords.z}_${coords.x}_${coords.y}`;
      
      const cachedTile = await new Promise((resolve, reject) => {
        const transaction = this._db.transaction(['tiles'], 'readonly');
        const store = transaction.objectStore('tiles');
        const request = store.get(tileId);
        
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = (e) => reject(e.target.error);
      });
      
      if (cachedTile) {
        console.log(`[OrganicMapService] Using cached tile for ${tileId}`);
        return URL.createObjectURL(cachedTile);
      }

      // If not in cache, request from backend
      const tileUrl = `${this.ORGANIC_MAPS_API}/tile/${tripId}/${coords.z}/${coords.x}/${coords.y}`;
      console.log(`[OrganicMapService] Requesting tile from backend: ${tileUrl}`);
      
      const response = await fetch(tileUrl);
      
      if (!response.ok) {
        console.warn(`[OrganicMapService] Failed to get MWM tile: ${response.status}`);
        return null;
      }
      
      // Check the content type to ensure we're getting an image
      const contentType = response.headers.get('content-type');
      console.log(`[OrganicMapService] Content-Type: ${contentType}`);
      
      const tileBlob = await response.blob();
      
      // Verificar si es un tile de marcador de posición
      // Podemos detectarlo analizando si contiene texto de marcador de posición
      const isPlaceholderTile = await this._isPlaceholderTile(tileBlob);
      console.log(`[OrganicMapService] Is placeholder tile: ${isPlaceholderTile}`);
      
      if (isPlaceholderTile) {
        console.warn(`[OrganicMapService] Received placeholder tile for ${tileId} - MWM tiles not properly rendered`);
        
        if (!this._hasShownPlaceholderWarning) {
          this._hasShownPlaceholderWarning = true;
          
          // Mostrar una notificación solo la primera vez
          import('./notificationService').then(({ showWarning }) => {
            showWarning('Los mapas Organic Maps están en modo de prueba y no se están renderizando correctamente. Por favor, contacta con el soporte.', {
              title: 'Mapas Organic: Solo marcadores de posición',
              timeout: 10000
            });
          });
          
          // Después de 10 segundos, restablecer la bandera para permitir otra advertencia
          setTimeout(() => {
            this._hasShownPlaceholderWarning = false;
          }, 30000);
        }
      }
      
      // Guardar en caché de todas formas, incluso si es un marcador de posición
      await new Promise((resolve, reject) => {
        const transaction = this._db.transaction(['tiles'], 'readwrite');
        const store = transaction.objectStore('tiles');
        
        const request = store.put({
          id: tileId,
          tripId: tripId,
          z: coords.z,
          x: coords.x,
          y: coords.y,
          data: tileBlob,
          timestamp: Date.now(),
          isPlaceholder: isPlaceholderTile
        });
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
      
      return URL.createObjectURL(tileBlob);
    } catch (error) {
      console.error('[OrganicMapService] Error getting MWM tile:', error);
      return null;
    }
  }
  
  /**
   * Verifica si un blob de imagen es un tile de marcador de posición
   * @private
   * @param {Blob} blob - El blob de la imagen
   * @returns {Promise<boolean>} - True si es un marcador de posición
   */
  async _isPlaceholderTile(blob) {
    // Si es una imagen pequeña, podría ser un marcador de posición
    if (blob.size < 10000) {
      try {
        // Convertir el blob a texto para buscar signos de marcador de posición
        const text = await blob.text();
        
        // Buscar texto característico de los marcadores de posición
        if (text.includes('OM:') || text.includes('Trip:')) {
          return true;
        }
        
        // Si es una imagen PNG, verificar algunos patrones comunes en los datos
        if (blob.type === 'image/png' && text.includes('PlaceHold')) {
          return true;
        }
      } catch (e) {
        console.error('Error checking for placeholder:', e);
        // Si no podemos leerlo como texto, probablemente no sea un marcador de posición
      }
    }
    
    return false;
  }

  /**
   * Save metadata for a region
   * @private
   */
  async _saveRegionMetadata(regionId, metadata) {
    return new Promise((resolve, reject) => {
      const transaction = this._metadataDb.transaction(['regions'], 'readwrite');
      const store = transaction.objectStore('regions');
      const request = store.put(metadata);
      
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Save metadata for a trip
   * @private
   */
  async _saveTripMetadata(tripId, metadata) {
    return new Promise((resolve, reject) => {
      const transaction = this._metadataDb.transaction(['trips'], 'readwrite');
      const store = transaction.objectStore('trips');
      const request = store.put(metadata);
      
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get available regions from the backend
   * @returns {Promise<Array>} - List of available regions
   */
  async getAvailableRegions() {
    try {
      const response = await fetch(`${this.ORGANIC_MAPS_API}/regions`);
      if (!response.ok) {
        throw new Error(`Error fetching regions: ${response.status}`);
      }
      
      const data = await response.json();
      return data.regions || [];
    } catch (error) {
      console.error('Error getting available regions:', error);
      return [];
    }
  }

  /**
   * Consulta el estado de los espejos de Organic Maps
   * @returns {Promise<Object>} - Información sobre los espejos disponibles
   */
  async checkMirrorStatus() {
    try {
      const response = await fetch(`${this.ORGANIC_MAPS_API}/check-mirrors`);
      
      if (!response.ok) {
        throw new Error(`Error al verificar espejos: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Mostrar información sobre los espejos
      const workingMirrors = data.mirrors.filter(m => m.available).length;
      const totalMirrors = data.mirrors.filter(m => !m.message).length;
      
      showInfo(`Estado de espejos: ${workingMirrors}/${totalMirrors} disponibles`, {
        title: 'Espejos de Organic Maps',
        timeout: 5000
      });
      
      return data;
    } catch (error) {
      console.error('Error al verificar espejos de Organic Maps:', error);
      return {
        error: error.message,
        mirrors: []
      };
    }
  }

  /**
   * Obtiene información de diagnóstico sobre los mapas Organic disponibles
   * @returns {Promise<Object>} - Objeto con información de diagnóstico
   */
  async getDiagnosticInfo() {
    try {
      await this.init();
      
      // Obtener información de los mapas descargados
      const response = await fetch(`${this.ORGANIC_MAPS_API}/system-status`);
      const serverStatus = await response.json();
      
      // Obtener información de los mapas almacenados localmente
      const localInfo = await this.getLocalMapsInfo();
      
      return {
        serverStatus,
        localMaps: localInfo,
        isInitialized: this._isInitialized,
        dbAvailable: !!this._db && !!this._metadataDb
      };
    } catch (error) {
      console.error('Error obteniendo información de diagnóstico:', error);
      return {
        error: error.message,
        isInitialized: this._isInitialized,
        dbAvailable: !!this._db && !!this._metadataDb
      };
    }
  }
  
  /**
   * Obtiene información sobre los mapas almacenados localmente
   * @returns {Promise<Object>} - Información sobre mapas locales
   */
  async getLocalMapsInfo() {
    if (!this._isInitialized) await this.init();
    
    return new Promise((resolve) => {
      try {
        const transaction = this._metadataDb.transaction(['regions'], 'readonly');
        const store = transaction.objectStore('regions');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const regions = request.result || [];
          
          const tripTransaction = this._metadataDb.transaction(['trips'], 'readonly');
          const tripStore = tripTransaction.objectStore('trips');
          const tripRequest = tripStore.getAll();
          
          tripRequest.onsuccess = () => {
            const trips = tripRequest.result || [];
            
            resolve({
              regionsCount: regions.length,
              regions,
              tripsCount: trips.length,
              trips
            });
          };
          
          tripRequest.onerror = () => {
            resolve({
              regionsCount: regions.length,
              regions,
              tripsCount: 0,
              error: 'Error obteniendo información de viajes'
            });
          };
        };
        
        request.onerror = () => {
          resolve({
            regionsCount: 0,
            error: 'Error obteniendo información de regiones'
          });
        };
      } catch (error) {
        resolve({
          error: error.message
        });
      }
    });
  }
  
  /**
   * Verifica si un mapa MWM concreto está funcionando correctamente
   * @param {string} regionId - ID de la región
   * @returns {Promise<Object>} - Resultado de la verificación
   */
  async verifyMwmFile(regionId) {
    try {
      // Verificar si el archivo está disponible en el servidor
      const response = await fetch(`${this.ORGANIC_MAPS_API}/check-mwm/${regionId}`);
      const serverStatus = await response.json();
      
      // Verificar si tenemos tiles en caché local
      const hasTiles = await this.hasCachedTiles(regionId);
      
      return {
        serverStatus,
        localStatus: {
          hasCachedTiles,
          regionId
        }
      };
    } catch (error) {
      return {
        error: error.message,
        regionId
      };
    }
  }
  
  /**
   * Verifica si hay tiles en caché para una región
   * @param {string} regionId - ID de la región
   * @returns {Promise<boolean>} - True si hay tiles en caché
   */
  async hasCachedTiles(regionId) {
    if (!this._isInitialized) await this.init();
    
    return new Promise((resolve) => {
      try {
        const transaction = this._db.transaction(['tiles'], 'readonly');
        const store = transaction.objectStore('tiles');
        const index = store.index('regionId');
        const request = index.count(regionId);
        
        request.onsuccess = () => {
          resolve(request.result > 0);
        };
        
        request.onerror = () => {
          resolve(false);
        };
      } catch (error) {
        resolve(false);
      }
    });
  }
}

// Create a singleton instance
const organicMapManager = new OrganicMapManager();

export default organicMapManager;
