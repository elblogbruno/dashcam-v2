// Mobile-optimized TripForm
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaMapMarkerAlt, FaCalendarAlt, FaPlus, FaTrash, FaSearch, FaSpinner, FaArrowUp, FaArrowDown, FaEdit, FaFileImport } from 'react-icons/fa';
import axios from 'axios';

// Importamos el nuevo componente y servicio
import KmlPreview from './KmlPreview';
import { uploadKmlFile } from '../../services/kmlService';

const TripForm = ({ initialData, onSubmit, onCancel, hideHeader = false }) => {
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
    <div className={`trip-form ${hideHeader ? 'bg-transparent' : 'bg-white rounded-lg shadow-lg overflow-hidden'}`}>
      {!hideHeader && (
        <div className="bg-blue-600 text-white p-4">
          <h2 className="text-lg sm:text-xl font-semibold">
            {initialData ? 'Edit Trip' : 'Plan New Trip'}
          </h2>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Basic Info Section - Mobile Optimized */}
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-2 text-sm font-medium">
              Trip Name
            </label>
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
              required
              placeholder="Enter trip name"
            />
          </div>

          {/* Dates - Stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2 text-sm font-medium flex items-center">
                <FaCalendarAlt className="mr-2 text-blue-600" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2 text-sm font-medium flex items-center">
                <FaCalendarAlt className="mr-2 text-blue-600" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                required
              />
            </div>
          </div>
        </div>

        {/* Locations Section - Mobile Optimized */}
        <div className="space-y-6">
          {/* Start Location */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-gray-700 mb-3 text-base font-medium flex items-center">
              <FaMapMarkerAlt className="mr-2 text-green-600" />
              Start Location
            </label>
            
            <div className="space-y-3">
              <div>
                <label className="block text-gray-600 text-sm mb-1">Location Name</label>
                <input
                  type="text"
                  value={originName}
                  onChange={(e) => setOriginName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                  placeholder="Origin Name (e.g. Home, Office)"
                />
              </div>
              
              {isSearchingStart ? (
                <div className="space-y-3">
                  <div className="flex">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 p-3 border border-gray-300 rounded-l-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                      placeholder="Search for a location..."
                    />
                    <button
                      type="button"
                      onClick={() => searchPlaces(searchQuery, 'start')}
                      disabled={isSearching}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-md flex items-center min-w-[48px] touch-manipulation"
                    >
                      {isSearching && lastSearchType === 'start' ? (
                        <FaSpinner className="animate-spin" />
                      ) : (
                        <FaSearch />
                      )}
                    </button>
                  </div>
                  
                  {searchResults.length > 0 && lastSearchType === 'start' && (
                    <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto bg-white shadow-md">
                      {searchResults.map((place, index) => (
                        <div 
                          key={index}
                          className="p-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer touch-manipulation"
                          onClick={() => selectPlace(place, 'start')}
                        >
                          <div className="font-medium text-base">{place.name || place.display_name.split(',')[0]}</div>
                          <div className="text-sm text-gray-500 truncate">{place.display_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSearchingStart(false)}
                      className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md text-base min-h-[44px] touch-manipulation"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => getCurrentLocation('start')}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-base flex items-center justify-center min-h-[44px] touch-manipulation"
                    >
                      Use Current Location
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={startLat}
                      onChange={(e) => setStartLat(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                      required
                      placeholder="Latitude"
                      step="any"
                    />
                    <input
                      type="number"
                      value={startLon}
                      onChange={(e) => setStartLon(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                      required
                      placeholder="Longitude"
                      step="any"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSearchingStart(true)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center min-h-[44px] touch-manipulation"
                      title="Search for location"
                    >
                      <FaSearch className="mr-2" /> Search
                    </button>
                    <button
                      type="button"
                      onClick={() => getCurrentLocation('start')}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md flex items-center justify-center min-h-[44px] touch-manipulation"
                      title="Use current location"
                    >
                      <FaMapMarkerAlt className="mr-2" /> Current
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* End Location - Similar structure but red colored */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-gray-700 mb-3 text-base font-medium flex items-center">
              <FaMapMarkerAlt className="mr-2 text-red-600" />
              End Location
            </label>
            
            <div className="space-y-3">
              <div>
                <label className="block text-gray-600 text-sm mb-1">Location Name</label>
                <input
                  type="text"
                  value={destinationName}
                  onChange={(e) => setDestinationName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                  placeholder="Destination Name"
                />
              </div>
              
              {isSearchingEnd ? (
                <div className="space-y-3">
                  <div className="flex">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 p-3 border border-gray-300 rounded-l-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                      placeholder="Search for a location..."
                    />
                    <button
                      type="button"
                      onClick={() => searchPlaces(searchQuery, 'end')}
                      disabled={isSearching}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-md flex items-center min-w-[48px] touch-manipulation"
                    >
                      {isSearching && lastSearchType === 'end' ? (
                        <FaSpinner className="animate-spin" />
                      ) : (
                        <FaSearch />
                      )}
                    </button>
                  </div>
                  
                  {searchResults.length > 0 && lastSearchType === 'end' && (
                    <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto bg-white shadow-md">
                      {searchResults.map((place, index) => (
                        <div 
                          key={index}
                          className="p-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer touch-manipulation"
                          onClick={() => selectPlace(place, 'end')}
                        >
                          <div className="font-medium text-base">{place.name || place.display_name.split(',')[0]}</div>
                          <div className="text-sm text-gray-500 truncate">{place.display_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSearchingEnd(false)}
                      className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md text-base min-h-[44px] touch-manipulation"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => getCurrentLocation('end')}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-base flex items-center justify-center min-h-[44px] touch-manipulation"
                    >
                      Use Current Location
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={endLat}
                      onChange={(e) => setEndLat(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                      required
                      placeholder="Latitude"
                      step="any"
                    />
                    <input
                      type="number"
                      value={endLon}
                      onChange={(e) => setEndLon(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                      required
                      placeholder="Longitude"
                      step="any"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSearchingEnd(true)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center min-h-[44px] touch-manipulation"
                      title="Search for location"
                    >
                      <FaSearch className="mr-2" /> Search
                    </button>
                    <button
                      type="button"
                      onClick={() => getCurrentLocation('end')}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md flex items-center justify-center min-h-[44px] touch-manipulation"
                      title="Use current location"
                    >
                      <FaMapMarkerAlt className="mr-2" /> Current
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Waypoints Section - Mobile Optimized */}
        <div className="bg-blue-50 p-4 rounded-lg" id="waypoint-inputs">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-gray-700 text-base font-medium flex items-center">
              <FaMapMarkerAlt className="mr-2 text-blue-600" />
              Waypoints ({waypoints.length})
            </label>
            
            {/* Import KML Button */}
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
                className={`bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded-md flex items-center cursor-pointer min-h-[36px] touch-manipulation ${
                  isLoadingKml ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Import waypoints from KML/KMZ file"
              >
                {isLoadingKml ? (
                  <FaSpinner className="animate-spin mr-1" />
                ) : (
                  <FaFileImport className="mr-1" />
                )}
                <span className="hidden sm:inline">Import</span>
              </label>
            </div>
          </div>

          {/* Existing Waypoints List */}
          {waypoints.length > 0 && (
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {waypoints.map((waypoint, index) => (
                <div 
                  key={index} 
                  className={`bg-white p-3 rounded-lg border ${
                    editingWaypointIndex === index ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded-full font-medium">
                      {index + 1}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => moveWaypointUp(index)}
                        disabled={index === 0}
                        className={`p-1 ${index === 0 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-800'} touch-manipulation`}
                        title="Move up"
                      >
                        <FaArrowUp />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWaypointDown(index)}
                        disabled={index === waypoints.length - 1}
                        className={`p-1 ${index === waypoints.length - 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-800'} touch-manipulation`}
                        title="Move down"
                      >
                        <FaArrowDown />
                      </button>
                      <button
                        type="button"
                        onClick={() => editWaypoint(index)}
                        className="p-1 text-blue-500 hover:text-blue-700 touch-manipulation"
                        title="Edit waypoint"
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWaypoint(index)}
                        className="p-1 text-red-500 hover:text-red-700 touch-manipulation"
                        title="Remove waypoint"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={waypoint.name || `Waypoint ${index + 1}`}
                      onChange={(e) => updateWaypointName(index, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:ring focus:ring-blue-200 touch-manipulation"
                      placeholder="Waypoint name"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={waypoint.lat}
                        onChange={(e) => updateWaypointCoord(index, 'lat', e.target.value)}
                        className="p-2 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:ring focus:ring-blue-200 touch-manipulation"
                        step="any"
                        placeholder="Latitude"
                      />
                      <input
                        type="number"
                        value={waypoint.lon}
                        onChange={(e) => updateWaypointCoord(index, 'lon', e.target.value)}
                        className="p-2 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:ring focus:ring-blue-200 touch-manipulation"
                        step="any"
                        placeholder="Longitude"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Waypoint Section */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              {editingWaypointIndex >= 0 ? 'Edit Waypoint' : 'Add New Waypoint'}
            </h4>
            
            {isSearchingWaypoint ? (
              <div className="space-y-3">
                <div className="flex">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 p-3 border border-gray-300 rounded-l-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                    placeholder="Search for a waypoint location..."
                  />
                  <button
                    type="button"
                    onClick={() => searchPlaces(searchQuery, 'waypoint')}
                    disabled={isSearching}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-md flex items-center min-w-[48px] touch-manipulation"
                  >
                    {isSearching && lastSearchType === 'waypoint' ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaSearch />
                    )}
                  </button>
                </div>
                
                {searchResults.length > 0 && lastSearchType === 'waypoint' && (
                  <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto bg-white shadow-md">
                    {searchResults.map((place, index) => (
                      <div 
                        key={index}
                        className="p-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer touch-manipulation"
                        onClick={() => selectPlace(place, 'waypoint')}
                      >
                        <div className="font-medium text-sm">{place.name || place.display_name.split(',')[0]}</div>
                        <div className="text-xs text-gray-500 truncate">{place.display_name}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchingWaypoint(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md text-base min-h-[44px] touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => getCurrentLocation('waypoint')}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-base flex items-center justify-center min-h-[44px] touch-manipulation"
                  >
                    Use Current Location
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newWaypoint.name}
                  onChange={(e) => setNewWaypoint({...newWaypoint, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                  placeholder={`Waypoint Name (${editingWaypointIndex >= 0 ? 'Editing' : 'New'})`}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={newWaypoint.lat}
                    onChange={(e) => setNewWaypoint({...newWaypoint, lat: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                    placeholder="Latitude"
                    step="any"
                  />
                  <input
                    type="number"
                    value={newWaypoint.lon}
                    onChange={(e) => setNewWaypoint({...newWaypoint, lon: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
                    placeholder="Longitude"
                    step="any"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchingWaypoint(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center min-h-[44px] touch-manipulation"
                    title="Search for location"
                  >
                    <FaSearch className="mr-2" /> Search
                  </button>
                  <button
                    type="button"
                    onClick={() => getCurrentLocation('waypoint')}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md flex items-center justify-center min-h-[44px] touch-manipulation"
                    title="Use current location"
                  >
                    <FaMapMarkerAlt />
                  </button>
                </div>
                
                <div className="flex gap-2">
                  {editingWaypointIndex >= 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={addWaypoint}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md min-h-[44px] touch-manipulation"
                        title="Update waypoint"
                      >
                        Update Waypoint
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingWaypoint}
                        className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md min-h-[44px] touch-manipulation"
                        title="Cancel"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={addWaypoint}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center min-h-[44px] touch-manipulation"
                      title="Add waypoint"
                    >
                      <FaPlus className="mr-2" /> Add Waypoint
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <label className="block text-gray-700 mb-2 text-base font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:ring focus:ring-blue-200 text-base touch-manipulation"
            rows="4"
            placeholder="Any special notes or reminders about this trip"
          ></textarea>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-md text-base min-h-[48px] touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md text-base min-h-[48px] touch-manipulation"
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
