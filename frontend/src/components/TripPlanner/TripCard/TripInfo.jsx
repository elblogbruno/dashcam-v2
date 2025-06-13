import React from 'react';

const TripInfo = ({ trip, formatDate }) => {
  return (
    <>
      {/* Header */}
      <div className="bg-blue-700 text-white p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-semibold truncate">{trip.name}</h3>
        <p className="text-xs sm:text-sm opacity-90">
          {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
        </p>
      </div>
      
      {/* Location info - more compact on mobile */}
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-600 mb-1">Start:</p>
            <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">
              {trip.start_location && trip.start_location.lat !== undefined ? trip.start_location.lat.toFixed(4) : '0.0000'}, 
              {trip.start_location && trip.start_location.lon !== undefined ? trip.start_location.lon.toFixed(4) : '0.0000'}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-gray-600 mb-1">End:</p>
            <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">
              {trip.end_location && trip.end_location.lat !== undefined ? trip.end_location.lat.toFixed(4) : '0.0000'}, 
              {trip.end_location && trip.end_location.lon !== undefined ? trip.end_location.lon.toFixed(4) : '0.0000'}
            </p>
          </div>
        </div>
        
        {trip.waypoints && trip.waypoints.length > 0 && (
          <div>
            <p className="text-xs text-gray-600">
              <span className="font-medium">{trip.waypoints.length}</span> waypoint{trip.waypoints.length !== 1 ? 's' : ''}
              {trip.waypoints[0].name && (
                <span className="text-gray-500 ml-1 hidden sm:inline">
                  (First: {trip.waypoints[0].name})
                </span>
              )}
            </p>
          </div>
        )}
        
        {trip.notes && (
          <div>
            <p className="text-xs text-gray-600 mb-1">Notes:</p>
            <p className="text-xs sm:text-sm text-gray-700 line-clamp-2">{trip.notes}</p>
          </div>
        )}
      </div>
    </>
  );
};

export default TripInfo;
