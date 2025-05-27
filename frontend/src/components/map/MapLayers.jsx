import { Marker, Popup, Circle, Polyline } from 'react-leaflet'
import { carIcon, startIcon, destinationIcon, waypointIcon, createColoredIcon } from './MapIcons'
import LandmarkMarker from '../Maps/LandmarkMarker'

// Componente para el marcador de posición actual
export function CurrentPositionMarker({ position, isRecording, speed }) {
  if (!position) return null
  
  return (
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
  )
}

// Componente para la ruta recorrida
export function TraveledPathLine({ traveledPath }) {
  if (traveledPath.length <= 1) return null
  
  return (
    <Polyline 
      positions={traveledPath} 
      color="#4a69bd" 
      weight={4} 
      opacity={0.7} 
    />
  )
}

// Componente para la ruta planificada
export function PlannedRouteLayer({ activeTrip, completedWaypoints }) {
  if (!activeTrip) return null
  
  const getPlannedRoutePoints = () => {
    return [
      [activeTrip.start_location.lat, activeTrip.start_location.lon],
      ...(activeTrip.waypoints || []).map(wp => [wp.lat, wp.lon]),
      [activeTrip.end_location.lat, activeTrip.end_location.lon]
    ]
  }
  
  return (
    <>
      <Polyline
        positions={getPlannedRoutePoints()}
        color="#F44336"
        weight={4}
        opacity={0.7}
        dashArray="10, 10"
      />
      
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
  )
}

// Componente para los puntos de interés
export function LandmarksLayer({ nearbyLandmarks, upcomingLandmarks }) {
  return (
    <>
      {nearbyLandmarks.map(landmark => (
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
          <LandmarkMarker 
            landmark={landmark}
            icon={createColoredIcon('#1dd1a1')}
          />
        </Circle>
      ))}
      
      {upcomingLandmarks.map(landmark => (
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
          <LandmarkMarker 
            landmark={landmark}
            icon={createColoredIcon('#feca57')}
          >
            {landmark.distance && (
              <p className="text-xs text-gray-500">
                {(landmark.distance / 1000).toFixed(1)}km ahead
              </p>
            )}
          </LandmarkMarker>
        </Circle>
      ))}
    </>
  )
}
