import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { 
  FaPlay, FaStop, FaMicrophone, FaMicrophoneSlash, 
  FaRoute, FaCar, FaInfoCircle, FaCheckCircle, FaMapMarkerAlt
} from 'react-icons/fa'; 
/**
 * Componente que muestra controles de grabación y micrófono con diseño moderno
 */
function RecordingControls({ 
  isRecording, 
  isMicEnabled, 
  activeTrip, 
  onStartRecording, 
  onStopRecording, 
  onToggleMicrophone,
  onStartNavigation,
  darkMode = false 
}) {
  // Estado para mostrar confirmación de inicio/fin de grabación
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationType, setConfirmationType] = useState('success');
  
  // Función para mostrar confirmación temporal
  const displayConfirmation = (message, type = 'success') => {
    setConfirmationMessage(message);
    setConfirmationType(type);
    setShowConfirmation(true);
    
    setTimeout(() => {
      setShowConfirmation(false);
    }, 3000); // Mostrar por 3 segundos
  };
  
  // Funciones mejoradas con confirmaciones
  const handleStartRecording = () => {
    onStartRecording();
    displayConfirmation('Grabación iniciada');
  };
  
  const handleStopRecording = () => {
    onStopRecording();
    displayConfirmation('Grabación detenida');
  };
  
  return (
    <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg shadow-md p-4 flex flex-col h-auto min-h-[450px]`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-medium text-base flex items-center">
          {isRecording ? (
            <div className="flex items-center">
              <span className="relative mr-2">
                <FaStop className="text-red-500" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
              </span>
              <span className="font-semibold">Grabando...</span>
            </div>
          ) : (
            <div className="flex items-center">
              <FaPlay className="mr-2 text-green-500" />
              <span>Listo para grabar</span>
            </div>
          )}
        </h3>
        
        {/* Indicador de estado de ruta activa */}
        {activeTrip && (
          <span className={`text-xs px-3 py-1 rounded-full ${darkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-800'} flex items-center`}>
            <FaCar className="mr-1" /> Ruta Activa
          </span>
        )}
      </div>
      
      {/* Mensaje de confirmación */}
      {showConfirmation && (
        <div className={`mb-3 py-2 px-3 rounded-md text-sm flex items-center justify-center ${
          confirmationType === 'success' 
            ? darkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800'
            : darkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
        }`}>
          <FaCheckCircle className="mr-2" />
          {confirmationMessage}
        </div>
      )}
      
      <div className="flex flex-col" style={{ flex: '1 1 auto' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {!isRecording ? (
            <button 
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center text-sm transition-all duration-300 shadow-md hover:shadow-lg"
              onClick={handleStartRecording}
            >
              <FaPlay className="mr-2" />
              Iniciar Grabación
            </button>
          ) : (
            <button 
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-2 px-4 rounded-lg flex items-center justify-center text-sm transition-all duration-300 shadow-md hover:shadow-lg"
              onClick={handleStopRecording}
            >
              <FaStop className="mr-2" />
              Detener Grabación
            </button>
          )}
          
          <button 
            className={`py-2 px-4 rounded-lg flex items-center justify-center text-sm transition-all duration-300 shadow-md hover:shadow-lg ${
              isMicEnabled ? 
              'bg-gradient-to-r from-dashcam-500 to-dashcam-600 hover:from-dashcam-600 hover:to-dashcam-700 text-white' : 
              `${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-300 hover:bg-gray-400'} text-current`
            }`}
            onClick={onToggleMicrophone}
          >
            {isMicEnabled ? (
              <>
                <FaMicrophone className="mr-2" />
                Micrófono ON
              </>
            ) : (
              <>
                <FaMicrophoneSlash className="mr-2" />
                Micrófono OFF
              </>
            )}
          </button>
        </div>
        
        {/* Información de viaje y botón de navegación */}
        {activeTrip ? (
          <div className={`flex-1 flex flex-col p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} text-sm`}>
            <div className="flex items-center mb-2">
              <FaInfoCircle className={`mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              <span className="font-medium truncate">{activeTrip.name}</span>
            </div>
            <div className="flex flex-col justify-between" style={{ height: 'calc(100% - 30px)' }}>
              <div className="text-xs opacity-75">
                {activeTrip.distance && (
                  <span className="mr-2">{Math.round(activeTrip.distance)} km</span>
                )}
                {activeTrip.duration && (
                  <span>{Math.round(activeTrip.duration / 60)} min</span>
                )}
              </div>
              <button 
                className={`w-full py-2 px-3 rounded-lg ${
                  darkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-500 hover:bg-blue-600'
                } text-white flex items-center justify-center transition-all shadow-md hover:shadow-lg mt-auto`}
                onClick={onStartNavigation}
              >
                <FaRoute className="mr-2" />
                Iniciar Navegación
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex-1 flex flex-col justify-between p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} text-sm`}>
            <div className="flex flex-col items-center mb-2">
              <FaMapMarkerAlt className={`text-2xl mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <p className="text-center">No hay ruta activa</p>
            </div>
            <Link 
              to="/trips" 
              className={`w-full py-2 px-3 rounded-lg text-sm ${
                darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'
              } flex items-center justify-center transition-colors mt-auto`}
            >
              <FaRoute className="mr-1" />
              Planificar ruta
            </Link>
          </div>
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
  onStartNavigation: PropTypes.func,
  darkMode: PropTypes.bool
};

export default RecordingControls;
