import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FaRoute, FaPlus, FaMapMarkerAlt, FaStop, FaFileImport } from 'react-icons/fa';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Importar el nuevo sistema de diseño
import { PageLayout, Section, Grid, Stack, Flex } from '../components/common/Layout';
import { Button, Card, Alert, Badge, Spinner } from '../components/common/UI';

// Import custom components
import TripFormModal from '../components/TripPlanner/TripFormModal';
import TripCard from '../components/TripPlanner/TripCard';
import TripMapPreview from '../components/TripPlanner/TripMapPreview';
import KmlPreview from '../components/TripPlanner/KmlPreview';
import MobileMapDrawer from '../components/TripPlanner/MobileMapDrawer';
import DownloadEstimateModal from '../components/TripPlanner/TripCard/DownloadEstimateModal';

// Import services
import { 
  fetchTrips as fetchTripsService,
  createTrip as createTripService,
  updateTrip as updateTripService,
  deleteTrip as deleteTripService
} from '../services/tripService';

// Import our new landmark service
import { downloadTripLandmarks } from '../services/landmarkService';
import { uploadKmlFile, importLandmarksFromKml } from '../services/kmlService';

// Fix Leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const TripPlanner = () => {
  const [trips, setTrips] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTrip, setDownloadingTrip] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [selectedTripForPreview, setSelectedTripForPreview] = useState(null);
  const [selectedTab, setSelectedTab] = useState('upcoming'); // 'upcoming' or 'past'
  const [geodataStats, setGeodataStats] = useState({}); // Store coverage stats by trip ID
  const [editingTrip, setEditingTrip] = useState(null);
  const [showMapDrawer, setShowMapDrawer] = useState(false); // New state for mobile map drawer
  const [mapKey, setMapKey] = useState(0); // Key to force map re-render
  
  // Download estimate modal states
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimateModalTripId, setEstimateModalTripId] = useState(null);
  const [estimateModalType, setEstimateModalType] = useState('both'); // 'landmarks', 'geodata', 'both'
  
  // Download control states
  const [downloadPaused, setDownloadPaused] = useState(false);
  const [downloadType, setDownloadType] = useState(null); // 'landmarks', 'geodata'
  
  // Touch handling for drawer
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Function to open map drawer with proper map initialization
  const openMapDrawer = () => {
    setShowMapDrawer(true);
    // Force map re-render when drawer opens with longer delay for mobile
    setTimeout(() => {
      setMapKey(prev => prev + 1);
      // Additional resize event to help with map rendering
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 150);
    }, 200);
  };

  // Handle touch events for drawer swipe-to-close
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isDownSwipe = distance < -100; // Swipe down threshold
    
    if (isDownSwipe) {
      setShowMapDrawer(false);
    }
  };
  const [activeTripInfo, setActiveTripInfo] = useState(null); // Para almacenar información del viaje activo
  
  // Estados para la importación de KML/KMZ
  const [isImportingLandmarks, setIsImportingLandmarks] = useState(false);
  const [kmlPlacemarks, setKmlPlacemarks] = useState([]);
  const [importingTripId, setImportingTripId] = useState(null);
  const [isLoadingKml, setIsLoadingKml] = useState(false);
  
  const navigate = useNavigate();
  
  // Fetch trips when component mounts
  useEffect(() => {
    fetchTrips();
    checkActiveTrip();
    checkActiveDownloads();
  }, []);

  // Function to check if there are any active downloads and reconnect
  const checkActiveDownloads = async () => {
    console.log(`[TripPlanner] Checking for active downloads...`);
    try {
      const tripsData = await fetchTripsService();
      console.log(`[TripPlanner] Found ${tripsData.length} trips to check`);
      
      // Check each trip for active downloads
      for (const trip of tripsData) {
        console.log(`[TripPlanner] Checking trip ${trip.id} (${trip.name}) for active downloads`);
        
        // Check for active geodata downloads
        try {
          const response = await fetch(`/api/geocoding/trip-geodata/${trip.id}/download-geodata-status`);
          console.log(`[TripPlanner] Geodata status response for ${trip.id}:`, response.status);
          
          if (response.ok) {
            const status = await response.json();
            console.log(`[TripPlanner] Geodata status for trip ${trip.id}:`, status);
            
            if (status.status === 'in_progress') {
              console.log(`[TripPlanner] Found active geodata download for trip ${trip.id}:`, status);
              
              // Set the downloading state
              setDownloadingTrip(trip.id);
              setDownloadProgress(status);
              
              // Reconnect to the stream
              console.log(`[TripPlanner] Reconnecting to geodata stream for trip ${trip.id}`);
              reconnectToGeodataStream(trip.id);
              break; // Only handle one active download at a time
            }
          }
        } catch (error) {
          console.warn(`Error checking geodata status for trip ${trip.id}:`, error);
        }
        
        // Check for active landmark downloads
        try {
          const response = await fetch(`/api/landmarks/${trip.id}/download-landmarks-status`);
          if (response.ok) {
            const status = await response.json();
            
            if (status.status === 'in_progress') {
              console.log(`[TripPlanner] Found active landmark download for trip ${trip.id}:`, status);
              
              // Set the downloading state
              setDownloadingTrip(trip.id);
              setDownloadProgress(status);
              
              // Reconnect to the stream
              reconnectToLandmarkStream(trip.id);
              break; // Only handle one active download at a time
            }
          }
        } catch (error) {
          console.warn(`Error checking landmark status for trip ${trip.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking active downloads:', error);
    }
  };

  // Function to reconnect to geodata stream
  const reconnectToGeodataStream = (tripId) => {
    console.log(`[TripPlanner] Creating EventSource for geodata stream: /api/geocoding/trip-geodata/${tripId}/download-geodata-stream`);
    const eventSource = new EventSource(`/api/geocoding/trip-geodata/${tripId}/download-geodata-stream`);
    
    eventSource.onopen = () => {
      console.log(`[TripPlanner] Geodata EventSource connection opened for trip ${tripId}`);
    };
    
    // Handle general messages (fallback)
    eventSource.onmessage = (event) => {
      try {
        console.log(`[TripPlanner] Received geodata event for trip ${tripId}:`, event.data);
        
        const data = JSON.parse(event.data);
        console.log(`[TripPlanner] Parsed geodata data for trip ${tripId}:`, data);
        
        if (data.type === 'progress') {
          console.log(`[TripPlanner] Updating progress for trip ${tripId}:`, data.progress);
          setDownloadProgress(data);
        } else if (data.type === 'complete') {
          console.log(`[TripPlanner] Geodata download completed for trip ${tripId}`);
          eventSource.close();
          setDownloadingTrip(null);
          setDownloadProgress(null);
          fetchTrips(); // Refresh to get updated trip status
        } else if (data.type === 'error') {
          console.log(`[TripPlanner] Geodata download error for trip ${tripId}:`, data);
          eventSource.close();
          setDownloadingTrip(null);
          setDownloadProgress(null);
        }
      } catch (error) {
        console.error('Error parsing geodata event:', error);
      }
    };

    // Handle specific progress events
    eventSource.addEventListener('progress', (event) => {
      try {
        console.log(`[TripPlanner] Received progress event for trip ${tripId}:`, event.data);
        const data = JSON.parse(event.data);
        console.log(`[TripPlanner] Updating progress for trip ${tripId}:`, data.progress);
        setDownloadProgress(data);
      } catch (error) {
        console.error('Error parsing progress event:', error);
      }
    });

    // Handle completion events
    eventSource.addEventListener('complete', (event) => {
      try {
        console.log(`[TripPlanner] Geodata download completed for trip ${tripId}`);
        const data = JSON.parse(event.data);
        console.log(`[TripPlanner] Completion data:`, data);
        eventSource.close();
        setDownloadingTrip(null);
        setDownloadProgress(null);
        fetchTrips(); // Refresh to get updated trip status
      } catch (error) {
        console.error('Error parsing completion event:', error);
      }
    });

    // Handle error events
    eventSource.addEventListener('error', (event) => {
      try {
        console.log(`[TripPlanner] Geodata download error for trip ${tripId}:`, event.data);
        const data = JSON.parse(event.data);
        console.log(`[TripPlanner] Error data:`, data);
        eventSource.close();
        setDownloadingTrip(null);
        setDownloadProgress(null);
      } catch (error) {
        console.error('Error parsing error event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error(`[TripPlanner] Geodata EventSource error for trip ${tripId}:`, error);
      console.error(`[TripPlanner] EventSource readyState:`, eventSource.readyState);
      eventSource.close();
      setDownloadingTrip(null);
      setDownloadProgress(null);
    };
  };

  // Function to reconnect to landmark stream
  const reconnectToLandmarkStream = (tripId) => {
    const eventSource = new EventSource(`/api/landmarks/${tripId}/download-landmarks-stream`);
    
    eventSource.onmessage = (event) => {
      try {
        console.log(`[TripPlanner] Received landmark event for trip ${tripId}:`, event.data);
        
        // Extract JSON from SSE format if needed
        let jsonData = event.data;
        if (typeof event.data === 'string' && event.data.includes('data: ')) {
          // Extract the JSON part after "data: "
          const lines = event.data.split('\n');
          const dataLine = lines.find(line => line.startsWith('data: '));
          if (dataLine) {
            jsonData = dataLine.substring(6); // Remove "data: " prefix
          }
        }
        
        const data = JSON.parse(jsonData);
        console.log(`[TripPlanner] Reconnected landmark progress for trip ${tripId}:`, data);
        
        if (data.type === 'progress') {
          setDownloadProgress(data);
        } else if (data.type === 'complete') {
          eventSource.close();
          setDownloadingTrip(null);
          setDownloadProgress(null);
          fetchTrips(); // Refresh to get updated trip status
        } else if (data.type === 'error') {
          eventSource.close();
          setDownloadingTrip(null);
          setDownloadProgress(null);
        }
      } catch (error) {
        console.error('Error parsing reconnected landmark event:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setDownloadingTrip(null);
      setDownloadProgress(null);
    };
  };
  
  const fetchTrips = async () => {
    setLoading(true);
    try {
      const tripsData = await fetchTripsService();
      setTrips(tripsData);
      
      // If we were previously editing or previewing a trip that was updated
      // make sure we update the selected trip
      if (selectedTripForPreview) {
        const updatedSelectedTrip = tripsData.find(trip => trip.id === selectedTripForPreview.id);
        if (updatedSelectedTrip) {
          setSelectedTripForPreview(updatedSelectedTrip);
        }
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateTrip = async (tripData) => {
    try {
      const newTrip = await createTripService(tripData);
      toast.success('Trip planned successfully');
      
      // Add the new trip to the state
      setTrips([...trips, newTrip]);
      
      // Reset form state
      setShowFormModal(false);
      
      // Select the new trip for preview
      setSelectedTripForPreview(newTrip);
    } catch (error) {
      console.error('Error creating trip:', error);
      toast.error('Failed to create trip');
    }
  };

  const handleUpdateTrip = async (tripData) => {
    try {
      const updatedTrip = await updateTripService(tripData);
      toast.success('Trip updated successfully');
      
      // Update trips in state
      setTrips(trips.map(trip => 
        trip.id === updatedTrip.id ? updatedTrip : trip
      ));
      
      // Reset editing state
      setEditingTrip(null);
      
      // Update the selected trip for preview if it was the one being edited
      if (selectedTripForPreview && selectedTripForPreview.id === updatedTrip.id) {
        setSelectedTripForPreview(updatedTrip);
      }
    } catch (error) {
      console.error('Error updating trip:', error);
      toast.error('Failed to update trip');
    }
  };
  
  const handleDeleteTrip = async (tripId) => {
    if (window.confirm('Are you sure you want to delete this trip?')) {
      try {
        await deleteTripService(tripId);
        toast.success('Trip deleted');
        
        // Remove the trip from state
        setTrips(trips.filter(trip => trip.id !== tripId));
        
        // Clear selected trip if it was the one deleted
        if (selectedTripForPreview && selectedTripForPreview.id === tripId) {
          setSelectedTripForPreview(null);
        }
        
        // Clear editing trip if it was the one deleted
        if (editingTrip && editingTrip.id === tripId) {
          setEditingTrip(null);
        }
      } catch (error) {
        console.error('Error deleting trip:', error);
        toast.error('Failed to delete trip');
      }
    }
  };
  
  const handleDownloadLandmarks = async (tripId) => {
    // Show estimate modal first
    setEstimateModalTripId(tripId);
    setEstimateModalType('landmarks');
    setShowEstimateModal(true);
  };

  const handleDownloadGeodata = async (tripId) => {
    // Show estimate modal first
    setEstimateModalTripId(tripId);
    setEstimateModalType('geodata');
    setShowEstimateModal(true);
  };

  // New function to handle both downloads
  const handleDownloadBoth = async (tripId) => {
    // Show estimate modal first
    setEstimateModalTripId(tripId);
    setEstimateModalType('both');
    setShowEstimateModal(true);
  };

  // Function called after user confirms in estimate modal
  const confirmDownload = async (radiusKm) => {
    const tripId = estimateModalTripId;
    const downloadType = estimateModalType;
    
    // Close modal
    setShowEstimateModal(false);
    setEstimateModalTripId(null);
    setEstimateModalType('both');
    
    // Start the actual download
    setDownloadingTrip(tripId);
    setDownloadProgress({ progress: 0, detail: 'Iniciando...' });
    
    try {
      if (downloadType === 'landmarks') {
        // Use our new simplified landmark service for downloading
        await downloadTripLandmarks(tripId, (progressData) => {
          console.log(`[TripPlanner DEBUG] Landmark progress data for trip ${tripId}:`, progressData);
          setDownloadProgress(progressData);
        });
        
        // Mark the trip as having landmarks downloaded
        setTrips(trips.map(trip => {
          if (trip.id === tripId) {
            return { ...trip, landmarks_downloaded: true };
          }
          return trip;
        }));
        
      } else if (downloadType === 'geodata') {
        // Import the new geodata download function
        const { downloadTripGeodata } = await import('../services/tripService');
        
        toast.loading('Iniciando descarga de datos geográficos...', { id: 'geodata-download' });
        
        // Download geodata with custom radius
        const result = await downloadTripGeodata(tripId, { radius_km: radiusKm, format: "both" }, (progress) => {
          console.log(`[TripPlanner DEBUG] Geodata progress data for trip ${tripId}:`, progress);
          setDownloadProgress(progress);
          
          // Update toast with progress
          if (progress.waypoint_name) {
            toast.loading(
              `Descargando geodata: ${progress.progress.toFixed(1)}% - ${progress.waypoint_name}`, 
              { id: 'geodata-download' }
            );
          }
        });
        
        // Store coverage statistics
        if (result && result.coverage_stats) {
          setGeodataStats(prev => ({
            ...prev,
            [tripId]: result.coverage_stats
          }));
        }
        
        setTrips(trips.map(trip => {
          if (trip.id === tripId) {
            return { ...trip, geodata_downloaded: true };
          }
          return trip;
        }));
        
        // Show success message with coverage info
        const coverageMessage = result?.coverage_stats 
          ? ` (Cobertura: ${result.coverage_stats.coverage_percentage?.toFixed(1) || 0}%)`
          : '';
        
        toast.success(`Datos geográficos descargados correctamente${coverageMessage}`, { id: 'geodata-download' });
        
      } else if (downloadType === 'both') {
        // Download landmarks first
        await downloadTripLandmarks(tripId, (progressData) => {
          console.log(`[TripPlanner DEBUG] Landmark progress data for trip ${tripId}:`, progressData);
          setDownloadProgress({
            ...progressData,
            detail: `Landmarks: ${progressData.detail || ''}`
          });
        });
        
        // Then download geodata
        const { downloadTripGeodata } = await import('../services/tripService');
        
        const result = await downloadTripGeodata(tripId, { radius_km: radiusKm, format: "both" }, (progress) => {
          console.log(`[TripPlanner DEBUG] Geodata progress data for trip ${tripId}:`, progress);
          setDownloadProgress({
            ...progress,
            detail: `Geodata: ${progress.detail || ''}`
          });
        });
        
        // Store coverage statistics
        if (result && result.coverage_stats) {
          setGeodataStats(prev => ({
            ...prev,
            [tripId]: result.coverage_stats
          }));
        }
        
        setTrips(trips.map(trip => {
          if (trip.id === tripId) {
            return { 
              ...trip, 
              landmarks_downloaded: true,
              geodata_downloaded: true 
            };
          }
          return trip;
        }));
        
        const coverageMessage = result?.coverage_stats 
          ? ` (Cobertura: ${result.coverage_stats.coverage_percentage?.toFixed(1) || 0}%)`
          : '';
        
        toast.success(`Descarga completa finalizada${coverageMessage}`);
      }
      
      // Refresh trips from server to get updated data
      fetchTrips();
    } catch (error) {
      console.error('Error downloading:', error);
      const errorMessage = downloadType === 'landmarks' 
        ? 'Error al descargar puntos de interés'
        : downloadType === 'geodata'
        ? 'Error al descargar datos geográficos'
        : 'Error en la descarga';
      toast.error(`${errorMessage}: ${error.message}`);
    } finally {
      setDownloadingTrip(null);
      setDownloadProgress(null);
    }
  };

  // Function to cancel download estimate modal
  const cancelEstimate = () => {
    setShowEstimateModal(false);
    setEstimateModalTripId(null);
    setEstimateModalType('both');
  };

  // Handle download cancellation from DownloadProgress component
  const handleCancelDownload = async (tripId) => {
    try {
      // Import cancel functions
      const { cancelLandmarksDownload, cancelGeodataDownload } = await import('../services/tripService');
      
      // Determine what type of download is active and cancel it
      if (downloadProgress?.detail) {
        const detail = downloadProgress.detail.toLowerCase();
        if (detail.includes('landmark') || detail.includes('punto')) {
          await cancelLandmarksDownload(tripId);
          toast.success('Descarga de puntos de interés cancelada');
        } else if (detail.includes('geodata') || detail.includes('geográfico')) {
          await cancelGeodataDownload(tripId);
          toast.success('Descarga de datos geográficos cancelada');
        } else {
          // Try both just in case
          try {
            await cancelLandmarksDownload(tripId);
          } catch (error) {
            console.warn('No landmarks download to cancel:', error);
          }
          try {
            await cancelGeodataDownload(tripId);
          } catch (error) {
            console.warn('No geodata download to cancel:', error);
          }
          toast.success('Descarga cancelada');
        }
      }
      
      // Reset download state
      setDownloadingTrip(null);
      setDownloadProgress(null);
      
      // Refresh trips to get updated status
      fetchTrips();
    } catch (error) {
      console.error('Error canceling download:', error);
      toast.error('Error al cancelar la descarga');
    }
  };
  
  const startNavigation = (trip) => {
    // Store the selected trip in localStorage for the map component to use
    localStorage.setItem('activeTrip', JSON.stringify(trip));
    // Navigate to the map page
    navigate('/map');
  };

  const handleEditTrip = (trip) => {
    setEditingTrip(trip);
    setShowFormModal(true);
  };

  const handleCancelForm = () => {
    setShowFormModal(false);
    setEditingTrip(null);
  };

  const isUpcomingTrip = (trip) => {
    return new Date(trip.end_date) >= new Date();
  };

  const isPastTrip = (trip) => {
    return new Date(trip.end_date) < new Date();
  };
  
  // Función para manejar la subida de archivos KML/KMZ para landmarks
  const handleImportLandmarksFile = async (tripId, event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Verificar que es un archivo KML o KMZ
    const validExtensions = ['kml', 'kmz'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Por favor, sube un archivo KML o KMZ válido');
      return;
    }
    
    setImportingTripId(tripId);
    setIsLoadingKml(true);
    
    try {
      // Subir el archivo y recibir los puntos
      const result = await uploadKmlFile(file);
      
      if (result && result.placemarks && result.placemarks.length > 0) {
        setKmlPlacemarks(result.placemarks);
        setIsImportingLandmarks(true);
        toast.success(`Se encontraron ${result.placemarks.length} puntos de interés en el archivo`);
      } else {
        toast.error('No se encontraron puntos de interés en el archivo');
      }
    } catch (error) {
      console.error('Error uploading KML file for landmarks:', error);
      toast.error(`Error al procesar el archivo: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsLoadingKml(false);
      // Limpiar el input de archivo para permitir subir el mismo archivo de nuevo
      event.target.value = null;
    }
  };
  
  // Función para cancelar la importación de landmarks desde KML
  const cancelLandmarksImport = () => {
    setIsImportingLandmarks(false);
    setKmlPlacemarks([]);
    setImportingTripId(null);
  };
  
  // Función para confirmar puntos seleccionados del KML como landmarks
  const confirmLandmarksImport = async (selectedPlacemarks) => {
    if (!importingTripId || selectedPlacemarks.length === 0) {
      cancelLandmarksImport();
      return;
    }
    
    try {
      // Crear un nuevo FormData y un blob con los puntos seleccionados
      const data = new FormData();
      const blob = new Blob([JSON.stringify(selectedPlacemarks)], {
        type: 'application/json'
      });
      
      data.append('placemarks', blob, 'placemarks.json');
      
      // Importar los puntos como landmarks para el viaje
      const result = await importLandmarksFromKml(importingTripId, data, selectedPlacemarks.map((_, index) => index));
      
      toast.success(`Se han importado ${selectedPlacemarks.length} puntos de interés para el viaje`);
      
      // Refrescar la lista de viajes para reflejar los nuevos landmarks
      fetchTrips();
    } catch (error) {
      console.error('Error importing landmarks from KML:', error);
      toast.error(`Error al importar puntos de interés: ${error.message || 'Error desconocido'}`);
    } finally {
      // Cerrar la vista de previsualización
      cancelLandmarksImport();
    }
  };

  const filteredTrips = trips.filter(trip => 
    selectedTab === 'upcoming' ? isUpcomingTrip(trip) : isPastTrip(trip)
  );
  
  // Función para verificar si hay un viaje activo actualmente
  const checkActiveTrip = async () => {
    try {
      const response = await fetch('/api/trips/active');
      const data = await response.json();
      
      if (data.status === 'success' && data.active_trip) {
        setActiveTripInfo(data.active_trip);
        
        // Si hay un viaje planificado activo, seleccionarlo para previsualización
        if (data.active_trip.planned_trip_id) {
          // Buscar en los viajes cargados
          const activePlannedTrip = trips.find(trip => trip.id === data.active_trip.planned_trip_id);
          if (activePlannedTrip) {
            setSelectedTripForPreview(activePlannedTrip);
          }
        }
      }
    } catch (error) {
      console.error('Error al verificar viaje activo:', error);
    }
  };
  
  // Add a link to the Landmarks Manager
  const navigateToLandmarksManager = () => {
    navigate('/landmarks-manager');
  };

  // Function to manage landmarks for a specific trip
  const manageTripLandmarks = (trip) => {
    // Store selected trip ID in local storage for the landmarks manager to use
    localStorage.setItem('selectedTripForLandmarks', JSON.stringify({ 
      id: trip.id, 
      name: trip.name 
    }));
    
    // Navigate to landmarks manager
    navigate('/landmarks-manager');
  };

  // Function to manage actual trips for a specific planned trip
  const manageActualTrips = (trip) => {
    // Navigate to actual trips manager
    navigate(`/trips/${trip.id}/actual-trips`);
  };

  return (
    <div className="trip-planner-container">
      <PageLayout
        title="Trip Planner"
        icon={<FaRoute size={20} />}
        actions={
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Mobile: Stack actions vertically */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 order-2 sm:order-1">
            {/* Landmarks Manager button - hidden on small screens, shown as icon on mobile */}
            <Button
              onClick={navigateToLandmarksManager}
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
            >
              <FaMapMarkerAlt className="mr-1 sm:mr-1" /> 
              <span className="sm:inline">Landmarks</span>
            </Button>
            
            {/* Plan Trip button */}
            <Button
              onClick={() => {
                setShowFormModal(true);
                setEditingTrip(null);
              }}
              variant="primary"
              size="sm"
              disabled={editingTrip !== null}
              className="w-full sm:w-auto min-h-[44px] touch-manipulation"
            >
              <FaPlus className="mr-1" /> Plan Trip
            </Button>
          </div>
          
          {/* Tab switcher - prioritized on mobile */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex order-1 sm:order-2 w-full sm:w-auto">
            <Button
              onClick={() => setSelectedTab('upcoming')}
              variant={selectedTab === 'upcoming' ? 'primary' : 'ghost'}
              size="sm"
              className="rounded-md flex-1 sm:flex-none min-h-[40px] touch-manipulation"
            >
              Upcoming
            </Button>
            <Button
              onClick={() => setSelectedTab('past')}
              variant={selectedTab === 'past' ? 'primary' : 'ghost'}
              size="sm"
              className="rounded-md flex-1 sm:flex-none min-h-[40px] touch-manipulation"
            >
              Past
            </Button>
          </div>
        </div>
      }
    >
      <Toaster position="top-right" />
      
      {/* Mostrar alerta cuando hay un viaje activo */}
      {activeTripInfo && (
        <Alert 
          type="success" 
          className="mb-6"
          title="Viaje activo"
          message={`${activeTripInfo.planned_trip_id && trips.find(t => t.id === activeTripInfo.planned_trip_id)?.name || "Viaje sin nombre"}`}
          action={
            <Button
              onClick={() => {
                if (window.confirm('¿Estás seguro de que quieres detener el viaje actual? Se finalizará la grabación.')) {
                  fetch('/api/trips/end', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  })
                  .then(response => response.json())
                  .then(data => {
                    if (data.status === 'success') {
                      alert('¡Viaje finalizado! La grabación se ha detenido.');
                      setActiveTripInfo(null);
                      checkActiveTrip();
                    } else {
                      alert('Error al detener el viaje: ' + (data.detail || 'Error desconocido'));
                    }
                  })
                  .catch(error => {
                    console.error('Error al detener el viaje:', error);
                    alert('Error al detener el viaje. Consulta la consola para más detalles.');
                  });
                }
              }}
              variant="danger"
              size="sm"
            >
              <FaStop className="mr-1" /> Detener viaje
            </Button>
          }
        />
      )}
      
      {/* Trip Form Modal */}
      <TripFormModal
        isOpen={showFormModal}
        onClose={handleCancelForm}
        initialData={editingTrip}
        onSubmit={editingTrip ? handleUpdateTrip : handleCreateTrip}
      />
      
      <div className="lg:grid lg:grid-cols-5 lg:gap-6">
        {/* Trip Cards - Full width on mobile, 3/5 on desktop */}
        <div className="lg:col-span-3">
          {loading ? (
            <Card>
              <Flex justify="center" align="center" className="py-12">
                <Stack align="center" space="sm">
                  <Spinner size="lg" />
                  <p className="text-gray-600">Loading trips...</p>
                </Stack>
              </Flex>
            </Card>
          ) : filteredTrips.length === 0 ? (
            <Card>
              <Flex justify="center" align="center" className="py-12">
                <Stack align="center" space="sm" className="text-center">
                  <FaRoute className="w-12 h-12 text-gray-400" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-600">No {selectedTab} trips found</h3>
                    <p className="text-gray-500 mt-1">
                      {selectedTab === 'upcoming' 
                        ? 'Plan your first trip to prepare for your journey' 
                        : 'Your past trips will appear here'}
                    </p>
                  </div>
                  {selectedTab === 'upcoming' && (
                    <Button
                      onClick={() => {
                        setShowFormModal(true);
                        setEditingTrip(null);
                      }}
                      variant="primary"
                      className="min-h-[44px] touch-manipulation"
                    >
                      Plan a Trip
                    </Button>
                  )}
                </Stack>
              </Flex>
            </Card>
          ) : (
            <Grid cols={1} gap="md" className="xl:grid-cols-2">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onSelect={(trip) => {
                    setSelectedTripForPreview(trip);
                    // On mobile, show the map drawer when a trip is selected
                    if (window.innerWidth < 1024) {
                      openMapDrawer();
                    }
                  }}
                  onDelete={handleDeleteTrip}
                  onDownloadLandmarks={handleDownloadLandmarks}
                  onDownloadGeodata={handleDownloadGeodata}
                  onDownloadBoth={handleDownloadBoth}
                  onStartNavigation={startNavigation}
                  onEdit={handleEditTrip}
                  onManageLandmarks={manageTripLandmarks}
                  onManageActualTrips={manageActualTrips}
                  onImportLandmarksFromKml={handleImportLandmarksFile}
                  onCancelDownload={handleCancelDownload}
                  isSelected={selectedTripForPreview?.id === trip.id}
                  downloadingTrip={downloadingTrip}
                  downloadProgress={downloadingTrip === trip.id ? downloadProgress : null}
                  isActiveTripId={activeTripInfo && activeTripInfo.planned_trip_id === trip.id}
                  geodataStats={geodataStats[trip.id]}
                />
              ))}
            </Grid>
          )}
        </div>
        
        {/* Desktop Map preview panel - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-4">
            <div className="bg-primary-600 text-white p-3 sm:p-4">
              <h3 className="text-base sm:text-lg font-semibold">Trip Preview</h3>
            </div>
            
            {/* Proporción más grande 3:2 para mejor visualización */}
            <div className="aspect-[3/2]">
              <TripMapPreview
                trip={selectedTripForPreview}
                onStartNavigation={startNavigation}
                isUpcoming={selectedTab === 'upcoming'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Map Drawer - Only visible on mobile */}
      <MobileMapDrawer
        selectedTrip={selectedTripForPreview}
        isOpen={showMapDrawer}
        onClose={() => setShowMapDrawer(false)}
        onOpen={openMapDrawer}
        mapKey={mapKey}
        selectedTab={selectedTab}
        onStartNavigation={startNavigation}
        onManageLandmarks={manageTripLandmarks}
      />

      {/* Modal para previsualizar landmarks desde KML/KMZ */}
      {isImportingLandmarks && kmlPlacemarks.length > 0 && (
        <KmlPreview
          points={kmlPlacemarks}
          onClose={cancelLandmarksImport}
          onConfirm={confirmLandmarksImport}
          type="landmarks"
        />
      )}

      {/* Download Estimate Modal */}
      <DownloadEstimateModal
        tripId={estimateModalTripId}
        isOpen={showEstimateModal}
        onClose={cancelEstimate}
        onConfirm={confirmDownload}
        downloadType={estimateModalType}
      />
    </PageLayout>
    </div>
  );
};

export default TripPlanner;