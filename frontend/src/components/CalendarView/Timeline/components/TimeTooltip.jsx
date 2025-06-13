import React from 'react';

const TimeTooltip = ({ hoveredTime, mousePosition, darkMode = false }) => {
  if (!hoveredTime) {
    return null;
  }

  return (
    <div 
      className={`fixed ${darkMode ? 'bg-neutral-900 border-neutral-600 text-neutral-100' : 'bg-gray-800 border-gray-600 text-white'} bg-opacity-90 px-3 py-2 rounded text-xs font-medium pointer-events-none z-50 whitespace-nowrap border`}
      style={{
        left: mousePosition.x + 10,
        top: mousePosition.y - 30
      }}
      role="tooltip"
      aria-live="polite"
    >
      {hoveredTime.time}
    </div>
  );
};

export default TimeTooltip;
