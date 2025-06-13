import React from 'react';
import { FaHdd, FaEject, FaPlug, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { Card, Button } from '../common/UI';
import { Grid, Flex } from '../common/Layout';

function DiskInfoPanel({ diskInfo, actionLoading, formatBytes, onMount, onEject }) {
  return (
    <Card className="p-3">
      {/* Header simplificado */}
      <Flex alignItems="center" className="mb-3">
        <FaHdd className="text-primary-600 text-sm mr-2" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Disco de Almacenamiento</h2>
          <p className="text-xs text-gray-600">Estado del sistema de archivos</p>
        </div>
      </Flex>

      {/* Estado del disco */}
      <Flex alignItems="center" gap={3} className="mb-3">
        <div className={`p-2 rounded text-white ${diskInfo.mounted ? 'bg-success-500' : 'bg-gray-400'}`}>
          {diskInfo.mounted ? <FaCheckCircle className="text-sm" /> : <FaExclamationTriangle className="text-sm" />}
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500">Estado</p>
          <p className={`text-sm font-medium ${diskInfo.mounted ? 'text-success-600' : 'text-gray-600'}`}>
            {diskInfo.mounted ? 'Montado' : 'No montado'}
          </p>
        </div>
        <Button
          onClick={onMount}
          disabled={actionLoading}
          variant={diskInfo.mounted ? 'warning' : 'success'}
          size="sm"
        >
          {diskInfo.mounted ? 'Desmontar' : 'Montar'}
        </Button>
      </Flex>

      {diskInfo.mounted && (
        <>
          {/* Información del dispositivo */}
          <div className="border-t border-gray-100 pt-3 mb-3">
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-medium">Dispositivo:</span> {diskInfo.device}
              </div>
              <div>
                <span className="font-medium">Punto de montaje:</span> {diskInfo.path}
              </div>
            </div>
          </div>

          {/* Uso de espacio */}
          <div className="border-t border-gray-100 pt-3">
            <Flex alignItems="center" gap={2} className="mb-2">
              <div className="bg-primary-500 p-1.5 rounded text-white">
                <FaHdd className="text-xs" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Espacio utilizado</p>
                <p className="text-sm font-medium">{formatBytes(diskInfo.used)} de {formatBytes(diskInfo.total)}</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                {diskInfo.percent}%
              </div>
            </Flex>

            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  diskInfo.percent > 90 
                    ? 'bg-error-500' 
                    : diskInfo.percent > 70
                    ? 'bg-warning-500'
                    : 'bg-success-500'
                }`}
                style={{ width: `${diskInfo.percent}%` }}
              />
            </div>

            {/* Estadísticas compactas */}
            <Grid cols={2} gap={2} className="text-xs">
              <div className="text-center">
                <p className="text-gray-500">Libre</p>
                <p className="font-medium">{formatBytes(diskInfo.free)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Total</p>
                <p className="font-medium">{formatBytes(diskInfo.total)}</p>
              </div>
            </Grid>
          </div>
        </>
      )}

      {/* Alerta para dispositivos USB */}
      {diskInfo.isUsb && diskInfo.canEject && (
        <div className="border-t border-gray-100 pt-3">
          <div className="bg-warning-50 border border-warning-200 rounded p-2">
            <Flex alignItems="center" gap={2}>
              <FaEject className="text-warning-600 text-sm" />
              <div className="flex-1">
                <p className="text-xs text-warning-800 font-medium">Dispositivo USB</p>
                <p className="text-xs text-warning-700">Puede expulsarse de forma segura</p>
              </div>
              <Button
                onClick={() => onEject(diskInfo.device)}
                disabled={actionLoading}
                variant="warning"
                size="sm"
              >
                Expulsar
              </Button>
            </Flex>
          </div>
        </div>
      )}
    </Card>
  );
}

export default DiskInfoPanel;
