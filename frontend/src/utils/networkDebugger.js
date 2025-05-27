/**
 * Utilidad para depurar problemas de red durante las cargas de archivos
 */

/**
 * Comprueba la conexión con el servidor y devuelve información de diagnóstico
 * @returns {Promise<Object>} Información sobre la conexión
 */
export const checkServerConnection = async () => {
  try {
    console.log('[NET_DEBUG] Iniciando comprobación de conexión al servidor');
    const startTime = performance.now();
    
    const response = await fetch('/api/system/status', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const endTime = performance.now();
    const pingTime = endTime - startTime;
    
    if (!response.ok) {
      console.error(`[NET_DEBUG] Error en la respuesta: ${response.status} ${response.statusText}`);
      return {
        connected: false,
        status: response.status,
        statusText: response.statusText,
        ping: pingTime,
        message: `Error en la conexión: ${response.status} ${response.statusText}`
      };
    }
    
    const data = await response.json();
    console.log(`[NET_DEBUG] Conexión exitosa. Ping: ${pingTime.toFixed(2)}ms`, data);
    
    return {
      connected: true,
      status: response.status,
      ping: pingTime,
      data: data,
      message: `Conectado al servidor. Ping: ${pingTime.toFixed(0)}ms`
    };
  } catch (error) {
    console.error('[NET_DEBUG] Error comprobando conexión:', error);
    return {
      connected: false,
      error: error.message,
      message: `Sin conexión: ${error.message}`
    };
  }
};

/**
 * Comprueba la velocidad de carga estimada
 * @returns {Promise<Object>} Información sobre la velocidad de carga
 */
export const testUploadSpeed = async () => {
  try {
    console.log('[NET_DEBUG] Iniciando prueba de velocidad de carga');
    
    // Crear un buffer de datos aleatorios (1MB)
    const size = 1024 * 1024; // 1MB
    const testData = new ArrayBuffer(size);
    const view = new Uint8Array(testData);
    for (let i = 0; i < size; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }
    
    const blob = new Blob([testData], { type: 'application/octet-stream' });
    const file = new File([blob], 'speedtest.bin', { type: 'application/octet-stream' });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', new Date().toISOString().split('T')[0]);  // Fecha actual
    
    // Iniciar cronómetro
    const startTime = performance.now();
    
    // Enviar los datos al servidor
    const response = await fetch('/api/videos/upload', {
      method: 'POST',
      body: formData,
    });
    
    const endTime = performance.now();
    const uploadTime = (endTime - startTime) / 1000; // en segundos
    
    // Cálculo de velocidad en Mbps (Megabits por segundo)
    const sizeMb = size * 8 / 1024 / 1024; // Convertir bytes a Megabits
    const speedMbps = sizeMb / uploadTime;
    
    console.log(`[NET_DEBUG] Prueba de velocidad completada: ${speedMbps.toFixed(2)} Mbps`);
    
    return {
      success: response.ok,
      speed: speedMbps,
      time: uploadTime,
      size: size,
      message: `Velocidad de carga: ${speedMbps.toFixed(2)} Mbps`
    };
  } catch (error) {
    console.error('[NET_DEBUG] Error en prueba de velocidad:', error);
    return {
      success: false,
      error: error.message,
      message: `Error en prueba de velocidad: ${error.message}`
    };
  }
};

/**
 * Registra información del navegador y la red
 * @returns {Object} Información sobre el entorno
 */
export const getBrowserInfo = () => {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    connection: null,
    memory: null,
    webp: null,
    api: {
      webWorkers: 'Worker' in window,
      webSockets: 'WebSocket' in window,
      fetch: 'fetch' in window,
      serviceWorker: 'serviceWorker' in navigator
    }
  };
  
  // Información de conexión
  if ('connection' in navigator) {
    const conn = navigator.connection;
    info.connection = {
      type: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData
    };
  }
  
  // Información de memoria
  if ('deviceMemory' in navigator) {
    info.memory = {
      deviceMemory: navigator.deviceMemory
    };
  }
  
  // Comprobar soporte de WebP
  const canvas = document.createElement('canvas');
  if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
    info.webp = true;
  } else {
    info.webp = false;
  }
  
  console.log('[NET_DEBUG] Información del navegador:', info);
  return info;
};

export default {
  checkServerConnection,
  testUploadSpeed,
  getBrowserInfo
};
