import React from 'react';
import { FaDownload, FaMap, FaImage, FaDatabase, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { MdOutlineTerrain } from 'react-icons/md';

const OfflineDownloadSection = ({
  showOfflineOptions,
  setShowOfflineOptions,
  downloadOptions,
  setDownloadOptions,
  isDownloadingOffline,
  downloadStatus,
  handleDownloadOfflineResources
}) => {
  return (
    <div className="space-y-2 border-t border-gray-200 pt-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">Offline Resources</p>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowOfflineOptions(!showOfflineOptions);
        }}
        disabled={isDownloadingOffline}
        className="w-full py-2 px-3 rounded bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation"
      >
        <FaDownload className="mr-1" />
        Download Offline
        {showOfflineOptions ? <FaChevronUp className="ml-1" /> : <FaChevronDown className="ml-1" />}
      </button>

      {showOfflineOptions && (
        <div className="bg-white p-3 rounded border space-y-3">
          {/* Download options */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700 mb-2">Select resources:</p>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={downloadOptions.mapTiles}
                onChange={(e) => setDownloadOptions(prev => ({ ...prev, mapTiles: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-700 flex items-center">
                <FaMap className="mr-1" /> Map tiles (OSM)
              </span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={downloadOptions.landmarkImages}
                onChange={(e) => setDownloadOptions(prev => ({ ...prev, landmarkImages: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-700 flex items-center">
                <FaImage className="mr-1" /> Landmark images
              </span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={downloadOptions.organicMaps}
                onChange={(e) => setDownloadOptions(prev => ({ ...prev, organicMaps: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-700 flex items-center">
                <MdOutlineTerrain className="mr-1" /> Organic Maps
              </span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={downloadOptions.geodata}
                onChange={(e) => setDownloadOptions(prev => ({ ...prev, geodata: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-700 flex items-center">
                <FaDatabase className="mr-1" /> Geodata (Reverse Geocoding)
              </span>
            </label>
          </div>

          {/* Download progress */}
          {isDownloadingOffline && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.max(downloadStatus.mapProgress, downloadStatus.organicMapsProgress, downloadStatus.geodataProgress)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600">{downloadStatus.currentStep}</p>
              {downloadStatus.landmarksTotal > 0 && (
                <p className="text-xs text-gray-500">
                  Landmarks: {downloadStatus.landmarksDownloaded}/{downloadStatus.landmarksTotal}
                </p>
              )}
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownloadOfflineResources}
            disabled={isDownloadingOffline || (!downloadOptions.mapTiles && !downloadOptions.landmarkImages && !downloadOptions.organicMaps && !downloadOptions.geodata)}
            className={`w-full py-2 px-3 rounded flex items-center justify-center text-xs sm:text-sm min-h-[36px] touch-manipulation ${
              isDownloadingOffline || (!downloadOptions.mapTiles && !downloadOptions.landmarkImages && !downloadOptions.organicMaps && !downloadOptions.geodata)
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isDownloadingOffline ? (
              <>
                <div className="animate-spin h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full mr-2"></div>
                Downloading...
              </>
            ) : (
              <>
                <FaDownload className="mr-1" /> Start Download
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default OfflineDownloadSection;
