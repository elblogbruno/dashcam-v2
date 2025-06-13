import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const TripMap = ({ gpsTrack, landmarks, videoClips, trip }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([40.7128, -74.0060], 13);
    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing layers (except tile layer)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    let bounds = null;

    // Add GPS track as polyline
    if (gpsTrack && gpsTrack.length > 0) {
      const trackPoints = gpsTrack.map(point => [point.latitude, point.longitude]);
      
      const polyline = L.polyline(trackPoints, { 
        color: 'blue', 
        weight: 3,
        opacity: 0.7 
      }).addTo(map);

      bounds = polyline.getBounds();

      // Add start and end markers
      if (trackPoints.length > 0) {
        // Start marker (green)
        L.marker(trackPoints[0], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: green; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(map).bindPopup('Inicio del viaje');

        // End marker (red)
        if (trackPoints.length > 1) {
          L.marker(trackPoints[trackPoints.length - 1], {
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: red; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })
          }).addTo(map).bindPopup('Fin del viaje');
        }
      }
    }

    // Add landmarks
    if (landmarks && landmarks.length > 0) {
      landmarks.forEach((landmark) => {
        const marker = L.marker([landmark.lat, landmark.lon], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${landmark.is_priority_landmark ? 'red' : 'orange'}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        }).addTo(map);

        marker.bindPopup(`
          <strong>${landmark.landmark_name}</strong><br/>
          Tipo: ${landmark.landmark_type || 'N/A'}<br/>
          Tiempo: ${landmark.encounter_time ? new Date(landmark.encounter_time).toLocaleString() : 'N/A'}
          ${landmark.is_priority_landmark ? '<br/><em>Landmark Prioritario</em>' : ''}
        `);

        // Extend bounds to include landmark
        if (bounds) {
          bounds.extend([landmark.lat, landmark.lon]);
        } else {
          bounds = L.latLngBounds([[landmark.lat, landmark.lon]]);
        }
      });
    }

    // Add video clip locations
    if (videoClips && videoClips.length > 0) {
      videoClips.forEach((clip, index) => {
        if (clip.start_lat && clip.start_lon) {
          const marker = L.circleMarker([clip.start_lat, clip.start_lon], {
            radius: 5,
            fillColor: clip.quality === 'high' ? 'purple' : 'blue',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map);

          marker.bindPopup(`
            <strong>Video Clip #${clip.sequence_num || clip.id}</strong><br/>
            Calidad: ${clip.quality || 'N/A'}<br/>
            Inicio: ${clip.start_time ? new Date(clip.start_time).toLocaleString() : 'N/A'}<br/>
            ${clip.landmark_name ? `Landmark: ${clip.landmark_name}` : ''}
          `);

          // Extend bounds to include video clip
          if (bounds) {
            bounds.extend([clip.start_lat, clip.start_lon]);
          } else {
            bounds = L.latLngBounds([[clip.start_lat, clip.start_lon]]);
          }
        }
      });
    }

    // Fit map to bounds if we have any data
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      // Default view if no data
      map.setView([40.7128, -74.0060], 13);
    }

  }, [gpsTrack, landmarks, videoClips]);

  const hasData = (gpsTrack && gpsTrack.length > 0) || 
                  (landmarks && landmarks.length > 0) || 
                  (videoClips && videoClips.length > 0);

  return (
    <div className="relative">
      <div 
        ref={mapRef} 
        style={{ height: '400px', width: '100%' }}
        className="rounded-lg overflow-hidden"
      />
      
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75 rounded-lg">
          <div className="text-center">
            <p className="text-lg text-gray-500 mb-2">
              No hay datos para mostrar en el mapa
            </p>
            <p className="text-sm text-gray-500">
              El track GPS, landmarks y ubicaciones de videos aparecerán aquí cuando estén disponibles.
            </p>
          </div>
        </div>
      )}
      
      {hasData && (
        <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 rounded p-2 text-xs">
          <div className="flex flex-col space-y-1">
            {gpsTrack && gpsTrack.length > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-0.5 bg-blue-500"></div>
                <span>Track GPS ({gpsTrack.length} puntos)</span>
              </div>
            )}
            {landmarks && landmarks.length > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full border border-white"></div>
                <span>Landmarks ({landmarks.length})</span>
              </div>
            )}
            {videoClips && videoClips.length > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full border border-white"></div>
                <span>Videos ({videoClips.length})</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMap;
