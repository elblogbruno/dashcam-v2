import { API_BASE_URL } from '../config';
import { showInfo, showSuccess, showError } from './notificationService';
import offlineMapManager from './offlineMapService';
import landmarkImageManager from './landmarkImageService';

/**
 * Fetch all landmarks
 * @returns {Promise<Array>} List of all landmarks
 */
export const fetchAllLandmarks = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks`);
    if (!response.ok) throw new Error('Failed to fetch landmarks');
    return await response.json();
  } catch (error) {
    console.error('Error fetching landmarks:', error);
    throw error;
  }
};

/**
 * Descarga recursos offline (mapas e imágenes) para un viaje
 * @param {string} tripId - ID del viaje
 * @param {function} onProgress - Callback de progreso
 */
export const setupOfflineResources = async (tripId, onProgress = null) => {
  try {
    // Obtener los landmarks descargados para este viaje
    const landmarksResponse = await fetch(`${API_BASE_URL}/landmarks/by-trip/${tripId}`);
    if (!landmarksResponse.ok) throw new Error('Failed to fetch trip landmarks');
    const landmarks = await landmarksResponse.json();
    
    // Obtener el detalle del viaje para tener la información de la ruta
    const tripResponse = await fetch(`${API_BASE_URL}/trip-planner/${tripId}`);
    if (!tripResponse.ok) throw new Error('Failed to fetch trip details');
    const trip = await tripResponse.json();
    
    // Descargar el mapa offline en segundo plano
    offlineMapManager.downloadMapTilesForTrip(trip, (progress, detail) => {
      if (onProgress) {
        onProgress(progress, `Mapa offline: ${detail}`);
      }
    }).catch(error => {
      console.error('Error downloading offline map:', error);
      showError(`Error al descargar mapa offline: ${error.message}`, {
        title: 'Error de Descarga',
        timeout: 5000
      });
    });
    
    // Descargar imágenes para landmarks en segundo plano
    landmarkImageManager.downloadLandmarkImages(tripId, landmarks, (progress, detail) => {
      if (onProgress) {
        onProgress(progress, `Imágenes: ${detail}`);
      }
    }).catch(error => {
      console.error('Error downloading landmark images:', error);
      showError(`Error al descargar imágenes: ${error.message}`, {
        title: 'Error de Descarga',
        timeout: 5000
      });
    });
    
    return true;
  } catch (error) {
    console.error('Error setting up offline resources:', error);
    showError(`Error al preparar recursos offline: ${error.message}`, {
      title: 'Advertencia',
      timeout: 5000
    });
    return false;
  }
};

/**
 * Download landmarks for a specific trip
 * @param {string} tripId - The ID of the trip
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<Object>} Result of the download
 */
export const downloadTripLandmarks = async (tripId, onProgress = null) => {
  try {
    // Mostrar notificación de inicio
    const startNotificationId = showInfo('Iniciando descarga de puntos de interés...', {
      title: 'Descarga de POI',
      timeout: 3000
    });
    
    // Start the download process
    const response = await fetch(`${API_BASE_URL}/trip-planner/${tripId}/download-landmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ radius_km: 10, notify: true })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to start landmark download');
    }
    
    const result = await response.json();
    
    // If we don't need progress updates, just return the result
    if (!onProgress) {
      return result;
    }
    
    // Create an EventSource to track progress
    const eventSource = new EventSource(`${API_BASE_URL}/trip-planner/${tripId}/download-landmarks-stream`);
    
    let lastProgressNotification = null;
    
    return new Promise((resolve, reject) => {
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          if (onProgress) {
            onProgress(data.progress, data.detail);
          }
          
          // Mostrar notificaciones de progreso en hitos importantes (cada 25%)
          if (data.progress % 25 < 1 && data.progress > 0) {
            // Remover notificación anterior si existe
            if (lastProgressNotification) {
              // No es necesario removerla manualmente porque tienen timeout
            }
            
            // Crear nueva notificación
            lastProgressNotification = showInfo(`${data.progress}% completado - ${data.detail}`, {
              title: 'Descarga de POI en progreso',
              timeout: 3000
            });
          }
        } else if (data.type === 'complete') {
          eventSource.close();
          
          // Mostrar notificación de finalización
          showSuccess('Descarga de puntos de interés completada', {
            title: 'Descarga Completada',
            timeout: 5000
          });
          
          // Iniciar descarga de mapas e imágenes offline después de resolver
          setTimeout(() => {
            setupOfflineResources(tripId, onProgress);
          }, 500);
          
          resolve(data);
        } else if (data.type === 'error') {
          eventSource.close();
          
          // Mostrar notificación de error
          showError(`Error en la descarga: ${data.message || 'Error desconocido'}`, {
            title: 'Error de Descarga',
            timeout: 8000
          });
          
          reject(new Error(data.message || 'Download failed'));
        }
      };
      
      eventSource.onerror = (error) => {
        eventSource.close();
        reject(error || new Error('Connection lost while downloading landmarks'));
      };
    });
  } catch (error) {
    console.error('Error downloading landmarks:', error);
    throw error;
  }
};

/**
 * Add a new landmark
 * @param {Object} landmarkData - The landmark data
 * @returns {Promise<Object>} The created landmark
 */
export const addLandmark = async (landmarkData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(landmarkData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to add landmark');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding landmark:', error);
    throw error;
  }
};

/**
 * Search for landmarks based on name or category
 * @param {string} query - The search query
 * @returns {Promise<Array>} List of matching landmarks
 */
export const searchLandmarks = async (query) => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search landmarks');
    return await response.json();
  } catch (error) {
    console.error('Error searching landmarks:', error);
    throw error;
  }
};

/**
 * Delete a landmark
 * @param {string} landmarkId - The ID of the landmark to delete
 * @returns {Promise<Object>} Result of the deletion
 */
export const deleteLandmark = async (landmarkId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks/${landmarkId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete landmark');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting landmark:', error);
    throw error;
  }
};

/**
 * Get landmark settings
 * @returns {Promise<Object>} The landmark settings
 */
export const getLandmarkSettings = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/trip-planner/settings/landmarks`);
    if (!response.ok) throw new Error('Failed to fetch landmark settings');
    return await response.json();
  } catch (error) {
    console.error('Error fetching landmark settings:', error);
    throw error;
  }
};

/**
 * Update landmark settings
 * @param {Object} settingsData - The settings data
 * @returns {Promise<Object>} The updated settings
 */
export const updateLandmarkSettings = async (settingsData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/trip-planner/settings/landmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingsData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update settings');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating landmark settings:', error);
    throw error;
  }
};