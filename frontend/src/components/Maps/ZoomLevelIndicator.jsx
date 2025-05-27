import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import './ZoomLevelIndicator.css';

/**
 * Componente que muestra el nivel de zoom actual en el mapa
 * Aparece como un pequeño indicador en la esquina del mapa
 */
const ZoomLevelIndicator = ({ position = 'bottomright', showAlways = false }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map ? map.getZoom() : 0);
  const [visible, setVisible] = useState(true); // Siempre comenzar visible
  const [expanded, setExpanded] = useState(false);
  const [animating, setAnimating] = useState(false);
  
  // Actualizar el nivel de zoom cuando cambia
  useEffect(() => {
    if (!map) return;
    
    const updateZoom = () => {
      setZoom(map.getZoom());
      // Añadir animación
      setAnimating(true);
      setTimeout(() => setAnimating(false), 300);
      
      // Si no es siempre visible, mostrar temporalmente
      if (!showAlways) {
        setVisible(true);
        // Ocultar después de 2 segundos
        setTimeout(() => setVisible(false), 2000);
      }
    };
    
    map.on('zoom', updateZoom);
    map.on('zoomend', updateZoom);
    
    // Inicializar
    updateZoom();
    
    return () => {
      map.off('zoom', updateZoom);
      map.off('zoomend', updateZoom);
    };
  }, [map, showAlways]);
  
  // Alternar el estado expandido
  const toggleExpanded = () => {
    setExpanded(!expanded);
    // Si no es siempre visible, reiniciar el temporizador
    if (!showAlways) {
      setVisible(true);
      clearTimeout(window.zoomIndicatorTimeout);
      window.zoomIndicatorTimeout = setTimeout(() => setVisible(false), 4000);
    }
  };
  
  // Si se proporciona posición, usar la clase correspondiente, de lo contrario no añadir clase de posición
  const positionClass = position ? `leaflet-${position}` : '';
  
  return (
    <div className={`${positionClass} leaflet-zoom-indicator ${(visible || showAlways) ? 'visible' : ''}`}>
      {(visible || showAlways) && (
        <div 
          className={`leaflet-control bg-white cursor-pointer ${animating ? 'pulse-animation' : ''}`}
          onClick={toggleExpanded}
        >
          <div className="flex items-center justify-center">
            <span className="mr-1">Zoom:</span>
            <span className="font-bold">{Math.round(zoom * 10) / 10}</span>
            <span className="ml-1 text-xs">
              {expanded ? '▼' : '▶'}
            </span>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {zoom >= 18 ? 'Detalle máximo' : 
             zoom >= 15 ? 'Calles detalladas' : 
             zoom >= 12 ? 'Vecindarios' : 
             zoom >= 9 ? 'Ciudades' : 
             zoom >= 6 ? 'Regiones' : 'Vista general'}
          </div>
          
          {expanded && (
            <div className="mt-2 border-t pt-2 text-xs">
              <div>Categoría: {
                zoom >= 18 ? 'Urbano detallado' : 
                zoom >= 15 ? 'Urbano general' : 
                zoom >= 12 ? 'Suburbano' : 
                zoom >= 9 ? 'Rural' :
                'Regional'
              }</div>
              <div className="mt-1">Niveles de zoom:</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {[6, 8, 10, 12, 14, 16, 18].map(level => (
                  <div 
                    key={level}
                    className={`px-1.5 py-0.5 rounded-sm cursor-pointer hover:bg-gray-200 ${Math.round(zoom) === level ? 'bg-blue-200' : 'bg-gray-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      map.setZoom(level);
                    }}
                  >
                    {level}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZoomLevelIndicator;
