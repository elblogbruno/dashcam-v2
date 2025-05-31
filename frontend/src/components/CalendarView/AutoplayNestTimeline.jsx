import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { FaPlay, FaPlayCircle, FaVideo } from 'react-icons/fa';
import { AutoplayTimelineManager } from './AutoplayTimeline'; 

const AutoplayNestTimeline = ({ 
  videoClips = [], 
  onSelectClip,
  getThumbnailUrl,
  autoplayEnabled = true,
  emptyMessage = "No hay eventos para mostrar"
}) => {
  // Referencias y estados
  const timelineRef = useRef(null);
  const autoplayManagerRef = useRef(null);
  const [isAutoplayActive, setIsAutoplayActive] = useState(autoplayEnabled);
  const [currentClipIndex, setCurrentClipIndex] = useState(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [scrollPosition, setScrollPosition] = useState('');
  const scrollTimerRef = useRef(null);

  // Inicializar el gestor de autoplay
  useEffect(() => {
    if (!videoClips.length || !timelineRef.current) return;
    
    // Limpiar cualquier instancia anterior
    if (autoplayManagerRef.current) {
      autoplayManagerRef.current.destroy();
    }
    
    // Callback para la reproducción automática
    const handleClipAutoplay = (index) => {
      if (!isAutoplayActive) return;
      
      setCurrentClipIndex(index);
      onSelectClip(videoClips[index]);
    };
    
    // Crear una instancia nueva del gestor
    autoplayManagerRef.current = new AutoplayTimelineManager();
    autoplayManagerRef.current.init(
      '.nest-vertical-timeline',
      '.nest-timeline-event',
      handleClipAutoplay
    );
    
    return () => {
      if (autoplayManagerRef.current) {
        autoplayManagerRef.current.destroy();
      }
    };
  }, [videoClips, isAutoplayActive, onSelectClip]);

  // Manejar eventos de scroll
  useEffect(() => {
    if (!timelineRef.current) return;
    
    const handleScroll = () => {
      // Mostrar indicador de posición
      setShowScrollIndicator(true);
      
      // Calcular qué clip está más cercano a la vista
      const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
      const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
      
      const approximateIndex = Math.floor(scrollPercentage * videoClips.length);
      const clip = videoClips[Math.min(approximateIndex, videoClips.length - 1)];
      
      if (clip && clip.timestamp && !isNaN(new Date(clip.timestamp))) {
        setScrollPosition(format(new Date(clip.timestamp), 'h:mm a'));
      } else if (clip) {
        setScrollPosition(`Clip ${approximateIndex + 1}`);
      }
      
      // Limpiar temporizador anterior si existe
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      
      // Ocultar el indicador después de un tiempo
      scrollTimerRef.current = setTimeout(() => {
        setShowScrollIndicator(false);
      }, 800);
    };
    
    // Agregar event listener
    timelineRef.current.addEventListener('scroll', handleScroll);
    
    return () => {
      if (timelineRef.current) {
        timelineRef.current.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, [videoClips]);

  // Función para alternar el modo de autoplay
  const toggleAutoplay = () => {
    setIsAutoplayActive(!isAutoplayActive);
  };
  
  // Mostrar mensaje si no hay clips
  if (!videoClips || videoClips.length === 0) {
    return (
      <div className="nest-empty-view">
        <FaVideo />
        <div className="text-center">
          <p className="text-gray-500">{emptyMessage}</p>
          <p className="text-gray-400 text-xs mt-1">Intenta seleccionar otro día</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="nest-timeline-container relative">
      {/* Botón de toggle para autoplay */}
      <button 
        className={`
          absolute top-2 right-2 z-10
          flex items-center gap-2 
          px-3 py-2 rounded-full 
          text-white text-sm font-medium
          transition-all duration-200 ease-in-out
          shadow-lg hover:shadow-xl
          ${isAutoplayActive 
            ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300' 
            : 'bg-gray-600 hover:bg-gray-700 ring-2 ring-gray-300'
          }
        `}
        onClick={toggleAutoplay}
        aria-label={isAutoplayActive ? "Desactivar reproducción automática" : "Activar reproducción automática"}
      >
        <FaPlayCircle className="text-lg" />
        <span>Auto</span>
      </button>
      
      {/* Línea de tiempo vertical */}
      <div 
        ref={timelineRef}
        className="nest-vertical-timeline scrollbar-nest"
      >
        {/* Línea vertical central */}
        <div className="nest-timeline-line"></div>
        
        {/* Eventos en la línea de tiempo */}
        {videoClips.map((clip, index) => (
          <div 
            className={`nest-timeline-event ${currentClipIndex === index ? 'nest-event-playing' : ''}`}
            key={`clip-${index}`}
            data-clip-index={index}
          >
            <div className="nest-timeline-dot"></div>
            <div 
              className="nest-event-card" 
              onClick={() => {
                setCurrentClipIndex(index);
                onSelectClip(clip);
              }}
            >
              <div className="nest-event-thumbnail">
                <img 
                  src={getThumbnailUrl(clip.road_video_file || clip.interior_video_file)} 
                  alt={`Miniatura ${clip.timestamp && !isNaN(new Date(clip.timestamp)) ? format(new Date(clip.timestamp), 'h:mm a') : 'Sin hora'}`}
                  onError={(e) => {e.target.src = 'https://placehold.co/600x400?text=No+Preview'; e.target.onerror = null;}}
                />
                <div className="nest-play-button">
                  <FaPlay />
                </div>
              </div>
              <div className="nest-event-info">
                <div className="nest-event-time">
                  {clip.timestamp && !isNaN(new Date(clip.timestamp)) 
                    ? format(new Date(clip.timestamp), 'h:mm a') 
                    : "Hora desconocida"}
                </div>
                <div className="nest-event-description">{clip.event_type || 'Clip de video'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Indicador de posición de scroll */}
      <div className={`scroll-position-indicator ${showScrollIndicator ? 'visible' : ''}`}>
        {scrollPosition}
      </div>
    </div>
  );
};

export default AutoplayNestTimeline;
