import { useState, useCallback } from 'react';

export const useLandmarkMap = () => {
  const [mapCenter, setMapCenter] = useState([34.0522, -118.2437]);
  const [mapZoom, setMapZoom] = useState(5);
  const [currentZoom, setCurrentZoom] = useState(5);

  const handleZoomChange = useCallback((zoom) => {
    setCurrentZoom(zoom);
  }, []);

  const handleMapClick = useCallback((e) => {
    // You can add logic here for map click events
    console.log('Map clicked at:', e.latlng);
  }, []);

  const centerMapOnLandmark = useCallback((landmark) => {
    setMapCenter([landmark.lat, landmark.lon]);
    setMapZoom(15);
  }, []);

  const resetMapView = useCallback(() => {
    setMapCenter([34.0522, -118.2437]);
    setMapZoom(5);
  }, []);

  return {
    mapCenter,
    mapZoom,
    currentZoom,
    setMapCenter,
    setMapZoom,
    handleZoomChange,
    handleMapClick,
    centerMapOnLandmark,
    resetMapView
  };
};
