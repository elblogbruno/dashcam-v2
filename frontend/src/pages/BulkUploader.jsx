import { useState, useRef, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { FaAngleUp, FaAngleDown, FaFileUpload, FaFolderOpen } from 'react-icons/fa'

// Componentes
import DragDropZone from '../components/BulkUploader/DragDropZone'
import UploadOptions from '../components/BulkUploader/UploadOptions'
import FileList from '../components/BulkUploader/FileList'
import UploadResults from '../components/BulkUploader/UploadResults'
import FileExplorer from '../components/FileExplorer'

// Servicios
import { processFiles, uploadVideoFile } from '../components/BulkUploader/uploadService'
import axios from 'axios'

function BulkUploader() {
  // Estado de archivos y carga
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [uploadResults, setUploadResults] = useState([])
  const [dragActive, setDragActive] = useState(false)
  
  // Estado para el explorador de archivos
  const [showFileExplorer, setShowFileExplorer] = useState(false)
  const [selectedDisk, setSelectedDisk] = useState('internal')
  
  // Estado de opciones de carga
  const [useFileDate, setUseFileDate] = useState(true)
  const [uploadDate, setUploadDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [uploadLocation, setUploadLocation] = useState({ lat: '', lon: '' })
  const [videoSource, setVideoSource] = useState('external')
  const [tags, setTags] = useState('')
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  
  // Referencias
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  
  // Formatos soportados
  const supportedFormats = ['MP4', 'AVI', 'MOV', 'INSV', 'MTS', 'M2TS']

  // Set up drag and drop event handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  // Handle dropped files
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelection(e.dataTransfer.files)
    }
  }, [])

  // Process selected files
  const handleFilesSelection = async (fileList) => {
    const newFiles = await processFiles(fileList)
    
    if (newFiles.length === 0) {
      alert(`No se encontraron archivos de video. Formatos soportados: ${supportedFormats.join(', ')}`)
      return
    }
    
    setFiles(prev => [...prev, ...newFiles])
  }

  // Handle file selection via button
  const onSelectFilesClick = () => {
    fileInputRef.current.click()
  }
  
  // Handle folder selection via button
  const onSelectFolderClick = () => {
    folderInputRef.current.click()
  }

  // Handle file input change
  const onFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelection(e.target.files)
    }
  }

  // Handle folder input change (gets all files in the folder)
  const onFolderInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelection(e.target.files)
    }
  }

  // Remove a file from the list
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Clear all files
  const clearFiles = () => {
    setFiles([])
    setUploadProgress({})
    setUploadResults([])
  }

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsGettingLocation(true)
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUploadLocation({
            lat: position.coords.latitude.toFixed(6),
            lon: position.coords.longitude.toFixed(6)
          })
          setIsGettingLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          alert('No se pudo obtener la ubicación. Por favor verifica los permisos de ubicación.')
          setIsGettingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
    } else {
      alert('Tu navegador no soporta geolocalización')
    }
  }

  // Upload all files
  const uploadFiles = async () => {
    if (files.length === 0) {
      alert('No hay archivos para cargar')
      return
    }
    
    setUploading(true)
    setUploadResults([])
    const results = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress({
        current: i + 1,
        total: files.length,
        percent: Math.round(((i + 1) / files.length) * 100),
        fileName: file.name
      })
      
      try {
        // Si es un archivo externo, usamos la API de indexación en lugar de subir
        if (file.isExternalFile) {
          const response = await axios.post('/api/file-explorer/index-video', {
            file_path: file.path,
            file_date: useFileDate ? null : uploadDate,
            latitude: uploadLocation.lat || null,
            longitude: uploadLocation.lon || null,
            tags: tags || null,
            source: videoSource
          })
          
          results.push({
            name: file.name,
            success: true,
            message: 'Video indexado correctamente',
            path: file.path
          })
        } else {
          // Proceso normal de subida para archivos locales
          const result = await uploadVideoFile(
            file, 
            useFileDate, 
            uploadDate, 
            uploadLocation.lat, 
            uploadLocation.lon, 
            tags,
            videoSource
          )
          results.push(result)
        }
      } catch (error) {
        console.error(`Error al cargar ${file.name}:`, error)
        results.push({
          name: file.name,
          success: false,
          message: error.response?.data?.detail || 'Error al cargar el archivo',
          path: file.path || null
        })
      }
    }
    
    setUploadResults(results)
    setUploadProgress({})
    setUploading(false)
    
    // Si todas las cargas fueron exitosas, limpiar la lista de archivos
    if (results.every(r => r.success)) {
      clearFiles()
    }
  }

  // Estado para controlar la visibilidad de opciones en dispositivos móviles
  const [showOptions, setShowOptions] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Detector de cambio de tamaño para adaptar la UI
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle file selection via FileExplorer
  const handleFileFromExplorer = (file) => {
    if (file && file.is_video) {
      // Crear un objeto similar a File para mantener consistencia con el procesamiento
      const newFile = {
        name: file.name,
        path: file.path,
        size: file.size,
        type: file.mime_type || 'video/mp4',
        lastModified: new Date(file.modified).getTime(),
        isExternalFile: true, // Marcar como un archivo externo
        external: true
      };
      
      setFiles(prev => [...prev, newFile]);
      setShowFileExplorer(false); // Opcional: cerrar el explorador después de seleccionar
    }
  }

  // Toggle para mostrar/ocultar el explorador de archivos
  const toggleFileExplorer = () => {
    setShowFileExplorer(!showFileExplorer);
  }

  // Cambiar entre discos interno/externo
  const switchDisk = () => {
    setSelectedDisk(prev => prev === 'internal' ? 'external' : 'internal');
  }

  return (
    <div className="bg-gray-100 p-2 sm:p-4 w-full min-h-screen overflow-hidden has-floating-button">
      <h1 className="text-xl sm:text-2xl font-bold text-dashcam-800 flex items-center mb-4 sm:mb-6">
        <FaFileUpload className="mr-2" />
        Carga Masiva de Videos
      </h1>
      
      {/* En móvil, mostrar/ocultar opciones con un botón */}
      {isMobile && (
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className="w-full bg-white border border-gray-300 rounded-lg p-3 mb-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
        >
          <span className="font-medium text-gray-700">Opciones de Carga</span>
          {showOptions ? <FaAngleUp /> : <FaAngleDown />}
        </button>
      )}
      
      <div className={`flex flex-col lg:flex-row gap-6 ${isMobile && !showOptions ? 'mb-0' : 'mb-4'}`}>
        {/* Sidebar con opciones de carga - en móvil solo se muestra cuando showOptions es true */}
        <div className={`${isMobile ? 'w-full' : 'w-80 flex-shrink-0'} transition-all duration-300 ease-in-out ${isMobile ? (showOptions ? 'max-h-[1000px] opacity-100 mb-4' : 'max-h-0 opacity-0 overflow-hidden') : ''}`}>
          <div className="sticky top-4">
            <UploadOptions 
              useFileDate={useFileDate}
              setUseFileDate={setUseFileDate}
              uploadDate={uploadDate}
              setUploadDate={setUploadDate}
              videoSource={videoSource}
              setVideoSource={setVideoSource}
              uploadLocation={uploadLocation}
              setUploadLocation={setUploadLocation}
              isGettingLocation={isGettingLocation}
              getCurrentLocation={getCurrentLocation}
              tags={tags}
              setTags={setTags}
              uploading={uploading}
              files={files}
              uploadFiles={uploadFiles}
              isMobile={isMobile}
            />
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className="flex-1 w-full">
          {/* Botones de acción para seleccionar archivos/carpetas y explorar archivos */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button 
                className={`px-4 py-2 ${showFileExplorer ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-lg flex items-center gap-2`} 
                onClick={toggleFileExplorer}>
                {showFileExplorer ? 'Cerrar Explorador' : 'Explorar Archivos'}
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {showFileExplorer && (
                <button 
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700"
                  onClick={switchDisk}
                >
                  {selectedDisk === 'internal' ? 'Cambiar a Disco Externo' : 'Cambiar a Disco Interno'}
                </button>
              )}
            </div>
          </div>
          
          {showFileExplorer ? (
            <div className="mb-6">
              <FileExplorer 
                onFileSelect={handleFileFromExplorer}
                showVideosOnly={true}
                allowFileOperations={false}
                allowIndexing={true}
                selectedDisk={selectedDisk}
                height="50vh"
              />
            </div>
          ) : (
            <>
              {/* Drag & Drop Area */}
              <DragDropZone 
                dragActive={dragActive}
                handleDrag={handleDrag}
                handleDrop={handleDrop}
                onSelectFilesClick={onSelectFilesClick}
                onSelectFolderClick={onSelectFolderClick}
                fileInputRef={fileInputRef}
                folderInputRef={folderInputRef}
                onFileInputChange={onFileInputChange}
                onFolderInputChange={onFolderInputChange}
                supportedFormats={supportedFormats}
                isMobile={isMobile}
                onOpenFileExplorer={toggleFileExplorer}
              />
              
              {/* File List */}
              <FileList 
                files={files}
                uploadProgress={uploadProgress}
                removeFile={removeFile}
                clearFiles={clearFiles}
                uploadFiles={uploadFiles}
                uploading={uploading}
                isMobile={isMobile}
              />
              
              {/* Upload Results */}
              <UploadResults 
                uploadResults={uploadResults}
                isMobile={isMobile}
              />
            </>
          )}
        </div>
      </div>

      {/* Botón flotante de carga en móvil cuando hay archivos y no hay opciones visibles */}
      {isMobile && !showOptions && files.length > 0 && (
        <div className="fixed bottom-20 right-6 z-10">
          <button 
            onClick={uploadFiles}
            disabled={uploading}
            className="bg-dashcam-600 hover:bg-dashcam-700 text-white rounded-full h-16 w-16 flex items-center justify-center shadow-lg transition-all transform hover:scale-105 disabled:opacity-50"
          >
            {uploading ? (
              <div className="loader-sm"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default BulkUploader