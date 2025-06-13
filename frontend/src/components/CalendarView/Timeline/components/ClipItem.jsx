import React from 'react';
import { format } from 'date-fns';
import { FaPlay, FaMapMarkerAlt } from 'react-icons/fa';

const ClipItem = ({
  clip,
  globalIndex,
  hour,
  segment,
  viewMode,
  isActive,
  videoClips,
  setCurrentClipIndex,
  onSelectClip,
  getThumbnailUrl,
  onMouseMove,
  onMouseLeave,
  isMobile,
  darkMode = false
}) => {
  // Función para extraer información de ubicación del clip
  const getLocationInfo = () => {
    if (!clip.location) return null;
    
    try {
      const locationData = typeof clip.location === 'string' 
        ? JSON.parse(clip.location) 
        : clip.location;
      
      // Devolver información resumida de ubicación
      return {
        city: locationData.city,
        town: locationData.town,
        village: locationData.village,
        country: locationData.country,
        display_name: locationData.display_name
      };
    } catch (e) {
      console.error('Error parsing location data:', e);
      return null;
    }
  };

  const locationInfo = getLocationInfo();
  const handleClick = () => {
    if (globalIndex !== -1) {
      setCurrentClipIndex(globalIndex);
      onSelectClip(videoClips[globalIndex]);
    } else {
      onSelectClip(clip);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div 
      className={`cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${darkMode ? 'bg-neutral-800' : 'bg-white'} border-2 border-transparent ${
        isActive ? 'border-blue-500 shadow-lg shadow-blue-500/30' : darkMode ? 'hover:border-neutral-600' : 'hover:border-gray-300'
      } ${viewMode === 'grid' 
          ? isMobile 
            ? 'aspect-[16/9] hover:scale-[1.02] min-h-[120px]' 
            : 'aspect-video hover:scale-105' 
          : 'flex items-center p-2 gap-3'}`}
      data-clip-index={globalIndex}
      data-hour={hour}
      data-segment={segment.start}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => {
        onMouseMove(e, clip, globalIndex);
      }}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={0}
      aria-label={`Reproducir clip de ${clip.timestamp ? format(new Date(clip.timestamp), 'h:mm a') : ''}`}
    >
      {viewMode === 'grid' ? (
        // Grid View
        <div className="relative h-full">
          <img 
            src={getThumbnailUrl(clip)} 
            alt={`Miniatura ${clip.timestamp ? format(new Date(clip.timestamp), 'h:mm a') : ''}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.src = 'https://placehold.co/600x400?text=No+Preview';
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-70">
            <div className="w-8 h-8 bg-black bg-opacity-70 text-white rounded-full flex items-center justify-center">
              <FaPlay className={`${isMobile ? 'text-xs' : 'text-sm'}`} />
            </div>
          </div>
          {clip.tags && (
            <div className="absolute top-1 left-1 flex flex-wrap gap-1">
              {clip.tags.split(',').slice(0, isMobile ? 1 : 2).map((tag, i) => (
                <span key={i} className={`${darkMode ? 'bg-neutral-700 text-neutral-100' : 'bg-black bg-opacity-75 text-white'} ${isMobile ? 'text-[10px] px-1 py-0.5' : 'text-xs px-2 py-1'} rounded`}>
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
            <div className={`text-white ${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
              {clip.timestamp ? format(new Date(clip.timestamp), 'h:mm a') : ''}
            </div>
            <div className={`text-gray-300 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
              {clip.source || (clip.road_video_file ? 'dashcam' : 'external')}
            </div>
            {/* Mostrar información de ubicación si está disponible */}
            {locationInfo && (
              <div className={`text-blue-300 ${isMobile ? 'text-[10px]' : 'text-xs'} flex items-center gap-1 mt-1 truncate`}>
                <FaMapMarkerAlt className="flex-shrink-0" />
                <span className="truncate">
                  {locationInfo.city || locationInfo.town || locationInfo.village || 'Ubicación disponible'}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        // List View
        <>
          <div className={`flex-shrink-0 relative rounded overflow-hidden ${
            isMobile ? 'w-16 h-10' : 'w-20 h-11'
          }`}>
            <img 
              src={getThumbnailUrl(clip)} 
              alt={`Miniatura ${clip.timestamp ? format(new Date(clip.timestamp), 'h:mm a') : ''}`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.target.src = 'https://placehold.co/600x400?text=No+Preview';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-50">
              <FaPlay className="text-white text-xs" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className={`${darkMode ? 'text-neutral-100' : 'text-gray-800'} ${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
              {clip.timestamp ? format(new Date(clip.timestamp), isMobile ? 'h:mm a' : 'h:mm:ss a') : ''}
            </div>
            <div className={`${darkMode ? 'text-neutral-400' : 'text-gray-600'} ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
              {clip.source || (clip.road_video_file ? 'dashcam' : 'external')}
            </div>
            {/* Mostrar información de ubicación en vista lista */}
            {locationInfo && (
              <div className={`${darkMode ? 'text-blue-400' : 'text-blue-600'} ${isMobile ? 'text-[10px]' : 'text-xs'} flex items-center gap-1 mt-1`}>
                <FaMapMarkerAlt className="flex-shrink-0" />
                <span className="truncate">
                  {locationInfo.city || locationInfo.town || locationInfo.village || 'Ubicación disponible'}
                </span>
              </div>
            )}
            {clip.tags && (
              <div className="flex flex-wrap gap-1 mt-1">
                {clip.tags.split(',').slice(0, isMobile ? 1 : 2).map((tag, i) => (
                  <span key={i} className={`${darkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-gray-200 text-gray-700'} ${isMobile ? 'text-[10px] px-0.5 py-px' : 'text-xs px-1 py-0.5'} rounded`}>
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ClipItem;
