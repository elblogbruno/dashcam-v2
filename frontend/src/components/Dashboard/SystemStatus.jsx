import React from 'react';
import PropTypes from 'prop-types';
import { FaMicrochip, FaMemory, FaThermometerHalf, FaClock, FaHdd, FaArrowRight } from 'react-icons/fa';
import { Link } from 'react-router-dom';

/**
 * Componente que muestra el estado del sistema (CPU, memoria, temperatura, etc.)
 */
function SystemStatus({ 
  systemStatus,
  formatBytes
}) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
      <div className="bg-gray-50 p-2 sm:p-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-800 text-sm sm:text-base">Estado del Sistema</h3>
      </div>
      <div className="p-2 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="flex items-center">
            <FaMicrochip className="text-gray-500 mr-2 hidden sm:block" />
            <div className="w-full">
              <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Uso de CPU</div>
              <div className="text-sm sm:font-medium">{systemStatus.cpu_usage}%</div>
              <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5 mt-1">
                <div 
                  className={`h-1 sm:h-1.5 rounded-full ${
                    systemStatus.cpu_usage > 80 ? 'bg-red-500' : 
                    systemStatus.cpu_usage > 50 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${systemStatus.cpu_usage}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <FaMemory className="text-gray-500 mr-2 hidden sm:block" />
            <div className="w-full">
              <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Memoria</div>
              <div className="text-sm sm:font-medium">{systemStatus.memory_usage}%</div>
              <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5 mt-1">
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
          </div>
          <div className="flex items-center">
            <FaThermometerHalf className="text-gray-500 mr-2 hidden sm:block" />
            <div>
              <div className="text-xs sm:text-sm text-gray-500">Temperatura</div>
              <div className="text-sm sm:font-medium">{systemStatus.cpu_temp}°C</div>
            </div>
          </div>
          <div className="flex items-center">
            <FaClock className="text-gray-500 mr-2 hidden sm:block" />
            <div>
              <div className="text-xs sm:text-sm text-gray-500">Tiempo Activo</div>
              <div className="text-sm sm:font-medium">{systemStatus.uptime}</div>
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
          
          <div className="mt-2 sm:mt-3 flex justify-end"> 
            <Link 
              to="/storage" 
              className="text-dashcam-600 hover:text-dashcam-700 text-xs sm:text-sm font-medium flex items-center"
            > 
              Gestor de Almacenamiento <FaArrowRight className="ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

SystemStatus.propTypes = {
  systemStatus: PropTypes.object.isRequired,
  formatBytes: PropTypes.func.isRequired
};

export default SystemStatus;
