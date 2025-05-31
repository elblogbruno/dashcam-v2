import React from 'react';
import PropTypes from 'prop-types';
import { FaRoute, FaArrowRight, FaMapMarkerAlt, FaCalendarAlt, FaClock } from 'react-icons/fa';

/**
 * Componente para mostrar información sobre un viaje activo
 */
function ActiveTripBanner({ activeTrip, onStartNavigation, darkMode = false }) {
  if (!activeTrip) {
    return null;
  }
  
  return (
    <div className={`mb-4 ${darkMode ? 'bg-blue-900 text-blue-100' : 'bg-blue-50 text-blue-800'} border-l-4 ${darkMode ? 'border-blue-700' : 'border-blue-500'} p-4 rounded-lg shadow-md flex flex-col md:flex-row justify-between`}>
      <div className="flex flex-col">
        <h3 className="font-medium flex items-center text-base">
          <FaRoute className={`mr-2 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
          Viaje planificado activo
        </h3>
        <div className="mt-2 flex flex-col">
          <p className="font-medium text-lg">{activeTrip.name}</p>
          <div className="flex items-center mt-1">
            <FaCalendarAlt className={`mr-1 ${darkMode ? 'text-blue-300' : 'text-blue-500'}`} />
            <span className="text-sm">
              {new Date(activeTrip.start_date).toLocaleDateString()} - {new Date(activeTrip.end_date).toLocaleDateString()}
            </span>
          </div>
          {activeTrip.distance && (
            <div className="flex items-center mt-1">
              <FaMapMarkerAlt className={`mr-1 ${darkMode ? 'text-blue-300' : 'text-blue-500'}`} />
              <span className="text-sm">{Math.round(activeTrip.distance)} km</span>
              {activeTrip.duration && (
                <>
                  <span className="mx-1">•</span>
                  <FaClock className={`mr-1 ${darkMode ? 'text-blue-300' : 'text-blue-500'}`} />
                  <span className="text-sm">{Math.round(activeTrip.duration / 60)} min</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 md:mt-0 md:ml-4 flex items-center">
        <button 
          onClick={onStartNavigation}
          className={`${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center transition-colors shadow-md`}
        >
          Iniciar navegación <FaArrowRight className="ml-2" />
        </button>
      </div>
    </div>
  );
}

ActiveTripBanner.propTypes = {
  activeTrip: PropTypes.object.isRequired,
  onStartNavigation: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default ActiveTripBanner;
