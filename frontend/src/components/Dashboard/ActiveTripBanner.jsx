import React from 'react';
import PropTypes from 'prop-types';
import { FaRoute, FaArrowRight } from 'react-icons/fa';

/**
 * Componente para mostrar información sobre un viaje activo
 */
function ActiveTripBanner({ activeTrip, onStartNavigation }) {
  if (!activeTrip) {
    return null;
  }
  
  return (
    <div className="mb-3 sm:mb-4 bg-dashcam-50 border-l-4 border-dashcam-500 p-3 sm:p-4 rounded-md shadow-sm">
      <h3 className="text-dashcam-700 font-medium flex items-center text-sm sm:text-base">
        <FaRoute className="mr-2" />
        Viaje planificado activo
      </h3>
      <div className="mt-1 sm:mt-2">
        <p className="font-medium text-sm sm:text-base">{activeTrip.name}</p>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 gap-2 sm:gap-0">
          <span className="text-xs sm:text-sm text-gray-600">
            {new Date(activeTrip.start_date).toLocaleDateString()} - {new Date(activeTrip.end_date).toLocaleDateString()}
          </span>
          <button 
            onClick={onStartNavigation}
            className="bg-dashcam-600 hover:bg-dashcam-700 text-white px-3 py-1 rounded-md text-xs sm:text-sm flex items-center justify-center"
          >
            Navegar <FaArrowRight className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

ActiveTripBanner.propTypes = {
  activeTrip: PropTypes.object.isRequired,
  onStartNavigation: PropTypes.func.isRequired
};

export default ActiveTripBanner;
