import React from 'react';
import PropTypes from 'prop-types';

/**
 * Componente para activar/desactivar las estadísticas de rendimiento
 * 
 * Este componente muestra un botón que permite al usuario activar o desactivar
 * la visualización de estadísticas de rendimiento en los componentes de cámara.
 */
function PerformanceToggle({ showStats, onToggle, className = '' }) {
  return (
    <button
      className={`flex items-center space-x-1 bg-gray-800 hover:bg-gray-700 text-white text-xs px-2 py-1 rounded transition-colors ${className}`}
      onClick={onToggle}
      title={showStats ? "Ocultar estadísticas de rendimiento" : "Mostrar estadísticas de rendimiento"}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-3.5 w-3.5" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
        />
      </svg>
      <span>{showStats ? "Ocultar FPS" : "Mostrar FPS"}</span>
      <span className={`h-2 w-2 rounded-full ${showStats ? 'bg-green-400' : 'bg-red-400'}`}></span>
    </button>
  );
}

PerformanceToggle.propTypes = {
  showStats: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  className: PropTypes.string
};

export default PerformanceToggle;
