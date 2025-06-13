import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// MapController to programmatically control the map and track zoom
const MapController = ({ center, zoom, onZoomChange }) => {
  const map = useMap();

  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  useEffect(() => {
    const handleZoomEnd = () => {
      const currentZoom = map.getZoom();
      if (onZoomChange) {
        onZoomChange(currentZoom);
      }
    };

    map.on('zoomend', handleZoomEnd);
    
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onZoomChange]);
  
  return null;
};

export default MapController;
