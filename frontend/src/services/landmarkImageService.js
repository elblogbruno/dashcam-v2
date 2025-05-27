import { API_BASE_URL } from '../config';
import { showInfo, showSuccess, showError } from './notificationService';

const LANDMARK_IMAGES_DB_NAME = 'landmark_images';
const IMAGE_CACHE_VERSION = 1;

/**
 * Clase para gestionar la descarga y almacenamiento de imágenes de landmarks
 */
class LandmarkImageManager {
  constructor() {
    this._db = null;
    this._isInitialized = false;
  }

  /**
   * Inicializa la base de datos IndexedDB para imágenes
   */
  async init() {
    if (this._isInitialized) return true;

    try {
      this._db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(LANDMARK_IMAGES_DB_NAME, IMAGE_CACHE_VERSION);
        
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('images')) {
            const store = db.createObjectStore('images', { keyPath: 'id' });
            store.createIndex('landmarkId', 'landmarkId', { unique: false });
            store.createIndex('tripId', 'tripId', { unique: false });
          }
        };
        
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });

      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing landmark images database:', error);
      this._isInitialized = false;
      return false;
    }
  }

  /**
   * Descarga imágenes para todos los landmarks de un viaje
   * @param {string} tripId - ID del viaje
   * @param {Array} landmarks - Lista de landmarks
   * @param {Function} onProgress - Callback para notificar el progreso (0-100)
   * @returns {Promise<Object>} - Resultado de la descarga
   */
  async downloadLandmarkImages(tripId, landmarks, onProgress = null) {
    if (!tripId) {
      throw new Error('Se requiere un ID de viaje válido');
    }
    
    if (!landmarks || !Array.isArray(landmarks) || landmarks.length === 0) {
      throw new Error('No hay landmarks para descargar imágenes');
    }

    try {
      await this.init();
      
      // Notificar inicio
      if (onProgress) onProgress(0, "Iniciando descarga de imágenes...");
      
      showInfo('Iniciando descarga de imágenes para puntos de interés...', {
        title: 'Descarga de Imágenes',
        timeout: 3000
      });

      // Filtrar landmarks que probablemente tengan imágenes interesantes
      const landmarksWithPotentialImages = landmarks.filter(landmark => {
        // Excluir puntos de inicio, fin y waypoints del viaje
        const isSystemLandmark = ['trip_start', 'trip_end', 'trip_waypoint'].includes(landmark.category);
        return !isSystemLandmark;
      });
      
      if (landmarksWithPotentialImages.length === 0) {
        if (onProgress) onProgress(100, "No hay puntos de interés que requieran imágenes");
        return { success: true, downloadedImages: 0, totalLandmarks: 0 };
      }
      
      // Actualizar progreso
      if (onProgress) onProgress(
        5, 
        `Preparando descarga para ${landmarksWithPotentialImages.length} puntos de interés...`
      );
      
      // Descargar imágenes para cada landmark (en lotes para no sobrecargar)
      const batchSize = 5;
      let downloadedImages = 0;
      let failedImages = 0;
      let totalProcessed = 0;
      
      // Función para procesar un lote de landmarks
      const processBatch = async (batch) => {
        // Usar Promise.allSettled en lugar de Promise.all para que un error en una imagen no afecte al resto
        const results = await Promise.allSettled(
          batch.map(async (landmark) => {
            try {
              // Log para depuración
              console.log(`Processing landmark: ${landmark.name} (${landmark.category})`);
              
              // Descargar imagen para el landmark
              const imageUrl = await this._fetchImageForLandmark(landmark);
              
              if (imageUrl) {
                console.log(`Found image URL for ${landmark.name}: ${imageUrl}`);
                try {
                  // Descargar la imagen
                  const imageBlob = await this._downloadImage(imageUrl);
                  
                  // Guardar la imagen en IndexedDB
                  await this._saveImageToCache(landmark.id, tripId, imageBlob);
                  
                  downloadedImages++;
                  return { status: 'success', landmark: landmark.name };
                } catch (downloadError) {
                  console.warn(`Failed to download image for ${landmark.name}:`, downloadError);
                  
                  // Intentar con una imagen de fallback local
                  try {
                    const fallbackUrl = `/assets/default_images/${landmark.category || 'poi'}.jpg`;
                    const fallbackBlob = await this._downloadImage(fallbackUrl);
                    await this._saveImageToCache(landmark.id, tripId, fallbackBlob);
                    downloadedImages++;
                    return { status: 'success-fallback', landmark: landmark.name };
                  } catch (fallbackError) {
                    console.error(`Fallback image also failed for ${landmark.name}:`, fallbackError);
                    failedImages++;
                    return { status: 'error', landmark: landmark.name, error: fallbackError };
                  }
                }
              } else {
                // No se encontró imagen para este landmark
                console.warn(`No image URL found for landmark ${landmark.name}`);
                failedImages++;
                return { status: 'no-image', landmark: landmark.name };
              }
            } catch (error) {
              console.error(`Error downloading image for landmark ${landmark.name}:`, error);
              failedImages++;
              return { status: 'error', landmark: landmark.name, error };
            } finally {
              totalProcessed++;
              
              // Actualizar progreso
              const progress = Math.round(
                (totalProcessed / landmarksWithPotentialImages.length * 90) + 5
              );
              
              if (onProgress) {
                onProgress(
                  progress, 
                  `Descargando imágenes ${totalProcessed}/${landmarksWithPotentialImages.length}...`
                );
              }
            }
          })
        );
        
        // Analizar resultados para loggear
        console.log(`Batch completed: ${results.length} landmarks processed`);
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const value = result.value;
            if (value.status === 'success') {
              console.log(`✅ Successfully cached image for ${value.landmark}`);
            } else if (value.status === 'success-fallback') {
              console.log(`⚠️ Used fallback image for ${value.landmark}`);
            } else if (value.status === 'no-image') {
              console.warn(`⚠️ No image found for ${value.landmark}`);
            } else if (value.status === 'error') {
              console.error(`❌ Error processing ${value.landmark}: ${value.error}`);
            }
          } else {
            console.error(`❌ Promise rejected: ${result.reason}`);
          }
        });
      };
      
      // Procesar landmarks por lotes
      for (let i = 0; i < landmarksWithPotentialImages.length; i += batchSize) {
        const batch = landmarksWithPotentialImages.slice(i, i + batchSize);
        await processBatch(batch);
      }
      
      // Notificación final
      showSuccess(
        `Descarga completada: ${downloadedImages} imágenes (${failedImages} no disponibles)`,
        {
          title: 'Imágenes Descargadas',
          timeout: 5000
        }
      );
      
      if (onProgress) {
        onProgress(
          100, 
          `Descargadas ${downloadedImages} imágenes (${failedImages} no disponibles)`
        );
      }
      
      return {
        success: true,
        downloadedImages,
        failedImages,
        totalLandmarks: landmarksWithPotentialImages.length
      };
    } catch (error) {
      console.error('Error downloading landmark images:', error);
      showError(`Error al descargar imágenes: ${error.message}`, {
        title: 'Error de Descarga',
        timeout: 8000
      });
      
      if (onProgress) onProgress(0, `Error: ${error.message}`);
      
      throw error;
    }
  }

  /**
   * Obtiene una imagen para un landmark específico
   * @param {string} landmarkId - ID del landmark
   * @returns {Promise<string|null>} - URL de la imagen o null si no existe
   */
  async getLandmarkImageUrl(landmarkId) {
    if (!landmarkId) return null;
    
    try {
      await this.init();
      
      // Buscar la imagen en la caché
      const cachedImage = await new Promise((resolve, reject) => {
        const transaction = this._db.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const index = store.index('landmarkId');
        const request = index.get(landmarkId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
      
      // Si encontramos la imagen en caché, devolver blob URL
      if (cachedImage && cachedImage.imageData) {
        return URL.createObjectURL(cachedImage.imageData);
      }
      
      return null;
    } catch (error) {
      console.warn(`Error retrieving image for landmark ${landmarkId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene todas las imágenes almacenadas
   * @returns {Promise<Array>} - Lista con todas las imágenes almacenadas
   */
  async getStoredImages() {
    try {
      await this.init();
      
      return new Promise((resolve, reject) => {
        const transaction = this._db.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        
        request.onerror = (e) => {
          reject(e.target.error);
        };
      });
    } catch (error) {
      console.error('Error getting stored images:', error);
      return [];
    }
  }
  
  /**
   * Elimina todas las imágenes asociadas a un viaje
   * @param {string} tripId - ID del viaje
   * @returns {Promise<boolean>} - true si se eliminaron con éxito
   */
  async deleteImagesForTrip(tripId) {
    if (!tripId) return false;
    
    try {
      await this.init();
      
      // Obtener todas las imágenes del viaje
      const images = await new Promise((resolve, reject) => {
        const transaction = this._db.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const index = store.index('tripId');
        const request = index.getAll(tripId);
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
      });
      
      // Si no hay imágenes, no hacer nada
      if (images.length === 0) return true;
      
      // Eliminar las imágenes una por una
      await Promise.all(images.map(image => {
        return new Promise((resolve, reject) => {
          const transaction = this._db.transaction(['images'], 'readwrite');
          const store = transaction.objectStore('images');
          const request = store.delete(image.id);
          
          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e.target.error);
        });
      }));
      
      return true;
    } catch (error) {
      console.error(`Error deleting images for trip ${tripId}:`, error);
      return false;
    }
  }

  /**
   * Busca y descarga una imagen para un landmark
   * @private
   * @param {Object} landmark - Objeto landmark
   * @returns {Promise<string|null>} - URL de la imagen o null si no se encuentra
   */
  async _fetchImageForLandmark(landmark) {
    try {
      // Construir la consulta para buscar una imagen relevante
      let searchQuery = landmark.name;
      
      // Añadir categoría para mejorar la búsqueda
      if (landmark.category) {
        const categories = {
          'natural': 'natural landmark',
          'tourism': 'tourist attraction',
          'historic': 'historic site',
          'gas_station': 'gas station',
          'restaurant': 'restaurant',
          'hotel': 'hotel'
        };
        
        if (categories[landmark.category]) {
          searchQuery += ` ${categories[landmark.category]}`;
        }
      }
      
      // Detectar marcas específicas de gasolineras (Shell, BP, etc.) y añadirlas explícitamente
      const gasStationBrands = ['shell', 'chevron', 'bp', 'exxon', 'mobil', 'texaco', 'arco', '76'];
      const landmarkNameLower = landmark.name.toLowerCase();
      
      for (const brand of gasStationBrands) {
        if (landmarkNameLower.includes(brand)) {
          // Si el landmark es una marca de gasolinera conocida, asegúrate de que esté al principio de la query
          searchQuery = `${brand} ${searchQuery}`;
          console.log(`Enhanced search query for gas station brand: ${searchQuery}`);
          break;
        }
      }
      
      // Añadir la ubicación para mejorar resultados
      if (landmark.lat && landmark.lon) {
        const location = await this._getLocationNameFromCoords(landmark.lat, landmark.lon);
        if (location) {
          searchQuery += ` ${location}`;
        }
      }
      
      // Realizar la búsqueda de imágenes utilizando la API
      const response = await fetch(`${API_BASE_URL}/landmark-images/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 1
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.images && data.images.length > 0) {
        return data.images[0].url;
      }
      
      // Plan B: Usar un servicio externo para buscar imágenes
      try {
        // Simular solicitud a API externa (reemplazar con implementación real)
        // En un caso real, aquí se usaría una API como Unsplash, Pixabay, etc.
        console.log(`Using fallback image search for ${landmark.name} with query: ${searchQuery}`);
        const fallbackImageUrl = await this._searchFallbackImage(landmark, searchQuery);
        return fallbackImageUrl;
      } catch (fallbackError) {
        console.warn(`Fallback image search failed for ${landmark.name}:`, fallbackError);
        return null;
      }
    } catch (error) {
      console.warn(`Error fetching image for landmark ${landmark.name}:`, error);
      return null;
    }
  }

  /**
   * Obtiene el nombre de una ubicación a partir de coordenadas
   * @private
   * @param {number} lat - Latitud
   * @param {number} lon - Longitud
   * @returns {Promise<string|null>} - Nombre de la ubicación o null
   */
  async _getLocationNameFromCoords(lat, lon) {
    try {
      const response = await fetch(`${API_BASE_URL}/geocode/reverse?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      if (data && data.display_name) {
        // Extraer solo la parte relevante (ciudad, región)
        const parts = data.display_name.split(',');
        return parts.slice(0, 2).join(',');
      }
      
      return null;
    } catch (error) {
      console.warn('Error getting location name:', error);
      return null;
    }
  }

  /**
   * Busca una imagen en servicios alternativos
   * @private
   * @param {Object} landmark - Objeto landmark para el que se busca imagen
   * @param {string} query - Consulta de búsqueda
   * @returns {Promise<string|null>} - URL de la imagen o null
   */
  async _searchFallbackImage(landmark, query) {
    // Este es un placeholder. En una implementación real:
    // 1. Usar una API gratuita como Unsplash, Pixabay, etc.
    // 2. O usar imágenes propias basadas en la categoría del landmark
    
    // Simulación de búsqueda exitosa
    const categories = {
      'natural': '/assets/default_images/natural.jpg',
      'tourism': '/assets/default_images/tourism.jpg',
      'historic': '/assets/default_images/historic.jpg',
      'gas_station': '/assets/default_images/gas_station.jpg',
      'restaurant': '/assets/default_images/restaurant.jpg',
      'hotel': '/assets/default_images/hotel.jpg',
      'poi': '/assets/default_images/poi.jpg',
      // Añadir marcas específicas de gasolineras
      'shell': '/assets/default_images/shell.jpg',
      'chevron': '/assets/default_images/gas_station.jpg',
      'bp': '/assets/default_images/gas_station.jpg',
      'exxon': '/assets/default_images/gas_station.jpg',
      'mobil': '/assets/default_images/gas_station.jpg',
      'texaco': '/assets/default_images/gas_station.jpg',
      'arco': '/assets/default_images/gas_station.jpg',
      '76': '/assets/default_images/gas_station.jpg'
    };
    
    // Primero verificar si es una marca específica de gasolinera
    const landmarkNameLower = landmark.name.toLowerCase();
    const gasStationBrands = ['shell', 'chevron', 'bp', 'exxon', 'mobil', 'texaco', 'arco', '76'];
    
    for (const brand of gasStationBrands) {
      if (landmarkNameLower.includes(brand)) {
        console.log(`Found gas station brand match: ${brand} for ${landmark.name}`);
        // Si tenemos imagen específica para esta marca, usarla
        if (categories[brand]) {
          return categories[brand];
        }
        // Si no, usar la genérica de gas_station
        return categories['gas_station'];
      }
    }
    
    // Si no es una marca específica, buscar categoría general
    const queryLower = query.toLowerCase();
    const categoryMatch = Object.keys(categories).find(cat => queryLower.includes(cat));
    const imageUrl = categoryMatch 
      ? categories[categoryMatch] 
      : categories['poi'];
    
    // En un caso real, aquí se haría una solicitud HTTP
    return imageUrl;
  }

  /**
   * Descarga una imagen desde una URL
   * @private
   * @param {string} url - URL de la imagen
   * @returns {Promise<Blob>} - Blob de la imagen
   */
  async _downloadImage(url) {
    try {
      // Si es una URL relativa (como las de fallback), construir URL completa
      const fullUrl = url.startsWith('/')
        ? `${window.location.origin}${url}`
        : url;
      
      // Añadir un timeout para no esperar indefinidamente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout
      
      try {
        const response = await fetch(fullUrl, { 
          signal: controller.signal,
          // Prevenir el uso de caché para evitar errores con recursos obsoletos
          cache: 'no-store'
        });
        
        // Limpiar el timeout si la respuesta llega
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        return await response.blob();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Si la URL es de Unsplash y falla, intentemos con una URL alternativa
        if (url.includes('unsplash.com') && fetchError.message !== 'The operation was aborted.') {
          console.log(`Retrying with alternative image URL for ${url}`);
          // Usamos una imagen de gas station que sabemos que funciona
          const fallbackUrl = "https://images.unsplash.com/photo-1559267307-b3fa3c402723?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80";
          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            return await fallbackResponse.blob();
          }
        }
        throw fetchError;
      }
    } catch (error) {
      console.warn(`Error downloading image from ${url}:`, error);
      
      // Retornar una imagen vacía en lugar de fallar
      if (url.includes('unsplash.com')) {
        try {
          // Crear un pequeño canvas como imagen de fallback
          const canvas = document.createElement('canvas');
          canvas.width = 100;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          
          // Rellenar con un color de fondo
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, 100, 100);
          
          // Añadir una línea de texto
          ctx.fillStyle = '#666666';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Imagen no disponible', 50, 50);
          
          return await new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
          });
        } catch (canvasError) {
          console.error('Error creating fallback image:', canvasError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Guarda una imagen en la caché de IndexedDB
   * @private
   * @param {string} landmarkId - ID del landmark
   * @param {string} tripId - ID del viaje
   * @param {Blob} imageBlob - Blob de la imagen
   * @returns {Promise<void>}
   */
  async _saveImageToCache(landmarkId, tripId, imageBlob) {
    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.put({
        id: `${landmarkId}_${Date.now()}`,
        landmarkId: landmarkId,
        tripId: tripId,
        imageData: imageBlob,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Elimina las imágenes de los landmarks de un viaje
   * @param {string} tripId - ID del viaje
   * @returns {Promise<boolean>} - true si se eliminaron correctamente
   */
  async deleteTripLandmarkImages(tripId) {
    try {
      await this.init();
      
      // Buscar todas las imágenes del viaje
      const images = await new Promise((resolve, reject) => {
        const transaction = this._db.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const index = store.index('tripId');
        const request = index.getAll(tripId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
      
      if (!images || images.length === 0) {
        return false; // No hay imágenes para este viaje
      }
      
      // Eliminar cada imagen
      await Promise.all(
        images.map(image => 
          new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            const request = store.delete(image.id);
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
          })
        )
      );
      
      return true;
    } catch (error) {
      console.error(`Error deleting landmark images for trip ${tripId}:`, error);
      return false;
    }
  }

  /**
   * Comprueba si hay imágenes disponibles para un viaje
   * @param {string} tripId - ID del viaje
   * @returns {Promise<number>} - Número de imágenes disponibles
   */
  async countTripLandmarkImages(tripId) {
    if (!tripId) return 0;
    
    try {
      await this.init();
      
      // Contar imágenes del viaje
      return new Promise((resolve) => {
        const transaction = this._db.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const index = store.index('tripId');
        const countRequest = index.count(tripId);
        
        countRequest.onsuccess = () => {
          resolve(countRequest.result);
        };
        
        countRequest.onerror = () => {
          resolve(0);
        };
      });
    } catch (error) {
      console.warn(`Error counting landmark images for trip ${tripId}:`, error);
      return 0;
    }
  }
}

// Singleton instance
const landmarkImageManager = new LandmarkImageManager();

export default landmarkImageManager;
