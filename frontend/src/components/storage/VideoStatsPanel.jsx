import React from 'react';
import { FaTrash, FaArchive, FaChartBar, FaVideo, FaCalendarAlt, FaHdd } from 'react-icons/fa';

function VideoStatsPanel({ videoStats, actionLoading, formatBytes, onCleanup, onArchive }) {
  // Formatear la fecha en español
  const formatDateES = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  return (
    <div className="card bg-white shadow-xl rounded-xl border border-neutral-200 hover:shadow-2xl transition-all duration-500">
      <div className="card-body p-0">
        <div className="bg-gradient-to-r from-dashcam-600 to-dashcam-500 text-dashcam-content p-3 sm:p-4 font-semibold">
          <div className="flex items-center">
            <FaChartBar className="text-xl sm:text-2xl mr-2 sm:mr-3" />
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Estadísticas de Videos</h2>
              <p className="text-xs sm:text-sm opacity-80 hidden sm:block">Resumen del almacenamiento de videos</p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Total Videos */}
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content">
                  <FaVideo className="text-sm sm:text-lg" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-neutral-600">Total de Videos</p>
                  <p className="text-lg sm:text-xl font-semibold">{videoStats.totalVideos || 0}</p>
                </div>
              </div>
            </div>

            {/* Total Size */}
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content">
                  <FaHdd className="text-sm sm:text-lg" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-neutral-600">Tamaño Total</p>
                  <p className="text-lg sm:text-xl font-semibold">{formatBytes(videoStats.totalSize || 0)}</p>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content">
                  <FaCalendarAlt className="text-sm sm:text-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-neutral-600">Rango de Fechas</p>
                  <p className="text-xs sm:text-sm font-medium break-words">
                    {formatDateES(videoStats.oldestVideo)} - {formatDateES(videoStats.newestVideo)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onCleanup}
              disabled={actionLoading}
              className="btn btn-sm bg-error-50 hover:bg-error-100 text-error-600 border border-error-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-auto"
            >
              <FaTrash className="text-sm" /> 
              <span className="text-sm">Limpiar Antiguos</span>
            </button>
            
            <button
              onClick={onArchive}
              disabled={actionLoading}
              className="btn btn-sm bg-dashcam-50 hover:bg-dashcam-100 text-dashcam-600 border border-dashcam-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-auto"
            >
              <FaArchive className="text-sm" /> 
              <span className="text-sm">Archivar Videos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoStatsPanel;
