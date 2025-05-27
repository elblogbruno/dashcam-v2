/**
 * WebRTCService - Servicio para gestionar conexiones WebRTC
 * 
 * Este servicio provee funcionalidades para:
 * - Establecer y gestionar conexiones WebRTC robustas con el backend
 * - Detectar y recuperarse de fallos de conexión
 * - Manejar la reconexión automática 
 */

const SERVER_PORT = 8000; // Puerto del backend para WebRTC
const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.stunprotocol.org:3478'
];

/**
 * Obtiene la URL correcta para el WebSocket de WebRTC
 * 
 * @param {string} cameraType - Tipo de cámara ('road' o 'interior')
 * @returns {string} URL del WebSocket
 */
export const getWebSocketUrl = (cameraType) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  
  // Determinar el puerto correcto según el entorno
  const isDevelopmentMode = window.location.port === '5173';
  const port = isDevelopmentMode ? SERVER_PORT : window.location.port;
  
  // Construir y devolver la URL
  return `${protocol}//${host}:${port}/api/webrtc/${cameraType}`;
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
