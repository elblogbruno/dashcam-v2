import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FaCamera, FaSync, FaTachometerAlt, FaMapMarkerAlt } from 'react-icons/fa';
import MJPEGCamera from '../MJPEGCamera';
import WebRTCCamera from '../WebRTCCamera';
import PerformanceToggle from '../PerformanceToggle';

/**
 * Componente que muestra una vista de cámara con diferentes opciones de streaming
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
  showStats = false
}) {
  // Estado local para mostrar/ocultar estadísticas
  const [localShowStats, setLocalShowStats] = useState(showStats);

  // Convertir modo de streaming a texto para mostrar
  const getStreamingModeText = () => {
    switch(streamingMode) {
      case 0:
        return 'MJPEG (baja latencia)';
      case 1:
        return 'WebRTC (tiempo real)';
      case 2:
        return 'HTTP (estable)';
      default:
        return 'Desconocido';
    }
  };

  // Manejar errores de streaming
  const handleStreamError = (error) => {
    if (onError) {
      onError(cameraType, error);
    }
  };

  // Alternar estadísticas de rendimiento
  const toggleStats = () => {
    setLocalShowStats(!localShowStats);
  };

  // Función para reiniciar la cámara desde el servidor
  const resetCamera = async () => {
    try {
      const response = await fetch(`/api/cameras/reset/${cameraType}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Cámara ${cameraType === 'road' ? 'frontal' : 'interior'} reiniciada: ${result.message}`);
      } else {
        alert(`Error al reiniciar la cámara ${cameraType === 'road' ? 'frontal' : 'interior'}`);
      }
    } catch (error) {
      console.error(`Error al reiniciar la cámara ${cameraType}:`, error);
      alert(`Error de conexión al reiniciar la cámara`);
    }
  };

  // Renderizar la cámara según el modo de streaming
  const renderCamera = () => {
    const cameraEnabled = cameraType === 'road' ? cameraStatus.road_camera : cameraStatus.interior_camera;

    if (!cameraEnabled) {
      return (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white p-4">
          <div className="text-xl sm:text-2xl text-red-400 mb-2 sm:mb-4 text-center">
            Cámara {cameraType === 'road' ? 'frontal' : 'interior'} no disponible
          </div>
          <div className="text-sm sm:text-xl text-gray-400 mb-2 sm:mb-4 text-center">
            Verifique la conexión de la cámara
          </div>
          <button 
            onClick={() => onRefresh(cameraType)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm sm:text-lg flex items-center mr-2"
          >
            <FaSync className="mr-2" /> Intentar de nuevo
          </button>
          <button
            onClick={resetCamera}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm sm:text-lg flex items-center"
          >
            <FaCamera className="mr-2" /> Reiniciar cámara
          </button>
        </div>
      );
    }

    switch(streamingMode) {
      case 0: // MJPEG
        return (
          <MJPEGCamera 
            cameraType={cameraType} 
            height="100%" 
            className="w-full"
            onError={handleStreamError}
            showStats={localShowStats}
          />
        );
      case 1: // WebRTC
        return (
          <WebRTCCamera 
            cameraType={cameraType} 
            height="100%" 
            className="w-full"
            onError={handleStreamError}
            showStats={localShowStats}
          />
        );
      case 2: // HTTP
      default:
        return (
          <div className="relative h-full">
            {cameraImages[cameraType] ? (
              <img 
                src={cameraImages[cameraType]} 
                alt={`${cameraType === 'road' ? 'Road' : 'Interior'} View`} 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                <FaCamera className="text-3xl sm:text-5xl mb-2 sm:mb-4" />
                <div className="text-sm sm:text-xl text-gray-400 mb-2 sm:mb-4">
                  Cargando cámara {cameraType === 'road' ? 'frontal' : 'interior'}...
                </div>
              </div>
            )}
            
            <button 
              onClick={() => onRefresh(cameraType)}
              disabled={isRefreshing[cameraType]}
              className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full"
              title={`Actualizar cámara ${cameraType === 'road' ? 'frontal' : 'interior'}`}
            >
              <FaSync className={`text-lg ${isRefreshing[cameraType] ? 'animate-spin' : ''}`} />
            </button>
            
            <button 
              onClick={resetCamera}
              className="absolute top-4 left-16 bg-black bg-opacity-50 text-white p-2 rounded-full"
              title={`Reiniciar cámara ${cameraType === 'road' ? 'frontal' : 'interior'}`}
            >
              <FaCamera className="text-lg" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="relative h-36 sm:h-48 md:h-56 lg:h-64 bg-black flex justify-center items-center">
        {/* Indicador del modo de streaming */}
        <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-md flex items-center">
          <FaCamera className="mr-1" /> 
          {getStreamingModeText()}
        </div>
        
        {/* Botón para activar estadísticas de rendimiento (solo disponible en MJPEG y WebRTC) */}
        {(streamingMode === 0 || streamingMode === 1) && (
          <div className="absolute top-2 left-2 z-10">
            <PerformanceToggle 
              showStats={localShowStats}
              onToggle={toggleStats}
            />
          </div>
        )}
        
        {/* Cámara según modo de streaming */}
        {renderCamera()}
        
        {/* Overlay para velocidad y punto de interés */}
        {showSpeedOverlay && speedData && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 sm:p-4 flex justify-between z-10">
            <div className="flex items-center text-base sm:text-xl">
              <FaTachometerAlt className="mr-1 sm:mr-2" />
              <span>{Math.round(speedData.speed)} km/h</span>
            </div>
            {landmarkData && (
              <div className="flex items-center text-base sm:text-xl">
                <FaMapMarkerAlt className="mr-1 sm:mr-2 text-red-500" />
                <span className="truncate max-w-[120px] sm:max-w-full">{landmarkData.name}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Indicador de grabación */}
        {isRecording && (
          <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-full animate-pulse z-10 text-sm sm:text-lg">
            <span className="h-2 w-2 sm:h-3 sm:w-3 bg-white rounded-full mr-1 sm:mr-2"></span>
            <span>REC</span>
          </div>
        )}
      </div>
      
      {title && (
        <div className="p-2 sm:p-3 border-t border-gray-200">
          <h3 className="font-medium text-gray-800 text-sm sm:text-base">{title}</h3>
        </div>
      )}
    </div>
  );
}

// Definir props y sus tipos
CameraView.propTypes = {
  cameraType: PropTypes.oneOf(['road', 'interior']).isRequired,
  streamingMode: PropTypes.number.isRequired,
  cameraStatus: PropTypes.object.isRequired,
  cameraImages: PropTypes.object.isRequired,
  isRefreshing: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onError: PropTypes.func,
  title: PropTypes.string,
  showSpeedOverlay: PropTypes.bool,
  speedData: PropTypes.object,
  landmarkData: PropTypes.object,
  isRecording: PropTypes.bool,
  showStats: PropTypes.bool
};

export default CameraView;
