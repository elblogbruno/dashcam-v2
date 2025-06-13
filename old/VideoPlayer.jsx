import React, { useRef, useEffect, useState, useMemo } from 'react';
import { FaExpand, FaCompress, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaVideo, FaThLarge, FaRoute, FaListUl } from 'react-icons/fa';
import { format } from 'date-fns';
import VideoGPSMap from './VideoGPSMap';
import './gps_styles.css';
import './chapter-selector.css'; // Archivo unificado con todas las correcciones de CSS

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
  isFullPlayer = true, // Si es true, se muestra como modal. Si es false, se muestra embebido
  onLoadStart = null,  // Callback cuando el video comienza a cargar
  onLoadComplete = null, // Callback cuando el video está listo
  autoPlay = true,      // Reproducción automática por defecto
  clipMetadata = null,   // Metadatos del clip incluyendo GPS
  relatedClips = [],      // Clips relacionados para la navegación por capítulos
  onSelectClip = null,   // Función para seleccionar un clip
  getClipThumbnail = null // Función para obtener la URL de la miniatura de un clip
}) => {
  const videoRef = useRef(null);
  const secondaryVideoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(1);
  const [videoRatio, setVideoRatio] = useState('landscape'); // 'landscape' o 'portrait'
  const [showGPSOverlay, setShowGPSOverlay] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  
  // Agrupar clips relacionados por segmentos de 10 minutos
  const chapterSegments = useMemo(() => {
    if (!relatedClips || relatedClips.length === 0) return [];
    
    // Ordenar clips por timestamp
    const sortedClips = [...relatedClips].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
    
    // Agrupar por segmentos de 10 minutos
    const segments = {};
    sortedClips.forEach(clip => {
      if (clip.timestamp) {
        const date = new Date(clip.timestamp);
        const hour = date.getHours();
        const minutes = date.getMinutes();
        // Calcular el segmento de 10 minutos
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

  // Identificar el clip actual dentro de los segmentos
  const currentClipIndex = useMemo(() => {
    if (!clipMetadata || !clipMetadata.id) return -1;
    return relatedClips.findIndex(clip => clip.id === clipMetadata.id);
  }, [clipMetadata, relatedClips]);

  // Memorizar metadatos GPS del clip para evitar recálculos
  const gpsMetadata = useMemo(() => {
    console.log('VideoPlayer: Computing GPS metadata with clipMetadata:', clipMetadata);
    console.log('VideoPlayer: clipMetadata type:', typeof clipMetadata);
    
    if (!clipMetadata) {
      console.log('VideoPlayer: No clipMetadata, returning null');
      return null;
    }
    
    try {
      let metadata = clipMetadata;
      if (typeof clipMetadata === 'string') {
        console.log('VideoPlayer: Parsing string clipMetadata...');
        metadata = JSON.parse(clipMetadata);
      }
      
      console.log('VideoPlayer: Full metadata object:', JSON.stringify(metadata, null, 2));
      console.log('VideoPlayer: GPS fields detailed check:', {
        has_start_lat: !!metadata.start_lat,
        has_start_lon: !!metadata.start_lon,
        start_lat: metadata.start_lat,
        start_lat_type: typeof metadata.start_lat,
        start_lon: metadata.start_lon,
        start_lon_type: typeof metadata.start_lon,
        has_end_lat: !!metadata.end_lat,
        has_end_lon: !!metadata.end_lon,
        end_lat: metadata.end_lat,
        end_lon: metadata.end_lon
      });
      
      // Verificar si los valores GPS son números válidos
      const hasValidStartGPS = metadata.start_lat !== null && metadata.start_lat !== undefined && 
                              metadata.start_lon !== null && metadata.start_lon !== undefined &&
                              !isNaN(Number(metadata.start_lat)) && !isNaN(Number(metadata.start_lon));
      
      console.log('VideoPlayer: Valid start GPS check:', hasValidStartGPS);
      
      // Crear metadatos GPS desde los campos del clip si existen
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
        
        console.log('VideoPlayer: Generated GPS data:', gpsData);
        return gpsData;
      }
      
      console.log('VideoPlayer: No valid GPS coordinates found, checking gps_track');
      const gpsTrack = metadata.gps_track || null;
      console.log('VideoPlayer: gps_track result:', gpsTrack);
      return gpsTrack;
    } catch (e) {
      console.error('VideoPlayer: Error parsing clip metadata:', e);
      return null;
    }
  }, [clipMetadata]);

  // Debug: Monitorear cambios en clipMetadata
  useEffect(() => {
    console.log('VideoPlayer: clipMetadata changed:', clipMetadata);
    if (clipMetadata) {
      console.log('VideoPlayer: clipMetadata keys:', Object.keys(clipMetadata));
      console.log('VideoPlayer: GPS data check:', {
        start_lat: clipMetadata.start_lat,
        start_lon: clipMetadata.start_lon,
        end_lat: clipMetadata.end_lat,
        end_lon: clipMetadata.end_lon
      });
    }
  }, [clipMetadata]);

  // Debug: Monitorear cambios en gpsMetadata
  useEffect(() => {
    console.log('VideoPlayer: gpsMetadata result:', gpsMetadata);
  }, [gpsMetadata]);

  // Debug: Monitorear cambios en showGPSOverlay
  useEffect(() => {
    console.log('VideoPlayer: showGPSOverlay state changed to:', showGPSOverlay);
  }, [showGPSOverlay]);

  // Detector de cambio de tamaño para adaptar la UI
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Detectar cambio de estado de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Manejar cambios de video con transiciones suaves
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Iniciar transición con fade out
    setTransitionOpacity(0);
    setIsLoading(true);
    
    if (onLoadStart) onLoadStart();
    
    // Esperar a que el recurso del video esté listo
    const handleCanPlay = () => {
      // Fade in cuando el video está listo
      setTransitionOpacity(1);
      setIsLoading(false);
      
      if (autoPlay) {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          if (onLoadComplete) onLoadComplete();
        }).catch(error => {
          console.error('Error playing video:', error);
          setIsLoading(false);
        });
      } else {
        if (onLoadComplete) onLoadComplete();
      }
      
      // Remover el evento una vez que se ejecutó
      videoRef.current.removeEventListener('canplay', handleCanPlay);
    };
    
    videoRef.current.addEventListener('canplay', handleCanPlay);
    
    // Sincronizar videos si estamos en modo PIP
    if (isPictureInPicture && secondaryVideoRef.current && videoRef.current) {
      // Asegurarse de que ambos videos estén sincronizados
      secondaryVideoRef.current.currentTime = videoRef.current.currentTime;
      
      if (isPlaying) {
        secondaryVideoRef.current.play();
      } else {
        secondaryVideoRef.current.pause();
      }
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('canplay', handleCanPlay);
      }
    };
  }, [videoSrc, secondaryVideoSrc, autoPlay, onLoadStart, onLoadComplete]);

  // Manejar eventos del reproductor principal
  useEffect(() => {
    const video = videoRef.current;
    
    if (!video) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
      if (isPictureInPicture && secondaryVideoRef.current) {
        secondaryVideoRef.current.play();
      }
    };
    
    const handlePause = () => {
      setIsPlaying(false);
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
  }, [isPictureInPicture]);

  // Sincronizar videos secundarios en modo PIP
  useEffect(() => {
    if (!isPictureInPicture || !secondaryVideoRef.current || !videoRef.current) return;
    
    const primaryVideo = videoRef.current;
    const secondaryVideo = secondaryVideoRef.current;
    
    const syncVideos = () => {
      // Si hay más de 0.5 segundos de diferencia, sincronizar
      if (Math.abs(primaryVideo.currentTime - secondaryVideo.currentTime) > 0.5) {
        secondaryVideo.currentTime = primaryVideo.currentTime;
      }
    };
    
    const intervalId = setInterval(syncVideos, 1000);
    
    return () => clearInterval(intervalId);
  }, [isPictureInPicture]);

  // Ocultar controles después de un tiempo de inactividad
  useEffect(() => {
    if (!showControls) return;
    
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [showControls]);

  // Detectar la orientación del video
  useEffect(() => {
    const detectVideoOrientation = () => {
      if (videoRef.current) {
        const { videoWidth, videoHeight } = videoRef.current;
        if (videoWidth && videoHeight) {
          setVideoRatio(videoWidth >= videoHeight ? 'landscape' : 'portrait');
        }
      }
    };
    
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = detectVideoOrientation;
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = null;
      }
    };
  }, [videoSrc]);

  // Detectar cambios de orientación para ajustar video en pantalla completa
  useEffect(() => {
    const handleOrientationChange = () => {
      if (isFullscreen) {
        adjustFullscreenVideoSize();
      }
    };
    
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isFullscreen]);

  // Toggle de reproducción
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
    setShowControls(true); // Mostrar controles al interactuar
  };

  // Toggle de mute
  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
    setShowControls(true);
  };

  // Control de seek
  const handleSeek = (e) => {
    e.stopPropagation();
    const progressBar = e.currentTarget;
    const pos = (e.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth;
    const seekTime = Math.max(0, Math.min(duration * pos, duration));
    
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      
      // Sincronizar video secundario si existe
      if (isPictureInPicture && secondaryVideoRef.current) {
        secondaryVideoRef.current.currentTime = seekTime;
      }
    }
    setShowControls(true);
  };

  // Toggle fullscreen
  const toggleFullscreen = (e) => {
    e.stopPropagation();
    
    const container = videoRef.current.parentElement;
    
    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
      
      // Ajustar el tamaño del video en pantalla completa
      if (videoRef.current) {
        setTimeout(() => {
          adjustFullscreenVideoSize();
        }, 100);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      
      // Restaurar el estilo original al salir de pantalla completa
      setTimeout(() => {
        adjustFullscreenVideoSize(); // Llamar a la función que restaura estilos
      }, 100);
    }
    setShowControls(true);
  };
  
  // Manejar la navegación a clips relacionados
  const handleClipSelection = (clip) => {
    // Si se proporciona la función onSelectClip como prop, usarla
    if (onSelectClip) {
      onSelectClip(clip);
    }
    // También emitir un evento para componentes que escuchen
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('clip-selected', { detail: clip });
      window.dispatchEvent(event);
    }
  };

  // Ajustar el tamaño del video en pantalla completa
  const adjustFullscreenVideoSize = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const { videoWidth, videoHeight } = video;
    
    if (!videoWidth || !videoHeight) return;
    
    // Si no estamos en pantalla completa, restaurar estilos normales
    if (!document.fullscreenElement) {
      video.style.objectFit = 'contain';
      video.style.width = 'auto';
      video.style.height = 'auto';
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      video.style.top = '0';
      video.style.left = '0';
      video.style.margin = '0';
      video.style.position = 'relative';
      return;
    }
    
    // Obtener dimensiones de la pantalla
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const screenRatio = screenWidth / screenHeight;
    const videoRatio = videoWidth / videoHeight;
    
    // Restaurar estilos base para pantalla completa
    video.style.margin = '0';
    video.style.objectFit = 'contain';
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = '0';
    video.style.transform = 'none';
    
    // Detectar dispositivos móviles para ajustes adicionales
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    
    // En dispositivos móviles, manejar los modos portrait/landscape de forma especial
    if (isMobileDevice) {
      if (isLandscape) {
        // En landscape, priorizar el ancho
        if (videoRatio >= 1) { // Video horizontal
          video.style.width = '100%';
          video.style.height = 'auto';
          video.style.maxHeight = '100%';
          
          // Centrar verticalmente
          const newHeight = (screenWidth / videoWidth) * videoHeight;
          if (newHeight < screenHeight) {
            const verticalMargin = (screenHeight - newHeight) / 2;
            video.style.top = `${verticalMargin}px`;
          }
        } else { // Video vertical en pantalla horizontal
          video.style.height = '100%';
          video.style.width = 'auto';
          video.style.maxWidth = '100%';
          
          // Centrar horizontalmente
          const newWidth = (screenHeight / videoHeight) * videoWidth;
          if (newWidth < screenWidth) {
            const horizontalMargin = (screenWidth - newWidth) / 2;
            video.style.left = `${horizontalMargin}px`;
          }
        }
      } else { // Portrait
        if (videoRatio <= 1) { // Video vertical
          video.style.height = '100%';
          video.style.width = 'auto';
          video.style.maxWidth = '100%';
          
          // Centrar horizontalmente
          const newWidth = (screenHeight / videoHeight) * videoWidth;
          if (newWidth < screenWidth) {
            const horizontalMargin = (screenWidth - newWidth) / 2;
            video.style.left = `${horizontalMargin}px`;
          }
        } else { // Video horizontal en pantalla vertical
          video.style.width = '100%';
          video.style.height = 'auto';
          video.style.maxHeight = '100%';
          
          // Centrar verticalmente
          const newHeight = (screenWidth / videoWidth) * videoHeight;
          if (newHeight < screenHeight) {
            const verticalMargin = (screenHeight - newHeight) / 2;
            video.style.top = `${verticalMargin}px`;
          }
        }
      }
      return;
    }
    
    // Para dispositivos no móviles (escritorio)
    if (videoRatio > screenRatio) {
      // Video más ancho que la pantalla: ajustar por ancho
      video.style.width = '100%';
      video.style.height = 'auto';
      video.style.maxHeight = '100%';
      
      // Centrar verticalmente
      const newHeight = (screenWidth / videoWidth) * videoHeight;
      if (newHeight < screenHeight) {
        const verticalMargin = (screenHeight - newHeight) / 2;
        video.style.top = `${verticalMargin}px`;
      }
    } else {
      // Video más alto que la pantalla: ajustar por alto
      video.style.width = 'auto';
      video.style.height = '100%';
      video.style.maxWidth = '100%';
      
      // Centrar horizontalmente
      const newWidth = (screenHeight / videoHeight) * videoWidth;
      if (newWidth < screenWidth) {
        const horizontalMargin = (screenWidth - newWidth) / 2;
        video.style.left = `${horizontalMargin}px`;
      }
    }
    
    // Consola de depuración
    console.debug('Video ajustado en pantalla completa:', {
      videoWidth,
      videoHeight,
      videoRatio,
      screenWidth,
      screenHeight,
      screenRatio,
      isMobileDevice,
      isLandscape,
      styles: {
        width: video.style.width,
        height: video.style.height,
        top: video.style.top,
        left: video.style.left,
        objectFit: video.style.objectFit
      }
    });
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Si no hay video, mostrar un placeholder amigable al estilo Nest
  if (!videoSrc) {
    return (
      <div className="video-player-embedded w-full max-w-full overflow-hidden">
        <div 
          className="empty-player relative overflow-hidden flex flex-col items-center justify-center bg-nest-card-bg"
          style={{ 
            aspectRatio: '16/9',
            width: '100%',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-nest-background opacity-30 flex flex-col items-center justify-center">
            <FaVideo className="text-nest-accent text-opacity-80 text-5xl mb-4 relative z-10" />
            <p className="text-nest-text-primary font-medium text-center text-sm sm:text-base px-4 relative z-10">
              Selecciona un clip para ver
            </p>
            <p className="text-nest-text-secondary text-xs mt-2 text-center max-w-xs px-4 relative z-10">
              Elige un evento de la línea de tiempo o de la lista de eventos
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Versión embebida optimizada para móvil con estilo Nest Doorbell
  return (
    <div className="video-player-embedded w-full max-w-full overflow-hidden">
      <div 
        className="relative bg-black overflow-hidden video-player-container video-wrapper"
        style={{ 
          width: '100%',
          aspectRatio: isFullscreen ? 'auto' : '16/9',
          height: isFullscreen ? '100vh' : 'auto',
          position: 'relative',
          margin: 0,
          padding: 0,
          backgroundColor: '#000'
        }}
        onClick={() => setShowControls(!showControls)}
        onTouchStart={() => setShowControls(!showControls)}
      >
        <video 
          ref={videoRef}
          src={videoSrc} 
          className={`video-fullsize ${isFullscreen ? 'video-fullscreen' : ''} ${videoRatio === 'landscape' ? 'video-horizontal' : 'video-vertical'}`}
          style={{ 
            backgroundColor: '#000', 
            objectFit: isFullscreen ? 'contain' : 'cover',
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            margin: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            display: 'block'
          }}
          onClick={(e) => { e.stopPropagation(); }}
          playsInline
          muted={isMuted}
          onLoadedMetadata={() => {
            if (isFullscreen) {
              adjustFullscreenVideoSize();
            }
          }}
        >
          Tu navegador no soporta la etiqueta de video.
        </video>
        
        {isPictureInPicture && secondaryVideoSrc && (
          <div className={`secondary-video-container absolute ${isMobile ? 'bottom-4 right-4 w-1/3' : 'bottom-16 right-4 w-1/4'} h-1/4 border-2 border-nest-border shadow-lg rounded-lg overflow-hidden`}>
            <video 
              ref={secondaryVideoRef}
              src={secondaryVideoSrc}
              className="w-full h-full"
              style={{ objectFit: 'fill', position: 'absolute' }}
              muted
              playsInline
            >
              Tu navegador no soporta la etiqueta de video.
            </video>
          </div>
        )}
        
        {/* Controles de video */}
        {!isLoading && (
          <div 
            className="video-overlay"
            onClick={(e) => {
              // Si el clic fue directamente en overlay (no en algún control)
              if (e.target === e.currentTarget) {
                togglePlay();
              }
            }}
            onMouseMove={() => setShowControls(true)}
            onMouseLeave={() => {}}
          >
            {isPictureInPicture && secondaryVideoSrc && (
              <div className={`pip-container ${videoRatio}`}>
                <video
                  ref={secondaryVideoRef}
                  className="pip-video"
                  src={secondaryVideoSrc}
                  muted
                  playsInline
                >
                  Tu navegador no soporta la etiqueta de video.
                </video>
              </div>
            )}
            
            <div 
              className="video-controls-bar"
              style={{ opacity: showControls || !isPlaying ? 1 : 0 }}
            >
              <div 
                className="progress-container"
                onClick={handleSeek}
              >
                <div 
                  className="progress-bar"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
              
              <div className="player-controls">
                <div className="controls-left">
                  <button 
                    onClick={(e) => {e.stopPropagation(); togglePlay();}}
                    className="play-button"
                    aria-label={isPlaying ? "Pausar" : "Reproducir"}
                  >
                    {isPlaying ? (
                      <FaPause />
                    ) : (
                      <FaPlay />
                    )}
                  </button>
                  
                  <span className="time-display">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  
                  {/* Nuevo botón para selector de capítulos */}
                  {relatedClips && relatedClips.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowChapterSelector(!showChapterSelector);
                        setShowControls(true);
                      }}
                      className={`chapter-selector-button ${showChapterSelector ? 'active' : ''}`}
                      aria-label="Selector de capítulos"
                    >
                      <FaListUl />
                    </button>
                  )}
                </div>
                
                <div className="controls-right">
                  <button
                    onClick={toggleMute}
                    className="mute-button"
                    aria-label={isMuted ? "Activar sonido" : "Silenciar"}
                  >
                    {isMuted ? (
                      <FaVolumeMute className={isMobile ? "text-sm" : ""} />
                    ) : (
                      <FaVolumeUp className={isMobile ? "text-sm" : ""} />
                    )}
                  </button>
                  
                  <button 
                    onClick={toggleFullscreen}
                    className="fullscreen-button"
                    aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  >
                    {isFullscreen ? (
                      <FaCompress className={isMobile ? "text-sm" : ""} />
                    ) : (
                      <FaExpand className={isMobile ? "text-sm" : ""} />
                    )}
                  </button>
                  
                  {/* GPS Toggle Button */}
                  {gpsMetadata && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('GPS button clicked, current state:', showGPSOverlay);
                        console.log('GPS metadata available:', gpsMetadata);
                        setShowGPSOverlay(!showGPSOverlay);
                        setShowControls(true);
                      }}
                      className={`gps-toggle-button ${showGPSOverlay ? 'active' : ''}`}
                      aria-label={showGPSOverlay ? "Ocultar pista GPS" : "Mostrar pista GPS"}
                    >
                      <FaRoute className={isMobile ? "text-sm" : ""} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Selector de capítulos estilo Netflix */}
            {showChapterSelector && chapterSegments.length > 0 && (
              <div 
                className="chapter-selector" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="chapter-selector-header">
                  <h3>Capítulos</h3>
                  <button 
                    onClick={() => setShowChapterSelector(false)}
                    className="close-chapter-selector"
                  >
                    &times;
                  </button>
                </div>
                <div className="chapter-segments">
                  {chapterSegments.map((segment, idx) => (
                    <div key={`segment-${idx}`} className="chapter-segment">
                      <div className="segment-title">{segment.label}</div>
                      <div className="segment-clips">
                        {segment.clips.map((clip, clipIdx) => (
                          <div 
                            key={`clip-${clip.id || clipIdx}`}
                            className={`chapter-clip ${clip.id === clipMetadata?.id ? 'active' : ''}`}
                            onClick={() => {
                              // Lógica para cambiar al clip seleccionado
                              if (clip.id !== clipMetadata?.id) {
                                handleClipSelection(clip);
                              }
                              setShowChapterSelector(false);
                            }}
                          >
                            <div className="clip-thumbnail">
                              <img 
                                src={clip.thumbnailUrl || (getClipThumbnail ? getClipThumbnail(clip) : `https://placehold.co/120x68?text=${format(new Date(clip.timestamp), 'h:mm')}`)}
                                alt={`Miniatura ${format(new Date(clip.timestamp), 'h:mm a')}`}
                                onError={(e) => {
                                  e.target.src = `https://placehold.co/120x68?text=${format(new Date(clip.timestamp), 'h:mm')}`;
                                }}
                              />
                              <div className="clip-duration">{format(new Date(clip.timestamp), 'h:mm a')}</div>
                            </div>
                            <div className="clip-info">
                              <div className="clip-title">{format(new Date(clip.timestamp), 'h:mm:ss a')}</div>
                              {clip.id === clipMetadata?.id && <div className="clip-playing">Reproduciendo</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40" onClick={togglePlay}>
            <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full bg-nest-selected bg-opacity-90 flex items-center justify-center shadow-lg transition-transform transform hover:scale-105`}>
              <FaPlay className={`text-white ${isMobile ? 'text-lg ml-0.5' : 'text-2xl ml-1'}`} />
            </div>
          </div>
        )}
        
        {/* GPS Overlay */}
        {showGPSOverlay && gpsMetadata && (
          <div className="absolute top-4 right-4 pointer-events-auto z-50">
            <VideoGPSMap 
              gpsMetadata={gpsMetadata}
              compact={true}
              onToggleView={(expanded) => {
                console.log('GPS map view toggled, expanded:', expanded);
              }}
              onClose={() => {
                console.log('GPS map closed');
                setShowGPSOverlay(false);
              }}
              tripId={clipMetadata?.trip_id || null}
            />
          </div>
        )}
        
        {/* Chapter Selector Overlay */}
        {showChapterSelector && relatedClips.length > 0 && (
          <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
            <div className="bg-nest-card-bg rounded-lg shadow-lg p-4 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-nest-text-primary font-semibold text-lg">
                  Seleccionar capítulo
                </h3>
                <button
                  onClick={() => setShowChapterSelector(false)}
                  className="text-nest-text-secondary"
                  aria-label="Cerrar selector de capítulos"
                >
                  <FaCompress />
                </button>
              </div>
              
              <div className="flex flex-col space-y-2">
                {chapterSegments.map((segment, index) => (
                  <div key={index} className="bg-nest-background rounded-lg p-3">
                    <div className="text-nest-text-primary font-medium">
                      {segment.label}
                    </div>
                    <div className="flex flex-col mt-2">
                      {segment.clips.map((clip, clipIndex) => (
                        <button
                          key={clip.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowChapterSelector(false);
                            // Navegar al clip seleccionado
                            if (videoRef.current) {
                              videoRef.current.currentTime = clip.startTime || 0;
                              videoRef.current.play();
                              setIsPlaying(true);
                            }
                          }}
                          className="text-nest-accent hover:underline"
                          aria-label={`Ir al capítulo de ${clip.title}`}
                        >
                          {clip.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
