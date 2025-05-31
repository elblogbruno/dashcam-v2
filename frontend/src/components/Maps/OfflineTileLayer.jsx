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
  const [mbtilesAvailable, setMbtilesAvailable] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [mapSource, setMapSource] = useState('online');
  const [customTileLayer, setCustomTileLayer] = useState(null);
  // Nuevo estado para controlar cuando mostrar el error
  const [showMapError, setShowMapError] = useState(false);
  // Contador de errores de carga
  const [tileErrorCount, setTileErrorCount] = useState(0);
  
  // Función para verificar disponibilidad de archivos .mbtiles
  const checkMbtilesAvailability = async () => {
    try {
      console.log('[OfflineTileLayer] Checking for .mbtiles files...');
      // Verificar si hay archivos .mbtiles en el servidor
      const response = await fetch('/api/offline-maps/mbtiles-list');
      if (response.ok) {
        const data = await response.json();
        const hasMbtiles = data && data.mbtiles_files && data.mbtiles_files.length > 0;
        setMbtilesAvailable(hasMbtiles);
        console.log(`[OfflineTileLayer] MBTiles files available: ${hasMbtiles}`, data);
        return hasMbtiles;
      }
    } catch (error) {
      console.error('[OfflineTileLayer] Error checking .mbtiles availability:', error);
    }
    return false;
  };

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
        
        // Verificar si hay archivos .mbtiles disponibles
        const hasMbtiles = await checkMbtilesAvailability();
        
        // Determinar si hay algún tipo de mapas offline disponibles
        const anyOfflineAvailable = hasOfflineMaps || hasMbtiles;
        
        // Notificar al componente padre sobre la disponibilidad de mapas
        if (onAvailabilityChange) {
          onAvailabilityChange('offline', anyOfflineAvailable);
        }
        
        // Determinar qué fuente de mapas usar, respetando la preferencia si se proporciona
        let sourceToUse = 'online';
        
        if (preferredSource === 'auto') {
          if (anyOfflineAvailable) {
            sourceToUse = 'offline';
          }
          console.log(`[OfflineTileLayer] Auto source selection chose: ${sourceToUse}`);
        } else if (
          (preferredSource === 'offline' && anyOfflineAvailable) ||
          preferredSource === 'online'
        ) {
          sourceToUse = preferredSource;
          console.log(`[OfflineTileLayer] Using preferred source: ${sourceToUse}`);
        } else if (anyOfflineAvailable) {
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
        map.offlineAvailable = anyOfflineAvailable;
        
        // Si hay mapas offline, forzar una actualización de los tiles
        if (anyOfflineAvailable) {
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
      console.log('[OfflineTileLayer] No tripId provided, checking for .mbtiles files anyway...');
      // Sin tripId, solo verificar .mbtiles
      await checkMbtilesAvailability();
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

  // Efecto para controlar cuando mostrar el mensaje de error
  useEffect(() => {
    // Solo mostrar el error si hay varios fallos de carga
    if (tileErrorCount > 3) {
      setShowMapError(true);
      // Ocultar después de 5 segundos
      const timer = setTimeout(() => {
        setShowMapError(false);
        setTileErrorCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [tileErrorCount]);

  // Función para configurar la capa MBTiles usando el endpoint del backend
  const setupMBTilesLayer = async () => {
    try {
      console.log('[OfflineTileLayer] Setting up MBTiles layer via backend endpoint...');
      
      // Verificar que el endpoint esté disponible
      try {
        const metadataResponse = await fetch('/api/offline-maps/mbtiles/metadata');
        if (!metadataResponse.ok) {
          throw new Error('MBTiles metadata endpoint not available');
        }
        const metadata = await metadataResponse.json();
        console.log('[OfflineTileLayer] MBTiles metadata:', metadata);
      } catch (error) {
        console.error('[OfflineTileLayer] MBTiles endpoint not available, falling back to online');
        setupOnlineLayer();
        return;
      }

      console.log('[OfflineTileLayer] Creating MBTiles tile layer...');
      
      // Crear capa de tiles usando el endpoint XYZ del backend
      const mbtilesUrl = '/api/offline-maps/mbtiles/tile/{z}/{x}/{y}';
      
      const newLayer = new L.TileLayer(mbtilesUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | MBTiles',
        minZoom: 1,
        maxZoom: 19,
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        crossOrigin: true
      });

      // Configurar eventos para la capa
      newLayer.on('loading', () => {
        console.log('[OfflineTileLayer] MBTiles tiles loading...');
      });

      newLayer.on('load', () => {
        console.log('[OfflineTileLayer] MBTiles tiles loaded successfully');
        setShowIndicator(true);
        setTimeout(() => setShowIndicator(false), 3000);
      });

      newLayer.on('tileerror', (ev) => {
        console.warn('[OfflineTileLayer] MBTiles tile error:', ev);
        // No mostrar error inmediatamente, algunos tiles pueden no estar disponibles
      });

      // Agregar la capa al mapa
      map.addLayer(newLayer);
      setCustomTileLayer(newLayer);
      
      console.log('[OfflineTileLayer] MBTiles layer added to map via backend endpoint');

    } catch (error) {
      console.error('[OfflineTileLayer] Error setting up MBTiles layer:', error);
      setupOnlineLayer();
    }
  };

  // Función para configurar capa de tiles online
  const setupOnlineLayer = () => {
    const newLayer = new L.TileLayer(url, { 
      ...props,
      subdomains: 'abc',
      minZoom: 1,
      maxZoom: 19,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      crossOrigin: true
    });
    
    map.addLayer(newLayer);
    setCustomTileLayer(newLayer);
    console.log('[OfflineTileLayer] Online tile layer added to map');
  };

  // Función para configurar capa de tiles offline personalizada
  const setupCustomOfflineLayer = () => {
    // Crear un método personalizado de carga de tiles para el sistema offline existente
    const customTileLayerClass = L.TileLayer.extend({
      createTile: function(coords, done) {
        const tile = document.createElement('img');
        
        // Añadir manejadores de eventos para detectar problemas de carga
        tile.onerror = function(e) {
          console.error(`[OfflineTileLayer] Error loading tile z=${coords.z}, x=${coords.x}, y=${coords.y}`);
          
          // Incrementar contador de errores
          setTileErrorCount(prev => prev + 1);
          
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

            if (mapSource === 'offline' && tripId) {
              // Intentar cargar desde almacenamiento offline primero
              try {
                const offlineTile = await offlineMapManager.getTile(coords.z, coords.x, coords.y);
                if (offlineTile && offlineTile.data) {
                  tileUrl = offlineTile.data;
                  console.log(`[OfflineTileLayer] Loaded offline tile for z=${coords.z}, x=${coords.x}, y=${coords.y}`);
                } else {
                  throw new Error('Tile not found in offline storage');
                }
              } catch (offlineError) {
                console.warn(`[OfflineTileLayer] Offline tile not available for z=${coords.z}, x=${coords.x}, y=${coords.y}, falling back to online`);
                // Si el tile offline no está disponible, usar la URL online
                tileUrl = url
                  .replace('{s}', String.fromCharCode(97 + (Math.abs(coords.x + coords.y) % 3)))
                  .replace('{z}', coords.z)
                  .replace('{x}', coords.x)
                  .replace('{y}', coords.y);
              }
            } else {
              // Modo online normal
              tileUrl = url
                .replace('{s}', String.fromCharCode(97 + (Math.abs(coords.x + coords.y) % 3)))
                .replace('{z}', coords.z)
                .replace('{x}', coords.x)
                .replace('{y}', coords.y);
            }

            tile.src = tileUrl;
            done(null, tile);
          } catch (error) {
            console.error(`[OfflineTileLayer] Error in loadTile: ${error.message}`);
            done(error, tile);
          }
        };

        loadTile();
        return tile;
      }
    });

    const newLayer = new customTileLayerClass(url, {
      ...props,
      attribution: props.attribution + (mapSource === 'offline' ? ' | Offline Mode' : ''),
      subdomains: 'abc',
      minZoom: 1,
      maxZoom: 19,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      crossOrigin: true
    });

    map.addLayer(newLayer);
    setCustomTileLayer(newLayer);
    console.log('[OfflineTileLayer] Custom offline tile layer added to map');
  };

  // Implementación de TileLayer personalizada con manejo de tiles offline/online y .mbtiles
  useEffect(() => {
    console.log(`[OfflineTileLayer] Setting up custom tile layer with mapSource=${mapSource}`);
    
    // Si ya existe una capa, eliminarla primero
    if (customTileLayer) {
      map.removeLayer(customTileLayer);
    }

    if (mapSource === 'offline' && mbtilesAvailable) {
      // Usar MBTiles si está disponible
      console.log('[OfflineTileLayer] Using MBTiles layer');
      setupMBTilesLayer();
      return;
    } else if (mapSource === 'offline' && offlineAvailable) {
      // Usar el sistema de tiles offline existente
      console.log('[OfflineTileLayer] Using custom offline tile layer');
      setupCustomOfflineLayer();
      return;
    } else {
      // Usar tiles online
      console.log('[OfflineTileLayer] Using online tile layer');
      setupOnlineLayer();
      return;
    }
  }, [mapSource, tripId, url, map, mbtilesAvailable, offlineAvailable]);
  
  return (
    <>
      {/* Ya no usamos LeafletTileLayer porque lo reemplazamos con nuestra implementación personalizada */}
      
      {/* Alerta de marcador de posición */}
      <PlaceholderTileAlert mapSource={mapSource} />
      
      {/* Indicador de fuente del mapa */}
      <div className="leaflet-bottom leaflet-left" style={{ zIndex: 1000, margin: '0 0 10px 10px' }}>
        <div className={`leaflet-control px-2 py-1 rounded-lg shadow-md flex items-center text-xs ${
          mapSource === 'offline'
            ? (mbtilesAvailable ? 'bg-green-600 text-white' : 'bg-blue-600 text-white')
            : 'bg-gray-700 text-white'
        }`}>
          {mapSource === 'offline' ? (
            <>
              <FaSignal className="mr-1" /> 
              {mbtilesAvailable ? 'MBTiles offline' : 'Mapas offline'}
            </>
          ) : (
            <>
              <MdCloudQueue className="mr-1" /> Mapas online
            </>
          )}
        </div>
      </div>
      
      {/* Indicador de mapas offline */}
      {showIndicator && (offlineAvailable || mbtilesAvailable) && (
        <div className="leaflet-bottom leaflet-right" style={{ zIndex: 1000 }}>
          <div className="leaflet-control bg-green-600 text-white px-2 py-1 rounded-lg shadow-md flex items-center">
            <FaSignal className="mr-1" /> 
            {mbtilesAvailable ? 'MBTiles disponibles' : 'Mapas disponibles offline'}
          </div>
        </div>
      )}
      
      {/* Indicador de error de carga - Mostrar SOLO cuando hay error real */}
      {showMapError && (
        <div
          className="leaflet-top leaflet-center"
          style={{
            zIndex: 1000,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        >
          <div className="leaflet-control bg-red-600 text-white px-4 py-2 rounded-lg shadow-md text-center">
            <MdWarning className="inline-block mr-2" size={24} /> 
            Error al cargar los mapas. Comprueba tu conexión a internet.
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineTileLayer;
