import React from 'react';
import { FaDownload, FaPlay, FaStop, FaEdit, FaTrash, FaCheck, FaMapMarkerAlt, FaSync } from 'react-icons/fa';

const TripCard = ({ 
  trip, 
  onSelect, 
  onDelete, 
  onDownloadLandmarks, 
  onStartNavigation,
  onEdit,
  onManageLandmarks,
  isSelected,
  downloadingTrip,
  downloadProgress,
  isActiveTripId = false  // Nueva prop para indicar si este viaje está activo actualmente
}) => {
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const handleCardClick = () => {
    onSelect(trip);
  };
  
  return (
    <div 
      className={`bg-white rounded-lg shadow-md overflow-hidden border-2 cursor-pointer transition-all
        ${isSelected ? 'border-dashcam-500' : 'border-transparent'} 
        ${downloadingTrip === trip.id ? 'animate-pulse' : ''}`}
      onClick={handleCardClick}
    >
      <div className="bg-dashcam-700 text-white p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-semibold truncate">{trip.name}</h3>
        <p className="text-xs sm:text-sm">
          {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
        </p>
      </div>
      
      <div className="p-3 sm:p-4">
        <div className="mb-2 sm:mb-3">
          <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Start Location:</p>
          <p className="text-xs sm:text-sm font-medium break-all">
            {trip.start_location && trip.start_location.lat !== undefined ? trip.start_location.lat.toFixed(6) : '0.000000'}, 
            {trip.start_location && trip.start_location.lon !== undefined ? trip.start_location.lon.toFixed(6) : '0.000000'}
          </p>
        </div>
        
        <div className="mb-2 sm:mb-3">
          <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">End Location:</p>
          <p className="text-xs sm:text-sm font-medium break-all">
            {trip.end_location && trip.end_location.lat !== undefined ? trip.end_location.lat.toFixed(6) : '0.000000'}, 
            {trip.end_location && trip.end_location.lon !== undefined ? trip.end_location.lon.toFixed(6) : '0.000000'}
          </p>
        </div>
        
        {trip.waypoints && trip.waypoints.length > 0 && (
          <div className="mb-2 sm:mb-3">
            <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">
              Waypoints: {trip.waypoints.length}
              {trip.waypoints[0].name && (
                <span className="text-xs text-gray-500 ml-2 hidden sm:inline">
                  (First: {trip.waypoints[0].name})
                </span>
              )}
            </p>
          </div>
        )}
        
        {trip.notes && (
          <div className="mb-2 sm:mb-3">
            <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Notes:</p>
            <p className="text-xs sm:text-sm text-gray-700 line-clamp-2">{trip.notes}</p>
          </div>
        )}

        {/* Download Progress Bar */}
        {downloadingTrip === trip.id && downloadProgress !== null && (
          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2.5 mb-2 sm:mb-4">
            <div 
              className="bg-dashcam-500 h-1.5 sm:h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(downloadProgress, 100)}%` }}
            ></div>
            <p className="text-xs text-gray-500 mt-0.5 sm:mt-1">
              Downloading landmarks: {downloadProgress.toFixed(0)}%
              {downloadProgress.detail && (
                <span className="block mt-0.5 sm:mt-1 text-xs italic line-clamp-1">
                  {downloadProgress.detail}
                </span>
              )}
            </p>
          </div>
        )}
        
        {/* First row of buttons - Delete and Edit */}
        <div className="mt-3 sm:mt-4 flex justify-between mb-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(trip.id);
            }}
            className="text-red-500 hover:text-red-700 flex items-center text-xs sm:text-sm"
          >
            <FaTrash className="mr-1" /> Delete
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(trip);
            }}
            className="py-0.5 sm:py-1 px-2 sm:px-3 rounded bg-amber-500 hover:bg-amber-600 text-white flex items-center text-xs sm:text-sm"
          >
            <FaEdit className="mr-1" /> Edit
          </button>
        </div>
        
        {/* Second row of buttons - Landmarks, Start, Download */}
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManageLandmarks(trip);
            }}
            className="py-0.5 sm:py-1 px-2 sm:px-3 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center flex-grow text-xs sm:text-sm"
          >
            <FaMapMarkerAlt className="mr-1" /> Landmarks
          </button>

          {new Date(trip.end_date) >= new Date() && (
            <>
              {isActiveTripId ? (
                <>
                  {/* Si este viaje está activo actualmente */}
                  <div className="py-1 px-3 bg-green-100 text-green-800 border border-green-300 rounded flex items-center gap-2 flex-grow mb-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs sm:text-sm font-medium">Viaje en progreso</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`¿Detener el viaje "${trip.name}" ahora? Se finalizará la grabación.`)) {
                        // Aquí llamamos al endpoint para detener el viaje
                        fetch('/api/trips/end', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        })
                        .then(response => response.json())
                        .then(data => {
                          if (data.status === 'success') {
                            alert(`¡Viaje "${trip.name}" finalizado! La grabación se ha detenido.`);
                            window.location.reload(); // Recargar la página para actualizar el estado
                          } else {
                            alert('Error al detener el viaje: ' + (data.detail || 'Error desconocido'));
                          }
                        })
                        .catch(error => {
                          console.error('Error al detener el viaje:', error);
                          alert('Error al detener el viaje. Consulta la consola para más detalles.');
                        });
                      }
                    }}
                    className="py-0.5 sm:py-1 px-2 sm:px-3 rounded bg-red-600 hover:bg-red-700 text-white flex items-center flex-grow text-xs sm:text-sm"
                  >
                    <FaStop className="mr-1" /> Detener Viaje
                  </button>
                </>
              ) : (
                <>
                  {/* Si el viaje no está activo */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartNavigation(trip);
                    }}
                    className="py-0.5 sm:py-1 px-2 sm:px-3 rounded bg-green-500 hover:bg-green-600 text-white flex items-center flex-grow text-xs sm:text-sm"
                  >
                    <FaPlay className="mr-1" /> Navegar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`¿Iniciar el viaje "${trip.name}" ahora? Se comenzará a grabar automáticamente.`)) {
                        // Aquí llamamos al endpoint para iniciar el viaje directamente
                        fetch('/api/trips/start', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ planned_trip_id: trip.id })
                        })
                        .then(response => response.json())
                        .then(data => {
                          if (data.status === 'success') {
                            alert(`¡Viaje "${trip.name}" iniciado! La grabación ha comenzado.`);
                            // Navegar a la vista del mapa en tiempo real
                            onStartNavigation(trip);
                          } else {
                            alert('Error al iniciar el viaje: ' + (data.detail || 'Error desconocido'));
                          }
                        })
                        .catch(error => {
                          console.error('Error al iniciar el viaje:', error);
                          alert('Error al iniciar el viaje. Consulta la consola para más detalles.');
                        });
                      }
                    }}
                    className="py-0.5 sm:py-1 px-2 sm:px-3 rounded bg-purple-600 hover:bg-purple-700 text-white flex items-center flex-grow text-xs sm:text-sm"
                  >
                    <FaPlay className="mr-1" /> Iniciar Viaje
                  </button>
                </>
              )}
            </>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadLandmarks(trip.id);
            }}
            disabled={downloadingTrip !== null}
            className={`py-0.5 sm:py-1 px-2 sm:px-3 rounded flex items-center flex-grow text-xs sm:text-sm ${
              trip.landmarks_downloaded && downloadingTrip !== trip.id
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : downloadingTrip !== null
                ? 'bg-dashcam-300 cursor-not-allowed'
                : 'bg-dashcam-500 hover:bg-dashcam-600 text-white'
            }`}
          >
            {trip.landmarks_downloaded && downloadingTrip !== trip.id ? (
              <>
                <FaSync className="mr-1" /> Actualizar POIs
              </>
            ) : downloadingTrip === trip.id ? (
              <>
                <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full mr-1"></div>
                Descargando...
              </>
            ) : (
              <>
                <FaDownload className="mr-1" /> Obtener POIs
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripCard;
