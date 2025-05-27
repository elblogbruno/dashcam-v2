import React from 'react';
import PropTypes from 'prop-types';

/**
 * Componente para mostrar estadísticas de viaje
 */
function TripStats({ tripStats }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
      <h3 className="font-medium text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Estadísticas de Viaje</h3>
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="text-center">
          <div className="text-base sm:text-xl font-bold text-dashcam-600">{tripStats.total_trips || 0}</div>
          <div className="text-xs sm:text-sm text-gray-500">Viajes Totales</div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-xl font-bold text-dashcam-600">
            {Math.round(tripStats.distance_traveled || 0)} km
          </div>
          <div className="text-xs sm:text-sm text-gray-500">Distancia</div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-xl font-bold text-dashcam-600">
            {Math.floor((tripStats.recording_time || 0) / 3600)}h
          </div>
          <div className="text-xs sm:text-sm text-gray-500">Tiempo Grabado</div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-xl font-bold text-dashcam-600">
            {tripStats.recent_trips ? tripStats.recent_trips.length : 0}
          </div>
          <div className="text-xs sm:text-sm text-gray-500">Viajes Recientes</div>
        </div>
      </div>
    </div>
  );
}

TripStats.propTypes = {
  tripStats: PropTypes.object.isRequired
};

export default TripStats;
