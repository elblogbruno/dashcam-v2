import { useMemo } from 'react';
import { format } from 'date-fns';

export const useTimelineData = (videoClips) => {
  const clipsByHour = useMemo(() => {
    if (!videoClips || videoClips.length === 0) {
      return {};
    }
    
    const hourMap = {};
    const currentHour = new Date().getHours();
    
    videoClips.forEach(clip => {
      if (clip.timestamp && !isNaN(new Date(clip.timestamp))) {
        const date = new Date(clip.timestamp);
        const hour = date.getHours();
        const minutes = date.getMinutes();
        const segment = Math.floor(minutes / 10) * 10;
        const segmentKey = `${hour}_${segment}`;
        const timeString = format(date, 'h:mm a');
        
        const hourKey = hour;
        const hourFormatted = hour === 0 ? '12 AM' :
                             hour < 12 ? `${hour} AM` :
                             hour === 12 ? '12 PM' :
                             `${hour - 12} PM`;
        
        if (!hourMap[hourKey]) {
          hourMap[hourKey] = {
            clips: [],
            segments: {},
            label: hourFormatted,
            isCurrent: hour === currentHour,
            hourInt: hour
          };
        }
        
        const clipWithMeta = {
          ...clip,
          hourDisplay: hourFormatted,
          timeString: timeString,
          minutes: minutes,
          segment: segment,
          segmentKey: segmentKey
        };
        
        hourMap[hourKey].clips.push(clipWithMeta);
        
        if (!hourMap[hourKey].segments[segment]) {
          hourMap[hourKey].segments[segment] = {
            clips: [],
            label: `${segment} - ${segment + 9} min`,
            start: segment,
            end: segment + 9,
            segmentKey: segmentKey
          };
        }
        hourMap[hourKey].segments[segment].clips.push(clipWithMeta);
      }
    });
    
    // Ordenar clips y segmentos
    Object.keys(hourMap).forEach(hour => {
      hourMap[hour].clips.sort((a, b) => {
        if (a.minutes !== undefined && b.minutes !== undefined) {
          return a.minutes - b.minutes;
        }
        return 0;
      });
      
      Object.keys(hourMap[hour].segments).forEach(segment => {
        hourMap[hour].segments[segment].clips.sort((a, b) => {
          if (a.minutes !== undefined && b.minutes !== undefined) {
            return a.minutes - b.minutes;
          }
          return 0;
        });
      });
      
      hourMap[hour].orderedSegments = Object.values(hourMap[hour].segments)
        .sort((a, b) => a.start - b.start);
    });
    
    return hourMap;
  }, [videoClips]);
  
  const hourLabels = useMemo(() => {
    return Object.keys(clipsByHour)
      .map(hour => parseInt(hour))
      .sort((a, b) => a - b);
  }, [clipsByHour]);

  return { clipsByHour, hourLabels };
};
