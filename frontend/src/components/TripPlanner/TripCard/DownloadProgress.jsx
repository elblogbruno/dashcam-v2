import React from 'react';
import { cancelLandmarksDownload, cancelGeodataDownload } from '../../../services/tripService';

const DownloadProgress = ({ downloadingTrip, tripId, downloadProgress, onCancelDownload }) => {
  if (downloadingTrip !== tripId || downloadProgress === null) {
    return null;
  }

  // Debug log to see what data is being received
  console.log(`[DownloadProgress DEBUG] downloadProgress for trip ${tripId}:`, downloadProgress);

  // Handle both number format and object format for downloadProgress
  const progressValue = typeof downloadProgress === 'number' 
    ? downloadProgress 
    : (downloadProgress?.progress || 0);
  
  const progressDetail = typeof downloadProgress === 'object' 
    ? downloadProgress?.detail 
    : null;

  // Additional granular information available in enhanced progress objects
  const waypointIndex = downloadProgress?.waypoint_index;
  const waypointName = downloadProgress?.waypoint_name;
  const waypointsProcessed = downloadProgress?.waypoints_processed;
  const totalWaypoints = downloadProgress?.total_waypoints;
  const gridProgress = downloadProgress?.grid_progress;
  const gridDetail = downloadProgress?.grid_detail;
  const message = downloadProgress?.message;
  
  // Additional detailed progress information extracted from backend
  const currentWaypointIndex = downloadProgress?.current_waypoint_index;
  const currentWaypointName = downloadProgress?.current_waypoint_name;
  const status = downloadProgress?.status;
  const downloadedTiles = downloadProgress?.downloaded_tiles;
  const totalTiles = downloadProgress?.total_tiles;
  const failedTiles = downloadProgress?.failed_tiles;
  const csvRecords = downloadProgress?.csv_records;
  const dbRecords = downloadProgress?.db_records;
  const coverageStats = downloadProgress?.coverage_stats;
  
  // New granular geodata fields from improved backend
  const currentWaypointProgress = downloadProgress?.current_waypoint_progress;
  const currentWaypointGridProcessed = downloadProgress?.current_waypoint_grid_processed;
  const currentWaypointGridTotal = downloadProgress?.current_waypoint_grid_total;
  const successfulApiCalls = downloadProgress?.successful_api_calls;
  const failedApiCalls = downloadProgress?.failed_api_calls;
  const apiRateLimitWait = downloadProgress?.api_rate_limit_wait;
  const estimatedTimeRemaining = downloadProgress?.estimated_time_remaining;
  const currentPhase = downloadProgress?.current_phase;
  
  // Legacy granular data fields
  const downloadSpeed = downloadProgress?.speed_kbps; // Download speed in KB/s
  const downloadedBytes = downloadProgress?.downloaded_bytes;
  const totalBytes = downloadProgress?.total_bytes;
  const successRate = downloadProgress?.success_rate;
  const zoomLevels = downloadProgress?.zoom_levels;
  const bounds = downloadProgress?.bounds;
  const batchProgress = downloadProgress?.batch_progress;
  const regionName = downloadProgress?.region_name;
  const regionId = downloadProgress?.region_id;

  // Determine progress bar color based on progress and status
  const getProgressColor = () => {
    if (status === 'error' || failedTiles > 0) return 'bg-red-500';
    if (progressValue >= 100) return 'bg-green-500';
    if (progressValue >= 75) return 'bg-blue-500';
    if (progressValue >= 50) return 'bg-yellow-500';
    return 'bg-blue-400';
  };

  // Format bytes for display
  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format time remaining
  const formatETA = (timeString) => {
    if (!timeString || timeString === "Calculando..." || timeString === "Completado") return timeString;
    return timeString;
  };

  // Get phase description in Spanish
  const getPhaseDescription = (phase) => {
    const phases = {
      'initializing': 'Inicializando',
      'downloading_waypoint': 'Descargando waypoint',
      'saving_data': 'Guardando datos',
      'completing_waypoint': 'Completando waypoint',
      'complete': 'Completado'
    };
    return phases[phase] || phase;
  };

  // Handle cancel download
  const handleCancelDownload = async () => {
    try {
      // Determine download type based on download progress data
      const downloadType = downloadProgress?.type || 'landmarks';
      
      if (downloadType === 'progress' && downloadProgress?.waypoint_name) {
        // This looks like geodata download
        await cancelGeodataDownload(tripId);
      } else {
        // Default to landmarks download
        await cancelLandmarksDownload(tripId);
      }
      
      // Notify parent component
      if (onCancelDownload) {
        onCancelDownload();
      }
    } catch (error) {
      console.error('Error cancelling download:', error);
    }
  };

  return (
    <div className="space-y-2 px-3 sm:px-4 pb-3">
      {/* Main progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${Math.min(progressValue, 100)}%` }}
        ></div>
      </div>
      
      {/* Progress percentage and main detail */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-700 font-medium">
          Descargando: {progressValue.toFixed(0)}%
          {estimatedTimeRemaining && estimatedTimeRemaining !== "Calculando..." && (
            <span className="text-gray-500 ml-1">
              (ETA: {formatETA(estimatedTimeRemaining)})
            </span>
          )}
        </span>
        
        {/* Cancel button */}
        <div className="flex items-center space-x-2">
          {(waypointsProcessed !== undefined && totalWaypoints !== undefined) && (
            <span className="text-gray-500">
              {waypointsProcessed}/{totalWaypoints} waypoints
            </span>
          )}
          {apiRateLimitWait && (
            <span className="text-orange-500 text-xs" title="Esperando límite de API">
              ⏳
            </span>
          )}
          <button
            onClick={handleCancelDownload}
            className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors"
            title="Cancelar descarga"
          >
            ✕ Cancelar
          </button>
        </div>
      </div>

      {/* Detailed progress information */}
      <div className="space-y-1">
        {/* Main detail message */}
        {progressDetail && (
          <div className="text-xs text-gray-600 truncate">
            <span className="font-medium">Estado:</span> {progressDetail}
          </div>
        )}

        {/* Current phase indicator */}
        {currentPhase && (
          <div className="text-xs text-blue-600 bg-blue-50 rounded p-1">
            <span className="font-medium">Fase:</span> {getPhaseDescription(currentPhase)}
          </div>
        )}

        {/* API calls progress for geodata downloads */}
        {(successfulApiCalls !== undefined || failedApiCalls !== undefined) && (
          <div className="text-xs text-green-600 bg-green-50 rounded p-1">
            <span className="font-medium">Llamadas API:</span>
            {successfulApiCalls !== undefined && (
              <span className="text-green-700"> ✓{successfulApiCalls}</span>
            )}
            {failedApiCalls !== undefined && failedApiCalls > 0 && (
              <span className="text-red-600"> ✗{failedApiCalls}</span>
            )}
            {(successfulApiCalls !== undefined && failedApiCalls !== undefined) && (
              <span className="text-gray-600 ml-1">
                ({Math.round((successfulApiCalls / (successfulApiCalls + failedApiCalls)) * 100) || 0}% éxito)
              </span>
            )}
          </div>
        )}

        {/* Current waypoint grid progress */}
        {(currentWaypointProgress !== undefined && currentWaypointProgress > 0) && (
          <div className="bg-indigo-50 rounded p-2 space-y-1">
            <div className="text-xs text-indigo-700 flex justify-between items-center">
              <span className="font-medium">Progreso del waypoint actual:</span>
              <span>{currentWaypointProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-indigo-200 rounded-full h-1">
              <div 
                className="bg-indigo-500 h-1 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(currentWaypointProgress, 100)}%` }}
              ></div>
            </div>
            {(currentWaypointGridProcessed !== undefined && currentWaypointGridTotal !== undefined) && (
              <div className="text-xs text-indigo-600">
                {currentWaypointGridProcessed}/{currentWaypointGridTotal} puntos de cuadrícula
              </div>
            )}
          </div>
        )}

        {/* Download speed and data transfer info */}
        {(downloadSpeed || downloadedBytes) && (
          <div className="text-xs text-purple-600 bg-purple-50 rounded p-1">
            {downloadSpeed && (
              <span className="font-medium">Velocidad:</span>
            )} {downloadSpeed && `${downloadSpeed} KB/s`}
            {downloadedBytes && totalBytes && (
              <span className="ml-2">
                <span className="font-medium">Datos:</span> {formatBytes(downloadedBytes)}/{formatBytes(totalBytes)}
              </span>
            )}
          </div>
        )}

        {/* Tiles progress for offline map downloads */}
        {(downloadedTiles !== undefined || totalTiles !== undefined) && (
          <div className="text-xs text-indigo-600 bg-indigo-50 rounded p-1">
            <span className="font-medium">Tiles:</span> {downloadedTiles || 0}/{totalTiles || 0}
            {failedTiles > 0 && (
              <span className="text-red-600 ml-2">({failedTiles} fallidos)</span>
            )}
            {successRate !== undefined && (
              <span className="text-green-600 ml-2">({successRate}% éxito)</span>
            )}
          </div>
        )}

        {/* Records progress for geodata downloads */}
        {(csvRecords !== undefined || dbRecords !== undefined) && (
          <div className="text-xs text-green-600 bg-green-50 rounded p-1">
            {csvRecords !== undefined && (
              <span><span className="font-medium">CSV:</span> {csvRecords} registros</span>
            )}
            {dbRecords !== undefined && (
              <span className={csvRecords !== undefined ? "ml-2" : ""}>
                <span className="font-medium">BD:</span> {dbRecords} registros
              </span>
            )}
          </div>
        )}

        {/* Coverage statistics */}
        {coverageStats && (
          <div className="text-xs text-blue-600 bg-blue-50 rounded p-1">
            <span className="font-medium">Cobertura:</span> {coverageStats.coverage_percentage?.toFixed(1) || 0}%
            {coverageStats.total_route_distance_km && (
              <span className="ml-2">
                ({coverageStats.total_route_distance_km}km de ruta)
              </span>
            )}
          </div>
        )}

        {/* Region info for Organic Maps downloads */}
        {(regionName || regionId) && (
          <div className="text-xs text-orange-600 bg-orange-50 rounded p-1">
            <span className="font-medium">Región:</span> {regionName || regionId}
          </div>
        )}

        {/* Zoom levels and bounds for tile downloads */}
        {zoomLevels && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Zoom:</span> {zoomLevels.join(', ')}
          </div>
        )}

        {/* Current waypoint information */}
        {(waypointName || currentWaypointName) && (
          <div className="text-xs text-blue-600 truncate">
            <span className="font-medium">Procesando:</span> {waypointName || currentWaypointName}
            {(waypointIndex !== undefined || currentWaypointIndex !== undefined) && (
              <span className="text-gray-500 ml-1">
                ({(waypointIndex || currentWaypointIndex) + 1}/{totalWaypoints || '?'})
              </span>
            )}
          </div>
        )}

        {/* Grid-level progress for geodata downloads */}
        {(gridProgress !== undefined && gridDetail) && (
          <div className="bg-gray-50 rounded p-2 space-y-1">
            <div className="text-xs text-gray-600">
              <span className="font-medium">Progreso de cuadrícula:</span> {gridProgress.toFixed(0)}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-indigo-400 h-1 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(gridProgress, 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 truncate">
              {gridDetail}
            </div>
          </div>
        )}

        {/* Batch progress for tile downloads */}
        {batchProgress && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Lote:</span> {batchProgress.current || 0}/{batchProgress.total || 0}
          </div>
        )}

        {/* Additional message information */}
        {(message && message !== progressDetail) && (
          <div className="text-xs text-gray-500 italic truncate">
            {message}
          </div>
        )}

        {/* Status indicator */}
        {status && status !== 'in_progress' && (
          <div className={`text-xs font-medium ${
            status === 'complete' ? 'text-green-600' : 
            status === 'error' ? 'text-red-600' : 'text-gray-600'
          }`}>
            Estado: {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadProgress;
