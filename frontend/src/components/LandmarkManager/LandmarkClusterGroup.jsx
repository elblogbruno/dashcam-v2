import React, { useMemo, useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import LandmarkMarker from '../Maps/LandmarkMarker';

// Función de clustering eficiente usando una grilla espacial
const clusterLandmarks = (landmarks, zoomLevel, mapBounds) => {
  // Calcular el tamaño de la celda basado en el zoom
  const cellSize = Math.max(0.001, 0.1 / Math.pow(2, zoomLevel - 8));
  const clusters = new Map();
  
  landmarks.forEach(landmark => {
    if (!landmark.lat || !landmark.lon) return;
    
    // Calcular la celda para este landmark
    const cellX = Math.floor(landmark.lon / cellSize);
    const cellY = Math.floor(landmark.lat / cellSize);
    const cellKey = `${cellX},${cellY}`;
    
    if (!clusters.has(cellKey)) {
      clusters.set(cellKey, {
        landmarks: [],
        center: { lat: landmark.lat, lng: landmark.lon },
        bounds: {
          minLat: landmark.lat,
          maxLat: landmark.lat,
          minLng: landmark.lon,
          maxLng: landmark.lon
        }
      });
    }
    
    const cluster = clusters.get(cellKey);
    cluster.landmarks.push(landmark);
    
    // Actualizar bounds del cluster
    cluster.bounds.minLat = Math.min(cluster.bounds.minLat, landmark.lat);
    cluster.bounds.maxLat = Math.max(cluster.bounds.maxLat, landmark.lat);
    cluster.bounds.minLng = Math.min(cluster.bounds.minLng, landmark.lon);
    cluster.bounds.maxLng = Math.max(cluster.bounds.maxLng, landmark.lon);
    
    // Actualizar centro del cluster (promedio)
    const totalLat = cluster.landmarks.reduce((sum, l) => sum + l.lat, 0);
    const totalLng = cluster.landmarks.reduce((sum, l) => sum + l.lon, 0);
    cluster.center = {
      lat: totalLat / cluster.landmarks.length,
      lng: totalLng / cluster.landmarks.length
    };
  });
  
  return Array.from(clusters.values());
};

// Crear icono de cluster personalizado
const createClusterIcon = (count, categoryColors) => {
    const size = Math.min(60, Math.max(30, 25 + Math.log(count) * 5)); // Aumentar tamaño base y máximo
    
    return L.divIcon({
        html: `
            <div style="
                background-color: rgba(74, 144, 226, 0.8);
                color: white;
                border: 2.5px solid white;
                border-radius: 50%;
                width: ${size}px;
                height: ${size}px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${Math.max(14, size * 0.45)}px;
                font-weight: bold;
                box-shadow: 0 3px 6px rgba(0,0,0,0.35);
            ">
                ${count}
            </div>
        `,
        className: 'landmark-cluster-icon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
};

const LandmarkClusterGroup = ({ 
  landmarks, 
  zoomLevel, 
  mapBounds,
  onLandmarkSelect,
  onLandmarkEdit,
  onLandmarkDelete,
  selectedLandmark 
}) => {
  const map = useMap();
  const markersRef = useRef(new Map()); // Para rastrear los marcadores y limpiarlos correctamente
  
  // Configuración de clustering basada en zoom
  const shouldCluster = zoomLevel < 13;
  const minClusterSize = zoomLevel < 8 ? 3 : 2;
  
  const clusteredData = useMemo(() => {
    if (!shouldCluster || landmarks.length < minClusterSize) {
      return { clusters: [], individuals: landmarks };
    }
    
    const clusters = clusterLandmarks(landmarks, zoomLevel, mapBounds);
    const individuals = [];
    const clusterGroups = [];
    
    clusters.forEach(cluster => {
      if (cluster.landmarks.length >= minClusterSize) {
        clusterGroups.push(cluster);
      } else {
        individuals.push(...cluster.landmarks);
      }
    });
    
    return { clusters: clusterGroups, individuals };
  }, [landmarks, zoomLevel, mapBounds, shouldCluster, minClusterSize]);
  
  const handleClusterClick = (cluster) => {
    if (!map) return;
    
    try {
      // Calcular bounds del cluster con padding
      const bounds = L.latLngBounds([
        [cluster.bounds.minLat, cluster.bounds.minLng],
        [cluster.bounds.maxLat, cluster.bounds.maxLng]
      ]);
      
      // Añadir padding para mejor visualización
      const paddedBounds = bounds.pad(0.1);
      map.fitBounds(paddedBounds);
    } catch (error) {
      console.warn('Error handling cluster click:', error);
    }
  };

  // Cleanup effect para evitar memory leaks
  useEffect(() => {
    return () => {
      markersRef.current.clear();
    };
  }, []);
  
  return (
    <>
      {/* Renderizar clusters */}
      {clusteredData.clusters.map((cluster, index) => {
        const clusterKey = `cluster-${index}-${cluster.landmarks.length}`;
        return (
          <Marker
            key={clusterKey}
            position={cluster.center}
            icon={createClusterIcon(cluster.landmarks.length)}
            eventHandlers={{
              click: () => handleClusterClick(cluster)
            }}
          />
        );
      })}
      
      {/* Renderizar landmarks individuales */}
      {clusteredData.individuals.map(landmark => {
        if (!landmark.id || !landmark.lat || !landmark.lon) return null;
        
        return (
          <LandmarkMarker
            key={`landmark-${landmark.id}`}
            landmark={landmark}
            isSelected={selectedLandmark?.id === landmark.id}
            onSelect={onLandmarkSelect}
            onEdit={onLandmarkEdit}
            onDelete={onLandmarkDelete}
          />
        );
      })}
    </>
  );
};
export default LandmarkClusterGroup;
