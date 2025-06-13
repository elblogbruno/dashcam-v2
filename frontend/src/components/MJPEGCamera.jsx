import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigation } from '../contexts/NavigationContext';
import MJPEGStreamPlayer from './MJPEGStreamPlayer';
import axios from 'axios';

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
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
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
  
  // Función para obtener el estado actual del streaming
  const checkStreamingStatus = useCallback(async () => {
    try {
      const apiBase = window.location.port === '5173' 
        ? `http://${window.location.hostname}:8000/api` 
        : '/api';
      
      const response = await axios.get(`${apiBase}/mjpeg/status`);
      if (response.data && response.data.streaming_enabled) {
        setStreamingEnabled(response.data.streaming_enabled[cameraType] || false);
      }
    } catch (error) {
      console.error(`Error al obtener estado del streaming para ${cameraType}:`, error);
    }
  }, [cameraType]);
  
  // Función para alternar el estado del streaming
  const toggleStreaming = useCallback(async () => {
    try {
      setIsLoading(true);
      const apiBase = window.location.port === '5173' 
        ? `http://${window.location.hostname}:8000/api` 
        : '/api';
      
      const response = await axios.post(`${apiBase}/mjpeg/toggle/${cameraType}`);
      if (response.data && response.data.status === 'ok') {
        setStreamingEnabled(response.data.enabled);
      }
    } catch (error) {
      console.error(`Error al alternar streaming para ${cameraType}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [cameraType]);
  
  // Reiniciar contadores cuando la conexión es exitosa
  const handleSuccess = useCallback(() => {
    if (lastError || connectionAttempts > 0) {
      console.log(`[MJPEGCamera-${cameraType}] Conexión restablecida exitosamente`);
      setLastError(null);
      setConnectionAttempts(0);
    }
  }, [cameraType, lastError, connectionAttempts]);

  // Manejar errores de conexión para actualizar el estado
  const handleError = useCallback((error) => {
    console.error(`[MJPEGCamera-${cameraType}] Error de conexión:`, error);
    setLastError(error);
    setConnectionAttempts(prev => prev + 1);
    
    // Notificar al componente padre si existe un callback de error
    if (onError) {
      onError(error, cameraType, connectionAttempts + 1);
    }
  }, [cameraType, connectionAttempts, onError]);
  
  // Log de cambios de estado importantes
  useEffect(() => {
    console.log(`[MJPEGCamera-${cameraType}] Estado actualizado:`, {
      shouldStreamBeActive,
      currentRoute,
      connectionAttempts,
      hasError: !!lastError
    });
  }, [shouldStreamBeActive, currentRoute, connectionAttempts, lastError, cameraType]);
  
  // Verificar estado inicial del streaming
  useEffect(() => {
    checkStreamingStatus();
  }, [checkStreamingStatus]);
  
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
        key={streamKey}
      />
      
      {/* Controles reposicionados para evitar superposiciones */}
      <div className="absolute top-2 left-2 z-20">
        <button
          onClick={toggleStreaming}
          disabled={isLoading}
          className={`flex items-center px-2 py-1 rounded text-xs text-white ${
            streamingEnabled 
            ? 'bg-red-600 hover:bg-red-700' 
            : 'bg-green-600 hover:bg-green-700'
          }`}
          style={{ transition: 'background-color 0.2s' }}
        >
          {isLoading ? (
            <span className="inline-block animate-spin mr-1">⟳</span>
          ) : streamingEnabled ? (
            <span>■ Detener</span>
          ) : (
            <span>▶ Activar</span>
          )}
        </button>
      </div>
      
      {connectionAttempts > 0 && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded z-30">
          {connectionAttempts > 3 ? '⚠️' : '🔄'} {connectionAttempts}
        </div>
      )}
      
      <div className={`absolute bottom-2 left-2 ${
        streamingEnabled ? 'bg-green-600' : 'bg-gray-600'
      } bg-opacity-70 text-white text-xs px-2 py-1 rounded z-30`}>
        {streamingEnabled ? '🚀 Activo' : '⏸️ Pausado'}
      </div>
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
