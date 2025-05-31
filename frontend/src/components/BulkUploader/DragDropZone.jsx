import React from 'react'
import { FaUpload, FaFileVideo, FaFolderOpen, FaMobile, FaSearch } from 'react-icons/fa'
import PropTypes from 'prop-types'

/**
 * Componente de zona de arrastrar y soltar para cargar archivos
 */
const DragDropZone = (props) => {
  const { 
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
    isMobile = false,
    onOpenFileExplorer
  } = props;
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 shadow-xl rounded-2xl border border-gray-100 mb-6 overflow-hidden">
      <div 
        className={`border-2 border-dashed rounded-xl ${isMobile ? 'p-6' : 'p-8'} text-center transition-all duration-300 ease-out
          ${dragActive 
            ? 'border-dashcam-400 bg-gradient-to-br from-dashcam-50 to-blue-50 shadow-2xl scale-[1.02] border-opacity-80' 
            : 'border-gray-300 hover:border-dashcam-300 hover:bg-gradient-to-br hover:from-gray-50 hover:to-dashcam-25'
          } backdrop-blur-sm`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <div className={`transition-all duration-500 ease-out transform ${dragActive ? 'scale-105 -translate-y-1' : 'hover:scale-102'}`}>
          <div className={`mx-auto ${isMobile ? 'w-12 h-12 mb-4' : 'w-16 h-16 mb-5'} 
            bg-gradient-to-br from-dashcam-400 to-blue-500 rounded-2xl flex items-center justify-center
            shadow-lg transition-all duration-300 ${dragActive ? 'shadow-xl scale-110' : 'hover:shadow-lg'}`}>
            <FaUpload className={`${isMobile ? 'text-xl' : 'text-2xl'} text-white`} />
          </div>
          
          <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold mb-2 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent`}>
            {isMobile ? (dragActive ? 'Soltar aquí' : 'Subir videos') : 
                       (dragActive ? 'Soltar videos aquí' : 'Arrastra y suelta archivos de video')}
          </h3>
          
          <p className={`text-sm text-gray-500 ${isMobile ? 'mb-5' : 'mb-6'} font-medium`}>
            Formatos soportados: <span className="text-dashcam-600 font-semibold">{supportedFormats.join(', ')}</span>
          </p>
        </div>
        
        <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'justify-center space-x-4'}`}>
          <button 
            onClick={onSelectFilesClick}
            className="group relative overflow-hidden bg-gradient-to-r from-dashcam-500 to-blue-600 hover:from-dashcam-600 hover:to-blue-700 
              text-white font-semibold flex items-center justify-center transition-all duration-300 ease-out
              rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
              w-full sm:w-auto px-6 py-3 text-sm border border-dashcam-400"
            type="button"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            {isMobile ? (
              <>
                <FaMobile className="mr-2 transition-transform duration-300 group-hover:scale-110" />
                Seleccionar de Galería
              </>
            ) : (
              <>
                <FaFileVideo className="mr-2 transition-transform duration-300 group-hover:scale-110" />
                Seleccionar Archivos
              </>
            )}
          </button>
          
          <button 
            onClick={onSelectFolderClick}
            className="group relative overflow-hidden bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 
              text-gray-700 font-semibold flex items-center justify-center transition-all duration-300 ease-out
              rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 
              w-full sm:w-auto px-6 py-3 text-sm border border-gray-300"
            type="button"
          >
            <div className="absolute inset-0 bg-dashcam-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
            <FaFolderOpen className="mr-2 transition-transform duration-300 group-hover:scale-110" />
            Seleccionar Carpeta
          </button>
          
          {/* Nuevo botón para explorar archivos */}
          <button 
            onClick={onOpenFileExplorer}
            className="group relative overflow-hidden bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700
              text-white font-semibold flex items-center justify-center transition-all duration-300 ease-out
              rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 
              w-full sm:w-auto px-6 py-3 text-sm border border-teal-400"
            type="button"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <FaSearch className="mr-2 transition-transform duration-300 group-hover:scale-110" />
            Explorar Archivos
          </button>
        </div>
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
  isMobile: PropTypes.bool,
  onOpenFileExplorer: PropTypes.func
}

export default DragDropZone
