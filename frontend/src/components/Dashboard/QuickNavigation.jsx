import React from 'react';
import { Link } from 'react-router-dom';
import { FaMap, FaRoute, FaCalendarAlt, FaHdd } from 'react-icons/fa';

/**
 * Componente para navegación rápida a otras páginas
 */
function QuickNavigation() {
  return (
    <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
      <h3 className="font-medium text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Navegación Rápida</h3>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Link to="/map" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
          <FaMap className="mr-1" />
          Mapa en Vivo
        </Link>
        <Link to="/trips" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
          <FaRoute className="mr-1" />
          Planificación
        </Link>
        <Link to="/calendar" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
          <FaCalendarAlt className="mr-1" />
          Calendario
        </Link>
        <Link to="/storage" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
          <FaHdd className="mr-1" />
          Almacenamiento
        </Link>
      </div>
    </div>
  );
}

export default QuickNavigation;
