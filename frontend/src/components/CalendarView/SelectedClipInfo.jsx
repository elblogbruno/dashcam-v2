import React, { useState } from 'react';
import { format } from 'date-fns';
import { FaRegClock, FaMapMarkerAlt, FaDownload, FaVideo, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import PropTypes from 'prop-types';

const SelectedClipInfo = ({ selectedClip, getVideoUrl, isMobile = false, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  if (!selectedClip) {
    return null;
  }
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

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
    <div className={`bg-[#2e3033] rounded-xl border border-white/10 m-3 overflow-hidden transition-all duration-300 flex-shrink-0 ${
      isCollapsed ? 'max-h-16 min-h-16' : 'max-h-fit'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-[#2e3033]">
        <h3 className="text-base font-semibold text-white m-0">Clip seleccionado</h3>
        <div className="flex gap-2 items-center">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCollapse();
            }} 
            className="bg-transparent border border-white/10 text-white/70 cursor-pointer p-2 rounded-md flex items-center justify-center transition-all duration-200 w-8 h-8 hover:text-white hover:bg-white/10 hover:border-[#8ab4f8]"
            aria-label={isCollapsed ? "Expandir" : "Colapsar"}
          >
            {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className={`transition-all duration-300 overflow-y-auto flex flex-col ${
        isCollapsed ? 'max-h-0 p-0 opacity-0 overflow-hidden' : 'p-5 gap-4'
      }`}>
        {/* Información de tiempo */}
        <div className="flex items-start gap-3">
          <div className="text-[#8ab4f8] text-base mt-0.5 flex-shrink-0">
            <FaRegClock />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Clip Details</div>
              {selectedClip.id && (
                <div className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-white/70">
                  ID: {selectedClip.id}
                </div>
              )}
            </div>
            <div className="font-medium text-white leading-relaxed p-2 bg-white/5 rounded-md border border-white/10">
              {startTime} - {endTime}
            </div>
            {selectedClip.duration && (
              <div className="text-xs text-white/70 mt-1.5">
                Duración: {Math.floor(selectedClip.duration / 60)}:{(selectedClip.duration % 60).toString().padStart(2, '0')} min
              </div>
            )}
          </div>
        </div>

        {/* Información de ubicación */}
        {selectedClip.landmark_id && (
          <div className="flex items-start gap-3">
            <div className="text-red-500 text-base mt-0.5 flex-shrink-0">
              <FaMapMarkerAlt />
            </div>
            <div className="flex-1">
              <div className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-2">Ubicación</div>
              <div className="font-medium text-white leading-relaxed p-2 bg-white/5 rounded-md border border-white/10">
                {selectedClip.landmark_name || selectedClip.landmark_id}
              </div>
            </div>
          </div>
        )}

        {/* Acciones de descarga */}
        <div className="border-t border-white/10 pt-4">
          <div className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-3">Acciones disponibles</div>
          <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-row flex-wrap'}`}>
            {selectedClip.road_video_file && getVideoUrl && (
              <a 
                href={getVideoUrl(selectedClip.road_video_file)} 
                download={`clip-exterior-${selectedClip.id || 'video'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-4 py-2.5 text-white rounded-md font-medium text-sm no-underline transition-opacity duration-200 min-h-9 justify-center bg-[#8ab4f8] hover:opacity-80 ${
                  isMobile ? 'w-full' : 'flex-1 min-w-28'
                }`}
              >
                <FaDownload /> 
                <span>Exterior</span>
              </a>
            )}

            {selectedClip.interior_video_file && getVideoUrl && (
              <a 
                href={getVideoUrl(selectedClip.interior_video_file)} 
                download={`clip-interior-${selectedClip.id || 'video'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-4 py-2.5 text-white rounded-md font-medium text-sm no-underline transition-opacity duration-200 min-h-9 justify-center bg-[#10b981] hover:opacity-80 ${
                  isMobile ? 'w-full' : 'flex-1 min-w-28'
                }`}
              >
                <FaDownload /> 
                <span>Interior</span>
              </a>
            )}

            {(!selectedClip.road_video_file && !selectedClip.interior_video_file) && (
              <div className="text-sm italic p-2 rounded bg-white/5 text-white/70">
                No hay videos disponibles para descarga
              </div>
            )}

            {(selectedClip.road_video_file || selectedClip.interior_video_file) && !getVideoUrl && (
              <div className="text-sm italic p-2 rounded bg-red-500/20 text-red-400">
                Función de descarga no disponible
              </div>
            )}
            
            {isMobile && (
              <button 
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/10 text-white rounded-md text-sm cursor-pointer transition-colors duration-200 w-full justify-center mt-3 hover:bg-white/15"
                onClick={() => {
                  window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                  });
                }}
              >
                <FaVideo /> Ver video
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

SelectedClipInfo.propTypes = {
  selectedClip: PropTypes.object,
  getVideoUrl: PropTypes.func.isRequired,
  isMobile: PropTypes.bool,
  onClose: PropTypes.func
};

export default SelectedClipInfo;
