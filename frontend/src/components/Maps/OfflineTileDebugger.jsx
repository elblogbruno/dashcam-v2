import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import offlineMapManager from '../../services/offlineMapService';

/**
 * Componente para depurar problemas con los tiles offline.
 * Muestra información sobre los tiles actuales y permite realizar pruebas.
 */
const OfflineTileDebugger = ({ tripId }) => {
  const map = useMap();
  const [visibleTiles, setVisibleTiles] = useState([]);
  const [selectedTile, setSelectedTile] = useState(null);
  const [tileContent, setTileContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [statusRefreshes, setStatusRefreshes] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(map ? map.getZoom() : 12);
  const [selectedZoomLevels, setSelectedZoomLevels] = useState([]);
  
  // Lista de posibles niveles de zoom para descargar
  const availableZoomLevels = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  
  // Obtener los tiles visibles en cada movimiento del mapa
  useEffect(() => {
    if (!map) return;
    
    const updateVisibleTiles = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      
      // Actualizar el nivel de zoom actual
      setCurrentZoom(zoom);
      
      // Convertir las coordenadas geográficas a coordenadas de tiles
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();
      
      // Función para convertir lat/lng a coordenadas de tile
      const latLngToTile = (lat, lng, zoom) => {
        const scale = 1 << zoom;
        const worldCoordX = (lng + 180) / 360 * scale;
        const worldCoordY = (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2 * scale;
        return {
          x: Math.floor(worldCoordX),
          y: Math.floor(worldCoordY),
          z: zoom
        };
      };
      
      // Obtener coordenadas de tiles para las esquinas
      const nwTile = latLngToTile(nw.lat, nw.lng, zoom);
      const seTile = latLngToTile(se.lat, se.lng, zoom);
      
      // Generar lista de tiles visibles
      const tiles = [];
      for (let x = nwTile.x; x <= seTile.x; x++) {
        for (let y = nwTile.y; y <= seTile.y; y++) {
          tiles.push({
            x: x,
            y: y,
            z: zoom
          });
        }
      }
      
      // Limitar la cantidad de tiles para no sobrecargar la interfaz
      const maxTiles = 10;
      setVisibleTiles(tiles.slice(0, maxTiles));
    };
    
    updateVisibleTiles();
    
    map.on('moveend', updateVisibleTiles);
    map.on('zoomend', updateVisibleTiles);
    
    return () => {
      map.off('moveend', updateVisibleTiles);
      map.off('zoomend', updateVisibleTiles);
    };
  }, [map]);
  
  // Comprobar el estado de la descarga
  useEffect(() => {
    if (!tripId) return;
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/offline-maps/status/${tripId}`);
        if (response.ok) {
          const status = await response.json();
          setDownloadStatus(status);
        }
      } catch (error) {
        console.error('Error checking download status:', error);
      }
    };
    
    checkStatus();
    
    // Configurar un intervalo para actualizar el estado si hay una descarga en curso
    const intervalId = setInterval(() => {
      if (downloadStatus && downloadStatus.status === 'in_progress') {
        checkStatus();
        setStatusRefreshes(prev => prev + 1);
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [tripId, statusRefreshes, downloadStatus?.status]);
  
  // Probar un tile específico
  const testTile = async (tileCoords) => {
    setSelectedTile(tileCoords);
    setLoading(true);
    try {
      // Usar el servicio de mapas offline
      const url = await offlineMapManager.getTileUrl({
        z: tileCoords.z,
        x: tileCoords.x,
        y: tileCoords.y
      });
      setTileContent(url);
    } catch (error) {
      console.error('Error testing tile:', error);
      setTileContent(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Comprobar respuesta directa del backend
  const checkDirectResponse = async () => {
    if (!selectedTile || !tripId) return;
    
    setLoading(true);
    try {
      const { x, y, z } = selectedTile;
      const response = await fetch(`/api/offline-maps/tile/${tripId}/${z}/${x}/${y}`);
      
      // Verificar el tipo de contenido
      const contentType = response.headers.get('content-type');
      console.log(`Respuesta directa - Content-Type: ${contentType}`);
      
      if (contentType && contentType.includes('image')) {
        const blob = await response.blob();
        setTileContent(URL.createObjectURL(blob));
      } else {
        const text = await response.text();
        console.log(`Respuesta directa (texto): ${text.substring(0, 200)}...`);
        setTileContent(null);
        alert(`Respuesta no válida. Contenido: ${text.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error('Error checking direct response:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manejar la selección de niveles de zoom
  const toggleZoomLevel = (zoom) => {
    setSelectedZoomLevels(prevSelected => {
      if (prevSelected.includes(zoom)) {
        // Si ya está seleccionado, lo quitamos
        return prevSelected.filter(z => z !== zoom);
      } else {
        // Si no está seleccionado, lo añadimos
        return [...prevSelected, zoom].sort((a, b) => a - b);
      }
    });
  };
  
  // Seleccionar un rango optimizado de niveles de zoom
  const selectOptimizedRange = () => {
    if (!map) return;
    
    const currentZoom = map.getZoom();
    const newZoomLevels = [];
    
    // Siempre incluimos niveles de zoom bajos para tener una visión general
    newZoomLevels.push(8);
    
    // Añadir niveles intermedios
    if (currentZoom > 10) newZoomLevels.push(10);
    
    // Añadir el nivel actual y el siguiente
    newZoomLevels.push(currentZoom);
    if (currentZoom < 16) newZoomLevels.push(currentZoom + 1);
    
    // Si es un nivel urbano (14+), añadir otro nivel más de detalle
    if (currentZoom >= 14 && currentZoom < 15) newZoomLevels.push(currentZoom + 2);
    
    setSelectedZoomLevels([...new Set(newZoomLevels)].sort((a, b) => a - b));
  };

  // Solicitar la descarga manual de un área
  const downloadAreaTiles = async () => {
    if (!map || !tripId) return;
    
    try {
      const bounds = map.getBounds();
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();
      
      // Preparar los límites para la solicitud
      const boundsData = {
        north: nw.lat,
        south: se.lat,
        east: se.lng,
        west: nw.lng
      };
      
      // Usar los niveles de zoom seleccionados o calcular automáticamente
      let zoomLevels = [];
      
      if (selectedZoomLevels.length > 0) {
        // Usar los niveles seleccionados por el usuario
        zoomLevels = [...selectedZoomLevels];
      } else {
        // Calcular automáticamente (estrategia mejorada con más niveles)
        const currentZoom = map.getZoom();
        
        // Siempre incluir un nivel base
        zoomLevels.push(Math.max(8, Math.min(currentZoom - 3, 10)));
        
        // Incluir niveles incrementalmente hasta el máximo
        for (let z = Math.max(8, currentZoom - 1); z <= Math.min(16, currentZoom + 2); z++) {
          zoomLevels.push(z);
        }
        
        // Eliminar duplicados y ordenar
        zoomLevels = [...new Set(zoomLevels)].sort((a, b) => a - b);
      }
      
      const result = await offlineMapManager.downloadMapsForAreaManually(tripId, boundsData, zoomLevels);
      
      if (result) {
        alert(`Descarga de tiles iniciada para el área visible (zoom: ${zoomLevels.join(', ')})`);
        // Refrescar el estado después de iniciar la descarga
        setStatusRefreshes(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error initiating manual download:', error);
      alert(`Error al solicitar la descarga: ${error.message}`);
    }
  };

  return (
    <div className="leaflet-bottom leaflet-right" style={{ zIndex: 1000, margin: '70px 10px 10px 0' }}>
      <div className="leaflet-control bg-white p-2 rounded-lg shadow-md max-w-sm">
        <h4 className="text-sm font-bold mb-2">Depurador de Tiles Offline</h4>
        <div className="mb-2">
          <div className="text-xs font-medium mb-1">Tiles visibles ({visibleTiles.length}):</div>
          <div className="max-h-32 overflow-y-auto">
            {visibleTiles.map((tile, index) => (
              <div 
                key={index} 
                className={`text-xs p-1 cursor-pointer ${
                  selectedTile && selectedTile.x === tile.x && 
                  selectedTile.y === tile.y && selectedTile.z === tile.z 
                    ? 'bg-blue-100' : 'hover:bg-gray-100'
                }`}
                onClick={() => testTile(tile)}
              >
                z: {tile.z}, x: {tile.x}, y: {tile.y}
              </div>
            ))}
          </div>
        </div>
        
        {downloadStatus && (
          <div className="mt-2 border-t border-gray-200 pt-2">
            <div className="text-xs font-medium">Estado de la descarga:</div>
            <div className="text-xs">
              <div>Estado: <span className={
                downloadStatus.status === 'completed' ? 'text-green-600 font-semibold' : 
                downloadStatus.status === 'in_progress' ? 'text-blue-600 font-semibold' :
                downloadStatus.status === 'failed' ? 'text-red-600 font-semibold' : ''
              }>{downloadStatus.status}</span></div>
              {downloadStatus.status === 'in_progress' && (
                <div>
                  Progreso: {downloadStatus.progress.toFixed(1)}%
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full" 
                      style={{ width: `${downloadStatus.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              <div>Tiles: {downloadStatus.downloaded_tiles} descargados / {downloadStatus.total_tiles} total</div>
              {downloadStatus.failed_tiles > 0 && (
                <div className="text-red-500">{downloadStatus.failed_tiles} tiles fallidos</div>
              )}
            </div>
          </div>
        )}
        
        <div className="mt-2 border-t border-gray-200 pt-2">
          <div className="text-xs font-medium mb-2 flex justify-between items-center">
            <span>Nivel de zoom actual: <span className="font-bold text-blue-600">{currentZoom}</span></span>
          </div>
          
          <div className="mb-2">
            <div className="text-xs font-medium mb-1">Seleccionar niveles de zoom:</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {availableZoomLevels.map(zoom => (
                <button
                  key={zoom}
                  className={`text-xs py-0.5 px-1.5 border rounded ${
                    selectedZoomLevels.includes(zoom) 
                      ? 'bg-blue-500 text-white border-blue-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => toggleZoomLevel(zoom)}
                >
                  {zoom}
                </button>
              ))}
            </div>
            <button 
              className="bg-gray-500 hover:bg-gray-700 text-white text-xs py-1 px-2 rounded w-full mb-2"
              onClick={selectOptimizedRange}
            >
              Selección Optimizada
            </button>
          </div>
          
          <button 
            className="bg-blue-500 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded w-full mb-2"
            onClick={downloadAreaTiles}
            disabled={loading}
          >
            {selectedZoomLevels.length > 0 
              ? `Descargar Niveles ${selectedZoomLevels.join(', ')}` 
              : 'Descargar Área Visible (Auto)'}
          </button>
        </div>
        
        {selectedTile && (
          <>
            <div className="text-xs font-medium mt-2">
              Tile seleccionado: z={selectedTile.z}, x={selectedTile.x}, y={selectedTile.y}
            </div>
            <div className="flex mt-1">
              <button 
                className="bg-blue-500 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded mr-1"
                onClick={() => testTile(selectedTile)}
                disabled={loading}
              >
                {loading ? 'Cargando...' : 'Probar Offline'}
              </button>
              <button 
                className="bg-green-500 hover:bg-green-700 text-white text-xs py-1 px-2 rounded"
                onClick={checkDirectResponse}
                disabled={loading}
              >
                API Directa
              </button>
            </div>
            
            {tileContent && (
              <div className="mt-2 border border-gray-200 p-1">
                <img 
                  src={tileContent} 
                  alt="Tile content" 
                  className="max-w-full h-auto"
                  onError={(e) => {
                    console.error('Error loading image:', e);
                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="red"/><text x="50%" y="50%" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Error</text></svg>';
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineTileDebugger;
