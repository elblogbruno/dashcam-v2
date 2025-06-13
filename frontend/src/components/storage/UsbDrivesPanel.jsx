import React from 'react';
import { FaUsb, FaSearchPlus, FaPlug, FaEject } from 'react-icons/fa';
import { Card, Button } from '../common/UI';
import { Grid, Flex } from '../common/Layout';

function UsbDrivesPanel({ drives, diskInfo, actionLoading, formatBytes, onViewDetails, onMount, onEject }) {
  // Asegurarse de que drives existe y es un array
  const availableDrives = Array.isArray(drives) ? drives : [];

  return (
    <Card className="p-3">
      {/* Encabezado simplificado */}
      <Flex alignItems="center" className="mb-3">
        <FaUsb className="text-primary-600 text-sm mr-2" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Dispositivos USB</h2>
          <p className="text-xs text-gray-600">Administra unidades externas</p>
        </div>
      </Flex>

      {availableDrives.length === 0 ? (
        <div className="text-center py-4">
          <FaUsb className="text-xl text-gray-400 mx-auto mb-2" />
          <h3 className="text-xs font-medium text-gray-700 mb-1">No hay dispositivos USB</h3>
          <p className="text-xs text-gray-500">
            Conecta un dispositivo USB para transferir archivos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {availableDrives.map((drive, index) => (
            <div key={index}>
              {/* Información principal del dispositivo */}
              <Flex alignItems="center" gap={3} className="mb-2">
                <div className="bg-primary-500 p-1.5 rounded text-white">
                  <FaUsb className="text-xs" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-medium text-gray-900 truncate">
                    {drive.name || 'Dispositivo desconocido'}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {drive.model || 'Modelo no disponible'}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  drive.mounted 
                    ? 'bg-success-100 text-success-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {drive.mounted ? 'Montado' : 'No montado'}
                </span>
              </Flex>

              {/* Información adicional con separador */}
              <div className="border-t border-gray-100 pt-2 mb-2">
                <Grid cols={2} gap={3} className="text-xs">
                  <div>
                    <span className="text-gray-500">Tamaño:</span>
                    <span className="ml-1 font-medium text-gray-900">
                      {(drive.size !== undefined && drive.size !== null && !isNaN(drive.size) && drive.size > 0) 
                        ? formatBytes(drive.size) 
                        : 'Desconocido'}
                    </span>
                  </div>
                  {drive.type && (
                    <div>
                      <span className="text-gray-500">Tipo:</span>
                      <span className="ml-1 font-medium text-gray-900">{drive.type}</span>
                    </div>
                  )}
                </Grid>
              </div>

              {/* Botones de acción con separador */}
              <div className="border-t border-gray-100 pt-2">
                <Flex direction="col" gap={1} className="sm:flex-row">
                  <Button 
                    onClick={() => onViewDetails(drive.name)}
                    disabled={actionLoading || !drive.name}
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto text-xs"
                  >
                    <FaSearchPlus className="text-xs mr-1" /> 
                    Detalles
                  </Button>
                  
                  {!drive.mounted && Array.isArray(drive.partitions) && drive.partitions.length > 0 && (
                    <Button 
                      onClick={() => onMount(drive.partitions[0].name)}
                      disabled={actionLoading || diskInfo?.mounted || !drive.partitions[0]?.name}
                      variant="success"
                      size="sm"
                      className="w-full sm:w-auto text-xs"
                    >
                      <FaPlug className="text-xs mr-1" />
                      Montar
                    </Button>
                  )}
                  
                  {drive.mounted && (
                    <Button 
                      onClick={() => onEject(drive.name)}
                      disabled={actionLoading || !drive.name}
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
              
              {/* Separador entre dispositivos (solo si no es el último) */}
              {index < availableDrives.length - 1 && (
                <div className="border-t border-gray-100 mt-3" />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default UsbDrivesPanel;
