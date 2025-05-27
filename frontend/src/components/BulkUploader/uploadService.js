/**
 * Servicio para manejar la carga de archivos y generación de miniaturas
 * Optimizado para móviles
 */
import axios from 'axios';

/**
 * Carga un archivo con su metadatos al servidor
 * @param {File} file - El archivo a cargar
 * @param {Object} metadata - Metadatos del archivo
 * @param {Function} onProgress - Función de callback para reportar el progreso
 * @returns {Promise} - Promesa que resuelve con la respuesta del servidor
 */
export const uploadVideoFile = async (file, metadata, onProgress) => {
  const startTime = performance.now();
  console.log(`[UPLOAD] Iniciando carga del archivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    console.log(`[UPLOAD] Archivo añadido al FormData. Tipo: ${file.type}`);
    
    // Añadir metadatos
    if (metadata.date) {
      formData.append('date', metadata.date);
      console.log(`[UPLOAD] Metadata - fecha: ${metadata.date}`);
    }
    if (metadata.lat) {
      formData.append('lat', metadata.lat);
      console.log(`[UPLOAD] Metadata - lat: ${metadata.lat}`);
    }
    if (metadata.lon) {
      formData.append('lon', metadata.lon);
      console.log(`[UPLOAD] Metadata - lon: ${metadata.lon}`);
    }
    if (metadata.source) {
      formData.append('source', metadata.source);
      console.log(`[UPLOAD] Metadata - fuente: ${metadata.source}`);
    }
    if (metadata.tags) {
      formData.append('tags', metadata.tags);
      console.log(`[UPLOAD] Metadata - tags: ${metadata.tags}`);
    }
    
    // Configuración para seguimiento de progreso
    let lastProgressUpdate = 0;
    const config = {
      onUploadProgress: (progressEvent) => {
        const loaded = progressEvent.loaded;
        const total = progressEvent.total;
        const percentCompleted = Math.round((loaded * 100) / total);
        
        // En dispositivos móviles, actualizar con menos frecuencia para mejorar rendimiento
        const isMobile = window.innerWidth < 768;
        const updateThreshold = isMobile ? 10 : 5; // 10% en móvil, 5% en desktop
        
        // Limitar logging a cambios significativos
        if (percentCompleted - lastProgressUpdate >= updateThreshold) {
          console.log(`[UPLOAD] Progreso: ${percentCompleted}% (${(loaded / 1024 / 1024).toFixed(2)} / ${(total / 1024 / 1024).toFixed(2)} MB)`);
          lastProgressUpdate = percentCompleted;
        }
        
        if (onProgress) onProgress(percentCompleted);
      },
      // Añadir un timeout para evitar que la petición se quede colgada
      // Tiempo más largo para móviles por posible conexión más lenta
      timeout: window.innerWidth < 768 ? 180000 : 120000, // 3 minutos en móvil, 2 en desktop
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };
    
    console.log(`[UPLOAD] Configuración creada, iniciando petición POST`);
    
    const response = await axios.post('/api/videos/upload', formData, config);
    
    const endTime = performance.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`[UPLOAD] ✅ Carga completada con éxito en ${totalTime}s. ID: ${response.data.id}`);
    
    return {
      success: true,
      data: response.data,
      uploadTime: totalTime
    };
  } catch (error) {
    const endTime = performance.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.error(`[UPLOAD] ❌ Error después de ${totalTime}s:`, error);
    
    // Proporcionar un mensaje de error más detallado
    let errorMsg = 'Error desconocido al subir el archivo';
    
    if (error.response) {
      // El servidor respondió con un código de error
      console.error(`[UPLOAD] Error del servidor: ${error.response.status}`, error.response.data);
      errorMsg = error.response.data?.detail || `Error ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
      // La petición se hizo pero no se recibió respuesta
      console.error('[UPLOAD] No se recibió respuesta del servidor:', error.request);
      
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'La carga está tardando demasiado. Intenta con una conexión Wi-Fi.';
        console.error('[UPLOAD] Timeout alcanzado');
      } else {
        errorMsg = 'No se recibió respuesta del servidor';
      }
    } else {
      // Error al configurar la petición
      console.error('[UPLOAD] Error en la configuración de la petición:', error.message);
      errorMsg = error.message;
    }
    
    // Verificar si hay errores de red específicos
    if (error.code === 'ERR_NETWORK') {
      console.error('[UPLOAD] Error de red - Posible desconexión');
      errorMsg = 'Error de conexión con el servidor. Verifique su conexión a Internet.';
    }
    
    // Mensajes de error más adaptados a móviles
    if (window.innerWidth < 768) {
      // Errores comunes en móviles
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'La carga está tardando demasiado. Intenta con una conexión Wi-Fi.';
      } else if (error.code === 'ERR_NETWORK') {
        errorMsg = 'Conexión interrumpida. Verifica tu señal de datos o Wi-Fi.';
      }
    }
    
    return {
      success: false,
      error: errorMsg,
      uploadTime: totalTime
    };
  }
};

/**
 * Extrae metadatos de un archivo de video
 * Optimizado para rendimiento en móviles
 */
export const extractVideoMetadata = (file) => {
  return new Promise((resolve) => {
    // Crear un elemento de video para extraer metadatos
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    // Crear URL de objeto para el archivo
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    const metadata = {
      fileDate: null,
      duration: null,
      width: null,
      height: null
    };
    
    // Intentar extraer fecha del nombre del archivo (común en cámaras: yyyymmdd_hhmmss)
    const dateMatch = file.name.match(/(\d{4})(\d{2})(\d{2})/);
    if (dateMatch) {
      const [_, year, month, day] = dateMatch;
      metadata.fileDate = `${year}-${month}-${day}`;
    }
    
    // Timeout más corto en móviles para evitar bloqueos de UI
    const timeoutDuration = window.innerWidth < 768 ? 1500 : 3000;
    
    // Cuando se cargan los metadatos del video
    video.onloadedmetadata = () => {
      // Extraer duración y dimensiones
      metadata.duration = video.duration;
      metadata.width = video.videoWidth;
      metadata.height = video.videoHeight;
      
      // Liberar la URL del objeto
      URL.revokeObjectURL(objectUrl);
      
      resolve(metadata);
    };
    
    // Si hay un error o toma demasiado tiempo, resolver con lo que tengamos
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };
    
    // Timeout por si acaso
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    }, timeoutDuration);
  });
};

/**
 * Genera una miniatura para un archivo de video
 * Optimizado para dispositivos móviles
 */
export const generateVideoThumbnail = (file) => {
  return new Promise((resolve) => {
    // En dispositivos móviles con archivos grandes, evitar generación de miniaturas
    const isMobile = window.innerWidth < 768;
    const fileSizeThreshold = 100 * 1024 * 1024; // 100MB
    
    if (isMobile && file.size > fileSizeThreshold) {
      console.log(`[THUMBNAIL] Archivo demasiado grande para generar miniatura en móvil: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      resolve(null);
      return;
    }

    // Crear un elemento de video para generar la miniatura
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    
    // Crear URL de objeto para el archivo
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    // Cuando se cargan los metadatos
    video.onloadedmetadata = () => {
      // Ir a 1 segundo o la mitad del video, lo que sea menor
      video.currentTime = Math.min(1, video.duration / 2);
      
      video.onseeked = () => {
        // Crear un canvas para capturar el fotograma
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convertir el canvas a URL de datos
        const thumbnailUrl = canvas.toDataURL();
        
        // Liberar la URL del objeto
        URL.revokeObjectURL(objectUrl);
        
        resolve(thumbnailUrl);
      };
    };
    
    // Si hay un error al cargar el video
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null); // Resolver con null en caso de error
    };
    
    // Usar un timeout más corto en móviles
    const timeoutDuration = isMobile ? 1500 : 3000;
    
    // Timeout por si acaso
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    }, timeoutDuration);
  });
};

/**
 * Procesa archivos para preparar la carga
 * @param {FileList} fileList - Lista de archivos a procesar
 * @returns {Promise} - Promesa que resuelve con un array de objetos de archivo procesados
 */
export const processFiles = async (fileList) => {
  // Filtrar archivos de video
  const validFiles = Array.from(fileList).filter(file => 
    file.type.startsWith('video/') || 
    /\.(mp4|avi|mov|webm|insv|mts|m2ts|mkv)$/i.test(file.name)
  );
  
  if (validFiles.length === 0) {
    return [];
  }
  
  // Procesar cada archivo en paralelo
  const processedFiles = await Promise.all(validFiles.map(async (file) => {
    // Extraer metadatos
    const metadata = await extractVideoMetadata(file);
    
    return {
      file,
      name: file.name,
      size: file.size,
      type: file.type || inferMimeType(file.name),
      fileDate: metadata.fileDate,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      status: 'pending' // pending, uploading, success, error
    };
  }));
  
  return processedFiles;
};

/**
 * Intenta inferir el tipo MIME basado en la extensión del archivo
 * @param {string} filename - Nombre del archivo
 * @returns {string} - Tipo MIME inferido o genérico
 */
const inferMimeType = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'insv': 'video/mp4', // Insta360 normalmente usa contenedor MP4
    'mts': 'video/mp2t',  // AVCHD
    'm2ts': 'video/mp2t', // AVCHD
    'mkv': 'video/x-matroska'
  };
  
  return mimeTypes[extension] || 'video/mp4'; // Fallback a MP4 como más común
};
