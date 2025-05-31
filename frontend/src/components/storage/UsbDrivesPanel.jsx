import React from 'react';
import { FaUsb, FaSearchPlus, FaPlug, FaEject, FaInfoCircle, FaDatabase } from 'react-icons/fa';

function UsbDrivesPanel({ drives, diskInfo, actionLoading, formatBytes, onViewDetails, onMount, onEject }) {
  // Asegurarse de que drives existe y es un array
  const availableDrives = Array.isArray(drives) ? drives : [];

  return (
    <div className="card bg-white shadow-xl rounded-xl border border-neutral-200 hover:shadow-2xl transition-all duration-500">
      <div className="card-body p-0">
        <div className="bg-gradient-to-r from-dashcam-600 to-dashcam-500 text-white p-3 sm:p-4 font-semibold">
          <div className="flex items-center">
            <FaUsb className="text-xl sm:text-2xl mr-2 sm:mr-3" />
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Dispositivos USB</h2>
              <p className="text-xs sm:text-sm opacity-80 hidden sm:block">Conecta y administra tus unidades externas</p>
            </div>
          </div>
        </div>
        
        <div className="p-3 sm:p-4">
          {availableDrives.length === 0 ? (
            <div className="text-center py-6 sm:py-8 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="bg-white w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full flex items-center justify-center shadow-md mb-3 sm:mb-4 border border-neutral-200">
                <div className="bg-neutral-50 rounded-full p-3 sm:p-4">
                  <FaUsb className="text-2xl sm:text-4xl text-neutral-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-medium text-neutral-700 mb-2">No se detectaron dispositivos USB</h3>
              <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto px-4">
                Conecta un dispositivo USB para hacer copias de seguridad o transferir archivos.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {availableDrives.map((drive, index) => (
                <div 
                  key={index} 
                  className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200 hover:border-dashcam-500/30 transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 sm:p-3 rounded-full shadow-md flex-shrink-0">
                        <FaUsb className="text-sm sm:text-lg text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-medium text-neutral-900 truncate">{drive.name || 'Dispositivo desconocido'}</h3>
                        <p className="text-xs sm:text-sm text-neutral-600 truncate">{drive.model || 'Modelo no disponible'}</p>
                      </div>
                    </div>
                    
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                      drive.mounted 
                        ? 'bg-success-100 text-success-700 border border-success-200' 
                        : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}>
                      {drive.mounted ? 'Montado' : 'No montado'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="bg-white p-2 sm:p-3 rounded-lg border border-neutral-200 flex items-center gap-2">
                      <FaDatabase className="text-dashcam-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-neutral-600">Tamaño</p>
                        <p className="text-xs sm:text-sm font-medium truncate text-neutral-800">
                          {(drive.size !== undefined && drive.size !== null && !isNaN(drive.size) && drive.size > 0) 
                            ? formatBytes(drive.size) 
                            : 'Desconocido'}
                        </p>
                      </div>
                    </div>
                    
                    {drive.type && (
                      <div className="bg-white p-2 sm:p-3 rounded-lg border border-neutral-200 flex items-center gap-2">
                        <FaInfoCircle className="text-dashcam-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-neutral-600">Tipo</p>
                          <p className="text-xs sm:text-sm font-medium truncate">{drive.type}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={() => onViewDetails(drive.name)}
                      disabled={actionLoading || !drive.name}
                      className="btn btn-sm bg-dashcam-50 hover:bg-dashcam-100 text-dashcam-600 border border-dashcam-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 w-full sm:w-auto"
                    >
                      <FaSearchPlus className="text-sm" /> 
                      <span className="text-sm">Detalles</span>
                    </button>
                    
                    {!drive.mounted && Array.isArray(drive.partitions) && drive.partitions.length > 0 && (
                      <button 
                        onClick={() => onMount(drive.partitions[0].name)}
                        disabled={actionLoading || diskInfo?.mounted || !drive.partitions[0]?.name}
                        className="btn btn-sm bg-success-50 hover:bg-success-100 text-success-600 border border-success-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 w-full sm:w-auto"
                      >
                        <FaPlug className="text-sm" /> 
                        <span className="text-sm">Montar</span>
                      </button>
                    )}
                    
                    {drive.mounted && (
                      <button 
                        onClick={() => onEject(drive.name)}
                        disabled={actionLoading || !drive.name}
                        className="btn btn-sm bg-warning-50 hover:bg-warning-100 text-warning-600 border border-warning-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 w-full sm:w-auto"
                      >
                        <FaEject className="text-sm" /> 
                        <span className="text-sm">Expulsar</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsbDrivesPanel;
