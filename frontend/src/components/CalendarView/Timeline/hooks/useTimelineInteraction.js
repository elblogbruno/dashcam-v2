import { useState } from 'react';
import { format } from 'date-fns';

export const useTimelineInteraction = () => {
  const [hoveredTime, setHoveredTime] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e, clip, index) => {
    // Validar que el evento sea válido
    if (!e || !e.currentTarget) {
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({ x: e.clientX, y: e.clientY });
    
    if (clip.timestamp && !isNaN(new Date(clip.timestamp))) {
      setHoveredTime({
        time: format(new Date(clip.timestamp), 'MMM dd, h:mm a'),
        index: index
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredTime(null);
  };

  return {
    hoveredTime,
    mousePosition,
    handleMouseMove,
    handleMouseLeave
  };
};
