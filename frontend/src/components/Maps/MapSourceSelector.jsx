import React, { useState, useEffect } from 'react';
import { FaGlobe, FaMapMarked, FaCaretDown, FaInfoCircle } from 'react-icons/fa';
import { showInfo } from '../../services/notificationService';
import OfflineMapsInfo from './OfflineMapsInfo';

/**
 * Componente que muestra un selector de fuente de mapa
 */
const MapSourceSelector = ({ 
  mapSource, 
  setMapSource,
  offlineMapsAvailable,
  tripId
}) => {
  const [showMapOptions, setShowMapOptions] = useState(false);
  const [mapSourceOptions, setMapSourceOptions] = useState(['online']);
  const [showOfflineInfo, setShowOfflineInfo] = useState(false);
  
  // Determinar qué opciones de mapa mostrar según la disponibilidad
  useEffect(() => {
    // Siempre mostrar ambas opciones, incluso si offline no está disponible aún
    // Esto permite al usuario seleccionar la preferencia para cuando estén disponibles
    const options = ['online', 'offline'];
    setMapSourceOptions(options);
  }, [offlineMapsAvailable]);
  
  // Obtener el icono según la fuente de mapa
  const getMapSourceIcon = () => {
    switch (mapSource) {
      case 'offline': return <FaMapMarked size={16} />;
      default: return <FaGlobe size={16} />;
    }
  };
  
  // Obtener el texto según la fuente de mapa
  const getMapSourceText = () => {
    switch (mapSource) {
      case 'offline': return 'Mapas OSM Offline';
      default: return 'Mapas Online';
    }
  };
  
  // Obtener el color del botón según la fuente
  const getButtonClass = () => {
    switch (mapSource) {
      case 'offline': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <button
          onClick={() => setShowMapOptions(!showMapOptions)}
          className={`${getButtonClass()} text-white px-3 py-2 rounded-md shadow-md flex items-center justify-center`}
          title="Cambiar fuente de mapas"
        >
          <span className="flex items-center">
            {getMapSourceIcon()}
            <span className="ml-2 text-sm">{getMapSourceText()}</span>
            <FaCaretDown className="ml-2" size={12} />
          </span>
        </button>
        
        {showMapOptions && (
          <div className="absolute mt-2 w-48 bg-white rounded-md shadow-lg overflow-hidden right-0">
            {mapSourceOptions.map((source) => (
              <button 
                key={source}
                onClick={() => {
                  setMapSource(source);
                  setShowMapOptions(false);
                  
                  // Guardar preferencia en localStorage
                  localStorage.setItem('preferredMapSource', source);
                  
                  // Mostrar notificación del cambio de mapa
                  const messages = {
                    'online': 'Usando mapas online (requiere conexión a Internet)',
                    'offline': 'Usando mapas offline descargados (OSM)'
                  };
                  
                  showInfo(messages[source] || 'Cambiando fuente de mapas...', {
                    title: 'Fuente de mapas',
                    timeout: 3000
                  });
                }}
                className={`w-full text-left px-4 py-2 text-sm ${
                  mapSource === source ? 'bg-gray-100 font-medium' : ''
                } hover:bg-gray-100 flex items-center`}
              >
                {source === 'offline' && <FaMapMarked className="mr-2" size={16} />}
                {source === 'online' && <FaGlobe className="mr-2" size={16} />}
                {source === 'offline' && 'Mapas OSM Offline'}
                {source === 'online' && 'Mapas Online'}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Botón de información para mapas offline */}
      {offlineMapsAvailable && (
        <div className="mt-2">
          <button
            onClick={() => setShowOfflineInfo(!showOfflineInfo)}
            className="text-xs flex items-center text-gray-600 hover:text-gray-800"
            title="Ver información de mapas offline"
          >
            <FaInfoCircle className="mr-1" />
            {showOfflineInfo ? 'Ocultar información' : 'Información de mapas offline'}
          </button>
        </div>
      )}
      
      {/* Panel de información de mapas offline */}
      <div className={`mt-2 transition-all duration-300 overflow-hidden ${showOfflineInfo ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <OfflineMapsInfo tripId={tripId} isVisible={showOfflineInfo} />
      </div>
    </div>
  );
};

export default MapSourceSelector;
