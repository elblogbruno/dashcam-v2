import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaRoute, FaClock, FaCarSide, FaChartBar, FaMapMarked, FaArrowRight, FaAngleDown, FaAngleUp } from 'react-icons/fa';
import { Link } from 'react-router-dom';

/**
 * Componente para mostrar estadísticas de viaje
 */
function TripStats({ tripStats, darkMode = false }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'} rounded-lg shadow-md p-4 flex flex-col`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium flex items-center text-base">
          <FaChartBar className={`mr-2 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
          Estadísticas de Viaje
        </h3>
        <button 
          onClick={() => setExpanded(!expanded)} 
          className={`${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} p-1.5 rounded-full transition-colors`}
          title={expanded ? "Contraer" : "Expandir"}
        >
          {expanded ? <FaAngleUp /> : <FaAngleDown />}
        </button>
      </div>
      
      {/* Vista compacta: mostrar todos los stats en una sola fila */}
      {!expanded && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center transition-shadow hover:shadow-md`}>
            <div className={`${darkMode ? 'text-blue-400' : 'text-blue-600'} text-base font-medium`}>
              {tripStats.total_trips || 0}
            </div>
            <div className="text-xs flex items-center">
              <FaRoute className="mr-1" /> Viajes
            </div>
          </div>
          
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center transition-shadow hover:shadow-md`}>
            <div className={`${darkMode ? 'text-green-400' : 'text-green-600'} text-base font-medium`}>
              {Math.round(tripStats.distance_traveled || 0)}
            </div>
            <div className="text-xs flex items-center">
              <FaMapMarked className="mr-1" /> km
            </div>
          </div>
          
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center transition-shadow hover:shadow-md`}>
            <div className={`${darkMode ? 'text-purple-400' : 'text-purple-600'} text-base font-medium`}>
              {Math.round((tripStats.time_traveled || 0) / 60)}
            </div>
            <div className="text-xs flex items-center">
              <FaClock className="mr-1" /> horas
            </div>
          </div>
          
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center transition-shadow hover:shadow-md`}>
            <div className={`${darkMode ? 'text-amber-400' : 'text-amber-600'} text-base font-medium`}>
              {tripStats.days_active || 0}
            </div>
            <div className="text-xs flex items-center">
              <FaCarSide className="mr-1" /> días
            </div>
          </div>
        </div>
      )}
      
      {/* Vista expandida: el diseño original */}
      {expanded && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center`}>
              <div className={`flex items-center justify-center ${darkMode ? 'text-blue-400' : 'text-blue-600'} mb-1`}>
                <FaRoute className="mr-1" />
                <span className="text-xs uppercase">Viajes</span>
              </div>
              <div className="text-xl font-bold">{tripStats.total_trips || 0}</div>
            </div>
            
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center`}>
              <div className={`flex items-center justify-center ${darkMode ? 'text-green-400' : 'text-green-600'} mb-1`}>
                <FaMapMarked className="mr-1" />
                <span className="text-xs uppercase">Distancia</span>
              </div>
              <div className="text-xl font-bold">{Math.round(tripStats.distance_traveled || 0)} km</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center`}>
              <div className={`flex items-center justify-center ${darkMode ? 'text-purple-400' : 'text-purple-600'} mb-1`}>
                <FaClock className="mr-1" />
                <span className="text-xs uppercase">Tiempo</span>
              </div>
              <div className="text-xl font-bold">{Math.round((tripStats.time_traveled || 0) / 60)} h</div>
            </div>
            
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex flex-col items-center justify-center`}>
              <div className={`flex items-center justify-center ${darkMode ? 'text-amber-400' : 'text-amber-600'} mb-1`}>
                <FaCarSide className="mr-1" />
                <span className="text-xs uppercase">Uso</span>
              </div>
              <div className="text-xl font-bold">{tripStats.days_active || 0} días</div>
            </div>
          </div>
        </>
      )}
      
      {/* Viajes recientes - solo visibles en modo expandido */}
      {expanded && tripStats.recent_trips && tripStats.recent_trips.length > 0 && (
        <div className="flex-1">
          <h4 className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2 flex items-center`}>
            <FaCalendarAlt className="mr-1" /> Viajes Recientes
          </h4>
          <div className={`text-xs overflow-y-auto max-h-28 ${darkMode ? 'text-gray-400' : 'text-gray-500'} space-y-1.5`}>
            {tripStats.recent_trips.slice(0, 3).map((trip, index) => (
              <div key={index} className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
                <div className="flex justify-between">
                  <span className="truncate max-w-[120px] font-medium">{trip.name || 'Sin nombre'}</span>
                  <span>{new Date(trip.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="flex items-center">
                    <FaMapMarked className={`mr-1 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                    {Math.round(trip.distance || 0)} km
                  </span>
                  <span className="flex items-center">
                    <FaClock className={`mr-1 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                    {Math.round((trip.duration || 0) / 60)} min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Enlace a todos los viajes - adaptado según el estado */}
      {expanded ? (
        <Link to="/trips" className={`w-full py-2 px-3 rounded-lg text-center text-sm mt-3 ${
          darkMode ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'
        } text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all`}>
          <FaArrowRight className="mr-2" /> Ver todos los viajes
        </Link>
      ) : (
        <Link to="/trips" className={`w-full py-1 px-2 rounded-md text-center text-xs mt-1 ${
          darkMode ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'
        } text-white flex items-center justify-center shadow-sm hover:shadow transition-all`}>
          <FaArrowRight className="mr-1" /> Ver viajes
        </Link>
      )}
    </div>
  );
}

TripStats.propTypes = {
  tripStats: PropTypes.object.isRequired,
  darkMode: PropTypes.bool
};

export default TripStats;
