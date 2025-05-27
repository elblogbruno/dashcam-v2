import React from 'react'
import { FaUpload, FaFileVideo, FaFolderOpen, FaMobile } from 'react-icons/fa'
import PropTypes from 'prop-types'

/**
 * Componente de zona de arrastrar y soltar para cargar archivos
 */
const DragDropZone = ({ 
  dragActive, 
  handleDrag, 
  handleDrop, 
  onSelectFilesClick, 
  onSelectFolderClick, 
  fileInputRef, 
  folderInputRef, 
  onFileInputChange, 
  onFolderInputChange,
  supportedFormats,
  isMobile = false
}) => {
  return (
    <div 
      className={`border-2 border-dashed rounded-lg ${isMobile ? 'p-5' : 'p-6'} text-center mb-5 transition-all duration-200
        ${dragActive ? 'border-dashcam-500 bg-dashcam-50 shadow-lg scale-[1.01]' : 'border-gray-300 hover:border-gray-400'}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <div className={`transition-all duration-300 transform ${dragActive ? 'scale-110' : ''}`}>
        <FaUpload className={`mx-auto ${isMobile ? 'text-3xl mb-3' : 'text-4xl mb-3'} text-gray-400`} />
        <p className={`${isMobile ? 'text-base' : 'text-lg'} font-medium mb-2`}>
          {isMobile ? (dragActive ? 'Soltar aquí' : 'Subir videos') : 
                     (dragActive ? 'Soltar videos aquí' : 'Arrastra y suelta archivos de video aquí')}
        </p>
        <p className={`text-xs text-gray-500 ${isMobile ? 'mb-4' : 'mb-4'}`}>
          Formatos: {supportedFormats.join(', ')}
        </p>
      </div>
      
      <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'justify-center space-x-4'}`}>
        <button 
          onClick={onSelectFilesClick}
          className="btn btn-primary flex items-center justify-center transition-all hover:shadow-md text-sm w-full sm:w-auto py-2.5"
          type="button"
        >
          {isMobile ? (
            <>
              <FaMobile className="mr-2" />
              Seleccionar de Galería
            </>
          ) : (
            <>
              <FaFileVideo className="mr-2" />
              Seleccionar Archivos
            </>
          )}
        </button>
        
        <button 
          onClick={onSelectFolderClick}
          className="btn btn-secondary flex items-center justify-center transition-all hover:shadow-md text-sm w-full sm:w-auto py-2.5"
          type="button"
        >
          <FaFolderOpen className="mr-2" />
          {isMobile ? "Seleccionar Carpeta" : "Seleccionar Carpeta"}
        </button>
      </div>
      
      {/* Hidden file inputs */}
      <input 
        ref={fileInputRef}
        type="file" 
        multiple 
        accept="video/*,.insv,.mts,.m2ts"
        className="hidden"
        onChange={onFileInputChange}
        capture={isMobile ? "camera" : undefined}
      />
      <input 
        ref={folderInputRef}
        type="file" 
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={onFolderInputChange}
      />
    </div>
  )
}

DragDropZone.propTypes = {
  dragActive: PropTypes.bool.isRequired,
  handleDrag: PropTypes.func.isRequired,
  handleDrop: PropTypes.func.isRequired,
  onSelectFilesClick: PropTypes.func.isRequired,
  onSelectFolderClick: PropTypes.func.isRequired,
  fileInputRef: PropTypes.object.isRequired,
  folderInputRef: PropTypes.object.isRequired,
  onFileInputChange: PropTypes.func.isRequired,
  onFolderInputChange: PropTypes.func.isRequired,
  supportedFormats: PropTypes.arrayOf(PropTypes.string).isRequired,
  isMobile: PropTypes.bool
}

export default DragDropZone
