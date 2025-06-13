import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { FaRoute } from 'react-icons/fa';
import OfflineTileLayer from '../Maps/OfflineTileLayer';

// Componente para ajustar el mapa cuando cambia el tamaño de la pantalla
const MapUpdater = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    // Pequeño delay para asegurar que el mapa esté completamente renderizado
    const timer = setTimeout(() => {
      if (positions && positions.length > 0) {
        try {
          // Forzar invalidación del tamaño del mapa
          map.invalidateSize();
          
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
    }, 100);

    return () => clearTimeout(timer);
  }, [positions, map]);

  return null;
};

const TripMapPreview = ({ trip, forceUpdate }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [mapReady, setMapReady] = useState(false);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Effect para forzar re-render cuando forceUpdate cambia
  useEffect(() => {
    if (forceUpdate !== undefined) {
      setMapReady(false);
      // Pequeño delay para asegurar que el DOM esté listo
      setTimeout(() => {
        setMapReady(true);
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }, 200);
    } else {
      setMapReady(true);
    }
  }, [forceUpdate, trip]);

  // Asegurar que el mapa se inicialice cuando el componente se monta
  useEffect(() => {
    if (trip && !mapReady) {
      setTimeout(() => {
        setMapReady(true);
      }, 100);
    }
  }, [trip, mapReady]);

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
    <div className="map-preview-container  h-full w-full">
      {!trip ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="text-center p-3 sm:p-4">
            <FaRoute className="text-2xl sm:text-4xl text-gray-400 mx-auto mb-1 sm:mb-2" />
            <p className="text-gray-500 text-sm sm:text-base">Select a trip to preview route</p>
          </div>
        </div>
      ) : mapReady ? (
        <MapContainer 
          center={[trip.start_location.lat, trip.start_location.lon]} 
          zoom={getZoomLevel()} 
          className="leaflet-container-custom"
          key={`map-${trip.id}-${positions.length}-${windowWidth}-${forceUpdate || 0}`}
          zoomControl={windowWidth > 640}
          whenReady={(mapInstance) => {
            // Force map resize when ready
            const map = mapInstance.target;
              setTimeout(() => {
                map.invalidateSize();
                // Ajustar bounds después de invalidar tamaño
                if (positions && positions.length > 0) {
                  try {
                    const bounds = positions.reduce((bounds, position) => {
                      return bounds.extend(position);
                    }, map.getBounds());
                    map.fitBounds(bounds, { padding: [30, 30] });
                  } catch (error) {
                    console.error('Error fitting bounds:', error);
                  }
                }
              }, 200);
            }}
          >
            <OfflineTileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              tripId={trip.id}
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
              color="#2563eb"
              weight={windowWidth < 640 ? 3 : 4}
              opacity={0.7}
            />
            
            {/* Componente para centrar el mapa en todos los puntos */}
            <MapUpdater positions={positions} />
          </MapContainer>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMapPreview;
