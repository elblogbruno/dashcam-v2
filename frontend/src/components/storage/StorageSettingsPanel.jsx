import React from 'react';
import { FaCog, FaTrash, FaHdd, FaToggleOn, FaSave } from 'react-icons/fa';
import { Card, Button } from '../common/UI';
import { Grid, Flex } from '../common/Layout';

function StorageSettingsPanel({ 
  settings, 
  onSettingChange, 
  onSettingsUpdate, 
  actionLoading 
}) {
  return (
    <Card className="p-3">
      {/* Encabezado simplificado */}
      <Flex alignItems="center" className="mb-3">
        <FaCog className="text-primary-600 text-sm mr-2" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            Configuración de Almacenamiento
          </h2>
          <p className="text-xs text-gray-600 hidden sm:block">
            Personalice el comportamiento del sistema de almacenamiento
          </p>
        </div>
      </Flex>

      <div className="space-y-3">
        {/* Limpieza automática */}
        <div className="border-t border-gray-100 pt-3">
          <Flex alignItems="center" gap={2} className="mb-3">
            <div className="bg-primary-500 p-1.5 rounded text-white">
              <FaTrash className="text-xs" />
            </div>
            <h3 className="font-medium text-sm text-gray-900">Limpieza Automática</h3>
          </Flex>

          <div className="space-y-3">
            <Flex direction="col" gap={2} className="sm:flex-row sm:items-center sm:justify-between">
              <label className="text-xs text-gray-700">
                Activar limpieza automática
              </label>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input 
                  type="checkbox" 
                  checked={settings.autoCleanEnabled}
                  onChange={e => onSettingChange('autoCleanEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </Flex>

            <div>
              <label className="text-xs text-gray-700 block mb-1">
                Umbral de limpieza (%)
              </label>
              <input 
                type="number" 
                value={settings.autoCleanThreshold}
                onChange={e => onSettingChange('autoCleanThreshold', parseInt(e.target.value))}
                className="input w-full bg-white border border-gray-300 rounded p-2 text-xs"
                disabled={!settings.autoCleanEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                La limpieza comenzará cuando el uso del disco supere este porcentaje
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-700 block mb-1">
                Días a conservar
              </label>
              <input 
                type="number" 
                value={settings.autoCleanDays}
                onChange={e => onSettingChange('autoCleanDays', parseInt(e.target.value))}
                className="input w-full bg-white border border-gray-300 rounded p-2 text-xs"
                disabled={!settings.autoCleanEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Los videos más antiguos que estos días serán eliminados primero
              </p>
            </div>
          </div>
        </div>

        {/* Configuración de unidad */}
        <div className="border-t border-gray-100 pt-3">
          <Flex alignItems="center" gap={2} className="mb-3">
            <div className="bg-primary-500 p-1.5 rounded text-white">
              <FaHdd className="text-xs" />
            </div>
            <h3 className="font-medium text-sm text-gray-900">Configuración de Unidad</h3>
          </Flex>

          <div className="space-y-3">
            <Flex direction="col" gap={2} className="sm:flex-row sm:items-center sm:justify-between">
              <label className="text-xs text-gray-700">
                Detección automática de unidades USB
              </label>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input 
                  type="checkbox" 
                  checked={settings.autoDetectDrives}
                  onChange={e => onSettingChange('autoDetectDrives', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </Flex>

            <div>
              <label className="text-xs text-gray-700 block mb-1">
                Dispositivo de Unidad Principal
              </label>
              <input 
                type="text" 
                value={settings.mainDrive}
                onChange={e => onSettingChange('mainDrive', e.target.value)}
                className="input w-full bg-white border border-gray-300 rounded p-2 text-xs break-all"
                placeholder="/dev/sda1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ruta del dispositivo para almacenamiento externo (e.j., /dev/sda1)
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-700 block mb-1">
                Punto de Montaje
              </label>
              <input 
                type="text" 
                value={settings.mountPoint}
                onChange={e => onSettingChange('mountPoint', e.target.value)}
                className="input w-full bg-white border border-gray-300 rounded p-2 text-xs break-all"
                placeholder="/mnt/dashcam_storage"
              />
              <p className="text-xs text-gray-500 mt-1">
                Directorio donde se montará la unidad
              </p>
            </div>
          </div>
        </div>

        {/* Botón de guardar */}
        <div className="border-t border-gray-100 pt-3">
          <div className="flex justify-center sm:justify-end">
            <Button
              onClick={onSettingsUpdate}
              disabled={actionLoading}
              variant="primary"
              className="w-full sm:w-auto text-xs"
            >
              <FaSave className="text-xs mr-1" />
              Guardar Cambios
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default StorageSettingsPanel;
