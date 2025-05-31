import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaExclamationTriangle, FaSync, FaBell, FaChevronDown, FaChevronUp } from 'react-icons/fa';

/**
 * Componente para mostrar alertas del sistema
 */
function AlertBanner({ errors, onRefreshCameras, darkMode = false }) {
  // Estado para controlar si el banner está expandido o colapsado
  const [expanded, setExpanded] = useState(true);
  // Estado para controlar la notificación de nueva alerta
  const [showNewAlert, setShowNewAlert] = useState(false);
  // Conteo de alertas previo
  const [prevErrorCount, setPrevErrorCount] = useState(errors?.length || 0);
  
  // Detectar cuando hay nuevas alertas
  useEffect(() => {
    if (errors && errors.length > prevErrorCount) {
      setShowNewAlert(true);
      // Expandir automáticamente al recibir nuevas alertas
      setExpanded(true);
      
      // Ocultar la notificación después de 5 segundos
      const timer = setTimeout(() => {
        setShowNewAlert(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
    
    setPrevErrorCount(errors?.length || 0);
  }, [errors, prevErrorCount]);
  
  // No renderizar si no hay errores
  if (!errors || errors.length === 0) {
    return null;
  }
  
  // Clasificar alertas por severidad (asumimos que las que contienen ciertas palabras clave son más críticas)
  const classifyAlert = (error) => {
    const lowerError = error.toLowerCase();
    if (lowerError.includes('crítica') || lowerError.includes('error') || lowerError.includes('fallo')) {
      return 'critical';
    }
    if (lowerError.includes('advertencia') || lowerError.includes('warning')) {
      return 'warning';
    }
    return 'info';
  };
  
  return (
    <div className={`relative mb-3 sm:mb-4 ${darkMode ? 'bg-gray-800' : 'bg-yellow-50'} ${
      darkMode ? 'border-yellow-500' : 'border-yellow-400'
    } border-l-4 rounded-md shadow-md transition-all duration-300 ${
      showNewAlert ? 'animate-pulse' : ''
    }`}>
      {/* Cabecera siempre visible */}
      <div 
        className={`p-3 sm:p-4 flex justify-between items-center cursor-pointer ${
          darkMode ? 'hover:bg-gray-700' : 'hover:bg-yellow-100'
        }`} 
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className={`${darkMode ? 'text-yellow-400' : 'text-yellow-700'} font-medium flex items-center text-sm sm:text-base`}>
          <FaExclamationTriangle className="mr-2" />
          Alertas del sistema ({errors.length})
          {showNewAlert && (
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${darkMode ? 'bg-red-600' : 'bg-red-500'} text-white animate-bounce`}>
              ¡Nuevo!
            </span>
          )}
        </h3>
        <div className="flex items-center">
          {expanded ? <FaChevronUp className={darkMode ? "text-gray-400" : "text-gray-600"} /> : <FaChevronDown className={darkMode ? "text-gray-400" : "text-gray-600"} />}
        </div>
      </div>
      
      {/* Contenido expandible */}
      {expanded && (
        <div className={`px-4 pb-4 ${darkMode ? 'border-t border-gray-700' : 'border-t border-yellow-200'}`}>
          <ul className="mt-2 space-y-1.5">
            {errors.map((error, index) => {
              const severity = classifyAlert(error);
              
              return (
                <li key={index} className={`flex items-center ${
                  severity === 'critical' ? (darkMode ? 'text-red-400' : 'text-red-600') : 
                  severity === 'warning' ? (darkMode ? 'text-amber-400' : 'text-amber-600') :
                  (darkMode ? 'text-blue-400' : 'text-blue-600')
                } text-xs sm:text-sm`}>
                  <FaBell className="mr-2 flex-shrink-0" />
                  <span>{error}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 sm:mt-4 flex justify-end">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRefreshCameras();
              }}
              className={`${
                darkMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-600'
              } text-white px-4 py-2 rounded-md text-xs sm:text-sm flex items-center justify-center transition-colors`}
            >
              <FaSync className="mr-2" /> Actualizar cámaras
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

AlertBanner.propTypes = {
  errors: PropTypes.array.isRequired,
  onRefreshCameras: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default AlertBanner;
