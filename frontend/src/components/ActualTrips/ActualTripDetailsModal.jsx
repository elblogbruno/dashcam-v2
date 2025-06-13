import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaClock, 
  FaMapMarkerAlt, 
  FaRoute, 
  FaVideo, 
  FaTachometerAlt,
  FaSatellite,
  FaPlay,
  FaDownload,
  FaExternalLinkAlt
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';

// Usar el sistema de UI del proyecto
import { Modal, Card, Button, Badge } from '../common/UI';
import { Grid, Flex } from '../common/Layout';

import { 
  fetchActualTripDetails, 
  fetchTripVideoClips, 
  fetchTripGpsTrack 
} from '../../services/actualTripsService';
import TripMap from './TripMap';

const ActualTripDetailsModal = ({ opened, onClose, trip, plannedTripId }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tripDetails, setTripDetails] = useState(null);
  const [videoClips, setVideoClips] = useState([]);
  const [gpsTrack, setGpsTrack] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (opened && trip) {
      loadTripDetails();
    }
  }, [opened, trip]);

  const loadTripDetails = async () => {
    if (!trip || !plannedTripId) return;
    
    setLoading(true);
    try {
      // Load detailed trip information
      const details = await fetchActualTripDetails(plannedTripId, trip.id);
      setTripDetails(details);
      
      // Load video clips
      try {
        const clipsResponse = await fetchTripVideoClips(plannedTripId, trip.id);
        setVideoClips(clipsResponse.video_clips || []);
      } catch (error) {
        console.error('Error loading video clips:', error);
        setVideoClips([]);
      }
      
      // Load GPS track
      try {
        const gpsResponse = await fetchTripGpsTrack(plannedTripId, trip.id);
        setGpsTrack(gpsResponse.gps_track || []);
      } catch (error) {
        console.error('Error loading GPS track:', error);
        setGpsTrack([]);
      }
      
    } catch (error) {
      console.error('Error loading trip details:', error);
      toast.error('Error al cargar los detalles del viaje');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const formatSpeed = (speed) => {
    if (!speed || speed === 0) return 'N/A';
    return `${speed.toFixed(1)} km/h`;
  };

  const formatDistance = (distanceKm) => {
    if (!distanceKm || distanceKm === 0) return 'N/A';
    if (distanceKm < 1) {
      return `${(distanceKm * 1000).toFixed(0)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  };

  const playVideoClip = (clip) => {
    if (clip.road_video_file && clip.start_time) {
      // Navigate to calendar view with the specific video clip
      // Extract date from clip start_time for calendar navigation
      const clipDate = new Date(clip.start_time);
      const dateString = clipDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Close the modal first
      onClose();
      
      // Navigate to calendar with date and video parameters
      // The calendar will load the video automatically based on the clip time
      navigate(`/calendar?date=${dateString}&autoplay=true&video=${encodeURIComponent(clip.road_video_file)}&time=${encodeURIComponent(clip.start_time)}`);
    } else {
      toast.error('Archivo de video no disponible');
    }
  };

  const downloadVideoClip = (clip) => {
    if (clip.road_video_file) {
      // Create download link
      const link = document.createElement('a');
      link.href = `/api/videos/${clip.road_video_file}`;
      link.download = clip.road_video_file;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.error('Archivo de video no disponible');
    }
  };

  if (!trip) return null;

  return (
    <Modal
      isOpen={opened}
      onClose={onClose}
      title={`Detalles del Viaje #${trip.id}`}
      size="xl"
      className="sm:max-h-[90vh] max-h-[85vh] overflow-hidden"
    >
      <div className="max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
        <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 overflow-x-auto" role="tablist">
            <Button
              onClick={() => setActiveTab('overview')}
              variant={activeTab === 'overview' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaRoute className="mr-1 text-xs" />
              Resumen
            </Button>
            <Button
              onClick={() => setActiveTab('map')}
              variant={activeTab === 'map' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'map'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaMapMarkerAlt className="mr-1 text-xs" />
              Mapa
            </Button>
            <Button
              onClick={() => setActiveTab('videos')}
              variant={activeTab === 'videos' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'videos'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaVideo className="mr-1 text-xs" />
              Videos ({videoClips.length})
            </Button>
            <Button
              onClick={() => setActiveTab('landmarks')}
              variant={activeTab === 'landmarks' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'landmarks'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaMapMarkerAlt className="mr-1 text-xs" />
              Landmarks ({tripDetails?.landmarks?.length || 0})
            </Button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'overview' && (
            <>
              {loading ? (
                <div className="text-center py-8">
                  <p>Cargando detalles...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Basic Trip Info */}
                  <Card title="Información del Viaje">
                    
                    <Grid cols={2} gap={4}>
                      <div className="flex items-center space-x-2">
                        <FaClock className="text-blue-500" size={16} />
                        <div>
                          <p className="text-xs text-gray-500">Inicio</p>
                          <p className="text-sm">
                            {trip.start_time ? new Date(trip.start_time).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <FaClock className="text-red-500" size={16} />
                        <div>
                          <p className="text-xs text-gray-500">Fin</p>
                          <p className="text-sm">
                            {trip.end_time ? new Date(trip.end_time).toLocaleString() : 'En curso'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <FaClock className="text-green-500" size={16} />
                        <div>
                          <p className="text-xs text-gray-500">Duración</p>
                          <p className="text-sm">{formatDuration(trip.start_time, trip.end_time)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <FaRoute className="text-purple-500" size={16} />
                        <div>
                          <p className="text-xs text-gray-500">Distancia</p>
                          <p className="text-sm">{formatDistance(trip.distance_km)}</p>
                        </div>
                      </div>
                    </Grid>
                  </Card>

                  {/* GPS Statistics */}
                  {tripDetails?.statistics && (
                    <Card title="Estadísticas GPS">
                      <Grid cols={2} gap={4}>
                        <div className="flex items-center space-x-2">
                          <FaTachometerAlt className="text-green-500" size={16} />
                          <div>
                            <p className="text-xs text-gray-500">Velocidad Promedio</p>
                            <p className="text-sm">{formatSpeed(tripDetails.statistics.avg_speed)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <FaTachometerAlt className="text-red-500" size={16} />
                          <div>
                            <p className="text-xs text-gray-500">Velocidad Máxima</p>
                            <p className="text-sm">{formatSpeed(tripDetails.statistics.max_speed)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <FaSatellite className="text-blue-500" size={16} />
                          <div>
                            <p className="text-xs text-gray-500">Puntos GPS</p>
                            <p className="text-sm">{tripDetails.statistics.total_points || 0}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <FaSatellite className="text-orange-500" size={16} />
                          <div>
                            <p className="text-xs text-gray-500">Satélites Promedio</p>
                            <p className="text-sm">{tripDetails.statistics.avg_satellites?.toFixed(1) || 'N/A'}</p>
                          </div>
                        </div>
                      </Grid>
                    </Card>
                  )}

                  {/* Data Summary */}
                  <Card title="Resumen de Datos">
                    <Flex gap={4} className="flex-wrap">
                      <div className="flex items-center space-x-2">
                        <FaVideo className="text-orange-500" size={16} />
                        <div>
                          <p className="text-xs text-gray-500">Clips de Video</p>
                          <p className="text-sm">{videoClips.length}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <FaMapMarkerAlt className="text-red-500" size={16} />
                        <div>
                          <p className="text-xs text-gray-500">Landmarks Encontrados</p>
                          <p className="text-sm">{tripDetails?.landmarks?.length || 0}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <FaSatellite className="text-blue-500" size={16} />
                        <div>
                          <p className="text-xs text-gray-500">Track GPS</p>
                          <p className="text-sm">{gpsTrack.length} puntos</p>
                        </div>
                      </div>
                    </Flex>
                  </Card>
                </div>
              )}
            </>
          )}

          {activeTab === 'map' && (
            <Card>
              <TripMap 
                gpsTrack={gpsTrack}
                landmarks={tripDetails?.landmarks || []}
                videoClips={videoClips}
                trip={trip}
              />
            </Card>
          )}

          {activeTab === 'videos' && (
            <div className="space-y-4">
              {videoClips.length === 0 ? (
                <div className="text-center py-8">
                  <FaVideo size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-lg text-gray-500 mb-2">
                    No hay clips de video
                  </p>
                  <p className="text-sm text-gray-500">
                    Los clips de video aparecerán aquí cuando se registren durante el viaje.
                  </p>
                </div>
              ) : (
                videoClips.map((clip) => (
                  <Card key={clip.id}>
                    <Flex justify="between" align="center" className="mb-4">
                      <Flex align="center" gap={2}>
                        <span className="font-medium">Clip #{clip.sequence_num || clip.id}</span>
                        {clip.quality && (
                          <Badge variant={clip.quality === 'high' ? 'success' : 'primary'}>
                            {clip.quality}
                          </Badge>
                        )}
                        {clip.landmark_name && (
                          <Badge variant="warning">
                            {clip.landmark_name}
                          </Badge>
                        )}
                      </Flex>
                      
                      <Flex gap={2}>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => playVideoClip(clip)}
                          disabled={!clip.road_video_file}
                          title="Reproducir"
                        >
                          <FaPlay />
                        </Button>
                        
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => downloadVideoClip(clip)}
                          disabled={!clip.road_video_file}
                          title="Descargar"
                        >
                          <FaDownload />
                        </Button>
                      </Flex>
                    </Flex>
                    
                    <Grid cols={2} gap={4}>
                      <div>
                        <p className="text-xs text-gray-500">Inicio</p>
                        <p className="text-sm">
                          {clip.start_time ? new Date(clip.start_time).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500">Fin</p>
                        <p className="text-sm">
                          {clip.end_time ? new Date(clip.end_time).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      
                      {clip.start_lat && clip.start_lon && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Ubicación</p>
                          <p className="text-sm">
                            {clip.start_lat.toFixed(6)}, {clip.start_lon.toFixed(6)}
                          </p>
                        </div>
                      )}
                      
                      {clip.road_video_file && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Archivo</p>
                          <p className="text-sm">{clip.road_video_file}</p>
                        </div>
                      )}
                    </Grid>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'landmarks' && (
            <div className="space-y-4">
              {(!tripDetails?.landmarks || tripDetails.landmarks.length === 0) ? (
                <div className="text-center py-8">
                  <FaMapMarkerAlt size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-lg text-gray-500 mb-2">
                    No se encontraron landmarks
                  </p>
                  <p className="text-sm text-gray-500">
                    Los landmarks encontrados durante el viaje aparecerán aquí.
                  </p>
                </div>
              ) : (
                tripDetails.landmarks.map((landmark) => (
                  <Card key={landmark.id}>
                    <Flex justify="between" align="center" className="mb-4">
                      <Flex align="center" gap={2}>
                        <span className="font-medium">{landmark.landmark_name}</span>
                        {landmark.landmark_type && (
                          <Badge variant="primary">
                            {landmark.landmark_type}
                          </Badge>
                        )}
                        {landmark.is_priority_landmark && (
                          <Badge variant="error">
                            Prioritario
                          </Badge>
                        )}
                      </Flex>
                    </Flex>
                    
                    <Grid cols={2} gap={4}>
                      <div>
                        <p className="text-xs text-gray-500">Tiempo de Encuentro</p>
                        <p className="text-sm">
                          {landmark.encounter_time ? new Date(landmark.encounter_time).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500">Ubicación</p>
                        <p className="text-sm">
                          {landmark.lat.toFixed(6)}, {landmark.lon.toFixed(6)}
                        </p>
                      </div>
                    </Grid>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </Modal>
  );
};

export default ActualTripDetailsModal;
