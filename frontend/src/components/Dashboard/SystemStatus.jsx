import React from 'react';
import PropTypes from 'prop-types';
import { 
  FaMicrochip, FaMemory, FaThermometerHalf, FaClock, FaHdd, 
  FaArrowRight, FaServer, FaExclamationTriangle, FaInfoCircle 
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

/**
 * Componente que muestra el estado del sistema (CPU, memoria, temperatura, etc.)
 */
function SystemStatus({ 
  systemStatus,
  formatBytes,
  darkMode = false
}) {
  // Función para determinar el color de acuerdo al valor
  const getStatusColor = (value, thresholds) => {
    if (darkMode) {
      // Colores para tema oscuro
      if (value > thresholds.high) return 'bg-red-600';
      if (value > thresholds.medium) return 'bg-yellow-500';
      return 'bg-green-500';
    } else {
      // Colores para tema claro
      if (value > thresholds.high) return 'bg-red-500';
      if (value > thresholds.medium) return 'bg-yellow-400';
      return 'bg-green-400';
    }
  };
  
  // Función para determinar el color del texto para los valores
  const getTextColor = (value, thresholds) => {
    if (darkMode) {
      // Colores para tema oscuro
      if (value > thresholds.high) return 'text-red-400';
      if (value > thresholds.medium) return 'text-yellow-400';
      return 'text-green-400';
    } else {
      // Colores para tema claro
      if (value > thresholds.high) return 'text-red-600';
      if (value > thresholds.medium) return 'text-yellow-600';
      return 'text-green-600';
    }
  };
  
  // Comprobar si hay algún componente en estado crítico
  const hasCriticalComponents = 
    systemStatus.cpu_usage > 80 || 
    systemStatus.memory_usage > 80 || 
    systemStatus.cpu_temp > 75 || 
    (systemStatus.storage && systemStatus.storage.percent_used > 90);
    
  return (
    <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg shadow-md overflow-hidden h-full flex flex-col`}> 
      <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} p-3 border-b flex justify-between items-center`}>
        <h3 className="font-medium text-base flex items-center">
          <FaServer className="mr-2" /> Estado del Sistema
        </h3>
        {hasCriticalComponents && (
          <span className={`px-2 py-0.5 rounded-full text-xs flex items-center ${darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-600'}`}>
            <FaExclamationTriangle className="mr-1" /> Atención
          </span>
        )}
      </div>
      
      <div className="p-3 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {/* CPU */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm flex items-center">
              <FaMicrochip className={`${darkMode ? 'text-blue-400' : 'text-blue-500'} mr-1.5`} />
              CPU
            </span>
            <span className={`font-medium ${getTextColor(systemStatus.cpu_usage, { medium: 50, high: 80 })}`}>
              {systemStatus.cpu_usage}%
            </span>
          </div>
          <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
            <div 
              className={`h-2 rounded-full ${getStatusColor(systemStatus.cpu_usage, { medium: 50, high: 80 })}`}
              style={{ width: `${systemStatus.cpu_usage}%` }}
            ></div>
          </div>
          {systemStatus.cpu_usage > 80 && (
            <div className={`mt-1 text-xs ${darkMode ? 'text-red-400' : 'text-red-500'}`}>
              CPU sobrecargada
            </div>
          )}
        </div>
        
        {/* Temperatura */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm flex items-center">
              <FaThermometerHalf className={`${darkMode ? 'text-red-400' : 'text-red-500'} mr-1.5`} />
              Temperatura
            </span>
            <span className={`font-medium ${getTextColor(systemStatus.cpu_temp, { medium: 60, high: 75 })}`}>
              {systemStatus.cpu_temp}°C
            </span>
          </div>
          <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
            <div 
              className={`h-2 rounded-full ${getStatusColor(systemStatus.cpu_temp, { medium: 60, high: 75 })}`}
              style={{ width: `${Math.min(100, (systemStatus.cpu_temp / 85) * 100)}%` }}
            ></div>
          </div>
        </div>
        
        {/* Memoria */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm flex items-center">
              <FaMemory className={`${darkMode ? 'text-purple-400' : 'text-purple-500'} mr-1.5`} />
              Memoria
            </span>
            <span className={`font-medium ${getTextColor(systemStatus.memory_usage, { medium: 60, high: 80 })}`}>
              {systemStatus.memory_usage}%
            </span>
          </div>
          <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
            <div 
              className={`h-2 rounded-full ${getStatusColor(systemStatus.memory_usage, { medium: 60, high: 80 })}`}
              style={{ width: `${systemStatus.memory_usage}%` }}
            ></div>
          </div>
        </div>
          
        {/* Almacenamiento */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm flex items-center">
              <FaHdd className={`${darkMode ? 'text-green-400' : 'text-green-500'} mr-1.5`} />
              Almacenamiento
            </span>
            <span className={`font-medium ${getTextColor(systemStatus.storage?.percent_used || 0, { medium: 70, high: 90 })}`}>
              {systemStatus.storage?.percent_used || 0}%
            </span>
          </div>
          <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
            <div 
              className={`h-2 rounded-full ${getStatusColor(systemStatus.storage?.percent_used || 0, { medium: 70, high: 90 })}`}
              style={{ width: `${systemStatus.storage?.percent_used || 0}%` }}
            ></div>
          </div>
        </div>
        
        {/* Información de almacenamiento */}
        <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} col-span-full`}>
          <div className="flex justify-between items-center">
            <span className="text-sm">Espacio disponible:</span>
            <span className="font-medium">
              {systemStatus.storage ? formatBytes(systemStatus.storage.available) : 'N/A'} / {systemStatus.storage ? formatBytes(systemStatus.storage.total) : 'N/A'}
            </span>
          </div>
        </div>
        
        {/* Tiempo de actividad */}
        <div className="flex items-center justify-between text-sm col-span-full">
          <span className="flex items-center">
            <FaClock className={`${darkMode ? 'text-amber-400' : 'text-amber-500'} mr-2`} />
            Tiempo activo:
          </span>
          <span>{systemStatus.uptime || 'Desconocido'}</span>
        </div>
        
        {/* Enlace para administrar almacenamiento */}
        <Link to="/storage" className={`mt-3 col-span-full w-full flex items-center justify-center py-2 px-3 rounded text-sm ${
          darkMode ? 'bg-blue-700 hover:bg-blue-800 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
        } transition-colors`}>
          <FaArrowRight className="mr-2" /> Administrar Almacenamiento
        </Link>
      </div>
    </div>
  );
}

SystemStatus.propTypes = {
  systemStatus: PropTypes.object.isRequired,
  formatBytes: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default SystemStatus;
