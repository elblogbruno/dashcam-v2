import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FaCamera, FaSync, FaTachometerAlt, FaMapMarkerAlt, FaExclamationTriangle, FaExpand, FaCompress } from 'react-icons/fa';
import MJPEGCamera from '../MJPEGCamera';
// import WebRTCCamera from '../WebRTCCamera'; // DISABLED
import PerformanceToggle from '../PerformanceToggle';

/**
 * Componente que muestra una vista de cámara con diferentes opciones de streaming
 * Versión mejorada con soporte para expandir/contraer y mejor aprovechamiento de espacio
 */
function CameraView({ 
  cameraType, 
  streamingMode, 
  cameraStatus, 
  cameraImages,
  isRefreshing,
  onRefresh,
  onError,
  title,
  showSpeedOverlay = false,
  speedData = null,
  landmarkData = null,
  isRecording = false,
  showStats = false,
  darkMode = false
}) {
  // Estado para modo expandido
  const [expanded, setExpanded] = useState(false);
  
  // Estado local para mostrar/ocultar estadísticas
  const [localShowStats, setLocalShowStats] = useState(showStats);

  // Función para alternar el modo expandido
  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  // Convertir modo de streaming a texto para mostrar
  const getStreamingModeText = () => {
    switch(streamingMode) {
      case 0:
        return 'MJPEG';
      // case 1:
      //   return 'WebRTC'; // DISABLED
      case 2:
        return 'HTTP';
      default:
        return 'Desconocido';
    }
  };

  // Verificar si la cámara está disponible
  const isCameraAvailable = cameraType === 'road' ? cameraStatus.road_camera : cameraStatus.interior_camera;
  
  // Determinar clase para el contenedor basado en el estado expandido
  const containerClass = expanded ? 
    "fixed inset-0 z-50 p-4 bg-black bg-opacity-90 flex items-center justify-center" : 
    `${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md overflow-hidden h-full flex flex-col`;
  
  // Determinar clase para el título
  const titleClass = expanded ? 
    "absolute top-4 left-4 text-white text-lg font-bold z-10" : 
    `${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-dashcam-800'} px-4 py-2 font-medium flex justify-between items-center`;
  
  // Determinar clase para el contenedor de acciones
  const actionsClass = expanded ? 
    "absolute top-4 right-4 flex space-x-2 z-10" : 
    "flex space-x-2";

  return (
    <div className={`${containerClass} ${expanded ? '' : 'relative'}`}>
      {/* Título y controles */}
      <div className={titleClass}>
        <div className="flex items-center">
          <FaCamera className="mr-2" />
          {title}
        </div>
        
        <div className={actionsClass}>
          {/* Botón para expandir/contraer la vista */}
          <button 
            onClick={toggleExpand}
            className={`p-1 rounded-md ${darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
            title={expanded ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {expanded ? <FaCompress /> : <FaExpand />}
          </button>
          
          {/* Botón para actualizar la cámara */}
          <button 
            onClick={() => onRefresh(cameraType)}
            className={`p-1 rounded-md ${darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-700'} ${isRefreshing[cameraType] ? 'animate-spin' : ''}`}
            disabled={isRefreshing[cameraType]}
            title="Actualizar vista"
          >
            <FaSync />
          </button>
        </div>
      </div>
      
      {/* Contenido principal - cámaras */}
      <div className={`${expanded ? 'w-full h-full' : 'flex-1 relative'}`}>
        {!isCameraAvailable ? (
          // Mensaje cuando la cámara no está disponible
          <div className={`w-full h-full flex flex-col items-center justify-center ${darkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
            <FaExclamationTriangle className="text-yellow-500 text-4xl mb-3" />
            <p className="text-center">Cámara {cameraType === 'road' ? 'frontal' : 'interior'} no disponible</p>
            <button 
              onClick={() => onRefresh(cameraType)} 
              className={`mt-3 px-4 py-2 rounded-md flex items-center ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
            >
              <FaSync className="mr-2" /> Reintentar
            </button>
          </div>
        ) : streamingMode === 0 ? (
          // MJPEG Streaming
          <div className="relative w-full h-full">
            <MJPEGCamera
              cameraType={cameraType}
              onError={() => onError(cameraType, new Error("MJPEG stream error"))}
              className={`w-full h-full object-cover ${expanded ? 'max-h-screen' : ''}`}
            />
            {/* Overlay para velocidad */}
            {showSpeedOverlay && speedData && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-md flex flex-col items-end">
                <div className="flex items-center">
                  <FaTachometerAlt className="mr-1" />
                  <span className="font-bold">{Math.round(speedData.speed)} km/h</span>
                </div>
                {landmarkData && (
                  <div className="flex items-center text-xs mt-1">
                    <FaMapMarkerAlt className="mr-1 text-red-500" />
                    <span>{landmarkData.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : streamingMode === 1 ? (
          // WebRTC Streaming - DISABLED
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="text-center p-4">
              <FaExclamationTriangle className="mx-auto mb-2 text-yellow-500 text-2xl" />
              <p className="text-sm text-gray-500">WebRTC deshabilitado</p>
              <p className="text-xs text-gray-400">Use MJPEG en su lugar</p>
            </div>
          </div>
        ) : (
          // HTTP Streaming (imágenes estáticas)
          <div className="relative w-full h-full flex justify-center items-center bg-gray-900">
            {isRefreshing[cameraType] ? (
              <div className="text-center">
                <FaSync className="animate-spin text-2xl text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Cargando imagen...</p>
              </div>
            ) : cameraImages[cameraType] ? (
              <img 
                src={cameraImages[cameraType]} 
                alt={`${cameraType} camera`} 
                className={`object-contain ${expanded ? 'max-h-screen w-auto' : 'max-w-full max-h-full'}`}
              />
            ) : (
              <div className="text-center">
                <FaExclamationTriangle className="text-yellow-500 text-3xl mx-auto mb-2" />
                <p className="text-sm text-gray-400">No hay imagen disponible</p>
              </div>
            )}
            
            {/* Overlay para velocidad */}
            {showSpeedOverlay && speedData && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-md flex flex-col items-end">
                <div className="flex items-center">
                  <FaTachometerAlt className="mr-1" />
                  <span className="font-bold">{Math.round(speedData.speed)} km/h</span>
                </div>
                {landmarkData && (
                  <div className="flex items-center text-xs mt-1">
                    <FaMapMarkerAlt className="mr-1 text-red-500" />
                    <span>{landmarkData.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Indicador de grabación */}
        {isRecording && (
          <div className="absolute top-2 left-2 flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse mr-1"></div>
            <span className="text-xs text-white bg-black bg-opacity-50 px-1 rounded">REC</span>
          </div>
        )}
      </div>
      
      {/* Footer con información del modo */}
      {!expanded && (
        <div className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'} px-3 py-1 text-xs flex justify-between items-center`}>
          <div>
            Modo: {getStreamingModeText()}
          </div>
          
          {showStats && (
            <PerformanceToggle />
          )}
        </div>
      )}
    </div>
  );
}

CameraView.propTypes = {
  cameraType: PropTypes.string.isRequired,
  streamingMode: PropTypes.number.isRequired,
  cameraStatus: PropTypes.object.isRequired,
  cameraImages: PropTypes.object.isRequired,
  isRefreshing: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  showSpeedOverlay: PropTypes.bool,
  speedData: PropTypes.object,
  landmarkData: PropTypes.object,
  isRecording: PropTypes.bool,
  showStats: PropTypes.bool,
  darkMode: PropTypes.bool
};

export default CameraView;
