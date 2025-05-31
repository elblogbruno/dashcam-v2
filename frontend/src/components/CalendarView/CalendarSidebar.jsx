import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import { FaCalendarDay, FaClock, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import 'react-calendar/dist/Calendar.css';
import './Calendar.css';

const CalendarSidebar = ({ 
  date, 
  setDate, 
  calendarData, 
  timeZoneOffset, 
  setTimeZoneOffset,
  isMobileOpen = false,
  onMobileClose = () => {}
}) => {
  /**
   * Genera el contenido personalizado para cada celda del calendario
   * @param {Date} date - Fecha de la celda
   * @param {string} view - Vista actual del calendario
   * @returns {JSX.Element|null} Contenido a renderizar o null
   */
  const getTileContent = ({ date, view }) => {
    // Solo añadir contenido en la vista mensual
    if (view !== 'month') return null;
    
    // Formatear la fecha para buscar en los datos del calendario
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateStr];
    
    // Si no hay datos para este día, no mostrar nada
    if (!dayData) return null;
    
    // Verificar si hay eventos para mostrar
    const hasTrips = dayData.trips > 0;
    const hasExternalVideos = dayData.external_videos > 0;
    const totalEvents = (dayData.trips || 0) + (dayData.external_videos || 0);
    
    // Si no hay eventos, no mostrar nada
    if (!hasTrips && !hasExternalVideos) return null;

    return (
      <div className="flex flex-col items-center mt-1">
        {/* Indicador visual de eventos */}
        {(hasTrips || hasExternalVideos) && (
          <div className="event-dot"></div>
        )}
        {/* Mostrar contador solo cuando hay múltiples eventos */}
        {totalEvents > 5 && (
          <span className="text-xs mt-1 text-nest-text-secondary">
            {totalEvents}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`calendar-sidebar transition-all duration-300 ease-in-out shadow-lg rounded-xl relative
                    ${isMobileOpen ? 'mobile-calendar-open' : 'hidden md:block'}`}>
      <div className="card max-w-lg mx-auto md:mx-0 bg-white rounded-xl overflow-hidden">
        <div className="calendar-header bg-gradient-to-r from-dashcam-600 to-dashcam-700 text-white py-4 px-5">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <FaCalendarDay className="mr-2 text-dashcam-100" /> 
              <span className="font-semibold">Calendario</span>
            </div>
            <div className="flex items-center">
              <span className="text-dashcam-100 font-medium mr-6">{format(date, 'MMMM yyyy')}</span>
              
              {/* Botón de cierre reposicionado */}
              {isMobileOpen && (
                <button 
                  onClick={onMobileClose}
                  className="close-button bg-dashcam-800 hover:bg-dashcam-900 text-white 
                            rounded-full flex items-center justify-center transition-colors shadow-md"
                  aria-label="Cerrar calendario"
                  style={{ width: '28px', height: '28px' }}
                >
                  <FaTimes size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="p-5">
          <Calendar 
            onChange={(newDate) => {
              setDate(newDate);
              // En móvil, cerrar el calendario después de seleccionar una fecha
              if (isMobileOpen) {
                onMobileClose();
              }
            }} 
            value={date}
            tileContent={getTileContent}
            className="w-full border-0 shadow-sm rounded-lg overflow-hidden"
            tileClassName={({ date, view }) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayData = calendarData[dateStr];
              if (dayData && (dayData.trips > 0 || dayData.external_videos > 0)) {
                return 'has-events bg-dashcam-50 hover:bg-dashcam-100 transition-colors'; 
              }
              return 'hover:bg-gray-50 transition-colors';
            }}
            prevLabel={<FaChevronLeft className="text-dashcam-600" />}
            nextLabel={<FaChevronRight className="text-dashcam-600" />}
          />
          
          {/* Zona horaria */}
          <div className="timezone-adjustment mt-5 p-4 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <FaClock className="mr-2 text-dashcam-600" /> Ajuste de zona horaria
            </h3>
            <div className="timezone-control flex items-center justify-center">
              <button 
                className="timezone-btn bg-dashcam-500 hover:bg-dashcam-600 text-white w-10 h-10 rounded-l-lg flex items-center justify-center transition-all shadow-sm"
                onClick={() => setTimeZoneOffset(prev => Math.max(prev - 1, -12))}
              >
                -
              </button>
              <span className="timezone-value bg-white px-5 py-2 border-t border-b border-gray-200 font-medium shadow-inner text-dashcam-800">
                {timeZoneOffset >= 0 ? '+' : ''}{timeZoneOffset}h
              </span>
              <button 
                className="timezone-btn bg-dashcam-500 hover:bg-dashcam-600 text-white w-10 h-10 rounded-r-lg flex items-center justify-center transition-all shadow-sm"
                onClick={() => setTimeZoneOffset(prev => Math.min(prev + 1, 12))}
              >
                +
              </button>
            </div>
          </div>
          
          {/* Leyenda */}
          <div className="mt-5 flex flex-col items-center justify-center bg-gradient-to-r from-neutral-50 to-neutral-100 p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-700 font-medium mb-3">Leyenda</div>
            <div className="flex items-center justify-center space-x-6">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-dashcam-500 mr-2 shadow-sm ring-2 ring-dashcam-100"></div>
                <span className="text-xs font-medium text-dashcam-800">Viajes</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-green-500 mr-2 shadow-sm ring-2 ring-green-100"></div>
                <span className="text-xs font-medium text-green-800">Externos</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarSidebar;
