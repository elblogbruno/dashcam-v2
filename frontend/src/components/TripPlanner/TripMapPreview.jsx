// filepath: /root/dashcam-v2/frontend/src/components/TripPlanner/TripMapPreview.jsx
import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { FaRoute, FaPlay, FaDownload, FaMap, FaImage, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { MdOutlineTerrain } from 'react-icons/md';
import OfflineTileLayer from '../Maps/OfflineTileLayer';
import offlineMapManager from '../../services/offlineMapService';
import organicMapManager from '../../services/organicMapService';
import landmarkImageManager from '../../services/landmarkImageService';
import { toast } from 'react-hot-toast';

// Componente para ajustar el mapa cuando cambia el tamaño de la pantalla
const MapUpdater = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    if (positions && positions.length > 0) {
      try {
        // Crear un límite que incluya todas las posiciones
        const bounds = positions.reduce((bounds, position) => {
          return bounds.extend(position);
        }, map.getBounds());

        // Ajustar el mapa a esos límites con un pequeño padding
        map.fitBounds(bounds, { padding: [30, 30] });
      } catch (error) {
        console.error('Error adjusting map bounds:', error);
      }
    }
  }, [positions, map]);

  return null;
};

const TripMapPreview = ({ trip, onStartNavigation, isUpcoming }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState({
    mapTiles: true,
    landmarkImages: true,
    organicMaps: false
  });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Estado para mostrar información detallada del proceso de descarga
  const [downloadStatus, setDownloadStatus] = useState({
    showDebug: false,
    mapProgress: 0,
    organicMapsProgress: 0,
    landmarksTotal: 0,
    landmarksDownloaded: 0,
    currentStep: '',
    lastError: null
  });
  
  // Función para descargar recursos offline
  const handleDownloadOfflineResources = async (e) => {
    e.stopPropagation();
    
    if (!trip || !trip.id) {
      toast.error('No se puede descargar los recursos para este viaje');
      return;
    }

    if (!downloadOptions.mapTiles && !downloadOptions.landmarkImages && !downloadOptions.organicMaps) {
      toast.error('Por favor selecciona al menos un tipo de recurso para descargar');
      return;
    }
    
    // Activar el modo de depuración si presionamos Alt al hacer clic
    const debugMode = e.altKey || localStorage.getItem('showDebugInfo') === 'true';
    if (debugMode) {
      localStorage.setItem('showDebugInfo', 'true');
    }
    
    setIsDownloading(true);
    setDownloadStatus({
      showDebug: debugMode,
      mapProgress: 0,
      organicMapsProgress: 0,
      landmarksTotal: 0,
      landmarksDownloaded: 0,
      currentStep: 'Iniciando descarga...',
      lastError: null
    });
    
    const toastId = toast.loading(`Descargando recursos offline para ${trip.name}...`);
    
    try {
      // Progress tracker con información detallada
      const onProgress = (progress, message) => {
        toast.loading(`${message} (${Math.round(progress)}%)`, { id: toastId });
        
        // Actualizar el estado de depuración
        setDownloadStatus(prevState => {
          // Detectar si estamos descargando mapas o landmarks
          if (message.includes('mapa') || message.includes('tile')) {
            return {
              ...prevState,
              mapProgress: progress,
              currentStep: message
            };
          } else if (message.includes('imagen') || message.includes('landmark')) {
            // Extraer números de la cadena
            const matches = message.match(/(\d+)\/(\d+)/);
            if (matches && matches.length === 3) {
              return {
                ...prevState,
                landmarksDownloaded: parseInt(matches[1], 10),
                landmarksTotal: parseInt(matches[2], 10),
                currentStep: message
              };
            }
          }
          return {
            ...prevState,
            currentStep: message
          };
        });
      };
      
      // 1. Descargar mapas offline si se seleccionó esta opción
      if (downloadOptions.mapTiles) {
        await offlineMapManager.downloadMapTilesForTrip(trip, onProgress);
      }
      
      // 2. Descargar mapas de Organic Maps si se seleccionó esta opción
      if (downloadOptions.organicMaps) {
        // Actualizar el estado para reflejar que estamos descargando mapas Organic
        setDownloadStatus(prevState => ({
          ...prevState,
          currentStep: 'Iniciando descarga de mapas Organic Maps...',
          organicMapsProgress: 0
        }));
        
        // Descargar mapas Organic para el viaje
        await organicMapManager.downloadMWMForTrip(trip, (progress, message) => {
          // Ajustar el mensaje y progreso
          toast.loading(`${message} (${Math.round(progress)}%)`, { id: toastId });
          
          setDownloadStatus(prevState => ({
            ...prevState,
            organicMapsProgress: progress,
            currentStep: message
          }));
        });
      }
      
      // 3. Descargar imágenes de landmarks si se seleccionó esta opción
      if (downloadOptions.landmarkImages) {
        // Obtener los landmarks de este viaje
        const response = await fetch(`/api/landmarks/by-trip/${trip.id}`);
        if (!response.ok) {
          throw new Error('No se pudieron obtener los landmarks del viaje');
        }
        
        const tripLandmarks = await response.json();
        
        setDownloadStatus(prevState => ({
          ...prevState,
          landmarksTotal: tripLandmarks.length,
          currentStep: `Encontrados ${tripLandmarks.length} landmarks para descargar`
        }));
        
        // Descargar imágenes para los landmarks
        await landmarkImageManager.downloadLandmarkImages(trip.id, tripLandmarks, onProgress);
      }
      
      const recursosDescargados = [
        downloadOptions.mapTiles ? 'mapas OSM' : '',
        downloadOptions.organicMaps ? 'mapas Organic' : '',
        downloadOptions.landmarkImages ? 'imágenes' : ''
      ].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' y $1');
      
      toast.success(`${recursosDescargados} descargados correctamente para ${trip.name}`, { id: toastId });
    } catch (error) {
      console.error('Error descargando recursos offline:', error);
      toast.error(`Error: ${error.message}`, { id: toastId });
      
      setDownloadStatus(prevState => ({
        ...prevState,
        lastError: error.message
      }));
    } finally {
      setIsDownloading(false);
      setShowOptions(false);
    }
  };

  if (!trip) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-3 sm:p-4">
          <FaRoute className="text-2xl sm:text-4xl text-gray-400 mx-auto mb-1 sm:mb-2" />
          <p className="text-gray-500 text-sm sm:text-base">Select a trip to preview route</p>
        </div>
      </div>
    );
  }

  // Extract positions for the polyline
  const positions = [
    [trip.start_location.lat, trip.start_location.lon],
    ...(trip.waypoints || []).map(wp => [wp.lat, wp.lon]),
    [trip.end_location.lat, trip.end_location.lon]
  ];

  // Ajuste dinámico del zoom según el tamaño de la pantalla
  const getZoomLevel = () => {
    if (windowWidth < 640) return 8;
    if (windowWidth < 1024) return 9;
    return 10;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow" style={{ height: '40vh', maxHeight: '45%' }}>
        <MapContainer 
          center={[trip.start_location.lat, trip.start_location.lon]} 
          zoom={getZoomLevel()} 
          style={{ height: '100%', width: '100%' }}
          key={`map-${trip.id}-${positions.length}-${windowWidth}`} // Force re-render when trip, waypoints, or screen size changes
          zoomControl={windowWidth > 640} // Mostrar controles de zoom solo en pantallas más grandes
        >
          <OfflineTileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            tripId={trip.id}
          />
          
          {/* Start location marker */}
          <Marker position={[trip.start_location.lat, trip.start_location.lon]}>
            <Popup>
              <div className="text-xs sm:text-sm">
                <strong>Start:</strong> {trip.start_location.name || 'Origin'}
              </div>
            </Popup>
          </Marker>
          
          {/* End location marker */}
          <Marker position={[trip.end_location.lat, trip.end_location.lon]}>
            <Popup>
              <div className="text-xs sm:text-sm">
                <strong>End:</strong> {trip.end_location.name || 'Destination'}
              </div>
            </Popup>
          </Marker>
          
          {/* Waypoint markers */}
          {trip.waypoints && trip.waypoints.map((waypoint, index) => (
            <Marker key={index} position={[waypoint.lat, waypoint.lon]}>
              <Popup>
                <div className="text-xs sm:text-sm">
                  {waypoint.name || `Waypoint ${index + 1}`}
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Route line */}
          <Polyline
            positions={positions}
            color="#0284c7"
            weight={windowWidth < 640 ? 3 : 4} // Línea más delgada en dispositivos móviles
            opacity={0.7}
          />
          
          {/* Componente para centrar el mapa en todos los puntos */}
          <MapUpdater positions={positions} />
        </MapContainer>
      </div>

      <div className="p-3 sm:p-4 border-t border-gray-200 relative">
        <h4 className="font-medium text-sm sm:text-base mb-1 sm:mb-2">Trip Details</h4>
        <p className="text-xs sm:text-sm text-gray-600">
          <strong>Dates:</strong> {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
        </p>
        {trip.waypoints && trip.waypoints.length > 0 && (
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            <strong>Waypoints:</strong> {trip.waypoints.length}
          </p>
        )}
        {trip.notes && (
          <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
            <strong>Notes:</strong> {trip.notes}
          </p>
        )}
        
        {/* Botones de acción */}
        <div className="flex gap-2 mt-2 sm:mt-3">
          {/* Botón de navegación */}
          {isUpcoming && (
            <button
              onClick={() => onStartNavigation(trip)}
              className="flex-1 py-1 sm:py-2 bg-dashcam-600 hover:bg-dashcam-700 text-white rounded-md flex items-center justify-center text-xs sm:text-sm"
            >
              <FaPlay className="mr-1" /> Iniciar Navegación
            </button>
          )}
        </div>
        
        {/* Botón para mostrar/ocultar opciones de descarga */}
        <div className="relative z-30"> {/* Aumentado el z-index */}
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="w-full mt-3 sm:mt-4 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-t-md flex items-center justify-center text-sm sm:text-base font-medium"
            disabled={isDownloading}
          >
            <FaDownload className="mr-2 text-base" />
            {showOptions ? 'Ocultar opciones de descarga' : 'Descargar recursos para viaje offline'}
            {showOptions ? <FaChevronUp className="ml-2" /> : <FaChevronDown className="ml-2" />}
          </button>
          
          {/* Panel de opciones de descarga */}
          {showOptions && !isDownloading && (
            <div className="fixed left-0 right-0 z-50 m-auto p-4 bg-blue-50 border border-blue-200 rounded-md text-sm shadow-2xl" style={{ maxWidth: "calc(100% - 20px)", width: "40rem", top: "auto", bottom: "auto" }}>
              <div className="font-medium mb-3 text-blue-800 text-base">Selecciona lo que deseas descargar:</div>
            
            <div className="flex items-center mb-3">
              <input 
                type="checkbox" 
                id="downloadMapTiles"
                checked={downloadOptions.mapTiles} 
                onChange={() => setDownloadOptions({...downloadOptions, mapTiles: !downloadOptions.mapTiles})}
                className="mr-2 h-5 w-5"
              />
              <label htmlFor="downloadMapTiles" className="flex items-center cursor-pointer text-base">
                <FaMap className="mr-2 text-blue-600" /> Mapas offline
              </label>
            </div>
            
            <div className="flex items-center mb-3">
              <input 
                type="checkbox" 
                id="downloadLandmarkImages"
                checked={downloadOptions.landmarkImages} 
                onChange={() => setDownloadOptions({...downloadOptions, landmarkImages: !downloadOptions.landmarkImages})}
                className="mr-2 h-5 w-5"
              />
              <label htmlFor="downloadLandmarkImages" className="flex items-center cursor-pointer text-base">
                <FaImage className="mr-2 text-green-600" /> Imágenes de puntos de interés
              </label>
            </div>
            
            <div className="flex items-center mb-4">
              <input 
                type="checkbox" 
                id="downloadOrganicMaps"
                checked={downloadOptions.organicMaps} 
                onChange={() => setDownloadOptions({...downloadOptions, organicMaps: !downloadOptions.organicMaps})}
                className="mr-2 h-5 w-5"
              />
              <label htmlFor="downloadOrganicMaps" className="flex items-center cursor-pointer text-base">
                <MdOutlineTerrain className="mr-2 text-purple-600" /> Mapas Organic (.mwm)
              </label>
            </div>
            
            <button
              onClick={handleDownloadOfflineResources}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center text-base font-medium"
              disabled={!downloadOptions.mapTiles && !downloadOptions.landmarkImages && !downloadOptions.organicMaps}
            >
              Descargar seleccionados
            </button>
          </div>
        )}
        
        {/* Panel de descarga y progreso */}
        {isDownloading && (
          <div className="fixed left-0 right-0 z-50 m-auto p-4 bg-blue-50 border border-blue-200 rounded-md text-sm shadow-2xl" style={{ maxWidth: "calc(100% - 20px)", width: "40rem", top: "50%", transform: "translateY(-50%)" }}>
            <div className="flex items-center mb-3">
              <svg className="animate-spin h-6 w-6 mr-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4zm16 0a8 8 0 01-8 8v-8h8z"></path>
              </svg>
              <div>
                <div className="font-medium text-blue-800 text-base">Descargando recursos...</div>
                <div className="text-sm text-blue-600 mt-1">{downloadStatus.currentStep}</div>
              </div>
            </div>
            
            {downloadOptions.mapTiles && (
              <div className="mb-3 mt-2">
                <div className="flex justify-between mb-1 text-sm">
                  <span className="font-medium">Mapas OSM:</span>
                  <span>{Math.round(downloadStatus.mapProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full" 
                    style={{ width: `${downloadStatus.mapProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {downloadOptions.organicMaps && (
              <div className="mb-3">
                <div className="flex justify-between mb-1 text-sm">
                  <span className="font-medium">Mapas Organic:</span>
                  <span>{Math.round(downloadStatus.organicMapsProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-purple-500 h-3 rounded-full" 
                    style={{ width: `${downloadStatus.organicMapsProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {downloadOptions.landmarkImages && downloadStatus.landmarksTotal > 0 && (
              <div className="mb-3">
                <div className="flex justify-between mb-1 text-sm">
                  <span className="font-medium">Imágenes landmarks:</span>
                  <span>{downloadStatus.landmarksDownloaded}/{downloadStatus.landmarksTotal}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-green-500 h-3 rounded-full" 
                    style={{ 
                      width: `${(downloadStatus.landmarksDownloaded / downloadStatus.landmarksTotal) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
        
        {/* Panel de depuración para mostrar el estado de la descarga */}
        {isDownloading && downloadStatus.showDebug && (
          <div className="mt-3 p-3 bg-gray-100 border border-gray-200 rounded-md text-xs">
            <h5 className="font-bold text-gray-700 mb-1">Estado de descarga (Debug)</h5>
            <div className="mb-2">
              <div className="flex justify-between mb-1">
                <span>Mapas OSM:</span>
                <span>{Math.round(downloadStatus.mapProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${downloadStatus.mapProgress}%` }}
                ></div>
              </div>
            </div>
            
            {downloadOptions.organicMaps && (
              <div className="mb-2">
                <div className="flex justify-between mb-1">
                  <span>Mapas Organic:</span>
                  <span>{Math.round(downloadStatus.organicMapsProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full" 
                    style={{ width: `${downloadStatus.organicMapsProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <div className="mb-2">
              <div className="flex justify-between mb-1">
                <span>Landmarks:</span>
                <span>{downloadStatus.landmarksDownloaded}/{downloadStatus.landmarksTotal}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ 
                    width: downloadStatus.landmarksTotal > 0 
                      ? `${(downloadStatus.landmarksDownloaded / downloadStatus.landmarksTotal) * 100}%` 
                      : '0%' 
                  }}
                ></div>
              </div>
            </div>
            
            <div className="text-gray-600">
              <p><strong>Paso actual:</strong> {downloadStatus.currentStep}</p>
              {downloadStatus.lastError && (
                <p className="text-red-500 mt-1"><strong>Último error:</strong> {downloadStatus.lastError}</p>
              )}
              <p className="text-xs mt-2 italic text-gray-500">
                Presiona Alt+Click en el botón de descarga para activar/desactivar este panel
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripMapPreview;
