import React from 'react'
import { FaCalendarAlt, FaCloudUploadAlt, FaMapMarkerAlt, FaSpinner, FaClock, FaTag } from 'react-icons/fa'
import PropTypes from 'prop-types'

/**
 * Componente para las opciones de carga
 */
const UploadOptions = ({ 
  useFileDate, 
  setUseFileDate, 
  uploadDate, 
  setUploadDate, 
  videoSource, 
  setVideoSource,
  uploadLocation, 
  setUploadLocation, 
  isGettingLocation, 
  getCurrentLocation,
  tags,
  setTags,
  uploading,
  files,
  uploadFiles,
  isMobile = false
}) => {
  return (
    <div className="bg-white shadow-lg rounded-lg h-full border border-gray-200">
      <div className="bg-gradient-to-r from-dashcam-600 to-dashcam-500 text-white p-3 rounded-t-lg">
        <h2 className="text-base font-semibold flex items-center">
          <FaCloudUploadAlt className="mr-2 text-sm" />
          <span>Opciones de Carga</span>
        </h2>
      </div>
      
      <div className="p-3">
        {files?.length > 0 && (
          <div className="mb-4">
            <button 
              onClick={uploadFiles}
              className="btn btn-primary w-full py-2.5 text-sm flex items-center justify-center transition-all hover:shadow-md"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <FaSpinner className="animate-spin mr-2 text-sm" />
                  Subiendo...
                </>
              ) : (
                <>
                  <FaCloudUploadAlt className="mr-2" />
                  Subir {files.length} {files.length === 1 ? 'Archivo' : 'Archivos'}
                </>
              )}
            </button>
          </div>
        )}
        
        <div className="space-y-4">
          {/* Detección automática de fecha */}
          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
            <div className="flex items-start gap-2">
              <div className="bg-gradient-to-r from-dashcam-500 to-dashcam-600 p-1.5 rounded-md text-white flex-shrink-0 mt-0.5">
                <FaCalendarAlt className="text-xs" />
              </div>
              <div className="flex-grow min-w-0">
                <label htmlFor="useFileDate" className="flex items-start text-gray-800 font-medium text-sm cursor-pointer">
                  <input 
                    id="useFileDate" 
                    type="checkbox" 
                    checked={useFileDate} 
                    onChange={() => setUseFileDate(!useFileDate)}
                    className="mr-2 h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                  />
                  <span className="leading-tight">Detectar fecha automáticamente</span>
                </label>
                {!isMobile && (
                  <p className="text-xs text-gray-600 mt-1 leading-tight">
                    Extrae la fecha del nombre del archivo.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Fecha predeterminada */}
          <div className="space-y-2">
            <label className="block font-medium text-xs text-gray-700">Fecha predeterminada</label>
            <div className="flex items-center">
              <div className="bg-gray-100 p-1.5 rounded-l border-y border-l border-gray-300">
                <FaClock className="text-gray-500 text-xs" />
              </div>
              <input 
                type="date" 
                value={uploadDate} 
                onChange={(e) => setUploadDate(e.target.value)}
                className="input rounded-l-none border-l-0 flex-grow text-sm py-1.5"
                disabled={uploading}
              />
            </div>
          </div>
          
          {/* Fuente del video */}
          <div className="space-y-2">
            <label className="block font-medium text-xs text-gray-700">Fuente del video</label>
            <select
              value={videoSource}
              onChange={(e) => setVideoSource(e.target.value)}
              className="input w-full py-2 text-sm"
              disabled={uploading}
            >
              {isMobile ? (
                <>
                  <option value="external">Móvil/Cámara</option>
                  <option value="insta360">Insta360</option>
                  <option value="gopro">GoPro</option>
                  <option value="drone">Drone</option>
                  <option value="dashcam">Dashcam</option>
                  <option value="other">Otra fuente</option>
                </>
              ) : (
                <>
                  <option value="external">Cámara externa</option>
                  <option value="dashcam">Dashcam</option>
                  <option value="gopro">GoPro</option>
                  <option value="insta360">Insta360</option>
                  <option value="drone">Drone</option>
                  <option value="other">Otra</option>
                </>
              )}
            </select>
          </div>
          
          {/* Ubicación */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-medium text-xs text-gray-700">Ubicación</label>
              <button 
                type="button" 
                onClick={getCurrentLocation}
                className="text-xs text-dashcam-600 hover:text-dashcam-800 flex items-center"
                disabled={uploading || isGettingLocation}
              >
                {isGettingLocation ? (
                  <span className="text-gray-500">...</span>
                ) : (
                  <>
                    <FaMapMarkerAlt className="text-xs mr-1" />
                    Mi ubicación
                  </>
                )}
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="bg-gray-100 p-1.5 rounded-l border-y border-l border-gray-300 text-center min-w-[32px]">
                  <span className="text-xs text-gray-500 font-mono">LAT</span>
                </div>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={uploadLocation.lat} 
                  onChange={(e) => setUploadLocation({...uploadLocation, lat: e.target.value})}
                  className="input rounded-l-none border-l-0 flex-grow text-sm py-1.5"
                  placeholder="36.1699"
                  disabled={uploading}
                />
              </div>
              
              <div className="flex items-center">
                <div className="bg-gray-100 p-1.5 rounded-l border-y border-l border-gray-300 text-center min-w-[32px]">
                  <span className="text-xs text-gray-500 font-mono">LON</span>
                </div>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={uploadLocation.lon} 
                  onChange={(e) => setUploadLocation({...uploadLocation, lon: e.target.value})}
                  className="input rounded-l-none border-l-0 flex-grow text-sm py-1.5"
                  placeholder="-115.1398"
                  disabled={uploading}
                />
              </div>
            </div>
            {!isMobile && (
              <p className="text-xs text-gray-500 mt-1 leading-tight">
                Para organizar videos en el mapa.
              </p>
            )}
          </div>
          
          {/* Etiquetas */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="bg-gray-100 p-1.5 rounded border border-gray-300">
                <FaTag className="text-gray-500 text-xs" />
              </div>
              <label className="block font-medium text-xs text-gray-700 flex-grow">Etiquetas (opcional)</label>
            </div>
            <input 
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input w-full py-2 text-sm"
              placeholder="vacaciones, viaje, familia"
              disabled={uploading}
            />
            {!isMobile && (
              <p className="text-xs text-gray-500 mt-1 leading-tight">
                Separa etiquetas con comas.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

UploadOptions.propTypes = {
  useFileDate: PropTypes.bool.isRequired,
  setUseFileDate: PropTypes.func.isRequired,
  uploadDate: PropTypes.string.isRequired,
  setUploadDate: PropTypes.func.isRequired,
  videoSource: PropTypes.string.isRequired,
  setVideoSource: PropTypes.func.isRequired,
  uploadLocation: PropTypes.shape({
    lat: PropTypes.string.isRequired,
    lon: PropTypes.string.isRequired
  }).isRequired,
  setUploadLocation: PropTypes.func.isRequired,
  isGettingLocation: PropTypes.bool.isRequired,
  getCurrentLocation: PropTypes.func.isRequired,
  tags: PropTypes.string.isRequired,
  setTags: PropTypes.func.isRequired,
  uploading: PropTypes.bool.isRequired,
  files: PropTypes.array,
  uploadFiles: PropTypes.func,
  isMobile: PropTypes.bool
}

export default UploadOptions
