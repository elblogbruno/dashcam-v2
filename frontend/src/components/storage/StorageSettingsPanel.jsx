import React from 'react';
import { FaCog, FaTrash, FaHdd, FaToggleOn, FaSave } from 'react-icons/fa';

function StorageSettingsPanel({ 
  settings, 
  onSettingChange, 
  onSettingsUpdate, 
  actionLoading 
}) {
  return (
    <div className="card bg-white shadow-xl rounded-xl border border-neutral-200 hover:shadow-2xl transition-all duration-500">
      <div className="card-body p-0">
        <div className="bg-gradient-to-r from-dashcam-600 to-dashcam-500 text-dashcam-content p-3 sm:p-4 font-semibold">
          <div className="flex items-center">
            <FaCog className="text-xl sm:text-2xl mr-2 sm:mr-3 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold">
                Configuración de Almacenamiento
              </h2>
              <p className="text-xs sm:text-sm opacity-80 hidden sm:block">
                Personalice el comportamiento del sistema de almacenamiento
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="space-y-4 sm:space-y-6">
            {/* Limpieza automática */}
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content flex-shrink-0">
                  <FaTrash className="text-sm sm:text-lg" />
                </div>
                <h3 className="text-sm sm:text-base font-medium">Limpieza Automática</h3>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-xs sm:text-sm text-neutral-700">
                    Activar limpieza automática
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={settings.autoCleanEnabled}
                      onChange={e => onSettingChange('autoCleanEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-dashcam-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dashcam-500"></div>
                  </label>
                </div>

                <div>
                  <label className="text-xs sm:text-sm text-neutral-700 block mb-1">
                    Umbral de limpieza (%)
                  </label>
                  <input 
                    type="number" 
                    value={settings.autoCleanThreshold}
                    onChange={e => onSettingChange('autoCleanThreshold', parseInt(e.target.value))}
                    className="input w-full bg-white border border-neutral-300 rounded-lg p-2 text-sm"
                    disabled={!settings.autoCleanEnabled}
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    La limpieza comenzará cuando el uso del disco supere este porcentaje
                  </p>
                </div>

                <div>
                  <label className="text-xs sm:text-sm text-neutral-700 block mb-1">
                    Días a conservar
                  </label>
                  <input 
                    type="number" 
                    value={settings.autoCleanDays}
                    onChange={e => onSettingChange('autoCleanDays', parseInt(e.target.value))}
                    className="input w-full bg-white border border-neutral-300 rounded-lg p-2 text-sm"
                    disabled={!settings.autoCleanEnabled}
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Los videos más antiguos que estos días serán eliminados primero
                  </p>
                </div>
              </div>
            </div>

            {/* Configuración de unidad */}
            <div className="bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-2 rounded-lg text-dashcam-content flex-shrink-0">
                  <FaHdd className="text-sm sm:text-lg" />
                </div>
                <h3 className="text-sm sm:text-base font-medium">Configuración de Unidad</h3>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-xs sm:text-sm text-neutral-700">
                    Detección automática de unidades USB
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={settings.autoDetectDrives}
                      onChange={e => onSettingChange('autoDetectDrives', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-dashcam-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dashcam-500"></div>
                  </label>
                </div>

                <div>
                  <label className="text-xs sm:text-sm text-neutral-700 block mb-1">
                    Dispositivo de Unidad Principal
                  </label>
                  <input 
                    type="text" 
                    value={settings.mainDrive}
                    onChange={e => onSettingChange('mainDrive', e.target.value)}
                    className="input w-full bg-white border border-neutral-300 rounded-lg p-2 text-sm break-all"
                    placeholder="/dev/sda1"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Ruta del dispositivo para almacenamiento externo (e.j., /dev/sda1)
                  </p>
                </div>

                <div>
                  <label className="text-xs sm:text-sm text-neutral-700 block mb-1">
                    Punto de Montaje
                  </label>
                  <input 
                    type="text" 
                    value={settings.mountPoint}
                    onChange={e => onSettingChange('mountPoint', e.target.value)}
                    className="input w-full bg-white border border-neutral-300 rounded-lg p-2 text-sm break-all"
                    placeholder="/mnt/dashcam_storage"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Directorio donde se montará la unidad
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botón de guardar */}
          <div className="mt-4 sm:mt-6 flex justify-center sm:justify-end">
            <button
              onClick={onSettingsUpdate}
              disabled={actionLoading}
              className="btn bg-dashcam-500 hover:bg-dashcam-600 text-dashcam-content rounded-lg px-4 sm:px-6 py-2 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <FaSave className="text-sm" />
              <span className="text-sm">Guardar Cambios</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StorageSettingsPanel;
