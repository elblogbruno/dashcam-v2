import React from 'react';
import { FaExpand, FaCompress, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaRoute, FaListUl, FaInfoCircle } from 'react-icons/fa';

const VideoControls = ({
  isPlaying,
  currentTime,
  duration,
  showControls,
  isMuted,
  isFullscreen,
  isMobile,
  gpsMetadata,
  showGPSOverlay,
  relatedClips,
  showChapterSelector,
  showClipInfo,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onToggleGPS,
  onToggleChapterSelector,
  onToggleClipInfo,
  onSeek
}) => {
  // Debug log para verificar el render de los controles
  console.log('VideoControls render:', {
    showControls,
    isPlaying,
    duration,
    hasRelatedClips: relatedClips?.length > 0
  });

  // Si no se deben mostrar los controles, no renderizar nada
  if (!showControls) {
    console.log('❌ CONTROLS HIDDEN - No rendering');
    return null;
  }

  console.log('🎮 CONTROLS SHOULD BE VISIBLE NOW! - POSITIONED ABSOLUTE');

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div 
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent transition-all duration-300 pointer-events-auto opacity-100 visible translate-y-0 min-h-20 z-50"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      {/* Barra de progreso */}
      <div 
        className="relative h-2 bg-white/20 cursor-pointer mx-4 mb-4 rounded-full group hover:h-3 transition-all"
        onClick={onSeek}
      >
        <div 
          className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-100 rounded-full"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
        <div 
          className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-lg transition-all duration-100 opacity-0 group-hover:opacity-100 -ml-2"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>
      
      {/* Controles */}
      <div 
        className="flex items-center justify-between px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isPlaying ? (
              <FaPause className="text-white text-sm" />
            ) : (
              <FaPlay className="text-white text-sm ml-0.5" />
            )}
          </button>
          
          <span className="text-white text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          
          {/* Grupo de botones: Capítulos, Info del Clip, GPS */}
          <div className="flex items-center space-x-2">
            {/* Botón selector de capítulos */}
            {relatedClips && relatedClips.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChapterSelector();
                }}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${
                  showChapterSelector
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                aria-label="Selector de capítulos"
              >
                <FaListUl className="text-sm" />
              </button>
            )}
            
            {/* Botón información del clip */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleClipInfo();
              }}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${
                showClipInfo
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              aria-label={showClipInfo ? "Ocultar información del clip" : "Mostrar información del clip"}
            >
              <FaInfoCircle className="text-sm" />
            </button>
            
            {/* Botón GPS */}
            {gpsMetadata && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleGPS();
                }}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${
                  showGPSOverlay 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                aria-label={showGPSOverlay ? "Ocultar pista GPS" : "Mostrar pista GPS"}
              >
                <FaRoute className={`${isMobile ? "text-xs" : "text-sm"}`} />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label={isMuted ? "Activar sonido" : "Silenciar"}
          >
            {isMuted ? (
              <FaVolumeMute className={`text-white ${isMobile ? "text-xs" : "text-sm"}`} />
            ) : (
              <FaVolumeUp className={`text-white ${isMobile ? "text-xs" : "text-sm"}`} />
            )}
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              console.log('🎯 FULLSCREEN BUTTON CLICKED in VideoControls');
              console.log('Current fullscreen state:', isFullscreen);
              console.log('onToggleFullscreen function:', typeof onToggleFullscreen);
              onToggleFullscreen(e);
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <FaCompress className={`text-white ${isMobile ? "text-xs" : "text-sm"}`} />
            ) : (
              <FaExpand className={`text-white ${isMobile ? "text-xs" : "text-sm"}`} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoControls;
