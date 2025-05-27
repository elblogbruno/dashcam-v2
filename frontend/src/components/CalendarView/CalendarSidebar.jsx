import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import { FaCalendarDay, FaClock, FaTimes } from 'react-icons/fa';
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
  // Function to get tile content for calendar
  const getTileContent = ({ date, view }) => {
    // Only add content to month view
    if (view !== 'month') return null;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateStr];
    
    if (!dayData) return null;
    
    const hasTrips = dayData.trips > 0;
    const hasExternalVideos = dayData.external_videos > 0;
    
    if (!hasTrips && !hasExternalVideos) return null;

    return (
      <div className="flex flex-col items-center mt-1">
        {hasTrips && (
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-dashcam-500 mr-1"></div>
            <span className="text-xs">{dayData.trips}</span>
          </div>
        )}
        {hasExternalVideos && (
          <div className="flex items-center mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            <span className="text-xs">{dayData.external_videos}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`calendar-sidebar transition-all duration-300 ease-in-out
                    ${isMobileOpen ? 'mobile-calendar-open' : 'hidden md:block'}`}>
      <div className="card overflow-hidden shadow-xl rounded-xl border border-gray-200 bg-white hover:shadow-2xl transition-shadow duration-300 max-w-lg mx-auto md:mx-0">
        {/* Añadir botón de cierre en móvil */}
        {isMobileOpen && (
          <button 
            onClick={onMobileClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white bg-opacity-80 rounded-full text-gray-600 hover:text-red-500 md:hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dashcam-500 shadow-md"
            aria-label="Cerrar calendario"
          >
            <FaTimes />
          </button>
        )}

        <div className="bg-gradient-to-r from-dashcam-800 to-dashcam-600 text-white p-4 font-semibold text-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FaCalendarDay className="mr-2" /> 
              <span>Calendario</span>
            </div>
            <span className="text-sm opacity-80">{format(date, 'MMMM yyyy')}</span>
          </div>
        </div>
        <div className="p-4">
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
            className="w-full border-0"
            tileClassName={({ date, view }) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayData = calendarData[dateStr];
              if (dayData && (dayData.trips > 0 || dayData.external_videos > 0)) {
                return 'has-events bg-dashcam-50'; 
              }
              return null;
            }}
          />
          
          {/* Zona horaria */}
          <div className="timezone-adjustment mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <FaClock className="mr-1 text-dashcam-600" /> Ajuste de zona horaria
            </h3>
            <div className="timezone-control flex items-center justify-center">
              <button 
                className="timezone-btn bg-dashcam-100 hover:bg-dashcam-200 text-dashcam-800 w-8 h-8 rounded-l-lg flex items-center justify-center transition-colors"
                onClick={() => setTimeZoneOffset(prev => Math.max(prev - 1, -12))}
              >
                -
              </button>
              <span className="timezone-value bg-white px-4 py-1 border-t border-b border-gray-200 font-medium">
                {timeZoneOffset >= 0 ? '+' : ''}{timeZoneOffset}h
              </span>
              <button 
                className="timezone-btn bg-dashcam-100 hover:bg-dashcam-200 text-dashcam-800 w-8 h-8 rounded-r-lg flex items-center justify-center transition-colors"
                onClick={() => setTimeZoneOffset(prev => Math.min(prev + 1, 12))}
              >
                +
              </button>
            </div>
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex flex-col items-center justify-center bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-700 font-medium mb-2">Leyenda</div>
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-dashcam-500 mr-1 shadow-sm"></div>
                <span className="text-xs">Viajes</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-1 shadow-sm"></div>
                <span className="text-xs">Externos</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarSidebar;
