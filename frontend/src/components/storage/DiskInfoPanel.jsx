import React from 'react';
import { FaHdd, FaEject, FaPlug } from 'react-icons/fa';

function DiskInfoPanel({ diskInfo, actionLoading, formatBytes, onMount, onEject }) {
  return (
    <div className="card bg-white shadow-xl rounded-xl border border-neutral-200 hover:shadow-2xl transition-all duration-500">
      <div className="card-body p-0">
        <div className="bg-gradient-to-r from-dashcam-600 to-dashcam-500 text-dashcam-content p-3 sm:p-4 font-semibold">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <FaHdd className="text-xl sm:text-2xl" />
              <div>
                <h2 className="text-base sm:text-lg font-semibold">Disco de Almacenamiento</h2>
                <p className="text-xs sm:text-sm opacity-80 hidden sm:block">Información y estado del sistema de archivos principal</p>
              </div>
            </div>
            <button 
              onClick={onMount}
              disabled={actionLoading}
              className={`btn btn-sm w-full sm:w-auto ${
                diskInfo.mounted 
                  ? 'bg-warning-50 hover:bg-warning-100 text-warning-600 border border-warning-200' 
                  : 'bg-success-50 hover:bg-success-100 text-success-600 border border-success-200'
              } rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 sm:gap-2`}
            >
              {diskInfo.mounted ? <FaEject /> : <FaPlug />}
              <span className="text-sm">{diskInfo.mounted ? 'Desmontar' : 'Montar'}</span>
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Estado del disco */}
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content">
                  <FaHdd className="text-sm sm:text-lg" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-neutral-600">Estado</p>
                  <p className={`text-sm sm:text-base font-medium ${diskInfo.mounted ? 'text-success-600' : 'text-neutral-600'}`}>
                    {diskInfo.mounted ? 'Montado' : 'No montado'}
                  </p>
                </div>
              </div>

              {diskInfo.mounted && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-neutral-600">
                      Dispositivo: <span className="font-medium break-all">{diskInfo.device}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-neutral-600">
                      Punto de montaje: <span className="font-medium break-all">{diskInfo.path}</span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Uso de espacio */}
            {diskInfo.mounted && (
              <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content">
                    <FaHdd className="text-sm sm:text-lg" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-neutral-600">Uso de Espacio</p>
                    <p className="text-sm sm:text-base font-medium">{formatBytes(diskInfo.used)} de {formatBytes(diskInfo.total)}</p>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        diskInfo.percent > 90 
                          ? 'bg-error-500' 
                          : diskInfo.percent > 70 
                            ? 'bg-warning-500' 
                            : 'bg-success-500'
                      }`}
                      style={{ width: `${diskInfo.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <p className="text-xs sm:text-sm text-neutral-600">Libre: <span className="font-medium">{formatBytes(diskInfo.free)}</span></p>
                    <p className="text-xs sm:text-sm text-neutral-600">Uso: <span className="font-medium">{diskInfo.percent}%</span></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiskInfoPanel;
