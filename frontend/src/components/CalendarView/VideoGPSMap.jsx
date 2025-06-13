import React, { useEffect, useState } from 'react';
import { MapContainer, Polyline, Marker, useMap } from 'react-leaflet';
import { FaExpand, FaCompress, FaTimes } from 'react-icons/fa';
import 'leaflet/dist/leaflet.css';
import OfflineTileLayer from '../Maps/OfflineTileLayer';

// Fix for default markers in react-leaflet
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Componente para ajustar el mapa automáticamente a los puntos GPS
const MapFitBounds = ({ track }) => {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (track && track.length > 0) {
        try {
          // Forzar invalidación del tamaño del mapa
          map.invalidateSize();
          
          const bounds = L.latLngBounds(track.map(point => [point.lat, point.lon]));
          
          // Añadir un poco de padding alrededor de los puntos
          if (track.length === 1) {
            // Para un solo punto, centrar con zoom apropiado
            map.setView([track[0].lat, track[0].lon], 16);
          } else {
            // Para múltiples puntos, ajustar a todos los puntos
            map.fitBounds(bounds, { padding: [20, 20] });
          }
        } catch (error) {
          console.error('Error adjusting map bounds:', error);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [track, map]);

  return null;
};

const VideoGPSMap = ({ gpsMetadata, compact = true, onToggleView = null, onClose = null, tripId = null, locationInfo = null }) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Pequeño delay para asegurar que el DOM esté listo
    setTimeout(() => {
      setMapReady(true);
    }, 100);
  }, []);

  if (!gpsMetadata || !gpsMetadata.track || gpsMetadata.track.length === 0) {
    return (
      <div className="bg-gray-800 text-white p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Datos GPS</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaTimes size={12} />
            </button>
          )}
        </div>
        <p className="text-gray-400 text-xs">No hay datos GPS disponibles para este clip</p>
      </div>
    );
  }

  const track = gpsMetadata.track;
  const startPoint = track[0];
  const endPoint = track[track.length - 1];

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (onToggleView) {
      onToggleView(!isExpanded);
    }
  };

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden shadow-xl transition-all duration-300 ${
      isExpanded ? 'w-96 h-80' : 'w-80 h-48'
    }`}>
      {/* Header */}
      <div className="bg-gray-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-white text-sm font-semibold">Ruta GPS</h3>
          <span className="text-gray-400 text-xs">
            {gpsMetadata.total_distance ? `${gpsMetadata.total_distance.toFixed(0)}m` : ''}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleExpanded}
            className="text-gray-400 hover:text-white transition-colors"
            title={isExpanded ? "Contraer" : "Expandir"}
          >
            {isExpanded ? <FaCompress size={12} /> : <FaExpand size={12} />}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              title="Cerrar"
            >
              <FaTimes size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Mapa */}
      <div className="relative w-full h-full">
        {mapReady ? (
          <MapContainer
            style={{ height: '100%', width: '100%' }}
            center={[startPoint.lat, startPoint.lon]}
            zoom={16}
            className="z-10 leaflet-container-custom"
            key={`gps-map-${track.length}-${isExpanded}`}
            whenReady={(mapInstance) => {
              // Force map resize when ready
              const map = mapInstance.target;
              setTimeout(() => {
                map.invalidateSize();
              }, 200);
            }}
          >
            {/* Usar OfflineTileLayer igual que en otros mapas */}
            <OfflineTileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              tripId={tripId}
            />
            
            {/* Ajustar mapa a los puntos GPS */}
            <MapFitBounds track={track} />
            
            {/* Línea de la ruta */}
            <Polyline
              positions={track.map(point => [point.lat, point.lon])}
              pathOptions={{
                color: '#3b82f6',
                weight: 4,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
            
            {/* Marcador de inicio */}
            <Marker
              position={[startPoint.lat, startPoint.lon]}
              icon={startIcon}
            />
            
            {/* Marcador de fin (si es diferente del inicio) */}
            {track.length > 1 && (
              <Marker
                position={[endPoint.lat, endPoint.lon]}
                icon={endIcon}
              />
            )}
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-300 text-xs">Cargando mapa...</p>
            </div>
          </div>
        )}
      </div>

      {/* Info adicional */}
      <div className="bg-gray-800 p-2 text-xs text-gray-300">
        <div className="flex justify-between items-center">
          <span>Puntos: {gpsMetadata.point_count || track.length}</span>
          <span>
            {startPoint.lat.toFixed(6)}, {startPoint.lon.toFixed(6)}
          </span>
        </div>
        
        {/* Información de ubicación de geocodificación inversa */}
        {locationInfo && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-blue-400 font-semibold">📍</span>
              <span className="text-white font-medium">
                {locationInfo.city || locationInfo.town || locationInfo.village || 'Ubicación'}
                {locationInfo.country && `, ${locationInfo.country}`}
              </span>
            </div>
            
            {locationInfo.display_name && (
              <div className="text-gray-400 text-xs leading-relaxed">
                {locationInfo.display_name}
              </div>
            )}
            
            {locationInfo.timestamp && (
              <div className="text-gray-500 text-xs mt-1">
                Geocodificado: {new Date(locationInfo.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoGPSMap;
