/**
 * WebRTCService - DISABLED
 * 
 * Este servicio ha sido deshabilitado completamente.
 * Todas las funciones devuelven errores indicando que WebRTC no está disponible.
 */

// DISABLED - WebRTC functionality has been completely disabled
console.warn('WebRTC service is disabled');

/**
 * Todas las funciones WebRTC han sido deshabilitadas
 */

export const getWebSocketUrl = (cameraType) => {
  throw new Error('WebRTC service is disabled');
};

export const checkServerAvailability = async () => {
  return Promise.reject(new Error('WebRTC service is disabled'));
};

export const toggleWebRTCStreaming = async (cameraType, enable) => {
  return Promise.reject(new Error('WebRTC service is disabled'));
};

export const checkWebRTCStreamingStatus = async (cameraType) => {
  return Promise.reject(new Error('WebRTC service is disabled'));
};

export const createWebRTCConnection = async (cameraType, videoElement) => {
  return Promise.reject(new Error('WebRTC service is disabled'));
};

export const closeWebRTCConnection = async (cameraType) => {
  return Promise.reject(new Error('WebRTC service is disabled'));
};

export const getConnectionStatistics = async () => {
  return Promise.reject(new Error('WebRTC service is disabled'));
};

// Export a disabled marker
export const WEBRTC_DISABLED = true;
  return `${protocol}//${host}:${port}/api/webrtc/${cameraType}`;
};

/**
 * Alterna el estado del streaming WebRTC para un tipo de cámara específico
 * 
 * @param {string} cameraType - Tipo de cámara ('road' o 'interior')
 * @returns {Promise<Object>} - Resultado del toggle
 */
export const toggleWebRTCStreaming = async (cameraType) => {
  try {
    const host = window.location.hostname;
    const isDevelopmentMode = window.location.port === '5173';
    const port = isDevelopmentMode ? SERVER_PORT : window.location.port;
    const protocol = window.location.protocol;
    
    const response = await fetch(`${protocol}//${host}:${port}/api/webrtc/toggle/${cameraType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    throw new Error('Error al alternar streaming WebRTC');
  } catch (error) {
    console.error('Error en toggle WebRTC:', error);
    throw error;
  }
};

/**
 * Crea una configuración óptima para conexiones WebRTC
 * 
 * @returns {RTCConfiguration} - Configuración para RTCPeerConnection
 */
export const getOptimalRTCConfig = () => {
  return {
    iceServers: [
      { urls: STUN_SERVERS[0], credentialType: 'none' },
      { urls: STUN_SERVERS[1], credentialType: 'none' },
      { urls: STUN_SERVERS[2], credentialType: 'none' },
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 2,
    sdpSemantics: 'unified-plan'
  };
};

/**
 * Comprueba si el streaming WebRTC está habilitado para un tipo de cámara
 * 
 * @param {string} cameraType - Tipo de cámara ('road' o 'interior')
 * @returns {Promise<boolean>} - true si el streaming está habilitado para la cámara
 */
export const checkWebRTCStreamingStatus = async (cameraType) => {
  try {
    const host = window.location.hostname;
    const isDevelopmentMode = window.location.port === '5173';
    const port = isDevelopmentMode ? SERVER_PORT : window.location.port;
    const protocol = window.location.protocol;
    
    const response = await fetch(`${protocol}//${host}:${port}/api/webrtc/status`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (response.ok) {
      const status = await response.json();
      return status.streaming_enabled && status.streaming_enabled[cameraType] === true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking WebRTC streaming status:', error);
    return false;
  }
};

/**
 * Comprueba si el servidor WebRTC está disponible
 * 
 * @returns {Promise<boolean>} - true si el servidor está disponible
 */
export const checkServerAvailability = async () => {
  try {
    const host = window.location.hostname;
    const isDevelopmentMode = window.location.port === '5173';
    const port = isDevelopmentMode ? SERVER_PORT : window.location.port;
    const protocol = window.location.protocol;
    
    const response = await fetch(`${protocol}//${host}:${port}/api/webrtc/status`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      timeout: 5000
    });
    
    if (response.ok) {
      const status = await response.json();
      return status.status === 'ok';
    }
    
    return false;
  } catch (error) {
    console.error('Error checking WebRTC server availability:', error);
    return false;
  }
};

/**
 * Genera un identificador único para la sesión WebRTC
 * 
 * @param {string} cameraType - Tipo de cámara ('road' o 'interior') 
 * @returns {string} - Identificador único
 */
export const generateSessionId = (cameraType) => {
  return `${cameraType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
