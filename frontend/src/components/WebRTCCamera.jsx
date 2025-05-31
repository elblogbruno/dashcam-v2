import { useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Componente WebRTCCamera - COMPLETELY DISABLED
 * 
 * Este componente ha sido deshabilitado completamente.
 * WebRTC no está disponible y el componente mostrará un mensaje de error.
 * No realiza ninguna conexión WebSocket ni WebRTC.
 */
function WebRTCCamera({ cameraType, width = '100%', height = '100%', className = '', onError, showStats = false }) {
  // Componente completamente deshabilitado - no hay estado interno ni conexiones
  useEffect(() => {
    const error = new Error('WebRTC functionality has been disabled');
    console.warn(`WebRTCCamera component is disabled for ${cameraType}:`, error.message);
    if (onError) {
      onError(error);
    }
  }, [cameraType, onError]);

  // Solo renderizar mensaje de error sin ninguna funcionalidad
  return (
    <div 
      className={`flex items-center justify-center bg-gray-800 text-white ${className}`}
      style={{ width, height }}
    >
      <div className="text-center p-4">
        <div className="text-yellow-500 text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold mb-2">WebRTC Deshabilitado</h3>
        <p className="text-sm text-gray-300 mb-2">
          El streaming WebRTC ha sido deshabilitado en este sistema.
        </p>
        <p className="text-xs text-gray-400 mb-1">
          Cámara: {cameraType}
        </p>
        <p className="text-xs text-gray-400">
          Use MJPEG o HTTP para visualizar las cámaras.
        </p>
      </div>
    </div>
  );
}

WebRTCCamera.propTypes = {
  cameraType: PropTypes.string.isRequired,
  width: PropTypes.string,
  height: PropTypes.string,
  className: PropTypes.string,
  onError: PropTypes.func,
  showStats: PropTypes.bool
};

export default WebRTCCamera;