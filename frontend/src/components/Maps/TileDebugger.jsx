import React from 'react';
import { useMap } from 'react-leaflet';

/**
 * Componente para depurar problemas con los tiles.
 * Añade información de depuración a la consola y proporciona un botón para probar
 * las funciones de servicio directamente.
 */
const TileDebugger = ({ tripId }) => {
  const map = useMap();
  
  // Test functions
  const runTests = async () => {
    console.log('[TileDebugger] Starting tests...');
    
    // Importar servicios
    const offlineMapManager = (await import('../../services/offlineMapService')).default;
    
    // Información actual del mapa
    const center = map.getCenter();
    const zoom = map.getZoom();
    console.log(`[TileDebugger] Current map center: ${center.lat}, ${center.lng}, zoom: ${zoom}`);
    
    // Calcular coordenadas de tile en el centro
    const tileCoords = {
      x: Math.floor((center.lng + 180) / 360 * Math.pow(2, zoom)),
      y: Math.floor((1 - Math.log(Math.tan(center.lat * Math.PI / 180) + 1 / Math.cos(center.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)),
      z: zoom
    };
    
    console.log(`[TileDebugger] Central tile coords: z=${tileCoords.z}, x=${tileCoords.x}, y=${tileCoords.y}`);
    
    // Probar si hay mapas offline estándar disponibles
    try {
      const hasOfflineMaps = await offlineMapManager.hasOfflineMapForTrip(tripId);
      console.log(`[TileDebugger] Standard offline maps available for trip ${tripId}: ${hasOfflineMaps}`);
      
      // Si hay mapas, intentar obtener un tile
      if (hasOfflineMaps) {
        console.log('[TileDebugger] Testing getTileUrl...');
        const offlineTile = await offlineMapManager.getTileUrl(tileCoords);
        console.log(`[TileDebugger] Offline tile result: ${offlineTile ? 'Found' : 'Not found'}`);
        if (offlineTile) {
          console.log(`[TileDebugger] Offline tile URL: ${offlineTile}`);
        }
      }
    } catch (error) {
      console.error('[TileDebugger] Error testing offline maps:', error);
    }
    
    console.log('[TileDebugger] Tests completed');
  };
  
  return (
    <div className="leaflet-control bg-white p-2 rounded-lg shadow-md">
      <button 
        onClick={runTests}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs"
      >
        Test Tile Services
      </button>
    </div>
  );
};

export default TileDebugger;
