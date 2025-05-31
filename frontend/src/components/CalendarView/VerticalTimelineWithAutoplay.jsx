import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { FaPlay, FaPlayCircle } from 'react-icons/fa';
import { AutoplayTimelineManager } from './AutoplayTimeline';

const VerticalTimelineWithAutoplay = ({
  videoClips = [],
  onSelectClip,
  autoPlay = true,
  getThumbnailUrl
}) => {
  const timelineRef = useRef(null);
  const autoplayManagerRef = useRef(null);
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(autoPlay);
  const [currentClipIndex, setCurrentClipIndex] = useState(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [scrollIndicatorText, setScrollIndicatorText] = useState('');

  // Inicializar el gestor de autoplay cuando se montan los clips
  useEffect(() => {
    if (!videoClips.length || !timelineRef.current) return;

    // Limpiar cualquier gestor anterior
    if (autoplayManagerRef.current) {
      autoplayManagerRef.current.destroy();
    }

    // Callback que se ejecuta cuando se debe reproducir un clip
    const handleAutoplay = (index) => {
      if (!isAutoplayEnabled) return;
      
      const clip = videoClips[index];
      if (clip) {
        setCurrentClipIndex(index);
        onSelectClip(clip);
      }
    };

    // Inicializar el gestor de autoplay
    autoplayManagerRef.current = new AutoplayTimelineManager();
    autoplayManagerRef.current.init(
      '.nest-vertical-timeline',
      '.nest-timeline-event',
      handleAutoplay
    );

    // Asignar datos de clips a elementos DOM
    const eventElements = timelineRef.current.querySelectorAll('.nest-timeline-event');
    eventElements.forEach((element, index) => {
      element.dataset.clipIndex = index;
    });

    return () => {
      if (autoplayManagerRef.current) {
        autoplayManagerRef.current.destroy();
        autoplayManagerRef.current = null;
      }
    };
  }, [videoClips, isAutoplayEnabled, onSelectClip]);

  // Manejar eventos de scroll para mostrar indicador
  useEffect(() => {
    if (!timelineRef.current) return;

    let timeout;
    const handleScroll = () => {
      clearTimeout(timeout);
      
      // Mostrar indicador de desplazamiento
      setShowScrollIndicator(true);
      
      // Actualizar texto del indicador basado en la posición
      const scrollTop = timelineRef.current.scrollTop;
      const scrollHeight = timelineRef.current.scrollHeight;
      const clientHeight = timelineRef.current.clientHeight;
      const scrollPercent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      
      const closestClipIndex = Math.min(
        Math.floor((scrollPercent / 100) * videoClips.length),
        videoClips.length - 1
      );
      
      if (closestClipIndex >= 0 && videoClips[closestClipIndex]) {
        const clipTime = format(new Date(videoClips[closestClipIndex].timestamp), 'h:mm a');
        setScrollIndicatorText(clipTime);
      }
      
      // Ocultar indicador después de un tiempo
      timeout = setTimeout(() => {
        setShowScrollIndicator(false);
      }, 800);
    };
    
    timelineRef.current.addEventListener('scroll', handleScroll);
    
    return () => {
      if (timelineRef.current) {
        timelineRef.current.removeEventListener('scroll', handleScroll);
      }
      clearTimeout(timeout);
    };
  }, [videoClips]);

  // Función para manejar clic manual en un clip
  const handleClickEvent = (clip, index) => {
    setCurrentClipIndex(index);
    onSelectClip(clip);
  };

  // Función para cambiar el estado de autoplay
  const toggleAutoplay = () => {
    setIsAutoplayEnabled(!isAutoplayEnabled);
  };

  if (!videoClips || videoClips.length === 0) {
    return (
      <div className="nest-empty-timeline">
        <p>No hay eventos para mostrar</p>
      </div>
    );
  }

  return (
    <div className="nest-timeline-container relative">
      {/* Botón de toggle autoplay */}
      <button 
        className={`absolute top-2 right-2 z-10 p-2 rounded-full
                 ${isAutoplayEnabled ? 'bg-nest-selected text-white' : 'bg-nest-card-bg text-nest-text-secondary'}`}
        onClick={toggleAutoplay}
        title={isAutoplayEnabled ? "Desactivar reproducción automática" : "Activar reproducción automática"}
      >
        <FaPlayCircle size={18} />
        {isAutoplayEnabled && (
          <span className="autoplay-indicator">
            Auto
          </span>
        )}
      </button>
      
      {/* Línea de tiempo vertical */}
      <div 
        ref={timelineRef}
        className="nest-vertical-timeline scrollbar-nest"
      >
        {/* Línea vertical central */}
        <div className="nest-timeline-line"></div>
        
        {/* Video clips en la línea de tiempo vertical */}
        {videoClips.map((clip, index) => (
          <div 
            className={`nest-timeline-event ${currentClipIndex === index ? 'nest-event-playing' : ''}`}
            key={`clip-${index}`}
            data-clip-index={index}
          >
            <div className="nest-timeline-dot"></div>
            <div 
              className="nest-event-card" 
              onClick={() => handleClickEvent(clip, index)}
            >
              <div className="nest-event-thumbnail">
                <img 
                  src={getThumbnailUrl(clip.road_video_file || clip.interior_video_file)} 
                  alt={`Miniatura ${format(new Date(clip.timestamp), 'h:mm a')}`}
                  onError={(e) => {e.target.src = 'https://placehold.co/600x400?text=No+Preview'; e.target.onerror = null;}}
                />
                <div className="nest-play-button">
                  <FaPlay />
                </div>
              </div>
              <div className="nest-event-info">
                <div className="nest-event-time">{format(new Date(clip.timestamp), 'h:mm a')}</div>
                <div className="nest-event-description">{clip.event_type || 'Clip de video'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Indicador de desplazamiento */}
      <div className={`nest-scroll-indicator ${showScrollIndicator ? 'visible' : ''}`}>
        {scrollIndicatorText}
      </div>
    </div>
  );
};

export default VerticalTimelineWithAutoplay;
