import React, { useRef, useEffect, useState, useMemo } from 'react';
import { FaVideo, FaPlay } from 'react-icons/fa';
import { format } from 'date-fns';
import VideoControls from './VideoControls';
import ChapterSelector from './ChapterSelector';
import GPSOverlay from './GPSOverlay';
import ClipInfoOverlay from './ClipInfoOverlay';

// Función auxiliar para calcular distancia entre dos puntos GPS
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

const VideoPlayer = ({ 
  videoSrc, 
  onClose, 
  isPictureInPicture = false,
  secondaryVideoSrc = null,
  isFullPlayer = true,
  onLoadStart = null,
  onLoadComplete = null,
  autoPlay = true,
  clipMetadata = null,
  relatedClips = [],
  onSelectClip = null,
  getClipThumbnail = null,
  onTimeUpdate = null,
  onDurationChange = null,
  onPlayStateChange = null,
  getVideoUrl = null,
  darkMode = false
}) => {
  // Refs
  const videoRef = useRef(null);
  const secondaryVideoRef = useRef(null);
  
  // Estados
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true); // Mostrar controles inicialmente
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(false);
  const [videoRatio, setVideoRatio] = useState('landscape');
  const [showGPSOverlay, setShowGPSOverlay] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [showClipInfo, setShowClipInfo] = useState(false);

  // Memorizar metadatos GPS del clip para evitar recálculos
  const gpsMetadata = useMemo(() => {
    console.log('VideoPlayer: Computing GPS metadata with clipMetadata:', clipMetadata);
    
    if (!clipMetadata) {
      console.log('VideoPlayer: No clipMetadata, returning null');
      return null;
    }
    
    try {
      let metadata = clipMetadata;
      if (typeof clipMetadata === 'string') {
        metadata = JSON.parse(clipMetadata);
      }
      
      const hasValidStartGPS = metadata.start_lat !== null && metadata.start_lat !== undefined && 
                              metadata.start_lon !== null && metadata.start_lon !== undefined &&
                              !isNaN(Number(metadata.start_lat)) && !isNaN(Number(metadata.start_lon));
      
      if (hasValidStartGPS) {
        const startLat = Number(metadata.start_lat);
        const startLon = Number(metadata.start_lon);
        const endLat = metadata.end_lat ? Number(metadata.end_lat) : startLat;
        const endLon = metadata.end_lon ? Number(metadata.end_lon) : startLon;
        
        const gpsData = {
          track: [
            {
              lat: startLat,
              lon: startLon,
              timestamp: metadata.start_time
            },
            {
              lat: endLat,
              lon: endLon,
              timestamp: metadata.end_time || metadata.start_time
            }
          ],
          total_distance: metadata.end_lat && metadata.end_lon ? 
            calculateDistance(startLat, startLon, endLat, endLon) : 0,
          point_count: metadata.end_lat && metadata.end_lon ? 2 : 1,
          bounds: {
            north: Math.max(startLat, endLat),
            south: Math.min(startLat, endLat),
            east: Math.max(startLon, endLon),
            west: Math.min(startLon, endLon)
          }
        };
        
        return gpsData;
      }
      
      return metadata.gps_track || null;
    } catch (e) {
      console.error('VideoPlayer: Error parsing clip metadata:', e);
      return null;
    }
  }, [clipMetadata]);

  // Agrupar clips relacionados por segmentos de 10 minutos
  const chapterSegments = useMemo(() => {
    if (!relatedClips || relatedClips.length === 0) return [];
    
    const sortedClips = [...relatedClips].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
    
    const segments = {};
    sortedClips.forEach(clip => {
      if (clip.timestamp) {
        const date = new Date(clip.timestamp);
        const hour = date.getHours();
        const minutes = date.getMinutes();
        const segment = Math.floor(minutes / 10) * 10;
        const segmentKey = `${hour}_${segment}`;
        
        if (!segments[segmentKey]) {
          segments[segmentKey] = {
            label: `${hour}:${segment.toString().padStart(2, '0')} - ${hour}:${(segment + 9).toString().padStart(2, '0')}`,
            clips: []
          };
        }
        segments[segmentKey].clips.push(clip);
      }
    });
    
    return Object.values(segments);
  }, [relatedClips]);

  // Debug log para estados importantes (después de definir gpsMetadata)
  if (process.env.NODE_ENV === 'development') {
    console.log('VideoPlayer render states:', {
      isLoading,
      showControls,
      isPlaying,
      duration,
      hasRelatedClips: relatedClips?.length > 0,
      hasGPSMetadata: !!gpsMetadata,
      chaptersCount: chapterSegments.length
    });
  }

  // Detector de cambio de tamaño
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detectar cambio de estado de pantalla completa y teclas
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      console.log('🔄 FULLSCREEN CHANGE EVENT:', {
        wasFullscreen: isFullscreen,
        isNowFullscreen,
        fullscreenElement: document.fullscreenElement
      });
      setIsFullscreen(isNowFullscreen);
    };
    
    const handleKeyDown = (e) => {
      // Mostrar controles al presionar cualquier tecla relevante
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyF', 'KeyM', 'Escape'].includes(e.code)) {
        console.log('Key pressed, showing controls:', e.code);
        setShowControls(true);
        
        // Manejar algunas teclas comunes
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          toggleFullscreen(e);
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          toggleMute(e);
        }
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Manejar cambios de video - Solo cuando cambia videoSrc
  useEffect(() => {
    if (!videoRef.current || !videoSrc) return;
    
    console.log('Loading new video:', videoSrc);
    setIsLoading(true);
    if (onLoadStart) onLoadStart();
    
    const video = videoRef.current;
    
    const handleCanPlay = () => {
      console.log('Video can play, setting loading to false');
      setIsLoading(false);
      setShowControls(true);
      
      if (onLoadComplete) onLoadComplete();
    };
    
    const handleLoadedData = () => {
      console.log('Video loaded data, setting loading to false');
      setIsLoading(false);
      setShowControls(true);
    };
    
    const handleError = () => {
      console.error('Video error, setting loading to false');
      setIsLoading(false);
      setShowControls(true);
    };
    
    // Agregar event listeners
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    // Fallback: quitar loading después de 3 segundos
    const fallbackTimer = setTimeout(() => {
      console.log('Fallback: removing loading state after 3 seconds');
      setIsLoading(false);
      setShowControls(true);
    }, 3000);
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      clearTimeout(fallbackTimer);
    };
  }, [videoSrc]); // Solo depende de videoSrc

  // Manejar autoplay separadamente
  useEffect(() => {
    if (!videoRef.current || isLoading || !videoSrc) return;
    
    const video = videoRef.current;
    
    if (autoPlay && !isPlaying) {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(error => {
        console.error('Error with autoplay:', error);
      });
    }
  }, [autoPlay, isLoading, videoSrc]);

  // Eventos del reproductor
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) onTimeUpdate(time);
    };
    
    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded, duration:', video.duration);
      setDuration(video.duration);
      setShowControls(true); // Mostrar controles cuando los metadatos estén listos
      if (onDurationChange) onDurationChange(video.duration);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
      if (isPictureInPicture && secondaryVideoRef.current) {
        secondaryVideoRef.current.play();
      }
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      if (isPictureInPicture && secondaryVideoRef.current) {
        secondaryVideoRef.current.pause();
      }
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [isPictureInPicture, onTimeUpdate, onDurationChange, onPlayStateChange]);

  // Ocultar controles automáticamente (solo si está reproduciendo y sin actividad reciente)
  useEffect(() => {
    // Si el video está pausado, mantener controles visibles
    if (!isPlaying) {
      setShowControls(true);
      return;
    }
    
    if (!showControls || !isPlaying) return;
    
    const timer = setTimeout(() => {
      if (isPlaying) { // Solo ocultar si está reproduciendo
        console.log('Auto-hiding controls after 8 seconds of inactivity');
        setShowControls(false);
      }
    }, 8000); // Aumentado a 8 segundos para dar más tiempo al usuario
    
    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  // Funciones de control
  const togglePlay = () => {
    console.log('Toggle play called, current state:', { isPlaying, isLoading });
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(error => {
          console.error('Error playing video:', error);
        });
      }
    }
    setShowControls(true);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
    setShowControls(true);
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const progressBar = e.currentTarget;
    const pos = (e.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth;
    const seekTime = Math.max(0, Math.min(duration * pos, duration));
    
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      
      if (isPictureInPicture && secondaryVideoRef.current) {
        secondaryVideoRef.current.currentTime = seekTime;
      }
    }
    setShowControls(true);
  };

  const toggleFullscreen = (e) => {
    console.log('🚀 TOGGLE FULLSCREEN CALLED');
    e?.stopPropagation();
    
    const container = videoRef.current?.parentElement;
    if (!container) {
      console.error('❌ No container found for fullscreen');
      return;
    }
    
    console.log('📹 Container found:', container);
    console.log('🔍 Current fullscreen element:', document.fullscreenElement);
    console.log('📊 Current state - isFullscreen:', isFullscreen);
    
    if (!document.fullscreenElement) {
      console.log('➡️ Entering fullscreen mode...');
      // Entrar en pantalla completa
      const requestFullscreen = () => {
        if (container.requestFullscreen) {
          console.log('Using requestFullscreen');
          return container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          console.log('Using webkitRequestFullscreen');
          return container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
          console.log('Using msRequestFullscreen');
          return container.msRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          console.log('Using mozRequestFullScreen');
          console.log('Using mozRequestFullScreen');
          return container.mozRequestFullScreen();
        } else {
          console.error('❌ Fullscreen API not supported');
          return Promise.reject('Fullscreen not supported');
        }
      };
      
      requestFullscreen().then(() => {
        console.log('✅ Successfully entered fullscreen');
      }).catch(err => {
        console.error('❌ Error entering fullscreen:', err);
      });
      
    } else {
      console.log('⬅️ Exiting fullscreen mode...');
      // Salir de pantalla completa
      const exitFullscreen = () => {
        if (document.exitFullscreen) {
          console.log('Using exitFullscreen');
          return document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          console.log('Using webkitExitFullscreen');
          return document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          console.log('Using msExitFullscreen');
          return document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          console.log('Using mozCancelFullScreen');
          return document.mozCancelFullScreen();
        } else {
          console.error('❌ Exit fullscreen API not supported');
          return Promise.reject('Exit fullscreen not supported');
        }
      };
      
      exitFullscreen().then(() => {
        console.log('✅ Successfully exited fullscreen');
      }).catch(err => {
        console.error('❌ Error exiting fullscreen:', err);
      });
    }
    
    setShowControls(true);
  };

  const handleClipSelection = (clip) => {
    if (onSelectClip) {
      onSelectClip(clip);
    }
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('clip-selected', { detail: clip });
      window.dispatchEvent(event);
    }
  };

  // Si no hay video, mostrar placeholder
  if (!videoSrc) {
    return (
      <div className="w-full max-w-full overflow-hidden">
        <div 
          className="relative overflow-hidden flex flex-col items-center justify-center bg-gray-100"
          style={{ aspectRatio: '16/9', width: '100%' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-200 opacity-30 flex flex-col items-center justify-center">
            <FaVideo className="text-blue-500 text-opacity-80 text-5xl mb-4 relative z-10" />
            <p className="text-gray-700 font-medium text-center text-sm sm:text-base px-4 relative z-10">
              Selecciona un clip para ver
            </p>
            <p className="text-gray-500 text-xs mt-2 text-center max-w-xs px-4 relative z-10">
              Elige un evento de la línea de tiempo o de la lista de eventos
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full">
      <div 
        className={`relative bg-black ${
          isFullscreen ? 'h-screen' : 'aspect-video'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          console.log('Container clicked, showing controls');
          setShowControls(true);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          console.log('Container touched, showing controls');
          setShowControls(true);
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
          console.log('Mouse moved, showing controls');
          setShowControls(true);
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          console.log('Mouse entered video area, showing controls');
          setShowControls(true);
        }}
      >
        {/* Video principal */}
        <video 
          ref={videoRef}
          src={videoSrc} 
          className="absolute inset-0 w-full h-full object-contain cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Video clicked, showing controls');
            setShowControls(true);
          }}
          playsInline
          muted={isMuted}
        >
          Tu navegador no soporta la etiqueta de video.
        </video>
        
        {/* Video secundario en PIP */}
        {isPictureInPicture && secondaryVideoSrc && (
          <div className={`absolute ${
            isMobile 
              ? 'bottom-16 right-4 w-1/3 h-1/4' 
              : 'bottom-20 right-4 w-1/4 h-1/4'
          } border-2 border-white shadow-lg rounded-lg overflow-hidden`}>
            <video 
              ref={secondaryVideoRef}
              src={secondaryVideoSrc}
              className="w-full h-full object-cover"
              muted
              playsInline
            >
              Tu navegador no soporta la etiqueta de video.
            </video>
          </div>
        )}
        
        {/* Indicador sutil cuando los controles están ocultos durante la reproducción */}
        {!showControls && isPlaying && duration > 0 && (
          <div className="absolute bottom-4 right-4 bg-black/50 rounded-full p-2 opacity-40 hover:opacity-100 transition-all duration-300 pointer-events-none group">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse group-hover:animate-none"></div>
          </div>
        )}
        
        {/* Overlay para mostrar controles al hacer hover cuando están ocultos */}
        {!showControls && isPlaying && (
          <div 
            className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              console.log('Overlay clicked, showing controls');
              setShowControls(true);
            }}
            onMouseMove={(e) => {
              e.stopPropagation();
              setShowControls(true);
            }}
          >
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/30 to-transparent flex items-end justify-center pb-4">
              <div className="text-white/70 text-sm font-medium">
                Haz clic para mostrar controles
              </div>
            </div>
          </div>
        )}
        
        {/* Controles de video */}
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          showControls={showControls}
          isMuted={isMuted}
          isFullscreen={isFullscreen}
          isMobile={isMobile}
          gpsMetadata={gpsMetadata}
          showGPSOverlay={showGPSOverlay}
          relatedClips={relatedClips}
          showChapterSelector={showChapterSelector}
          showClipInfo={showClipInfo}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen}
          onToggleGPS={() => {
            setShowGPSOverlay(!showGPSOverlay);
            setShowControls(true);
          }}
          onToggleChapterSelector={() => {
            setShowChapterSelector(!showChapterSelector);
            setShowControls(true);
          }}
          onToggleClipInfo={() => {
            setShowClipInfo(!showClipInfo);
            setShowControls(true);
          }}
          onSeek={handleSeek}
        />
        
        {/* Botón de play central */}
        {!isPlaying && duration > 0 && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-40" 
            onClick={(e) => {
              e.stopPropagation();
              console.log('Play button clicked');
              togglePlay();
            }}
          >
            <div className={`${
              isMobile ? 'w-16 h-16' : 'w-20 h-20'
            } rounded-full ${darkMode ? 'bg-neutral-800/95 hover:bg-neutral-700' : 'bg-white/95 hover:bg-white'} flex items-center justify-center shadow-2xl transition-all transform hover:scale-110`}>
              <FaPlay className={`${darkMode ? 'text-neutral-100' : 'text-black'} ${
                isMobile ? 'text-xl ml-1' : 'text-3xl ml-1'
              }`} />
            </div>
          </div>
        )}
        
        {/* Loading spinner - Solo mostrar si realmente está cargando */}
        {isLoading && duration === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-60">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              <p className="text-white text-sm font-medium">Cargando video...</p>
            </div>
          </div>
        )}
        
        {/* GPS Overlay */}
        {showGPSOverlay && gpsMetadata && (
          <GPSOverlay 
            gpsMetadata={gpsMetadata}
            clipMetadata={clipMetadata}
            onClose={() => setShowGPSOverlay(false)}
          />
        )}
        
        {/* Clip Info Overlay */}
        {showClipInfo && (
          <ClipInfoOverlay 
            selectedClip={clipMetadata}
            showClipInfo={showClipInfo}
            getVideoUrl={getVideoUrl}
          />
        )}
        
        {/* Selector de capítulos */}
        {showChapterSelector && chapterSegments.length > 0 && (
          <ChapterSelector
            chapterSegments={chapterSegments}
            clipMetadata={clipMetadata}
            getClipThumbnail={getClipThumbnail}
            onSelectClip={handleClipSelection}
            onClose={() => setShowChapterSelector(false)}
          />
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;