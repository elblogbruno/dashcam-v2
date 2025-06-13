import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { format } from 'date-fns';

const ChapterSelector = ({
  chapterSegments,
  clipMetadata,
  getClipThumbnail,
  onSelectClip,
  onClose
}) => {
  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-2xl w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[70vh] sm:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700 flex-shrink-0">
          <h3 className="text-white font-medium text-base sm:text-lg">Capítulos</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 text-lg sm:text-xl"
            aria-label="Cerrar selector"
          >
            <FaTimes />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#4b5563 #1f2937'
        }}>
          {chapterSegments.map((segment, idx) => (
            <div key={`segment-${idx}`} className="border-b border-gray-700 last:border-b-0">
              <div className="text-gray-400 text-xs sm:text-sm bg-black/30 px-3 py-2 font-medium">
                {segment.label}
              </div>
              <div className="flex flex-col">
                {segment.clips.map((clip, clipIdx) => (
                  <div 
                    key={`clip-${clip.id || clipIdx}`}
                    className={`flex items-center p-3 sm:p-3 border-b border-gray-800 last:border-b-0 cursor-pointer transition-colors ${
                      clip.id === clipMetadata?.id 
                        ? 'bg-white/15' 
                        : 'hover:bg-white/10 active:bg-white/5'
                    }`}
                    onClick={() => {
                      if (clip.id !== clipMetadata?.id) {
                        onSelectClip(clip);
                      }
                      onClose();
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-20 sm:w-20 h-12 sm:h-12 rounded overflow-hidden flex-shrink-0 mr-3">
                      <img 
                        src={clip.thumbnailUrl || (getClipThumbnail ? getClipThumbnail(clip) : `https://placehold.co/80x48?text=${format(new Date(clip.timestamp), 'h:mm')}`)}
                        alt={`Miniatura ${format(new Date(clip.timestamp), 'h:mm a')}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://placehold.co/80x48?text=${format(new Date(clip.timestamp), 'h:mm')}`;
                        }}
                      />
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                        {format(new Date(clip.timestamp), 'h:mm')}
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm sm:text-base font-medium truncate">
                        {format(new Date(clip.timestamp), 'h:mm:ss a')}
                      </div>
                      {clip.id === clipMetadata?.id && (
                        <div className="text-green-400 text-xs sm:text-sm font-medium">Reproduciendo</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChapterSelector;
