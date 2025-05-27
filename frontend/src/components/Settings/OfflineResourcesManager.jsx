import React, { useState, useEffect } from 'react';
import { FaDatabase, FaTrash, FaSpinner, FaSync, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import offlineMapManager from '../../services/offlineMapService';
import landmarkImageManager from '../../services/landmarkImageService';
import { toast } from 'react-hot-toast';

/**
 * Componente para gestionar los recursos offline (mapas e imágenes)
 */
const OfflineResourcesManager = () => {
  const [offlineMaps, setOfflineMaps] = useState([]);
  const [storedImages, setStoredImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Cargar los recursos offline al montar el componente
  useEffect(() => {
    loadOfflineResources();
  }, []);

  /**
   * Carga los recursos offline disponibles
   */
  const loadOfflineResources = async () => {
    setLoading(true);
    try {
      // Inicializar los servicios
      await offlineMapManager.init();
      await landmarkImageManager.init();
      
      // Cargar mapas offline
      const maps = await offlineMapManager.getOfflineMaps();
      setOfflineMaps(maps || []);
      
      // Cargar imágenes almacenadas
      const images = await landmarkImageManager.getStoredImages();
      setStoredImages(images || []);
      
    } catch (error) {
      console.error('Error loading offline resources:', error);
      toast.error('Error al cargar recursos offline');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Actualiza la lista de recursos
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOfflineResources();
    setRefreshing(false);
    toast.success('Recursos actualizados correctamente');
  };

  /**
   * Elimina un mapa offline
   */
  const handleDeleteMap = async (tripId) => {
    try {
      await offlineMapManager.deleteOfflineMapForTrip(tripId);
      toast.success('Mapa offline eliminado correctamente');
      await loadOfflineResources(); // Recargar la lista
    } catch (error) {
      console.error('Error deleting offline map:', error);
      toast.error(`Error al eliminar mapa: ${error.message}`);
    }
  };

  /**
   * Elimina las imágenes de un viaje
   */
  const handleDeleteImages = async (tripId) => {
    try {
      await landmarkImageManager.deleteImagesForTrip(tripId);
      toast.success('Imágenes eliminadas correctamente');
      await loadOfflineResources(); // Recargar la lista
    } catch (error) {
      console.error('Error deleting landmark images:', error);
      toast.error(`Error al eliminar imágenes: ${error.message}`);
    }
  };

  /**
   * Calcula el espacio usado por los recursos
   */
  const calculateTotalStorageUsed = () => {
    let totalSize = 0;
    
    offlineMaps.forEach(map => {
      totalSize += map.sizeBytes || 0;
    });
    
    storedImages.forEach(imageGroup => {
      totalSize += imageGroup.sizeBytes || 0;
    });
    
    // Formatear el tamaño
    if (totalSize < 1024) {
      return `${totalSize} B`;
    } else if (totalSize < 1024 * 1024) {
      return `${(totalSize / 1024).toFixed(1)} KB`;
    } else {
      return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  // Agrupar imágenes por viaje para mostrarlas junto con los mapas
  const groupImagesByTrip = () => {
    const tripImageMap = {};
    
    storedImages.forEach(image => {
      if (!tripImageMap[image.tripId]) {
        tripImageMap[image.tripId] = {
          tripId: image.tripId,
          tripName: image.tripName || `Viaje ${image.tripId.substring(0, 6)}`,
          count: 0,
          sizeBytes: 0
        };
      }
      
      tripImageMap[image.tripId].count += 1;
      tripImageMap[image.tripId].sizeBytes += image.sizeBytes || 0;
    });
    
    return Object.values(tripImageMap);
  };
  
  const imagesByTrip = groupImagesByTrip();

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-dashcam-700 text-white p-2 sm:p-4 flex justify-between items-center">
        <h2 className="font-bold text-sm sm:text-base flex items-center">
          <FaDatabase className="mr-2" /> Recursos Offline
        </h2>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="text-white hover:bg-dashcam-600 p-1.5 rounded-full"
        >
          {refreshing ? <FaSpinner className="animate-spin" /> : <FaSync />}
        </button>
      </div>
      
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <FaSpinner className="animate-spin text-dashcam-500 text-xl" />
            <span className="ml-2 text-gray-500">Cargando recursos...</span>
          </div>
        ) : (
          <>
            {/* Información de almacenamiento */}
            <div className="mb-4 bg-gray-50 p-3 rounded-md">
              <h3 className="text-sm font-medium mb-1">Almacenamiento Utilizado</h3>
              <p className="text-sm text-gray-600">
                {calculateTotalStorageUsed()} en {offlineMaps.length} mapa(s) y {storedImages.length} imágenes
              </p>
            </div>
          
            {/* Mapas offline */}
            <div className="mb-4">
              <h3 className="font-medium text-sm mb-2 flex items-center">
                <span className="flex h-5 w-5 mr-1.5 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                  <FaCheck size={10} />
                </span>
                Mapas Offline
              </h3>
              
              {offlineMaps.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No hay mapas offline guardados</p>
              ) : (
                <div className="space-y-2">
                  {offlineMaps.map(map => (
                    <div key={map.tripId} className="bg-gray-50 p-2 rounded-md text-sm flex justify-between items-center">
                      <div>
                        <p className="font-medium">{map.tripName || `Viaje ${map.tripId.substring(0, 6)}`}</p>
                        <p className="text-xs text-gray-500">
                          {map.tileCount} tiles • {(map.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteMap(map.tripId)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-full"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Imágenes de landmarks */}
            <div>
              <h3 className="font-medium text-sm mb-2 flex items-center">
                <span className="flex h-5 w-5 mr-1.5 items-center justify-center rounded-full bg-green-100 text-green-500">
                  <FaCheck size={10} />
                </span>
                Imágenes de Landmarks
              </h3>
              
              {imagesByTrip.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No hay imágenes de landmarks guardadas</p>
              ) : (
                <div className="space-y-2">
                  {imagesByTrip.map(imageGroup => (
                    <div key={imageGroup.tripId} className="bg-gray-50 p-2 rounded-md text-sm flex justify-between items-center">
                      <div>
                        <p className="font-medium">{imageGroup.tripName}</p>
                        <p className="text-xs text-gray-500">
                          {imageGroup.count} imágenes • {(imageGroup.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteImages(imageGroup.tripId)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-full"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineResourcesManager;
