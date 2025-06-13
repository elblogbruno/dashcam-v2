import React, { useState, useEffect } from 'react';
import { MdWarning, MdClose } from 'react-icons/md';

/**
 * Alerta que se muestra cuando se detecta que se están usando tiles
 * de marcador de posición en lugar de tiles reales de MWM.
 */
const PlaceholderTileAlert = ({ mapSource }) => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    // Solo mostrar la alerta si estamos en modo de mapa orgánico
    if (mapSource === 'organic') {
      // Comprobar si hay alguna bandera global establecida por el servicio
      const checkForPlaceholders = () => {
        if (window._organicMapPlaceholderDetected) {
          setVisible(true);
        }
      };
      
      // Comprobar ahora y después establecer un intervalo
      checkForPlaceholders();
      const interval = setInterval(checkForPlaceholders, 5000);
      
      return () => clearInterval(interval);
    } else {
      setVisible(false);
    }
  }, [mapSource]);
  
  if (!visible) return null;
  
  return (
    <div className="leaflet-top leaflet-right" style={{ zIndex: 35, margin: '10px 10px 0 0', maxWidth: '300px' }}>
      <div className="leaflet-control bg-yellow-100 border-2 border-yellow-400 p-3 rounded-lg shadow-md">
        <div className="flex items-start">
          <div className="mr-2 flex-shrink-0">
            <MdWarning className="text-yellow-500" size={20} />
          </div>
          <div className="flex-grow">
            <h4 className="text-sm font-bold text-yellow-700 mb-1">Mapas Organic en modo de prueba</h4>
            <p className="text-xs text-yellow-700">
              Los mapas Organic Maps están mostrando marcadores de posición en lugar de tiles reales.
              El backend no está extrayendo correctamente los datos de los archivos MWM.
            </p>
          </div>
          <button 
            className="ml-2 text-gray-500 hover:text-gray-700 flex-shrink-0" 
            onClick={() => setVisible(false)}
          >
            <MdClose size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderTileAlert;
