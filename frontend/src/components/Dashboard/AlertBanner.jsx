import React from 'react';
import PropTypes from 'prop-types';
import { FaExclamationTriangle, FaSync } from 'react-icons/fa';

/**
 * Componente para mostrar alertas del sistema
 */
function AlertBanner({ errors, onRefreshCameras }) {
  if (!errors || errors.length === 0) {
    return null;
  }
  
  return (
    <div className="mb-3 sm:mb-4 bg-yellow-100 border-l-4 border-yellow-500 p-3 sm:p-4 rounded-md shadow-sm">
      <h3 className="text-yellow-700 font-medium flex items-center text-sm sm:text-base">
        <FaExclamationTriangle className="mr-2" />
        Alertas del sistema
      </h3>
      <ul className="mt-1 sm:mt-2 list-disc pl-5">
        {errors.map((error, index) => (
          <li key={index} className="text-yellow-600 text-xs sm:text-sm">{error}</li>
        ))}
      </ul>
      <div className="mt-2 sm:mt-3 flex justify-center">
        <button 
          onClick={onRefreshCameras}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-xs sm:text-sm flex items-center justify-center"
        >
          <FaSync className="mr-1" /> Actualizar cámaras
        </button>
      </div>
    </div>
  );
}

AlertBanner.propTypes = {
  errors: PropTypes.array.isRequired,
  onRefreshCameras: PropTypes.func.isRequired
};

export default AlertBanner;
