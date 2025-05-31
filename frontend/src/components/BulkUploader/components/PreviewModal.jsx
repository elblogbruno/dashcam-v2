import React, { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes, FaClock } from 'react-icons/fa'
import PropTypes from 'prop-types'

const PreviewModal = ({ 
  previewFile, 
  previewUrl, 
  totalFiles, 
  onClose, 
  onRemove, 
  uploading, 
  formatDuration 
}) => {
  const videoRef = useRef(null)
  const [isVertical, setIsVertical] = useState(false)

  // Efecto para detectar orientación del video
  useEffect(() => {
    if (!videoRef.current || !previewUrl) return
    
    const handleMetadata = () => {
      if (videoRef.current) {
        const { videoWidth, videoHeight } = videoRef.current
        setIsVertical(videoHeight > videoWidth)
      }
    }
    
    const video = videoRef.current
    video.addEventListener('loadedmetadata', handleMetadata)
    
    // Por si los metadatos ya están cargados
    if (video.readyState >= 1) {
      handleMetadata()
    }
    
    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata)
    }
  }, [previewUrl])

  // Efecto combinado para manejar escape, scroll y prevenir pantalla completa
  useEffect(() => {
    if (!previewFile || !previewUrl) return
    
    // Manejo de escape
    const handleEscape = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    
    // Definir blockFullscreen fuera de la condición para que esté disponible en el return
    const blockFullscreen = e => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    
    // Prevenir pantalla completa
    const video = videoRef.current
    if (video) {
      video.playsInline = true
      video.setAttribute('playsinline', '')
      
      video.addEventListener('webkitbeginfullscreen', blockFullscreen, true)
      video.addEventListener('fullscreenchange', blockFullscreen, true)
      
      // Anular métodos de pantalla completa
      video.requestFullscreen = () => Promise.resolve()
      video.webkitRequestFullscreen = () => {}
      video.webkitEnterFullscreen = () => {}
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
      
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', blockFullscreen, true)
        video.removeEventListener('fullscreenchange', blockFullscreen, true)
      }
    }
  }, [onClose, previewFile, previewUrl])

  if (!previewFile || !previewUrl) return null

const modalContent = (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80"
        onClick={onClose}
    >
        <div 
            className="bg-white rounded-lg shadow-xl flex flex-col w-full max-h-[90vh]"
            style={{
                maxWidth: isVertical ? '65vw' : '85vw',
                minWidth: isVertical ? 'auto' : '50vw'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b border-gray-200">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {previewFile.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>{(previewFile.size / 1024 / 1024).toFixed(1)} MB</span>
                        {previewFile.duration && (
                            <span className="flex items-center">
                                <FaClock size={10} className="mr-1" />
                                {formatDuration(previewFile.duration)}
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                    <FaTimes size={16} />
                </button>
            </div>
             
            <div className="bg-black flex justify-center w-full">
                <div 
                    className="relative w-full" 
                    style={{
                        aspectRatio: isVertical ? '9/16' : '16/9',
                        maxHeight: '70vh',
                        maxWidth: isVertical ? '500px' : '100%'
                    }}
                >
                    <video
                        ref={videoRef}
                        src={previewUrl}
                        width="100%"
                        height="100%"
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                        controlsList="nodownload"
                        disablePictureInPicture
                        preload="metadata"
                        onContextMenu={(e) => e.preventDefault()}
                    />
                </div>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between p-2 border-t border-gray-200 text-sm">
                <div className="text-gray-500">
                    {previewFile.index + 1}/{totalFiles}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {onRemove(previewFile.index); onClose()}}
                        disabled={uploading}
                        className={`px-3 py-1 font-medium rounded ${
                            uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 
                            'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                    >
                        Eliminar
                    </button>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    </div>
)

  return createPortal(modalContent, document.body)
}

PreviewModal.propTypes = {
  previewFile: PropTypes.object,
  previewUrl: PropTypes.string,
  totalFiles: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  uploading: PropTypes.bool.isRequired,
  formatDuration: PropTypes.func.isRequired
}

export default PreviewModal
