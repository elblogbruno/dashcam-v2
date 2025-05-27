import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigation } from '../contexts/NavigationContext';
import MJPEGStreamPlayer from './MJPEGStreamPlayer';

/**
 * Componente optimizado para mostrar una cámara utilizando streaming MJPEG
 * 
 * Este componente muestra un stream MJPEG de baja latencia directamente
 * desde el servidor, con optimizaciones avanzadas para latencia y gestión de recursos.
 */
function MJPEGCamera({ cameraType, width = '100%', height = '100%', className = '', onError, showStats = false }) {
  const { shouldStreamBeActive, currentRoute } = useNavigation();
  // Estado para controlar errores y estadísticas
  const [lastError, setLastError] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  // URL del stream optimizada con parámetros avanzados
  const streamUrl = useMemo(() => {
    // Determinar si estamos en modo desarrollo
    const baseUrl = window.location.port === '5173' 
      ? `http://${window.location.hostname}:8000/api/mjpeg/stream/${cameraType}` 
      : `/api/mjpeg/stream/${cameraType}`;
      
    // Parámetros optimizados para reducir latencia
    const optimizationParams = {
      component: 'MJPEGCamera',
      stableId: cameraType,
      lowLatency: 'true',
      adaptiveQuality: 'true',
      routeAware: shouldStreamBeActive ? 'active' : 'inactive',
      initTimestamp: Date.now()
    };
    
    const paramString = Object.entries(optimizationParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
      
    return `${baseUrl}?${paramString}`;
  }, [cameraType, shouldStreamBeActive]);
  
  // Manejador de errores mejorado
  const handleError = useCallback((error) => {
    console.error(`[MJPEGCamera-${cameraType}] Error:`, error);
    setLastError(error);
    setConnectionAttempts(prev => prev + 1);
    
    if (onError) {
      onError(error);
    }
  }, [cameraType, onError]);
  
  // Reiniciar contadores cuando la conexión es exitosa
  const handleSuccess = useCallback(() => {
    if (lastError || connectionAttempts > 0) {
      console.log(`[MJPEGCamera-${cameraType}] Conexión restablecida exitosamente`);
      setLastError(null);
      setConnectionAttempts(0);
    }
  }, [cameraType, lastError, connectionAttempts]);
  
  // Log de cambios de estado importantes
  useEffect(() => {
    console.log(`[MJPEGCamera-${cameraType}] Estado actualizado:`, {
      shouldStreamBeActive,
      currentRoute,
      connectionAttempts,
      hasError: !!lastError
    });
  }, [shouldStreamBeActive, currentRoute, connectionAttempts, lastError, cameraType]);
  
  // Estado para mantener una instancia estable del componente
  // Usamos una clave que incluye información de estado para optimizar re-renders
  const streamKey = useMemo(() => 
    `${cameraType}-optimized-${shouldStreamBeActive ? 'active' : 'inactive'}`, 
    [cameraType, shouldStreamBeActive]
  );
  
  return (
    <div
      className={`mjpeg-camera relative ${className}`}
      style={{
        width,
        height,
        overflow: 'hidden',
        backgroundColor: 'black',
        border: connectionAttempts > 3 ? '2px solid orange' : 'none'
      }}
      title={`Cámara ${cameraType} - Intentos: ${connectionAttempts}${lastError ? ` - Error: ${lastError.message}` : ''}`}
    >
      <MJPEGStreamPlayer
        streamUrl={streamUrl} 
        width="100%"
        height="100%"
        onError={handleError}
        showStats={showStats}
        cameraType={cameraType}
        // Usamos una key que refleje el estado de optimización
        key={streamKey}
      />
      
      {/* Indicador de estado de conexión */}
      {connectionAttempts > 0 && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded z-30">
          {connectionAttempts > 3 ? '⚠️' : '🔄'} {connectionAttempts}
        </div>
      )}
      
      {/* Indicador de optimizaciones activas */}
      {shouldStreamBeActive && showStats && (
        <div className="absolute bottom-2 left-2 bg-green-600 bg-opacity-70 text-white text-xs px-2 py-1 rounded z-30">
          🚀 Optimizado
        </div>
      )}
    </div>
  );
}

MJPEGCamera.propTypes = {
  cameraType: PropTypes.oneOf(['road', 'interior']).isRequired,
  width: PropTypes.string,
  height: PropTypes.string,
  className: PropTypes.string,
  onError: PropTypes.func,
  showStats: PropTypes.bool
};

export default MJPEGCamera;
