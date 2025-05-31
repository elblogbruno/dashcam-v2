import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  FaCamera, FaSync, FaMapMarkerAlt, FaTachometerAlt, FaAngleLeft, FaAngleRight,
  FaDesktop, FaTimes, FaBars, FaPlay, FaStop, FaMicrophone, FaMicrophoneSlash,
  FaRoute, FaCar, FaMicrochip, FaMemory, FaThermometerHalf, FaClock, FaMap,
  FaCalendarAlt, FaHdd
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import MJPEGCamera from '../MJPEGCamera';
// import WebRTCCamera from '../WebRTCCamera'; // DISABLED

/**
 * Versión simplificada del Dashboard para pantallas pequeñas o táctiles
 */
function SimplifiedView({
  currentSlide,
  streamingMode,
  location,
  landmark,
  cameraStatus,
  cameraImages,
  isRefreshing,
  isRecording,
  isMicEnabled,
  systemStatus,
  tripStats,
  activeTrip,
  showNavbar,
  onPrevSlide,
  onNextSlide,
  onToggleNavbar,
  onToggleView,
  onManualRefreshCamera,
  // onHandleWebRTCError, // DISABLED
  onStartRecording,
  onStopRecording,
  onToggleMicrophone,
  onStartNavigation,
  formatBytes,
  formatTime
}) {
  // Referencia para el manejo de toques
  const touchStartRef = useRef(null);
  
  // Manejo de eventos táctiles
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    
    // Si el deslizamiento es significativo (más de 50px)
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Deslizamiento hacia la izquierda -> siguiente
        onNextSlide();
      } else {
        // Deslizamiento hacia la derecha -> anterior
        onPrevSlide();
      }
    }
    
    touchStartRef.current = null;
  };

  // Obtener el texto del modo de streaming
  const getStreamingModeText = () => {
    switch(streamingMode) {
      case 0:
        return 'MJPEG (baja latencia)';
      // case 1:
      //   return 'WebRTC (tiempo real)'; // DISABLED
      case 2:
        return 'HTTP (estable)';
      default:
        return 'Desconocido';
    }
  };

  // Renderizar contenido según la diapositiva actual
  const renderSlideContent = () => {
    switch(currentSlide) {
      case 0: // Cámara Frontal
        return (
          <div className="bg-white rounded-lg shadow-md overflow-hidden w-full h-full max-h-[85vh]">
            <div className="relative h-full bg-black flex justify-center items-center">
              {/* Indicador del modo de streaming */}
              <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-md flex items-center">
                <FaCamera className="mr-1" /> 
                {getStreamingModeText()}
              </div>
              
              {cameraStatus.road_camera ? (
                streamingMode === 0 ? (
                  <MJPEGCamera 
                    cameraType="road" 
                    height="100%" 
                    className="w-full"
                    onError={(error) => console.error('MJPEG error:', error)}
                  />
                ) : streamingMode === 1 ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="text-yellow-500 text-3xl mb-2">⚠️</div>
                      <p className="text-white text-sm">WebRTC deshabilitado</p>
                      <p className="text-gray-400 text-xs">Use MJPEG en su lugar</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-full">
                    {cameraImages.road ? (
                      <img 
                        src={cameraImages.road} 
                        alt="Road View" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                        <FaCamera className="text-3xl sm:text-5xl mb-2 sm:mb-4" />
                        <div className="text-sm sm:text-xl text-gray-400 mb-2 sm:mb-4">Cargando cámara frontal...</div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => onManualRefreshCamera('road')}
                      disabled={isRefreshing.road}
                      className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full"
                      title="Refresh road camera"
                    >
                      <FaSync className={`text-lg ${isRefreshing.road ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white p-4">
                  <div className="text-xl sm:text-2xl text-red-400 mb-2 sm:mb-4 text-center">Cámara frontal no disponible</div>
                  <div className="text-sm sm:text-xl text-gray-400 mb-2 sm:mb-4 text-center">Verifique la conexión de la cámara</div>
                  <button 
                    onClick={() => onManualRefreshCamera('road')}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm sm:text-lg flex items-center"
                  >
                    <FaSync className="mr-2" /> Intentar de nuevo
                  </button>
                </div>
              )}
              
              {/* Overlay for speed and landmark */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 sm:p-4 flex justify-between z-10">
                <div className="flex items-center text-base sm:text-xl">
                  <FaTachometerAlt className="mr-1 sm:mr-2" />
                  <span>{Math.round(location.speed)} km/h</span>
                </div>
                {landmark && (
                  <div className="flex items-center text-base sm:text-xl">
                    <FaMapMarkerAlt className="mr-1 sm:mr-2 text-red-500" />
                    <span className="truncate max-w-[120px] sm:max-w-full">{landmark.name}</span>
                  </div>
                )}
              </div>
              
              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-full animate-pulse z-10 text-sm sm:text-lg">
                  <span className="h-2 w-2 sm:h-3 sm:w-3 bg-white rounded-full mr-1 sm:mr-2"></span>
                  <span>REC</span>
                </div>
              )}
            </div>
          </div>
        );
      
      case 1: // Cámara Interior
        return (
          <div className="bg-white rounded-lg shadow-md overflow-hidden w-full h-full max-h-[75vh]">
            <div className="relative h-full bg-black flex justify-center items-center">
              {/* Indicador del modo de streaming */}
              <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-md flex items-center">
                <FaCamera className="mr-1" /> 
                {getStreamingModeText()}
              </div>
              
              {cameraStatus.interior_camera ? (
                streamingMode === 0 ? (
                  <MJPEGCamera 
                    cameraType="interior" 
                    height="100%" 
                    className="w-full"
                    onError={(error) => console.error('MJPEG error:', error)}
                  />
                ) : streamingMode === 1 ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="text-yellow-500 text-3xl mb-2">⚠️</div>
                      <p className="text-white text-sm">WebRTC deshabilitado</p>
                      <p className="text-gray-400 text-xs">Use MJPEG en su lugar</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-full">
                    {cameraImages.interior ? (
                      <img 
                        src={cameraImages.interior} 
                        alt="Interior View" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                        <FaCamera className="text-3xl sm:text-5xl mb-2 sm:mb-4" />
                        <div className="text-sm sm:text-xl text-gray-400 mb-2">Cargando cámara interior...</div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => onManualRefreshCamera('interior')}
                      disabled={isRefreshing.interior}
                      className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full"
                      title="Refresh interior camera"
                    >
                      <FaSync className={`text-lg ${isRefreshing.interior ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white p-4">
                  <div className="text-xl sm:text-2xl text-red-400 mb-2 sm:mb-4 text-center">Cámara interior no disponible</div>
                  <div className="text-sm sm:text-xl text-gray-400 mb-2 sm:mb-4 text-center">Verifique la conexión de la cámara</div>
                  <button 
                    onClick={() => onManualRefreshCamera('interior')}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm sm:text-lg flex items-center"
                  >
                    <FaSync className="mr-2" /> Intentar de nuevo
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      
      case 2: // Controles
        return (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-2xl overflow-y-auto max-h-[85vh]">
            <h3 className="text-xl sm:text-2xl font-medium text-gray-800 mb-4 sm:mb-6 text-center">Controles de Grabación</h3>
            
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              {!isRecording ? (
                <button 
                  className="bg-green-500 hover:bg-green-600 text-white py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl"
                  onClick={onStartRecording}
                >
                  <FaPlay className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                  Iniciar Grabación
                </button>
              ) : (
                <button 
                  className="bg-red-500 hover:bg-red-600 text-white py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl"
                  onClick={onStopRecording}
                >
                  <FaStop className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                  Detener Grabación
                </button>
              )}
              
              <button 
                className={`py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl ${isMicEnabled ? 'bg-dashcam-500 hover:bg-dashcam-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}
                onClick={onToggleMicrophone}
              >
                {isMicEnabled ? (
                  <>
                    <FaMicrophone className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                    Micrófono Activado
                  </>
                ) : (
                  <>
                    <FaMicrophoneSlash className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                    Micrófono Desactivado
                  </>
                )}
              </button>
              
              {activeTrip && (
                <button 
                  onClick={onStartNavigation}
                  className="bg-dashcam-600 hover:bg-dashcam-700 text-white py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl"
                >
                  <FaRoute className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                  Iniciar Navegación
                </button>
              )}
            </div>
          </div>
        );
      
      case 3: // Información
        return (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full max-w-2xl overflow-y-auto max-h-[85vh] px-2">
            {/* Location information */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
              <div className="bg-gray-50 p-3 sm:p-4 border-b border-gray-200"> 
                <h3 className="text-lg sm:text-xl font-medium text-gray-800">Ubicación</h3>
              </div>
              <div className="p-3 sm:p-5">
                <div className="mb-3 sm:mb-4">
                  <div className="text-base sm:text-lg text-gray-500 mb-1">Coordenadas Actuales:</div>
                  <div className="text-base sm:text-xl font-medium flex items-center flex-wrap">
                    <FaMapMarkerAlt className="text-red-500 mr-1 flex-shrink-0" />
                    <span className="break-all">
                      {location && location.lat ? location.lat.toFixed(6) : '0.000000'}, 
                      {location && location.lon ? location.lon.toFixed(6) : '0.000000'}
                    </span>
                  </div>
                </div>
                
                <div className="mb-3 sm:mb-4"> 
                  <div className="text-base sm:text-lg text-gray-500 mb-1">Velocidad:</div>
                  <div className="text-base sm:text-xl font-medium flex items-center">
                    <FaCar className="text-dashcam-600 mr-2 text-base sm:text-xl flex-shrink-0" />
                    {Math.round(location.speed)} km/h
                  </div>
                </div>
                
                {landmark && (
                  <div> 
                    <div className="text-base sm:text-lg text-gray-500 mb-1">Punto de Interés Cercano:</div>
                    <div className="text-base sm:text-xl font-medium text-dashcam-700">{landmark.name}</div>
                    {landmark.description && (
                      <div className="text-sm sm:text-lg text-gray-600 mt-1">{landmark.description}</div>
                    )}
                    <div className="text-sm sm:text-base text-gray-500 mt-1">
                      {landmark.distance !== undefined 
                        ? `${landmark.distance < 1000 
                            ? `${Math.round(landmark.distance)}m de distancia` 
                            : `${(landmark.distance / 1000).toFixed(1)}km de distancia`}`
                        : 'Distancia desconocida'}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Trip Stats */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-5">
              <h3 className="text-lg sm:text-xl font-medium text-gray-800 mb-3 sm:mb-4">Estadísticas de Viaje</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-5">
                <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-dashcam-600">{tripStats.total_trips || 0}</div>
                  <div className="text-sm sm:text-lg text-gray-500">Viajes Totales</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-dashcam-600">
                    {Math.round(tripStats.distance_traveled || 0)} km
                  </div>
                  <div className="text-sm sm:text-lg text-gray-500">Distancia</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-dashcam-600">
                    {Math.floor((tripStats.recording_time || 0) / 3600)}h
                  </div>
                  <div className="text-sm sm:text-lg text-gray-500">Tiempo Grabado</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-dashcam-600">
                    {tripStats.recent_trips ? tripStats.recent_trips.length : 0}
                  </div>
                  <div className="text-sm sm:text-lg text-gray-500">Viajes Recientes</div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 4: // Sistema
        return (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full max-w-2xl overflow-y-auto max-h-[85vh] px-2">
            {/* System health */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
              <div className="bg-gray-50 p-3 sm:p-4 border-b border-gray-200">
                <h3 className="text-lg sm:text-xl font-medium text-gray-800">Estado del Sistema</h3>
              </div>
              <div className="p-3 sm:p-5">
                <div className="space-y-3 sm:space-y-5">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-base sm:text-lg text-gray-500">CPU:</span>
                      <span className="text-base sm:text-lg font-medium">{systemStatus.cpu_usage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                      <div 
                        className={`h-full rounded-full ${
                          systemStatus.cpu_usage > 80 ? 'bg-red-500' : 
                          systemStatus.cpu_usage > 50 ? 'bg-yellow-500' : 
                          'bg-green-500'
                        }`}
                        style={{ width: `${systemStatus.cpu_usage}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-base sm:text-lg text-gray-500">Memoria:</span>
                      <span className="text-base sm:text-lg font-medium">{systemStatus.memory_usage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                      <div 
                        className={`h-full rounded-full ${
                          systemStatus.memory_usage > 80 ? 'bg-red-500' : 
                          systemStatus.memory_usage > 50 ? 'bg-yellow-500' : 
                          'bg-green-500'
                        }`}
                        style={{ width: `${systemStatus.memory_usage}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-base sm:text-lg text-gray-500">Temperatura:</span>
                      <span className="text-base sm:text-lg font-medium">{systemStatus.cpu_temp}°C</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-base sm:text-lg text-gray-500">Tiempo Activo:</span>
                      <span className="text-base sm:text-lg font-medium">{systemStatus.uptime}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 sm:mt-5">
                  <div className="text-base sm:text-lg text-gray-500 mb-1">Almacenamiento:</div>
                  <div className="mb-2 flex justify-between">
                    <span className="text-sm sm:text-base">
                      {formatBytes(systemStatus.storage.total - systemStatus.storage.available)} de {formatBytes(systemStatus.storage.total)}
                    </span>
                    <span className="text-sm sm:text-base font-medium">
                      {systemStatus.storage.percent_used}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                    <div 
                      className={`h-full rounded-full ${
                        systemStatus.storage.percent_used > 90 ? 'bg-red-500' : 
                        systemStatus.storage.percent_used > 70 ? 'bg-yellow-500' : 
                        'bg-green-500'
                      }`}
                      style={{ width: `${systemStatus.storage.percent_used}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Navigation */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-5">
              <h3 className="text-lg sm:text-xl font-medium text-gray-800 mb-3 sm:mb-4">Navegación Rápida</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Link to="/map" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                  <FaMap className="mr-1 sm:mr-2" />
                  Mapa en Vivo
                </Link>
                <Link to="/trips" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                  <FaRoute className="mr-1 sm:mr-2" />
                  Planificar Viaje
                </Link>
                <Link to="/calendar" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                  <FaCalendarAlt className="mr-1 sm:mr-2" />
                  Calendario
                </Link>
                <Link to="/storage" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                  <FaHdd className="mr-1 sm:mr-2" />
                  Almacenamiento
                </Link>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div 
      className="w-full flex-grow relative overflow-hidden" 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Contenido según el slide actual - ocupa todo el espacio disponible */}
      <div className="absolute inset-0 flex items-center justify-center p-2">
        {renderSlideContent()}
      </div>
      
      {/* Botón para mostrar/ocultar la navegación - siempre visible */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-50 flex flex-col space-y-2">
        {/* Toggle entre vista normal y simplificada */}
        <button 
          onClick={onToggleView}
          className="p-2 sm:p-3 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full shadow-lg transition-all"
          title="Cambiar a vista normal"
        >
          <FaDesktop />
        </button>
        
        {/* Botón de navegación */}
        <button 
          onClick={onToggleNavbar}
          className="p-2 sm:p-3 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full shadow-lg transition-all"
          title={showNavbar ? "Ocultar navegación" : "Mostrar navegación"}
        >
          {showNavbar ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      
      {/* Navegación por deslizamiento - ahora solo visible cuando se activa */}
      {showNavbar && (
        <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex flex-col z-40">
          <div className="mb-2 bg-black bg-opacity-70 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
            <div className="flex justify-between items-center text-white">
              <button 
                onClick={onPrevSlide}
                className="p-2 sm:p-3 bg-black bg-opacity-40 hover:bg-opacity-60 rounded-full focus:outline-none transition-colors"
              >
                <FaAngleLeft className="text-base sm:text-xl" />
              </button>
              
              <div className="text-base sm:text-lg font-medium">
                {currentSlide === 0 && "Cámara Frontal"}
                {currentSlide === 1 && "Cámara Interior"}
                {currentSlide === 2 && "Controles"}
                {currentSlide === 3 && "Información"}
                {currentSlide === 4 && "Sistema"}
              </div>
              
              <button 
                onClick={onNextSlide}
                className="p-2 sm:p-3 bg-black bg-opacity-40 hover:bg-opacity-60 rounded-full focus:outline-none transition-colors"
              >
                <FaAngleRight className="text-base sm:text-xl" />
              </button>
            </div>
            
            {/* Indicador de slide actual */}
            <div className="flex justify-center mt-1 sm:mt-2">
              {[0, 1, 2, 3, 4].map(index => (
                <div 
                  key={index}
                  className={`mx-1 h-1 sm:h-2 rounded-full transition-all duration-300 ${
                    currentSlide === index ? 'w-6 sm:w-8 bg-white' : 'w-1 sm:w-2 bg-white bg-opacity-40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Instrucciones de deslizamiento - ahora en la parte inferior */}
      <div className="absolute bottom-2 sm:bottom-4 left-0 right-0 text-center">
        <div className="bg-black bg-opacity-40 text-white text-xs sm:text-sm py-1 sm:py-2 px-3 sm:px-4 rounded-full inline-block backdrop-blur-sm">
          Desliza para cambiar de vista
        </div>
      </div>
    </div>
  );
}

SimplifiedView.propTypes = {
  currentSlide: PropTypes.number.isRequired,
  streamingMode: PropTypes.number.isRequired,
  location: PropTypes.object.isRequired,
  landmark: PropTypes.object,
  cameraStatus: PropTypes.object.isRequired,
  cameraImages: PropTypes.object.isRequired,
  isRefreshing: PropTypes.object.isRequired,
  isRecording: PropTypes.bool.isRequired,
  isMicEnabled: PropTypes.bool.isRequired,
  systemStatus: PropTypes.object.isRequired,
  tripStats: PropTypes.object.isRequired,
  activeTrip: PropTypes.object,
  showNavbar: PropTypes.bool.isRequired,
  onPrevSlide: PropTypes.func.isRequired,
  onNextSlide: PropTypes.func.isRequired,
  onToggleNavbar: PropTypes.func.isRequired,
  onToggleView: PropTypes.func.isRequired,
  onManualRefreshCamera: PropTypes.func.isRequired,
  // onHandleWebRTCError: PropTypes.func.isRequired, // DISABLED
  onStartRecording: PropTypes.func.isRequired,
  onStopRecording: PropTypes.func.isRequired,
  onToggleMicrophone: PropTypes.func.isRequired,
  onStartNavigation: PropTypes.func.isRequired,
  formatBytes: PropTypes.func.isRequired,
  formatTime: PropTypes.func.isRequired
};

export default SimplifiedView;
