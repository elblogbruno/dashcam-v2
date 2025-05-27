import React from 'react';
import PropTypes from 'prop-types';
import { FaPlay, FaStop, FaMicrophone, FaMicrophoneSlash, FaRoute } from 'react-icons/fa';

/**
 * Componente que muestra controles de grabación y micrófono
 */
function RecordingControls({ 
  isRecording, 
  isMicEnabled, 
  activeTrip, 
  onStartRecording, 
  onStopRecording, 
  onToggleMicrophone,
  onStartNavigation 
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
      <h3 className="font-medium text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Controles de Grabación</h3>
      
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {!isRecording ? (
          <button 
            className="bg-green-500 hover:bg-green-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm"
            onClick={onStartRecording}
          >
            <FaPlay className="mr-1" />
            Iniciar Grabación
          </button>
        ) : (
          <button 
            className="bg-red-500 hover:bg-red-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm"
            onClick={onStopRecording}
          >
            <FaStop className="mr-1" />
            Detener Grabación
          </button>
        )}
        
        <button 
          className={`py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm ${isMicEnabled ? 'bg-dashcam-500 hover:bg-dashcam-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}
          onClick={onToggleMicrophone}
        >
          {isMicEnabled ? (
            <>
              <FaMicrophone className="mr-1" />
              Micrófono On
            </>
          ) : (
            <>
              <FaMicrophoneSlash className="mr-1" />
              Micrófono Off
            </>
          )}
        </button>
        
        {/* Botón de navegación si hay un viaje activo */}
        {activeTrip && (
          <button 
            onClick={onStartNavigation}
            className="col-span-2 bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm mt-1"
          >
            <FaRoute className="mr-1" />
            Iniciar Navegación
          </button>
        )}
      </div>
    </div>
  );
}

RecordingControls.propTypes = {
  isRecording: PropTypes.bool.isRequired,
  isMicEnabled: PropTypes.bool.isRequired,
  activeTrip: PropTypes.object,
  onStartRecording: PropTypes.func.isRequired,
  onStopRecording: PropTypes.func.isRequired,
  onToggleMicrophone: PropTypes.func.isRequired,
  onStartNavigation: PropTypes.func
};

export default RecordingControls;
