import React from 'react';
import { FaServer, FaSyncAlt, FaPlay, FaStop, FaEject, FaExclamationTriangle, FaClock, FaCheckCircle, FaSpinner, FaDatabase, FaFileAlt, FaCalendarAlt, FaUsb } from 'react-icons/fa';
import { Card, Button, Alert } from '../common/UI';
import { Grid, Flex } from '../common/Layout';

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
    <Card className="p-3">
      {/* Encabezado simplificado */}
      <Flex alignItems="center" className="mb-3">
        <FaServer className="text-primary-600 text-sm mr-2" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Copia de Seguridad a HDD Externo</h2>
          <p className="text-xs text-gray-600 hidden sm:block">Transfiera sus grabaciones a una unidad HDD externa</p>
        </div>
      </Flex>

      <div className="space-y-3">
        {/* Información sobre el disco principal (solo si no está montado) */}
        {!diskInfo.mounted && (
          <Alert variant="warning" icon={<FaExclamationTriangle />}>
            <h4 className="font-medium text-amber-800 text-xs">Disco principal no montado</h4>
            <p className="text-xs text-amber-700">
              El disco principal no está montado, pero aún puede realizar copias de respaldo a discos USB externos.
            </p>
          </Alert>
        )}

        {/* Información sobre discos USB disponibles */}
        {drives.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <Flex alignItems="center" gap={2} className="mb-2">
              <FaUsb className="text-blue-500 text-sm" />
              <h4 className="font-medium text-blue-800 text-sm">Dispositivos USB Detectados</h4>
            </Flex>
            <div className="space-y-2">
              {drives.map((drive, index) => (
                <div key={index} className="border border-gray-100 rounded p-2">
                  <Flex direction="col" gap={1} className="sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium break-words text-sm">{drive.name || drive.device}</span>
                      {drive.size && <span className="text-xs text-gray-600 ml-0 sm:ml-2 block sm:inline">({formatBytes(drive.size)})</span>}
                    </div>
                    <div className="text-xs flex-shrink-0">
                      {drive.mounted ? (
                        <span className="text-green-600">Montado</span>
                      ) : (
                        <span className="text-gray-500">No montado</span>
                      )}
                    </div>
                  </Flex>
                </div>
              ))}
            </div>
          </div>
        )}

        {drives.length === 0 && (
          <div className="border-t border-gray-100 pt-3">
            <Alert variant="warning" icon={<FaExclamationTriangle />}>
              <h4 className="font-medium text-yellow-800 text-xs">Sin dispositivos USB detectados</h4>
              <p className="text-xs text-yellow-700">
                Conecte un disco USB externo para realizar la copia de respaldo. 
                El sistema detectará automáticamente el dispositivo y lo preparará para la copia.
              </p>
            </Alert>
          </div>
        )}

        {/* Estado de copia actual */}
        <div className="border-t border-gray-100 pt-3">
          <Flex alignItems="center" gap={2} className="mb-3">
            <div className={`p-1.5 rounded flex-shrink-0 ${
              copyStatus.is_copying 
                ? 'bg-info-500'
                : copyStatus.status === 'completed'
                  ? 'bg-success-500'
                  : copyStatus.status === 'error'
                    ? 'bg-error-500'
                    : 'bg-gray-500'
            } text-white`}>
              {copyStatus.is_copying ? (
                <FaSyncAlt className="text-xs animate-spin" />
              ) : copyStatus.status === 'completed' ? (
                <FaCheckCircle className="text-xs" />
              ) : copyStatus.status === 'error' ? (
                <FaExclamationTriangle className="text-xs" />
              ) : (
                <FaClock className="text-xs" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm text-gray-900">Estado de la Copia</h3>
              <p className="text-xs text-gray-600">
                {copyStatus.is_copying ? 'Copia en progreso' :
                 copyStatus.status === 'completed' ? 'Copia completada' :
                 copyStatus.status === 'error' ? 'Error en la copia' :
                 'Sin operación en curso'}
              </p>
            </div>
          </Flex>

          {copyStatus.is_copying && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="h-2 rounded-full bg-primary-500"
                  style={{ width: `${copyStatus.progress}%` }}
                />
              </div>
              <Flex direction="col" gap={1} className="sm:flex-row sm:justify-between text-xs text-gray-600">
                <span>{copyStatus.progress.toFixed(1)}% completado</span>
                <span>{formatBytes(copyStatus.stats.copied_size)} / {formatBytes(copyStatus.stats.total_size)}</span>
              </Flex>
            </>
          )}

          {/* Acciones */}
          <Flex direction="col" gap={2} className="mt-2 sm:flex-row">
            {!copyStatus.is_copying ? (
              <Button
                onClick={handleStartCopyClick}
                disabled={actionLoading}
                variant="success"
                size="sm"
                className="w-full sm:w-auto text-xs"
              >
                <FaPlay className="text-xs mr-1" /> 
                Iniciar Copia
              </Button>
            ) : (
              <Button
                onClick={onCancelCopy}
                disabled={actionLoading}
                variant="error"
                size="sm"
                className="w-full sm:w-auto text-xs"
              >
                <FaStop className="text-xs mr-1" /> 
                Cancelar
              </Button>
            )}

            {copyStatus.status === 'completed' && (
              <Button
                onClick={onEjectAfterCopy}
                disabled={actionLoading}
                variant="warning"
                size="sm"
                className="w-full sm:w-auto text-xs"
              >
                <FaEject className="text-xs mr-1" /> 
                Expulsar
              </Button>
            )}
          </Flex>
        </div>

        {/* Estadísticas detalladas */}
        {(copyStatus.is_copying || copyStatus.status === 'completed') && (
          <div className="border-t border-gray-100 pt-3">
            <Grid cols={1} gap={2} className="sm:grid-cols-2 lg:grid-cols-3">
              <div className="border border-gray-100 rounded p-2">
                <Flex alignItems="center" gap={2} className="mb-1">
                  <FaFileAlt className="text-primary-500 text-xs" />
                  <h4 className="font-medium text-xs">Archivos</h4>
                </Flex>
                <p className="text-sm font-semibold text-gray-900">
                  {copyStatus.stats.copied_files} / {copyStatus.stats.total_files}
                </p>
              </div>

              <div className="border border-gray-100 rounded p-2">
                <Flex alignItems="center" gap={2} className="mb-1">
                  <FaDatabase className="text-primary-500 text-xs" />
                  <h4 className="font-medium text-xs">Tamaño</h4>
                </Flex>
                <p className="text-sm font-semibold text-gray-900 break-words">
                  {formatBytes(copyStatus.stats.copied_size)} / {formatBytes(copyStatus.stats.total_size)}
                </p>
              </div>

              <div className="border border-gray-100 rounded p-2 sm:col-span-2 lg:col-span-1">
                <Flex alignItems="center" gap={2} className="mb-1">
                  <FaCalendarAlt className="text-primary-500 text-xs" />
                  <h4 className="font-medium text-xs">Tiempo</h4>
                </Flex>
                <p className="text-xs text-gray-900 break-words">
                  Inicio: {formatDate(copyStatus.stats.start_time)}
                  {copyStatus.stats.end_time && (
                    <><br />Fin: {formatDate(copyStatus.stats.end_time)}</>
                  )}
                </p>
              </div>
            </Grid>
          </div>
        )}
      </div>
    </Card>
  );
}

export default HddBackupPanel;
