import { useState, useRef, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { FaAngleUp, FaAngleDown } from 'react-icons/fa'

// Componentes
import DragDropZone from '../components/BulkUploader/DragDropZone'
import UploadOptions from '../components/BulkUploader/UploadOptions'
import FileList from '../components/BulkUploader/FileList'
import UploadResults from '../components/BulkUploader/UploadResults'

// Servicios
import { processFiles, uploadVideoFile } from '../components/BulkUploader/uploadService'

function BulkUploader() {
  // Estado de archivos y carga
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [uploadResults, setUploadResults] = useState([])
  const [dragActive, setDragActive] = useState(false)
  
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
    if (files.length === 0) return
    
    console.log(`[BULK_UPLOAD] Iniciando carga de ${files.length} archivos`);
    setUploading(true)
    setUploadResults([])
    const results = []
    
    for (let i = 0; i < files.length; i++) {
      const fileObj = files[i]
      
      // Skip files that have already been processed
      if (fileObj.status === 'success') {
        console.log(`[BULK_UPLOAD] Archivo #${i+1} (${fileObj.name}) ya fue procesado con éxito, omitiendo`);
        continue;
      }
      
      console.log(`[BULK_UPLOAD] Procesando archivo #${i+1}/${files.length}: ${fileObj.name} (${(fileObj.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Update status to uploading
      setFiles(prev => {
        const updated = [...prev]
        updated[i] = { ...updated[i], status: 'uploading' }
        return updated
      })
      
      // Determine which date to use for this file
      const fileUploadDate = useFileDate && fileObj.fileDate ? fileObj.fileDate : uploadDate
      console.log(`[BULK_UPLOAD] Fecha seleccionada: ${fileUploadDate}, Fuente: ${useFileDate && fileObj.fileDate ? 'archivo' : 'manual'}`);
      
      try {
        // Inicializar el progreso a 0 para este archivo
        setUploadProgress(prev => ({
          ...prev,
          [i]: 0
        }))
        
        // Preparar metadatos para la carga
        const metadata = {
          date: fileUploadDate,
          lat: uploadLocation.lat || null,
          lon: uploadLocation.lon || null,
          source: videoSource,
          tags: tags || null
        }
        console.log(`[BULK_UPLOAD] Metadata preparada:`, metadata);
        
        // Realizar la carga con un timeout general
        let uploadTimeout;
        console.log(`[BULK_UPLOAD] Configurando timeout de 2 minutos para el archivo`);
        const timeoutPromise = new Promise((_, reject) => {
          uploadTimeout = setTimeout(() => {
            console.error(`[BULK_UPLOAD] Timeout alcanzado después de 2 minutos para el archivo ${fileObj.name}`);
            reject(new Error("La carga ha excedido el tiempo máximo"));
          }, 120000); // 2 minutos por archivo como máximo
        });
        
        console.log(`[BULK_UPLOAD] Iniciando la carga real del archivo ${fileObj.name}`);
        const uploadPromise = uploadVideoFile(
          fileObj.file, 
          metadata, 
          (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [i]: progress
            }))
          }
        );
        
        // Usar Promise.race para implementar el timeout
        console.log(`[BULK_UPLOAD] Esperando a que termine la carga o el timeout`);
        const response = await Promise.race([uploadPromise, timeoutPromise]);
        clearTimeout(uploadTimeout);
        
        if (response.success) {
          console.log(`[BULK_UPLOAD] Archivo #${i+1} cargado con éxito en ${response.uploadTime}s`);
          
          // Update file status to success
          setFiles(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], status: 'success', response: response.data }
            return updated
          })
          
          // Asegurar que se muestre progreso completo
          setUploadProgress(prev => ({
            ...prev,
            [i]: 100
          }))
          
          results.push({
            file: fileObj.name,
            success: true,
            message: 'Subido exitosamente',
            date: fileUploadDate,
            processingTime: response.uploadTime
          })
        } else {
          console.error(`[BULK_UPLOAD] Error en archivo #${i+1}: ${response.error}`);
          
          // Update file status to error
          setFiles(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], status: 'error', error: response.error }
            return updated
          })
          
          results.push({
            file: fileObj.name,
            success: false,
            message: response.error,
            date: fileUploadDate,
            processingTime: response.uploadTime
          })
        }
      } catch (error) {
        console.error(`[BULK_UPLOAD] Error excepcional en archivo #${i+1} (${fileObj.name}):`, error);
        
        // Update file status to error
        setFiles(prev => {
          const updated = [...prev]
          updated[i] = { 
            ...updated[i], 
            status: 'error', 
            error: error.message || "Error desconocido durante la carga" 
          }
          return updated
        })
        
        results.push({
          file: fileObj.name,
          success: false,
          message: error.message || "Error desconocido durante la carga",
          date: fileUploadDate
        })
      }
    }
    
    console.log(`[BULK_UPLOAD] Proceso de carga finalizado. Resultados:`, results);
    setUploadResults(results)
    setUploading(false)
  }

  // Estado para controlar la visibilidad de opciones en dispositivos móviles
  const [showOptions, setShowOptions] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detector de cambio de tamaño para adaptar la UI
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="p-3 sm:p-4 mx-auto bg-gray-50 min-h-screen overflow-hidden has-floating-button">
      <h1 className="text-xl sm:text-2xl font-medium mb-4 sm:mb-6 text-dashcam-800 px-1">Carga Masiva de Videos</h1>
      
      {/* En móvil, mostrar/ocultar opciones con un botón */}
      {isMobile && (
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className="w-full bg-white border border-gray-300 rounded-lg p-3 mb-4 flex items-center justify-between shadow-sm"
        >
          <span className="font-medium text-dashcam-700">Opciones de Carga</span>
          {showOptions ? <FaAngleUp /> : <FaAngleDown />}
        </button>
      )}
      
      <div className={`flex flex-col md:flex-row gap-4 ${isMobile && !showOptions ? 'mb-0' : 'mb-4'}`}>
        {/* Sidebar con opciones de carga - en móvil solo se muestra cuando showOptions es true */}
        <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 transition-all duration-300 ease-in-out ${isMobile ? (showOptions ? 'max-h-[1000px] opacity-100 mb-4' : 'max-h-0 opacity-0 overflow-hidden') : ''}`}>
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
        <div className="flex-1 px-1">
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
        </div>
      </div>

      {/* Botón flotante de carga en móvil cuando hay archivos y no hay opciones visibles */}
      {isMobile && !showOptions && files.length > 0 && (
        <div className="fixed bottom-20 right-6 z-10">
          <button 
            onClick={uploadFiles}
            disabled={uploading}
            className="bg-dashcam-600 hover:bg-dashcam-700 text-white rounded-full h-16 w-16 flex items-center justify-center shadow-lg transition-all transform hover:scale-105"
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