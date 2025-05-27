import React, { useEffect, useState, useCallback } from 'react';
import { TileLayer as LeafletTileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import offlineMapManager from '../../services/offlineMapService';
import { FaSignal } from 'react-icons/fa';
import { MdCloudQueue, MdWarning } from 'react-icons/md';
import PlaceholderTileAlert from './PlaceholderTileAlert';

/**
 * Componente TileLayer modificado que utiliza tiles offline cuando están disponibles
 */
const OfflineTileLayer = ({ url, tripId, preferredSource, onChangeMapSource, onAvailabilityChange, ...props }) => {
  const map = useMap();
  const [offlineAvailable, setOfflineAvailable] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [mapSource, setMapSource] = useState('online');
  const [customTileLayer, setCustomTileLayer] = useState(null);
  
  // Función para verificar disponibilidad de mapas offline
  const checkOfflineMaps = async () => {
    if (tripId) {
      try {
        console.log(`[OfflineTileLayer] Checking offline maps for trip ${tripId}...`);
        
        // Establecer el ID del viaje actual para el servicio de mapas offline
        offlineMapManager.setCurrentTripId(tripId);
        
        // Verificar si hay mapas offline disponibles para este viaje
        const hasOfflineMaps = await offlineMapManager.hasOfflineMapForTrip(tripId);
        setOfflineAvailable(hasOfflineMaps);
        console.log(`[OfflineTileLayer] Offline maps available for trip ${tripId}: ${hasOfflineMaps}`);
        
        // Notificar al componente padre sobre la disponibilidad de mapas
        if (onAvailabilityChange) {
          onAvailabilityChange('offline', hasOfflineMaps);
        }
        
        // Determinar qué fuente de mapas usar, respetando la preferencia si se proporciona
        let sourceToUse = 'online';
        
        if (preferredSource === 'auto') {
          if (hasOfflineMaps) {
            sourceToUse = 'offline';
          }
          console.log(`[OfflineTileLayer] Auto source selection chose: ${sourceToUse}`);
        } else if (
          (preferredSource === 'offline' && hasOfflineMaps) ||
          preferredSource === 'online'
        ) {
          sourceToUse = preferredSource;
          console.log(`[OfflineTileLayer] Using preferred source: ${sourceToUse}`);
        } else if (hasOfflineMaps) {
          sourceToUse = 'offline';
          console.log(`[OfflineTileLayer] Preferred source not available, falling back to offline`);
        } else {
          console.log(`[OfflineTileLayer] No offline maps available, using online source`);
        }
        
        setMapSource(sourceToUse);
        
        // Notificar al componente padre sobre el cambio de fuente
        if (onChangeMapSource) {
          onChangeMapSource(sourceToUse);
        }
        
        // Añadir información al mapa
        map.offlineAvailable = hasOfflineMaps;
        
        // Si hay mapas offline, forzar una actualización de los tiles
        if (hasOfflineMaps) {
          console.log(`[OfflineTileLayer] Maps available for trip ${tripId}: Using=${sourceToUse}`);
          setShowIndicator(true);
          setTimeout(() => setShowIndicator(false), 5000); // Ocultar después de 5 segundos
          
          map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
              layer.redraw();
            }
          });
        }
      } catch (error) {
        console.error('[OfflineTileLayer] Error checking offline maps:', error);
      }
    } else {
      console.log('[OfflineTileLayer] No tripId provided, cannot check for offline maps');
    }
  };
  
  // Efecto para cuando cambia la preferencia del usuario
  useEffect(() => {
    if (preferredSource && mapSource !== preferredSource) {
      console.log(`[OfflineTileLayer] Preferred source changed to ${preferredSource}, rechecking maps...`);
      checkOfflineMaps();
    }
  }, [preferredSource]);
  
  // Verificar disponibilidad de mapas offline al cargar el componente
  useEffect(() => {
    console.log(`[OfflineTileLayer] TripId changed to ${tripId}, checking maps...`);
    checkOfflineMaps();
  }, [tripId]);

  // Implementación de TileLayer personalizada con manejo de tiles offline/online
  useEffect(() => {
    console.log(`[OfflineTileLayer] Setting up custom tile layer with mapSource=${mapSource}`);
    
    // Si ya existe una capa, eliminarla primero
    if (customTileLayer) {
      map.removeLayer(customTileLayer);
    }
    
    // Crear un método personalizado de carga de tiles
    const customTileLayerClass = L.TileLayer.extend({
      createTile: function(coords, done) {
        const tile = document.createElement('img');
        
        // Añadir manejadores de eventos para detectar problemas de carga
        tile.onerror = function(e) {
          console.error(`[OfflineTileLayer] Error loading tile z=${coords.z}, x=${coords.x}, y=${coords.y}`);
          // Intentar con URL alternativa en caso de error
          if (mapSource === 'online') {
            const alternativeSubdomain = String.fromCharCode(97 + (Math.abs(coords.x + coords.y) % 3));
            const alternativeUrl = url
              .replace('{s}', alternativeSubdomain)
              .replace('{z}', coords.z)
              .replace('{x}', coords.x)
              .replace('{y}', coords.y);
            console.log(`[OfflineTileLayer] Retrying with alternative URL: ${alternativeUrl}`);
            tile.src = alternativeUrl;
          } else {
            // Si estamos en offline y falla, intentar online como respaldo
            const onlineUrl = url
              .replace('{s}', 'a')
              .replace('{z}', coords.z)
              .replace('{x}', coords.x)
              .replace('{y}', coords.y);
            console.log(`[OfflineTileLayer] Falling back to online: ${onlineUrl}`);
            tile.src = onlineUrl;
          }
          done(null, tile); // Seguir a pesar del error para evitar tiles grises
        };
        
        // Esta función se ejecutará para cada tile
        const loadTile = async () => {
          try {
            console.log(`[OfflineTileLayer] Creating tile for z=${coords.z}, x=${coords.x}, y=${coords.y}, source=${mapSource}`);
            let tileUrl = null;
            
            // Solo intentar cargar desde offline si la fuente es offline
            if (mapSource === 'offline' && tripId) {
              console.log(`[OfflineTileLayer] Attempting to get standard offline tile for z=${coords.z}, x=${coords.x}, y=${coords.y}`);
              tileUrl = await offlineMapManager.getTileUrl(coords);
              
              if (tileUrl) {
                console.log(`[OfflineTileLayer] ✓ Found standard offline tile for z=${coords.z}, x=${coords.x}, y=${coords.y}`);
              } else {
                console.log(`[OfflineTileLayer] ✗ No standard offline tile found for z=${coords.z}, x=${coords.x}, y=${coords.y}`);
              }
            }
            
            // Si estamos en modo online o no se encontró el tile offline, usar la URL online
            if (!tileUrl || mapSource === 'online') {
              // Usar un subdominio aleatorio para distribuir la carga
              const subdomain = String.fromCharCode(97 + (Math.abs(coords.x + coords.y) % 3)); // 'a', 'b', o 'c'
              
              tileUrl = url
                .replace('{s}', subdomain)
                .replace('{z}', coords.z)
                .replace('{x}', coords.x)
                .replace('{y}', coords.y);
              
              console.log(`[OfflineTileLayer] Using online tile: ${tileUrl}`);
            }
            
            tile.src = tileUrl;
            tile.alt = '';
            
            // Evento de carga exitosa
            tile.onload = function() {
              done(null, tile);
            };
            
          } catch (error) {
            console.error(`[OfflineTileLayer] Error loading tile:`, error);
            
            // En caso de error, intentar cargar desde OSM directamente
            const fallbackUrl = `https://a.tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
            console.log(`[OfflineTileLayer] Using fallback URL: ${fallbackUrl}`);
            tile.src = fallbackUrl;
            done(null, tile);
          }
        };
        
        loadTile();
        return tile;
      }
    });
    
    // Crear e instanciar la nueva capa con opciones adecuadas para OSM
    const newLayer = new customTileLayerClass(url, { 
      ...props,
      subdomains: 'abc',       // Subdominios estándar de OSM
      minZoom: 1,              // Nivel mínimo de zoom
      maxZoom: 19,             // Nivel máximo de zoom
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', // Tile transparente en caso de error
      crossOrigin: true        // Permitir CORS
    });
    
    newLayer.addTo(map);
    setCustomTileLayer(newLayer);
    
    // Añadir un evento para detectar cuando se completa la carga de tiles
    const tileLoadListener = () => {
      console.log('[OfflineTileLayer] All tiles loaded successfully');
    };
    
    newLayer.on('load', tileLoadListener);
    
    return () => {
      if (newLayer) {
        newLayer.off('load', tileLoadListener);
        map.removeLayer(newLayer);
      }
    };
  }, [mapSource, tripId, url, map]);
  
  return (
    <>
      {/* Ya no usamos LeafletTileLayer porque lo reemplazamos con nuestra implementación personalizada */}
      
      {/* Alerta de marcador de posición */}
      <PlaceholderTileAlert mapSource={mapSource} />
      
      {/* Indicador de fuente del mapa */}
      <div className="leaflet-bottom leaflet-left" style={{ zIndex: 1000, margin: '0 0 10px 10px' }}>
        <div className={`leaflet-control px-2 py-1 rounded-lg shadow-md flex items-center text-xs ${
          mapSource === 'offline'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-white'
        }`}>
          {mapSource === 'offline' ? (
            <>
              <FaSignal className="mr-1" /> Mapas offline
            </>
          ) : (
            <>
              <MdCloudQueue className="mr-1" /> Mapas online
            </>
          )}
        </div>
      </div>
      
      {/* Indicador de mapas offline */}
      {showIndicator && (offlineAvailable) && (
        <div className="leaflet-bottom leaflet-right" style={{ zIndex: 1000 }}>
          <div className="leaflet-control bg-green-600 text-white px-2 py-1 rounded-lg shadow-md flex items-center">
            <FaSignal className="mr-1" /> Mapas disponibles offline
          </div>
        </div>
      )}
      
      {/* Indicador de error de carga */}
      {mapSource === 'online' && (
        <div className="leaflet-top leaflet-center" style={{ zIndex: 1000, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0 }} 
             className="map-error-message">
          <div className="leaflet-control bg-red-600 text-white px-4 py-2 rounded-lg shadow-md text-center">
            <MdWarning className="inline-block mr-2" size={24} /> 
            Error al cargar los mapas. Comprueba tu conexión a internet.
          </div>
        </div>
      )}
    </>
  );
};

// Añadir estilos para la animación de error
const styleElement = document.createElement('style');
styleElement.innerHTML = `
  .map-error-message {
    animation: fadeInOut 5s ease-in-out forwards;
    opacity: 0;
  }
  
  @keyframes fadeInOut {
    0% { opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
document.head.appendChild(styleElement);

export default OfflineTileLayer;
