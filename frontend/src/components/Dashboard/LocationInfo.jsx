import React from 'react';
import PropTypes from 'prop-types';
import { FaMapMarkerAlt, FaCar, FaTachometerAlt, FaLocationArrow, FaMap, FaExternalLinkAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';

/**
 * Componente que muestra información de localización con diseño mejorado
 */
function LocationInfo({ location, landmark, speed, darkMode = false }) {
  // Función para abrir las coordenadas en Google Maps
  const openInGoogleMaps = () => {
    if (location && location.lat && location.lon) {
      const url = `https://www.google.com/maps?q=${location.lat},${location.lon}`;
      window.open(url, '_blank');
    }
  };
  
  return (
    <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg shadow-md overflow-hidden h-full flex flex-col`}> 
      <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} p-3 border-b flex justify-between items-center`}>
        <h3 className="font-medium text-base flex items-center">
          <FaMap className="mr-2" /> 
          Ubicación Actual
        </h3>
        
        <Link to="/map" className={`p-1.5 rounded text-xs ${darkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-100 hover:bg-blue-200'} ${darkMode ? 'text-white' : 'text-blue-700'} flex items-center`}>
          <FaLocationArrow className="mr-1" /> Ver Mapa
        </Link>
      </div>
      
      <div className="p-3 flex-1 flex flex-col">
        {/* Sección de coordenadas */}
        <div className="mb-3">
          <div className={`text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center`}>
            <FaMapMarkerAlt className="text-red-500 mr-2" />
            Coordenadas GPS
          </div>
          <div className="flex justify-between items-center">
            <div className="font-mono text-sm">
              {location && location.lat ? location.lat.toFixed(6) : '0.000000'}, 
              {location && location.lon ? location.lon.toFixed(6) : '0.000000'}
            </div>
            <button 
              onClick={openInGoogleMaps} 
              className={`p-1.5 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              title="Abrir en Google Maps"
              disabled={!location || !location.lat}
            >
              <FaExternalLinkAlt className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} ${(!location || !location.lat) ? 'opacity-50' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Velocidad actual */}
        <div className="mb-3">
          <div className={`flex justify-between bg-gray-100 p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Velocidad</span>
                {speed && speed.source && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                    speed.source === 'gps' ? 'bg-green-500' :
                    speed.source === 'calculated' ? 'bg-blue-500' :
                    speed.source === 'combined' ? 'bg-purple-500' :
                    'bg-gray-500'
                  } text-white`}>
                    {speed.source === 'gps' ? 'GPS' :
                     speed.source === 'calculated' ? 'CALC' :
                     speed.source === 'combined' ? 'MIX' : 'N/A'}
                  </span>
                )}
              </div>
              <span className="text-2xl font-bold">
                {speed && speed.kmh ? Math.round(speed.kmh) : 
                 (location && location.speed ? Math.round(location.speed) : '0')} 
                <span className="text-sm"> km/h</span>
              </span>
              {speed && speed.source !== 'none' && (
                <div className="text-xs text-gray-500 mt-1">
                  <div>GPS: {Math.round(speed.gps_speed_kmh || 0)} km/h</div>
                  <div>Calc: {Math.round(speed.calculated_speed_kmh || 0)} km/h</div>
                </div>
              )}
            </div>
            <div className="flex items-center">
              <FaTachometerAlt className={`text-3xl ${
                speed && speed.source === 'none' ? 'text-gray-400' :
                speed && speed.source === 'gps' || speed && speed.source === 'combined' ? 'text-green-400' :
                speed && speed.source === 'calculated' ? 'text-blue-400' :
                darkMode ? 'text-blue-400' : 'text-blue-500'
              }`} />
            </div>
          </div>
        </div>
        
        {/* Información de lugar */}
        <div className="flex-1">
          <div className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <FaCar className="inline mr-2" /> 
            {landmark ? 'Punto de interés cercano' : 'Sin puntos de interés cercanos'}
          </div>
          
          {landmark ? (
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="font-medium">{landmark.name}</div>
              <div className="text-sm mt-1 flex justify-between">
                <span>{landmark.type || 'Lugar'}</span>
                <span>{landmark.distance ? `${landmark.distance.toFixed(1)} km` : ''}</span>
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-lg text-center ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex-1 flex items-center justify-center`}>
              <div>
                <FaMapMarkerAlt className={`text-2xl mx-auto mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <p className="text-sm">No se encontraron puntos de interés en las cercanías</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

LocationInfo.propTypes = {
  location: PropTypes.object,
  landmark: PropTypes.object,
  speed: PropTypes.object,
  darkMode: PropTypes.bool
};

export default LocationInfo;
