import { useState } from 'react';
import {
  FaPlay, FaStop, FaDownload, FaMapMarkerAlt, 
  FaCrosshairs, FaRoute, FaTimes, FaListUl, FaEye, FaEyeSlash,
  FaSatellite, FaMap, FaLocationArrow, FaCompress, FaExpand, FaCog
} from 'react-icons/fa';
import { MdAddLocation, MdCloudDownload, MdDeleteForever, MdHelp, MdTerrain, MdScreenRotation } from 'react-icons/md';
import MapSourceSelector from '../Maps/MapSourceSelector';

function ControlPanel({ 
  isRecording, 
  activeTrip,
  startTrip, 
  endTrip, 
  navigationSidebarOpen, 
  setNavigationSidebarOpen,
  showPlannedRoute, 
  setShowPlannedRoute,
  showLandmarks, 
  setShowLandmarks,
  downloadLandmarks,
  createLandmark,
  centerOnPosition,
  clearPlannedTrip,
  // Props para el selector de mapas
  mapSource,
  setMapSource,
  offlineMapsAvailable,
  tripId
}) {
  // Estado para controlar la visibilidad del menú de opciones
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  // Estado para controlar la visibilidad del menú de configuración
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  // Estado para modos de visualización 
  const [mapMode, setMapMode] = useState('standard');
  // Estado para seguir automáticamente la posición
  const [autoFollow, setAutoFollow] = useState(true);
  // Estado para pantalla completa
  const [fullscreen, setFullscreen] = useState(false);
  
  const toggleMoreOptions = () => {
    setShowMoreOptions(!showMoreOptions);
    if (showSettingsMenu) setShowSettingsMenu(false);
  };

  const toggleSettingsMenu = () => {
    setShowSettingsMenu(!showSettingsMenu);
    if (showMoreOptions) setShowMoreOptions(false);
  };

  // Cerrar el menú de opciones cuando se hace clic en un botón
  const handleOptionClick = (callback) => {
    return () => {
      callback();
      setShowMoreOptions(false);
    };
  };
  
  // Función para manejar la opción de pantalla completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.error(`Error al intentar entrar en modo pantalla completa: ${e.message}`);
      });
      setFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setFullscreen(false);
      }
    }
  };
  
  // Funcionalidad para cambiar el modo del mapa
  const changeMapMode = (mode) => {
    setMapMode(mode);
    // Aquí se podría implementar la lógica para cambiar realmente el estilo del mapa
    // Por ejemplo, emitiendo un evento o llamando a una función prop
    console.log(`Cambio de modo de mapa a: ${mode}`);
  };
  
  // Función para rotar la orientación de la pantalla
  const rotateScreen = () => {
    if (window.screen && window.screen.orientation) {
      try {
        // Intentar rotar 90 grados
        if (window.screen.orientation.type.includes('landscape')) {
          window.screen.orientation.lock('portrait').catch(e => console.error(e));
        } else {
          window.screen.orientation.lock('landscape').catch(e => console.error(e));
        }
      } catch (e) {
        console.error('No se pudo rotar la pantalla:', e);
        alert('La rotación de pantalla no está disponible en este dispositivo.');
      }
    } else {
      alert('La API de orientación de pantalla no está disponible en este dispositivo.');
    }
  };
  
  // Función para compartir ubicación
  const shareLocation = () => {
    if (navigator.share) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const shareData = {
          title: 'Mi ubicación actual',
          text: `Estoy aquí: ${latitude}, ${longitude}`,
          url: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
        };
        navigator.share(shareData).catch(err => console.error('Error compartiendo:', err));
      }, (err) => {
        console.error('Error obteniendo posición:', err);
        alert('No se pudo obtener tu ubicación actual.');
      });
    } else {
      alert('La función de compartir no está disponible en este navegador.');
    }
  };

  return (
    <div className="fixed bottom-24 md:absolute md:bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto z-50">
      {/* Panel principal de botones - usando fixed para móvil y absolute para desktop */}
      <div className="bg-black bg-opacity-70 p-2 rounded-full shadow-lg flex items-center space-x-2">
        {/* Botón de grabar/detener - principal */}
        <button 
          onClick={isRecording ? endTrip : startTrip}
          className={`w-12 h-12 flex items-center justify-center rounded-full ${
            isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          } transition-colors`}
          title={isRecording ? "Finalizar viaje" : "Iniciar viaje"}
        >
          {isRecording ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>

        {/* Botón de centrar en posición actual */}
        <button 
          onClick={centerOnPosition} 
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors"
          title="Centrar en posición actual"
        >
          <FaCrosshairs className="text-white" />
        </button>
        
        {/* Botón para seguimiento automático */}
        <button 
          onClick={() => setAutoFollow(!autoFollow)} 
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            autoFollow ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-600 hover:bg-gray-700'
          }`}
          title={autoFollow ? "Desactivar seguimiento automático" : "Activar seguimiento automático"}
        >
          <FaLocationArrow className={`text-white ${autoFollow ? 'animate-pulse' : ''}`} />
        </button>
        
        {/* Botón para mostrar/ocultar navegación */}
        {activeTrip && (
          <button 
            onClick={() => setNavigationSidebarOpen(!navigationSidebarOpen)} 
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              navigationSidebarOpen ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={navigationSidebarOpen ? "Ocultar navegador" : "Mostrar navegador"}
          >
            <FaListUl className="text-white" />
          </button>
        )}

        {/* Botón para mostrar/ocultar puntos de interés */}
        <button 
          onClick={() => setShowLandmarks(!showLandmarks)} 
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            showLandmarks ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'
          }`}
          title={showLandmarks ? "Ocultar puntos de interés" : "Mostrar puntos de interés"}
        >
          {showLandmarks ? <FaEye className="text-white" /> : <FaEyeSlash className="text-white" />}
        </button>
        
        {/* Botón de configuración */}
        <button 
          onClick={toggleSettingsMenu} 
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            showSettingsMenu ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-600 hover:bg-gray-700'
          }`}
          title="Configuración del mapa"
        >
          <FaCog className="text-white" />
        </button>
        
        {/* Botón para más opciones */}
        <button 
          onClick={toggleMoreOptions} 
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            showMoreOptions ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
          }`}
          title="Más opciones"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </button>
      </div>
      
      {/* Menú de configuración - posicionado encima del panel de control */}
      {showSettingsMenu && (
        <div className="absolute bottom-full mb-2 bg-black bg-opacity-90 rounded-lg shadow-lg p-3 max-h-60 overflow-y-auto w-full min-w-[280px] z-[200]">
          <h3 className="text-white text-sm font-medium mb-2 border-b border-gray-700 pb-1">Configuración del mapa</h3>
          
          {/* Selector de fuente de mapas */}
          <div className="mb-3 relative z-[250]">
            <label className="text-white text-xs font-medium mb-2 block">Fuente de mapas:</label>
            <div className="w-full relative">
              <MapSourceSelector
                mapSource={mapSource}
                setMapSource={setMapSource}
                offlineMapsAvailable={offlineMapsAvailable}
                tripId={tripId}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Botones para cambiar el tipo de mapa */}
            <button 
              onClick={() => changeMapMode('standard')} 
              className={`flex items-center px-3 py-2 rounded-md text-white text-sm transition-colors ${
                mapMode === 'standard' ? 'bg-blue-700 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <FaMap className="h-4 w-4 mr-2" />
              Estándar
            </button>
            
            <button 
              onClick={() => changeMapMode('satellite')} 
              className={`flex items-center px-3 py-2 rounded-md text-white text-sm transition-colors ${
                mapMode === 'satellite' ? 'bg-blue-700 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <FaSatellite className="h-4 w-4 mr-2" />
              Satélite
            </button>
            
            <button 
              onClick={() => changeMapMode('terrain')} 
              className={`flex items-center px-3 py-2 rounded-md text-white text-sm transition-colors ${
                mapMode === 'terrain' ? 'bg-blue-700 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <MdTerrain className="h-4 w-4 mr-2" />
              Terreno
            </button>
            
            <button 
              onClick={toggleFullscreen}
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
            >
              {fullscreen ? <FaCompress className="h-4 w-4 mr-2" /> : <FaExpand className="h-4 w-4 mr-2" />}
              {fullscreen ? 'Salir P. Comp.' : 'Pant. Completa'}
            </button>

            {/* Opción para rotar pantalla */}
            <button 
              onClick={rotateScreen}
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
            >
              <MdScreenRotation className="h-4 w-4 mr-2" />
              Rotar pantalla
            </button>

            {/* Opción para modo noche */}
            <button 
              onClick={() => document.body.classList.toggle('dark-mode')}
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Modo noche
            </button>
          </div>
        </div>
      )}
      
      {/* Menú desplegable de más opciones - posicionado encima del panel de control */}
      {showMoreOptions && (
        <div className="absolute bottom-full mb-2 bg-black bg-opacity-90 rounded-lg shadow-lg p-3 max-h-60 overflow-y-auto w-full">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleOptionClick(createLandmark)}
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
            >
              <MdAddLocation className="h-4 w-4 mr-2" />
              Crear punto
            </button>
            
            <button 
              onClick={handleOptionClick(downloadLandmarks)}
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
            >
              <MdCloudDownload className="h-4 w-4 mr-2" />
              Descargar PDI
            </button>
            
            {activeTrip && (
              <button 
                onClick={handleOptionClick(clearPlannedTrip)}
                className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
              >
                <MdDeleteForever className="h-4 w-4 mr-2" />
                Borrar ruta
              </button>
            )}
            
            <button 
              onClick={handleOptionClick(shareLocation)}
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Compartir ubicación
            </button>
            
            {activeTrip && (
              <button 
                onClick={handleOptionClick(() => setShowPlannedRoute(!showPlannedRoute))}
                className={`flex items-center px-3 py-2 rounded-md text-white text-sm transition-colors ${
                  showPlannedRoute ? 'bg-indigo-700 hover:bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <FaRoute className="h-4 w-4 mr-2" />
                {showPlannedRoute ? 'Ocultar ruta' : 'Mostrar ruta'}
              </button>
            )}
            
            <button 
              onClick={handleOptionClick(() => alert("DashCam v2.0\nCreado por TuNombre\nVersión: 2.0.0"))}
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white text-sm transition-colors"
            >
              <MdHelp className="h-4 w-4 mr-2" />
              Acerca de
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ControlPanel;
