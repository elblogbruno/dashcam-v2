import React, { useState, useEffect } from 'react'
import { FaFileVideo, FaTrash, FaTh, FaList, FaEllipsisV, FaEye } from 'react-icons/fa'
import PropTypes from 'prop-types'

import FileItem from './components/FileItem'
import PreviewModal from './components/PreviewModal'
import Pagination from './components/Pagination'
import { useThumbnails } from './hooks/useThumbnails'
import { usePreview } from './hooks/usePreview'

/**
 * Componente para mostrar la lista de archivos y su estado de carga
 */
const FileList = ({
  files,
  uploadProgress,
  removeFile,
  clearFiles,
  uploadFiles,
  uploading,
  isMobile = false
}) => {
  // Estado para vista y paginación
  const [viewMode, setViewMode] = useState('list')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeMenu, setActiveMenu] = useState(null)
  
  const itemsPerPage = isMobile ? 6 : 12
  
  // Hooks personalizados
  const thumbnails = useThumbnails(files)
  const { previewFile, previewUrl, openPreview, closePreview } = usePreview()
  
  // Calcular archivos para la página actual
  const totalPages = Math.ceil(files.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentFiles = files.slice(startIndex, endIndex)
  
  // Resetear página cuando cambian los archivos
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [files.length, totalPages, currentPage])

  // Función para formatear duración
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Función para manejar toques prolongados en móvil
  const handleLongPress = (index) => {
    if (isMobile) {
      setActiveMenu(activeMenu === index ? null : index)
    }
  }

  // Vista para móvil si no hay archivos
  if (files.length === 0) return null

  return (
    <>
      <div className={`${isMobile ? 'p-4 mx-2' : 'p-6'} mb-6 bg-white shadow-lg rounded-xl border border-gray-100`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <FaFileVideo className="text-white text-lg" />
            </div>
            <div>
              <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-800`}>
                Archivos Seleccionados
              </h2>
              <p className="text-sm text-gray-500">
                {files.length} archivo{files.length !== 1 ? 's' : ''} • {(files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(1)} MB
                {totalPages > 1 && (
                  <span className="ml-2">• Página {currentPage} de {totalPages}</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Controles de vista */}
            {!isMobile && (
              <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'list' 
                      ? 'bg-white shadow-sm text-blue-600' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <FaList className="text-sm" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-white shadow-sm text-blue-600' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <FaTh className="text-sm" />
                </button>
              </div>
            )}
            
            <button 
              onClick={clearFiles}
              className={`${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'} 
                bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 
                border border-gray-200 hover:border-red-200 rounded-lg 
                transition-all duration-200 font-medium flex items-center space-x-2`}
              disabled={uploading}
            >
              <FaTrash className="text-xs" />
              <span>{isMobile ? 'Limpiar' : 'Limpiar Todo'}</span>
            </button>
            
            {/* Botón de debug temporal */}
            {files.length > 0 && (
              <button 
                onClick={() => {
                  console.log('Debug: Force opening preview for first file:', files[0])
                  console.log('Current preview state before:', { previewFile, previewUrl })
                  openPreview(files[0], 0)
                  console.log('Current preview state after:', { previewFile, previewUrl })
                }}
                className="px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 
                  border border-blue-200 rounded-lg transition-all duration-200 font-medium"
              >
                🔍 Test Modal
              </button>
            )}
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className={`${isMobile ? 'max-h-80' : 'max-h-96'} overflow-y-auto`}>
          {viewMode === 'grid' ? (
            <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-3 lg:grid-cols-4 gap-4'}`}>
              {currentFiles.map((file, index) => {
                const actualIndex = startIndex + index
                return (
                  <FileItem
                    key={actualIndex}
                    file={file}
                    index={actualIndex}
                    thumbnail={thumbnails[actualIndex]}
                    uploadProgress={uploadProgress[actualIndex]}
                    onPreview={openPreview}
                    onRemove={removeFile}
                    uploading={uploading}
                    formatDuration={formatDuration}
                    viewMode="grid"
                    isMobile={isMobile}
                  />
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {currentFiles.map((file, index) => {
                const actualIndex = startIndex + index
                return (
                  <div key={actualIndex}>
                    <FileItem
                      file={file}
                      index={actualIndex}
                      thumbnail={thumbnails[actualIndex]}
                      uploadProgress={uploadProgress[actualIndex]}
                      onPreview={openPreview}
                      onRemove={removeFile}
                      uploading={uploading}
                      formatDuration={formatDuration}
                      viewMode="list"
                      isMobile={isMobile}
                      onLongPress={handleLongPress}
                    />
                    
                    {/* Menú móvil */}
                    {isMobile && activeMenu === actualIndex && (
                      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(actualIndex)
                            setActiveMenu(null)
                          }}
                          className="flex items-center justify-center space-x-2 px-4 py-3 
                            text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 
                            rounded-lg transition-all duration-200 text-sm font-medium"
                        >
                          <FaTrash />
                          <span>Eliminar</span>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            console.log('Mobile view button clicked for file:', file.name)
                            openPreview(file, actualIndex)
                            setActiveMenu(null)
                          }}
                          className="flex items-center justify-center space-x-2 px-4 py-3 
                            text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 
                            rounded-lg transition-all duration-200 text-sm font-medium 
                            disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!thumbnails[actualIndex]}
                        >
                          <FaEye />
                          <span>Vista</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {/* Paginación */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalFiles={files.length}
          onPageChange={setCurrentPage}
        />
      </div>
      
      {/* Modal de previsualización */}
      <PreviewModal
        previewFile={previewFile}
        previewUrl={previewUrl}
        totalFiles={files.length}
        onClose={closePreview}
        onRemove={removeFile}
        uploading={uploading}
        formatDuration={formatDuration}
      />
    </>
  )
}

FileList.propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      file: PropTypes.object.isRequired,
      name: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired,
      type: PropTypes.string.isRequired,
      fileDate: PropTypes.string,
      status: PropTypes.string.isRequired,
      duration: PropTypes.number
    })
  ).isRequired,
  uploadProgress: PropTypes.object.isRequired,
  removeFile: PropTypes.func.isRequired,
  clearFiles: PropTypes.func.isRequired,
  uploadFiles: PropTypes.func.isRequired,
  uploading: PropTypes.bool.isRequired,
  isMobile: PropTypes.bool
}

export default FileList
