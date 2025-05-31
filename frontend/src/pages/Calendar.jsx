import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { FaCalendarDay, FaVideo, FaFileDownload, FaMapMarkerAlt, FaCarSide, FaMobileAlt, FaClock, FaRoad, FaFilter, FaTags, FaCalendarAlt, FaPlayCircle } from 'react-icons/fa';
import 'react-calendar/dist/Calendar.css';

// Importamos componentes
import { 
  CalendarSidebar,
  VideoPlayer,
  VideoTimeline, 
  CameraSelector,
  SelectedClipInfo,
  VideoFilters,
  AutoplayNestTimeline
} from '../components/CalendarView';

// Importamos el gestor de reproducción automática
import { AutoplayTimelineManager } from '../components/CalendarView/AutoplayTimeline';

// Importamos estilos consolidados para el calendario
import '../components/CalendarView/calendar_core.css';
import '../components/CalendarView/video_player.css';
import '../components/CalendarView/responsive_fixes.css';

function CalendarView() {
  // Estados
  const [date, setDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDayTrips, setSelectedDayTrips] = useState([]);
  const [externalVideos, setExternalVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoClips, setVideoClips] = useState([]);
  const [timeZoneOffset, setTimeZoneOffset] = useState(0);
  const [activeCamera, setActiveCamera] = useState('exterior'); // exterior, interior, both
  const [secondaryVideo, setSecondaryVideo] = useState(null);
  const [selectedClip, setSelectedClip] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Estado para el autoplay
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  // Referencias para componentes DOM
  const timelineRef = useRef(null);
  const autoplayManagerRef = useRef(null);
  
  // Nuevos estados para filtros
  const [filters, setFilters] = useState({
    showTrips: true,
    showExternalVideos: true,
    tags: [],
    videoSource: 'all' // 'all', 'dashcam', 'external', 'insta360', 'gopro', etc.
  });
  const [allTags, setAllTags] = useState([]);
  const [sourceOptions, setSourceOptions] = useState(['all', 'dashcam', 'external']);

  // Función para preparar clips y asegurar que tienen los campos necesarios
  const prepareVideoClips = (clips) => {
    return clips.map(clip => {
      // Asegurarse que el clip tenga un timestamp válido
      if (!clip.timestamp) {
        // Si no tiene timestamp, intentamos extraerlo del nombre del archivo
        if (clip.road_video_file) {
          const matches = clip.road_video_file.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
          if (matches && matches[1]) {
            const dateStr = matches[1].replace(/_/g, ' ').replace(/-/g, ':');
            clip.timestamp = new Date(`${dateStr}`).toISOString();
          }
        }
        // Si aún no tiene timestamp, usamos la fecha actual
        if (!clip.timestamp) {
          clip.timestamp = new Date().toISOString();
        }
      }
      return clip;
    });
  };

  // Función para obtener la URL correcta de un video
  const getVideoUrl = (videoPath) => {
    if (!videoPath) return '';
    
    // Eliminar prefijos relativos de la ruta si existen
    let normalizedPath = videoPath;
    if (normalizedPath.startsWith('../')) {
      normalizedPath = normalizedPath.substring(3);
    }
    
    // Para videos externos usar la API
    if (normalizedPath.startsWith('external/')) {
      return `/api/videos/${normalizedPath}`; 
    }
    
    // Para videos locales usar la API adecuada
    return `/api/videos/${normalizedPath}`;
  };
  
  // Función para obtener la URL de miniatura
  const getThumbnailUrl = (videoPath) => {
    if (!videoPath) return '';
    
    // Eliminar prefijos relativos de la ruta si existen
    let normalizedPath = videoPath;
    if (normalizedPath.startsWith('../')) {
      normalizedPath = normalizedPath.substring(3);
    }
    
    // Para videos externos
    if (normalizedPath.startsWith('external/')) {
      return `/api/videos/thumbnail/${normalizedPath}`;
    }
    
    // Para videos locales
    return `/api/videos/thumbnail/${normalizedPath}`;
  };
  
  // Función para reproducir un video con la URL correcta
  const playVideo = (videoPath) => {
    setSelectedVideo(getVideoUrl(videoPath));
    // Limpiar video secundario al reproducir uno nuevo
    setSecondaryVideo(null);
  };

  // Añadir clase al body para estilos específicos de calendario
  useEffect(() => {
    // Añadir la clase 'calendar-page' al body cuando se monte el componente
    document.body.classList.add('calendar-page');
    
    // Eliminar la clase cuando se desmonte el componente
    return () => {
      document.body.classList.remove('calendar-page');
    };
  }, []);

  // Fetch calendar data on mount
  useEffect(() => {
    fetchCalendarData(date.getFullYear(), date.getMonth() + 1);
  }, []);

  // Fetch trips when date changes
  useEffect(() => {
    fetchTripsForDate(format(date, 'yyyy-MM-dd'));
    setCalendarOpen(false); // Cerrar el calendario después de cambiar la fecha
  }, [date]);

  // Extraer todas las etiquetas y fuentes de videos cuando se cargan
  useEffect(() => {
    if (externalVideos.length > 0) {
      // Extraer todas las etiquetas únicas de los videos externos
      const tagSet = new Set();
      const sourceSet = new Set(['all', 'dashcam', 'external']);
      
      externalVideos.forEach(video => {
        // Procesar etiquetas
        if (video.tags) {
          const videoTags = video.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
          videoTags.forEach(tag => tagSet.add(tag));
        }
        
        // Procesar fuentes de video
        if (video.source && !sourceSet.has(video.source)) {
          sourceSet.add(video.source);
        }
      });
      
      setAllTags(Array.from(tagSet));
      setSourceOptions(Array.from(sourceSet));
    }
  }, [externalVideos]);

  // Function to fetch calendar data for a month
  const fetchCalendarData = async (year, month) => {
    try {
      const response = await axios.get(`/api/trips/calendar?year=${year}&month=${month}`);
      setCalendarData(response.data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    }
  };

  // Function to fetch trips for a specific date
  const fetchTripsForDate = async (dateStr) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/trips?date_str=${dateStr}`);
      console.log("API Response:", response.data);  // Depuración: Ver la respuesta completa
      setSelectedDayTrips(response.data.trips || []);
      setExternalVideos(response.data.external_videos || []);
      
      // Imprimir videos externos para depuración
      console.log("Videos externos:", response.data.external_videos);
      
      // Preparar y luego establecer clips de video
      const preparedClips = prepareVideoClips(response.data.video_clips || []);
      setVideoClips(preparedClips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      setSelectedDayTrips([]);
      setExternalVideos([]);
      setVideoClips([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to generate summary video
  const generateSummary = async (dateStr) => {
    try {
      setIsLoading(true);
      await axios.post(`/api/video/generate-summary?day=${dateStr}`);
      alert('Started generating summary video. This may take a few minutes.');
      // Refresh trips after a delay to show the new summary
      setTimeout(() => {
        fetchTripsForDate(dateStr);
      }, 3000);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Error generating summary video. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar la selección de clips desde la línea de tiempo
  const handleSelectClip = (clip, cameraType = 'exterior') => {
    setSelectedClip(clip);
    
    // Determinar qué video reproducir basado en el tipo de cámara seleccionada
    if (activeCamera === 'exterior' || (activeCamera === 'both' && cameraType === 'exterior')) {
      if (clip.road_video_file) {
        setSelectedVideo(getVideoUrl(clip.road_video_file));
        
        if (activeCamera === 'both' && clip.interior_video_file) {
          setSecondaryVideo(getVideoUrl(clip.interior_video_file));
        } else {
          setSecondaryVideo(null);
        }
      }
    } else if (activeCamera === 'interior' || (activeCamera === 'both' && cameraType === 'interior')) {
      if (clip.interior_video_file) {
        setSelectedVideo(getVideoUrl(clip.interior_video_file));
        
        if (activeCamera === 'both' && clip.road_video_file) {
          setSecondaryVideo(getVideoUrl(clip.road_video_file));
        } else {
          setSecondaryVideo(null);
        }
      }
    }
  };

  // Manejar cambios en la selección de cámara
  const handleCameraChange = (camera) => {
    setActiveCamera(camera);
    
    // Si hay un clip seleccionado, actualizar la vista según la cámara seleccionada
    if (selectedClip) {
      if (camera === 'exterior' && selectedClip.road_video_file) {
        setSelectedVideo(getVideoUrl(selectedClip.road_video_file));
        setSecondaryVideo(null);
      } else if (camera === 'interior' && selectedClip.interior_video_file) {
        setSelectedVideo(getVideoUrl(selectedClip.interior_video_file));
        setSecondaryVideo(null);
      } else if (camera === 'both') {
        // Configurar PiP
        if (selectedClip.road_video_file) {
          setSelectedVideo(getVideoUrl(selectedClip.road_video_file));
          if (selectedClip.interior_video_file) {
            setSecondaryVideo(getVideoUrl(selectedClip.interior_video_file));
          }
        } else if (selectedClip.interior_video_file) {
          setSelectedVideo(getVideoUrl(selectedClip.interior_video_file));
          setSecondaryVideo(null);
        }
      }
    }
  };

  // Cerrar el reproductor de video
  const handleClosePlayer = () => {
    setSelectedVideo(null);
    setSecondaryVideo(null);
  };
  
  // Manejar cambios en los filtros
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  // Función para filtrar videos según los filtros aplicados
  const getFilteredVideos = () => {
    // Primero aplicamos el filtro de tipo de video
    let filteredExternalVideos = [...externalVideos];
    
    // Filtrar por fuente
    if (filters.videoSource !== 'all') {
      filteredExternalVideos = filteredExternalVideos.filter(
        video => video.source === filters.videoSource
      );
    }
    
    // Filtrar por etiquetas si hay etiquetas seleccionadas
    if (filters.tags.length > 0) {
      filteredExternalVideos = filteredExternalVideos.filter(video => {
        if (!video.tags) return false;
        
        const videoTags = video.tags.split(',').map(tag => tag.trim());
        // Debe contener al menos una de las etiquetas seleccionadas
        return filters.tags.some(tag => videoTags.includes(tag));
      });
    }
    
    return filteredExternalVideos;
  };

  // Videos filtrados
  const filteredExternalVideos = getFilteredVideos();

  // Manejar el cierre del calendario en móvil al hacer clic en el backdrop
  const handleBackdropClick = (e) => {
    // Solo cerrar si se hace clic en el fondo, no en el calendario
    if (e.target === e.currentTarget) {
      setCalendarOpen(false);
    }
  };

  // Renderizado del componente
  return (
    <div className="nest-layout-container">
      {/* Panel principal con el reproductor de video */}
      <div className="nest-video-panel">
        {/* Video Player ocupando espacio principal */}
        <div className="nest-video-container w-full h-full">
          <VideoPlayer 
            videoSrc={selectedVideo}
            secondaryVideoSrc={secondaryVideo}
            isPictureInPicture={activeCamera === 'both' && secondaryVideo !== null}
            onClose={handleClosePlayer}
            isFullPlayer={true}
            autoPlay={isAutoplayEnabled}
          />
        </div>
        
        {/* Información del clip seleccionado */}
        {selectedClip && (
          <SelectedClipInfo 
            selectedClip={selectedClip}
            getVideoUrl={getVideoUrl}
            onClose={() => setSelectedClip(null)}
          />
        )}
        
        {/* Selector de cámara con estilo Nest */}
        <div className="px-4 py-3">
          <CameraSelector 
            selectedCamera={activeCamera} 
            onCameraChange={handleCameraChange} 
          />
        </div>
      </div>
      
      {/* Panel de cabecera que contiene la fecha y los selectores */}
      <div className="nest-header-panel">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-nest-text-primary">{format(date, 'EEEE, d MMMM')}</h2>
            <div className="text-sm text-nest-text-secondary">{videoClips.length + externalVideos.length} eventos</div>
          </div>
          
          <button 
            onClick={() => setCalendarOpen(true)} 
            className="bg-transparent border-none flex items-center gap-1">
            <span className="text-nest-text-secondary">Cambiar día</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
        
        {/* Sidebar con calendario - ahora flota sobre el contenido */}
        {calendarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center md:justify-end p-4" 
               onClick={handleBackdropClick}>
            <CalendarSidebar 
              date={date}
              setDate={setDate}
              calendarData={calendarData}
              timeZoneOffset={timeZoneOffset}
              setTimeZoneOffset={setTimeZoneOffset}
              isMobileOpen={calendarOpen}
              onMobileClose={() => setCalendarOpen(false)}
            />
          </div>
        )}
      </div>
      
      {/* Panel lateral con línea de tiempo vertical y eventos */}
      <div className="nest-timeline-panel">
        <div className="p-3 border-b border-nest-border flex justify-between items-center">
          <div className="flex items-center">
            <FaClock className="text-nest-accent mr-2" />
            <span className="text-nest-text-primary font-medium">Eventos</span>
          </div>
          <div className="flex gap-2">
            {externalVideos.length > 0 && (
              <div className="bg-nest-selected text-white text-xs py-1 px-2 rounded-full flex items-center whitespace-nowrap">
                <FaMobileAlt className="mr-1" />
                <span>{externalVideos.length}</span>
              </div>
            )}
            {(selectedDayTrips.length > 0) && (
              <button 
                className="px-3 py-1 bg-nest-accent bg-opacity-90 hover:bg-opacity-100 text-white rounded-full transition-all duration-200 flex items-center text-xs"
                onClick={() => generateSummary(format(date, 'yyyy-MM-dd'))}
                disabled={isLoading}
              >
                {isLoading ? "Procesando..." : "Resumen"}
              </button>
            )}
          </div>
        </div>
        
        {/* Filtros de video */}
        {(externalVideos.length > 0 || selectedDayTrips.length > 0) && (
          <div className="p-3 border-b border-nest-border">
            <VideoFilters 
              filters={filters}
              onFilterChange={handleFilterChange}
              allTags={allTags}
              sourceOptions={sourceOptions}
            />
          </div>
        )}
        
        {isLoading ? (
          <div className="nest-loading">
            <div className="nest-spinner"></div>
            <div>Cargando eventos...</div>
          </div>
        ) : (
          <>
            {videoClips.length === 0 && 
             (!filters.showTrips || selectedDayTrips.length === 0) && 
             (!filters.showExternalVideos || filteredExternalVideos.length === 0) ? (
              <div className="nest-empty-view">
                <FaVideo />
                <div className="text-center">
                  <p className="text-gray-500">No hay grabaciones para esta fecha {filters.tags.length > 0 || filters.videoSource !== 'all' ? 'con estos filtros' : ''}</p>
                  <p className="text-gray-400 text-xs mt-1">Intenta seleccionar otro día o modificar los filtros</p>
                </div>
              </div>
            ) : (
              <div className="nest-timeline-content">
                {/* Implementación del timeline vertical con autoplay al estilo Nest */}
                {filters.showTrips && videoClips.length > 0 && (
                  <AutoplayNestTimeline
                    videoClips={videoClips}
                    onSelectClip={handleSelectClip}
                    getThumbnailUrl={getThumbnailUrl}
                    autoplayEnabled={isAutoplayEnabled}
                    emptyMessage="No hay grabaciones de video para esta fecha"
                  />
                )}
                
                {/* Trip recordings */}
                {filters.showTrips && selectedDayTrips.length > 0 && (
                  <div className="nest-section">
                    <h3 className="nest-section-title">
                      <FaCarSide className="nest-section-icon" />
                      Viajes ({selectedDayTrips.length})
                    </h3>
                    <div className="nest-trips-grid">
                      {selectedDayTrips.map((trip) => (
                        <div key={trip.id} className="nest-trip-card">
                          <div className="nest-trip-header">
                            <div className="nest-trip-time">
                              <FaClock className="nest-trip-icon" />
                              {format(new Date(trip.start_time), 'h:mm a')}
                              {trip.end_time && ` - ${format(new Date(trip.end_time), 'h:mm a')}`}
                            </div>
                            {trip.distance_km && (
                              <div className="nest-trip-distance">
                                <FaRoad className="nest-trip-icon-sm" />
                                {trip.distance_km !== undefined ? trip.distance_km.toFixed(1) : '0.0'} km
                              </div>
                            )}
                          </div>
                                  
                                                            <div className="nest-trip-actions">
                            <div>
                              {trip.landmarks && trip.landmarks.length > 0 && (
                                <div className="nest-trip-landmarks">
                                  <FaMapMarkerAlt className="nest-landmark-icon" />
                                  {trip.landmarks.length}
                                </div>
                              )}
                            </div>
                            <div className="nest-trip-buttons">
                              {(trip.video_files && Array.isArray(trip.video_files) && trip.video_files.length > 0) ? (
                                <button 
                                  className="nest-button nest-button-video"
                                  onClick={() => playVideo(trip.video_files[0])}
                                >
                                  <FaVideo className="nest-button-icon" /> Video
                                </button>
                              ) : (
                                <span className="nest-no-video">No hay videos</span>
                              )}
                              {trip.summary_file && (
                                <button 
                                  className="nest-button nest-button-summary"
                                  onClick={() => playVideo(trip.summary_file)}
                                >
                                  <FaFileDownload className="nest-button-icon" /> Resumen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Videos externos con estilo Nest */}
                {filters.showExternalVideos && filteredExternalVideos.length > 0 && (
                  <div className="nest-section">
                    <h3 className="nest-section-title nest-section-title-external">
                      <FaMobileAlt className="nest-section-icon" />
                      Videos Externos ({filteredExternalVideos.length})
                    </h3>
                    <div className="nest-external-video-grid">
                      {filteredExternalVideos.map((video) => (
                        <div key={video.id} className="nest-external-video-card">
                          <div className="nest-external-video-thumbnail">
                            <img 
                              src={getThumbnailUrl(video.file_path)}
                              alt="Vista previa"
                              className="nest-external-thumbnail-image"
                              onError={(e) => {e.target.src = 'https://placehold.co/600x400'; e.target.onerror = null;}}
                            />
                            <div className="nest-external-play-overlay" onClick={() => playVideo(`external/${video.id}`)}>
                              <FaPlayCircle className="nest-external-play-icon" />
                            </div>
                            <div className="nest-external-source-badge">
                              <FaMobileAlt className="nest-external-source-icon" />
                              <span>{video.source || 'Externo'}</span>
                            </div>
                          </div>
                          
                          <div className="nest-external-video-content">
                            <div className="nest-external-video-header">
                              <h4 className="nest-external-video-title">
                                {video.original_filename || `Video-${video.id}`}
                              </h4>
                              {video.upload_time && (
                                <div className="nest-external-video-time">
                                  <FaClock className="nest-external-time-icon" />
                                  {format(new Date(video.upload_time), 'h:mm a')}
                                </div>
                              )}
                            </div>
                            
                            {/* Etiquetas mejoradas */}
                            {video.tags && (
                              <div className="nest-external-tags-section">
                                <div className="nest-external-tags-wrapper">
                                  {video.tags.split(',').slice(0, 3).map((tag, idx) => (
                                    <span key={idx} className="nest-external-tag">
                                      {tag.trim()}
                                    </span>
                                  ))}
                                  {video.tags.split(',').length > 3 && (
                                    <span className="nest-external-tag-more">
                                      +{video.tags.split(',').length - 3} más
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="nest-external-video-footer">
                              <div className="nest-external-video-meta">
                                {video.lat && video.lon && (
                                  <div className="nest-external-location-badge">
                                    <FaMapMarkerAlt className="nest-external-location-icon" />
                                    <span>Ubicación GPS</span>
                                  </div>
                                )}
                              </div>
                              
                              <button 
                                className="nest-external-play-button"
                                onClick={() => playVideo(`external/${video.id}`)}
                              >
                                <FaPlayCircle className="nest-external-play-button-icon" /> 
                                <span>Reproducir</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CalendarView;