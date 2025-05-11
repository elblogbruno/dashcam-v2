import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { 
  FaPlay, FaStop, FaDownload, FaMapMarkerAlt, 
  FaExclamationTriangle, FaCrosshairs, FaRoute,
  FaLocationArrow, FaTimes, FaArrowUp,
  FaCarSide, FaListUl, FaEye, FaEyeSlash
} from 'react-icons/fa'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for the default marker icon issue in Leaflet with webpack
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

// Custom colored icons for different marker types
const createColoredIcon = (color) => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 12px; border: 3px solid white; box-shadow: 1px 1px 3px rgba(0,0,0,0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

// Car icon for current location
const carIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #4a69bd; color: white; width: 30px; height: 30px; border-radius: 15px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 1px 1px 3px rgba(0,0,0,0.4);">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
             <path d="M4 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6 8a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H6ZM4.862 4.276 3.906 6.19a.51.51 0 0 0 .497.731c.91-.073.995-.375 1.076-.493C5.778 6.094 4.83 6.15 5 6.5h6.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V6.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H3.333c-.168 0-.334-.036-.5-.11V7.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H2.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H1.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H1a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H2a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1V5.942l-.777-2.388A1.5 1.5 0 0 0 10.261 2H5.75a1.5 1.5 0 0 0-1.461 1.157l-.777 2.388V7.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h2.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H4a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h3.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H5.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1V5.793l-1-3.076A1.5 1.5 0 0 0 10.568 1H5.442a1.5 1.5 0 0 0-1.426.913l-.758 2.331A.5.5 0 0 0 3.5 4.5H4Z"/>
           </svg>
         </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
})

// Start and destination icons
const startIcon = createColoredIcon('#4CAF50') // Green
const destinationIcon = createColoredIcon('#F44336') // Red
const waypointIcon = createColoredIcon('#FF9800') // Orange

// Component to manage map center based on current location
function MapUpdater({ position, shouldFollow }) {
  const map = useMap()
  
  useEffect(() => {
    if (position && shouldFollow) {
      map.setView(position, map.getZoom())
    }
  }, [position, shouldFollow, map])
  
  return null
}

// Calculate distance between two coordinates in meters
function getDistanceBetweenCoordinates(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function RealTimeMap() {
  const [position, setPosition] = useState(null)
  const [heading, setHeading] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [shouldFollowPosition, setShouldFollowPosition] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [traveledPath, setTraveledPath] = useState([])
  const [nearbyLandmarks, setNearbyLandmarks] = useState([])
  const [upcomingLandmarks, setUpcomingLandmarks] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [statusMessage, setStatusMessage] = useState('')
  const [tripId, setTripId] = useState(null)
  const [activeTrip, setActiveTrip] = useState(null)
  const [showPlannedRoute, setShowPlannedRoute] = useState(true)
  const [showLandmarks, setShowLandmarks] = useState(true)
  const [navigationStatus, setNavigationStatus] = useState(null)
  const [navigationSidebarOpen, setNavigationSidebarOpen] = useState(false)
  const [completedWaypoints, setCompletedWaypoints] = useState([])
  const [showGpsWarning, setShowGpsWarning] = useState(false)
  
  // Default map location when GPS is not available (can be set to a meaningful default location)
  const defaultMapLocation = [37.7749, -122.4194] // Default to San Francisco, replace with a relevant location
  
  const socketRef = useRef(null)
  const mapRef = useRef(null)

  // Load active trip info and check if there's an active trip already running
  useEffect(() => {
    // Load planned trip from localStorage if available
    const savedTrip = localStorage.getItem('activeTrip')
    if (savedTrip) {
      try {
        setActiveTrip(JSON.parse(savedTrip))
        setStatusMessage('Planned trip loaded')
      } catch (e) {
        console.error('Error parsing saved trip:', e)
      }
    }
    
    // Check if there's an active trip already running
    const checkActiveTrip = async () => {
      try {
        const response = await fetch('/api/trips/active')
        const data = await response.json()
        
        if (data.status === 'success' && data.active_trip) {
          setIsRecording(true)
          setTripId(data.active_trip.trip_id)
          
          if (data.active_trip.planned_trip_id) {
            // If there's a planned trip ID, try to load that planned trip
            try {
              const tripResponse = await fetch(`/api/trip-planner/${data.active_trip.planned_trip_id}`)
              const tripData = await tripResponse.json()
              if (tripData) {
                setActiveTrip(tripData)
                localStorage.setItem('activeTrip', JSON.stringify(tripData))
                
                // Show a notification that there's an active trip
                setTimeout(() => {
                  alert(`¡Estás en un viaje activo: ${tripData.name}!\nLa grabación está en curso.`);
                }, 500);
              }
            } catch (err) {
              console.error('Error loading active planned trip:', err)
            }
          } else {
            // If there's a trip without planned data
            setTimeout(() => {
              alert('¡Hay un viaje activo actualmente!\nLa grabación está en curso.');
            }, 500);
          }
          
          setStatusMessage('Viaje activo en curso')
        }
      } catch (err) {
        console.error('Error checking for active trip:', err)
      }
    }
    
    checkActiveTrip()
  }, [])
  
  // Update navigation status when position changes
  useEffect(() => {
    if (position && activeTrip) {
      updateNavigationStatus()
    }
  }, [position, activeTrip, completedWaypoints])

  // Function to update navigation status
  const updateNavigationStatus = () => {
    if (!position || !activeTrip) return

    // Get all waypoints including start and end
    let allPoints = [
      { ...activeTrip.start_location, name: 'Start' },
      ...(activeTrip.waypoints || []).map((wp, i) => ({ 
        ...wp, 
        name: wp.name || `Waypoint ${i+1}` 
      })),
      { ...activeTrip.end_location, name: 'Destination' }
    ]
    
    // Filter out completed waypoints
    allPoints = allPoints.filter((_, index) => !completedWaypoints.includes(index))
    
    if (allPoints.length === 0) {
      setNavigationStatus({
        message: 'Trip complete!',
        distance: 0,
        nextPoint: null
      })
      return
    }
    
    // Calculate distance to next point
    const nextPoint = allPoints[0]
    const distance = getDistanceBetweenCoordinates(
      position[0], position[1], 
      nextPoint.lat, nextPoint.lon
    )
    
    // Mark waypoint as completed if we're close enough
    if (distance < 50 && allPoints.length > 1) { // Within 50 meters
      const waypointIndex = completedWaypoints.length
      setCompletedWaypoints([...completedWaypoints, waypointIndex])
      
      // Show notification
      setStatusMessage(`Arrived at ${nextPoint.name}!`)
    }
    
    setNavigationStatus({
      message: `Navigating to ${nextPoint.name}`,
      distance: distance,
      nextPoint: nextPoint
    })
  }
  
  // Initialize WebSocket connection
  useEffect(() => {
    // Close existing connection if it exists
    if (socketRef.current) {
      socketRef.current.close()
    }
    
    // Create new WebSocket connection
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws`)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnectionStatus('connected')
      setStatusMessage('Connected to server')
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setConnectionStatus('disconnected')
      setStatusMessage('Disconnected from server')
      
      // Try to reconnect after a delay
      setTimeout(() => {
        socketRef.current = null
      }, 5000)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setStatusMessage('Connection error')
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Handle location updates
        if (data.type === 'location_update') {
          const { lat, lon, heading, speed } = data
          
          if (lat && lon) {
            setPosition([lat, lon])
            setHeading(heading || 0)
            setSpeed(speed || 0)
            
            // Add to traveled path if recording
            if (isRecording && lat && lon) {
              setTraveledPath(prev => [...prev, [lat, lon]])
            }
          }
        }
        
        // Handle recording status updates
        if (data.type === 'recording_status') {
          setIsRecording(data.recording)
          if (data.trip_id) {
            setTripId(data.trip_id)
          }
        }
        
        // Handle nearby landmarks updates
        if (data.type === 'landmarks_update') {
          if (data.nearby) {
            setNearbyLandmarks(data.nearby)
          }
          
          if (data.upcoming) {
            setUpcomingLandmarks(data.upcoming)
          }
        }
        
        // Handle status messages
        if (data.type === 'status') {
          setStatusMessage(data.message)
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }
    
    socketRef.current = ws
    
    return () => {
      ws.close()
    }
  }, [])
  
  // Function to start a new trip
  const startTrip = async () => {
    try {
      setStatusMessage('Starting new trip...')
      
      // If we have an active planned trip, include it in the request
      const payload = activeTrip ? { planned_trip_id: activeTrip.id } : {}
      
      const response = await axios.post('/api/trips/start', payload)
      setIsRecording(true)
      setTripId(response.data.trip_id)
      setTraveledPath([])
      setCompletedWaypoints([])
      setStatusMessage('Trip started!')
    } catch (error) {
      console.error('Error starting trip:', error)
      setStatusMessage('Failed to start trip')
    }
  }
  
  // Function to end current trip
  const endTrip = async () => {
    // Confirmar con el usuario que realmente quiere finalizar el viaje
    const tripName = activeTrip ? activeTrip.name : "actual";
    if (!window.confirm(`¿Estás seguro de que quieres finalizar el viaje ${tripName}?\n\nSe detendrá la grabación y se guardarán todos los datos del viaje.`)) {
      return;
    }
    
    try {
      setStatusMessage('Finalizando viaje...')
      await axios.post('/api/trips/end')
      setIsRecording(false)
      setTripId(null)
      setStatusMessage('Viaje finalizado correctamente')
      
      // Clear active trip
      localStorage.removeItem('activeTrip')
      setActiveTrip(null)
      
      // Mostrar un mensaje de confirmación
      alert('El viaje ha sido finalizado correctamente');
    } catch (error) {
      console.error('Error al finalizar el viaje:', error)
      setStatusMessage('Error al finalizar el viaje')
      alert('Error al finalizar el viaje: ' + error.message);
    }
  }
  
  // Function to download landmarks
  const downloadLandmarks = async () => {
    try {
      setStatusMessage('Downloading landmarks...')
      const response = await axios.get('/api/landmarks/download')
      setStatusMessage(`Downloaded ${response.data.count} landmarks`)
    } catch (error) {
      console.error('Error downloading landmarks:', error)
      setStatusMessage('Failed to download landmarks')
    }
  }
  
  // Function to create a new landmark at current position
  const createLandmark = async () => {
    if (!position) {
      setStatusMessage('No position available to create landmark')
      return
    }
    
    try {
      const name = prompt('Enter landmark name:')
      if (!name) return
      
      const description = prompt('Enter description (optional):')
      const category = prompt('Enter category (e.g., gas station, restaurant):')
      
      await axios.post('/api/landmarks/create', {
        name,
        lat: position[0],
        lon: position[1],
        description,
        category,
        radius_m: 100 // Default radius
      })
      
      setStatusMessage('Landmark created successfully')
    } catch (error) {
      console.error('Error creating landmark:', error)
      setStatusMessage('Failed to create landmark')
    }
  }
  
  // Function to re-center map on current position
  const centerOnPosition = () => {
    if (position && mapRef.current) {
      mapRef.current.setView(position, mapRef.current.getZoom())
      setShouldFollowPosition(true)
    }
  }
  
  // Clear active planned trip
  const clearPlannedTrip = () => {
    localStorage.removeItem('activeTrip')
    setActiveTrip(null)
    setCompletedWaypoints([])
    setStatusMessage('Planned trip cleared')
  }
  
  // Handle map drag to disable auto-following
  const handleMapDrag = () => {
    setShouldFollowPosition(false)
  }

  // Format distance for display
  const formatDistance = (meters) => {
    return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
  }

  // Generate planned route points for Polyline
  const getPlannedRoutePoints = () => {
    if (!activeTrip) return []
    
    return [
      [activeTrip.start_location.lat, activeTrip.start_location.lon],
      ...(activeTrip.waypoints || []).map(wp => [wp.lat, wp.lon]),
      [activeTrip.end_location.lat, activeTrip.end_location.lon]
    ]
  }

  // Filter waypoints to show only those that aren't completed
  const getActiveWaypoints = () => {
    if (!activeTrip || !activeTrip.waypoints) return []
    
    return activeTrip.waypoints.filter((_, index) => 
      !completedWaypoints.includes(index + 1) // +1 because start is index 0
    )
  }

  // Get all navigation points (start + waypoints + end)
  const getAllNavigationPoints = () => {
    if (!activeTrip) return []
    
    return [
      { ...activeTrip.start_location, name: 'Start', type: 'start' },
      ...(activeTrip.waypoints || []).map((wp, i) => ({ 
        ...wp, 
        name: `Waypoint ${i+1}`, 
        type: 'waypoint',
        completed: completedWaypoints.includes(i + 1)
      })),
      { ...activeTrip.end_location, name: 'Destination', type: 'end' }
    ]
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="bg-dashcam-800 text-white p-2 flex items-center justify-between fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center space-x-2">
          {isRecording ? (
            <div className="flex items-center bg-green-700 text-white px-3 py-1 rounded-full">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse mr-2"></div>
              <span className="text-sm font-medium">Grabando</span>
            </div>
          ) : (
            <>
              <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">{statusMessage || 'Esperando'}</span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {navigationStatus && (
            <div className="bg-dashcam-700 px-3 py-1 rounded-full text-sm flex items-center">
              <FaLocationArrow className="mr-1" />
              <span>{formatDistance(navigationStatus.distance)}</span>
            </div>
          )}
          
          {position && (
            <span className="text-xs">
              {position[0].toFixed(6)}, {position[1].toFixed(6)} | {speed ? `${Math.round(speed * 3.6)} km/h` : 'Speed: N/A'}
            </span>
          )}
        </div>
      </div>
      
      {/* Main content with map and sidebar */}
      <div className="flex-grow flex">
        {/* Navigation sidebar */}
        {activeTrip && navigationSidebarOpen && (
          <div className="w-64 bg-white shadow-md overflow-auto">
            <div className="p-3 bg-dashcam-700 text-white flex justify-between items-center">
              <h3 className="font-medium">Navigation</h3>
              <button 
                onClick={() => setNavigationSidebarOpen(false)}
                className="text-white hover:text-gray-200"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="p-3">
              <div className="mb-4">
                <h4 className="font-medium text-dashcam-800">{activeTrip.name}</h4>
                <p className="text-sm text-gray-600">{getAllNavigationPoints().length - 1} points remaining</p>
              </div>
              
              <div className="space-y-2">
                {getAllNavigationPoints().map((point, index) => {
                  const isCompleted = index === 0 ? 
                    completedWaypoints.includes(0) : 
                    (point.type === 'waypoint' && point.completed);
                  
                  const isNext = !isCompleted && !completedWaypoints.includes(index);
                  
                  return (
                    <div 
                      key={index}
                      className={`p-2 border rounded-md ${
                        isCompleted ? 'bg-gray-100 border-gray-300' :
                        isNext ? 'bg-dashcam-50 border-dashcam-500 border-2' :
                        'border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <div 
                          className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                            isCompleted ? 'bg-green-500 text-white' :
                            isNext ? 'bg-dashcam-500 text-white' :
                            'bg-gray-300 text-gray-700'
                          }`}
                        >
                          {isCompleted ? '✓' : index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{point.name}</div>
                          <div className="text-xs text-gray-500">
                            {isCompleted ? 'Completed' : 
                             isNext && navigationStatus ? 
                              `${formatDistance(navigationStatus.distance)} remaining` : 
                              ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* Map container */}
        <div className="flex-grow relative">
          <MapContainer 
            center={position || defaultMapLocation} 
            zoom={15} 
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            whenCreated={map => {
              mapRef.current = map
              map.on('drag', handleMapDrag)
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Current position marker */}
            {position && (
              <Marker position={position} icon={carIcon}>
                <Popup>
                  <div className="text-center">
                    <h3 className="font-bold">Current Position</h3>
                    <p className="text-sm">{isRecording ? 'Recording active' : 'Not recording'}</p>
                    <p className="text-xs text-gray-500">
                      {position[0].toFixed(6)}, {position[1].toFixed(6)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Speed: {Math.round(speed * 3.6)} km/h
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
            
            {/* Traveled path line */}
            {traveledPath.length > 1 && (
              <Polyline 
                positions={traveledPath} 
                color="#4a69bd" 
                weight={4} 
                opacity={0.7} 
              />
            )}
            
            {/* Show planned route if available */}
            {activeTrip && showPlannedRoute && (
              <>
                {/* Planned route line */}
                <Polyline
                  positions={getPlannedRoutePoints()}
                  color="#F44336"
                  weight={4}
                  opacity={0.7}
                  dashArray="10, 10"
                />
                
                {/* Start marker */}
                <Marker 
                  position={[activeTrip.start_location.lat, activeTrip.start_location.lon]} 
                  icon={startIcon}
                >
                  <Popup>
                    <div>
                      <h3 className="font-bold">Trip Start</h3>
                      <p className="text-sm">{activeTrip.name}</p>
                    </div>
                  </Popup>
                </Marker>
                
                {/* Waypoint markers */}
                {activeTrip.waypoints && activeTrip.waypoints.map((waypoint, idx) => (
                  <Marker 
                    key={`waypoint-${idx}`}
                    position={[waypoint.lat, waypoint.lon]}
                    icon={waypointIcon}
                    opacity={completedWaypoints.includes(idx + 1) ? 0.5 : 1}
                  >
                    <Popup>
                      <div>
                        <h3 className="font-bold">{waypoint.name || `Waypoint ${idx + 1}`}</h3>
                        <p className="text-sm">{activeTrip.name}</p>
                        {completedWaypoints.includes(idx + 1) && (
                          <p className="text-xs text-green-600">Completed</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
                
                {/* Destination marker */}
                <Marker 
                  position={[activeTrip.end_location.lat, activeTrip.end_location.lon]} 
                  icon={destinationIcon}
                >
                  <Popup>
                    <div>
                      <h3 className="font-bold">Destination</h3>
                      <p className="text-sm">{activeTrip.name}</p>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}
            
            {/* Nearby landmarks */}
            {showLandmarks && nearbyLandmarks.map(landmark => (
              <Circle
                key={landmark.id}
                center={[landmark.lat, landmark.lon]}
                radius={landmark.radius_m}
                pathOptions={{ 
                  color: '#1dd1a1', 
                  fillColor: '#1dd1a1',
                  fillOpacity: 0.2 
                }}
              >
                <Marker 
                  position={[landmark.lat, landmark.lon]} 
                  icon={createColoredIcon('#1dd1a1')}
                >
                  <Popup>
                    <div>
                      <h3 className="font-bold">{landmark.name}</h3>
                      <p className="text-sm">{landmark.description || 'No description'}</p>
                      <p className="text-xs text-gray-500">
                        {landmark.distance ? `${(landmark.distance).toFixed(0)}m away` : ''}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              </Circle>
            ))}
            
            {/* Upcoming landmarks */}
            {showLandmarks && upcomingLandmarks.map(landmark => (
              <Circle
                key={landmark.id}
                center={[landmark.lat, landmark.lon]}
                radius={landmark.radius_m}
                pathOptions={{ 
                  color: '#feca57', 
                  fillColor: '#feca57',
                  fillOpacity: 0.2,
                  dashArray: '5, 5'
                }}
              >
                <Marker 
                  position={[landmark.lat, landmark.lon]} 
                  icon={createColoredIcon('#feca57')}
                >
                  <Popup>
                    <div>
                      <h3 className="font-bold">{landmark.name}</h3>
                      <p className="text-sm">{landmark.description || 'No description'}</p>
                      <p className="text-xs text-gray-500">
                        {landmark.distance ? `${(landmark.distance / 1000).toFixed(1)}km ahead` : ''}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              </Circle>
            ))}
            
            {/* Map updater component */}
            <MapUpdater position={position} shouldFollow={shouldFollowPosition} />
          </MapContainer>
          
          <div className="z-10">
          {/* GPS warning message */}
          {!position && (
            <div className="absolute top-16 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-yellow-500 text-white py-2 px-4 rounded-lg flex items-center shadow-lg">
                <FaExclamationTriangle className="mr-2" />
                <span>Esperando señal GPS...</span>
              </div>
            </div>
          )}
          
          {/* Navigation notification */}
          {navigationStatus && navigationStatus.nextPoint && (
            <div className="absolute top-16 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-black bg-opacity-75 text-white py-2 px-4 rounded-lg flex items-center shadow-lg">
                <FaArrowUp className="mr-2" />
                <span>
                  {navigationStatus.distance < 100 ? 
                    `Llegando a ${navigationStatus.nextPoint.name}` : 
                    `${formatDistance(navigationStatus.distance)} hasta ${navigationStatus.nextPoint.name}`}
                </span>
              </div>
            </div>
          )}
          
          {/* Control panel (overlay) */}
          <div className="absolute bottom-16 left-0 right-0 flex justify-center">
            <div className="bg-white rounded-lg shadow-lg p-2 flex space-x-2">
              {!isRecording ? (
                <button 
                  onClick={startTrip}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md flex items-center"
                  title="Iniciar viaje"
                >
                  <FaPlay className="mr-1" /> <span className="text-xs sm:text-sm">Iniciar viaje</span>
                </button>
              ) : (
                <button 
                  onClick={endTrip}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md flex items-center"
                  title="Finalizar viaje"
                >
                  <FaStop className="mr-1" /> <span className="text-xs sm:text-sm">Finalizar viaje</span>
                </button>
              )}
              
              {activeTrip && (
                <button
                  onClick={() => setNavigationSidebarOpen(!navigationSidebarOpen)}
                  className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-full"
                  title="Toggle Navigation Panel"
                >
                  <FaListUl />
                </button>
              )}
              
              {activeTrip && (
                <button
                  onClick={() => setShowPlannedRoute(!showPlannedRoute)}
                  className={`${showPlannedRoute ? 'bg-dashcam-500' : 'bg-gray-400'} hover:bg-dashcam-600 text-white p-2 rounded-full`}
                  title={showPlannedRoute ? "Hide Planned Route" : "Show Planned Route"}
                >
                  <FaRoute />
                </button>
              )}
              
              <button
                onClick={() => setShowLandmarks(!showLandmarks)}
                className={`${showLandmarks ? 'bg-purple-500' : 'bg-gray-400'} hover:bg-purple-600 text-white p-2 rounded-full`}
                title={showLandmarks ? "Hide Landmarks" : "Show Landmarks"}
              >
                {showLandmarks ? <FaEye /> : <FaEyeSlash />}
              </button>
              
              <button 
                onClick={downloadLandmarks}
                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full"
                title="Download Landmarks"
              >
                <FaDownload />
              </button>
              
              <button 
                onClick={createLandmark}
                className="bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-full"
                title="Create Landmark at Current Position"
              >
                <FaMapMarkerAlt />
              </button>
              
              <button 
                onClick={centerOnPosition}
                className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-full"
                title="Center on Current Position"
              >
                <FaCrosshairs />
              </button>
              
              {activeTrip && (
                <button 
                  onClick={clearPlannedTrip}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full"
                  title="Clear Planned Trip"
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RealTimeMap