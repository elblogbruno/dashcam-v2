import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { MapContainer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Importar el nuevo sistema de diseño
import { Card, Alert } from '../components/common/UI'
import { Stack, Flex } from '../components/common/Layout'

// Importar componentes
import OfflineTileLayer from '../components/Maps/OfflineTileLayer'
import MapUpdater from '../components/map/MapUpdater'
import { CurrentPositionMarker, TraveledPathLine, PlannedRouteLayer, LandmarksLayer } from '../components/map/MapLayers'
import ZoomLevelIndicator from '../components/Maps/ZoomLevelIndicator'
import StatusBar from '../components/map/StatusBar'
import ControlPanel from '../components/map/ControlPanel'
import NavigationSidebar from '../components/map/NavigationSidebar'
import NotificationOverlay from '../components/map/NotificationOverlay'
import TileDebugger from '../components/Maps/TileDebugger'
import OfflineTileDebugger from '../components/Maps/OfflineTileDebugger'

// Importar utilidades
import { getDistanceBetweenCoordinates } from '../utils/mapHelpers'
import webSocketManager from '../services/WebSocketManager'

function RealTimeMap() {
  const [position, setPosition] = useState(null)
  const [heading, setHeading] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [shouldFollowPosition, setShouldFollowPosition] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStartTime, setRecordingStartTime] = useState(null)
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
    const savedPreference = localStorage.getItem('preferredMapSource')
    return savedPreference || 'auto'
  })
  const [offlineMapsAvailable, setOfflineMapsAvailable] = useState(false)
  
  // Default map location when GPS is not available
  const defaultMapLocation = [37.7749, -122.4194] // Default to San Francisco
  
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)

  // Estado para controlar errores del mapa
  const [mapError, setMapError] = useState(null);

  // Función para manejar errores del mapa
  const handleMapError = (error) => {
    console.error("Error en el mapa:", error);
    setMapError(error.message || "Error desconocido en el mapa");
    
    setTimeout(() => {
      setMapError(null);
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
    const savedTrip = localStorage.getItem('activeTrip')
    if (savedTrip) {
      try {
        setActiveTrip(JSON.parse(savedTrip))
        setStatusMessage('Planned trip loaded')
      } catch (e) {
        console.error('Error parsing saved trip:', e)
      }
    }
    
    const checkActiveTrip = async () => {
      try {
        const response = await fetch('/api/trips/active')
        const data = await response.json()
        
        if (data.status === 'success' && data.active_trip) {
          setIsRecording(true)
          setTripId(data.active_trip.trip_id)
          
          if (data.active_trip.planned_trip_id) {
            try {
              const tripResponse = await fetch(`/api/trip-planner/${data.active_trip.planned_trip_id}`)
              const tripData = await tripResponse.json()
              if (tripData) {
                setActiveTrip(tripData)
                localStorage.setItem('activeTrip', JSON.stringify(tripData))
                
                setTimeout(() => {
                  alert(`¡Estás en un viaje activo: ${tripData.name}!\nLa grabación está en curso.`);
                }, 500);
              }
            } catch (err) {
              console.error('Error loading active planned trip:', err)
            }
          } else {
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

    let allPoints = [
      { ...activeTrip.start_location, name: 'Start' },
      ...(activeTrip.waypoints || []).map((wp, i) => ({ 
        ...wp, 
        name: wp.name || `Waypoint ${i+1}` 
      })),
      { ...activeTrip.end_location, name: 'Destination' }
    ]
    
    allPoints = allPoints.filter((_, index) => !completedWaypoints.includes(index))
    
    if (allPoints.length === 0) {
      setNavigationStatus({
        message: 'Trip complete!',
        distance: 0,
        nextPoint: null
      })
      return
    }
    
    const nextPoint = allPoints[0]
    const distance = getDistanceBetweenCoordinates(
      position[0], position[1], 
      nextPoint.lat, nextPoint.lon
    )
    
    if (distance < 50 && allPoints.length > 1) {
      const waypointIndex = completedWaypoints.length
      setCompletedWaypoints([...completedWaypoints, waypointIndex])
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
          if (data.type === 'location_update') {
            const { lat, lon, heading, speed } = data
            
            if (lat && lon) {
              setPosition([lat, lon])
              setHeading(heading || 0)
              setSpeed(speed || 0)
              
              if (isRecording && lat && lon) {
                setTraveledPath(prev => [...prev, [lat, lon]])
              }
            }
          }
          
          if (data.type === 'recording_status') {
            const wasRecording = isRecording;
            setIsRecording(data.recording)
            
            // Si empezó a grabar y no estaba grabando antes, establecer tiempo de inicio
            if (data.recording && !wasRecording) {
              setRecordingStartTime(new Date().toISOString())
            }
            // Si paró de grabar, limpiar tiempo de inicio
            else if (!data.recording && wasRecording) {
              setRecordingStartTime(null)
            }
            
            if (data.trip_id) {
              setTripId(data.trip_id)
            }
          }
          
          if (data.type === 'landmarks_update') {
            if (data.nearby) {
              setNearbyLandmarks(data.nearby)
            }
            
            if (data.upcoming) {
              setUpcomingLandmarks(data.upcoming)
            }
          }
          
          if (data.type === 'status') {
            setStatusMessage(data.message)
          }
          
          if (data.type === 'status_update') {
            if (data.location) {
              const { lat, lon, heading, speed } = data.location
              if (lat && lon) {
                setPosition([lat, lon])
                setHeading(heading || 0)
                setSpeed(speed || 0)
                
                if (isRecording && lat && lon) {
                  setTraveledPath(prev => [...prev, [lat, lon]])
                }
              }
            }
            
            if (data.recording !== undefined) {
              const wasRecording = isRecording;
              setIsRecording(data.recording)
              
              // Si empezó a grabar y no estaba grabando antes, establecer tiempo de inicio
              if (data.recording && !wasRecording) {
                setRecordingStartTime(new Date().toISOString())
              }
              // Si paró de grabar, limpiar tiempo de inicio
              else if (!data.recording && wasRecording) {
                setRecordingStartTime(null)
              }
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
    webSocketManager.addListener('realtime-map', handleWebSocketEvent)
    webSocketManager.connect()
    
    return () => {
      webSocketManager.removeListener('realtime-map')
    }
  }, [handleWebSocketEvent])
  
  // Function to start a new trip
  const startTrip = async () => {
    try {
      setStatusMessage('Starting new trip...')
      
      const payload = activeTrip ? { planned_trip_id: activeTrip.id } : {}
      
      const response = await axios.post('/api/trips/start', payload)
      setIsRecording(true)
      setRecordingStartTime(new Date().toISOString())
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
    const tripName = activeTrip ? activeTrip.name : "actual";
    if (!window.confirm(`¿Estás seguro de que quieres finalizar el viaje ${tripName}?\n\nSe detendrá la grabación y se guardarán todos los datos del viaje.`)) {
      return;
    }
    
    try {
      setStatusMessage('Finalizando viaje...')
      await axios.post('/api/trips/end')
      setIsRecording(false)
      setRecordingStartTime(null)
      setTripId(null)
      setStatusMessage('Viaje finalizado correctamente')
      
      localStorage.removeItem('activeTrip')
      setActiveTrip(null)
      
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
        radius_m: 100
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

  // Efecto para ajustar tamaño del mapa
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [navigationSidebarOpen]);

  return (
    <div className="h-screen flex flex-col">
      {/* Error del mapa */}
      {mapError && (
        <Alert
          type="error"
          title="Error del Mapa"
          message={mapError}
          className="m-4"
        />
      )}

      {/* Contenedor del mapa con overlays */}
      <div className="flex-1 relative">
        {/* Status bar del mapa - posicionado en la parte superior */}
        <StatusBar
          connectionStatus={connectionStatus}
          position={position}
          speed={speed}
          isRecording={isRecording}
          statusMessage={statusMessage}
          navigationStatus={navigationStatus}
          recordingStartTime={recordingStartTime}
          heading={heading}
        />
        
        {/* Mapa principal - con margen superior para el StatusBar mejorado */}
        <div className="absolute inset-0 pt-16 sm:pt-20 md:pt-16">
          <MapContainer
            center={position || defaultMapLocation}
            zoom={15}
            className="h-full w-full"
            ref={mapRef}
            zoomControl={false}
            whenReady={(map) => {
              mapRef.current = map.target;
              map.target.on('drag', handleMapDrag);
              map.target.on('error', handleMapError);
              
              setTimeout(() => map.target.invalidateSize(), 100);
              setTimeout(() => map.target.invalidateSize(), 500);
            }}
          >
            {/* Capa de tiles */}
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
            
            {/* Marcadores y capas */}
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
            
            <MapUpdater 
              position={position}
              shouldFollow={shouldFollowPosition}
              mapRef={mapRef}
            />

            {/* Indicador del nivel de zoom */}
            <ZoomLevelIndicator position="bottomright" showAlways={true} />
            
            {/* Depuradores solo en desarrollo */}
            {process.env.NODE_ENV === 'development' && (
              <div className="leaflet-top leaflet-right" style={{ top: '80px', zIndex: 30 }}>
                <TileDebugger tripId={tripId || activeTrip?.id} />
              </div>
            )}
          </MapContainer>
        </div>

        {/* Overlays del mapa */}
        {/* Warning GPS */}
        {showGpsWarning && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
            <Alert
              type="warning"
              title="Sin señal GPS"
              message="Esperando señal GPS para mostrar la ubicación actual"
              className="pointer-events-auto"
            />
          </div>
        )}

        {/* Información de posición */}
        {position && (
          <Card className="absolute bottom-4 left-4 z-40 pointer-events-auto max-w-xs">
            <Stack gap="sm" className="text-sm">
              <Flex justify="between">
                <span className="text-gray-600">Lat:</span>
                <span className="font-mono">{position[0].toFixed(6)}</span>
              </Flex>
              <Flex justify="between">
                <span className="text-gray-600">Lng:</span>
                <span className="font-mono">{position[1].toFixed(6)}</span>
              </Flex>
              <Flex justify="between">
                <span className="text-gray-600">Rumbo:</span>
                <span className="font-mono">{heading.toFixed(1)}°</span>
              </Flex>
            </Stack>
          </Card>
        )}

        {/* Panel de control */}
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
          mapSource={mapSource}
          setMapSource={handleMapSourceChange}
          offlineMapsAvailable={offlineMapsAvailable}
          tripId={tripId || activeTrip?.id}
        />

        {/* Sidebar de navegación */}
        <NavigationSidebar
          isOpen={navigationSidebarOpen}
          onClose={() => setNavigationSidebarOpen(false)}
          navigationStatus={navigationStatus}
          upcomingLandmarks={upcomingLandmarks}
          activeTrip={activeTrip}
        />

        {/* Overlay de notificaciones */}
        <NotificationOverlay notifications={[]} />
      </div>
    </div>
  )
}

export default RealTimeMap
