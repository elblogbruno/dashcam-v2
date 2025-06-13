import React from 'react';
import { FaDownload, FaPlay, FaStop, FaEdit, FaTrash, FaCheck, FaMapMarkerAlt, FaSync, FaFileImport, FaGlobe, FaCarSide } from 'react-icons/fa';

const TripActionButtons = ({
  trip,
  onDownloadLandmarks,
  onDownloadGeodata,
  onDownloadBoth,
  onStartNavigation,
  onEdit,
  onDelete,
  onManageLandmarks,
  onManageActualTrips,
  handleKmlImport,
  downloadingTrip,
  isActiveTripId,
  showDataDownloads,
  setShowDataDownloads
}) => {
  return (
    <div className="flex flex-col space-y-2">
      {/* Navigation and Management buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartNavigation(trip);
          }}
          disabled={downloadingTrip !== null}
          className={`py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
            isActiveTripId
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : downloadingTrip !== null
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isActiveTripId ? (
            <>
              <FaStop className="mr-1" /> Stop
            </>
          ) : (
            <>
              <FaPlay className="mr-1" /> Start
            </>
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDataDownloads(!showDataDownloads);
          }}
          disabled={downloadingTrip !== null}
          className={`py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
            downloadingTrip !== null
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-purple-500 hover:bg-purple-600 text-white'
          }`}
        >
          <FaMapMarkerAlt className="mr-1" /> Manage
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onManageActualTrips && onManageActualTrips(trip);
          }}
          disabled={downloadingTrip !== null}
          className={`py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
            downloadingTrip !== null
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <FaCarSide className="mr-1" /> Trips
        </button>
      </div>

      {/* Edit and Delete buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(trip);
          }}
          disabled={downloadingTrip !== null}
          className={`py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
            downloadingTrip !== null
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-yellow-500 hover:bg-yellow-600 text-white'
          }`}
        >
          <FaEdit className="mr-1" /> Edit
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(trip.id);
          }}
          disabled={downloadingTrip !== null}
          className={`py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
            downloadingTrip !== null
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          <FaTrash className="mr-1" /> Delete
        </button>
      </div>

      {/* Data Downloads Section */}
      {showDataDownloads && (
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">Data Downloads</p>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadLandmarks(trip.id);
            }}
            disabled={downloadingTrip !== null}
            className={`w-full py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
              trip.landmarks_downloaded && downloadingTrip !== trip.id
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : downloadingTrip !== null
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {trip.landmarks_downloaded && downloadingTrip !== trip.id ? (
              <>
                <FaSync className="mr-1" /> Update POIs
              </>
            ) : downloadingTrip === trip.id ? (
              <>
                <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-gray-500 border-t-transparent rounded-full mr-1"></div>
                Downloading...
              </>
            ) : (
              <>
                <FaDownload className="mr-1" /> Get POIs
              </>
            )}
          </button>

          <button
            onClick={handleKmlImport}
            disabled={downloadingTrip !== null}
            className="w-full py-2 px-3 rounded bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation"
          >
            <FaFileImport className="mr-1" /> Import from KML
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadGeodata && onDownloadGeodata(trip.id);
            }}
            disabled={downloadingTrip !== null || !onDownloadGeodata}
            className={`w-full py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
              trip.geodata_downloaded && downloadingTrip !== trip.id
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : downloadingTrip !== null || !onDownloadGeodata
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-teal-500 hover:bg-teal-600 text-white'
            }`}
          >
            {trip.geodata_downloaded && downloadingTrip !== trip.id ? (
              <>
                <FaSync className="mr-1" /> Update Geodata
              </>
            ) : downloadingTrip === trip.id ? (
              <>
                <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-gray-500 border-t-transparent rounded-full mr-1"></div>
                Downloading...
              </>
            ) : (
              <>
                <FaGlobe className="mr-1" /> Get Geodata
              </>
            )}
          </button>

          {/* Combined download button */}
          {onDownloadBoth && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadBoth(trip.id);
              }}
              disabled={downloadingTrip !== null}
              className={`w-full py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
                (trip.landmarks_downloaded && trip.geodata_downloaded) && downloadingTrip !== trip.id
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : downloadingTrip !== null
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white'
              }`}
            >
              {(trip.landmarks_downloaded && trip.geodata_downloaded) && downloadingTrip !== trip.id ? (
                <>
                  <FaSync className="mr-1" /> Update All Data
                </>
              ) : downloadingTrip === trip.id ? (
                <>
                  <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-gray-500 border-t-transparent rounded-full mr-1"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <FaDownload className="mr-1" /> Get All Data
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TripActionButtons;
