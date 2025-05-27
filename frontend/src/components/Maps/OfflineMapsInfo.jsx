import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import offlineMapManager from '../../services/offlineMapService';
import { showError } from '../../services/notificationService';

/**
 * Componente para mostrar información sobre los mapas offline
 */
const OfflineMapsInfo = ({ tripId, isVisible }) => {
  const [statusInfo, setStatusInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const fetchStatus = async () => {
    if (!tripId) return;
    
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      const response = await fetch(`${API_BASE_URL}/offline-maps/status/${tripId}`);
      
      if (!response.ok) {
        throw new Error(`Error al obtener el estado: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatusInfo(data);
    } catch (error) {
      console.error('Error obteniendo el estado de los mapas offline:', error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Efecto para cargar el estado cuando cambia el viaje
  useEffect(() => {
    if (isVisible && tripId) {
      fetchStatus();
      
      // Actualizar cada 5 segundos mientras el estado sea "in_progress"
      const interval = setInterval(() => {
        if (statusInfo?.status === 'in_progress') {
          fetchStatus();
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isVisible, tripId, statusInfo?.status]);
  
  if (!isVisible || !tripId) return null;
  
  // Renderizar un spinner mientras carga
  if (isLoading && !statusInfo) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-center">
          <div className="w-5 h-5 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
          <span className="ml-2">Cargando información...</span>
        </div>
      </div>
    );
  }
  
  // Renderizar un mensaje de error si hay uno
  if (errorMessage) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="text-red-500 font-medium">Error: {errorMessage}</div>
        <button 
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={fetchStatus}
        >
          Reintentar
        </button>
      </div>
    );
  }
  
  // Si no hay información de estado, mostrar un mensaje
  if (!statusInfo) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="text-gray-700">No hay información disponible sobre mapas offline para este viaje.</div>
      </div>
    );
  }
  
  // Si el estado es "not_found", ofrecer la opción de descargar
  if (statusInfo.status === 'not_found') {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="text-gray-700 mb-2">No hay mapas offline para este viaje.</div>
        <button 
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={() => offlineMapManager.downloadMapsForTrip(tripId)}
        >
          Descargar mapas offline
        </button>
      </div>
    );
  }
  
  // Renderizar la información de estado
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-2">Mapas Offline</h3>
      
      <div className="space-y-2">
        {/* Estado */}
        <div className="flex justify-between">
          <span className="text-gray-600">Estado:</span>
          <span className={`font-medium ${
            statusInfo.status === 'completed' ? 'text-green-500' : 
            statusInfo.status === 'failed' ? 'text-red-500' : 
            statusInfo.status === 'in_progress' ? 'text-blue-500' : 'text-gray-700'
          }`}>
            {statusInfo.status === 'completed' ? 'Completado' : 
             statusInfo.status === 'failed' ? 'Fallido' : 
             statusInfo.status === 'in_progress' ? 'En progreso' : statusInfo.status}
          </span>
        </div>
        
        {/* Progreso */}
        {statusInfo.progress !== undefined && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Progreso:</span>
              <span className="font-medium">{Math.round(statusInfo.progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${
                  statusInfo.status === 'completed' ? 'bg-green-500' : 
                  statusInfo.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                }`} 
                style={{ width: `${statusInfo.progress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Estadísticas */}
        <div className="flex justify-between">
          <span className="text-gray-600">Tiles descargados:</span>
          <span className="font-medium">{statusInfo.downloaded_tiles} / {statusInfo.total_tiles}</span>
        </div>
        
        {/* Tiles fallidos */}
        {statusInfo.failed_tiles > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Tiles fallidos:</span>
            <span className="font-medium text-red-500">{statusInfo.failed_tiles}</span>
          </div>
        )}
        
        {/* Tamaño estimado */}
        {statusInfo.estimated_size_mb && (
          <div className="flex justify-between">
            <span className="text-gray-600">Tamaño estimado:</span>
            <span className="font-medium">{statusInfo.estimated_size_mb} MB</span>
          </div>
        )}
        
        {/* Niveles de zoom */}
        {statusInfo.zoom_levels && statusInfo.zoom_levels.length > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Niveles de zoom:</span>
            <span className="font-medium">{statusInfo.zoom_levels.join(', ')}</span>
          </div>
        )}
        
        {/* Fecha de inicio */}
        {statusInfo.download_started && (
          <div className="flex justify-between">
            <span className="text-gray-600">Inicio:</span>
            <span className="font-medium">{new Date(statusInfo.download_started).toLocaleString()}</span>
          </div>
        )}
        
        {/* Fecha de finalización */}
        {statusInfo.download_completed && (
          <div className="flex justify-between">
            <span className="text-gray-600">Finalización:</span>
            <span className="font-medium">{new Date(statusInfo.download_completed).toLocaleString()}</span>
          </div>
        )}
        
        {/* Error */}
        {statusInfo.error && (
          <div className="mt-2">
            <span className="text-red-500 block">Error: {statusInfo.error}</span>
          </div>
        )}
      </div>
      
      {/* Botones de acción */}
      <div className="mt-4 flex justify-end space-x-2">
        <button 
          className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          onClick={fetchStatus}
        >
          Actualizar
        </button>
        
        {statusInfo.status === 'completed' && (
          <button 
            className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE_URL}/offline-maps/${tripId}`, {
                  method: 'DELETE'
                });
                
                if (!response.ok) {
                  throw new Error(`Error al eliminar: ${response.statusText}`);
                }
                
                await fetchStatus();
              } catch (error) {
                console.error('Error eliminando mapas offline:', error);
                showError(`Error al eliminar mapas offline: ${error.message}`);
              }
            }}
          >
            Eliminar
          </button>
        )}
        
        {statusInfo.status === 'failed' && (
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            onClick={() => offlineMapManager.downloadMapsForTrip(tripId)}
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineMapsInfo;
