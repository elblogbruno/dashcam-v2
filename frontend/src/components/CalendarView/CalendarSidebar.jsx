import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import { FaCalendarDay, FaClock, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import 'react-calendar/dist/Calendar.css';

const CalendarSidebar = ({ 
  date, 
  setDate, 
  calendarData, 
  timeZoneOffset, 
  setTimeZoneOffset,
  isMobileOpen = false,
  onMobileClose = () => {},
  darkMode = false,
  onMonthChange = () => {}
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
    <div className={`h-full relative z-[1000] ${darkMode ? 'bg-neutral-800' : 'bg-white'}`}>
      <div className="h-full flex flex-col">
        {/* Header del calendario */}
        <div className={`${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'} border-b px-4 py-4`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <FaCalendarDay className={`mr-3 text-lg ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} /> 
              <span className={`font-semibold text-lg ${darkMode ? 'text-neutral-100' : 'text-gray-800'}`}>Calendario</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`font-medium text-sm hidden xs:inline ${darkMode ? 'text-neutral-400' : 'text-gray-600'}`}>
                {format(date, 'MMMM yyyy')}
              </span>
              
              {/* Botón de cierre solo visible en móvil dentro del modal */}
              {isMobileOpen && (
                <button 
                  onClick={onMobileClose}
                  className={`p-2 rounded-full transition-all duration-200 hover:scale-105 
                            ${darkMode 
                              ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200' 
                              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                  aria-label="Cerrar calendario"
                >
                  <FaTimes size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className={`flex-1 overflow-y-auto p-4 space-y-5 ${darkMode ? 'bg-neutral-800' : 'bg-white'}`}>
          <Calendar 
            onChange={(newDate) => {
              setDate(newDate);
              // En móvil, cerrar el calendario después de seleccionar una fecha
              if (isMobileOpen) {
                setTimeout(() => onMobileClose(), 200);
              }
            }} 
            onActiveStartDateChange={({ activeStartDate }) => {
              // Se ejecuta cuando cambia el mes/año visible
              if (activeStartDate && onMonthChange) {
                onMonthChange(activeStartDate);
              }
            }}
            value={date}
            tileContent={getTileContent}
            className="w-full border-0 bg-transparent font-inherit react-calendar-custom"
            tileClassName={({ date, view }) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayData = calendarData[dateStr];
              if (dayData && (dayData.trips > 0 || dayData.external_videos > 0)) {
                return `has-events ${darkMode ? 'dark-has-events' : 'light-has-events'} font-medium relative`; 
              }
              return darkMode ? 'hover:bg-neutral-700 transition-colors' : 'hover:bg-gray-50 transition-colors';
            }}
            prevLabel={<FaChevronLeft className={darkMode ? "text-neutral-400" : "text-gray-500"} />}
            nextLabel={<FaChevronRight className={darkMode ? "text-neutral-400" : "text-gray-500"} />}
          />
          
          {/* Zona horaria */}
          <div className={`rounded-lg p-4 ${darkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-gray-50 border-gray-200'} border`}>
            <h3 className={`text-sm font-semibold mb-4 flex items-center ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
              <FaClock className={`mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} /> Zona horaria
            </h3>
            <div className={`flex items-center rounded-lg overflow-hidden border ${darkMode ? 'border-neutral-600' : 'border-gray-200'}`}>
              <button 
                className={`w-12 h-12 flex items-center justify-center 
                          font-semibold transition-all duration-200 
                          border-r text-lg ${
                            darkMode 
                              ? 'bg-neutral-600 hover:bg-neutral-500 text-neutral-300 hover:text-neutral-100 border-neutral-600' 
                              : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 border-gray-200'
                          }`}
                onClick={() => setTimeZoneOffset(prev => Math.max(prev - 1, -12))}
              >
                −
              </button>
              <div className={`py-3 px-4 font-semibold min-w-[80px] text-center ${
                darkMode 
                  ? 'bg-neutral-600 text-neutral-200' 
                  : 'bg-white text-gray-800'
              }`}>
                {timeZoneOffset >= 0 ? '+' : ''}{timeZoneOffset}h
              </div>
              <button 
                className={`w-12 h-12 flex items-center justify-center 
                          font-semibold transition-all duration-200 
                          border-l text-lg ${
                            darkMode 
                              ? 'bg-neutral-600 hover:bg-neutral-500 text-neutral-300 hover:text-neutral-100 border-neutral-600' 
                              : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 border-gray-200'
                          }`}
                onClick={() => setTimeZoneOffset(prev => Math.min(prev + 1, 12))}
              >
                +
              </button>
            </div>
          </div>
          
          {/* Leyenda */}
          <div className={`rounded-lg p-4 ${darkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-gray-50 border-gray-200'} border`}>
            <div className={`text-sm font-semibold mb-4 text-center ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>Leyenda</div>
            <div className="flex items-center justify-center space-x-6">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2 shadow-sm"></div>
                <span className={`text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-gray-600'}`}>Con videos</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${darkMode ? 'bg-blue-400 ring-blue-700' : 'bg-blue-600 ring-blue-200'} mr-2 shadow-sm ring-2`}></div>
                <span className={`text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-gray-600'}`}>Hoy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Estilos inline para react-calendar que no se pueden hacer con Tailwind */}
      <style jsx="true">{`
        /* Estilos compartidos */
        .react-calendar-custom .react-calendar__tile {
          position: relative;
          height: 50px;
          font-size: 0.875rem;
          border-radius: 6px;
          margin: 2px;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          background: ${darkMode ? '#262626' : 'white'};
          color: ${darkMode ? '#e5e5e5' : '#1f2937'};
        }
        
        /* Hover para tema claro */
        .react-calendar-custom .react-calendar__tile:hover {
          background: ${darkMode ? '#404040' : '#f9fafb'};
          border-color: ${darkMode ? '#525252' : '#e5e7eb'};
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, ${darkMode ? '0.3' : '0.1'});
        }
        
        /* Día actual */
        .react-calendar-custom .react-calendar__tile--now {
          background: ${darkMode ? '#1e3a8a' : '#dbeafe'};
          color: ${darkMode ? '#93c5fd' : '#1d4ed8'};
          font-weight: 600;
          border-color: ${darkMode ? '#3b82f6' : '#3b82f6'};
        }
        
        /* Día seleccionado */
        .react-calendar-custom .react-calendar__tile--active {
          background: ${darkMode ? '#2563eb' : '#3b82f6'};
          color: white;
          font-weight: 600;
          border-color: ${darkMode ? '#1d4ed8' : '#2563eb'};
          box-shadow: 0 2px 6px rgba(59, 130, 246, ${darkMode ? '0.5' : '0.3'});
          transform: scale(1.02);
        }
        
        /* Días con eventos - tema claro */
        .react-calendar-custom .react-calendar__tile.light-has-events {
          background: #eff6ff;
          border-color: #bfdbfe;
        }
        
        .react-calendar-custom .react-calendar__tile.light-has-events:hover {
          background: #dbeafe;
        }
        
        /* Días con eventos - tema oscuro */
        .react-calendar-custom .react-calendar__tile.dark-has-events {
          background: #172554;
          border-color: #1e3a8a;
        }
        
        .react-calendar-custom .react-calendar__tile.dark-has-events:hover {
          background: #1e3a8a;
        }
        
        /* Indicador de eventos */
        .react-calendar-custom .react-calendar__tile.has-events::after {
          content: '';
          position: absolute;
          bottom: 4px;
          right: 4px;
          width: 6px;
          height: 6px;
          background: ${darkMode ? '#60a5fa' : '#3b82f6'};
          border-radius: 50%;
          box-shadow: 0 0 0 2px ${darkMode ? '#262626' : 'white'};
        }
        
        .react-calendar-custom .react-calendar__navigation {
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
        }
        
        .react-calendar-custom .react-calendar__navigation button {
          background: ${darkMode ? '#262626' : 'white'};
          border: 1px solid ${darkMode ? '#525252' : '#e5e7eb'};
          color: ${darkMode ? '#e5e5e5' : '#374151'};
          font-weight: 500;
          padding: 0.75rem;
          border-radius: 6px;
          transition: all 0.2s ease;
          min-height: 44px;
          min-width: 44px;
        }
        
        .react-calendar-custom .react-calendar__navigation button:hover {
          background: ${darkMode ? '#404040' : '#f9fafb'};
          border-color: ${darkMode ? '#737373' : '#d1d5db'};
          color: ${darkMode ? '#ffffff' : '#1f2937'};
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, ${darkMode ? '0.3' : '0.1'});
        }
        
        .react-calendar-custom .react-calendar__navigation__label {
          font-size: 1rem;
          font-weight: 600;
          color: ${darkMode ? '#f5f5f5' : '#374151'};
        }
        
        .react-calendar-custom .react-calendar__navigation__arrow {
          font-size: 0.875rem;
        }
        
        .react-calendar-custom .react-calendar__month-view__weekdays {
          text-align: center;
          font-weight: 500;
          font-size: 0.75rem;
          color: ${darkMode ? '#a3a3a3' : '#6b7280'};
          text-transform: uppercase;
          margin-bottom: 0.5rem;
        }
        
        .react-calendar-custom .react-calendar__month-view__weekdays__weekday {
          padding: 0.75rem 0.5rem;
        }
        
        .react-calendar-custom .react-calendar__month-view__days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        
        @media (max-width: 480px) {
          .react-calendar-custom .react-calendar__tile {
            height: 44px;
            font-size: 0.75rem;
            margin: 1px;
          }
          
          .react-calendar-custom .react-calendar__navigation__label {
            font-size: 0.875rem;
          }
          
          .react-calendar-custom .react-calendar__navigation button {
            padding: 0.5rem;
            min-height: 40px;
            min-width: 40px;
          }
          
          .react-calendar-custom .react-calendar__month-view__weekdays__weekday {
            padding: 0.5rem 0.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default CalendarSidebar;
