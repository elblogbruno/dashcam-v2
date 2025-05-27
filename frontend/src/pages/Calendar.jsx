import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { FaCalendarDay, FaVideo, FaFileDownload, FaMapMarkerAlt, FaCarSide, FaMobileAlt, FaClock, FaRoad, FaFilter, FaTags, FaCalendarAlt } from 'react-icons/fa';
import 'react-calendar/dist/Calendar.css';

// Importamos componentes
import { 
  CalendarSidebar,
  VideoPlayer,
  VideoTimeline, 
  CameraSelector,
  SelectedClipInfo,
  VideoFilters
} from '../components/CalendarView';

// Importamos CSS
import '../components/CalendarView/Calendar.css';

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
  
  // Nuevos estados para filtros
  const [filters, setFilters] = useState({
    showTrips: true,
    showExternalVideos: true,
    tags: [],
    videoSource: 'all' // 'all', 'dashcam', 'external', 'insta360', 'gopro', etc.
  });
  const [allTags, setAllTags] = useState([]);
  const [sourceOptions, setSourceOptions] = useState(['all', 'dashcam', 'external']);

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
      return `/api/videos/thumbnail/${normalizedPath.replace('external/', '')}`;
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
      
      // Manejar los clips de video
      setVideoClips(response.data.video_clips || []);
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

  return (
    <div className="bg-gray-50 min-h-screen overflow-hidden pb-20">
      <div className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
        <h1 className="text-xl font-medium text-dashcam-800 flex items-center">
          <FaCalendarDay className="mr-2" /> 
          <span className="hidden sm:inline">Calendario de Grabaciones</span>
          <span className="sm:hidden">Calendario</span>
        </h1>
        
        {/* Botón para mostrar calendario en móvil */}
        <button 
          onClick={() => setCalendarOpen(true)}
          className="md:hidden bg-dashcam-100 hover:bg-dashcam-200 text-dashcam-800 px-3 py-2 rounded-lg flex items-center focus:outline-none focus:ring-2 focus:ring-dashcam-500 focus:ring-offset-2"
        >
          <FaCalendarAlt className="mr-1" /> 
          <span className="text-sm">{format(date, 'dd/MM/yyyy')}</span>
        </button>
      </div>
      
      <div className="calendar-view">
        {/* Sidebar con calendario - ahora maneja clics en el backdrop */}
        <CalendarSidebar 
          date={date}
          setDate={setDate}
          calendarData={calendarData}
          timeZoneOffset={timeZoneOffset}
          setTimeZoneOffset={setTimeZoneOffset}
          isMobileOpen={calendarOpen}
          onMobileClose={() => setCalendarOpen(false)}
        />
        
        {/* Contenido principal */}
        <div className="calendar-main w-full overflow-hidden">
          {/* Información del día seleccionado */}
          <div className="card p-0 overflow-hidden shadow-md rounded-xl border border-gray-200 bg-white hover:shadow-lg transition-shadow duration-300 w-full">
            <div className="bg-gradient-to-r from-dashcam-700 to-dashcam-600 text-white p-2 flex justify-between items-center">
              <h2 className="text-base sm:text-lg font-semibold flex items-center">
                <FaClock className="mr-2" />
                <span className="hidden xs:inline">{format(date, 'MMMM d, yyyy')}</span>
                <span className="xs:hidden">{format(date, 'dd/MM/yyyy')}</span>
              </h2>
              <div className="flex space-x-1 sm:space-x-2">
                {externalVideos.length > 0 && (
                  <div className="bg-green-500 text-white text-xs py-1 px-1 sm:px-2 rounded-md flex items-center whitespace-nowrap">
                    <FaMobileAlt className="mr-0.5 sm:mr-1" />
                    <span>{externalVideos.length}</span>
                  </div>
                )}
                {(selectedDayTrips.length > 0) && (
                  <button 
                    className="px-2 sm:px-3 py-1 bg-dashcam-500 hover:bg-dashcam-600 text-white rounded-lg transition-all duration-200 flex items-center text-xs sm:text-sm font-medium shadow-md hover:shadow-lg transform hover:translate-y-[-1px]"
                    onClick={() => generateSummary(format(date, 'yyyy-MM-dd'))}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="whitespace-nowrap">Procesando...</span>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Generar Resumen</span>
                        <span className="sm:hidden">Generar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          
            <div className="p-1 sm:p-2 overflow-x-hidden">
              {/* Añadir el componente de filtros */}
              {(externalVideos.length > 0 || selectedDayTrips.length > 0) && (
                <VideoFilters 
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  allTags={allTags}
                  sourceOptions={sourceOptions}
                />
              )}
              
              {isLoading ? (
                <div className="py-4 text-center text-gray-500 animate-pulse">
                  <div className="loader"></div>
                  <p className="mt-2">Cargando grabaciones...</p>
                </div>
              ) : (
                <div className="w-full overflow-hidden">
                  {videoClips.length === 0 && 
                   (!filters.showTrips || selectedDayTrips.length === 0) && 
                   (!filters.showExternalVideos || filteredExternalVideos.length === 0) ? (
                    <div className="py-4 text-center">
                      <div className="text-gray-400 text-4xl mb-2">
                        <FaVideo />
                      </div>
                      <p className="text-gray-500">No hay grabaciones para esta fecha {filters.tags.length > 0 || filters.videoSource !== 'all' ? 'con estos filtros' : ''}</p>
                      <p className="text-gray-400 text-xs mt-1">Intenta seleccionar otro día o modificar los filtros</p>
                    </div>
                  ) : (
                    <>
                      {/* Fila para controles y reproductor de video */}
                      <div className="flex flex-col w-full">
                        {/* Reproductor de video y selector de cámara */}
                        <div className="flex flex-col md:flex-row mb-3 gap-3 w-full">
                          <div className="flex-grow w-full">
                            <VideoPlayer 
                              videoSrc={selectedVideo}
                              secondaryVideoSrc={secondaryVideo}
                              isPictureInPicture={activeCamera === 'both' && secondaryVideo !== null}
                              isFullPlayer={false}
                            />
                          </div>
                          
                          {/* Selector de cámara - responsive */}
                          <div className="w-full md:w-56 md:flex-shrink-0 flex flex-col gap-3">
                            <CameraSelector 
                              selectedCamera={activeCamera}
                              onCameraChange={handleCameraChange}
                            />
                            
                            {/* Información del clip seleccionado - solo en pantallas medianas y grandes */}
                            <div className="hidden md:block flex-grow" style={{ minHeight: "280px" }}>
                              <SelectedClipInfo 
                                selectedClip={selectedClip}
                                getVideoUrl={getVideoUrl}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Información del clip seleccionado - visible en móvil */}
                        {selectedClip && (
                          <div className="md:hidden mb-3 w-full">
                            <SelectedClipInfo 
                              selectedClip={selectedClip}
                              getVideoUrl={getVideoUrl}
                              isMobile={true}
                            />
                          </div>
                        )}
                        
                        {filters.showTrips && videoClips.length > 0 && (
                          <div className="flex items-start mb-3 w-full">
                            <div className="w-full">
                              <VideoTimeline 
                                videoClips={videoClips}
                                selectedDay={format(date, 'dd/MM/yyyy')}
                                timeZoneOffset={timeZoneOffset}
                                onSelectClip={handleSelectClip}
                              />
                            </div>
                          </div>
                        )}
                      
                        {/* Trip recordings */}
                        {filters.showTrips && selectedDayTrips.length > 0 && (
                          <div className="mt-3 w-full">
                            <h3 className="text-base font-semibold mb-2 text-dashcam-700 flex items-center border-b pb-1">
                              <FaCarSide className="mr-2" />
                              Viajes ({selectedDayTrips.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-2 max-h-36 overflow-auto w-full">
                              {selectedDayTrips.map((trip) => (
                                <div key={trip.id} className="border border-gray-200 rounded-lg p-0 overflow-hidden hover:shadow-md transition-all duration-300 bg-white transform hover:translate-y-[-1px]">
                                  <div className="bg-gradient-to-r from-gray-50 to-white p-1.5 sm:p-2 flex justify-between items-center border-b">
                                    <div className="font-semibold text-dashcam-800 flex items-center text-xs sm:text-sm">
                                      <FaClock className="mr-1 text-dashcam-600" />
                                      {format(new Date(trip.start_time), 'h:mm a')}
                                      {trip.end_time && ` - ${format(new Date(trip.end_time), 'h:mm a')}`}
                                    </div>
                                    {trip.distance_km && (
                                      <div className="text-xs bg-dashcam-50 text-dashcam-800 flex items-center py-0.5 px-1 sm:px-2 rounded-full">
                                        <FaRoad className="mr-0.5 sm:mr-1 text-dashcam-600" />
                                        {trip.distance_km !== undefined ? trip.distance_km.toFixed(1) : '0.0'} km
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="p-1.5 flex justify-between items-center">
                                    <div>
                                      {trip.landmarks && trip.landmarks.length > 0 && (
                                        <div className="text-xs text-gray-600 flex items-center">
                                          <FaMapMarkerAlt className="mr-1 text-red-500 text-xs" />
                                          {trip.landmarks.length}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex space-x-2">
                                      {(trip.video_files && Array.isArray(trip.video_files) && trip.video_files.length > 0) ? (
                                        <button 
                                          className="text-dashcam-600 hover:text-dashcam-800 flex items-center text-xs bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md transition-colors duration-200"
                                          onClick={() => playVideo(trip.video_files[0])}
                                        >
                                          <FaVideo className="mr-1" /> Video
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-500">No hay videos</span>
                                      )}
                                      {trip.summary_file && (
                                        <button 
                                          className="text-dashcam-600 hover:text-dashcam-800 flex items-center text-xs bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md transition-colors duration-200"
                                          onClick={() => playVideo(trip.summary_file)}
                                        >
                                          <FaFileDownload className="mr-1" /> Resumen
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* External videos - mejor diseño para móvil */}
                        {filters.showExternalVideos && filteredExternalVideos.length > 0 && (
                          <div className="mt-3 w-full">
                            <h3 className="text-base font-semibold mb-2 text-green-700 flex items-center border-b pb-1">
                              <FaMobileAlt className="mr-2" />
                              Videos Externos ({filteredExternalVideos.length})
                            </h3>
                            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 w-full">
                              {filteredExternalVideos.map((video) => (
                                <div key={video.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300 bg-white w-full">
                                  <div className="bg-green-50 p-1.5 sm:p-2 border-b flex justify-between items-center">
                                    <div className="font-semibold text-green-800 flex items-center text-xs sm:text-sm">
                                      <FaMobileAlt className="mr-1 text-green-600" />
                                      {video.source || 'Externo'}
                                    </div>
                                    {video.upload_time && (
                                      <div className="text-xs text-gray-600">
                                        {format(new Date(video.upload_time), 'h:mm a')}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="p-0 flex flex-col">
                                    {/* Miniatura del video externo */}
                                    <div className="relative group cursor-pointer"
                                         onClick={() => playVideo(`external/${video.id}`)}>
                                      <img 
                                        src={`/api/videos/thumbnail/external/${video.id}`}
                                        alt="Vista previa"
                                        className="w-full h-20 xs:h-24 sm:h-32 object-cover cursor-pointer group-hover:opacity-90 transition-opacity"
                                        onError={(e) => {e.target.src = 'https://placehold.co/600x400'; e.target.onerror = null;}}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-black bg-opacity-50 rounded-full p-3">
                                          <FaVideo className="text-white text-xl" />
                                        </div>
                                      </div>
                                      
                                      {/* Play button siempre visible en móvil */}
                                      <div className="absolute inset-0 flex items-center justify-center sm:hidden">
                                        <div className="bg-black bg-opacity-30 rounded-full p-2">
                                          <FaVideo className="text-white text-lg" />
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="p-2">
                                      {/* Nombre del archivo original - truncado en móvil */}
                                      <div className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                                        {video.original_filename || `Video-${video.id}`}
                                      </div>
                                      
                                      {/* Etiquetas - optimizado para móvil */}
                                      {video.tags && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          <FaTags className="text-xs text-gray-400 mr-1 mt-1" />
                                          <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
                                            {video.tags.split(',').slice(0, 3).map((tag, idx) => (
                                              <span key={idx} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                                {tag.trim()}
                                              </span>
                                            ))}
                                            {video.tags.split(',').length > 3 && (
                                              <span className="text-xs text-gray-500">+{video.tags.split(',').length - 3}</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div className="mt-2 flex justify-between items-center">
                                        <div className="flex space-x-1">
                                          {video.lat && video.lon && (
                                            <div className="text-xs bg-blue-50 text-blue-700 py-0.5 px-1 rounded flex items-center">
                                              <FaMapMarkerAlt className="mr-0.5 text-blue-500" />
                                              <span className="hidden xs:inline">GPS</span>
                                            </div>
                                          )}
                                        </div>
                                        <button 
                                          className="text-green-600 hover:text-green-800 flex items-center text-xs bg-green-50 hover:bg-green-100 px-2 py-1 rounded-md transition-colors duration-200"
                                          onClick={() => playVideo(`external/${video.id}`)}
                                        >
                                          <FaVideo className="mr-1" /> <span className="hidden xs:inline">Reproducir</span><span className="xs:hidden">Ver</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Video player modal - solo se muestra cuando se reproduce en modo completo */}
      {selectedVideo && false && (
        <VideoPlayer 
          videoSrc={selectedVideo}
          secondaryVideoSrc={secondaryVideo}
          isPictureInPicture={activeCamera === 'both' && secondaryVideo !== null}
          onClose={handleClosePlayer}
          isFullPlayer={true}
        />
      )}
    </div>
  );
}

export default CalendarView;