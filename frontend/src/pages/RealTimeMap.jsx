import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { MapContainer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { FaMapMarkerAlt } from 'react-icons/fa'
import { MdWarning } from 'react-icons/md'

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
import webSocketManager from '../services/WebSocketManager'

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
  
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null) // Añadir referencia para el contenedor del mapa

  // Añadir estado para controlar errores del mapa
  const [mapError, setMapError] = useState(null);

  // Función para manejar errores del mapa
  const handleMapError = (error) => {
    console.error("Error en el mapa:", error);
    setMapError(error.message || "Error desconocido en el mapa");
    
    // Intentar recuperarse del error después de un tiempo
    setTimeout(() => {
      setMapError(null);
      // Intentar inicializar el mapa de nuevo si es necesario
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 5000);
  };

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
  
  // Handle WebSocket events through centralized manager
  const handleWebSocketEvent = useCallback((eventType, data) => {
    switch (eventType) {
      case 'connected':
        setConnectionStatus('connected')
        setStatusMessage('Connected to server')
        break
      case 'disconnected':
        setConnectionStatus('disconnected')
        setStatusMessage('Disconnected from server')
        break
      case 'error':
        setConnectionStatus('disconnected')
        setStatusMessage('Connection error')
        break
      case 'message':
        try {
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
          
          // Handle status_update messages (new format)
          if (data.type === 'status_update') {
            if (data.location) {
              const { lat, lon, heading, speed } = data.location
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
            
            if (data.recording !== undefined) {
              setIsRecording(data.recording)
            }
            
            if (data.trip_id) {
              setTripId(data.trip_id)
            }
            
            if (data.message) {
              setStatusMessage(data.message)
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e)
        }
        break
      case 'reconnect_failed':
        setStatusMessage('Failed to reconnect to server')
        break
    }
  }, [isRecording])

  // Initialize WebSocket connection through centralized manager
  useEffect(() => {
    // Register this component as a listener
    webSocketManager.addListener('realtime-map', handleWebSocketEvent)
    
    // Initialize connection if not already connected
    webSocketManager.connect()
    
    return () => {
      // Remove listener when component unmounts
      webSocketManager.removeListener('realtime-map')
    }
  }, [handleWebSocketEvent])
  
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

  // Efecto para ajustar tamaño del mapa cuando cambian dependencias importantes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [navigationSidebarOpen]);

  // Añadir función para formatear la velocidad
  const formatSpeed = (speedMs) => {
    const speedKmh = speedMs * 3.6; // Convertir m/s a km/h
    return `${speedKmh.toFixed(1)} km/h`;
  };

  // Función para formatear la fecha y hora actual
  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 w-full">
      {/* Header mejorado con más información y funcionalidades - optimizado para móvil */}
      <div className="p-1 sm:p-2 md:p-4 bg-gradient-to-r from-dashcam-900 to-dashcam-700 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <div className="flex items-center">
            <FaMapMarkerAlt className="text-dashcam-300 mr-1 sm:mr-2 text-lg sm:text-xl" />
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Mapa en Tiempo Real</h1>
          </div>
          
          <div className="flex flex-wrap items-center mt-1 sm:mt-2 text-xs sm:text-sm">
            {/* Información de estado - versión compacta en móvil */}
            <div className={`mr-2 sm:mr-4 flex items-center px-1 py-0.5 sm:px-2 sm:py-1 rounded-full ${connectionStatus === 'connected' ? 'bg-green-600' : 'bg-red-600'}`}>
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-300' : 'bg-red-300'} mr-1 sm:mr-2`}></div>
              <span className="hidden xs:inline">{connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}</span>
            </div>
            
            {/* Información de velocidad - versión compacta en móvil */}
            <div className="mr-2 sm:mr-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{speed ? formatSpeed(speed) : '0.0 km/h'}</span>
            </div>
            
            {/* Estado de grabación - sin texto en móvil muy pequeño */}
            <div className={`mr-2 sm:mr-4 flex items-center ${isRecording ? 'text-red-400' : 'text-gray-300'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 ${isRecording ? 'animate-pulse' : ''}`} fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span className="hidden xs:inline">{isRecording ? 'Grabando' : 'Sin grabar'}</span>
            </div>
            
            {/* Mostrar nombre del viaje activo si existe - versión compacta */}
            {activeTrip && (
              <div className="bg-dashcam-600 px-1 py-0.5 sm:px-2 sm:py-1 rounded-md flex items-center text-dashcam-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="truncate max-w-[80px] sm:max-w-[150px]">{activeTrip.name}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Barra de estado secundaria - oculta en móviles muy pequeños */}
        <div className="hidden xs:flex justify-between items-center mt-0.5 sm:mt-2 text-xs text-dashcam-100">
          <div className="truncate max-w-[70%]">
            {statusMessage && <span>{statusMessage}</span>}
          </div>
          <div className="text-right text-2xs sm:text-xs">
            {getCurrentDateTime()}
          </div>
        </div>
      </div>
        
      {/* Main content with map and sidebar */}
      <div className="flex-grow flex relative w-full overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200">
        {/* Navigation sidebar - necesita z-index alto */}
        <div className="z-30 h-full absolute top-0 left-0">
          <NavigationSidebar
            activeTrip={activeTrip}
            navigationSidebarOpen={navigationSidebarOpen}
            setNavigationSidebarOpen={setNavigationSidebarOpen}
            completedWaypoints={completedWaypoints}
            navigationStatus={navigationStatus}
          />
        </div>
        
        {/* Map container with padding-bottom for mobile navigation */}
        <div className="flex-grow relative w-full flex flex-col pb-16 md:pb-0" ref={mapContainerRef}>
          {mapError && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg flex items-center">
              <MdWarning className="mr-2" size={20} />
              <span>Error de inicialización del mapa: {mapError}</span>
            </div>
          )}
          
          <MapContainer 
            center={position || defaultMapLocation} 
            zoom={15} 
            style={{ height: 'calc(100vh - 110px)', width: '100%', maxHeight: 'calc(100% - 0px)' }} 
            ref={mapRef}
            whenReady={(map) => {
              // Usar whenReady en lugar de whenCreated (que está obsoleto)
              mapRef.current = map.target;
              map.target.on('drag', handleMapDrag);
              map.target.on('error', handleMapError);
              
              // Asegurar que el mapa se ajuste correctamente
              setTimeout(() => map.target.invalidateSize(), 100);
              setTimeout(() => map.target.invalidateSize(), 500);
            }}
            className="z-0 leaflet-container-custom shadow-inner"
            zoomControl={false}
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
              heading={heading}
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
              </>
            )}
          </MapContainer>
          
          {/* Capa de superposición para notificaciones y controles */}
          <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-20">
            {/* Notifications and warnings */}
            <NotificationOverlay 
              position={position} 
              navigationStatus={navigationStatus} 
            />

            {/* Panel de estadísticas flotante */}
            {position && (
              <div className="absolute top-4 left-4 pointer-events-auto">
                <div className="bg-black bg-opacity-70 text-white p-3 rounded-lg shadow-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300">Coordenadas:</span>
                    <span className="font-mono">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Rumbo:</span>
                    <span className="font-mono">{heading.toFixed(1)}°</span>
                  </div>
                </div>
              </div>
            )}

            {/* Selector de fuente de mapas */}
            <div className="absolute top-4 right-4 pointer-events-auto z-50 w-48">
              <MapSourceSelector
                mapSource={mapSource}
                setMapSource={handleMapSourceChange}
                offlineMapsAvailable={offlineMapsAvailable}
                tripId={tripId || activeTrip?.id}
              />
            </div>
            
            {/* Panel de control - Ahora usando el componente renovado */}
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
  )
}

export default RealTimeMap