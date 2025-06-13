import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  FaArrowLeft, 
  FaMapMarkerAlt, 
  FaClock, 
  FaRoute, 
  FaVideo, 
  FaTrash, 
  FaEye,
  FaCarSide,
  FaTachometerAlt,
  FaSatellite,
  FaThLarge,
  FaList,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaEllipsisV,
  FaFilter,
  FaTimes,
  FaSearch,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle
} from 'react-icons/fa';

import { PageLayout } from '../components/common/Layout';
import { Button, Card, Badge, Spinner } from '../components/common/UI';
import { fetchActualTripsForPlannedTrip, deleteActualTrip } from '../services/actualTripsService';
import { fetchTrips as fetchPlannedTrips } from '../services/tripService';
import ActualTripDetailsModal from '../components/ActualTrips/ActualTripDetailsModal';

const ActualTripsManager = () => {
  const { plannedTripId } = useParams();
  const navigate = useNavigate();
  
  const [plannedTrip, setPlannedTrip] = useState(null);
  const [actualTrips, setActualTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTripForDetails, setSelectedTripForDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // View and pagination states
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6); // Default items per page

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    dataStatus: 'all', // 'all', 'with-data', 'no-data'
    duration: 'all', // 'all', 'short', 'medium', 'long'
    speed: 'all', // 'all', 'slow', 'normal', 'fast'
    distance: 'all', // 'all', 'short', 'medium', 'long'
    searchText: ''
  });

  useEffect(() => {
    loadData();
  }, [plannedTripId]);

  useEffect(() => {
    // Reset to first page when view mode changes or filters change
    setCurrentPage(1);
  }, [viewMode, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load planned trip details
      const plannedTripsResponse = await fetchPlannedTrips();
      const foundPlannedTrip = plannedTripsResponse.find(trip => trip.id === plannedTripId);
      
      if (!foundPlannedTrip) {
        toast.error('Viaje planificado no encontrado');
        navigate('/trips');
        return;
      }
      
      setPlannedTrip(foundPlannedTrip);
      
      // Load actual trips for this planned trip
      const actualTripsResponse = await fetchActualTripsForPlannedTrip(plannedTripId);
      setActualTrips(actualTripsResponse.trips || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este viaje? Se borrarán todos los datos asociados (GPS, clips de video, landmarks encontrados).')) {
      return;
    }

    try {
      await deleteActualTrip(plannedTripId, tripId);
      toast.success('Viaje eliminado correctamente');
      // Reload trips
      loadData();
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error('Error al eliminar el viaje');
    }
  };

  const handleViewDetails = (trip) => {
    setSelectedTripForDetails(trip);
    setShowDetailsModal(true);
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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

  const getTripStatusBadge = (trip) => {
    if (!trip.end_time) {
      return <Badge variant="filled" className="bg-yellow-500 text-white">En curso</Badge>;
    }
    
    const hasVideos = trip.video_clips_count > 0;
    const hasGps = trip.gps_points_count > 0;
    const hasLandmarks = trip.landmark_encounters_count > 0;
    
    if (hasVideos && hasGps && hasLandmarks) {
      return <Badge variant="filled" className="bg-green-500 text-white">Completo</Badge>;
    } else if (hasVideos && hasGps) {
      return <Badge variant="filled" className="bg-blue-500 text-white">Con datos</Badge>;
    } else if (hasGps) {
      return <Badge variant="filled" className="bg-orange-500 text-white">Solo GPS</Badge>;
    } else {
      return <Badge variant="filled" className="bg-red-500 text-white">Sin datos</Badge>;
    }
  };

  // Filter functions
  const applyFilters = (trips) => {
    return trips.filter(trip => {
      // Date filter
      if (filters.dateFrom || filters.dateTo) {
        const tripDate = new Date(trip.start_time);
        if (filters.dateFrom && tripDate < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && tripDate > new Date(filters.dateTo + ' 23:59:59')) return false;
      }

      // Data status filter
      if (filters.dataStatus !== 'all') {
        const hasData = trip.video_clips_count > 0 || trip.landmark_encounters_count > 0 || trip.gps_points_count > 0;
        if (filters.dataStatus === 'with-data' && !hasData) return false;
        if (filters.dataStatus === 'no-data' && hasData) return false;
      }

      // Duration filter
      if (filters.duration !== 'all' && trip.start_time && trip.end_time) {
        const durationMs = new Date(trip.end_time) - new Date(trip.start_time);
        const durationMinutes = durationMs / (1000 * 60);
        
        if (filters.duration === 'short' && durationMinutes > 30) return false;
        if (filters.duration === 'medium' && (durationMinutes <= 30 || durationMinutes > 120)) return false;
        if (filters.duration === 'long' && durationMinutes <= 120) return false;
      }

      // Speed filter
      if (filters.speed !== 'all' && trip.avg_speed) {
        if (filters.speed === 'slow' && trip.avg_speed > 30) return false;
        if (filters.speed === 'normal' && (trip.avg_speed <= 30 || trip.avg_speed > 60)) return false;
        if (filters.speed === 'fast' && trip.avg_speed <= 60) return false;
      }

      // Distance filter
      if (filters.distance !== 'all' && trip.distance_km) {
        if (filters.distance === 'short' && trip.distance_km > 10) return false;
        if (filters.distance === 'medium' && (trip.distance_km <= 10 || trip.distance_km > 50)) return false;
        if (filters.distance === 'long' && trip.distance_km <= 50) return false;
      }

      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const tripId = trip.id.toString();
        const startDate = trip.start_time ? new Date(trip.start_time).toLocaleDateString() : '';
        
        if (!tripId.includes(searchLower) && 
            !startDate.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      dataStatus: 'all',
      duration: 'all',
      speed: 'all',
      distance: 'all',
      searchText: ''
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.dataStatus !== 'all') count++;
    if (filters.duration !== 'all') count++;
    if (filters.speed !== 'all') count++;
    if (filters.distance !== 'all') count++;
    if (filters.searchText) count++;
    return count;
  };

  // Pagination logic
  const filteredTrips = applyFilters(actualTrips);
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTrips = filteredTrips.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        pageNumbers.push(i);
      } else if (
        (i === currentPage - 2 && currentPage > 3) ||
        (i === currentPage + 2 && currentPage < totalPages - 2)
      ) {
        pageNumbers.push('...');
      }
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          leftIcon={<FaChevronLeft />}
        >
          Anterior
        </Button>

        {pageNumbers.map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-2 py-1 text-gray-500">...</span>
            ) : (
              <Button
                variant={currentPage === page ? "filled" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page)}
                className={currentPage === page ? "bg-blue-500 text-white" : ""}
              >
                {page}
              </Button>
            )}
          </React.Fragment>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          rightIcon={<FaChevronRight />}
        >
          Siguiente
        </Button>
      </div>
    );
  };

  // Reusable components for trip cards
  const TripHeader = ({ trip, viewMode, onViewDetails, onDelete }) => {
    const isGrid = viewMode === 'grid';
    const gradientClass = isGrid 
      ? 'bg-gradient-to-r from-blue-50 to-indigo-50' 
      : 'bg-gradient-to-r from-gray-50 to-slate-50';
    const iconBgClass = isGrid ? 'bg-blue-100' : 'bg-gray-100';
    const iconColorClass = isGrid ? 'text-blue-600' : 'text-gray-600';

    return (
      <div className={`${gradientClass} border-b border-gray-100 px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center space-x-3">
          <div className={`p-1.5 ${iconBgClass} rounded`}>
            <FaCarSide className={iconColorClass} size={12} />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">Viaje #{trip.id}</h4>
            <div className={`flex items-center ${isGrid ? 'space-x-1' : 'space-x-2'} mt-1`}>
              <div className="flex items-center space-x-1">
                <FaCalendarAlt className="text-gray-400" size={9} />
                <span className="text-xs text-gray-500">
                  {trip.start_time ? new Date(trip.start_time).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              {!isGrid && (
                <div className="flex items-center space-x-1">
                  <FaClock className="text-gray-400" size={9} />
                  <span className="text-xs text-gray-500">
                    {trip.start_time ? new Date(trip.start_time).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </div>
          {!isGrid && getTripStatusBadge(trip)}
        </div>
        
        <div className="flex items-center space-x-2">
          {isGrid && getTripStatusBadge(trip)}
          {!isGrid && (
            <>
              <button
                onClick={() => onViewDetails(trip)}
                className="flex items-center space-x-1 px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                title="Ver detalles"
              >
                <FaEye size={12} />
                <span>Ver Detalles</span>
              </button>
              
              <button
                onClick={() => onDelete(trip.id)}
                className="flex items-center justify-center px-2 py-1.5 text-white bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                title="Eliminar viaje"
              >
                <FaTrash size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const TripStats = ({ trip, viewMode }) => {
    const isGrid = viewMode === 'grid';
    const containerClass = isGrid 
      ? 'space-y-3 mb-4' 
      : 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-3';

    const statsData = [
      {
        icon: FaClock,
        color: 'text-blue-500',
        label: 'Inicio',
        value: trip.start_time ? new Date(trip.start_time).toLocaleString() : 'N/A'
      },
      {
        icon: FaClock,
        color: 'text-red-500',
        label: 'Duración',
        value: formatDuration(trip.start_time, trip.end_time)
      },
      {
        icon: FaTachometerAlt,
        color: 'text-green-500',
        label: 'Velocidad Promedio',
        value: formatSpeed(trip.avg_speed)
      },
      {
        icon: FaRoute,
        color: 'text-purple-500',
        label: 'Distancia',
        value: formatDistance(trip.distance_km)
      }
    ];

    return (
      <div className={containerClass}>
        {statsData.map((stat, index) => (
          <div key={index} className="flex items-center space-x-3">
            <stat.icon className={stat.color} size={12} />
            <div>
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className="text-sm font-medium">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const TripMetrics = ({ trip, viewMode }) => (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center space-x-2">
        <FaVideo className="text-orange-500" size={10} />
        <span className="text-sm">{trip.video_clips_count || 0} clips</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <FaMapMarkerAlt className="text-red-500" size={10} />
        <span className="text-sm">{trip.landmark_encounters_count || 0} landmarks</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <FaSatellite className="text-blue-500" size={10} />
        <span className="text-sm">{trip.gps_points_count || 0} {viewMode === 'list' ? 'puntos GPS' : 'GPS'}</span>
      </div>
    </div>
  );

  const TripActions = ({ trip, onViewDetails, onDelete }) => (
    <div className="flex gap-2">
      <button
        onClick={() => onViewDetails(trip)}
        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
      >
        <FaEye size={12} />
        <span>Ver Detalles</span>
      </button>
      
      <button
        onClick={() => onDelete(trip.id)}
        className="flex items-center justify-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
        title="Eliminar viaje"
      >
        <FaTrash size={12} />
      </button>
    </div>
  );

  const TripCard = ({ trip, viewMode, onViewDetails, onDelete }) => (
    <Card 
      key={trip.id} 
      className="border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden p-0"
    >
      <TripHeader 
        trip={trip} 
        viewMode={viewMode} 
        onViewDetails={onViewDetails}
        onDelete={onDelete}
      />
      
      <div className="p-4">
        <TripStats trip={trip} viewMode={viewMode} />
        <TripMetrics trip={trip} viewMode={viewMode} />
        {viewMode === 'grid' && (
          <div className="mt-4">
            <TripActions trip={trip} onViewDetails={onViewDetails} onDelete={onDelete} />
          </div>
        )}
      </div>
    </Card>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {currentTrips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          viewMode="grid"
          onViewDetails={handleViewDetails}
          onDelete={handleDeleteTrip}
        />
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-3">
      {currentTrips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          viewMode="list"
          onViewDetails={handleViewDetails}
          onDelete={handleDeleteTrip}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <PageLayout
        title="Viajes Realizados"
        icon={<FaCarSide size={20} />}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="text-gray-600 mt-4">Cargando...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Viajes Realizados - ${plannedTrip?.name || 'Viaje'}`}
      icon={<FaCarSide size={20} />}
    >
      {/* Back Button - Mobile Friendly */}
      <div className="mb-4">
        <Button
          leftIcon={<FaArrowLeft />}
          variant="outline"
          onClick={() => navigate('/trips')}
          className="w-full sm:w-auto"
        >
          Volver al Planificador de Viajes
        </Button>
      </div>

      {/* Planned Trip Summary */}
      {plannedTrip && (
        <Card className="mb-4">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Viaje Planificado</h3>
              <Badge variant="light" className="bg-blue-100 text-blue-800">
                {plannedTrip.start_date} - {plannedTrip.end_date}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <FaMapMarkerAlt className="text-green-500" />
                <span className="text-sm text-gray-600">Desde:</span>
                <span className="text-sm">{plannedTrip.origin_name || 'Origen'}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <FaMapMarkerAlt className="text-red-500" />
                <span className="text-sm text-gray-600">Hasta:</span>
                <span className="text-sm">{plannedTrip.destination_name || 'Destino'}</span>
              </div>
              
              {plannedTrip.waypoints && plannedTrip.waypoints.length > 0 && (
                <div className="flex items-center space-x-2">
                  <FaRoute className="text-orange-500" />
                  <span className="text-sm text-gray-600">Waypoints:</span>
                  <span className="text-sm">{plannedTrip.waypoints.length}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actual Trips List */}
      <Card>
        <div className="p-4">
          {/* Header with Filters Toggle - Mobile Optimized */}
          <div className="space-y-3 mb-4">
            {/* Title and Counter Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <h3 className="text-lg font-medium truncate">Viajes Realizados</h3>
                <Badge variant="outline" className="border-gray-300 text-gray-600 text-xs whitespace-nowrap">
                  {filteredTrips.length}/{actualTrips.length}
                </Badge>
                {getActiveFilterCount() > 0 && (
                  <Badge variant="filled" className="bg-green-500 text-white text-xs">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </div>
              
              {/* Mobile Menu Button */}
              <div className="md:hidden">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors relative"
                  title="Opciones"
                >
                  <FaEllipsisV size={16} className="text-gray-600" />
                  {getActiveFilterCount() > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Desktop Controls Row */}
            <div className="hidden md:flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getActiveFilterCount() > 0 && (
                  <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1">
                    <FaCheckCircle className="text-green-600" size={14} />
                    <span className="text-sm text-green-700">
                      {getActiveFilterCount()} filtro{getActiveFilterCount() !== 1 ? 's' : ''} activo{getActiveFilterCount() !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* View Toggle Controls */}
                {actualTrips.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600 mr-1">Vista:</span>
                    <div className="flex border border-gray-300 rounded-lg">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-l-lg transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                        title="Vista de cuadrícula"
                      >
                        <FaThLarge size={14} />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-r-lg transition-colors ${
                          viewMode === 'list'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                        title="Vista de lista"
                      >
                        <FaList size={14} />
                      </button>
                    </div>
                    <div className="w-px h-6 bg-gray-300"></div>
                  </>
                )}
                
                {getActiveFilterCount() > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    leftIcon={<FaTimes />}
                    className="text-sm"
                  >
                    Limpiar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  leftIcon={showFilters ? <FaTimes /> : <FaFilter />}
                  className="text-sm"
                >
                  {showFilters ? 'Cerrar' : 'Filtros'}
                  {getActiveFilterCount() > 0 && (
                    <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {/* Mobile Expanded Controls */}
            {showFilters && (
              <div className="md:hidden bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                {/* Mobile View Toggle */}
                {actualTrips.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Vista:</span>
                    <div className="flex border border-gray-300 rounded-lg">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-2 text-sm rounded-l-lg transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <FaThLarge size={12} className="mr-1" />
                        Cuadrícula
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-2 text-sm rounded-r-lg transition-colors ${
                          viewMode === 'list'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <FaList size={12} className="mr-1" />
                        Lista
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Filter Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    leftIcon={<FaTimes />}
                    className="text-sm"
                  >
                    Cerrar
                  </Button>
                  {getActiveFilterCount() > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      leftIcon={<FaTimes />}
                      className="text-sm text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Limpiar Filtros ({getActiveFilterCount()})
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Improved Mobile-Friendly Filters Section */}
          {showFilters && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4 mb-4">
              <div className="space-y-3 md:space-y-4">
                
                {/* Mobile: Compact Search Bar */}
                <div className="md:hidden">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Buscar viajes..."
                      value={filters.searchText}
                      onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* Desktop: Search and Date Row */}
                <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaSearch className="inline mr-1" />
                      Buscar
                    </label>
                    <input
                      type="text"
                      placeholder="ID de viaje o fecha..."
                      value={filters.searchText}
                      onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaCalendarAlt className="inline mr-1" />
                      Desde
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaCalendarAlt className="inline mr-1" />
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Mobile: Date Range in Accordion Style */}
                <div className="md:hidden">
                  <details className="group">
                    <summary className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <span className="text-sm font-medium text-gray-700 flex items-center">
                        <FaCalendarAlt className="mr-2" size={14} />
                        Rango de Fechas
                        {(filters.dateFrom || filters.dateTo) && (
                          <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </span>
                      <FaChevronRight className="group-open:rotate-90 transition-transform text-gray-400" size={12} />
                    </summary>
                    <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                        <input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                        <input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  </details>
                </div>

                {/* Mobile: Quick Filter Chips */}
                <div className="md:hidden">
                  <div className="flex flex-wrap gap-2">
                    {/* Data Status Filter */}
                    <div className="flex-1 min-w-0">
                      <select
                        value={filters.dataStatus}
                        onChange={(e) => setFilters(prev => ({ ...prev, dataStatus: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="all">Todos los datos</option>
                        <option value="with-data">Con datos</option>
                        <option value="no-data">Sin datos</option>
                      </select>
                    </div>
                    
                    {/* Duration Filter */}
                    <div className="flex-1 min-w-0">
                      <select
                        value={filters.duration}
                        onChange={(e) => setFilters(prev => ({ ...prev, duration: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="all">Toda duración</option>
                        <option value="short">Corta (&lt; 30min)</option>
                        <option value="medium">Media (30min-2h)</option>
                        <option value="long">Larga (&gt; 2h)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Speed Filter */}
                    <div className="flex-1 min-w-0">
                      <select
                        value={filters.speed}
                        onChange={(e) => setFilters(prev => ({ ...prev, speed: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="all">Toda velocidad</option>
                        <option value="slow">Lenta (&lt; 30 km/h)</option>
                        <option value="normal">Normal (30-60 km/h)</option>
                        <option value="fast">Rápida (&gt; 60 km/h)</option>
                      </select>
                    </div>

                    {/* Distance Filter */}
                    <div className="flex-1 min-w-0">
                      <select
                        value={filters.distance}
                        onChange={(e) => setFilters(prev => ({ ...prev, distance: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        <option value="all">Toda distancia</option>
                        <option value="short">Corta (&lt; 10km)</option>
                        <option value="medium">Media (10-50km)</option>
                        <option value="long">Larga (&gt; 50km)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Desktop: Category Filters */}
                <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Data Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaCheckCircle className="inline mr-1" />
                      Estado de Datos
                    </label>
                    <select
                      value={filters.dataStatus}
                      onChange={(e) => setFilters(prev => ({ ...prev, dataStatus: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Todos</option>
                      <option value="with-data">Con datos</option>
                      <option value="no-data">Sin datos</option>
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaClock className="inline mr-1" />
                      Duración
                    </label>
                    <select
                      value={filters.duration}
                      onChange={(e) => setFilters(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Todas</option>
                      <option value="short">Corta (&lt; 30min)</option>
                      <option value="medium">Media (30min-2h)</option>
                      <option value="long">Larga (&gt; 2h)</option>
                    </select>
                  </div>

                  {/* Speed */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaTachometerAlt className="inline mr-1" />
                      Velocidad
                    </label>
                    <select
                      value={filters.speed}
                      onChange={(e) => setFilters(prev => ({ ...prev, speed: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Todas</option>
                      <option value="slow">Lenta (&lt; 30 km/h)</option>
                      <option value="normal">Normal (30-60 km/h)</option>
                      <option value="fast">Rápida (&gt; 60 km/h)</option>
                    </select>
                  </div>

                  {/* Distance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FaRoute className="inline mr-1" />
                      Distancia
                    </label>
                    <select
                      value={filters.distance}
                      onChange={(e) => setFilters(prev => ({ ...prev, distance: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Todas</option>
                      <option value="short">Corta (&lt; 10km)</option>
                      <option value="medium">Media (10-50km)</option>
                      <option value="long">Larga (&gt; 50km)</option>
                    </select>
                  </div>
                </div>

                {/* Filter Results Summary */}
                {getActiveFilterCount() > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <FaCheckCircle className="text-blue-600 flex-shrink-0" size={14} />
                          <span className="text-sm font-medium text-blue-800">
                            {filteredTrips.length} de {actualTrips.length} viajes mostrados
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {filters.searchText && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              <FaSearch className="mr-1" size={10} />
                              "{filters.searchText}"
                            </span>
                          )}
                          {filters.dateFrom && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              <FaCalendarAlt className="mr-1" size={10} />
                              Desde: {filters.dateFrom}
                            </span>
                          )}
                          {filters.dateTo && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              <FaCalendarAlt className="mr-1" size={10} />
                              Hasta: {filters.dateTo}
                            </span>
                          )}
                          {filters.dataStatus !== 'all' && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              <FaCheckCircle className="mr-1" size={10} />
                              {filters.dataStatus === 'with-data' ? 'Con datos' : 'Sin datos'}
                            </span>
                          )}
                          {filters.duration !== 'all' && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              <FaClock className="mr-1" size={10} />
                              {filters.duration === 'short' ? 'Corta' : filters.duration === 'medium' ? 'Media' : 'Larga'}
                            </span>
                          )}
                          {filters.speed !== 'all' && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              <FaTachometerAlt className="mr-1" size={10} />
                              {filters.speed === 'slow' ? 'Lenta' : filters.speed === 'normal' ? 'Normal' : 'Rápida'}
                            </span>
                          )}
                          {filters.distance !== 'all' && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              <FaRoute className="mr-1" size={10} />
                              {filters.distance === 'short' ? 'Corta' : filters.distance === 'medium' ? 'Media' : 'Larga'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={clearFilters}
                        className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Limpiar todos los filtros"
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {actualTrips.length === 0 ? (
            <div className="text-center py-8">
              <FaCarSide size={48} className="mx-auto text-gray-400 mb-4" />
              <h4 className="text-lg font-medium text-gray-600 mb-2">No hay viajes realizados</h4>
              <p className="text-gray-500">
                Los viajes que realices basados en este plan aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <>
              {/* Show current page info */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-sm text-gray-600">
                    Página {currentPage} de {totalPages} 
                    ({startIndex + 1}-{Math.min(endIndex, filteredTrips.length)} de {filteredTrips.length} viajes{getActiveFilterCount() > 0 ? ' filtrados' : ''})
                  </span>
                </div>
              )}
              
              {/* Render trips based on view mode */}
              {viewMode === 'grid' ? renderGridView() : renderListView()}
              
              {/* Pagination */}
              {renderPagination()}
            </>
          )}
        </div>
      </Card>

      {/* Details Modal */}
      {showDetailsModal && (
        <ActualTripDetailsModal
          opened={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          trip={selectedTripForDetails}
          plannedTripId={plannedTripId}
        />
      )}
    </PageLayout>
  );
};

export default ActualTripsManager;
