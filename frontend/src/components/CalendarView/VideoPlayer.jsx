import React, { useRef, useEffect, useState } from 'react';
import { FaExpand, FaCompress, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaVideo, FaThLarge } from 'react-icons/fa';

const VideoPlayer = ({ 
  videoSrc, 
  onClose, 
  isPictureInPicture = false,
  secondaryVideoSrc = null,
  isFullPlayer = true // Si es true, se muestra como modal. Si es false, se muestra embebido
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

  useEffect(() => {
    // Si hay un nuevo video, reiniciar estados
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(error => {
        console.error('Error playing video:', error);
      });
    }

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
  }, [videoSrc, secondaryVideoSrc]);

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
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    setShowControls(true);
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Si no hay video, mostrar un placeholder amigable
  if (!videoSrc) {
    return (
      <div className="video-player-embedded w-full max-w-full overflow-hidden">
        <div 
          className="relative bg-gray-100 rounded-lg overflow-hidden flex flex-col items-center justify-center"
          style={{ 
            height: isMobile ? '220px' : '400px', 
            maxHeight: isMobile ? '50vh' : 'calc(55vh - 40px)',
            width: '100%',
          }}
        >
          <FaThLarge className="text-gray-300 text-5xl mb-4" />
          <p className="text-gray-500 font-medium text-center text-sm sm:text-base px-4">
            Selecciona un clip o video para reproducir
          </p>
          <p className="text-gray-400 text-xs mt-2 text-center max-w-xs px-4">
            Haz clic en un video de la línea de tiempo o en la lista de videos disponibles
          </p>
        </div>
      </div>
    );
  }

  // Versión embebida optimizada para móvil
  return (
    <div className="video-player-embedded w-full max-w-full overflow-hidden">
      <div 
        className="relative bg-black rounded-lg overflow-hidden"
        style={{ 
          height: isMobile ? '220px' : '400px', 
          maxHeight: isMobile ? '50vh' : 'calc(55vh - 40px)',
          width: '100%', // Asegurarse que nunca exceda el ancho del padre
        }}
        onClick={() => setShowControls(!showControls)}
        onTouchStart={() => setShowControls(!showControls)}
      >
        <video 
          ref={videoRef}
          src={videoSrc} 
          className="w-full h-full bg-black object-contain"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          playsInline // Importante para iOS
          muted={isMuted}
        >
          Your browser does not support the video tag.
        </video>
        
        {/* PIP Video adaptativo */}
        {isPictureInPicture && secondaryVideoSrc && (
          <div className={`absolute ${isMobile ? 'bottom-2 right-2 w-1/3' : 'top-4 right-4 w-1/4'} h-1/4 border-2 border-white shadow-lg rounded overflow-hidden`}>
            <video 
              ref={secondaryVideoRef}
              src={secondaryVideoSrc}
              className="w-full h-full object-cover"
              muted
              playsInline
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}
        
        {/* Controles optimizados */}
        <div 
          className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}
        >
          {/* Barra de progreso táctil para móvil */}
          <div 
            className="h-2 w-full bg-gray-700 cursor-pointer overflow-hidden px-2 mt-2"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-dashcam-500 rounded-full"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
          </div>
          
          {/* Panel de controles */}
          <div className="px-2 py-1 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <button 
                onClick={(e) => {e.stopPropagation(); togglePlay();}}
                className="text-white p-1 hover:text-dashcam-300 transition-colors"
              >
                {isPlaying ? (
                  <FaPause className={isMobile ? "text-sm" : ""} />
                ) : (
                  <FaPlay className={isMobile ? "text-sm" : ""} />
                )}
              </button>
              
              <button
                onClick={toggleMute}
                className="text-white hover:text-dashcam-300 transition-colors"
              >
                {isMuted ? (
                  <FaVolumeMute className={isMobile ? "text-sm" : ""} />
                ) : (
                  <FaVolumeUp className={isMobile ? "text-sm" : ""} />
                )}
              </button>
              
              <span className={`text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <button 
              onClick={toggleFullscreen}
              className="text-white p-1 hover:text-dashcam-300 transition-colors"
            >
              {isFullscreen ? (
                <FaCompress className={isMobile ? "text-sm" : ""} />
              ) : (
                <FaExpand className={isMobile ? "text-sm" : ""} />
              )}
            </button>
          </div>
        </div>
        
        {/* Overlay de play grande solo cuando está pausado */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30" onClick={togglePlay}>
            <div className={`${isMobile ? 'w-10 h-10' : 'w-14 h-14'} rounded-full bg-dashcam-600 bg-opacity-70 flex items-center justify-center`}>
              <FaPlay className={`text-white ${isMobile ? 'text-lg ml-0.5' : 'text-2xl ml-1'}`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
