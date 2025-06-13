import React from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import ClipItem from './ClipItem';

const TimelineSegment = ({
  segment,
  hour,
  viewMode,
  videoClips,
  currentClipIndex,
  setCurrentClipIndex,
  onSelectClip,
  getThumbnailUrl,
  isExpanded,
  onToggleExpansion,
  onMouseMove,
  onMouseLeave,
  isMobile,
  darkMode = false
}) => {
  return (
    <div className={`mb-3 rounded overflow-visible ${viewMode === 'grid' ? 'col-span-full' : ''}`}>
      {/* Segment Header */}
      <div 
        className={`flex justify-between items-center p-2 ${darkMode ? 'bg-neutral-700 hover:bg-neutral-600' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer transition-colors duration-200`}
        onClick={onToggleExpansion}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpansion();
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Colapsar' : 'Expandir'} segmento ${segment.start} - ${segment.end} minutos`}
      >
        <div className="flex items-center gap-2">
          <span className={`font-medium ${darkMode ? 'text-neutral-100' : 'text-gray-800'}`}>{`${segment.start} - ${segment.end}`}</span>
          <span className={`text-xs ${darkMode ? 'text-neutral-400 bg-neutral-900' : 'text-gray-600 bg-gray-200'} bg-opacity-30 px-2 py-1 rounded-full`}>
            {segment.clips.length} clips
          </span>
        </div>
        <div className={`${darkMode ? 'text-neutral-400' : 'text-gray-600'}`}>
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </div>
      </div>
      
      {/* Segment Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-none p-1' : 'max-h-0 p-0'
      } ${
        viewMode === 'grid' 
          ? isMobile 
            ? 'grid grid-cols-2 gap-1'
            : 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-1' 
          : 'flex flex-col'
      }`}>
        {segment.clips.map((clip) => {
          const globalIndex = videoClips.findIndex(c => 
            (c.id && clip.id && c.id === clip.id) || 
            (c.timestamp && clip.timestamp && c.timestamp === clip.timestamp)
          );
          
          return (
            <ClipItem
              key={`clip-${clip.id || globalIndex}`}
              clip={clip}
              globalIndex={globalIndex}
              hour={hour}
              segment={segment}
              viewMode={viewMode}
              isActive={currentClipIndex === globalIndex}
              videoClips={videoClips}
              setCurrentClipIndex={setCurrentClipIndex}
              onSelectClip={onSelectClip}
              getThumbnailUrl={getThumbnailUrl}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              isMobile={isMobile}
              darkMode={darkMode}
            />
          );
        })}
      </div>
    </div>
  );
};

export default TimelineSegment;
