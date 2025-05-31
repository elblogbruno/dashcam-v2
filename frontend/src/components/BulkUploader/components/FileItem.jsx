import React from 'react'
import { FaFileVideo, FaCheckCircle, FaTimesCircle, FaPlay, FaEye, FaTimes, FaClock, FaEllipsisV } from 'react-icons/fa'
import PropTypes from 'prop-types'

const FileItem = ({ 
  file, 
  index, 
  thumbnail, 
  uploadProgress, 
  onPreview, 
  onRemove, 
  uploading, 
  formatDuration,
  viewMode = 'list',
  isMobile = false,
  onLongPress
}) => {
  const isSuccess = file.status === 'success'
  const isError = file.status === 'error'
  const isUploading = file.status === 'uploading'

  const statusClasses = {
    success: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm',
    error: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 shadow-sm',
    uploading: 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md',
    default: 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
  }

  const getStatusClass = () => {
    if (isSuccess) return statusClasses.success
    if (isError) return statusClasses.error
    if (isUploading) return statusClasses.uploading
    return statusClasses.default
  }

  // Manejar eventos táctiles para móvil
  const handleTouchStart = () => {
    if (isMobile && onLongPress) {
      const timer = setTimeout(() => onLongPress(index), 500)
      return () => clearTimeout(timer)
    }
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    if (isMobile && onLongPress) {
      onLongPress(index)
    }
  }

  if (viewMode === 'grid') {
    return (
      <div className={`group relative rounded-xl border transition-all duration-300 ${getStatusClass()} p-3`}
           onContextMenu={handleContextMenu}
           onTouchStart={handleTouchStart}>
        {/* Thumbnail principal */}
        <div className="relative aspect-video mb-3">
          {thumbnail ? (
            <div className="relative w-full h-full cursor-pointer" 
                 onClick={(e) => { 
                   e.preventDefault()
                   e.stopPropagation()
                   console.log('Thumbnail clicked, opening preview for file:', file.name)
                   onPreview(file, index)
                 }}>
              <img 
                src={thumbnail} 
                alt="Vista previa" 
                className="w-full h-full object-cover rounded-lg border border-gray-200"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 
                rounded-lg transition-all duration-200 flex items-center justify-center">
                <FaPlay className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xl drop-shadow-lg" />
              </div>
              {file.duration && (
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(file.duration)}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg 
              flex items-center justify-center border border-gray-200 cursor-pointer"
              onClick={(e) => { 
                e.preventDefault()
                e.stopPropagation()
                console.log('Default thumbnail clicked, opening preview for file:', file.name)
                onPreview(file, index)
              }}>
              <FaFileVideo className="text-gray-400 text-2xl" />
            </div>
          )}
          
          {/* Badge de estado */}
          {isSuccess && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full 
              flex items-center justify-center border-2 border-white shadow-sm">
              <FaCheckCircle className="text-white text-xs" />
            </div>
          )}
          {isError && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full 
              flex items-center justify-center border-2 border-white shadow-sm">
              <FaTimesCircle className="text-white text-xs" />
            </div>
          )}
          
          {/* Acciones */}
          <div className="absolute top-2 left-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { 
                e.stopPropagation()
                e.preventDefault()
                console.log('Grid view button clicked for file:', file.name)
                onPreview(file, index)
              }}
              className="p-1.5 bg-black bg-opacity-50 text-white rounded-lg hover:bg-opacity-75 transition-all"
              disabled={!thumbnail}
            >
              <FaEye className="text-xs" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(index); }}
              className="p-1.5 bg-black bg-opacity-50 text-white rounded-lg hover:bg-opacity-75 transition-all"
              disabled={uploading || file.status === 'uploading'}
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
        </div>
        
        {/* Información del archivo */}
        <div className="space-y-2">
          <h3 className="font-medium text-gray-800 truncate text-sm">
            {file.name}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            <span className="uppercase font-medium text-indigo-600">
              {file.name.split('.').pop()}
            </span>
          </div>
          
          {/* Estado */}
          {isUploading && (
            <div className="text-xs text-blue-600 flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Subiendo {uploadProgress || 0}%</span>
            </div>
          )}
          {isSuccess && (
            <div className="text-xs text-green-600 flex items-center space-x-1">
              <FaCheckCircle />
              <span>Completado</span>
            </div>
          )}
          {isError && (
            <div className="text-xs text-red-600 flex items-center space-x-1">
              <FaTimesCircle />
              <span>Error</span>
            </div>
          )}
        </div>
        
        {/* Progress bar */}
        {(file.status === 'uploading' || uploadProgress) && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${uploadProgress || 0}%` }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Vista lista
  return (
    <div className={`group relative rounded-xl border transition-all duration-300 ${getStatusClass()} ${isMobile ? 'p-4' : 'p-5'}`}
         onContextMenu={handleContextMenu}
         onTouchStart={handleTouchStart}>
      <div className="flex items-start space-x-4">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0">
          {thumbnail ? (
            <div className="relative group/thumb cursor-pointer" 
                 onClick={(e) => { 
                   e.preventDefault()
                   e.stopPropagation()
                   console.log('List thumbnail clicked, opening preview for file:', file.name)
                   onPreview(file, index)
                 }}>
              <img 
                src={thumbnail} 
                alt="Vista previa" 
                className={`${isMobile ? 'w-16 h-12' : 'w-20 h-14'} 
                  object-cover rounded-lg border-2 border-white shadow-sm 
                  group-hover/thumb:shadow-md transition-all duration-200`}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/thumb:bg-opacity-30 
                rounded-lg transition-all duration-200 flex items-center justify-center">
                <FaPlay className="text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity text-lg drop-shadow-lg" />
              </div>
              {file.duration && (
                <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">
                  {formatDuration(file.duration)}
                </div>
              )}
            </div>
          ) : (
            <div className={`${isMobile ? 'w-16 h-12' : 'w-20 h-14'} 
              bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg 
              flex items-center justify-center border-2 border-white shadow-sm cursor-pointer`}
              onClick={(e) => { 
                e.preventDefault()
                e.stopPropagation()
                console.log('List default thumbnail clicked, opening preview for file:', file.name)
                onPreview(file, index)
              }}>
              <FaFileVideo className="text-gray-400 text-xl" />
            </div>
          )}
          
          {/* Badge de estado */}
          {isSuccess && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full 
              flex items-center justify-center border-2 border-white shadow-sm">
              <FaCheckCircle className="text-white text-xs" />
            </div>
          )}
          {isError && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full 
              flex items-center justify-center border-2 border-white shadow-sm">
              <FaTimesCircle className="text-white text-xs" />
            </div>
          )}
        </div>
        
        {/* Información del archivo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 space-y-2">
              {/* Nombre y estado */}
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-800 truncate text-sm flex-1">
                  {file.name}
                </h3>
                {isUploading && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
                    Subiendo
                  </span>
                )}
                {isSuccess && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FaCheckCircle className="w-3 h-3 mr-1" />
                    Completado
                  </span>
                )}
                {isError && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <FaTimesCircle className="w-3 h-3 mr-1" />
                    Error
                  </span>
                )}
              </div>
              
              {/* Metadatos */}
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 lg:grid-cols-3 gap-3'}`}>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-600 font-medium">Tamaño:</span>
                  <span className="text-gray-800 font-semibold">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                {file.duration && (
                  <div className="flex items-center space-x-2 text-xs">
                    <FaClock className="w-2 h-2 text-purple-500 flex-shrink-0" />
                    <span className="text-gray-600 font-medium">Duración:</span>
                    <span className="text-gray-800 font-semibold bg-purple-50 px-2 py-0.5 rounded">
                      {formatDuration(file.duration)}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-600 font-medium">Formato:</span>
                  <span className="text-gray-800 font-semibold uppercase bg-indigo-50 px-2 py-0.5 rounded">
                    {file.name.split('.').pop()}
                  </span>
                </div>
              </div>
              
              {/* Error message */}
              {file.status === 'error' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <FaTimesCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-800 mb-1">
                        Error al procesar archivo
                      </p>
                      <p className="text-xs text-red-600">
                        {file.error && file.error.includes("DEMUXER_ERROR_COULD_NOT_OPEN") 
                          ? "El formato de archivo no es compatible. Intenta con MP4, MOV, AVI, WEBM, etc." 
                          : file.error || 'Error desconocido durante la carga'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Acciones */}
            <div className="flex items-center space-x-1 ml-2">
              {!uploading && file.status !== 'uploading' && (
                <>
                  {!isMobile && (
                    <>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation()
                          e.preventDefault()
                          console.log('List view button clicked for file:', file.name)
                          onPreview(file, index)
                        }}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 
                          rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                        disabled={!thumbnail}
                      >
                        <FaEye className="text-sm" />
                      </button>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 
                          rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <FaTimes className="text-sm" />
                      </button>
                    </>
                  )}
                  
                  {isMobile && onLongPress && (
                    <button
                      onClick={() => onLongPress(index)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 
                        rounded-lg transition-all duration-200"
                    >
                      <FaEllipsisV className="text-sm" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      {(file.status === 'uploading' || uploadProgress) && (
        <div className="w-full mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-blue-600">Subiendo...</span>
            <span className="text-xs text-gray-500">{uploadProgress || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full 
                transition-all duration-500 ease-out relative overflow-hidden" 
              style={{ width: `${uploadProgress || 0}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

FileItem.propTypes = {
  file: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  thumbnail: PropTypes.string,
  uploadProgress: PropTypes.number,
  onPreview: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  uploading: PropTypes.bool.isRequired,
  formatDuration: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['list', 'grid']),
  isMobile: PropTypes.bool,
  onLongPress: PropTypes.func
}

export default FileItem
