import React from 'react';
import VideoGPSMap from '../VideoGPSMap';

const GPSOverlay = ({ gpsMetadata, clipMetadata, onClose }) => {
  // Función para extraer información de ubicación del clip
  const getLocationInfo = () => {
    if (!clipMetadata?.location) return null;
    
    try {
      const locationData = typeof clipMetadata.location === 'string' 
        ? JSON.parse(clipMetadata.location) 
        : clipMetadata.location;
      
      return locationData;
    } catch (e) {
      console.error('Error parsing location data:', e);
      return null;
    }
  };

  const locationInfo = getLocationInfo();

  return (
    <div className="absolute top-4 right-4 pointer-events-auto z-50">
      <VideoGPSMap 
        gpsMetadata={gpsMetadata}
        compact={true}
        onToggleView={(expanded) => {
          console.log('GPS map view toggled, expanded:', expanded);
        }}
        onClose={onClose}
        tripId={clipMetadata?.trip_id || null}
        locationInfo={locationInfo}
      />
    </div>
  );
};

export default GPSOverlay;
