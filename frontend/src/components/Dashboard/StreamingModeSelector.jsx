import React from 'react';
import PropTypes from 'prop-types';
import { FaCamera, FaVideo, FaNetworkWired, FaChartBar } from 'react-icons/fa';
import PerformanceToggle from '../PerformanceToggle';

/**
 * Componente para seleccionar el modo de streaming
 */
function StreamingModeSelector({ 
  streamingMode, 
  onToggleStreamingMode, 
  showStats, 
  onToggleStats,
  darkMode = false
}) {
  // Texto del modo actual
  const getCurrentModeText = () => {
    switch(streamingMode) {
      case 0:
        return 'MJPEG';
      // case 1:
      //   return 'WebRTC'; // DISABLED
      case 2:
        return 'HTTP';
      default:
        return 'Streaming';
    }
  };
  
  // Icono para el modo actual
  const getCurrentModeIcon = () => {
    switch(streamingMode) {
      case 0:
        return <FaCamera className="mr-1" />;
      case 1:
        return <FaVideo className="mr-1" />;
      case 2:
        return <FaNetworkWired className="mr-1" />;
      default:
        return <FaCamera className="mr-1" />;
    }
  };
  
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onToggleStreamingMode}
        className={`flex items-center ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} px-3 py-1 rounded-md text-sm transition-colors`}
        title={getCurrentModeText()}
      >
        {getCurrentModeIcon()}
        <span className="hidden sm:inline mr-1">{getCurrentModeText()}</span>
      </button>

      <button
        onClick={onToggleStats}
        className={`flex items-center ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} px-3 py-1 rounded-md text-sm transition-colors`}
        title={showStats ? 'Ocultar estadísticas' : 'Mostrar estadísticas'}
      >
        <FaChartBar className={`${showStats ? 'text-green-500' : ''}`} />
        <span className="hidden sm:inline ml-1">{showStats ? 'Ocultar estadísticas' : 'Mostrar estadísticas'}</span>
      </button>
    </div>
  );
}

StreamingModeSelector.propTypes = {
  streamingMode: PropTypes.number.isRequired,
  onToggleStreamingMode: PropTypes.func.isRequired,
  showStats: PropTypes.bool.isRequired,
  onToggleStats: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default StreamingModeSelector;
