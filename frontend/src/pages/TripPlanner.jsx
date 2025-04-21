import React, { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import axios from 'axios';
import { FaRoute, FaMapMarkerAlt, FaCalendarAlt, FaPlus, FaTrash, FaDownload, FaPlay, FaSearch, FaSpinner } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

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
  const [downloadingLandmarks, setDownloadingLandmarks] = useState(false);
  const [selectedTripForPreview, setSelectedTripForPreview] = useState(null);
  const [selectedTab, setSelectedTab] = useState('upcoming'); // 'upcoming' or 'past'
  const navigate = useNavigate();
  
  // New trip form state
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLon, setStartLon] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLon, setEndLon] = useState('');
  const [notes, setNotes] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [newWaypoint, setNewWaypoint] = useState({ lat: '', lon: '' });
  
  // State for location search
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);
  const [isSearchingWaypoint, setIsSearchingWaypoint] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchType, setLastSearchType] = useState(null);
  
  // Fetch trips when component mounts
  useEffect(() => {
    fetchTrips();
  }, []);
  
  const fetchTrips = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/trip-planner');
      // Sort trips by start date
      const sortedTrips = response.data.trips.sort((a, b) => 
        new Date(a.start_date) - new Date(b.start_date)
      );
      
      setTrips(sortedTrips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };
  
  const createTrip = async (e) => {
    e.preventDefault();
    try {
      // Format dates as expected by the backend - "YYYY-MM-DD HH:MM:SS"
      const formattedStartDate = `${startDate} 00:00:00`;
      const formattedEndDate = `${endDate} 23:59:59`;
      
      const newTrip = {
        name: tripName,
        start_location: {
          lat: parseFloat(startLat),
          lon: parseFloat(startLon)
        },
        end_location: {
          lat: parseFloat(endLat),
          lon: parseFloat(endLon)
        },
        start_date: startDate,
        end_date: endDate,
        start_time: formattedStartDate, // Add this field for calendar compatibility
        end_time: formattedEndDate,     // Add this field for calendar compatibility
        notes: notes,
        waypoints: waypoints.map(wp => ({
          lat: parseFloat(wp.lat),
          lon: parseFloat(wp.lon),
          name: wp.name || `Waypoint ${waypoints.indexOf(wp) + 1}`
        }))
      };
      
      const response = await axios.post('/api/trip-planner', newTrip);
      toast.success('Trip planned successfully');
      setTrips([...trips, response.data]);
      resetForm();
    } catch (error) {
      console.error('Error creating trip:', error);
      toast.error('Failed to create trip');
    }
  };
  
  const deleteTrip = async (tripId) => {
    if (window.confirm('Are you sure you want to delete this trip?')) {
      try {
        await axios.delete(`/api/trip-planner/${tripId}`);
        toast.success('Trip deleted');
        setTrips(trips.filter(trip => trip.id !== tripId));
        
        if (selectedTripForPreview && selectedTripForPreview.id === tripId) {
          setSelectedTripForPreview(null);
        }
      } catch (error) {
        console.error('Error deleting trip:', error);
        toast.error('Failed to delete trip');
      }
    }
  };
  
  const downloadLandmarks = async (tripId) => {
    setDownloadingLandmarks(true);
    try {
      const response = await axios.post(`/api/trip-planner/${tripId}/download-landmarks`);
      toast.success(response.data.message);
      
      // Update trip in state to show landmarks are downloaded
      setTrips(trips.map(trip => {
        if (trip.id === tripId) {
          return { ...trip, landmarks_downloaded: true };
        }
        return trip;
      }));
    } catch (error) {
      console.error('Error downloading landmarks:', error);
      toast.error('Failed to download landmarks');
    } finally {
      setDownloadingLandmarks(false);
    }
  };
  
  const startNavigation = (trip) => {
    // Store the selected trip in localStorage for the map component to use
    localStorage.setItem('activeTrip', JSON.stringify(trip));
    // Navigate to the map page
    navigate('/map');
  };
  
  const resetForm = () => {
    setTripName('');
    setStartDate('');
    setEndDate('');
    setStartLat('');
    setStartLon('');
    setEndLat('');
    setEndLon('');
    setNotes('');
    setWaypoints([]);
    setShowForm(false);
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
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
  
  const addWaypoint = () => {
    if (newWaypoint.lat && newWaypoint.lon) {
      setWaypoints([...waypoints, newWaypoint]);
      setNewWaypoint({ lat: '', lon: '' });
    } else {
      toast.error('Please enter both latitude and longitude');
    }
  };
  
  const removeWaypoint = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const isUpcomingTrip = (trip) => {
    return new Date(trip.end_date) >= new Date();
  };

  const isPastTrip = (trip) => {
    return new Date(trip.end_date) < new Date();
  };

  const filteredTrips = trips.filter(trip => 
    selectedTab === 'upcoming' ? isUpcomingTrip(trip) : isPastTrip(trip)
  );

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
      setIsSearchingStart(false);
    } else if (locationType === 'end') {
      setEndLat(place.lat);
      setEndLon(place.lon);
      setIsSearchingEnd(false);
    } else if (locationType === 'waypoint') {
      setNewWaypoint({
        lat: place.lat,
        lon: place.lon,
        name: place.name || `Waypoint ${waypoints.length + 1}`
      });
      setIsSearchingWaypoint(false);
    }
    
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`Location set: ${place.name || place.display_name}`);
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <Toaster position="top-right" />
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-dashcam-800 flex items-center">
          <FaRoute className="mr-2" />
          Trip Planner
        </h1>
        
        <div className="flex space-x-2">
          <div className="bg-white rounded-lg shadow p-1 flex">
            <button
              onClick={() => setSelectedTab('upcoming')}
              className={`px-4 py-2 rounded-md ${selectedTab === 'upcoming' ? 'bg-dashcam-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setSelectedTab('past')}
              className={`px-4 py-2 rounded-md ${selectedTab === 'past' ? 'bg-dashcam-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Past
            </button>
          </div>
          
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-dashcam-600 hover:bg-dashcam-700 text-white py-2 px-4 rounded-md flex items-center"
          >
            {showForm ? 'Cancel' : <>
              <FaPlus className="mr-1" /> Plan Trip
            </>}
          </button>
        </div>
      </div>
      
      {showForm && (
        <div className="bg-white shadow-md rounded-lg mb-8 overflow-hidden">
          <div className="bg-dashcam-700 text-white p-4">
            <h2 className="text-xl font-semibold">Plan a New Trip</h2>
          </div>
          
          <form onSubmit={createTrip} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 mb-2 font-medium">Trip Name</label>
                <input
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                  required
                  placeholder="Adventure to Grand Canyon"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium flex items-center">
                    <FaCalendarAlt className="mr-1 text-dashcam-600" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium flex items-center">
                    <FaCalendarAlt className="mr-1 text-dashcam-600" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                    required
                  />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-gray-700 mb-2 font-medium flex items-center">
                  <FaMapMarkerAlt className="mr-1 text-dashcam-600" />
                  Start Location
                </label>
                
                {isSearchingStart ? (
                  <div className="mb-3">
                    <div className="flex mb-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded-l-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        placeholder="Search for a location..."
                      />
                      <button
                        type="button"
                        onClick={() => searchPlaces(searchQuery, 'start')}
                        disabled={isSearching}
                        className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-r-md flex items-center"
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
                            className="p-2 border-b border-gray-100 hover:bg-dashcam-50 cursor-pointer"
                            onClick={() => selectPlace(place, 'start')}
                          >
                            <div className="font-medium">{place.name || place.display_name.split(',')[0]}</div>
                            <div className="text-xs text-gray-500">{place.display_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex mt-2">
                      <button
                        type="button"
                        onClick={() => setIsSearchingStart(false)}
                        className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-3 rounded-md text-sm mr-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => getCurrentLocation('start')}
                        className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1 px-3 rounded-md text-sm flex items-center"
                      >
                        Use Current Location
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <div className="flex-grow flex space-x-2">
                      <input
                        type="number"
                        value={startLat}
                        onChange={(e) => setStartLat(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        required
                        placeholder="Latitude"
                        step="any"
                      />
                      <input
                        type="number"
                        value={startLon}
                        onChange={(e) => setStartLon(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        required
                        placeholder="Longitude"
                        step="any"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsSearchingStart(true)}
                        className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-md flex items-center"
                        title="Search for location"
                      >
                        <FaSearch />
                      </button>
                      <button
                        type="button"
                        onClick={() => getCurrentLocation('start')}
                        className="bg-dashcam-500 hover:bg-dashcam-600 text-white p-2 rounded-md flex items-center"
                        title="Use current location"
                      >
                        <FaMapMarkerAlt />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-gray-700 mb-2 font-medium flex items-center">
                  <FaMapMarkerAlt className="mr-1 text-dashcam-600" />
                  End Location
                </label>
                
                {isSearchingEnd ? (
                  <div className="mb-3">
                    <div className="flex mb-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded-l-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        placeholder="Search for a location..."
                      />
                      <button
                        type="button"
                        onClick={() => searchPlaces(searchQuery, 'end')}
                        disabled={isSearching}
                        className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-r-md flex items-center"
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
                            className="p-2 border-b border-gray-100 hover:bg-dashcam-50 cursor-pointer"
                            onClick={() => selectPlace(place, 'end')}
                          >
                            <div className="font-medium">{place.name || place.display_name.split(',')[0]}</div>
                            <div className="text-xs text-gray-500">{place.display_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex mt-2">
                      <button
                        type="button"
                        onClick={() => setIsSearchingEnd(false)}
                        className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-3 rounded-md text-sm mr-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => getCurrentLocation('end')}
                        className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1 px-3 rounded-md text-sm flex items-center"
                      >
                        Use Current Location
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <div className="flex-grow flex space-x-2">
                      <input
                        type="number"
                        value={endLat}
                        onChange={(e) => setEndLat(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        required
                        placeholder="Latitude"
                        step="any"
                      />
                      <input
                        type="number"
                        value={endLon}
                        onChange={(e) => setEndLon(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                        required
                        placeholder="Longitude"
                        step="any"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsSearchingEnd(true)}
                        className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-md flex items-center"
                        title="Search for location"
                      >
                        <FaSearch />
                      </button>
                      <button
                        type="button"
                        onClick={() => getCurrentLocation('end')}
                        className="bg-dashcam-500 hover:bg-dashcam-600 text-white p-2 rounded-md flex items-center"
                        title="Use current location"
                      >
                        <FaMapMarkerAlt />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Waypoints section */}
              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-gray-700 font-medium flex items-center">
                    <FaMapMarkerAlt className="mr-1 text-dashcam-600" />
                    Waypoints
                  </label>
                </div>
                
                {waypoints.length > 0 && (
                  <div className="mb-3 border border-gray-200 rounded-md p-3 bg-gray-50">
                    {waypoints.map((waypoint, index) => (
                      <div key={index} className="flex items-center mb-2 last:mb-0">
                        <span className="mr-2 text-xs bg-dashcam-600 text-white px-2 py-1 rounded-full">{index + 1}</span>
                        <div className="flex-grow">
                          <div className="mb-1 text-sm font-medium text-dashcam-700">
                            {waypoint.name || `Waypoint ${index + 1}`}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={waypoint.lat}
                              disabled
                              className="p-2 border border-gray-200 rounded-md bg-gray-100 text-sm"
                            />
                            <input
                              type="text"
                              value={waypoint.lon}
                              disabled
                              className="p-2 border border-gray-200 rounded-md bg-gray-100 text-sm"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWaypoint(index)}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex space-x-2 items-end">
                  {isSearchingWaypoint ? (
                    <div className="w-full">
                      <div className="flex mb-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="flex-1 p-2 border border-gray-300 rounded-l-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                          placeholder="Search for a waypoint location..."
                        />
                        <button
                          type="button"
                          onClick={() => searchPlaces(searchQuery, 'waypoint')}
                          disabled={isSearching}
                          className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-r-md flex items-center"
                        >
                          {isSearching && lastSearchType === 'waypoint' ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <FaSearch />
                          )}
                        </button>
                      </div>
                      
                      {searchResults.length > 0 && lastSearchType === 'waypoint' && (
                        <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto bg-white shadow-md">
                          {searchResults.map((place, index) => (
                            <div 
                              key={index}
                              className="p-2 border-b border-gray-100 hover:bg-dashcam-50 cursor-pointer"
                              onClick={() => selectPlace(place, 'waypoint')}
                            >
                              <div className="font-medium">{place.name || place.display_name.split(',')[0]}</div>
                              <div className="text-xs text-gray-500">{place.display_name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex mt-2">
                        <button
                          type="button"
                          onClick={() => setIsSearchingWaypoint(false)}
                          className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-3 rounded-md text-sm mr-2"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => getCurrentLocation('waypoint')}
                          className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1 px-3 rounded-md text-sm flex items-center"
                        >
                          Use Current Location
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-grow grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number"
                            value={newWaypoint.lat}
                            onChange={(e) => setNewWaypoint({...newWaypoint, lat: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                            placeholder="Waypoint Latitude"
                            step="any"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={newWaypoint.lon}
                            onChange={(e) => setNewWaypoint({...newWaypoint, lon: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                            placeholder="Waypoint Longitude"
                            step="any"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsSearchingWaypoint(true)}
                          className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-md flex items-center"
                          title="Search for waypoint"
                        >
                          <FaSearch />
                        </button>
                        <button
                          type="button"
                          onClick={() => getCurrentLocation('waypoint')}
                          className="bg-dashcam-500 hover:bg-dashcam-600 text-white p-2 rounded-md"
                          title="Use current location"
                        >
                          <FaMapMarkerAlt />
                        </button>
                        <button
                          type="button"
                          onClick={addWaypoint}
                          className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-md"
                          title="Add waypoint"
                        >
                          <FaPlus />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-gray-700 mb-2 font-medium">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:border-dashcam-500 focus:ring focus:ring-dashcam-200"
                  rows="3"
                  placeholder="Any special notes or reminders about this trip"
                ></textarea>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-dashcam-600 hover:bg-dashcam-700 text-white py-2 px-4 rounded-md"
              >
                Save Trip
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-10 bg-white rounded-lg shadow-md">
              <div className="animate-spin h-10 w-10 border-4 border-dashcam-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading trips...</p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-medium text-gray-600">No {selectedTab} trips found</h3>
              <p className="text-gray-500 mt-2">
                {selectedTab === 'upcoming' 
                  ? 'Plan your first trip to prepare for your journey' 
                  : 'Your past trips will appear here'}
              </p>
              {selectedTab === 'upcoming' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 bg-dashcam-600 hover:bg-dashcam-700 text-white py-2 px-4 rounded-md"
                >
                  Plan a Trip
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTrips.map((trip) => (
                <div 
                  key={trip.id} 
                  className={`bg-white rounded-lg shadow-md overflow-hidden border-2 
                    ${selectedTripForPreview?.id === trip.id ? 'border-dashcam-500' : 'border-transparent'}`}
                  onClick={() => setSelectedTripForPreview(trip)}
                >
                  <div className="bg-dashcam-700 text-white p-4">
                    <h3 className="text-lg font-semibold">{trip.name}</h3>
                    <p className="text-sm">
                      {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                    </p>
                  </div>
                  
                  <div className="p-4">
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-1">Start Location:</p>
                      <p className="font-medium">
                        {trip.start_location.lat.toFixed(6)}, {trip.start_location.lon.toFixed(6)}
                      </p>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-1">End Location:</p>
                      <p className="font-medium">
                        {trip.end_location.lat.toFixed(6)}, {trip.end_location.lon.toFixed(6)}
                      </p>
                    </div>
                    
                    {trip.waypoints && trip.waypoints.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-1">Waypoints: {trip.waypoints.length}</p>
                      </div>
                    )}
                    
                    {trip.notes && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-1">Notes:</p>
                        <p className="text-gray-700">{trip.notes}</p>
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTrip(trip.id);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                      
                      <div className="flex space-x-2">
                        {selectedTab === 'upcoming' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startNavigation(trip);
                            }}
                            className="py-1 px-3 rounded bg-green-500 hover:bg-green-600 text-white flex items-center"
                          >
                            <FaPlay className="mr-1" /> Start
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadLandmarks(trip.id);
                          }}
                          disabled={downloadingLandmarks || trip.landmarks_downloaded}
                          className={`py-1 px-3 rounded flex items-center ${
                            trip.landmarks_downloaded
                              ? 'bg-green-100 text-green-800 cursor-not-allowed'
                              : downloadingLandmarks
                              ? 'bg-dashcam-300 cursor-not-allowed'
                              : 'bg-dashcam-500 hover:bg-dashcam-600 text-white'
                          }`}
                        >
                          <FaDownload className="mr-1" />
                          {trip.landmarks_downloaded
                            ? 'Downloaded'
                            : downloadingLandmarks
                            ? 'Downloading...'
                            : 'Get Landmarks'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Map preview panel */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-dashcam-700 text-white p-4">
            <h3 className="text-lg font-semibold">Trip Preview</h3>
          </div>
          
          <div className="h-[400px]">
            {selectedTripForPreview ? (
              <MapContainer 
                center={[
                  selectedTripForPreview.start_location.lat,
                  selectedTripForPreview.start_location.lon
                ]} 
                zoom={10} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Start location marker */}
                <Marker 
                  position={[
                    selectedTripForPreview.start_location.lat,
                    selectedTripForPreview.start_location.lon
                  ]}
                >
                  <Popup>Start: {selectedTripForPreview.name}</Popup>
                </Marker>
                
                {/* End location marker */}
                <Marker 
                  position={[
                    selectedTripForPreview.end_location.lat,
                    selectedTripForPreview.end_location.lon
                  ]}
                >
                  <Popup>End: {selectedTripForPreview.name}</Popup>
                </Marker>
                
                {/* Waypoint markers */}
                {selectedTripForPreview.waypoints && selectedTripForPreview.waypoints.map((waypoint, index) => (
                  <Marker 
                    key={index}
                    position={[waypoint.lat, waypoint.lon]}
                  >
                    <Popup>
                      {waypoint.name || `Waypoint ${index + 1}`}
                    </Popup>
                  </Marker>
                ))}
                
                {/* Route line */}
                <Polyline
                  positions={[
                    [selectedTripForPreview.start_location.lat, selectedTripForPreview.start_location.lon],
                    ...(selectedTripForPreview.waypoints || []).map(wp => [wp.lat, wp.lon]),
                    [selectedTripForPreview.end_location.lat, selectedTripForPreview.end_location.lon]
                  ]}
                  color="#0284c7"
                  weight={4}
                  opacity={0.7}
                />
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center p-4">
                  <FaRoute className="text-4xl text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Select a trip to preview route</p>
                </div>
              </div>
            )}
          </div>
          
          {selectedTripForPreview && (
            <div className="p-4 border-t border-gray-200">
              <h4 className="font-medium mb-2">Trip Details</h4>
              <p className="text-sm text-gray-600">
                <strong>Dates:</strong> {formatDate(selectedTripForPreview.start_date)} - {formatDate(selectedTripForPreview.end_date)}
              </p>
              {selectedTripForPreview.waypoints && selectedTripForPreview.waypoints.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Waypoints:</strong> {selectedTripForPreview.waypoints.length}
                </p>
              )}
              {selectedTab === 'upcoming' && (
                <button
                  onClick={() => startNavigation(selectedTripForPreview)}
                  className="w-full mt-3 py-2 bg-dashcam-600 hover:bg-dashcam-700 text-white rounded-md flex items-center justify-center"
                >
                  <FaPlay className="mr-1" /> Start Navigation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripPlanner;