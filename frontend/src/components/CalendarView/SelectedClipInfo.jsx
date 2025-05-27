import React from 'react';
import { format } from 'date-fns';
import { FaRegClock, FaMapMarkerAlt, FaDownload, FaVideo } from 'react-icons/fa';
import PropTypes from 'prop-types';

const SelectedClipInfo = ({ selectedClip, getVideoUrl, isMobile = false }) => {
  if (!selectedClip) {
    return (
      <div className={`bg-gray-50 p-4 rounded-lg border border-gray-200 text-center ${isMobile ? 'text-sm' : ''}`}>
        <div className="text-gray-400 text-xl mb-2">
          <FaVideo />
        </div>
        <p className="text-gray-600">Selecciona un clip para ver detalles</p>
      </div>
    );
  }

  // Formatear la fecha del clip
  const formatClipTime = (timeStr) => {
    try {
      if (!timeStr) return '';
      return format(new Date(timeStr), 'HH:mm:ss');
    } catch (e) {
      return timeStr;
    }
  };

  const startTime = formatClipTime(selectedClip.start_time);
  const endTime = formatClipTime(selectedClip.end_time);

  return (
    <div className={`bg-gray-50 p-3 rounded-lg border border-gray-200 ${isMobile ? 'text-sm' : ''}`}>
      <h3 className={`font-medium text-dashcam-800 mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>Clip seleccionado</h3>
      
      {/* Información del clip */}
      <div className="space-y-2">
        <div className="flex items-center text-gray-700">
          <FaRegClock className="mr-2 text-dashcam-600 flex-shrink-0" />
          <div>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'}`}>
              {startTime} - {endTime}
            </div>
            {selectedClip.duration && (
              <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>
                {Math.floor(selectedClip.duration / 60)}:{(selectedClip.duration % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {selectedClip.landmark_id && (
          <div className="flex items-center text-gray-700">
            <FaMapMarkerAlt className="mr-2 text-red-500 flex-shrink-0" />
            <div className={`${isMobile ? 'text-xs' : 'text-sm'}`}>
              Punto de interés: {selectedClip.landmark_name || selectedClip.landmark_id}
            </div>
          </div>
        )}

        {/* Botones de acción para descargar clips */}
        <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-gray-200">
          {selectedClip.road_video_file && (
            <a 
              href={getVideoUrl(selectedClip.road_video_file)} 
              download
              className="flex items-center px-2 py-1 bg-dashcam-100 hover:bg-dashcam-200 text-dashcam-800 rounded text-xs transition-colors"
            >
              <FaDownload className="mr-1" /> Exterior
            </a>
          )}

          {selectedClip.interior_video_file && (
            <a 
              href={getVideoUrl(selectedClip.interior_video_file)} 
              download
              className="flex items-center px-2 py-1 bg-dashcam-100 hover:bg-dashcam-200 text-dashcam-800 rounded text-xs transition-colors"
            >
              <FaDownload className="mr-1" /> Interior
            </a>
          )}
          
          {/* Botón móvil de cerrar panel */}
          {isMobile && (
            <button 
              className="ml-auto flex items-center px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs transition-colors"
              onClick={() => {
                // Este es un truco temporal - hacer scroll hacia arriba donde está el video
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth'
                });
              }}
            >
              <FaVideo className="mr-1" /> Ver video
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

SelectedClipInfo.propTypes = {
  selectedClip: PropTypes.object,
  getVideoUrl: PropTypes.func.isRequired,
  isMobile: PropTypes.bool
};

export default SelectedClipInfo;
