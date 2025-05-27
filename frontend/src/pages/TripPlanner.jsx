import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FaRoute, FaPlus, FaMapMarkerAlt, FaStop, FaFileImport } from 'react-icons/fa';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Import custom components
import TripForm from '../components/TripPlanner/TripForm';
import TripCard from '../components/TripPlanner/TripCard';
import TripMapPreview from '../components/TripPlanner/TripMapPreview';
import KmlPreview from '../components/TripPlanner/KmlPreview';

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
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTrip, setDownloadingTrip] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [selectedTripForPreview, setSelectedTripForPreview] = useState(null);
  const [selectedTab, setSelectedTab] = useState('upcoming'); // 'upcoming' or 'past'
  const [editingTrip, setEditingTrip] = useState(null);
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
  }, []);
  
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
      setShowForm(false);
      
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
    setDownloadingTrip(tripId);
    setDownloadProgress(0);
    
    try {
      // Use our new simplified landmark service for downloading
      // Las notificaciones ahora se gestionan directamente en el servicio
      await downloadTripLandmarks(tripId, (progress, detail) => {
        setDownloadProgress(progress);
        // Ya no necesitamos mostrar toasts aquí, lo hace el servicio
      });
      
      // Mark the trip as having landmarks downloaded
      setTrips(trips.map(trip => {
        if (trip.id === tripId) {
          return { ...trip, landmarks_downloaded: true };
        }
        return trip;
      }));
      
      // Refresh trips from server to get updated landmark count
      fetchTrips();
    } catch (error) {
      console.error('Error downloading landmarks:', error);
      // No necesitamos mostrar el error aquí, ya lo hace el servicio
    } finally {
      setDownloadingTrip(null);
      setDownloadProgress(null);
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
    setShowForm(true);
  };
  
  const handleCancelForm = () => {
    setShowForm(false);
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

  return (
    <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6">
      <Toaster position="top-right" />
      
      {/* Mostrar alerta cuando hay un viaje activo */}
      {activeTripInfo && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-4 h-4 mr-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <p className="font-medium">
              <span className="font-bold">Viaje activo:</span> 
              {activeTripInfo.planned_trip_id && trips.find(t => t.id === activeTripInfo.planned_trip_id)?.name || "Viaje sin nombre"}
            </p>
          </div>
          <button
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
                    checkActiveTrip(); // Actualizar el estado
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
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
          >
            <FaStop className="mr-1" /> Detener viaje
          </button>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <h1 className="text-xl sm:text-2xl font-bold text-dashcam-800 flex items-center">
          <FaRoute className="mr-2" />
          Trip Planner
        </h1>
        
        <div className="flex flex-wrap gap-2">
          {/* Add Landmarks Manager button */}
          <button
            onClick={navigateToLandmarksManager}
            className="bg-green-600 hover:bg-green-700 text-white py-1 sm:py-2 px-3 sm:px-4 rounded-md flex items-center text-sm sm:text-base"
          >
            <FaMapMarkerAlt className="mr-1" /> Landmarks
          </button>
          
          <div className="bg-white rounded-lg shadow p-1 flex">
            <button
              onClick={() => setSelectedTab('upcoming')}
              className={`px-2 sm:px-4 py-1 sm:py-2 rounded-md text-sm sm:text-base ${selectedTab === 'upcoming' ? 'bg-dashcam-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setSelectedTab('past')}
              className={`px-2 sm:px-4 py-1 sm:py-2 rounded-md text-sm sm:text-base ${selectedTab === 'past' ? 'bg-dashcam-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Past
            </button>
          </div>
          
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) setEditingTrip(null);
            }}
            className="bg-dashcam-600 hover:bg-dashcam-700 text-white py-1 sm:py-2 px-3 sm:px-4 rounded-md flex items-center text-sm sm:text-base"
            disabled={editingTrip !== null}
          >
            {showForm && !editingTrip ? 'Cancel' : <>
              <FaPlus className="mr-1" /> Plan Trip
            </>}
          </button>
        </div>
      </div>
      
      {showForm && (
        <TripForm
          initialData={editingTrip}
          onSubmit={editingTrip ? handleUpdateTrip : handleCreateTrip}
          onCancel={handleCancelForm}
        />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-6 sm:py-10 bg-white rounded-lg shadow-md">
              <div className="animate-spin h-8 w-8 sm:h-10 sm:w-10 border-4 border-dashcam-500 border-t-transparent rounded-full mx-auto mb-3 sm:mb-4"></div>
              <p className="text-gray-600 text-sm sm:text-base">Loading trips...</p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-6 sm:py-10 bg-white rounded-lg shadow-md">
              <h3 className="text-lg sm:text-xl font-medium text-gray-600">No {selectedTab} trips found</h3>
              <p className="text-sm sm:text-base text-gray-500 mt-2">
                {selectedTab === 'upcoming' 
                  ? 'Plan your first trip to prepare for your journey' 
                  : 'Your past trips will appear here'}
              </p>
              {selectedTab === 'upcoming' && (
                <button
                  onClick={() => {
                    setShowForm(true);
                    setEditingTrip(null);
                  }}
                  className="mt-4 bg-dashcam-600 hover:bg-dashcam-700 text-white py-1 sm:py-2 px-3 sm:px-4 rounded-md text-sm sm:text-base"
                >
                  Plan a Trip
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onSelect={setSelectedTripForPreview}
                  onDelete={handleDeleteTrip}
                  onDownloadLandmarks={handleDownloadLandmarks}
                  onStartNavigation={startNavigation}
                  onEdit={handleEditTrip}
                  onManageLandmarks={manageTripLandmarks}
                  onImportLandmarksFromKml={handleImportLandmarksFile}
                  isSelected={selectedTripForPreview?.id === trip.id}
                  downloadingTrip={downloadingTrip}
                  downloadProgress={downloadingTrip === trip.id ? downloadProgress : null}
                  isActiveTripId={activeTripInfo && activeTripInfo.planned_trip_id === trip.id}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Map preview panel */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-dashcam-700 text-white p-3 sm:p-4">
            <h3 className="text-base sm:text-lg font-semibold">Trip Preview</h3>
          </div>
          
          <div className="h-[450px] sm:h-[500px] md:h-[550px] lg:h-[600px]">
            <TripMapPreview
              trip={selectedTripForPreview}
              onStartNavigation={startNavigation}
              isUpcoming={selectedTab === 'upcoming'}
            />
          </div>
        </div>
      </div>

      {/* Modal para previsualizar landmarks desde KML/KMZ */}
      {isImportingLandmarks && kmlPlacemarks.length > 0 && (
        <KmlPreview
          points={kmlPlacemarks}
          onClose={cancelLandmarksImport}
          onConfirm={confirmLandmarksImport}
          type="landmarks"
        />
      )}
    </div>
  );
};

export default TripPlanner;