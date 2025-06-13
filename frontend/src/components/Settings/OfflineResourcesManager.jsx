import React, { useState, useEffect } from 'react';
import { FaDatabase, FaTrash, FaSpinner, FaSync, FaCheck, FaInfoCircle } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

/**
 * Componente simplificado para gestionar los datos de geocoding offline (SQLite)
 */
const OfflineResourcesManager = () => {
  const [offlineStats, setOfflineStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOfflineStats();
  }, []);

  /**
   * Carga las estadísticas del sistema de geocoding offline
   */
  const loadOfflineStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/geocoding/offline/stats');
      const data = await response.json();
      setOfflineStats(data);
    } catch (error) {
      console.error('Error loading offline stats:', error);
      toast.error('Error al cargar estadísticas offline');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Actualiza las estadísticas
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOfflineStats();
    setRefreshing(false);
    toast.success('Estadísticas actualizadas');
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-dashcam-700 text-white p-2 sm:p-4 flex justify-between items-center">
        <h2 className="font-bold text-sm sm:text-base flex items-center">
          <FaDatabase className="mr-2" /> Geocoding Offline (SQLite)
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
            <span className="ml-2 text-gray-500">Cargando estadísticas...</span>
          </div>
        ) : (
          <>
            {/* Información del sistema simplificado */}
            <div className="mb-4 bg-blue-50 p-3 rounded-md border border-blue-200">
              <div className="flex items-start">
                <FaInfoCircle className="text-blue-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-blue-800 mb-1">Sistema Simplificado</h3>
                  <p className="text-xs text-blue-700">
                    Usando geocoding offline con base de datos SQLite + Nominatim online como respaldo.
                  </p>
                </div>
              </div>
            </div>

            {/* Estadísticas de la base de datos offline */}
            <div className="mb-4">
              <h3 className="font-medium text-sm mb-2 flex items-center">
                <span className="flex h-5 w-5 mr-1.5 items-center justify-center rounded-full bg-green-100 text-green-500">
                  <FaCheck size={10} />
                </span>
                Base de Datos Offline
              </h3>
              
              {offlineStats && offlineStats.offline_database ? (
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ubicaciones almacenadas:</span>
                      <span className="font-medium">{offlineStats.offline_database.total_locations || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estado:</span>
                      <span className="font-medium text-green-600">
                        {offlineStats.offline_database.database_available ? 'Disponible' : 'No disponible'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No se pudieron cargar las estadísticas</p>
              )}
            </div>

            {/* Información del funcionamiento */}
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
              <h4 className="font-medium text-gray-700 mb-2">Funcionamiento:</h4>
              <ul className="space-y-1">
                <li>• Búsqueda primero en cache local</li>
                <li>• Luego en base de datos SQLite offline</li>
                <li>• Finalmente consulta Nominatim online si hay internet</li>
                <li>• Todas las consultas se guardan automáticamente en SQLite</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default OfflineResourcesManager;
