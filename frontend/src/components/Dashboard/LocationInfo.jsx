import React from 'react';
import PropTypes from 'prop-types';
import { FaMapMarkerAlt, FaCar } from 'react-icons/fa';

/**
 * Componente que muestra información de localización
 */
function LocationInfo({ location, landmark }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
      <div className="bg-gray-50 p-2 sm:p-3 border-b border-gray-200"> 
        <h3 className="font-medium text-gray-800 text-sm sm:text-base">Ubicación</h3>
      </div>
      <div className="p-2 sm:p-4">
        <div className="mb-2 sm:mb-3">
          <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Coordenadas Actuales</div>
          <div className="text-xs sm:text-sm font-medium flex items-center flex-wrap">
            <FaMapMarkerAlt className="text-red-500 mr-1 flex-shrink-0" />
            <span className="break-all">
              {location && location.lat ? location.lat.toFixed(6) : '0.000000'}, 
              {location && location.lon ? location.lon.toFixed(6) : '0.000000'}
            </span>
          </div>
        </div>
        
        <div className="mb-2 sm:mb-3"> 
          <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Velocidad</div>
          <div className="text-xs sm:text-sm font-medium flex items-center">
            <FaCar className="text-dashcam-600 mr-1 flex-shrink-0" />
            {Math.round(location.speed)} km/h
          </div>
        </div>
        
        {landmark && (
          <div> 
            <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Punto de Interés Cercano</div>
            <div className="text-xs sm:text-sm font-medium text-dashcam-700">{landmark.name}</div>
            {landmark.description && (
              <div className="text-xs sm:text-sm text-gray-600">{landmark.description}</div>
            )}
            <div className="text-xs text-gray-500 mt-0.5">
              {landmark.distance !== undefined 
                ? `${landmark.distance < 1000 
                    ? `${Math.round(landmark.distance)}m de distancia` 
                    : `${(landmark.distance / 1000).toFixed(1)}km de distancia`}`
                : 'Distancia desconocida'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

LocationInfo.propTypes = {
  location: PropTypes.object.isRequired,
  landmark: PropTypes.object
};

export default LocationInfo;
