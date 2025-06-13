import React, { forwardRef } from 'react';
import TimelineSegment from './TimelineSegment';

const TimelineContent = forwardRef(({
  viewMode,
  hourLabels,
  clipsByHour,
  videoClips,
  currentClipIndex,
  setCurrentClipIndex,
  onSelectClip,
  getThumbnailUrl,
  expandedSegments,
  toggleSegmentExpansion,
  onMouseMove,
  onMouseLeave,
  isMobile,
  darkMode = false
}, ref) => {
  return (
    <div 
      ref={ref}
      className={`
        flex-1 overflow-y-auto touch-pan-y overscroll-contain
        ${viewMode === 'grid' 
          ? isMobile 
            ? 'grid grid-cols-2 gap-2 p-2 pb-24' 
            : 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-4'
          : 'flex flex-col gap-2 p-4'
        } 
        ${isMobile ? 'h-full min-h-[60vh] max-h-[70vh] scroll-smooth' : ''}
        ${isMobile ? 'after:content-[""] after:block after:h-20 after:w-full' : ''}
      `}
    >
      {hourLabels.map(hour => (
        <React.Fragment key={`hour-group-${hour}`}>
          {/* Hour Separator */}
          <div className={`flex items-center my-5 ${darkMode ? 'text-neutral-400' : 'text-gray-600'} text-sm font-medium first:mt-0 ${
            viewMode === 'grid' ? 'col-span-full' : ''
          }`}>
            <div className={`flex-1 h-px ${darkMode ? 'bg-neutral-700' : 'bg-gray-300'}`}></div>
            <div className="px-2">{clipsByHour[hour].label}</div>
            <div className={`flex-1 h-px ${darkMode ? 'bg-neutral-700' : 'bg-gray-300'}`}></div>
          </div>
          
          {/* Hour Segments */}
          {clipsByHour[hour].orderedSegments && clipsByHour[hour].orderedSegments.map((segment) => (
            <TimelineSegment
              key={`segment-${segment.segmentKey}`}
              segment={segment}
              hour={hour}
              viewMode={viewMode}
              videoClips={videoClips}
              currentClipIndex={currentClipIndex}
              setCurrentClipIndex={setCurrentClipIndex}
              onSelectClip={onSelectClip}
              getThumbnailUrl={getThumbnailUrl}
              isExpanded={expandedSegments[segment.segmentKey]}
              onToggleExpansion={() => toggleSegmentExpansion(segment.segmentKey)}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              isMobile={isMobile}
              darkMode={darkMode}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
});

TimelineContent.displayName = 'TimelineContent';

export default TimelineContent;
