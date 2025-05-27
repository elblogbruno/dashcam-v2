import React from 'react';
import { 
  FaHdd, 
  FaCalendarAlt, 
  FaInfoCircle, 
  FaClock, 
  FaTag, 
  FaDatabase, 
  FaList, 
  FaFolder,
  FaTimes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaServer,
  FaMemory,
  FaMicrochip,
  FaUniversity,
  FaNetworkWired,
  FaPercentage,
  FaFileAlt
} from 'react-icons/fa';

function DriveDetailsModal({ 
  isOpen, 
  onClose, 
  driveDetails, 
  formatBytes 
}) {
  if (!isOpen || !driveDetails) return null;
  
  const disk = driveDetails;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="modal-box max-w-4xl w-full bg-white shadow-2xl rounded-xl border border-neutral-200 animate__animated animate__fadeInUp animate__faster max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-dashcam-600 to-dashcam-500 text-dashcam-content p-3 sm:p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <FaHdd className="text-xl sm:text-2xl flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold truncate">
                Detalles del Dispositivo: {disk.name || disk.device}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0 ml-2"
            >
              <FaTimes className="text-lg" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6">
          {/* General Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 pb-3 border-b border-neutral-200">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content flex-shrink-0">
                  <FaInfoCircle className="text-sm sm:text-lg" />
                </div>
                <h3 className="text-sm sm:text-base font-medium">Información General</h3>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {disk.model && (
                  <div className="bg-white p-2 sm:p-3 rounded-lg border border-neutral-200 flex items-center gap-2 sm:gap-3">
                    <FaServer className="text-dashcam-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-neutral-600">Modelo</p>
                      <p className="text-sm sm:text-base font-medium break-words">{disk.model}</p>
                    </div>
                  </div>
                )}
                
                {disk.serial && (
                  <div className="bg-white p-2 sm:p-3 rounded-lg border border-neutral-200 flex items-center gap-2 sm:gap-3">
                    <FaTag className="text-dashcam-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-neutral-600">Número de Serie</p>
                      <p className="text-sm sm:text-base font-medium font-mono break-all">{disk.serial}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Capacity Info */}
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 pb-3 border-b border-neutral-200">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content flex-shrink-0">
                  <FaDatabase className="text-sm sm:text-lg" />
                </div>
                <h3 className="text-sm sm:text-base font-medium">Estado y Capacidad</h3>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-neutral-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
                    <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 sm:p-3 rounded-full text-dashcam-content flex-shrink-0 self-start sm:self-center">
                      <FaMemory className="text-xl" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-600">Espacio Total</p>
                      <p className="text-xl font-semibold">{formatBytes(disk.size)}</p>
                    </div>
                  </div>
                  
                  <div className="w-full bg-neutral-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        (disk.used / disk.size) > 0.9 
                          ? 'bg-error-500' 
                          : (disk.used / disk.size) > 0.7 
                            ? 'bg-warning-500' 
                            : 'bg-success-500'
                      }`}
                      style={{ width: `${Math.round((disk.used / disk.size) * 100)}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-neutral-600">Usado</p>
                      <p className="font-medium">{formatBytes(disk.used)}</p>
                      <p className="text-xs text-neutral-500">
                        {Math.round((disk.used / disk.size) * 100)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-neutral-600">Libre</p>
                      <p className="font-medium">{formatBytes(disk.avail)}</p>
                      <p className="text-xs text-neutral-500">
                        {Math.round((disk.avail / disk.size) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <span className={`px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 text-sm sm:text-base ${
              disk.mounted 
                ? 'bg-success-100 text-success-700 border border-success-200' 
                : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
            }`}>
              <span className="flex-shrink-0">
                {disk.mounted ? <FaCheckCircle /> : <FaExclamationTriangle />}
              </span>
              <span className="truncate">
                {disk.mounted ? 'Dispositivo Montado' : 'Dispositivo No Montado'}
              </span>
            </span>
          </div>

          {/* Footer */}
          <div className="flex justify-center sm:justify-end pt-4 border-t border-neutral-200">
            <button
              onClick={onClose}
              className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 text-dashcam-content px-4 sm:px-6 py-2 rounded-lg hover:shadow-lg transition-shadow text-sm sm:text-base w-full sm:w-auto"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriveDetailsModal;
