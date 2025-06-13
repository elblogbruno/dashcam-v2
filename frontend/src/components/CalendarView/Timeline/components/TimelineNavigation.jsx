import React from 'react';

const TimelineNavigation = ({
  hourLabels,
  clipsByHour,
  onScrollToHour,
  isMobile,
  darkMode = false
}) => {
  return (
    <div className={`${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'} border-r flex-shrink-0 overflow-y-auto ${
      isMobile ? `w-full h-auto border-r-0 border-b ${darkMode ? 'border-neutral-700' : 'border-gray-200'} p-1 sticky top-0 z-10` : 'w-[70px] p-3'
    }`}>
      <div className={`flex gap-2 ${isMobile ? 'flex-row overflow-x-auto pb-1 px-1' : 'flex-col'}`}>
        {hourLabels.map(hour => (
          <div
            key={`hour-${hour}`}
            className={`flex flex-col items-center p-2 cursor-pointer transition-all duration-200 ${darkMode ? 'hover:bg-neutral-700' : 'hover:bg-gray-100'} rounded ${
              clipsByHour[hour].isCurrent ? 'bg-blue-500 bg-opacity-20' : ''
            } ${isMobile ? 'flex-row gap-1 px-3 py-1.5 flex-shrink-0' : ''}`}
            onClick={() => onScrollToHour(hour)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onScrollToHour(hour);
              }
            }}
            aria-label={`Ir a ${clipsByHour[hour].label} - ${clipsByHour[hour].clips.length} clips`}
          >
            <div className={`rounded-full ${
              clipsByHour[hour].isCurrent 
                ? 'bg-blue-500 shadow-lg shadow-blue-500/30' 
                : darkMode ? 'bg-neutral-500' : 'bg-gray-400'
            } ${isMobile ? 'w-2 h-2 mb-0 mr-1' : 'w-2.5 h-2.5 mb-1'}`}></div>
            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium ${
              clipsByHour[hour].isCurrent ? 'text-blue-400' : darkMode ? 'text-neutral-300' : 'text-gray-600'
            }`}>
              {clipsByHour[hour].label}
            </span>
            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} ${darkMode ? 'text-neutral-500' : 'text-gray-500'} ${isMobile ? 'ml-0.5' : 'mt-0.5'}`}>
              {clipsByHour[hour].clips.length}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineNavigation;
