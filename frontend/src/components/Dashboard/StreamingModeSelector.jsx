import React from 'react';
import PropTypes from 'prop-types';
import { FaCamera } from 'react-icons/fa';
import PerformanceToggle from '../PerformanceToggle';

/**
 * Componente para seleccionar el modo de streaming
 */
function StreamingModeSelector({ 
  streamingMode, 
  onToggleStreamingMode, 
  showStats, 
  onToggleStats 
}) {
  // Texto del modo actual
  const getCurrentModeText = () => {
    switch(streamingMode) {
      case 0:
        return 'Cambiar a WebRTC (alta calidad)';
      case 1:
        return 'Cambiar a HTTP (estable)';
      case 2:
        return 'Cambiar a MJPEG (baja latencia)';
      default:
        return 'Cambiar modo de streaming';
    }
  };
  
  return (
    <div className="flex flex-wrap gap-2">
      <button 
        onClick={onToggleStreamingMode}
        className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
      >
        <FaCamera className="mr-1" /> 
        {getCurrentModeText()}
      </button>
      
      {(streamingMode === 0 || streamingMode === 1) && (
        <PerformanceToggle
          showStats={showStats}
          onToggle={onToggleStats}
        />
      )}
    </div>
  );
}

StreamingModeSelector.propTypes = {
  streamingMode: PropTypes.number.isRequired,
  onToggleStreamingMode: PropTypes.func.isRequired,
  showStats: PropTypes.bool,
  onToggleStats: PropTypes.func
};

export default StreamingModeSelector;
