import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import axios from 'axios';

// Hook personalizado para detectar el tamaño de pantalla
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return windowSize;
}

// Importamos componentes del calendario
import { 
  CalendarSidebar, 
  GooglePhotosTimeline
} from '../components/CalendarView';
 
import CalendarStatusBar from '../components/CalendarView/StatusBar';

// Importamos estilos del StatusBar y calendario
import '../components/CalendarView/responsive_fixes.css';

import { VideoPlayer } from '../components/CalendarView/VideoPlayer';

function Calendar({ darkMode }) {
  const { width } = useWindowSize();
  const location = useLocation();
  const isMobile = width < 768;
  
  // Estados
  const [date, setDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDayTrips, setSelectedDayTrips] = useState([]);
  const [externalVideos, setExternalVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoClips, setVideoClips] = useState([]);
  const [timeZoneOffset, setTimeZoneOffset] = useState(0);
  const [activeCamera, setActiveCamera] = useState('exterior');
  const [secondaryVideo, setSecondaryVideo] = useState(null);
  const [selectedClip, setSelectedClip] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const [scrollPosition, setScrollPosition] = useState(0);
  
  // Estados para el StatusBar
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Referencias para componentes DOM
  const timelineRef = useRef(null);
  const initialUrlProcessed = useRef(false);
  
  // Estados para filtros
  const [filters, setFilters] = useState({
    showTrips: true,
    showExternalVideos: true,
    tags: [],
    videoSource: 'all'
  });
  const [allTags, setAllTags] = useState([]);
  const [sourceOptions, setSourceOptions] = useState(['all', 'dashcam', 'external']);

  // Cargar datos del calendario cuando cambia la fecha
  useEffect(() => {
    loadCalendarData();
  }, [date]);

  // Manejar parámetros URL para navegación directa a videos - se ejecuta solo una vez
  useEffect(() => {
    // Si ya procesamos la URL inicial, no volvemos a procesar
    if (initialUrlProcessed.current) return;

    const urlParams = new URLSearchParams(location.search);
    const urlDate = urlParams.get('date');
    const videoParam = urlParams.get('video');
    const timeParam = urlParams.get('time');
    const autoplayParam = urlParams.get('autoplay');

    // Si hay una fecha en la URL, establecerla
    if (urlDate) {
      const parsedDate = new Date(urlDate);
      if (!isNaN(parsedDate.getTime())) {
        setDate(parsedDate);
        initialUrlProcessed.current = true;
      }
    }
  }, [location.search]);

  // Procesar selección de video cuando hay clips disponibles
  useEffect(() => {
    if (!initialUrlProcessed.current) return;

    const urlParams = new URLSearchParams(location.search);
    const videoParam = urlParams.get('video');
    const timeParam = urlParams.get('time');
    const autoplayParam = urlParams.get('autoplay');
    
    // Si hay parámetros de video, procesar directamente aunque videoClips esté vacío
    if (videoParam) {
      const decodedVideoPath = decodeURIComponent(videoParam);
      console.log('Processing video from URL:', decodedVideoPath);
      
      // Si tenemos clips, intentar encontrar una coincidencia
      if (videoClips.length > 0) {
        const targetClip = videoClips.find(clip => 
          clip.road_video_file === decodedVideoPath ||
          clip.interior_video_file === decodedVideoPath ||
          clip.filename === decodedVideoPath ||
          clip.file_path === decodedVideoPath
        );

        if (targetClip) {
          console.log('Found matching clip in data:', targetClip);
          setSelectedClip(targetClip);
          
          // Determinar qué video reproducir
          let primaryVideo = null;
          if (targetClip.road_video_file === decodedVideoPath) {
            primaryVideo = targetClip.road_video_file;
            setActiveCamera('exterior');
          } else if (targetClip.interior_video_file === decodedVideoPath) {
            primaryVideo = targetClip.interior_video_file;
            setActiveCamera('interior');
          } else {
            primaryVideo = targetClip.road_video_file || targetClip.filename || targetClip.file_path;
          }

          if (primaryVideo) {
            const videoUrl = getVideoUrl(primaryVideo, targetClip);
            console.log('Setting video URL from clip:', videoUrl);
            setSelectedVideo(videoUrl);
          }
        } else {
          // Si no encontramos el clip, crear uno temporal basado en la URL
          createTemporaryClipFromUrl(decodedVideoPath, timeParam);
        }
      } else {
        // Si no hay clips, crear uno temporal basado en la URL
        createTemporaryClipFromUrl(decodedVideoPath, timeParam);
      }
      
      // Si autoplay está habilitado, iniciar reproducción
      if (autoplayParam === 'true') {
        setTimeout(() => {
          setIsPlaying(true);
        }, 1000); // Pequeño delay para asegurar que el video esté cargado
      }
    }
  }, [videoClips, initialUrlProcessed.current, location.search]);
  
  // Función para crear un clip temporal a partir de una URL
  const createTemporaryClipFromUrl = (videoPath, timeParam) => {
    console.log('Creating temporary clip from URL:', videoPath);
    
    // Extraer fecha y hora del path o del timeParam
    let timestamp = null;
    const dateTimeMatch = videoPath.match(/(\d{4}-\d{2}-\d{2})[\/\\](\d{2}-\d{2}-\d{2})/);
    
    if (dateTimeMatch) {
      const dateStr = dateTimeMatch[1]; // 2025-05-15
      const timeStr = dateTimeMatch[2].replace(/-/g, ':'); // 18:19:28
      timestamp = `${dateStr}T${timeStr}.000Z`;
    } else if (timeParam) {
      timestamp = timeParam;
    } else {
      timestamp = new Date().toISOString();
    }
    
    // Crear un clip temporal con los datos mínimos necesarios
    const tempClip = {
      id: `temp-clip-${Date.now()}`,
      road_video_file: videoPath,
      timestamp: timestamp,
      hasVideos: true,
      isTemporaryClip: true
    };
    
    console.log('Created temporary clip:', tempClip);
    setSelectedClip(tempClip);
    
    // Configurar el video para reproducirlo directamente
    const videoUrl = getVideoUrl(videoPath);
    console.log('Setting direct video URL:', videoUrl);
    setSelectedVideo(videoUrl);
  };

  // Actualizar videos cuando cambia la cámara activa o el clip seleccionado
  useEffect(() => {
    if (!selectedClip) return;
    
    let primaryVideo = null;
    let secondaryVideoSrc = null;
    
    if (activeCamera === 'exterior') {
      primaryVideo = selectedClip.road_video_file || selectedClip.filename || selectedClip.file_path;
    } else if (activeCamera === 'interior') {
      primaryVideo = selectedClip.interior_video_file;
      // Si no hay video interior, usar exterior como fallback
      if (!primaryVideo) {
        primaryVideo = selectedClip.road_video_file || selectedClip.filename || selectedClip.file_path;
      }
    } else if (activeCamera === 'both') {
      primaryVideo = selectedClip.road_video_file || selectedClip.filename || selectedClip.file_path;
      secondaryVideoSrc = selectedClip.interior_video_file;
    }
    
    // Convertir paths a URLs sólo cuando hay cambios reales en los videos
    if (primaryVideo) {
      const newVideoUrl = getVideoUrl(primaryVideo, selectedClip);
      if (selectedVideo !== newVideoUrl) {
        setSelectedVideo(newVideoUrl);
      }
    }
    
    if (secondaryVideoSrc) {
      const newSecondaryUrl = getVideoUrl(secondaryVideoSrc, selectedClip);
      if (secondaryVideo !== newSecondaryUrl) {
        setSecondaryVideo(newSecondaryUrl);
      }
    } else if (secondaryVideo) {
      setSecondaryVideo(null);
    }
  }, [activeCamera, selectedClip]);

  // Función para cargar datos del calendario
  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/trips/calendar', {
        params: {
          year: date.getFullYear(),
          month: date.getMonth() + 1
        }
      });
      
      setCalendarData(response.data || {});
      
      // Cargar datos del día seleccionado
      loadDayData(date);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para cargar datos de un día específico
  const loadDayData = async (selectedDate) => {
    // Evitamos recargar los datos si ya estamos cargando
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      console.log('Loading day data for:', dateStr);
      
      // Extraer la fecha de la URL para verificar si necesitamos cargar datos de una fecha diferente
      const urlParams = new URLSearchParams(location.search);
      const urlVideoPath = urlParams.get('video');
      const urlTimeParam = urlParams.get('time');
      
      // Si hay un video en la URL, intentar extraer su fecha del path
      let urlVideoDate = null;
      if (urlVideoPath) {
        const dateMatch = decodeURIComponent(urlVideoPath).match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          urlVideoDate = dateMatch[1];
        }
      }
      
      // Si hay una fecha de tiempo en la URL, extraerla
      let urlTimestampDate = null;
      if (urlTimeParam) {
        const parsedTime = new Date(urlTimeParam);
        if (!isNaN(parsedTime.getTime())) {
          urlTimestampDate = format(parsedTime, 'yyyy-MM-dd');
        }
      }
      
      // Usar la fecha del video o timestamp si está disponible y es diferente
      const finalDateStr = urlVideoDate || urlTimestampDate || dateStr;
      console.log('Using date for data loading:', finalDateStr);
      
      const response = await axios.get('/api/trips', {
        params: {
          date_str: finalDateStr
        }
      });
      
      console.log('Day data response:', response.data);
      
      const trips = response.data.trips || [];
      const videos = response.data.external_videos || [];
      const videoClips = response.data.video_clips || [];
      
      console.log('Parsed data:', { trips, videos, videoClips });
      
      setSelectedDayTrips(trips);
      setExternalVideos(videos);
      
      // Combinar todos los clips y videos
      const allClips = [...trips, ...videos, ...videoClips];
      console.log('All clips combined:', allClips);
      
      setVideoClips(prepareVideoClips(allClips));
      
      // Extraer tags únicos para los filtros
      const tags = new Set();
      allClips.forEach(clip => {
        if (clip.tags) {
          clip.tags.split(',').forEach(tag => tags.add(tag.trim()));
        }
      });
      setAllTags(Array.from(tags));
      
      // Marcamos que el procesamiento inicial de URL se ha completado
      if (!initialUrlProcessed.current) {
        initialUrlProcessed.current = true;
      }
      
    } catch (error) {
      console.error('Error loading day data:', error);
      setSelectedDayTrips([]);
      setExternalVideos([]);
      setVideoClips([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para preparar clips
  const prepareVideoClips = (clips) => {
    console.log('Preparing video clips:', clips);
    
    // Verificar si tenemos un video en la URL que debamos considerar
    const urlParams = new URLSearchParams(location.search);
    const urlVideoPath = urlParams.get('video');
    let decodedVideoPath = null;
    
    if (urlVideoPath) {
      decodedVideoPath = decodeURIComponent(urlVideoPath);
      console.log('URL contains video:', decodedVideoPath);
    }
    
    // Añadir un clip temporal para el video en URL si no hay clips o si no coincide con ninguno existente
    let processedClips = [...clips];
    if (decodedVideoPath && clips.length === 0) {
      // La fecha se extrae automáticamente del path del video en createTemporaryClipFromUrl
      const urlTimeParam = urlParams.get('time');
      
      // Crear el clip temporal y añadirlo a la lista
      const dateTimeMatch = decodedVideoPath.match(/(\d{4}-\d{2}-\d{2})[\/\\](\d{2}-\d{2}-\d{2})/);
      let timestamp = null;
      
      if (dateTimeMatch) {
        const dateStr = dateTimeMatch[1]; // 2025-05-15
        const timeStr = dateTimeMatch[2].replace(/-/g, ':'); // 18:19:28
        timestamp = `${dateStr}T${timeStr}.000Z`;
      } else if (urlTimeParam) {
        timestamp = urlTimeParam;
      }
      
      if (timestamp) {
        const tempClip = {
          id: `temp-clip-from-url-${Date.now()}`,
          road_video_file: decodedVideoPath,
          timestamp: timestamp,
          isTemporaryClip: true
        };
        processedClips.push(tempClip);
        console.log('Added temporary clip from URL:', tempClip);
      }
    }
    
    return processedClips.map((clip, index) => {
      console.log('Processing clip:', clip);
      
      // Si el clip ya fue procesado (como un clip temporal) mantenerlo intacto
      if (clip.isTemporaryClip) {
        clip.hasVideos = true;
        if (!clip.thumbnailUrl) {
          clip.thumbnailUrl = 'https://placehold.co/600x400?text=Video+From+URL';
        }
        return clip;
      }
      
      // Asegurar que el clip tenga un timestamp válido
      if (!clip.timestamp) {
        if (clip.start_time) {
          clip.timestamp = clip.start_time;
        } else if (clip.road_video_file) {
          // Extraer timestamp del nombre del archivo si es posible
          const matches = clip.road_video_file.match(/(\d{4}-\d{2}-\d{2})[\/\\]?[_-]?(\d{2}-\d{2}-\d{2})/);
          if (matches && matches[1]) {
            const dateStr = matches[1]; // 2025-05-15
            const timeStr = matches[2].replace(/-/g, ':'); // 18:19:28
            clip.timestamp = new Date(`${dateStr}T${timeStr}.000Z`).toISOString();
          }
        }
        
        // Si aún no hay timestamp, usar la fecha actual como fallback
        if (!clip.timestamp) {
          clip.timestamp = new Date().toISOString();
        }
      }
      
      // Asegurar que el clip tenga un ID único
      if (!clip.id) {
        clip.id = `clip-${index}-${Date.now()}`;
      }
      
      // Asignar una URL de miniatura para cada clip
      const getThumbnailForClip = (clip) => {
        console.log('Generating thumbnail for clip:', clip);
        // Determinar qué archivo de video usar para el thumbnail
        let videoFile = null;
        if (clip.road_video_file) {
          videoFile = clip.road_video_file;
        } else if (clip.interior_video_file) {
          videoFile = clip.interior_video_file;
        } else if (clip.filename || clip.file_path) {
          videoFile = clip.filename || clip.file_path;
        }
        
        if (!videoFile) return 'https://placehold.co/600x400?text=No+Preview';
        
        // Si es un video externo con ID, usar el endpoint específico para thumbnails externos
        if (clip.isExternalVideo && clip.id) {
          return `/api/videos/thumbnail/external/${clip.id}`;
        }
        
        // Limpiar y normalizar el path del video
        let normalizedPath = videoFile;
        if (normalizedPath.startsWith('./')) {
          normalizedPath = normalizedPath.substring(2);
        } else if (normalizedPath.startsWith('../')) {
          normalizedPath = normalizedPath.substring(3);
        }
        
        return `/api/videos/thumbnail/${encodeURIComponent(normalizedPath)}`;
      };
      
      clip.thumbnailUrl = getThumbnailForClip(clip);
      
      // Agregar información de GPS si está disponible
      if (clip.start_lat && clip.start_lon) {
        clip.hasGPS = true;
      }
      
      // Agregar información de video paths válidos
      if (clip.road_video_file || clip.interior_video_file || clip.file_path) {
        clip.hasVideos = true;
        // Para videos externos, asegurar que tengan el path correcto
        if (clip.file_path && !clip.road_video_file) {
          clip.road_video_file = clip.file_path;
          clip.isExternalVideo = true;
        }
      }
      
      console.log('Processed clip:', clip);
      return clip;
    }).filter(clip => clip.hasVideos); // Solo mostrar clips que tengan videos
  };

  // Función para obtener la URL correcta de un video
  const getVideoUrl = (videoPath, clip = null) => {
    if (!videoPath) return '';
    
    console.log('Getting video URL for path:', videoPath);

    // Comprobar si se trata de un video externo con ID, usar la ruta específica
    if (clip && clip.isExternalVideo && clip.id) {
      const externalUrl = `/api/videos/external/${clip.id}`;
      console.log('External video URL:', externalUrl);
      return externalUrl;
    }

    // Para videos internos o externos sin ID registrado, usamos la ruta directa
    let normalizedPath = videoPath;
    
    // Manejar rutas relativas
    if (normalizedPath.startsWith('./')) {
      normalizedPath = normalizedPath.substring(2);
    } else if (normalizedPath.startsWith('../')) {
      normalizedPath = normalizedPath.substring(3);
    }
    
    // Asegurarse de que la ruta comience con /api/videos/
    if (!normalizedPath.startsWith('/api/videos/')) {
      // Si ya tiene una barra inicial, quitarla antes de añadir el prefijo
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
      }
      normalizedPath = `/api/videos/${normalizedPath}`;
    }
    
    console.log('Normalized video URL:', normalizedPath);
    return normalizedPath;
  };

  // Función para aplicar filtros a los clips
  const getFilteredVideoClips = () => {
    let filteredClips = [...videoClips];
    
    // Aplicar filtros de tipo de contenido
    if (!filters.showTrips && !filters.showExternalVideos) {
      return []; // Si ambos están desactivados, no mostrar nada
    }
    
    if (!filters.showTrips) {
      // Filtrar clips que vienen de trips (que tienen trip_id o road_video_file)
      filteredClips = filteredClips.filter(clip => !clip.trip_id && !clip.road_video_file);
    }
    
    if (!filters.showExternalVideos) {
      // Filtrar videos externos
      filteredClips = filteredClips.filter(clip => clip.trip_id || clip.road_video_file);
    }
    
    // Aplicar filtros de fuente
    if (filters.videoSource !== 'all') {
      filteredClips = filteredClips.filter(clip => {
        const videoSource = clip.source || (clip.road_video_file ? 'dashcam' : 'external');
        return videoSource === filters.videoSource;
      });
    }
    
    // Aplicar filtros de etiquetas
    if (filters.tags.length > 0) {
      filteredClips = filteredClips.filter(clip => {
        if (!clip.tags) return false;
        const clipTags = clip.tags.split(',').map(tag => tag.trim());
        return filters.tags.some(tag => clipTags.includes(tag));
      });
    }
    
    return filteredClips;
  };

  // Función para obtener conteos
  const getTotalClipsCount = () => {
    return videoClips.length;
  };

  const getFilteredClipsCount = () => {
    return getFilteredVideoClips().length;
  };

  // Funciones para el StatusBar
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.log(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
  };

  const handleToggleCalendar = () => {
    setCalendarOpen(!calendarOpen);
  };

  const handleExportDay = async () => {
    if (!date) return;
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await fetch(`/api/export-day/${dateStr}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `dashcam_${dateStr}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Error exporting day:', response.statusText);
      }
    } catch (error) {
      console.error('Error exporting day:', error);
    }
  };

  // Función para manejar cambio de mes en el calendario
  const handleMonthChange = (newActiveDate) => {
    console.log('Month changed to:', newActiveDate);
    // Actualizar el estado de fecha si es diferente
    if (newActiveDate && newActiveDate.getTime() !== date.getTime()) {
      // Si solo cambia el mes/año pero no el día, mantener el día actual si es válido
      const currentDay = date.getDate();
      const newDate = new Date(newActiveDate);
      
      // Verificar si el día actual es válido en el nuevo mes
      const lastDayOfNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      if (currentDay <= lastDayOfNewMonth) {
        newDate.setDate(currentDay);
      }
      
      setDate(newDate);
      // loadDayData se ejecutará automáticamente por el useEffect cuando cambie date
    }
  };

  // Renderizado del componente
  return (
    <div className={`h-screen min-h-screen w-full flex flex-col overflow-hidden ${darkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-white text-neutral-800'} transition-colors duration-300`}>
      {/* StatusBar del calendario - fijo en la parte superior */}
      <CalendarStatusBar
        selectedDate={date}
        selectedClip={selectedClip}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        activeCamera={activeCamera}
        onCameraChange={setActiveCamera}
        darkMode={darkMode}
        totalClipsCount={getTotalClipsCount()}
        filteredClipsCount={getFilteredClipsCount()}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        onToggleCalendar={handleToggleCalendar}
        isCalendarOpen={calendarOpen}
        onExportDay={handleExportDay}
      />
      
      {/* Contenido principal - ocupa el resto del espacio */}
      <div className={`flex-1 overflow-hidden flex h-full min-h-[calc(100vh-64px)] ${darkMode ? 'bg-neutral-900' : 'bg-white'}`}>
        {/* Sidebar del calendario - mejorado para móvil y desktop */}
        {isMobile ? (
          <div className={`fixed inset-0 z-[9999] transition-all duration-300 ease-in-out ${calendarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop con blur */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCalendarOpen(false)} />
            
            {/* Contenedor del calendario */}
            <div className={`absolute top-0 right-0 h-full w-full max-w-sm transform transition-all duration-300 ease-out ${calendarOpen ? 'translate-x-0' : 'translate-x-full'} ${darkMode ? 'bg-neutral-800 text-neutral-100 shadow-black/50' : 'bg-white shadow-xl'}`}>
              {/* Contenido scrolleable sin header duplicado */}
              <div className="h-full overflow-y-auto">
                <CalendarSidebar
                  date={date}
                  setDate={setDate}
                  calendarData={calendarData}
                  timeZoneOffset={timeZoneOffset}
                  setTimeZoneOffset={setTimeZoneOffset}
                  isMobileOpen={calendarOpen}
                  onMobileClose={() => setCalendarOpen(false)}
                  onMonthChange={handleMonthChange}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className={`transition-all duration-500 ease-in-out ${calendarOpen ? 'w-80' : 'w-0'} flex-shrink-0 overflow-hidden ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} border-r`}>
            <div className="h-full overflow-y-auto">
              <CalendarSidebar
                date={date}
                setDate={setDate}
                calendarData={calendarData}
                timeZoneOffset={timeZoneOffset}
                setTimeZoneOffset={setTimeZoneOffset}
                isMobileOpen={calendarOpen}
                onMobileClose={() => setCalendarOpen(false)}
                darkMode={darkMode}
                onMonthChange={handleMonthChange}
              />
            </div>
          </div>
        )}

        {/* Área principal de contenido */}
        <div className="flex-1 flex flex-col overflow-hidden h-full min-h-[calc(100vh-80px)]">
          {/* Información del día */}
          <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center space-x-2 flex-wrap">
              <span className={`font-semibold ${darkMode ? 'text-neutral-100' : 'text-gray-800'} ${isMobile ? 'text-base' : 'text-lg'}`}>
                {format(date, 'dd MMMM yyyy')}
              </span>
              <span className={`${darkMode ? 'text-neutral-400' : 'text-gray-500'} ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {getFilteredClipsCount()} de {getTotalClipsCount()} clips disponibles
              </span>
            </div>
          </div>

          {/* Área de contenido principal */}
          <div className={`flex-1 ${isMobile ? 'flex flex-col gap-0' : 'flex'} overflow-hidden h-full w-full`}>
            {/* Área del reproductor de video - a la izquierda en desktop, arriba en móvil */}
            <div className={`${isMobile ? 'w-full h-auto flex-shrink-0 aspect-video mb-0 pb-0' : 'flex-1'} flex flex-col overflow-hidden ${darkMode ? 'bg-neutral-900' : 'bg-white'}`}>
              {selectedVideo ? (
                <>
                  <VideoPlayer
                    videoSrc={selectedVideo}
                    secondaryVideoSrc={secondaryVideo}
                    clipMetadata={selectedClip}
                    isFullPlayer={false}
                    isPictureInPicture={activeCamera === 'both'}
                    darkMode={darkMode}
                    autoPlay={true}
                    onLoadStart={() => setIsLoading(true)}
                    onLoadComplete={() => setIsLoading(false)}
                    onTimeUpdate={(time) => setCurrentTime(time)}
                    onDurationChange={(duration) => setDuration(duration)}
                    onPlayStateChange={(playing) => setIsPlaying(playing)}
                    relatedClips={getFilteredVideoClips()}
                    onSelectClip={(clip) => {
                      setSelectedClip(clip);
                      
                      // Determinar qué video mostrar basado en la cámara activa
                      let primaryVideo = null;
                      let secondaryVideoSrc = null;
                      
                      if (activeCamera === 'exterior') {
                        primaryVideo = clip.road_video_file || clip.filename || clip.file_path;
                      } else if (activeCamera === 'interior') {
                        primaryVideo = clip.interior_video_file;
                        // Si no hay video interior, usar exterior como fallback
                        if (!primaryVideo) {
                          primaryVideo = clip.road_video_file || clip.filename || clip.file_path;
                        }
                      } else if (activeCamera === 'both') {
                        primaryVideo = clip.road_video_file || clip.filename || clip.file_path;
                        secondaryVideoSrc = clip.interior_video_file;
                      }
                      
                      // Convertir paths a URLs
                      if (primaryVideo) {
                        setSelectedVideo(getVideoUrl(primaryVideo, clip));
                      }
                      if (secondaryVideoSrc) {
                        setSecondaryVideo(getVideoUrl(secondaryVideoSrc, clip));
                      } else {
                        setSecondaryVideo(null);
                      }
                    }}
                    getClipThumbnail={(clip) => {
                      // Determinar qué archivo de video usar para el thumbnail
                      let videoFile = null;
                      if (clip.road_video_file) {
                        videoFile = clip.road_video_file;
                      } else if (clip.interior_video_file) {
                        videoFile = clip.interior_video_file;
                      } else if (clip.filename || clip.file_path) {
                        videoFile = clip.filename || clip.file_path;
                      }
                      
                      // Si es un video externo con ID, usar el endpoint específico para thumbnails externos
                      if (clip.isExternalVideo && clip.id) {
                        return `/api/videos/thumbnail/external/${clip.id}`;
                      }
                      
                      // Para videos normales, usar el endpoint general de thumbnails
                      if (!videoFile) return 'https://placehold.co/600x400?text=No+Preview';
                      
                      // Limpiar y normalizar el path del video
                      let normalizedPath = videoFile;
                      if (normalizedPath.startsWith('./')) {
                        normalizedPath = normalizedPath.substring(2);
                      } else if (normalizedPath.startsWith('../')) {
                        normalizedPath = normalizedPath.substring(3);
                      }
                      
                      return `/api/videos/thumbnail/${encodeURIComponent(normalizedPath)}`;
                    }}
                    getVideoUrl={getVideoUrl}
                  />
                </>
              ) : (
                <div className={`flex-1 flex items-center justify-center ${darkMode ? 'bg-neutral-800' : 'bg-gray-50'}`}>
                  <div className="text-center">
                    <div className="text-6xl mb-4">📹</div>
                    <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                      Selecciona un video
                    </h3>
                    <p className={`${darkMode ? 'text-neutral-400' : 'text-gray-500'}`}>
                      Elige un video del timeline para reproducirlo
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline vertical - a la derecha en desktop, abajo en móvil */}
            <div className={`${isMobile ? 'w-full h-auto flex-shrink-0 overflow-y-auto' : 'w-96'} ${isMobile ? 'border-t' : 'border-l'} ${darkMode ? 'border-neutral-700 bg-neutral-800' : 'border-gray-200 bg-gray-50'}`}>
              <GooglePhotosTimeline
                ref={timelineRef}
                videoClips={getFilteredVideoClips()}
                isMobile={isMobile}
                darkMode={darkMode}
                onSelectClip={(clip) => {
                  // Función mejorada para seleccionar clips y determinar videos
                  console.log('Clip seleccionado:', clip);
                  setSelectedClip(clip);
                  
                  // Determinar qué video mostrar basado en la cámara activa
                  let primaryVideo = null;
                  let secondaryVideoSrc = null;
                  
                  if (activeCamera === 'exterior') {
                    primaryVideo = clip.road_video_file || clip.filename || clip.file_path;
                  } else if (activeCamera === 'interior') {
                    primaryVideo = clip.interior_video_file;
                    // Si no hay video interior, usar exterior como fallback
                    if (!primaryVideo) {
                      primaryVideo = clip.road_video_file || clip.filename || clip.file_path;
                    }
                  } else if (activeCamera === 'both') {
                    primaryVideo = clip.road_video_file || clip.filename || clip.file_path;
                    secondaryVideoSrc = clip.interior_video_file;
                  }
                  
                  // Convertir paths a URLs
                  if (primaryVideo) {
                    setSelectedVideo(getVideoUrl(primaryVideo, clip));
                  }
                  if (secondaryVideoSrc) {
                    setSecondaryVideo(getVideoUrl(secondaryVideoSrc, clip));
                  } else {
                    setSecondaryVideo(null);
                  }
                  
                  console.log('Videos seleccionados:', { primaryVideo, secondaryVideoSrc });
                }}
                getThumbnailUrl={(clip) => {
                  // Función mejorada para generar URL de thumbnail
                  if (!clip) return 'https://placehold.co/600x400?text=No+Preview';
                  
                  // Determinar qué archivo de video usar para el thumbnail
                  let videoFile = null;
                  if (activeCamera === 'exterior' && clip.road_video_file) {
                    videoFile = clip.road_video_file;
                  } else if (activeCamera === 'interior' && clip.interior_video_file) {
                    videoFile = clip.interior_video_file;
                  } else if (clip.road_video_file) {
                    videoFile = clip.road_video_file; // Default a exterior
                  } else if (clip.interior_video_file) {
                    videoFile = clip.interior_video_file;
                  } else if (clip.filename || clip.file_path) {
                    videoFile = clip.filename || clip.file_path; // Para videos externos
                  }
                  
                  if (!videoFile) return 'https://placehold.co/600x400?text=No+Preview';
                  
                  // Si es un video externo con ID, usar el endpoint específico para thumbnails externos
                  if (clip.isExternalVideo && clip.id) {
                    return `/api/videos/thumbnail/external/${clip.id}`;
                  }
                  
                  // Para videos normales, limpiar y normalizar el path del video
                  let normalizedPath = videoFile;
                  if (normalizedPath.startsWith('./')) {
                    normalizedPath = normalizedPath.substring(2);
                  } else if (normalizedPath.startsWith('../')) {
                    normalizedPath = normalizedPath.substring(3);
                  }
                  
                  // Generar URL del thumbnail usando el endpoint del backend
                  return `/api/videos/thumbnail/${encodeURIComponent(normalizedPath)}`;
                }}
                emptyMessage="No hay videos para mostrar con los filtros actuales"
                filters={filters}
                onFiltersChange={setFilters}
                allTags={allTags}
                sourceOptions={sourceOptions}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Calendar;
