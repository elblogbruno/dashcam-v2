import React, { useState, useEffect, useRef } from 'react'
import { FaFileVideo, FaCheckCircle, FaTimesCircle, FaPlay, FaEllipsisV } from 'react-icons/fa'
import PropTypes from 'prop-types'

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
  // Estado local para almacenar las miniaturas generadas
  const [thumbnails, setThumbnails] = useState({});
  // Referencias a las URLs creadas para poder liberarlas después
  const objectUrlsRef = useRef({});
  // Estado para controlar menú en móvil para cada archivo
  const [activeMenu, setActiveMenu] = useState(null);
  
  // Efecto para generar miniaturas cuando cambian los archivos
  useEffect(() => {
    // Para cada archivo que no tiene miniatura, intentar generarla
    files.forEach((file, index) => {
      if (!thumbnails[index] && file.file instanceof File) {
        generateThumbnailForFile(file, index);
      }
    });
    
    // Limpiar las URLs de objetos al desmontar el componente
    return () => {
      Object.values(objectUrlsRef.current).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      objectUrlsRef.current = {};
    };
  }, [files]);
  
  // Función para generar miniatura de un archivo de video
  const generateThumbnailForFile = (file, index) => {
    try {
      // Verificar si ya hay una miniatura para este índice
      if (thumbnails[index]) return;

      // Solo procesar archivos de video conocidos
      if (!file.file.type.startsWith('video/') && 
          !['mp4', 'mov', 'avi', 'webm', 'insv', 'mts', 'm2ts', 'mkv'].some(ext => 
              file.name.toLowerCase().endsWith(`.${ext}`))) {
        console.warn("Archivo no reconocido como video:", file.name);
        setThumbnails(prev => ({
          ...prev,
          [index]: null
        }));
        return;
      }
      
      // Crear un elemento de video fuera del DOM para generar la vista previa
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      // Crear una URL de objeto para el archivo y guardarla en la referencia
      const objectUrl = URL.createObjectURL(file.file);
      objectUrlsRef.current[index] = objectUrl;
      video.src = objectUrl;

      // Configurar un timeout para evitar que se quede esperando indefinidamente
      const timeoutId = setTimeout(() => {
        console.warn("Timeout generando miniatura para:", file.name);
        // Usar un placeholder como fallback
        setThumbnails(prev => ({
          ...prev,
          [index]: null
        }));
        
        // Limpiar recursos
        if (objectUrlsRef.current[index]) {
          URL.revokeObjectURL(objectUrlsRef.current[index]);
          delete objectUrlsRef.current[index];
        }
      }, 3000); // Reducir el timeout a 3 segundos
      
      // Manejo de errores general para cualquier problema con el video
      const handleVideoError = (error) => {
        clearTimeout(timeoutId);
        console.error("Error con el video:", error);
        setThumbnails(prev => ({
          ...prev,
          [index]: null
        }));
        
        if (objectUrlsRef.current[index]) {
          URL.revokeObjectURL(objectUrlsRef.current[index]);
          delete objectUrlsRef.current[index];
        }
      };
      
      // Cuando se cargan los metadatos, capturar un fotograma
      video.onloadedmetadata = () => {
        try {
          // Ir a 1 segundo o la mitad del video, lo que sea menor
          const seekTime = Math.min(1, video.duration / 2);
          video.currentTime = seekTime;
        } catch (error) {
          handleVideoError(error);
        }
      };
      
      // Manejar evento de seeked (cuando el video llega al tiempo solicitado)
      video.onseeked = () => {
        clearTimeout(timeoutId);
        
        try {
          // Crear un canvas para capturar el fotograma
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
          
          const ctx = canvas.getContext('2d');
          // Verificar que el video tenga dimensiones válidas
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            try {
              // Convertir el canvas a URL de datos
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
              
              // Actualizar el estado de miniaturas
              setThumbnails(prev => ({
                ...prev,
                [index]: thumbnailUrl
              }));
            } catch (e) {
              console.warn("Error generando URL de datos:", e);
              setThumbnails(prev => ({
                ...prev,
                [index]: null
              }));
            }
          } else {
            console.warn("Dimensiones de video no válidas:", file.name);
            setThumbnails(prev => ({
              ...prev,
              [index]: null
            }));
          }
        } catch (error) {
          handleVideoError(error);
        } finally {
          // Limpiar recursos - siempre
          if (objectUrlsRef.current[index]) {
            URL.revokeObjectURL(objectUrlsRef.current[index]);
            delete objectUrlsRef.current[index];
          }
        }
      };
      
      // Si hay error al cargar el video
      video.onerror = handleVideoError;
    } catch (error) {
      console.error("Error general generando miniatura:", error);
      setThumbnails(prev => ({
        ...prev,
        [index]: null
      }));
    }
  };

  // Función para manejar toques prolongados en dispositivos móviles
  const handleLongPress = (index) => {
    if (isMobile) {
      setActiveMenu(activeMenu === index ? null : index);
    }
  };

  // Vista para móvil si no hay archivos
  if (files.length === 0) return null;

  return (
    <div className={`card ${isMobile ? 'p-3 sm:p-4' : 'p-4'} mb-5 bg-white shadow-sm rounded-lg`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-medium`}>
          {files.length} Archivo{files.length !== 1 ? 's' : ''} 
        </h2>
        <div className="flex items-center">
          {!isMobile && (
            <button 
              onClick={clearFiles}
              className="btn btn-secondary text-sm transition-all hover:shadow-md"
              disabled={uploading}
            >
              Limpiar Todo
            </button>
          )}
          {isMobile && (
            <button 
              onClick={clearFiles}
              className="text-sm text-red-600 px-3 py-1.5 rounded-md border border-red-100 bg-red-50"
              disabled={uploading}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
      
      <div className={`space-y-3 ${isMobile ? 'max-h-64' : 'max-h-96'} overflow-y-auto pr-1 pl-0.5`}>
        {files.map((file, index) => {
          const isSuccess = file.status === 'success';
          const isError = file.status === 'error';
          const isUploading = file.status === 'uploading';
          
          return (
            <div 
              key={index} 
              className={`border rounded-md ${isMobile ? 'p-3' : 'p-3'} transition-all ${
                isSuccess ? 'bg-green-50 border-green-200' : 
                isError ? 'bg-red-50 border-red-200' : 
                isUploading ? 'bg-blue-50 border-blue-200' : 
                'bg-white border-gray-200 hover:border-gray-300'
              }`}
              onContextMenu={(e) => {e.preventDefault(); handleLongPress(index);}}
              onTouchStart={() => {
                if (!isMobile) return;
                const timer = setTimeout(() => handleLongPress(index), 500);
                return () => clearTimeout(timer);
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-grow flex items-start">
                  {thumbnails[index] ? (
                    <img 
                      src={thumbnails[index]} 
                      alt="Vista previa del video" 
                      className={`${isMobile ? 'w-14 h-8' : 'w-16 h-10'} object-cover rounded mr-2 sm:mr-3 border border-gray-200`}
                    />
                  ) : (
                    <div className={`${isMobile ? 'w-14 h-8' : 'w-16 h-10'} bg-gray-100 rounded mr-2 sm:mr-3 flex items-center justify-center text-center`}>
                      <FaFileVideo className="text-gray-400 text-xl" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate max-w-full text-sm">{file.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                      {!isMobile && file.fileDate && (
                        <span className="ml-2">
                          • Fecha: {file.fileDate}
                        </span>
                      )}
                      {!isMobile && file.duration && (
                        <span className="ml-2">
                          • {Math.floor(file.duration / 60)}:{(file.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    
                    {file.status === 'error' && (
                      <div className="text-xs text-red-600 mt-1 truncate">
                        {file.error && file.error.includes("DEMUXER_ERROR_COULD_NOT_OPEN") 
                          ? "Formato no soportado" 
                          : file.error || 'Error al subir'
                        }
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center">
                  {file.status === 'success' && (
                    <FaCheckCircle className="text-green-500 mr-2" />
                  )}
                  {file.status === 'error' && (
                    <FaTimesCircle className="text-red-500 mr-2" />
                  )}
                  {!uploading && file.status !== 'uploading' && (
                    <>
                      {isMobile ? (
                        <button
                          onClick={() => handleLongPress(index)}
                          className="p-1.5"
                        >
                          <FaEllipsisV className="text-gray-400" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          aria-label="Eliminar archivo"
                        >
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Menú móvil desplegable con más padding */}
              {isMobile && activeMenu === index && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => removeFile(index)}
                    className="text-xs text-red-600 px-3 py-2 rounded-md border border-red-100 bg-red-50 flex items-center justify-center"
                  >
                    <FaTimesCircle className="mr-2" /> Eliminar
                  </button>
                  <button 
                    className="text-xs text-gray-600 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center disabled:opacity-50"
                    disabled={!thumbnails[index]}
                  >
                    <FaPlay className="mr-2" /> Previsualizar
                  </button>
                </div>
              )}
              
              {/* Progress bar con más margen vertical */}
              {(file.status === 'uploading' || uploadProgress[index]) && (
                <div className={`w-full bg-gray-200 rounded-full ${isMobile ? 'h-2 mt-3' : 'h-2.5 my-2'} overflow-hidden`}>
                  <div 
                    className="bg-dashcam-600 h-full rounded-full transition-all duration-300 ease-in-out" 
                    style={{ width: `${uploadProgress[index] || 0}%` }}
                  ></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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

export default FileList;
