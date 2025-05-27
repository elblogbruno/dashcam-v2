import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { MapContainer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Importar componentes
import OfflineTileLayer from '../components/Maps/OfflineTileLayer'
import MapUpdater from '../components/map/MapUpdater'
import { CurrentPositionMarker, TraveledPathLine, PlannedRouteLayer, LandmarksLayer } from '../components/map/MapLayers'
import ZoomLevelIndicator from '../components/Maps/ZoomLevelIndicator'
import StatusBar from '../components/map/StatusBar'
import ControlPanel from '../components/map/ControlPanel'
import NavigationSidebar from '../components/map/NavigationSidebar'
import NotificationOverlay from '../components/map/NotificationOverlay'
import MapSourceSelector from '../components/Maps/MapSourceSelector'
import TileDebugger from '../components/Maps/TileDebugger'
import OfflineTileDebugger from '../components/Maps/OfflineTileDebugger'  // Depurador de tiles offline

// Importar utilidades
import { getDistanceBetweenCoordinates } from '../utils/mapHelpers'

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
  
  // Estados para gestión de mapas
  const [mapSource, setMapSource] = useState(() => {
    // Cargar la preferencia guardada en localStorage, o usar 'auto' por defecto
    const savedPreference = localStorage.getItem('preferredMapSource')
    return savedPreference || 'auto'
  })
  const [offlineMapsAvailable, setOfflineMapsAvailable] = useState(false)
  
  // Default map location when GPS is not available
  const defaultMapLocation = [37.7749, -122.4194] // Default to San Francisco
  
  const socketRef = useRef(null)
  const mapRef = useRef(null)

  // Manejador de cambio de fuente de mapa
  const handleMapSourceChange = useCallback((source) => {
    setMapSource(source)
    localStorage.setItem('preferredMapSource', source)
  }, [])

  // Manejador para actualizar el estado de disponibilidad de mapas
  const handleMapAvailabilityChange = useCallback((source, isAvailable) => {
    if (source === 'offline') {
      setOfflineMapsAvailable(isAvailable)
    }
  }, [])

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

  return (
    <div className="flex flex-col h-screen overflow-hidden w-full absolute inset-0">
      {/* Status bar con z-index muy alto para estar sobre todo */}
      <StatusBar
        isRecording={isRecording}
        connectionStatus={connectionStatus}
        statusMessage={statusMessage}
        navigationStatus={navigationStatus}
        position={position}
        speed={speed}
      />
      
      {/* Main content with map and sidebar */}
      <div className="flex-grow flex relative mt-12"> {/* Añadido mt-12 para dejar espacio para la barra de estado */}
        {/* Navigation sidebar - necesita z-index alto */}
        <div className="z-30 h-full relative"> {/* Añadido relative */}
          <NavigationSidebar
            activeTrip={activeTrip}
            navigationSidebarOpen={navigationSidebarOpen}
            setNavigationSidebarOpen={setNavigationSidebarOpen}
            completedWaypoints={completedWaypoints}
            navigationStatus={navigationStatus}
          />
        </div>
        
        {/* Map container */}
        <div className="flex-grow relative">
          <MapContainer 
            center={position || defaultMapLocation} 
            zoom={15} 
            style={{ height: 'calc(100vh - 62px)', width: '100%' }} 
            whenCreated={map => {
              mapRef.current = map
              map.on('drag', handleMapDrag)
            }}
            className="z-0" /* Mantener z-index bajo para el mapa */
            zoomControl={false} /* Desactivar controles de zoom por defecto */
          >
            {/* Colocar los controles de zoom en una posición personalizada */}
            <div className="leaflet-control-container">
              <div className="leaflet-top leaflet-left" style={{top: '20px'}}> {/* Ajustar posición */}
                <div className="leaflet-control-zoom leaflet-bar leaflet-control">
                  {/* Los controles de zoom se añadirán automáticamente */}
                </div>
              </div>
            </div>
            
            <OfflineTileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              tripId={tripId || activeTrip?.id}
              preferredSource={mapSource}
              onChangeMapSource={handleMapSourceChange}
              onAvailabilityChange={(type, available) => {
                if (type === 'offline') setOfflineMapsAvailable(available);
              }}
            />
            
            {/* Position, paths and landmarks */}
            <CurrentPositionMarker 
              position={position} 
              isRecording={isRecording} 
              speed={speed} 
            />
            
            <TraveledPathLine traveledPath={traveledPath} />
            
            {showPlannedRoute && (
              <PlannedRouteLayer 
                activeTrip={activeTrip} 
                completedWaypoints={completedWaypoints} 
              />
            )}
            
            {showLandmarks && (
              <LandmarksLayer 
                nearbyLandmarks={nearbyLandmarks}
                upcomingLandmarks={upcomingLandmarks}
              />
            )}
            
            {/* Map updater component */}
            <MapUpdater position={position} shouldFollow={shouldFollowPosition} />
            
            {/* Indicador del nivel de zoom */}
            <ZoomLevelIndicator position="bottomright" showAlways={true} />
            
            {/* Añadir los depuradores - sólo visibles durante desarrollo */}
            {process.env.NODE_ENV === 'development' && (
              <>
                <div className="leaflet-top leaflet-right" style={{ top: '80px', zIndex: 1000 }}>
                  <TileDebugger tripId={tripId || activeTrip?.id} />
                </div>
                {/* <div className="leaflet-top leaflet-right" style={{ top: '130px', zIndex: 1000 }}>
                  <OfflineTileDebugger tripId={tripId || activeTrip?.id} />
                </div> */}
              </>
            )}
          </MapContainer>
          
          {/* Capa de superposición para notificaciones y controles */}
          <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-20">
            {/* Notifications and warnings - Ajustado top para no colisionar con el encabezado */}
            <NotificationOverlay 
              position={position} 
              navigationStatus={navigationStatus} 
            />

            {/* Selector de fuente de mapas - nuevo componente */}
            <div className="absolute top-4 right-4 pointer-events-auto z-50 w-48">
              <MapSourceSelector
                mapSource={mapSource}
                setMapSource={handleMapSourceChange}
                offlineMapsAvailable={offlineMapsAvailable}
                tripId={tripId || activeTrip?.id}
              />
            </div>
            
            {/* Control panel (overlay) - permitir eventos de puntero solo en el panel */}
            <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-auto">
              <ControlPanel
                isRecording={isRecording}
                activeTrip={activeTrip}
                startTrip={startTrip}
                endTrip={endTrip}
                navigationSidebarOpen={navigationSidebarOpen}
                setNavigationSidebarOpen={setNavigationSidebarOpen}
                showPlannedRoute={showPlannedRoute}
                setShowPlannedRoute={setShowPlannedRoute}
                showLandmarks={showLandmarks}
                setShowLandmarks={setShowLandmarks}
                downloadLandmarks={downloadLandmarks}
                createLandmark={createLandmark}
                centerOnPosition={centerOnPosition}
                clearPlannedTrip={clearPlannedTrip}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RealTimeMap