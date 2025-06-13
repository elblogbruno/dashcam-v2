import React, { useState, useEffect } from 'react';
import { getDownloadEstimate } from '../../../services/tripService';

const DownloadEstimateModal = ({ 
  tripId, 
  isOpen, 
  onClose, 
  onConfirm, 
  downloadType = 'both' // 'landmarks', 'geodata', 'both'
}) => {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [radiusKm, setRadiusKm] = useState(10);

  useEffect(() => {
    if (isOpen && tripId) {
      fetchEstimate();
    }
  }, [isOpen, tripId, radiusKm]);

  const fetchEstimate = async () => {
    try {
      setLoading(true);
      const response = await getDownloadEstimate(tripId, radiusKm);
      setEstimate(response);
    } catch (error) {
      console.error('Error fetching download estimate:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  };

  const formatSize = (mb) => {
    if (mb < 1) return `${Math.round(mb * 1024)}KB`;
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  const getDisplayData = () => {
    if (!estimate) return null;

    // Adapt to new optimization response structure
    const optimizationSummary = estimate.optimization_summary || {};
    const executionMetrics = estimate.execution_metrics || {};
    
    // Calculate estimated values based on optimization data
    const waypointsCount = executionMetrics.waypoints_processed || 0;
    const avgRadius = optimizationSummary.avg_radius_km || radiusKm;
    const totalArea = optimizationSummary.total_coverage_area_km2 || 0;
    
    // Rough estimates based on area and waypoints
    const estimatedLandmarks = Math.round(totalArea * 10); // ~10 landmarks per km²
    const estimatedSizeMB = Math.round(totalArea * 0.5); // ~0.5MB per km²
    const estimatedTimeMinutes = Math.round(waypointsCount * 1.5); // ~1.5 min per waypoint

    switch (downloadType) {
      case 'landmarks':
        return {
          title: 'Descarga de Puntos de Interés',
          time: estimatedTimeMinutes,
          size: estimatedSizeMB,
          details: [
            `${waypointsCount} ubicaciones`,
            `~${estimatedLandmarks} puntos de interés estimados`,
            `Radio promedio: ${avgRadius.toFixed(1)} km`,
            `Área total: ${totalArea.toFixed(1)} km²`
          ]
        };
      case 'geodata':
        return {
          title: 'Descarga de Datos Geográficos',
          time: estimatedTimeMinutes * 2, // Geodata takes longer
          size: estimatedSizeMB * 3, // Geodata is larger
          details: [
            `${waypointsCount} waypoints`,
            `Área de cobertura: ${totalArea.toFixed(1)} km²`,
            `Radio promedio: ${avgRadius.toFixed(1)} km`
          ]
        };
      case 'both':
      default:
        return {
          title: 'Descarga Completa (Geodatos + POIs)',
          time: estimatedTimeMinutes * 3.5, // Combined time
          size: estimatedSizeMB * 4, // Combined size
          details: [
            `${waypointsCount} waypoints`,
            `~${estimatedLandmarks} puntos de interés estimados`,
            `Área total: ${totalArea.toFixed(1)} km²`,
            `Radio optimizado: ${avgRadius.toFixed(1)} km`,
            `Eficiencia: ${((optimizationSummary.efficiency_ratio || 0.8) * 100).toFixed(1)}%`
          ]
        };
    }
  };

  if (!isOpen) return null;

  const displayData = getDisplayData();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Calculando estimación...</p>
          </div>
        ) : displayData ? (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {displayData.title}
            </h3>
            
            <div className="space-y-4">
              {/* Trip info */}
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium text-gray-700">{estimate.trip_name}</h4>
                <p className="text-sm text-gray-600">ID: {estimate.trip_id}</p>
              </div>

              {/* Radius setting */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Radio de búsqueda: {radiusKm} km
                </label>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="5"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5km</span>
                  <span>15km</span>
                  <span>25km</span>
                </div>
              </div>

              {/* Estimates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatTime(displayData.time)}
                  </div>
                  <div className="text-sm text-blue-800">Tiempo estimado</div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <div className="text-2xl font-bold text-green-600">
                    {formatSize(displayData.size)}
                  </div>
                  <div className="text-sm text-green-800">Tamaño estimado</div>
                </div>
              </div>

              {/* Details */}
              <div>
                <h5 className="font-medium text-gray-700 mb-2">Detalles:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {displayData.details.map((detail, index) => (
                    <li key={index}>• {detail}</li>
                  ))}
                </ul>
              </div>

              {/* Requirements */}
              <div className="bg-yellow-50 p-3 rounded">
                <h5 className="font-medium text-yellow-800 mb-1">Requisitos:</h5>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Conexión a internet activa</li>
                  <li>• {formatSize(displayData.size)} de espacio libre</li>
                  <li>• Disponible offline después de descarga</li>
                </ul>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirm(radiusKm)}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Iniciar Descarga
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-red-600">Error al obtener estimación</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadEstimateModal;
