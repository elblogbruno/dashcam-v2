// filepath: /root/dashcam-v2/frontend/src/components/LandmarkManager/LandmarkMap.jsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { MapContainer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// import { FaEdit, FaTrash, FaMapMarkerAlt } from 'react-icons/fa';
// import { Button } from '../common/UI';
import OfflineTileLayer from '../Maps/OfflineTileLayer';
// import LandmarkMarker from '../Maps/LandmarkMarker';
import MapController from './MapController';
// import { createColoredIcon } from './MapIcons'; 
import MapLoadingIndicator from './MapLoadingIndicator';
import MapBoundsWatcher from './MapBoundsWatcher';

import LandmarkClusterGroup from './LandmarkClusterGroup';

const LandmarkMap = ({ 
  landmarks, 
  mapCenter, 
  mapZoom, 
  selectedLandmark, 
  onLandmarkSelect, 
  onLandmarkEdit, 
  onLandmarkDelete,
  onZoomChange,
  onMapClick,
  tripRoute = null
}) => {
  // Estado para el zoom actual
  const [currentVisibleZoom, setCurrentVisibleZoom] = useState(mapZoom);
  // Estado para indicar cuando los landmarks se están filtrando/cargando
  const [isFiltering, setIsFiltering] = useState(false);
  // Estado para mantener la vista actual del mapa
  const [mapBounds, setMapBounds] = useState(null);
  // Estado para evitar excesivas re-renderizaciones
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Color mapping for different categories
  const categoryColors = {
    'gas-station': '#FF6B6B',
    'restaurant': '#4ECDC4',
    'hotel': '#45B7D1',
    'attraction': '#96CEB4',
    'rest-area': '#FFEAA7',
    'emergency': '#FF7675',
    'default': '#74B9FF'
  };

  const getMarkerColor = useCallback((landmark) => {
    return categoryColors[landmark.category] || categoryColors.default;
  }, [categoryColors]);
  
  // Función de log para facilitar el debug
  const logMapDebug = (message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    console.log(`[${timestamp}][LandmarkMap] ${message}`, data || '');
  };
  
  // Memoizar el filtrado de landmarks para optimizar rendimiento
  const visibleLandmarks = useMemo(() => {
    logMapDebug(`Recalculando landmarks visibles. Total disponible: ${landmarks?.length || 0}`);
    
    if (!landmarks || landmarks.length === 0) {
      logMapDebug('No hay landmarks disponibles');
      return [];
    }
    
    try {
      // Si hay un landmark seleccionado, siempre mostrarlo
      const hasSelected = !!selectedLandmark;
      let result = [];
      
      // Optimización: filtrar por bounds primero si están disponibles
      let candidateLandmarks = landmarks;
      if (mapBounds && mapBounds.northEast && mapBounds.southWest) {
        const expandFactor = 0.2; // 20% de expansión para mejor UX
        const latDiff = mapBounds.northEast.lat - mapBounds.southWest.lat;
        const lngDiff = mapBounds.northEast.lng - mapBounds.southWest.lng;
        
        const expandedBounds = {
          northEast: {
            lat: mapBounds.northEast.lat + (latDiff * expandFactor),
            lng: mapBounds.northEast.lng + (lngDiff * expandFactor)
          },
          southWest: {
            lat: mapBounds.southWest.lat - (latDiff * expandFactor),
            lng: mapBounds.southWest.lng - (lngDiff * expandFactor)
          }
        };
        
        candidateLandmarks = landmarks.filter(landmark => {
          if (!landmark.lat || !landmark.lon) return false;
          return landmark.lat >= expandedBounds.southWest.lat &&
                 landmark.lat <= expandedBounds.northEast.lat &&
                 landmark.lon >= expandedBounds.southWest.lng &&
                 landmark.lon <= expandedBounds.northEast.lng;
        });
        
        // Siempre incluir el landmark seleccionado
        if (hasSelected && !candidateLandmarks.some(l => l.id === selectedLandmark.id)) {
          const selectedLandmarkData = landmarks.find(l => l.id === selectedLandmark.id);
          if (selectedLandmarkData) {
            candidateLandmarks.unshift(selectedLandmarkData);
          }
        }
      }
      
      // Aplicar límites basados en zoom para rendimiento
      const maxLandmarksByZoom = {
        5: 100,   // Zoom muy bajo - vista país
        8: 200,   // Zoom bajo - vista región  
        10: 400,  // Zoom medio - vista ciudad
        13: 800,  // Zoom alto - vista detalle
        18: 1500  // Zoom máximo - sin límite práctico
      };
      
      let maxLandmarks = 1500; // Por defecto
      for (const [zoom, limit] of Object.entries(maxLandmarksByZoom)) {
        if (currentVisibleZoom <= parseInt(zoom)) {
          maxLandmarks = limit;
          break;
        }
      }
      
      if (candidateLandmarks.length <= maxLandmarks) {
        result = candidateLandmarks;
      } else {
        // Priorizar landmarks importantes
        const importantLandmarks = candidateLandmarks.filter(l => 
          (hasSelected && l.id === selectedLandmark.id) ||
          l.category === 'emergency' || 
          l.trip_count > 2 ||
          l.category === 'hotel' ||
          l.category === 'gas-station'
        );
        
        if (importantLandmarks.length >= maxLandmarks) {
          result = importantLandmarks.slice(0, maxLandmarks);
        } else {
          const remaining = maxLandmarks - importantLandmarks.length;
          const otherLandmarks = candidateLandmarks
            .filter(l => !importantLandmarks.some(imp => imp.id === l.id))
            .slice(0, remaining);
          
          result = [...importantLandmarks, ...otherLandmarks];
        }
      }
      
      logMapDebug(`Filtrado completado. Mostrando ${result.length} de ${candidateLandmarks.length} candidatos (zoom: ${currentVisibleZoom})`);
      setIsFiltering(false);
      return result;
      
    } catch (error) {
      console.error("Error al filtrar landmarks:", error);
      logMapDebug(`ERROR durante el filtrado: ${error.message}`);
      setIsFiltering(false);
      return landmarks.slice(0, 200); // Fallback seguro
    }
  }, [landmarks, currentVisibleZoom, selectedLandmark, mapBounds]);

  // Efecto para manejar el estado de filtrado
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => setIsFiltering(false), 500);
    return () => clearTimeout(timer);
  }, [landmarks, currentVisibleZoom, selectedLandmark, mapBounds]);

  return (
    <div className="w-full absolute inset-0" style={{ height: '100%' }}>
      <MapLoadingIndicator loading={isFiltering} count={landmarks.length} />
      
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        onClick={onMapClick}
        className="z-0"
        preferCanvas={true}
        maxBoundsViscosity={1.0}
        zoomAnimation={true}
        markerZoomAnimation={true}
        trackResize={true}
        maxZoom={18}
        minZoom={5}
      >
        <OfflineTileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapController 
          center={mapCenter} 
          zoom={mapZoom} 
          onZoomChange={onZoomChange}
        />
        
        <MapBoundsWatcher 
          onBoundsChange={setMapBounds}
          onZoomChange={setCurrentVisibleZoom}
        />

        {/* Trip route if provided */}
        {tripRoute && tripRoute.length > 0 && (
          <>
            {tripRoute.map((point, index) => (
              <Circle
                key={`route-point-${index}`}
                center={[point.lat, point.lon]}
                radius={5}
                pathOptions={{ 
                  color: '#007bff', 
                  fillColor: '#007bff',
                  fillOpacity: 0.8,
                  weight: 2
                }}
              />
            ))}
          </>
        )}

        {/* Landmark markers with clustering */}
        <LandmarkClusterGroup
          landmarks={visibleLandmarks}
          zoomLevel={currentVisibleZoom}
          mapBounds={mapBounds}
          onLandmarkSelect={onLandmarkSelect}
          onLandmarkEdit={onLandmarkEdit}
          onLandmarkDelete={onLandmarkDelete}
          selectedLandmark={selectedLandmark}
        />
        
        {/* Mensaje cuando no hay landmarks visibles */}
        {visibleLandmarks.length === 0 && !isFiltering && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                        bg-white bg-opacity-75 p-3 rounded-lg shadow-md z-[1000] pointer-events-none">
            <div className="text-center text-gray-700 font-medium">
              No hay landmarks visibles en esta área.
              <br />
              <span className="text-sm">Intenta hacer zoom o moverse por el mapa</span>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
};

export default LandmarkMap;
