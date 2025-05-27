import React, { useState, useEffect } from 'react';
import { FaGlobe, FaMapMarked } from 'react-icons/fa';
import { MdMap, MdCheckCircle, MdError, MdHelp } from 'react-icons/md';
import organicMapManager from '../../services/organicMapService';
import { showError } from '../../services/notificationService';

/**
 * Panel de diagnóstico de mapas para verificar el estado de los mapas descargados
 * y ayudar a solucionar problemas relacionados con la visualización de mapas.
 */
const MapDiagnosticPanel = () => {
  const [loading, setLoading] = useState(true);
  const [diagnosticInfo, setDiagnosticInfo] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [regionDetails, setRegionDetails] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    serverStatus: false,
    localMaps: false,
    regionDetails: false
  });

  // Cargar información de diagnóstico
  useEffect(() => {
    const loadDiagnosticInfo = async () => {
      setLoading(true);
      try {
        const info = await organicMapManager.getDiagnosticInfo();
        setDiagnosticInfo(info);
        
        // Si hay un error, mostrarlo
        if (info.error) {
          showError(`Error al cargar información de diagnóstico: ${info.error}`, {
            title: 'Error de diagnóstico',
            timeout: 5000
          });
        }
      } catch (error) {
        console.error('Error al cargar información de diagnóstico:', error);
        setDiagnosticInfo({ error: error.message });
        showError(`Error al cargar diagnóstico: ${error.message}`, {
          title: 'Error de diagnóstico',
          timeout: 5000
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadDiagnosticInfo();
  }, [refreshTrigger]);

  // Cargar detalles de la región seleccionada
  useEffect(() => {
    const loadRegionDetails = async () => {
      if (!selectedRegion) {
        setRegionDetails(null);
        return;
      }
      
      try {
        const details = await organicMapManager.verifyMwmFile(selectedRegion);
        setRegionDetails(details);
      } catch (error) {
        console.error('Error al verificar región:', error);
        setRegionDetails({ error: error.message, regionId: selectedRegion });
      }
    };
    
    loadRegionDetails();
  }, [selectedRegion]);

  // Alternar secciones expandidas
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Refrescar la información de diagnóstico
  const refreshInfo = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Diagnóstico de Mapas</h2>
        <button 
          onClick={refreshInfo}
          className="bg-dashcam-500 hover:bg-dashcam-600 text-white px-3 py-1 rounded text-sm"
          disabled={loading}
        >
          {loading ? 'Cargando...' : 'Refrescar'}
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashcam-600"></div>
          <span className="ml-2">Cargando información de diagnóstico...</span>
        </div>
      ) : diagnosticInfo?.error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center">
            <MdError className="text-red-500 mr-2" size={24} />
            <div>
              <p className="text-red-700 font-medium">Error al cargar diagnóstico</p>
              <p className="text-red-600">{diagnosticInfo.error}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Estado general */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className={`rounded-md p-3 ${diagnosticInfo?.serverStatus?.working_mirror ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="flex items-center">
                <FaGlobe className={`mr-2 ${diagnosticInfo?.serverStatus?.working_mirror ? 'text-green-600' : 'text-yellow-600'}`} size={18} />
                <div>
                  <p className="font-medium text-sm">Servidor de mapas</p>
                  <p className="text-sm">{diagnosticInfo?.serverStatus?.working_mirror || 'No disponible'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
              <div className="flex items-center">
                <MdMap className="text-indigo-600 mr-2" size={18} />
                <div>
                  <p className="font-medium text-sm">Mapas MWM instalados</p>
                  <p className="text-sm">{diagnosticInfo?.serverStatus?.installed_maps?.length || 0} mapas</p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center">
                <FaMapMarked className="text-blue-600 mr-2" size={18} />
                <div>
                  <p className="font-medium text-sm">Espacio utilizado</p>
                  <p className="text-sm">
                    {diagnosticInfo?.serverStatus?.total_size_mb 
                      ? `${Math.round(diagnosticInfo.serverStatus.total_size_mb * 10) / 10} MB` 
                      : '0 MB'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Estado del servidor */}
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div 
              className="flex justify-between items-center bg-gray-50 p-3 cursor-pointer"
              onClick={() => toggleSection('serverStatus')}
            >
              <h3 className="font-medium">Estado del servidor</h3>
              <span className="text-dashcam-600">
                {expandedSections.serverStatus ? '▲' : '▼'}
              </span>
            </div>
            
            {expandedSections.serverStatus && (
              <div className="p-3">
                {diagnosticInfo?.serverStatus?.installed_maps?.length > 0 ? (
                  <div className="overflow-auto max-h-64">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Región</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tamaño</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {diagnosticInfo.serverStatus.installed_maps.map(map => (
                          <tr key={map.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{map.name || map.id}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{Math.round(map.size_mb * 10) / 10} MB</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {map.downloaded_at ? new Date(map.downloaded_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-dashcam-600">
                              <button 
                                onClick={() => setSelectedRegion(map.id)}
                                className="hover:text-dashcam-700 hover:underline"
                              >
                                Verificar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No hay mapas instalados.</p>
                )}
              </div>
            )}
          </div>
          
          {/* Mapas locales en IndexedDB */}
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div 
              className="flex justify-between items-center bg-gray-50 p-3 cursor-pointer"
              onClick={() => toggleSection('localMaps')}
            >
              <h3 className="font-medium">Mapas en navegador (IndexedDB)</h3>
              <span className="text-dashcam-600">
                {expandedSections.localMaps ? '▲' : '▼'}
              </span>
            </div>
            
            {expandedSections.localMaps && (
              <div className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm font-medium">Base de datos inicializada:</p>
                    <p className="text-sm">
                      {diagnosticInfo.isInitialized ? (
                        <span className="flex items-center text-green-600">
                          <MdCheckCircle className="mr-1" /> Sí
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <MdError className="mr-1" /> No
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm font-medium">Bases de datos disponibles:</p>
                    <p className="text-sm">
                      {diagnosticInfo.dbAvailable ? (
                        <span className="flex items-center text-green-600">
                          <MdCheckCircle className="mr-1" /> Sí
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <MdError className="mr-1" /> No
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Regiones registradas: {diagnosticInfo?.localMaps?.regionsCount || 0}</h4>
                  {diagnosticInfo?.localMaps?.regions?.length > 0 && (
                    <div className="overflow-auto max-h-40">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {diagnosticInfo.localMaps.regions.map(region => (
                            <tr key={region.regionId} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{region.regionId}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{region.name || region.regionId}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-dashcam-600">
                                <button 
                                  onClick={() => setSelectedRegion(region.regionId)}
                                  className="hover:text-dashcam-700 hover:underline text-xs"
                                >
                                  Verificar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Viajes con mapas: {diagnosticInfo?.localMaps?.tripsCount || 0}</h4>
                  {diagnosticInfo?.localMaps?.trips?.length > 0 && (
                    <div className="overflow-auto max-h-40">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID de viaje</th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regiones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {diagnosticInfo.localMaps.trips.map(trip => (
                            <tr key={trip.tripId} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{trip.tripId}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                {trip.regionIds?.length || 0} regiones
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Detalles de la región seleccionada */}
          {selectedRegion && (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div 
                className="flex justify-between items-center bg-gray-50 p-3 cursor-pointer"
                onClick={() => toggleSection('regionDetails')}
              >
                <h3 className="font-medium">Detalles de región: {selectedRegion}</h3>
                <div className="flex items-center">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRegion(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 mr-2 bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded-md"
                  >
                    Cerrar
                  </button>
                  <span className="text-dashcam-600">
                    {expandedSections.regionDetails ? '▲' : '▼'}
                  </span>
                </div>
              </div>
              
              {expandedSections.regionDetails && regionDetails && (
                <div className="p-3">
                  {regionDetails.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                      <div className="flex items-center">
                        <MdError className="text-red-500 mr-2" size={20} />
                        <p className="text-sm text-red-700">{regionDetails.error}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Información del servidor */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Información en el servidor:</h4>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">Archivo existe:</p>
                              <p className="text-sm">
                                {regionDetails.serverStatus?.file_exists ? (
                                  <span className="flex items-center text-green-600">
                                    <MdCheckCircle className="mr-1" /> Sí
                                  </span>
                                ) : (
                                  <span className="flex items-center text-red-600">
                                    <MdError className="mr-1" /> No
                                  </span>
                                )}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-gray-500">Tamaño:</p>
                              <p className="text-sm">
                                {regionDetails.serverStatus?.file_size_mb > 0 
                                  ? `${regionDetails.serverStatus.file_size_mb} MB`
                                  : 'No disponible'}
                              </p>
                            </div>
                            
                            <div className="col-span-2">
                              <p className="text-xs text-gray-500">Disponible para descargar:</p>
                              <p className="text-sm">
                                {regionDetails.serverStatus?.available_for_download ? (
                                  <span className="flex items-center text-green-600">
                                    <MdCheckCircle className="mr-1" /> Sí
                                  </span>
                                ) : (
                                  <span className="flex items-center text-yellow-600">
                                    <MdHelp className="mr-1" /> No o desconocido
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Información local */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Información en navegador:</h4>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <p className="text-xs text-gray-500">Tiles en caché:</p>
                          <p className="text-sm">
                            {regionDetails.localStatus?.hasCachedTiles === true ? (
                              <span className="flex items-center text-green-600">
                                <MdCheckCircle className="mr-1" /> Sí
                              </span>
                            ) : (
                              <span className="flex items-center text-yellow-600">
                                <MdHelp className="mr-1" /> No
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {/* Diagnóstico y soluciones */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Diagnóstico:</h4>
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                          <ul className="text-sm space-y-2">
                            {!regionDetails.serverStatus?.file_exists && (
                              <li className="flex items-start">
                                <MdError className="text-red-500 mr-1 mt-0.5 flex-shrink-0" size={16} />
                                <span>El archivo no existe en el servidor. Necesitas descargar el mapa.</span>
                              </li>
                            )}
                            
                            {regionDetails.serverStatus?.file_exists && regionDetails.serverStatus.file_size_mb < 1 && (
                              <li className="flex items-start">
                                <MdError className="text-red-500 mr-1 mt-0.5 flex-shrink-0" size={16} />
                                <span>El archivo MWM es demasiado pequeño y puede estar corrupto.</span>
                              </li>
                            )}
                            
                            {regionDetails.serverStatus?.file_exists && regionDetails.localStatus?.hasCachedTiles !== true && (
                              <li className="flex items-start">
                                <MdHelp className="text-yellow-500 mr-1 mt-0.5 flex-shrink-0" size={16} />
                                <span>El archivo existe en el servidor pero no hay tiles en caché. Intenta navegar por el mapa para cargar tiles.</span>
                              </li>
                            )}
                            
                            {regionDetails.serverStatus?.file_exists && 
                             regionDetails.serverStatus.file_size_mb >= 1 &&
                             regionDetails.localStatus?.hasCachedTiles === true && (
                              <li className="flex items-start">
                                <MdCheckCircle className="text-green-500 mr-1 mt-0.5 flex-shrink-0" size={16} />
                                <span>El mapa parece estar correctamente configurado.</span>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapDiagnosticPanel;
