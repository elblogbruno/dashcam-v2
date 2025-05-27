import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaMapMarkerAlt, FaCalendarAlt, FaPlus, FaTrash, FaSearch, FaSpinner, FaArrowUp, FaArrowDown, FaEdit, FaFileImport } from 'react-icons/fa';
import axios from 'axios';

// Importamos el nuevo componente y servicio
import KmlPreview from './KmlPreview';
import { uploadKmlFile } from '../../services/kmlService';

const TripForm = ({ initialData, onSubmit, onCancel }) => {
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLon, setStartLon] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLon, setEndLon] = useState('');
  const [notes, setNotes] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [newWaypoint, setNewWaypoint] = useState({ lat: '', lon: '', name: '' });
  const [editingWaypointIndex, setEditingWaypointIndex] = useState(-1);
  
  // Estados para la importación de KML/KMZ
  const [isImportingKml, setIsImportingKml] = useState(false);
  const [kmlWaypoints, setKmlWaypoints] = useState([]);
  const [isLoadingKml, setIsLoadingKml] = useState(false);
  
  // State for location search
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);
  const [isSearchingWaypoint, setIsSearchingWaypoint] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchType, setLastSearchType] = useState(null);
  const [originName, setOriginName] = useState('');
  const [destinationName, setDestinationName] = useState('');

  useEffect(() => {
    // If there's initial data (editing mode), populate the form
    if (initialData) {
      setTripName(initialData.name || '');
      setStartDate(initialData.start_date ? initialData.start_date.split(' ')[0] : '');
      setEndDate(initialData.end_date ? initialData.end_date.split(' ')[0] : '');
      
      if (initialData.start_location) {
        setStartLat(initialData.start_location.lat || '');
        setStartLon(initialData.start_location.lon || '');
        setOriginName(initialData.start_location.name || '');
      }
      
      if (initialData.end_location) {
        setEndLat(initialData.end_location.lat || '');
        setEndLon(initialData.end_location.lon || '');
        setDestinationName(initialData.end_location.name || '');
      }
      
      setNotes(initialData.notes || '');
      
      if (initialData.waypoints && initialData.waypoints.length > 0) {
        // Ensure waypoints have names
        const namedWaypoints = initialData.waypoints.map((wp, index) => ({
          ...wp,
          name: wp.name || `Waypoint ${index + 1}`
        }));
        setWaypoints(namedWaypoints);
      } else {
        setWaypoints([]);
      }
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Format dates as expected by the backend - "YYYY-MM-DD HH:MM:SS"
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;
    
    const tripData = {
      name: tripName,
      start_location: {
        lat: parseFloat(startLat),
        lon: parseFloat(startLon),
        name: originName || 'Origin'
      },
      end_location: {
        lat: parseFloat(endLat),
        lon: parseFloat(endLon),
        name: destinationName || 'Destination'
      },
      start_date: startDate,
      end_date: endDate,
      start_time: formattedStartDate,
      end_time: formattedEndDate,
      notes: notes,
      waypoints: waypoints.map((wp, index) => ({
        lat: parseFloat(wp.lat),
        lon: parseFloat(wp.lon),
        name: wp.name || `Waypoint ${index + 1}`
      }))
    };
    
    // If editing, include the trip ID
    if (initialData && initialData.id) {
      tripData.id = initialData.id;
    }
    
    onSubmit(tripData);
  };

  // Function to get user's current location
  const getCurrentLocation = (setter) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (setter === 'start') {
            setStartLat(position.coords.latitude);
            setStartLon(position.coords.longitude);
          } else if (setter === 'end') {
            setEndLat(position.coords.latitude);
            setEndLon(position.coords.longitude);
          } else if (setter === 'waypoint') {
            setNewWaypoint({
              ...newWaypoint,
              lat: position.coords.latitude,
              lon: position.coords.longitude
            });
          }
          toast.success('Location set');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Could not get your location');
        }
      );
    } else {
      toast.error('Geolocation is not supported by this browser');
    }
  };
  
  // Function to search for places
  const searchPlaces = async (query, searchType) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setLastSearchType(searchType);
    
    try {
      const response = await axios.post('/api/trip-planner/search-places', {
        query: query,
        limit: 5
      });
      
      setSearchResults(response.data.results);
    } catch (error) {
      console.error('Error searching for places:', error);
      toast.error('Failed to search for places');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Function to select a place from search results
  const selectPlace = (place, locationType) => {
    if (locationType === 'start') {
      setStartLat(place.lat);
      setStartLon(place.lon);
      setOriginName(place.name || place.display_name.split(',')[0]);
      setIsSearchingStart(false);
    } else if (locationType === 'end') {
      setEndLat(place.lat);
      setEndLon(place.lon);
      setDestinationName(place.name || place.display_name.split(',')[0]);
      setIsSearchingEnd(false);
    } else if (locationType === 'waypoint') {
      setNewWaypoint({
        lat: place.lat,
        lon: place.lon,
        name: place.name || place.display_name.split(',')[0]
      });
      setIsSearchingWaypoint(false);
    }
    
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`Location set: ${place.name || place.display_name}`);
  };
  
  const addWaypoint = () => {
    if (newWaypoint.lat && newWaypoint.lon) {
      const waypointToAdd = {
        ...newWaypoint,
        name: newWaypoint.name || `Waypoint ${waypoints.length + 1}`
      };
      
      if (editingWaypointIndex >= 0) {
        // Update existing waypoint
        const updatedWaypoints = [...waypoints];
        updatedWaypoints[editingWaypointIndex] = waypointToAdd;
        setWaypoints(updatedWaypoints);
        setEditingWaypointIndex(-1);
        toast.success('Waypoint updated');
      } else {
        // Add new waypoint
        setWaypoints([...waypoints, waypointToAdd]);
        toast.success('Waypoint added');
      }
      
      setNewWaypoint({ lat: '', lon: '', name: '' });
    } else {
      toast.error('Please enter both latitude and longitude');
    }
  };
  
  const editWaypoint = (index) => {
    setNewWaypoint({...waypoints[index]});
    setEditingWaypointIndex(index);
    // Scroll to the waypoint input fields
    document.getElementById('waypoint-inputs')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };
  
  // Función para manejar la subida de archivos KML/KMZ
  const handleKmlFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Verificar que es un archivo KML o KMZ
    const validExtensions = ['kml', 'kmz'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Por favor, sube un archivo KML o KMZ válido');
      return;
    }
    
    setIsLoadingKml(true);
    
    try {
      // Subir el archivo y recibir los puntos
      const result = await uploadKmlFile(file);
      
      if (result && result.waypoints && result.waypoints.length > 0) {
        setKmlWaypoints(result.waypoints);
        setIsImportingKml(true);
        toast.success(`Se encontraron ${result.waypoints.length} puntos en el archivo`);
      } else {
        toast.error('No se encontraron puntos en el archivo');
      }
    } catch (error) {
      console.error('Error uploading KML file:', error);
      toast.error(`Error al procesar el archivo: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsLoadingKml(false);
      // Limpiar el input de archivo para permitir subir el mismo archivo de nuevo
      event.target.value = null;
    }
  };
  
  // Función para cancelar la importación de KML
  const cancelKmlImport = () => {
    setIsImportingKml(false);
    setKmlWaypoints([]);
  };
  
  // Función para confirmar puntos seleccionados del KML
  const confirmKmlImport = (selectedWaypoints) => {
    if (selectedWaypoints && selectedWaypoints.length > 0) {
      // Añadir los nuevos puntos a los existentes
      setWaypoints([...waypoints, ...selectedWaypoints]);
      toast.success(`Se han añadido ${selectedWaypoints.length} puntos al viaje`);
    }
    
    // Cerrar la vista de previsualización
    setIsImportingKml(false);
    setKmlWaypoints([]);
  };
  
  const cancelEditingWaypoint = () => {
    setNewWaypoint({ lat: '', lon: '', name: '' });
    setEditingWaypointIndex(-1);
  };
  
  const removeWaypoint = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
    
    // If we're currently editing this waypoint, cancel the edit
    if (editingWaypointIndex === index) {
      cancelEditingWaypoint();
    } else if (editingWaypointIndex > index) {
      // If we're editing a waypoint after the one being removed, adjust the index
      setEditingWaypointIndex(editingWaypointIndex - 1);
    }
  };

  const moveWaypointUp = (index) => {
    if (index > 0) {
      const updatedWaypoints = [...waypoints];
      const temp = updatedWaypoints[index];
      updatedWaypoints[index] = updatedWaypoints[index - 1];
      updatedWaypoints[index - 1] = temp;
      setWaypoints(updatedWaypoints);
      
      // Adjust editing index if needed
      if (editingWaypointIndex === index) {
        setEditingWaypointIndex(index - 1);
      } else if (editingWaypointIndex === index - 1) {
        setEditingWaypointIndex(index);
      }
    }
  };

  const moveWaypointDown = (index) => {
    if (index < waypoints.length - 1) {
      const updatedWaypoints = [...waypoints];
      const temp = updatedWaypoints[index];
      updatedWaypoints[index] = updatedWaypoints[index + 1];
      updatedWaypoints[index + 1] = temp;
      setWaypoints(updatedWaypoints);
      
      // Adjust editing index if needed
      if (editingWaypointIndex === index) {
        setEditingWaypointIndex(index + 1);
      } else if (editingWaypointIndex === index + 1) {
        setEditingWaypointIndex(index);
      }
    }
  };

  const updateWaypointName = (index, name) => {
    const updatedWaypoints = [...waypoints];
    updatedWaypoints[index] = {
      ...updatedWaypoints[index],
      name: name
    };
    setWaypoints(updatedWaypoints);
  };

  const updateWaypointCoord = (index, key, value) => {
    const updatedWaypoints = [...waypoints];
    updatedWaypoints[index] = {
      ...updatedWaypoints[index],
      [key]: value
    };
    setWaypoints(updatedWaypoints);
  };

  return (
    <div className="bg-white shadow-md rounded-lg mb-4 sm:mb-8 overflow-hidden">
      <div className="bg-dashcam-700 text-white p-3 sm:p-4">
        <h2 className="text-lg sm:text-xl font-semibold">
          {initialData ? 'Edit Trip' : 'Plan a New Trip'}
        </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="p-3 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-gray-700 mb-1 sm:mb-2 text-sm sm:text-base font-medium">Trip Name</label>
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
              required
              placeholder="Adventure to Grand Canyon"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div>
              <label className="block text-gray-700 mb-1 sm:mb-2 text-sm sm:text-base font-medium flex items-center">
                <FaCalendarAlt className="mr-1 text-dashcam-600" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1 sm:mb-2 text-sm sm:text-base font-medium flex items-center">
                <FaCalendarAlt className="mr-1 text-dashcam-600" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                required
              />
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-gray-700 mb-1 sm:mb-2 text-sm sm:text-base font-medium flex items-center">
              <FaMapMarkerAlt className="mr-1 text-dashcam-600" />
              Start Location
            </label>
            
            <div className="mb-2">
              <label className="block text-gray-700 text-xs sm:text-sm mb-0.5 sm:mb-1">Location Name</label>
              <input
                type="text"
                value={originName}
                onChange={(e) => setOriginName(e.target.value)}
                className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                placeholder="Origin Name (e.g. Home, Office)"
              />
            </div>
            
            {isSearchingStart ? (
              <div className="mb-3">
                <div className="flex mb-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-l-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    placeholder="Search for a location..."
                  />
                  <button
                    type="button"
                    onClick={() => searchPlaces(searchQuery, 'start')}
                    disabled={isSearching}
                    className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-1.5 sm:p-2 rounded-r-md flex items-center"
                  >
                    {isSearching && lastSearchType === 'start' ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaSearch />
                    )}
                  </button>
                </div>
                
                {searchResults.length > 0 && lastSearchType === 'start' && (
                  <div className="border border-gray-200 rounded-md max-h-48 sm:max-h-60 overflow-y-auto bg-white shadow-md">
                    {searchResults.map((place, index) => (
                      <div 
                        key={index}
                        className="p-1.5 sm:p-2 border-b border-gray-100 hover:bg-dashcam-50 cursor-pointer"
                        onClick={() => selectPlace(place, 'start')}
                      >
                        <div className="font-medium text-sm sm:text-base">{place.name || place.display_name.split(',')[0]}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{place.display_name}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex mt-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchingStart(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 sm:px-3 rounded-md text-xs sm:text-sm mr-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => getCurrentLocation('start')}
                    className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1 px-2 sm:px-3 rounded-md text-xs sm:text-sm flex items-center"
                  >
                    Use Current Location
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:space-x-2">
                <div className="flex-grow grid grid-cols-2 gap-2 mb-2 sm:mb-0">
                  <input
                    type="number"
                    value={startLat}
                    onChange={(e) => setStartLat(e.target.value)}
                    className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    required
                    placeholder="Latitude"
                    step="any"
                  />
                  <input
                    type="number"
                    value={startLon}
                    onChange={(e) => setStartLon(e.target.value)}
                    className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    required
                    placeholder="Longitude"
                    step="any"
                  />
                </div>
                <div className="flex space-x-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsSearchingStart(true)}
                    className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-1.5 sm:p-2 rounded-md flex items-center"
                    title="Search for location"
                  >
                    <FaSearch />
                  </button>
                  <button
                    type="button"
                    onClick={() => getCurrentLocation('start')}
                    className="bg-dashcam-500 hover:bg-dashcam-600 text-white p-1.5 sm:p-2 rounded-md flex items-center"
                    title="Use current location"
                  >
                    <FaMapMarkerAlt />
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-gray-700 mb-1 sm:mb-2 text-sm sm:text-base font-medium flex items-center">
              <FaMapMarkerAlt className="mr-1 text-dashcam-600" />
              End Location
            </label>
            
            <div className="mb-2">
              <label className="block text-gray-700 text-xs sm:text-sm mb-0.5 sm:mb-1">Location Name</label>
              <input
                type="text"
                value={destinationName}
                onChange={(e) => setDestinationName(e.target.value)}
                className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                placeholder="Destination Name"
              />
            </div>
            
            {isSearchingEnd ? (
              <div className="mb-3">
                <div className="flex mb-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-l-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    placeholder="Search for a location..."
                  />
                  <button
                    type="button"
                    onClick={() => searchPlaces(searchQuery, 'end')}
                    disabled={isSearching}
                    className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-1.5 sm:p-2 rounded-r-md flex items-center"
                  >
                    {isSearching && lastSearchType === 'end' ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaSearch />
                    )}
                  </button>
                </div>
                
                {searchResults.length > 0 && lastSearchType === 'end' && (
                  <div className="border border-gray-200 rounded-md max-h-48 sm:max-h-60 overflow-y-auto bg-white shadow-md">
                    {searchResults.map((place, index) => (
                      <div 
                        key={index}
                        className="p-1.5 sm:p-2 border-b border-gray-100 hover:bg-dashcam-50 cursor-pointer"
                        onClick={() => selectPlace(place, 'end')}
                      >
                        <div className="font-medium text-sm sm:text-base">{place.name || place.display_name.split(',')[0]}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{place.display_name}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex mt-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchingEnd(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 sm:px-3 rounded-md text-xs sm:text-sm mr-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => getCurrentLocation('end')}
                    className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1 px-2 sm:px-3 rounded-md text-xs sm:text-sm flex items-center"
                  >
                    Use Current Location
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:space-x-2">
                <div className="flex-grow grid grid-cols-2 gap-2 mb-2 sm:mb-0">
                  <input
                    type="number"
                    value={endLat}
                    onChange={(e) => setEndLat(e.target.value)}
                    className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    required
                    placeholder="Latitude"
                    step="any"
                  />
                  <input
                    type="number"
                    value={endLon}
                    onChange={(e) => setEndLon(e.target.value)}
                    className="w-full p-1.5 sm:p-2 border border-gray-300 text-sm sm:text-base rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    required
                    placeholder="Longitude"
                    step="any"
                  />
                </div>
                <div className="flex space-x-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsSearchingEnd(true)}
                    className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-1.5 sm:p-2 rounded-md flex items-center"
                    title="Search for location"
                  >
                    <FaSearch />
                  </button>
                  <button
                    type="button"
                    onClick={() => getCurrentLocation('end')}
                    className="bg-dashcam-500 hover:bg-dashcam-600 text-white p-1.5 sm:p-2 rounded-md flex items-center"
                    title="Use current location"
                  >
                    <FaMapMarkerAlt />
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Waypoints section */}
          <div className="md:col-span-2" id="waypoint-inputs">
            <div className="flex justify-between items-center mb-1 sm:mb-2">
              <label className="block text-gray-700 text-sm sm:text-base font-medium flex items-center">
                <FaMapMarkerAlt className="mr-1 text-dashcam-600" />
                Waypoints
              </label>
              <div className="flex items-center space-x-2">
                <div className="text-xs sm:text-sm text-gray-600">
                  {waypoints.length} waypoint{waypoints.length !== 1 ? 's' : ''}
                </div>
                
                {/* Botón para importar KML/KMZ */}
                <div className="relative">
                  <input
                    type="file"
                    id="kml-file-input"
                    accept=".kml,.kmz"
                    className="sr-only"
                    onChange={handleKmlFileUpload}
                    disabled={isLoadingKml}
                  />
                  <label
                    htmlFor="kml-file-input"
                    className={`bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2 rounded-md flex items-center cursor-pointer ${
                      isLoadingKml ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Importar puntos desde archivo KML/KMZ"
                  >
                    {isLoadingKml ? (
                      <>
                        <FaSpinner className="animate-spin mr-1" /> 
                        Cargando...
                      </>
                    ) : (
                      <>
                        <FaFileImport className="mr-1" /> 
                        Importar KML/KMZ
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
            
            {waypoints.length > 0 && (
              <div className="mb-3 border border-gray-200 rounded-md p-2 sm:p-3 bg-gray-50 max-h-60 sm:max-h-80 overflow-y-auto">
                {waypoints.map((waypoint, index) => (
                  <div 
                    key={index} 
                    className={`flex flex-col sm:flex-row sm:items-center mb-2 last:mb-0 p-1.5 sm:p-2 rounded
                      ${editingWaypointIndex === index ? 'bg-dashcam-50 border border-dashcam-300' : 'hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center mb-1 sm:mb-0 sm:mr-2">
                      <span className="text-xs bg-dashcam-600 text-white px-2 py-0.5 rounded-full">{index + 1}</span>
                    </div>
                    <div className="flex-grow mb-1 sm:mb-0">
                      <div className="mb-1">
                        <input
                          type="text"
                          value={waypoint.name || `Waypoint ${index + 1}`}
                          onChange={(e) => updateWaypointName(index, e.target.value)}
                          className="w-full p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={waypoint.lat}
                          onChange={(e) => updateWaypointCoord(index, 'lat', e.target.value)}
                          className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                          step="any"
                          placeholder="Latitude"
                        />
                        <input
                          type="number"
                          value={waypoint.lon}
                          onChange={(e) => updateWaypointCoord(index, 'lon', e.target.value)}
                          className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                          step="any"
                          placeholder="Longitude"
                        />
                      </div>
                    </div>
                    <div className="flex sm:flex-col justify-end sm:ml-2">
                      <div className="flex sm:mb-1">
                        <button
                          type="button"
                          onClick={() => moveWaypointUp(index)}
                          disabled={index === 0}
                          className={`p-1 ${index === 0 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-800'}`}
                          title="Move up"
                        >
                          <FaArrowUp className="text-xs sm:text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWaypointDown(index)}
                          disabled={index === waypoints.length - 1}
                          className={`p-1 ${index === waypoints.length - 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-800'}`}
                          title="Move down"
                        >
                          <FaArrowDown className="text-xs sm:text-sm" />
                        </button>
                      </div>
                      <div className="flex">
                        {editingWaypointIndex === index ? (
                          <button
                            type="button"
                            onClick={cancelEditingWaypoint}
                            className="p-1 text-gray-600 hover:text-gray-800"
                            title="Cancel edit"
                          >
                            ✖
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => editWaypoint(index)}
                            className="p-1 text-blue-500 hover:text-blue-700"
                            title="Edit waypoint"
                          >
                            <FaEdit className="text-xs sm:text-sm" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeWaypoint(index)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Remove waypoint"
                        >
                          <FaTrash className="text-xs sm:text-sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:space-x-2 sm:items-end">
              {isSearchingWaypoint ? (
                <div className="w-full">
                  <div className="flex mb-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 p-1.5 sm:p-2 border border-gray-300 text-xs sm:text-sm rounded-l-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                      placeholder="Search for a waypoint location..."
                    />
                    <button
                      type="button"
                      onClick={() => searchPlaces(searchQuery, 'waypoint')}
                      disabled={isSearching}
                      className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-1.5 sm:p-2 rounded-r-md flex items-center"
                    >
                      {isSearching && lastSearchType === 'waypoint' ? (
                        <FaSpinner className="animate-spin" />
                      ) : (
                        <FaSearch />
                      )}
                    </button>
                  </div>
                  
                  {searchResults.length > 0 && lastSearchType === 'waypoint' && (
                    <div className="border border-gray-200 rounded-md max-h-48 sm:max-h-60 overflow-y-auto bg-white shadow-md">
                      {searchResults.map((place, index) => (
                        <div 
                          key={index}
                          className="p-1.5 sm:p-2 border-b border-gray-100 hover:bg-dashcam-50 cursor-pointer"
                          onClick={() => selectPlace(place, 'waypoint')}
                        >
                          <div className="font-medium text-xs sm:text-sm">{place.name || place.display_name.split(',')[0]}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{place.display_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex mt-2">
                    <button
                      type="button"
                      onClick={() => setIsSearchingWaypoint(false)}
                      className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 rounded-md text-xs mr-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => getCurrentLocation('waypoint')}
                      className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1 px-2 rounded-md text-xs flex items-center"
                    >
                      Use Current Location
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2 sm:mb-0">
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={newWaypoint.name}
                        onChange={(e) => setNewWaypoint({...newWaypoint, name: e.target.value})}
                        className="w-full p-1.5 sm:p-2 border border-gray-300 text-xs sm:text-sm rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        placeholder={`Waypoint Name (${editingWaypointIndex >= 0 ? 'Editing' : 'New'})`}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={newWaypoint.lat}
                        onChange={(e) => setNewWaypoint({...newWaypoint, lat: e.target.value})}
                        className="w-full p-1.5 sm:p-2 border border-gray-300 text-xs sm:text-sm rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        placeholder="Latitude"
                        step="any"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={newWaypoint.lon}
                        onChange={(e) => setNewWaypoint({...newWaypoint, lon: e.target.value})}
                        className="w-full p-1.5 sm:p-2 border border-gray-300 text-xs sm:text-sm rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        placeholder="Longitude"
                        step="any"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsSearchingWaypoint(true)}
                        className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-1.5 sm:p-2 rounded-md flex-grow flex justify-center items-center text-xs sm:text-sm"
                        title="Search for location"
                      >
                        <FaSearch className="mr-1" /> Search
                      </button>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => getCurrentLocation('waypoint')}
                      className="bg-dashcam-500 hover:bg-dashcam-600 text-white p-1.5 sm:p-2 rounded-md"
                      title="Use current location"
                    >
                      <FaMapMarkerAlt className="text-xs sm:text-sm" />
                    </button>
                    {editingWaypointIndex >= 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={addWaypoint}
                          className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 sm:px-3 rounded-md flex items-center text-xs sm:text-sm"
                          title="Update waypoint"
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingWaypoint}
                          className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 sm:px-3 rounded-md text-xs sm:text-sm"
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={addWaypoint}
                        className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-1.5 sm:p-2 rounded-md"
                        title="Add waypoint"
                      >
                        <FaPlus className="text-xs sm:text-sm" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-gray-700 mb-1 sm:mb-2 text-sm sm:text-base font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-1.5 sm:p-2 border border-gray-300 text-xs sm:text-sm rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
              rows="3"
              placeholder="Any special notes or reminders about this trip"
            ></textarea>
          </div>
        </div>
        
        <div className="mt-4 sm:mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white py-1.5 sm:py-2 px-3 sm:px-4 rounded-md mr-2 text-xs sm:text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-dashcam-600 hover:bg-dashcam-700 text-white py-1.5 sm:py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm"
          >
            {initialData ? 'Update Trip' : 'Save Trip'}
          </button>
        </div>
      </form>

      {/* Modal para previsualizar KML/KMZ */}
      {isImportingKml && kmlWaypoints.length > 0 && (
        <KmlPreview
          points={kmlWaypoints}
          onClose={cancelKmlImport}
          onConfirm={confirmKmlImport}
          type="waypoints"
        />
      )}
    </div>
  );
};

export default TripForm;
