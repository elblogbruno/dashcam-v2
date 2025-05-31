import React, { useRef, useEffect, useState } from 'react';
import { FaExpand, FaCompress, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaVideo, FaThLarge } from 'react-icons/fa';
 
const VideoPlayer = ({ 
  videoSrc, 
  onClose, 
  isPictureInPicture = false,
  secondaryVideoSrc = null,
  isFullPlayer = true, // Si es true, se muestra como modal. Si es false, se muestra embebido
  onLoadStart = null,  // Callback cuando el video comienza a cargar
  onLoadComplete = null, // Callback cuando el video está listo
  autoPlay = true      // Reproducción automática por defecto
}) => {
  const videoRef = useRef(null);
  const secondaryVideoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(1);
  const [videoRatio, setVideoRatio] = useState('landscape'); // 'landscape' o 'portrait'

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
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
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
            </div>
          </div>
        </div>
        
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40" onClick={togglePlay}>
            <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full bg-nest-selected bg-opacity-90 flex items-center justify-center shadow-lg transition-transform transform hover:scale-105`}>
              <FaPlay className={`text-white ${isMobile ? 'text-lg ml-0.5' : 'text-2xl ml-1'}`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
