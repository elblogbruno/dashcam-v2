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
import { Modal, Card, Button, Badge } from '../common/UI';
import { Grid, Flex } from '../common/Layout';

function DriveDetailsModal({ 
  isOpen, 
  onClose, 
  driveDetails, 
  formatBytes 
}) {
  if (!isOpen || !driveDetails) return null;
  
  // Asegurar que tenemos valores por defecto para propiedades importantes
  const disk = {
    size: 0,
    used: 0,
    avail: 0,
    mounted: false,
    name: "Disco",
    model: "Desconocido",
    serial: "Desconocido",
    ...driveDetails
  };
  
  // Asegurar que los valores numéricos son números válidos
  disk.size = typeof disk.size === 'number' && !isNaN(disk.size) ? disk.size : 0;
  disk.used = typeof disk.used === 'number' && !isNaN(disk.used) ? disk.used : 0;
  disk.avail = typeof disk.avail === 'number' && !isNaN(disk.avail) ? disk.avail : 0;
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalles del Dispositivo: ${disk.name || disk.device}`} size="large">
      <div className="p-6">
        {/* General Info */}
        <Grid cols={1} gap={6} className="lg:grid-cols-2 mb-6">
          <Card variant="secondary">
            <Flex alignItems="center" gap={3} className="mb-4 pb-3 border-b border-gray-200">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-lg text-white flex-shrink-0">
                <FaInfoCircle className="text-lg" />
              </div>
              <h3 className="font-medium text-gray-800">Información General</h3>
            </Flex>

            <div className="space-y-4">
              {disk.model && (
                <Card variant="white" className="bg-white">
                  <Flex alignItems="center" gap={3}>
                    <FaServer className="text-primary-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600">Modelo</p>
                      <p className="font-medium text-gray-800 break-words">{disk.model}</p>
                    </div>
                  </Flex>
                </Card>
              )}
              
              {disk.serial && (
                <Card variant="white" className="bg-white">
                  <Flex alignItems="center" gap={3}>
                    <FaTag className="text-primary-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600">Número de Serie</p>
                      <p className="font-medium text-gray-800 font-mono break-all">{disk.serial}</p>
                    </div>
                  </Flex>
                </Card>
              )}
            </div>
          </Card>

          {/* Capacity Info */}
          <Card variant="secondary">
            <Flex alignItems="center" gap={3} className="mb-4 pb-3 border-b border-gray-200">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-lg text-white flex-shrink-0">
                <FaDatabase className="text-lg" />
              </div>
              <h3 className="font-medium text-gray-800">Estado y Capacidad</h3>
            </Flex>

            <div className="space-y-4">
              <Card variant="white" className="bg-white">
                <Flex direction="col" gap={3} className="sm:flex-row sm:items-center sm:gap-4 mb-3">
                  <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-3 rounded-full text-white flex-shrink-0 self-start sm:self-center">
                    <FaMemory className="text-xl" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Espacio Total</p>
                    <p className="text-xl font-semibold text-gray-800">{formatBytes(disk.size)}</p>
                  </div>
                </Flex>
                
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      (disk.used / disk.size) > 0.9 
                        ? 'bg-error-500' 
                        : (disk.used / disk.size) > 0.7 
                          ? 'bg-warning-500' 
                          : 'bg-success-500'
                    }`}
                    style={{ width: `${disk.size > 0 ? Math.round((disk.used / disk.size) * 100) : 0}%` }}
                  />
                </div>

                <Grid cols={2} gap={4} className="mt-3">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Usado</p>
                    <p className="font-medium text-gray-800">{formatBytes(disk.used)}</p>
                    <p className="text-xs text-gray-500">
                      {disk.size > 0 ? `${Math.round((disk.used / disk.size) * 100)}%` : '0%'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Libre</p>
                    <p className="font-medium text-gray-800">{formatBytes(disk.avail)}</p>
                    <p className="text-xs text-gray-500">
                      {disk.size > 0 ? `${Math.round((disk.avail / disk.size) * 100)}%` : '0%'}
                    </p>
                  </div>
                </Grid>
              </Card>
            </div>
          </Card>
        </Grid>

        {/* Status Badge */}
        <Flex justifyContent="center" className="mb-6">
          <Badge 
            variant={disk.mounted ? 'success' : 'secondary'}
            icon={disk.mounted ? <FaCheckCircle /> : <FaExclamationTriangle />}
          >
            {disk.mounted ? 'Dispositivo Montado' : 'Dispositivo No Montado'}
          </Badge>
        </Flex>

        {/* Footer */}
        <Flex justifyContent="center" className="sm:justify-end pt-4 border-t border-gray-200">
          <Button onClick={onClose} variant="primary" className="w-full sm:w-auto">
            Cerrar
          </Button>
        </Flex>
      </div>
    </Modal>
  );
}

export default DriveDetailsModal;
