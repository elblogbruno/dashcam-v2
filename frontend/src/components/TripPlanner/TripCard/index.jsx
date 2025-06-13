import React, { useRef, useState } from 'react';
import TripInfo from './TripInfo';
import TripActionButtons from './TripActionButtons';
import DownloadProgress from './DownloadProgress';

const TripCard = ({ 
  trip, 
  onSelect, 
  onDelete, 
  onDownloadLandmarks,
  onDownloadGeodata,
  onDownloadBoth,
  onStartNavigation,
  onEdit,
  onManageLandmarks,
  onManageActualTrips,
  onImportLandmarksFromKml,
  onCancelDownload,
  isSelected,
  downloadingTrip,
  downloadProgress,
  isActiveTripId = false,
  geodataStats
}) => {
  const kmlFileInputRef = useRef(null);
  const [showDataDownloads, setShowDataDownloads] = useState(false);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const handleCardClick = () => {
    onSelect(trip);
  };

  // Función para manejar la importación de KML
  const handleKmlImport = (e) => {
    e.stopPropagation();
    kmlFileInputRef.current?.click();
  };

  const handleKmlFileChange = (e) => {
    const file = e.target.files[0];
    if (file && onImportLandmarksFromKml) {
      onImportLandmarksFromKml(trip.id, file);
    }
    // Reset the input
    e.target.value = '';
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-md overflow-hidden border-2 cursor-pointer transition-all touch-manipulation
        ${isSelected ? 'border-blue-500' : 'border-transparent'} 
        ${downloadingTrip === trip.id ? 'animate-pulse' : ''}`}
      onClick={handleCardClick}
    >
      <TripInfo trip={trip} formatDate={formatDate} />
      
      <DownloadProgress 
        downloadingTrip={downloadingTrip} 
        tripId={trip.id} 
        downloadProgress={downloadProgress} 
        onCancelDownload={() => onCancelDownload && onCancelDownload(trip.id)}
      />

      {/* Action buttons section */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="space-y-3">
          <TripActionButtons
            trip={trip}
            onDownloadLandmarks={onDownloadLandmarks}
            onDownloadGeodata={onDownloadGeodata}
            onDownloadBoth={onDownloadBoth}
            onStartNavigation={onStartNavigation}
            onEdit={onEdit}
            onDelete={onDelete}
            onManageLandmarks={onManageLandmarks}
            onManageActualTrips={onManageActualTrips}
            handleKmlImport={handleKmlImport}
            downloadingTrip={downloadingTrip}
            isActiveTripId={isActiveTripId}
            showDataDownloads={showDataDownloads}
            setShowDataDownloads={setShowDataDownloads}
          />
        </div>
      </div>

      {/* Hidden KML file input */}
      <input
        ref={kmlFileInputRef}
        type="file"
        accept=".kml,.kmz"
        onChange={handleKmlFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default TripCard;
