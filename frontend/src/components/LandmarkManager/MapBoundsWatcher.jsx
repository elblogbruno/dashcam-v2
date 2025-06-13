import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Componente que observa y notifica cambios en los límites del mapa
 */
const MapBoundsWatcher = ({ onBoundsChange, onZoomChange }) => {
  const map = useMap();
  
  useEffect(() => {
    // Función para actualizar los límites
    const handleMapChange = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      
      // Notificar cambios de límites
      onBoundsChange({
        northEast: bounds.getNorthEast(),
        southWest: bounds.getSouthWest()
      });
      
      // Notificar cambios de zoom
      onZoomChange(zoom);
    };
    
    // Suscribirse a eventos de mapa
    map.on('moveend', handleMapChange);
    map.on('zoomend', handleMapChange);
    
    // Ejecutar una vez al inicio para obtener límites iniciales
    handleMapChange();
    
    // Limpiar al desmontar
    return () => {
      map.off('moveend', handleMapChange);
      map.off('zoomend', handleMapChange);
    };
  }, [map, onBoundsChange, onZoomChange]);
  
  return null; // Este componente no renderiza nada
};

// Asegurar una exportación por defecto clara
export default MapBoundsWatcher;
