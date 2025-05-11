import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { FaRoute, FaPlay } from 'react-icons/fa';

// Componente para ajustar el mapa cuando cambia el tamaño de la pantalla
const MapUpdater = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    if (positions && positions.length > 0) {
      try {
        // Crear un límite que incluya todas las posiciones
        const bounds = positions.reduce((bounds, position) => {
          return bounds.extend(position);
        }, map.getBounds());

        // Ajustar el mapa a esos límites con un pequeño padding
        map.fitBounds(bounds, { padding: [30, 30] });
      } catch (error) {
        console.error('Error adjusting map bounds:', error);
      }
    }
  }, [positions, map]);

  return null;
};

const TripMapPreview = ({ trip, onStartNavigation, isUpcoming }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (!trip) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-3 sm:p-4">
          <FaRoute className="text-2xl sm:text-4xl text-gray-400 mx-auto mb-1 sm:mb-2" />
          <p className="text-gray-500 text-sm sm:text-base">Select a trip to preview route</p>
        </div>
      </div>
    );
  }

  // Extract positions for the polyline
  const positions = [
    [trip.start_location.lat, trip.start_location.lon],
    ...(trip.waypoints || []).map(wp => [wp.lat, wp.lon]),
    [trip.end_location.lat, trip.end_location.lon]
  ];

  // Ajuste dinámico del zoom según el tamaño de la pantalla
  const getZoomLevel = () => {
    if (windowWidth < 640) return 8;
    if (windowWidth < 1024) return 9;
    return 10;
  };

  return (
    <>
      <MapContainer 
        center={[trip.start_location.lat, trip.start_location.lon]} 
        zoom={getZoomLevel()} 
        style={{ height: '100%', width: '100%' }}
        key={`map-${trip.id}-${positions.length}-${windowWidth}`} // Force re-render when trip, waypoints, or screen size changes
        zoomControl={windowWidth > 640} // Mostrar controles de zoom solo en pantallas más grandes
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Start location marker */}
        <Marker position={[trip.start_location.lat, trip.start_location.lon]}>
          <Popup>
            <div className="text-xs sm:text-sm">
              <strong>Start:</strong> {trip.start_location.name || 'Origin'}
            </div>
          </Popup>
        </Marker>
        
        {/* End location marker */}
        <Marker position={[trip.end_location.lat, trip.end_location.lon]}>
          <Popup>
            <div className="text-xs sm:text-sm">
              <strong>End:</strong> {trip.end_location.name || 'Destination'}
            </div>
          </Popup>
        </Marker>
        
        {/* Waypoint markers */}
        {trip.waypoints && trip.waypoints.map((waypoint, index) => (
          <Marker key={index} position={[waypoint.lat, waypoint.lon]}>
            <Popup>
              <div className="text-xs sm:text-sm">
                {waypoint.name || `Waypoint ${index + 1}`}
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Route line */}
        <Polyline
          positions={positions}
          color="#0284c7"
          weight={windowWidth < 640 ? 3 : 4} // Línea más delgada en dispositivos móviles
          opacity={0.7}
        />
        
        {/* Componente para centrar el mapa en todos los puntos */}
        <MapUpdater positions={positions} />
      </MapContainer>

      <div className="p-3 sm:p-4 border-t border-gray-200">
        <h4 className="font-medium text-sm sm:text-base mb-1 sm:mb-2">Trip Details</h4>
        <p className="text-xs sm:text-sm text-gray-600">
          <strong>Dates:</strong> {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
        </p>
        {trip.waypoints && trip.waypoints.length > 0 && (
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            <strong>Waypoints:</strong> {trip.waypoints.length}
          </p>
        )}
        {trip.notes && (
          <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
            <strong>Notes:</strong> {trip.notes}
          </p>
        )}
        {isUpcoming && (
          <button
            onClick={() => onStartNavigation(trip)}
            className="w-full mt-2 sm:mt-3 py-1 sm:py-2 bg-dashcam-600 hover:bg-dashcam-700 text-white rounded-md flex items-center justify-center text-xs sm:text-sm"
          >
            <FaPlay className="mr-1" /> Start Navigation
          </button>
        )}
      </div>
    </>
  );
};

export default TripMapPreview;
