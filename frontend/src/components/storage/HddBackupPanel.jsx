import React from 'react';
import { FaServer, FaSyncAlt, FaPlay, FaStop, FaEject, FaExclamationTriangle, FaClock, FaCheckCircle, FaSpinner, FaDatabase, FaFileAlt, FaCalendarAlt, FaUsb } from 'react-icons/fa';

function HddBackupPanel({ diskInfo, copyStatus, drives, actionLoading, formatBytes, formatDate, onStartCopy, onCancelCopy, onEjectAfterCopy }) {
  // console.log('HddBackupPanel props:', { 
  //   diskInfo, 
  //   copyStatus, 
  //   drives, 
  //   actionLoading, 
  //   onStartCopy: typeof onStartCopy,
  //   onCancelCopy: typeof onCancelCopy,
  //   onEjectAfterCopy: typeof onEjectAfterCopy
  // });

  const handleStartCopyClick = () => {
    console.log('Button clicked! Calling onStartCopy...');
    console.log('onStartCopy type:', typeof onStartCopy);
    console.log('actionLoading:', actionLoading);
    console.log('copyStatus.is_copying:', copyStatus.is_copying);
    
    if (onStartCopy && typeof onStartCopy === 'function') {
      onStartCopy();
    } else {
      console.error('onStartCopy is not a function:', onStartCopy);
    }
  };

  return (
    <div className="card bg-white shadow-xl rounded-xl border border-neutral-200 hover:shadow-2xl transition-all duration-500">
      <div className="card-body p-0">
        <div className="bg-gradient-to-r from-dashcam-600 to-dashcam-500 text-dashcam-content p-3 sm:p-4 font-semibold">
          <div className="flex items-center">
            <FaServer className="text-xl sm:text-2xl mr-2 sm:mr-3 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold">Copia de Seguridad a HDD Externo</h2>
              <p className="text-xs sm:text-sm opacity-80 hidden sm:block">Transfiera sus grabaciones a una unidad HDD externa para guardar y archivar</p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="space-y-4 sm:space-y-6">
            {/* Información sobre el disco principal (solo si no está montado) */}
            {!diskInfo.mounted && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <FaExclamationTriangle className="text-amber-500 flex-shrink-0" />
                  <h4 className="text-sm sm:text-base font-medium text-amber-800">Disco principal no montado</h4>
                </div>
                <p className="text-xs sm:text-sm text-amber-700">
                  El disco principal no está montado, pero aún puede realizar copias de respaldo a discos USB externos.
                </p>
              </div>
            )}

            {/* Información sobre discos USB disponibles */}
            {drives.length > 0 && (
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <FaUsb className="text-blue-500 flex-shrink-0" />
                  <h4 className="text-sm sm:text-base font-medium text-blue-800">Dispositivos USB Detectados</h4>
                </div>
                <div className="space-y-2">
                  {drives.map((drive, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-2 sm:p-3 rounded border gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm sm:text-base font-medium break-words">{drive.name || drive.device}</span>
                        {drive.size && <span className="text-xs sm:text-sm text-gray-600 ml-0 sm:ml-2 block sm:inline">({formatBytes(drive.size)})</span>}
                      </div>
                      <div className="text-xs sm:text-sm flex-shrink-0">
                        {drive.mounted ? (
                          <span className="text-green-600">Montado</span>
                        ) : (
                          <span className="text-gray-500">No montado</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drives.length === 0 && (
              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <FaExclamationTriangle className="text-yellow-500 flex-shrink-0" />
                  <h4 className="text-sm sm:text-base font-medium text-yellow-800">Sin dispositivos USB detectados</h4>
                </div>
                <p className="text-xs sm:text-sm text-yellow-700">
                  Conecte un disco USB externo para realizar la copia de respaldo. 
                  El sistema detectará automáticamente el dispositivo y lo preparará para la copia.
                </p>
              </div>
            )}

            {/* Estado de copia actual */}
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${
                  copyStatus.is_copying 
                    ? 'bg-info-500' 
                    : copyStatus.status === 'completed'
                      ? 'bg-success-500'
                      : copyStatus.status === 'error'
                        ? 'bg-error-500'
                        : 'bg-neutral-500'
                } text-white`}>
                  {copyStatus.is_copying ? (
                    <FaSyncAlt className="text-lg sm:text-xl animate-spin" />
                  ) : copyStatus.status === 'completed' ? (
                    <FaCheckCircle className="text-lg sm:text-xl" />
                  ) : copyStatus.status === 'error' ? (
                    <FaExclamationTriangle className="text-lg sm:text-xl" />
                  ) : (
                    <FaClock className="text-lg sm:text-xl" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-medium">Estado de la Copia</h3>
                  <p className="text-xs sm:text-sm text-neutral-600">
                    {copyStatus.is_copying ? 'Copia en progreso' :
                     copyStatus.status === 'completed' ? 'Copia completada' :
                     copyStatus.status === 'error' ? 'Error en la copia' :
                     'Sin operación en curso'}
                  </p>
                </div>
              </div>

              {copyStatus.is_copying && (
                <>
                  <div className="w-full bg-neutral-200 rounded-full h-2 mb-2">
                    <div 
                      className="h-2 rounded-full bg-dashcam-500"
                      style={{ width: `${copyStatus.progress}%` }}
                    />
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-600 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span>{copyStatus.progress.toFixed(1)}% completado</span>
                    <span>{formatBytes(copyStatus.stats.copied_size)} / {formatBytes(copyStatus.stats.total_size)}</span>
                  </div>
                </>
              )}

              {/* Acciones */}
              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2">
                {!copyStatus.is_copying ? (
                  <button
                    onClick={handleStartCopyClick}
                    disabled={actionLoading}
                    className="btn btn-sm bg-success-50 hover:bg-success-100 text-success-600 border border-success-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-auto"
                  >
                    <FaPlay className="text-sm" /> 
                    <span className="text-sm">Iniciar Copia</span>
                  </button>
                ) : (
                  <button
                    onClick={onCancelCopy}
                    disabled={actionLoading}
                    className="btn btn-sm bg-error-50 hover:bg-error-100 text-error-600 border border-error-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-auto"
                  >
                    <FaStop className="text-sm" /> 
                    <span className="text-sm">Cancelar</span>
                  </button>
                )}

                {copyStatus.status === 'completed' && (
                  <button
                    onClick={onEjectAfterCopy}
                    disabled={actionLoading}
                    className="btn btn-sm bg-warning-50 hover:bg-warning-100 text-warning-600 border border-warning-200 rounded-full px-3 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-auto"
                  >
                    <FaEject className="text-sm" /> 
                    <span className="text-sm">Expulsar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Estadísticas detalladas */}
            {(copyStatus.is_copying || copyStatus.status === 'completed') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <FaFileAlt className="text-dashcam-500 flex-shrink-0" />
                    <h4 className="text-sm sm:text-base font-medium">Archivos</h4>
                  </div>
                  <p className="text-lg sm:text-2xl font-semibold">
                    {copyStatus.stats.copied_files} / {copyStatus.stats.total_files}
                  </p>
                </div>

                <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <FaDatabase className="text-dashcam-500 flex-shrink-0" />
                    <h4 className="text-sm sm:text-base font-medium">Tamaño</h4>
                  </div>
                  <p className="text-lg sm:text-2xl font-semibold break-words">
                    {formatBytes(copyStatus.stats.copied_size)} / {formatBytes(copyStatus.stats.total_size)}
                  </p>
                </div>

                <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <FaCalendarAlt className="text-dashcam-500 flex-shrink-0" />
                    <h4 className="text-sm sm:text-base font-medium">Tiempo</h4>
                  </div>
                  <p className="text-xs sm:text-sm break-words">
                    Inicio: {formatDate(copyStatus.stats.start_time)}
                    {copyStatus.stats.end_time && (
                      <><br />Fin: {formatDate(copyStatus.stats.end_time)}</>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HddBackupPanel;
