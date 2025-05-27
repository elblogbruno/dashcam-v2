// filepath: /root/dashcam-v2/frontend/src/components/BulkUploader/UploadOptions.jsx
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
    <div className={`card ${isMobile ? 'p-4' : 'p-4'} bg-white shadow-sm rounded-lg h-full`}>
      <h2 className="text-lg font-medium mb-5 flex items-center justify-between">
        <span>Opciones</span>
      </h2>
      
      {files?.length > 0 && (
        <div className="mb-6">
          <button 
            onClick={uploadFiles}
            className="btn btn-primary w-full py-3 flex items-center justify-center transition-all hover:shadow-md"
            disabled={uploading}
          >
            {uploading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Subiendo...
              </>
            ) : (
              <>
                <FaCloudUploadAlt className="mr-2 text-lg" />
                Subir {files.length} Archivo{files.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}
      
      <div className={`space-y-${isMobile ? '5' : '5'}`}>
        <div className={`flex items-center ${isMobile ? 'p-3' : 'p-3'} rounded-lg bg-blue-50 border border-blue-200`}>
          <div className="flex-grow pr-2">
            <label htmlFor="useFileDate" className="flex items-center text-gray-800 font-medium text-sm">
              <input 
                id="useFileDate" 
                type="checkbox" 
                checked={useFileDate} 
                onChange={() => setUseFileDate(!useFileDate)}
                className="mr-2 h-4 w-4"
              />
              <span>Detectar fecha automáticamente</span>
            </label>
            {!isMobile && (
              <p className="text-xs text-gray-600 mt-1">
                El sistema intentará extraer la fecha de grabación del nombre del archivo.
              </p>
            )}
          </div>
          <FaCalendarAlt className="text-blue-500 flex-shrink-0" />
        </div>
        
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block font-medium text-sm">Fecha predeterminada</label>
            <div className="flex items-center">
              <div className="bg-gray-100 p-2 rounded-l border-y border-l border-gray-300">
                <FaClock className="text-gray-500" />
              </div>
              <input 
                type="date" 
                value={uploadDate} 
                onChange={(e) => setUploadDate(e.target.value)}
                className="input rounded-l-none border-l-0 flex-grow"
                disabled={uploading}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block font-medium text-sm">Fuente del video</label>
            <select
              value={videoSource}
              onChange={(e) => setVideoSource(e.target.value)}
              className="input w-full py-2.5"
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
                  <option value="external">Cámara externa/móvil</option>
                  <option value="dashcam">Dashcam</option>
                  <option value="gopro">GoPro</option>
                  <option value="insta360">Insta360</option>
                  <option value="drone">Drone</option>
                  <option value="other">Otra</option>
                </>
              )}
            </select>
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block font-medium text-sm">Ubicación (opcional)</label>
            <button 
              type="button" 
              onClick={getCurrentLocation}
              className="text-xs text-dashcam-600 hover:text-dashcam-800 flex items-center"
              disabled={uploading || isGettingLocation}
            >
              {isGettingLocation ? (
                <span className="text-gray-500">Obteniendo...</span>
              ) : (
                <>
                  <FaMapMarkerAlt className="text-sm mr-1" />
                  Mi ubicación
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center">
                <div className="bg-gray-100 p-2 rounded-l border-y border-l border-gray-300">
                  <span className="text-xs text-gray-500">LAT</span>
                </div>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={uploadLocation.lat} 
                  onChange={(e) => setUploadLocation({...uploadLocation, lat: e.target.value})}
                  className="input rounded-l-none border-l-0 flex-grow"
                  placeholder="36.1699"
                  disabled={uploading}
                />
              </div>
            </div>
            
            <div>
              <div className="flex items-center">
                <div className="bg-gray-100 p-2 rounded-l border-y border-l border-gray-300">
                  <span className="text-xs text-gray-500">LON</span>
                </div>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={uploadLocation.lon} 
                  onChange={(e) => setUploadLocation({...uploadLocation, lon: e.target.value})}
                  className="input rounded-l-none border-l-0 flex-grow"
                  placeholder="-115.1398"
                  disabled={uploading}
                />
              </div>
            </div>
          </div>
          {!isMobile && (
            <p className="text-xs text-gray-500 mt-1">
              Los datos de ubicación ayudan a organizar los videos en un mapa.
            </p>
          )}
        </div>
        
        <div className="flex items-start space-x-2">
          <FaTag className="text-gray-400 mt-2 flex-shrink-0" />
          <div className="flex-grow">
            <label className="block font-medium text-sm mb-2">Etiquetas (opcional)</label>
            <input 
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input w-full py-2.5"
              placeholder="vacaciones, viaje, familia"
              disabled={uploading}
            />
            {!isMobile && (
              <p className="text-xs text-gray-500 mt-1">
                Añade etiquetas separadas por comas para categorizar tus videos.
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
