import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useTimelineData } from './hooks/useTimelineData';
import { useTimelineInteraction } from './hooks/useTimelineInteraction';
import TimelineHeader from './components/TimelineHeader';
import TimelineNavigation from './components/TimelineNavigation';
import TimelineContent from './components/TimelineContent';
import TimeTooltip from './components/TimeTooltip';

const GooglePhotosTimeline = forwardRef(({ 
  videoClips = [], 
  onSelectClip,
  getThumbnailUrl,
  emptyMessage = "No hay eventos para mostrar",
  filters,
  onFiltersChange,
  allTags = [],
  sourceOptions = [],
  isMobile = false,
  darkMode = false
}, ref) => {
  const timelineRef = useRef(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState({});

  // Custom hooks para lógica separada
  const { clipsByHour, hourLabels } = useTimelineData(videoClips);
  const { 
    hoveredTime, 
    mousePosition, 
    handleMouseMove, 
    handleMouseLeave 
  } = useTimelineInteraction();

  // Exponer métodos al componente padre
  useImperativeHandle(ref, () => ({
    scrollTo: (position) => {
      if (timelineRef.current) {
        timelineRef.current.scrollTo(position);
      }
    },
    getCurrentClip: () => {
      return currentClipIndex !== null ? videoClips[currentClipIndex] : null;
    },
    setCurrentClip: (index) => {
      setCurrentClipIndex(index);
    }
  }), [currentClipIndex, videoClips]);

  const scrollToHour = (hour) => {
    if (clipsByHour[hour] && clipsByHour[hour].clips.length > 0) {
      const firstClipOfHour = clipsByHour[hour].clips[0];
      const clipIndex = videoClips.findIndex(clip => 
        clip.id === firstClipOfHour.id || 
        clip.timestamp === firstClipOfHour.timestamp
      );
      
      if (clipIndex !== -1) {
        const element = document.querySelector(`[data-clip-index="${clipIndex}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  const toggleSegmentExpansion = (segmentKey) => {
    setExpandedSegments(prev => ({
      ...prev,
      [segmentKey]: !prev[segmentKey]
    }));
  };

  if (!videoClips || videoClips.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full p-8 text-center ${darkMode ? 'bg-neutral-800 text-neutral-200' : 'bg-gray-50 text-gray-700'}`}>
        <div>
          <p className={`${darkMode ? 'text-neutral-400' : 'text-gray-600'}`}>{emptyMessage}</p>
          <p className={`${darkMode ? 'text-neutral-500' : 'text-gray-500'} text-xs mt-1`}>Intenta seleccionar otro día</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      flex flex-col h-full 
      ${darkMode ? 'bg-neutral-800 text-neutral-100' : 'bg-white text-gray-800'} 
      ${isMobile ? 'max-h-[85vh] overflow-hidden' : ''}
    `}>
      <TimelineHeader
        videoClipsCount={videoClips.length}
        viewMode={viewMode}
        setViewMode={setViewMode}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filters={filters}
        onFiltersChange={onFiltersChange}
        allTags={allTags}
        sourceOptions={sourceOptions}
        isMobile={isMobile}
        darkMode={darkMode}
      />

      <div className={`
        flex flex-1 overflow-hidden 
        ${isMobile ? 'flex-col h-full relative pb-4' : ''}
      `}>
        <TimelineNavigation
          hourLabels={hourLabels}
          clipsByHour={clipsByHour}
          onScrollToHour={scrollToHour}
          isMobile={isMobile}
          darkMode={darkMode}
        />

        <TimelineContent
          ref={timelineRef}
          viewMode={viewMode}
          hourLabels={hourLabels}
          clipsByHour={clipsByHour}
          videoClips={videoClips}
          currentClipIndex={currentClipIndex}
          setCurrentClipIndex={setCurrentClipIndex}
          onSelectClip={onSelectClip}
          getThumbnailUrl={getThumbnailUrl}
          expandedSegments={expandedSegments}
          toggleSegmentExpansion={toggleSegmentExpansion}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          isMobile={isMobile}
          darkMode={darkMode}
        />
      </div>

      <TimeTooltip 
        hoveredTime={hoveredTime}
        mousePosition={mousePosition}
        darkMode={darkMode}
      />
    </div>
  );
});

GooglePhotosTimeline.displayName = 'GooglePhotosTimeline';

export default GooglePhotosTimeline;
