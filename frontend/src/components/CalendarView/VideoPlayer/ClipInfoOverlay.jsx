import React from 'react';
import { format } from 'date-fns';
import { FaRegClock, FaMapMarkerAlt, FaVideo, FaDownload } from 'react-icons/fa';
import PropTypes from 'prop-types';

const ClipInfoOverlay = ({ selectedClip, showClipInfo, getVideoUrl }) => {
  if (!selectedClip || !showClipInfo) {
    return null;
  }

  const formatClipTime = (timeStr) => {
    try {
      if (!timeStr) return '';
      return format(new Date(timeStr), 'HH:mm:ss');
    } catch (e) {
      return timeStr;
    }
  };

  const formatClipDate = (timeStr) => {
    try {
      if (!timeStr) return '';
      return format(new Date(timeStr), 'MMM dd, yyyy');
    } catch (e) {
      return timeStr;
    }
  };

  const hasGPSData = selectedClip.start_lat && selectedClip.start_lon;

  // Función para extraer información de ubicación del clip
  const getLocationInfo = () => {
    if (!selectedClip.location) return null;
    
    try {
      const locationData = typeof selectedClip.location === 'string' 
        ? JSON.parse(selectedClip.location) 
        : selectedClip.location;
      
      return locationData;
    } catch (e) {
      console.error('Error parsing location data:', e);
      return null;
    }
  };

  const locationInfo = getLocationInfo();

  return (
    <div className="absolute top-4 left-4 right-4 z-40 pointer-events-none">
      <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 max-w-md">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Información principal del clip */}
            <div className="flex items-center space-x-2 mb-1">
              <FaVideo className="text-blue-400 text-xs flex-shrink-0" />
              <span className="text-white text-sm font-medium truncate">
                {selectedClip.filename || 'Video Clip'}
              </span>
            </div>
            
            {/* Fecha y hora */}
            <div className="flex items-center space-x-4 text-xs text-gray-300">
              <div className="flex items-center space-x-1">
                <FaRegClock className="text-xs" />
                <span>{formatClipDate(selectedClip.start_time)}</span>
              </div>
              <span>
                {formatClipTime(selectedClip.start_time)}
                {selectedClip.end_time && selectedClip.end_time !== selectedClip.start_time && (
                  ` - ${formatClipTime(selectedClip.end_time)}`
                )}
              </span>
            </div>
            
            {/* Información GPS si está disponible */}
            {hasGPSData && (
              <div className="flex items-center space-x-1 mt-1 text-xs text-gray-300">
                <FaMapMarkerAlt className="text-xs text-green-400" />
                <span>
                  {selectedClip.start_lat.toFixed(4)}, {selectedClip.start_lon.toFixed(4)}
                </span>
              </div>
            )}

            {/* Información de ubicación de geocodificación inversa */}
            {locationInfo && (
              <div className="mt-1 text-xs text-gray-300">
                <div className="flex items-center space-x-1">
                  <FaMapMarkerAlt className="text-xs text-blue-400" />
                  <span className="truncate">
                    {locationInfo.city || locationInfo.town || locationInfo.village || 'Ubicación'}
                    {locationInfo.country && `, ${locationInfo.country}`}
                  </span>
                </div>
                {locationInfo.display_name && (
                  <div className="ml-3 mt-0.5 text-xs text-gray-400 truncate max-w-xs">
                    {locationInfo.display_name}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Botones de descarga */}
          {getVideoUrl && (selectedClip.road_video_file || selectedClip.interior_video_file) && (
            <div className="flex space-x-1 ml-3 pointer-events-auto">
              {selectedClip.road_video_file && (
                <a 
                  href={getVideoUrl(selectedClip.road_video_file)} 
                  download={`clip-exterior-${selectedClip.id || 'video'}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 bg-blue-600/80 hover:bg-blue-600 rounded-full transition-colors"
                  title="Descargar video exterior"
                >
                  <FaDownload className="text-white text-xs" />
                </a>
              )}
              
              {selectedClip.interior_video_file && (
                <a 
                  href={getVideoUrl(selectedClip.interior_video_file)} 
                  download={`clip-interior-${selectedClip.id || 'video'}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 bg-green-600/80 hover:bg-green-600 rounded-full transition-colors"
                  title="Descargar video interior"
                >
                  <FaDownload className="text-white text-xs" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ClipInfoOverlay.propTypes = {
  selectedClip: PropTypes.object,
  showClipInfo: PropTypes.bool.isRequired,
  getVideoUrl: PropTypes.func
};

export default ClipInfoOverlay;
