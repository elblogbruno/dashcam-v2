import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FaMapMarkerAlt, FaSearch, FaPlus, FaTrash, FaRoute, FaDownload, FaArrowLeft, FaSpinner } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { fetchAllLandmarks, searchLandmarks, addLandmark, deleteLandmark } from '../services/landmarkService';
import { fetchTrips } from '../services/tripService';
import { searchPlaces } from '../services/tripService'; // Import place search service
import LandmarkSettings from '../components/LandmarkManager/LandmarkSettings'; // Import the settings component

// Fix Leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Estilos globales para asegurar que los popups aparezcan sobre el mapa
// const globalStyles = `
//   .leaflet-container {
//     z-index: 1;
//   }
//   .landmark-settings-popup {
//     z-index: 1000 !important;
//   }
// `;

// // Fix para el estilo global
// const GlobalStyle = () => {
//   useEffect(() => {
//     // Crear y agregar estilos globales
//     const styleEl = document.createElement('style');
//     styleEl.innerHTML = globalStyles;
//     document.head.appendChild(styleEl);
    
//     return () => {
//       // Limpieza al desmontar
//       document.head.removeChild(styleEl);
//     };
//   }, []);
  
//   return null;
// };

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Create colored marker icon
const createColoredIcon = (color) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

// Create MapController to programmatically control the map
const MapController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
};

const LandmarksManager = () => {
  const [landmarks, setLandmarks] = useState([]);
  const [filteredLandmarks, setFilteredLandmarks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLandmark, setNewLandmark] = useState({
    name: '',
    lat: '',
    lon: '',
    radius_m: 100,
    category: '',
    description: ''
  });
  const [mapCenter, setMapCenter] = useState([34.0522, -118.2437]); // Default to LA
  const [mapZoom, setMapZoom] = useState(5);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState([]);
  const [specificTripFilter, setSpecificTripFilter] = useState(null);
  const [landmarkCount, setLandmarkCount] = useState(0);

  // Fetch landmarks and trips on component mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [landmarksData, tripsData] = await Promise.all([
          fetchAllLandmarks(),
          fetchTrips()
        ]);

        setLandmarks(landmarksData);
        setFilteredLandmarks(landmarksData);
        setTrips(tripsData);
        
        // Check if we have a specific trip to filter by from localStorage
        const selectedTripData = localStorage.getItem('selectedTripForLandmarks');
        if (selectedTripData) {
          try {
            const selectedTrip = JSON.parse(selectedTripData);
            const matchingTrip = tripsData.find(trip => trip.id === selectedTrip.id);
            
            if (matchingTrip) {
              setSpecificTripFilter(selectedTrip);
              setSelectedTrip(matchingTrip);
              
              // Obtener landmarks específicos para este viaje usando el endpoint dedicado
              const tripLandmarks = await fetch(`/api/landmarks/by-trip/${selectedTrip.id}`)
                .then(res => res.json());
              
              setFilteredLandmarks(tripLandmarks);
              
              // Set page title to include trip name
              document.title = `Landmarks for ${selectedTrip.name} - Smart Dashcam`;
              
              // Clear the localStorage item
              localStorage.removeItem('selectedTripForLandmarks');
            }
          } catch (e) {
            console.error('Error parsing selected trip data:', e);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load landmarks data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    
    // Reset title when component unmounts
    return () => {
      document.title = 'Smart Dashcam';
    };
  }, []);

  // Filter landmarks when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If no search query or trip filter, show all landmarks
      if (!selectedTrip) {
        setFilteredLandmarks(landmarks);
      } else {
        // Obtener landmarks para el viaje seleccionado usando el endpoint específico
        const fetchTripLandmarks = async () => {
          try {
            setLoading(true);
            const tripLandmarks = await fetch(`/api/landmarks/by-trip/${selectedTrip.id}`)
              .then(res => res.json());
            setFilteredLandmarks(tripLandmarks);
          } catch (error) {
            console.error('Error fetching trip landmarks:', error);
            toast.error('Failed to load trip landmarks');
            // Fallback a filtrado en cliente
            const tripId = selectedTrip.id;
            const tripLandmarks = landmarks.filter(landmark => 
              landmark.trip_id === tripId || landmark.id?.includes(`trip_${tripId}_`)
            );
            setFilteredLandmarks(tripLandmarks);
          } finally {
            setLoading(false);
          }
        };
        
        fetchTripLandmarks();
      }
    } else {
      // If there's a search query, filter by it
      const filtered = landmarks.filter(landmark => {
        const name = landmark.name?.toLowerCase() || '';
        const category = landmark.category?.toLowerCase() || '';
        const description = landmark.description?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        
        const matchesSearch = name.includes(query) || 
                             category.includes(query) || 
                             description.includes(query);
        
        // If a trip is selected, also filter by trip
        if (selectedTrip) {
          const tripId = selectedTrip.id;
          return matchesSearch && (landmark.trip_id === tripId || landmark.id?.includes(`trip_${tripId}_`));
        }
        
        return matchesSearch;
      });
      setFilteredLandmarks(filtered);
    }
  }, [searchQuery, landmarks, selectedTrip]);

  // Update landmark count whenever filtered landmarks change
  useEffect(() => {
    setLandmarkCount(filteredLandmarks.length);
  }, [filteredLandmarks]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle trip filter change - Actualizar para usar el endpoint específico
  const handleTripFilterChange = (trip) => {
    if (trip === selectedTrip) {
      setSelectedTrip(null);
      setFilteredLandmarks(landmarks); // Mostrar todos los landmarks
    } else {
      setSelectedTrip(trip);
      
      // Obtener landmarks específicos para este viaje
      const fetchTripLandmarks = async () => {
        try {
          setLoading(true);
          const tripLandmarks = await fetch(`/api/landmarks/by-trip/${trip.id}`)
            .then(res => res.json());
          setFilteredLandmarks(tripLandmarks);
        } catch (error) {
          console.error('Error fetching trip landmarks:', error);
          toast.error('Failed to load trip landmarks');
          // Fallback a filtrado en cliente
          const tripId = trip.id;
          const tripLandmarks = landmarks.filter(landmark => 
            landmark.trip_id === tripId || landmark.id?.includes(`trip_${tripId}_`)
          );
          setFilteredLandmarks(tripLandmarks);
        } finally {
          setLoading(false);
        }
      };
      
      fetchTripLandmarks();
    }
  };

  // Handle selecting a landmark on the map
  const handleSelectLandmark = (landmark) => {
    setSelectedLandmark(landmark);
    setMapCenter([landmark.lat, landmark.lon]);
    setMapZoom(13);
  };

  // Handle add new landmark form submission
  const handleAddLandmark = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!newLandmark.name || !newLandmark.lat || !newLandmark.lon) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      const landmarkData = {
        ...newLandmark,
        lat: parseFloat(newLandmark.lat),
        lon: parseFloat(newLandmark.lon),
        radius_m: parseInt(newLandmark.radius_m)
      };
      
      await addLandmark(landmarkData);
      toast.success('Landmark added successfully');
      
      // Reset form and refresh landmarks
      setNewLandmark({
        name: '',
        lat: '',
        lon: '',
        radius_m: 100,
        category: '',
        description: ''
      });
      setShowAddForm(false);
      
      // Refresh landmarks
      const updatedLandmarks = await fetchAllLandmarks();
      setLandmarks(updatedLandmarks);
      
    } catch (error) {
      toast.error('Failed to add landmark');
    }
  };

  // Handle landmark deletion
  const handleDeleteLandmark = async (id) => {
    if (window.confirm('Are you sure you want to delete this landmark?')) {
      try {
        await deleteLandmark(id);
        toast.success('Landmark deleted successfully');
        
        // Remove from state
        setLandmarks(landmarks.filter(lm => lm.id !== id));
        if (selectedLandmark && selectedLandmark.id === id) {
          setSelectedLandmark(null);
        }
      } catch (error) {
        toast.error('Failed to delete landmark');
      }
    }
  };

  // Get landmark color based on category
  const getLandmarkColor = (category) => {
    const colors = {
      'natural': '#4caf50',
      'infrastructure': '#2196f3',
      'trip_start': '#9c27b0',
      'trip_waypoint': '#ff9800',
      'trip_end': '#e91e63'
    };
    return colors[category] || '#607d8b';
  };

  // Check if a landmark belongs to the selected trip
  const isLandmarkFromSelectedTrip = (landmark) => {
    if (!selectedTrip) return false;
    return landmark.id?.includes(`trip_${selectedTrip.id}_`);
  };

  // Search for a place by name
  const searchForPlace = async () => {
    if (!placeSearchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }
    
    setSearchingPlace(true);
    try {
      const results = await searchPlaces(placeSearchQuery);
      setPlaceSearchResults(results);
      
      if (results.length === 0) {
        toast.error('No places found with that name');
      }
    } catch (error) {
      console.error('Error searching for places:', error);
      toast.error('Failed to search for places');
    } finally {
      setSearchingPlace(false);
    }
  };

  // Select a place from search results
  const selectPlace = (place) => {
    setNewLandmark({
      ...newLandmark,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      description: place.display_name || ''
    });
    
    // Update map to show the selected location
    setMapCenter([place.lat, place.lon]);
    setMapZoom(13);
    
    // Clear search results
    setPlaceSearchResults([]);
    setPlaceSearchQuery('');
  };

  // Clear specific trip filter
  const clearTripFilter = () => {
    setSpecificTripFilter(null);
    setSelectedTrip(null);
    setFilteredLandmarks(landmarks);
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6">
      <Toaster position="top-right" />
      
      {/* Trip-specific header */}
      {specificTripFilter && (
        <div className="bg-dashcam-700 text-white p-2 sm:p-3 rounded-lg mb-3 sm:mb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-0">
          <div className="flex items-center">
            <FaRoute className="mr-2 flex-shrink-0" />
            <h2 className="font-bold text-sm sm:text-base truncate">Landmarks for: {specificTripFilter.name}</h2>
          </div>
          <button 
            onClick={clearTripFilter}
            className="bg-white text-dashcam-700 px-2 sm:px-3 py-1 rounded-md flex items-center justify-center text-xs sm:text-sm"
          >
            <FaArrowLeft className="mr-1" /> Back to All Landmarks
          </button>
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-6">
        {/* Left sidebar */}
        <div className="lg:w-1/3 xl:w-1/4">
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-3 sm:mb-6">
            <div className="bg-dashcam-700 text-white p-2 sm:p-4 flex justify-between items-center">
              <h2 className="font-bold text-sm sm:text-base flex items-center">
                <FaMapMarkerAlt className="mr-2" /> Landmarks Manager
              </h2>
              <LandmarkSettings />
            </div>
            
            {/* Search */}
            <div className="p-2 sm:p-4">
              <div className="relative mb-3 sm:mb-4">
                <input
                  type="text"
                  placeholder="Search landmarks..."
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 pr-8 sm:pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dashcam-500"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                <FaSearch className="absolute right-3 sm:right-4 top-2 sm:top-3 text-gray-400" />
              </div>
              
              {/* Trip filter - hide if we have a specific trip filter */}
              {!specificTripFilter && (
                <div className="mb-3 sm:mb-4">
                  <h3 className="font-medium text-gray-700 text-xs sm:text-sm mb-1 sm:mb-2">Filter by Trip</h3>
                  <div className="max-h-32 sm:max-h-40 overflow-y-auto">
                    {trips.map(trip => (
                      <div 
                        key={trip.id}
                        className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md cursor-pointer mb-1 text-xs sm:text-sm ${
                          selectedTrip?.id === trip.id 
                            ? 'bg-dashcam-500 text-white' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }`}
                        onClick={() => handleTripFilterChange(trip)}
                      >
                        <FaRoute className="inline-block mr-1 sm:mr-2" />
                        <span className="truncate">{trip.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add landmark button */}
              <div className="flex gap-2">
                <button
                  className="flex-1 bg-dashcam-600 hover:bg-dashcam-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md flex items-center justify-center text-xs sm:text-sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  <FaPlus className="mr-1 sm:mr-2" />
                  {showAddForm ? 'Cancel' : 'Add New Landmark'}
                </button>
              </div>
              
              {/* Performance warning */}
              {landmarkCount > 150 && (
                <div className="mt-2 sm:mt-3 p-1.5 sm:p-2 bg-yellow-50 border border-yellow-200 rounded text-xs sm:text-sm text-yellow-700">
                  You have {landmarkCount} landmarks displayed, which might impact performance. Use the settings to limit the number of automatically downloaded landmarks.
                </div>
              )}
            </div>
            
            {/* Add landmark form */}
            {showAddForm && (
              <form className="p-2 sm:p-4 border-t" onSubmit={handleAddLandmark}>
                <h3 className="font-medium text-gray-700 text-xs sm:text-sm mb-2 sm:mb-3">Add New Landmark</h3>
                
                {/* Place search */}
                <div className="mb-2 sm:mb-4">
                  <label className="block text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Search for a place</label>
                  <div className="flex gap-1 sm:gap-2">
                    <input
                      type="text"
                      className="flex-grow px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm"
                      placeholder="Search for a place..."
                      value={placeSearchQuery}
                      onChange={(e) => setPlaceSearchQuery(e.target.value)}
                    />
                    <button
                      type="button"
                      className="px-2 sm:px-3 py-1 sm:py-2 bg-gray-100 hover:bg-gray-200 border rounded-md flex items-center"
                      onClick={searchForPlace}
                      disabled={searchingPlace}
                    >
                      {searchingPlace ? (
                        <FaSpinner className="animate-spin" />
                      ) : (
                        <FaSearch />
                      )}
                    </button>
                  </div>
                  
                  {/* Place search results */}
                  {placeSearchResults.length > 0 && (
                    <div className="mt-1 sm:mt-2 border rounded-md overflow-hidden max-h-32 sm:max-h-40 overflow-y-auto">
                      {placeSearchResults.map((place, index) => (
                        <div 
                          key={index} 
                          className="p-1.5 sm:p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                          onClick={() => selectPlace(place)}
                        >
                          <div className="font-medium text-xs sm:text-sm">{place.name}</div>
                          <div className="text-xs text-gray-600 truncate">{place.display_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="mb-2 sm:mb-3">
                  <label className="block text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Name*</label>
                  <input
                    type="text"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm"
                    value={newLandmark.name}
                    onChange={e => setNewLandmark({...newLandmark, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Latitude*</label>
                    <input
                      type="number"
                      step="any"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm"
                      value={newLandmark.lat}
                      onChange={e => setNewLandmark({...newLandmark, lat: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Longitude*</label>
                    <input
                      type="number"
                      step="any"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm"
                      value={newLandmark.lon}
                      onChange={e => setNewLandmark({...newLandmark, lon: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Radius (m)</label>
                    <input
                      type="number"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm"
                      value={newLandmark.radius_m}
                      onChange={e => setNewLandmark({...newLandmark, radius_m: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Category</label>
                    <select
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm"
                      value={newLandmark.category}
                      onChange={e => setNewLandmark({...newLandmark, category: e.target.value})}
                    >
                      <option value="">Select category</option>
                      <option value="natural">Natural</option>
                      <option value="infrastructure">Infrastructure</option>
                      <option value="gas_station">Gas Station</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="hotel">Hotel</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
                
                <div className="mb-2 sm:mb-3">
                  <label className="block text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Description</label>
                  <textarea
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md text-xs sm:text-sm"
                    rows="2"
                    value={newLandmark.description}
                    onChange={e => setNewLandmark({...newLandmark, description: e.target.value})}
                  ></textarea>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm"
                >
                  Save Landmark
                </button>
              </form>
            )}
          </div>
          
          {/* Landmarks list */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-dashcam-700 text-white p-2 sm:p-4">
              <h2 className="font-bold text-sm sm:text-base">
                {filteredLandmarks.length} {filteredLandmarks.length === 1 ? 'Landmark' : 'Landmarks'} Found
              </h2>
            </div>
            
            <div className="overflow-y-auto max-h-64 sm:max-h-96">
              {loading ? (
                <div className="text-center py-4 sm:py-8">
                  <div className="animate-spin h-6 w-6 sm:h-8 sm:w-8 border-3 sm:border-4 border-dashcam-500 border-t-transparent rounded-full mx-auto"></div>
                  <p className="mt-2 text-gray-600 text-xs sm:text-sm">Loading landmarks...</p>
                </div>
              ) : filteredLandmarks.length === 0 ? (
                <div className="text-center py-4 sm:py-8 text-gray-500 text-xs sm:text-sm">
                  No landmarks found matching your criteria
                </div>
              ) : (
                <ul>
                  {filteredLandmarks.map(landmark => (
                    <li 
                      key={landmark.id} 
                      className={`p-2 sm:p-3 border-b cursor-pointer hover:bg-gray-50 ${selectedLandmark?.id === landmark.id ? 'bg-gray-100' : ''}`}
                      onClick={() => handleSelectLandmark(landmark)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-xs sm:text-sm">{landmark.name}</h3>
                          <div className="flex items-center text-xs text-gray-500">
                            <span className={`inline-block w-2 h-2 sm:w-3 sm:h-3 rounded-full mr-1`} style={{ backgroundColor: getLandmarkColor(landmark.category) }}></span>
                            <span className="capitalize">{landmark.category || 'Unknown'}</span>
                          </div>
                          {landmark.description && (
                            <p className="text-xs text-gray-600 mt-0.5 sm:mt-1 line-clamp-1">{landmark.description}</p>
                          )}
                        </div>
                        <button
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete landmark"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLandmark(landmark.id);
                          }}
                        >
                          <FaTrash size={12} className="sm:text-sm" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        
        {/* Map area */}
        <div className="lg:w-2/3 xl:w-3/4 h-[350px] sm:h-[450px] md:h-[500px] lg:h-[600px] bg-white rounded-lg shadow-md overflow-hidden">
          <MapContainer 
            center={mapCenter} 
            zoom={mapZoom} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={window.innerWidth > 640} // Ocultar controles de zoom en móviles
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Controller to update map view */}
            <MapController center={mapCenter} zoom={mapZoom} />
            
            {/* Display landmarks on the map */}
            {filteredLandmarks.map(landmark => (
              <React.Fragment key={landmark.id}>
                <Circle
                  center={[landmark.lat, landmark.lon]}
                  radius={landmark.radius_m || 100}
                  pathOptions={{ 
                    color: getLandmarkColor(landmark.category),
                    fillColor: getLandmarkColor(landmark.category),
                    fillOpacity: 0.2 
                  }}
                />
                <Marker 
                  position={[landmark.lat, landmark.lon]} 
                  icon={createColoredIcon(getLandmarkColor(landmark.category))}
                >
                  <Popup>
                    <div className="text-center">
                      <h3 className="font-bold text-sm sm:text-base">{landmark.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {landmark.category || 'Unknown'} • {landmark.radius_m || 100}m radius
                      </p>
                      {landmark.description && (
                        <p className="text-xs sm:text-sm mt-1">{landmark.description}</p>
                      )}
                      <div className="flex justify-center mt-1 sm:mt-2">
                        <button
                          className="text-red-500 hover:text-red-700 px-1 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-sm"
                          onClick={() => handleDeleteLandmark(landmark.id)}
                        >
                          <FaTrash className="inline-block mr-1" /> Delete
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default LandmarksManager;