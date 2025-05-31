import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  FaFolder, FaFileVideo, FaFile, FaArrowUp, 
  FaTrash, FaCopy, FaPaste, FaExternalLinkAlt,
  FaSpinner, FaExclamationTriangle
} from 'react-icons/fa';
import './FileExplorer.css';
import FileItem from './FileItem';
import PathBreadcrumb from './PathBreadcrumb';
import DiskInfoStatus from './DiskInfoStatus';
import FileActions from './FileActions';

const FileExplorer = ({ 
  onFileSelect, 
  showVideosOnly = false,
  allowFileOperations = true,
  allowIndexing = false,
  selectedDisk = 'internal',
  height = '70vh'
}) => {
  // Estado para los elementos listados
  const [items, setItems] = useState([]);
  // Estado para la ruta actual
  const [currentPath, setCurrentPath] = useState('');
  // Estado de carga
  const [loading, setLoading] = useState(false);
  // Estado de error
  const [error, setError] = useState(null);
  // Estado para los discos disponibles (con valores predeterminados)
  const [disks, setDisks] = useState({ 
    internal: { mountPoint: '/mnt/dashcam_storage', mounted: false }, 
    external: [] 
  });
  // Estado para el elemento seleccionado
  const [selectedItem, setSelectedItem] = useState(null);
  // Estado para el elemento que se va a mover/copiar
  const [clipboard, setClipboard] = useState(null);
  // Estado para la acción (copiar/mover)
  const [action, setAction] = useState(null);

  // Función para cargar la información de discos
  const loadDiskInfo = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/file-explorer/disk-status');
      
      // Asegurar que la respuesta tenga la estructura correcta
      const diskData = response.data || {};
      const safeData = {
        internal: diskData.internal || { mountPoint: '/mnt/dashcam_storage', mounted: false },
        external: Array.isArray(diskData.external) ? diskData.external : []
      };
      
      setDisks(safeData);
      
      // Asegurar que response.data tenga la estructura esperada
      const responseData = response.data || { internal: { mountPoint: '/mnt/dashcam_storage', mounted: false }, external: [] };
      
      // Establece la ruta inicial según el disco seleccionado
      if (selectedDisk === 'internal') {
        // Verificar que internal exista y tenga mountPoint
        const internalDisk = responseData.internal || {};
        const internalPath = internalDisk.mountPoint || '/mnt/dashcam_storage';
        setCurrentPath(internalPath);
      } else if (responseData.external && Array.isArray(responseData.external) && responseData.external.length > 0) {
        // Verificar que external exista, tenga elementos y el primer elemento tenga mountPoint
        const externalDisk = responseData.external[0] || {};
        const externalPath = externalDisk.mountPoint || '/mnt/external';
        setCurrentPath(externalPath);
      } else {
        // Ruta de respaldo si no hay información válida
        setCurrentPath('/mnt/dashcam_storage');
      }
    } catch (err) {
      console.error('Error al cargar información de discos:', err);
      setError('No se pudo cargar la información de los discos');
    } finally {
      setLoading(false);
    }
  }, [selectedDisk]);

  // Función para listar el contenido de un directorio
  const listDirectory = useCallback(async (path) => {
    // Si no hay ruta definida, usar la ruta predeterminada según el disco seleccionado
    if (!path) {
      console.warn('Se intentó listar un directorio sin especificar ruta');
      const defaultPath = selectedDisk === 'internal' 
        ? disks.internal?.mountPoint || '/mnt/dashcam_storage'
        : (disks.external && disks.external.length > 0) 
          ? disks.external[0]?.mountPoint || '/mnt/external'
          : '/mnt/dashcam_storage';
      
      path = defaultPath;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/file-explorer/list', {
        params: {
          path,
          filter_video: showVideosOnly
        }
      });
      
      // Verificar que los datos están en el formato esperado y adaptarlos si es necesario
      if (response.data) {
        // Manejar formato con entries y current_directory
        if (Array.isArray(response.data.entries)) {
          setItems(response.data.entries || []);
          setCurrentPath(response.data.current_directory?.path || path);
        } 
        // Manejar formato anterior con items y current_path
        else if (Array.isArray(response.data.items)) {
          setItems(response.data.items || []);
          setCurrentPath(response.data.current_path || path);
        } 
        else {
          console.error('Formato de respuesta inesperado:', response.data);
          setError('El servidor devolvió datos en un formato inesperado');
          setItems([]);
        }
      } else {
        console.error('Respuesta del servidor vacía');
        setError('La respuesta del servidor está vacía');
        setItems([]);
      }
    } catch (err) {
      console.error('Error al listar directorio:', err);
      setError('No se pudo listar el contenido del directorio');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [showVideosOnly, disks, selectedDisk]);

  // Función para navegar a una carpeta
  const navigateTo = useCallback((path) => {
    listDirectory(path);
  }, [listDirectory]);

  // Función para navegar hacia arriba
  const navigateUp = useCallback(() => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    if (parentPath) {
      navigateTo(parentPath);
    } else {
      navigateTo('/');
    }
  }, [currentPath, navigateTo]);

  // Función para eliminar un archivo o directorio
  const deleteItem = useCallback(async (item) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar ${item.name}?`)) return;

    try {
      setLoading(true);
      await axios.post('/api/file-explorer/delete', {
        path: item.path,
        is_directory: item.is_directory
      });
      
      // Actualizar la lista después de eliminar
      listDirectory(currentPath);
    } catch (err) {
      console.error('Error al eliminar:', err);
      setError(`No se pudo eliminar ${item.name}`);
    } finally {
      setLoading(false);
    }
  }, [currentPath, listDirectory]);

  // Función para mover o copiar un archivo
  const moveOrCopyFile = useCallback(async () => {
    if (!clipboard || !action) return;

    try {
      setLoading(true);
      await axios.post('/api/file-explorer/move', {
        source_path: clipboard.path,
        target_path: `${currentPath}/${clipboard.name}`
      });
      
      // Limpiar el portapapeles y la acción después de completar
      setClipboard(null);
      setAction(null);
      
      // Actualizar la lista después de mover/copiar
      listDirectory(currentPath);
    } catch (err) {
      console.error(`Error al ${action === 'move' ? 'mover' : 'copiar'}:`, err);
      setError(`No se pudo ${action === 'move' ? 'mover' : 'copiar'} el archivo`);
    } finally {
      setLoading(false);
    }
  }, [clipboard, action, currentPath, listDirectory]);

  // Función para indexar un video externo
  const indexExternalVideo = useCallback(async (item) => {
    if (!item || !item.is_video) return;

    try {
      setLoading(true);
      await axios.post('/api/file-explorer/index-video', {
        file_path: item.path,
        source: 'external'
      });
      
      alert(`Video ${item.name} indexado correctamente`);
      
    } catch (err) {
      console.error('Error al indexar video:', err);
      setError(`No se pudo indexar el video ${item.name}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar información de discos al montar el componente
  useEffect(() => {
    loadDiskInfo();
  }, [loadDiskInfo]);

  // Listar directorio cuando cambia la ruta actual o el disco seleccionado
  useEffect(() => {
    if (currentPath) {
      listDirectory(currentPath);
    }
  }, [currentPath, listDirectory]);

  // Manejar la selección de un archivo
  const handleItemSelect = (item) => {
    if (!item) return;
    
    if (item.is_directory) {
      navigateTo(item.path);
    } else if (onFileSelect && item.is_video) {
      onFileSelect(item);
    }
    setSelectedItem(item);
  };

  // CSS personalizado para asegurar la compatibilidad con temas
  const cssVars = {
    "--color-text-primary": "var(--text-color, #1f2937)",
    "--color-text-secondary": "var(--text-muted, #6b7280)",
    "--color-border": "var(--border-color, #e5e7eb)",
    "--color-error": "var(--danger-color, #ef4444)",
    "--color-background": "var(--bg-color, #f9fafb)",
    "--color-primary": "var(--primary-color, #3b82f6)",
    "--color-folder": "var(--warning-color, #f59e0b)",
    "--color-video": "var(--success-color, #10b981)"
  };

  return (
    <div className="file-explorer" style={{ height, ...cssVars }}>
      <DiskInfoStatus 
        disks={disks} 
        selectedDisk={selectedDisk} 
        onRefresh={loadDiskInfo}
      />
      
      <div className="file-explorer-header">
        <PathBreadcrumb 
          path={currentPath} 
          onNavigate={navigateTo} 
        />
        <button 
          className="btn-navigate-up" 
          onClick={navigateUp}
          disabled={currentPath === '/' || loading}
        >
          <FaArrowUp /> Subir
        </button>
      </div>
      
      {allowFileOperations && (
        <FileActions 
          selectedItem={selectedItem}
          clipboard={clipboard}
          action={action}
          onDelete={() => selectedItem && deleteItem(selectedItem)}
          onCopy={() => {
            setClipboard(selectedItem);
            setAction('copy');
          }}
          onMove={() => {
            setClipboard(selectedItem);
            setAction('move');
          }}
          onPaste={moveOrCopyFile}
          onIndex={allowIndexing ? () => selectedItem && indexExternalVideo(selectedItem) : undefined}
        />
      )}
      
      {loading ? (
        <div className="file-explorer-loading">
          <FaSpinner className="spinner" /> Cargando...
        </div>
      ) : error ? (
        <div className="file-explorer-error">
          <FaExclamationTriangle /> {error}
        </div>
      ) : (
        <div className="file-explorer-items">
          {items && items.length > 0 ? (
            items.map((item, index) => (
              <FileItem
                key={item?.path || `item-${index}`}
                item={item}
                selected={selectedItem && item && selectedItem.path === item.path}
                onClick={() => handleItemSelect(item)}
              />
            ))
          ) : (
            <div className="file-explorer-empty">
              No hay archivos {showVideosOnly ? 'de video' : ''} en este directorio
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
