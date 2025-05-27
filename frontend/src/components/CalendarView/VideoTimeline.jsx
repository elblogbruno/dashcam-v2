import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, addHours } from 'date-fns';
import { FaPlay, FaClock, FaSearch, FaSearchMinus, FaSearchPlus } from 'react-icons/fa';

const VideoTimeline = ({ videoClips, selectedDay, timeZoneOffset, onSelectClip }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [zoomLevel, setZoomLevel] = useState(isMobile ? 1 : 3);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useRef(null);
  
  // Organizamos los clips por hora
  const hours = Array.from(Array(24).keys());
  const [selectedHour, setSelectedHour] = useState(null);
  
  // Detector de cambio de tamaño para adaptar la UI
  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      // Cambiar el nivel de zoom para móvil si es necesario
      if (newIsMobile && zoomLevel > 2) {
        setZoomLevel(1);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [zoomLevel]);
  
  // Scroll to current hour
  useEffect(() => {
    if (selectedHour !== null && scrollContainerRef.current) {
      const hourElement = document.getElementById(`hour-${selectedHour}`);
      if (hourElement) {
        const containerRect = scrollContainerRef.current.getBoundingClientRect();
        const hourRect = hourElement.getBoundingClientRect();
        
        // Scroll to position
        const scrollLeft = hourElement.offsetLeft - (containerRect.width / 2) + (hourRect.width / 2);
        scrollContainerRef.current.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedHour]);
  
  // Calcular la hora con el ajuste de zona horaria
  const getAdjustedTime = (timeStr) => {
    if (!timeStr) return null;
    try {
      const time = parseISO(timeStr);
      return addHours(time, timeZoneOffset);
    } catch (e) {
      console.error('Error parsing time:', e);
      return null;
    }
  };

  // Obtener clips para una hora específica
  const getClipsForHour = (hour) => {
    return videoClips.filter(clip => {
      const startTime = getAdjustedTime(clip.start_time);
      if (!startTime) return false;
      return startTime.getHours() === hour;
    });
  };

  // Ver si una hora tiene clips
  const hasClipsInHour = (hour) => {
    return getClipsForHour(hour).length > 0;
  };
  
  // Si no hay clips, mostrar mensaje
  if (videoClips.length === 0) return null;
  
  // Buscar la primera hora con clips para hacer auto-selección
  useEffect(() => {
    if (selectedHour === null) {
      for (let i = 0; i < 24; i++) {
        if (hasClipsInHour(i)) {
          setSelectedHour(i);
          break;
        }
      }
    }
  }, [videoClips]);
  
  // Manejar zoom
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 1, 5));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 1, 1));
  };
  
  // Escalar el ancho basado en zoom
  const getHourWidth = () => {
    // Para móvil, usamos un valor más pequeño proporcional al ancho de pantalla
    if (isMobile) {
      return Math.max(60, Math.min(80, window.innerWidth / 6)) * zoomLevel;
    }
    return 120 * zoomLevel;
  };

  return (
    <div className="video-timeline bg-white rounded-lg border border-gray-200 overflow-hidden w-full">
      <div className="bg-dashcam-50 p-1.5 sm:p-2 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-xs sm:text-sm font-medium text-dashcam-700 flex items-center">
          <FaClock className="mr-1" />
          <span className="hidden sm:inline">{selectedDay}</span>
          <span className="sm:hidden">
            {selectedHour !== null ? `${selectedHour}:00 - ${selectedHour+1}:00` : 'Timeline'}
          </span>
        </h3>
        
        {/* Controles de zoom */}
        <div className="flex items-center space-x-1">
          <button 
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className={`p-1 rounded ${zoomLevel <= 1 ? 'text-gray-400' : 'text-dashcam-600 hover:text-dashcam-800'}`}
          >
            <FaSearchMinus size={isMobile ? 12 : 14} />
          </button>
          <button 
            onClick={handleZoomIn}
            disabled={zoomLevel >= 5}
            className={`p-1 rounded ${zoomLevel >= 5 ? 'text-gray-400' : 'text-dashcam-600 hover:text-dashcam-800'}`}
          >
            <FaSearchPlus size={isMobile ? 12 : 14} />
          </button>
        </div>
      </div>
      
      {/* Timeline Selector - Diseño adaptativo */}
      <div className="relative w-full overflow-hidden">
        {/* Carrusel de horas */}
        <div 
          className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 py-1.5 sm:py-2 px-0.5 sm:px-1 w-full"
          style={{ scrollbarWidth: 'thin' }}
          ref={scrollContainerRef}
          onScroll={(e) => setScrollPosition(e.target.scrollLeft)}
        >
          {hours.map(hour => (
            <div 
              key={hour} 
              id={`hour-${hour}`}
              className={`flex-shrink-0 px-0.5 xs:px-1 ${hasClipsInHour(hour) ? '' : 'opacity-50'}`}
              style={{ width: `${getHourWidth()}px`, maxWidth: '33vw' }}
            >
              <button 
                className={`w-full ${selectedHour === hour ? 'bg-dashcam-100 border-dashcam-400' : 'bg-gray-50 border-gray-200'} border rounded-lg p-1 text-center ${hasClipsInHour(hour) ? 'cursor-pointer hover:bg-dashcam-50' : 'cursor-default'}`}
                onClick={() => hasClipsInHour(hour) && setSelectedHour(hour)}
                disabled={!hasClipsInHour(hour)}
              >
                <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${selectedHour === hour ? 'font-medium text-dashcam-800' : 'text-gray-600'}`}>
                  {hour.toString().padStart(2, '0')}:00
                </span>
                {hasClipsInHour(hour) && (
                  <div className="mt-1 w-2 h-2 bg-dashcam-500 rounded-full mx-auto" />
                )}
              </button>
            </div>
          ))}
        </div>
        
        {/* Indicadores de scroll para ayudar a la navegación */}
        <div className={`absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none ${scrollPosition > 10 ? 'opacity-100' : 'opacity-0'} transition-opacity`}></div>
        <div className="absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
      </div>
      
      {/* Detailed clips for selected hour */}
      {selectedHour !== null && (
        <div className="p-1 sm:p-2 max-h-32 sm:max-h-36 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3 w-full">
            {getClipsForHour(selectedHour).map((clip, index) => {
              const startTime = getAdjustedTime(clip.start_time);
              const endTime = getAdjustedTime(clip.end_time);
              
              return (
                <div 
                  key={index} 
                  className={`
                    border rounded-lg overflow-hidden hover:shadow-sm transition-shadow cursor-pointer w-full
                    ${clip.near_landmark ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}
                  `}
                  onClick={() => onSelectClip(clip)}
                >
                  <div className="p-1 flex justify-between items-center w-full">
                    <div className="flex items-center min-w-0">
                      <button 
                        className="mr-1.5 sm:mr-2 text-dashcam-600 hover:text-dashcam-800 transition-colors flex-shrink-0"
                        onClick={(e) => {e.stopPropagation(); onSelectClip(clip);}}
                      >
                        <FaPlay className={`${isMobile ? 'text-xs' : ''}`}/>
                      </button>
                      <div className="text-xs truncate">
                        <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                          {startTime && format(startTime, 'HH:mm:ss')}
                        </div>
                        {clip.quality && (
                          <div className="text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                            {clip.quality}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {clip.near_landmark && (
                      <div className="text-amber-600 text-xs bg-amber-100 px-1 py-0.5 rounded ml-1 flex-shrink-0">
                        POI
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoTimeline;
