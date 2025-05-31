// filepath: /root/dashcam-v2/frontend/src/pages/UnifiedStorageManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaHdd, FaSync, FaChartBar, FaCheckCircle, 
  FaExclamationTriangle, FaUsb, FaCopy, FaFolderOpen
} from 'react-icons/fa';
import axios from 'axios';

// Importación de componentes modularizados
import DiskInfoPanel from '../components/storage/DiskInfoPanel';
import VideoStatsPanel from '../components/storage/VideoStatsPanel';
import UsbDrivesPanel from '../components/storage/UsbDrivesPanel';
import HddBackupPanel from '../components/storage/HddBackupPanel';
import StorageSettingsPanel from '../components/storage/StorageSettingsPanel';
import DriveDetailsModal from '../components/storage/DriveDetailsModal';
import FileExplorer from '../components/FileExplorer';

// Importación de utilidades
import { formatBytes, formatDate } from '../utils/formatUtils';

function UnifiedStorageManager() {
  // Estados para información de disco
  const [diskInfo, setDiskInfo] = useState({
    mounted: false,
    total: 0,
    used: 0,
    free: 0,
    percent: 0,
    device: '',
    path: '',
    isUsb: false,
    canEject: false
  });

  // Estados para estadísticas de videos
  const [videoStats, setVideoStats] = useState({
    totalVideos: 0,
    totalSize: 0,
    oldestVideo: null,
    newestVideo: null,
    byMonth: []
  });

  // Estados para configuración de almacenamiento
  const [settings, setSettings] = useState({
    autoCleanEnabled: false,
    autoCleanThreshold: 90,
    autoCleanDays: 30,
    mainDrive: '/dev/sda1',
    mountPoint: '/mnt/dashcam_storage',
    autoDetectDrives: true
  });

  // Estados para dispositivos USB
  const [availableDrives, setAvailableDrives] = useState([]);
  const [selectedDriveDetails, setSelectedDriveDetails] = useState(null);
  const [showDriveDetails, setShowDriveDetails] = useState(false);

  // Estados para copia HDD
  const [copyStatus, setCopyStatus] = useState({
    is_copying: false,
    status: 'idle',
    progress: 0,
    current_file: '',
    stats: {
      total_files: 0,
      copied_files: 0,
      total_size: 0,
      copied_size: 0,
      start_time: null,
      end_time: null,
      error: null
    }
  });

  // Estados de interfaz
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'usb-drives', 'hdd-backup', 'explorer', 'settings'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  
  // Estado para el explorador de archivos
  const [selectedDisk, setSelectedDisk] = useState('internal');
  const [selectedFile, setSelectedFile] = useState(null);

  // Cargar datos iniciales
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Obtener información del disco
      const diskResponse = await axios.get('/api/storage/disk-info');
      setDiskInfo(diskResponse.data);
      
      // Obtener estadísticas de videos
      const statsResponse = await axios.get('/api/storage/video-stats');
      setVideoStats(statsResponse.data);
      
      // Obtener configuración de almacenamiento
      const settingsResponse = await axios.get('/api/storage/settings');
      setSettings(settingsResponse.data);
      
      // Detectar dispositivos USB disponibles
      const drivesResponse = await axios.get('/api/storage/detect-drives');
      setAvailableDrives(drivesResponse.data.drives || []);

      // Obtener estado de copia HDD
      const copyResponse = await axios.get('/api/storage/hdd-backup/copy-status');
      setCopyStatus(copyResponse.data);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      setActionResult({
        success: false,
        message: 'Error al cargar los datos del almacenamiento'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    // Actualizar datos cada 30 segundos
    const interval = setInterval(() => {
      if (!actionLoading && activeTab !== 'settings') {
        loadData();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadData, actionLoading, activeTab]);

  // Funciones para manejo de unidades
  const handleDriveMount = async (device = null) => {
    setActionLoading(true);
    try {
      if (diskInfo.mounted) {
        const response = await axios.post('/api/storage/unmount');
        setActionResult({
          success: response.data.success,
          message: response.data.message || "Unidad desmontada exitosamente"
        });
      } else {
        const response = await axios.post('/api/storage/mount', device ? { device } : {});
        setActionResult({
          success: response.data.success,
          message: response.data.message || "Unidad montada exitosamente"
        });
      }
      
      // Actualizar información
      await loadData();
      
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Error al montar/desmontar la unidad'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  const handleDriveEject = async (device) => {
    if (!confirm(`¿Seguro que deseas expulsar el dispositivo ${device}? Asegúrate de que no se esté accediendo a él.`)) {
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await axios.post(`/api/storage/eject/${encodeURIComponent(device)}`);
      
      setActionResult({
        success: response.data.success,
        message: response.data.message
      });
      
      await loadData();
      
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || `Error al expulsar el dispositivo ${device}`
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  const handleViewDriveDetails = async (device) => {
    setActionLoading(true);
    try {
      const response = await axios.get(`/api/storage/disk-details/${device}`);
      
      // Asegurarnos de que los valores numéricos sean números válidos
      const driveData = response.data;
      
      // Asegurarse de que los valores importantes sean numéricos
      const cleanData = {
        ...driveData,
        size: typeof driveData.size === 'number' && !isNaN(driveData.size) ? driveData.size : 0,
        used: typeof driveData.used === 'number' && !isNaN(driveData.used) ? driveData.used : 0,
        avail: typeof driveData.avail === 'number' && !isNaN(driveData.avail) ? driveData.avail : 0,
        name: driveData.name || device || 'Disco',
        model: driveData.model || 'Desconocido',
        serial: driveData.serial || 'Desconocido',
        mounted: !!driveData.mounted
      };
      
      setSelectedDriveDetails(cleanData);
      setShowDriveDetails(true);
    } catch (error) {
      setActionResult({
        success: false,
        message: `Error al obtener detalles para ${device}: ${error.response?.data?.detail || error.message}`
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  // Funciones para mantenimiento de videos
  const handleCleanup = async (days = 30) => {
    if (!confirm(`Esto eliminará videos más antiguos de ${days} días. ¿Continuar?`)) {
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await axios.post('/api/storage/clean', { days });
      
      setActionResult({
        success: true,
        message: `Eliminados ${response.data.deleted} videos, liberados ${formatBytes(response.data.freedSpace)}`
      });
      
      await loadData();
      
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Error al limpiar videos antiguos'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  const handleArchive = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post('/api/storage/archive');
      
      setActionResult({
        success: true,
        message: `Archivados ${response.data.archived} videos, ahorrados ${formatBytes(response.data.savedSpace)}`
      });
      
      await loadData();
      
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Error al archivar videos'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  // Funciones para copia HDD
  const handleStartHDDCopy = async (destination = null) => {
    console.log('handleStartHDDCopy called with destination:', destination);
    console.log('Current actionLoading state:', actionLoading);
    console.log('Current copyStatus:', copyStatus);
    
    setActionLoading(true);
    try {
      console.log('Making POST request to /api/storage/hdd-backup/start-copy');
      const response = await axios.post('/api/storage/hdd-backup/start-copy', 
        destination ? { destination } : {});
      
      console.log('Response received:', response.data);
      
      setActionResult({
        success: true,
        message: response.data.message
      });
      
      // Actualizar estado de copia
      const statusResponse = await axios.get('/api/storage/hdd-backup/copy-status');
      setCopyStatus(statusResponse.data);
      
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Error al iniciar la copia al HDD'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  const handleCancelHDDCopy = async () => {
    if (!confirm('¿Seguro que deseas cancelar la copia al HDD?')) {
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await axios.post('/api/storage/hdd-backup/cancel-copy');
      
      setActionResult({
        success: true,
        message: response.data.message
      });
      
      // Actualizar estado de copia
      const statusResponse = await axios.get('/api/storage/hdd-backup/copy-status');
      setCopyStatus(statusResponse.data);
      
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Error al cancelar la copia al HDD'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  const handleEjectAfterCopy = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post('/api/storage/hdd-backup/eject-after-copy');
      
      setActionResult({
        success: true,
        message: response.data.message
      });
      
      await loadData();
      
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Error al expulsar el HDD'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  // Funciones para configuración
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSettingsUpdate = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post('/api/storage/settings', settings);
      
      setActionResult({
        success: true,
        message: 'Configuración de almacenamiento actualizada exitosamente'
      });
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Error al actualizar la configuración'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  const refreshAllData = async () => {
    setActionLoading(true);
    try {
      await loadData();
      setActionResult({
        success: true,
        message: 'Información de almacenamiento actualizada exitosamente'
      });
    } catch (error) {
      setActionResult({
        success: false,
        message: 'Error al actualizar la información de almacenamiento'
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  // Funciones para el explorador de archivos
  const handleFileSelection = (file) => {
    setSelectedFile(file);
    console.log('Archivo seleccionado:', file);
  };

  const handleSwitchDisk = () => {
    setSelectedDisk(prev => prev === 'internal' ? 'external' : 'internal');
  };

  if (loading) {
    return (
      <div className="p-2 sm:p-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 border border-neutral-200 hover:shadow-xl transition-all duration-500 mx-2">
            <div className="bg-gradient-to-br from-dashcam-600 to-dashcam-500 p-3 sm:p-4 rounded-xl shadow-lg mx-auto mb-4 sm:mb-6 w-fit">
              <FaHdd className="text-3xl sm:text-5xl text-white animate-pulse" />
            </div>
            <div className="loading loading-spinner loading-md sm:loading-lg mb-3 sm:mb-4 text-dashcam-500"></div>
            <p className="text-base sm:text-lg font-medium text-neutral-700 text-center">Cargando información de almacenamiento...</p>
            <p className="text-xs sm:text-sm text-neutral-500 mt-2 text-center">Esto puede tardar unos momentos si hay muchos archivos</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 max-w-7xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-dashcam-800 flex items-center mb-4 sm:mb-6">
        <FaHdd className="mr-2" /> 
        <span className="hidden sm:inline">Administrador de Almacenamiento</span>
        <span className="sm:hidden">Almacenamiento</span>
      </h1>
      
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
        <div className="border-b border-neutral-200">
          <nav className="flex overflow-x-auto space-x-1 sm:space-x-2 px-3 sm:px-6 scrollbar-hide" role="tablist">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 sm:py-4 px-2 sm:px-4 font-medium transition-all border-b-2 hover:text-dashcam-600 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-dashcam-500 text-dashcam-600'
                  : 'border-transparent text-neutral-600 hover:border-neutral-300'
              }`}
              role="tab"
              aria-selected={activeTab === 'overview'}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <FaChartBar className="text-sm sm:text-base" />
                <span className="text-sm sm:text-base">Resumen</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('usb-drives')}
              className={`py-3 sm:py-4 px-2 sm:px-4 font-medium transition-all border-b-2 hover:text-dashcam-600 whitespace-nowrap ${
                activeTab === 'usb-drives'
                  ? 'border-dashcam-500 text-dashcam-600'
                  : 'border-transparent text-neutral-600 hover:border-neutral-300'
              }`}
              role="tab"
              aria-selected={activeTab === 'usb-drives'}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <FaUsb className="text-sm sm:text-base" />
                <span className="text-sm sm:text-base">USB</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('hdd-backup')}
              className={`py-3 sm:py-4 px-2 sm:px-4 font-medium transition-all border-b-2 hover:text-dashcam-600 whitespace-nowrap ${
                activeTab === 'hdd-backup'
                  ? 'border-dashcam-500 text-dashcam-600'
                  : 'border-transparent text-neutral-600 hover:border-neutral-300'
              }`}
              role="tab"
              aria-selected={activeTab === 'hdd-backup'}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <FaCopy className="text-sm sm:text-base" />
                <span className="text-sm sm:text-base">Copia</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('explorer')}
              className={`py-3 sm:py-4 px-2 sm:px-4 font-medium transition-all border-b-2 hover:text-dashcam-600 whitespace-nowrap ${
                activeTab === 'explorer'
                  ? 'border-dashcam-500 text-dashcam-600'
                  : 'border-transparent text-neutral-600 hover:border-neutral-300'
              }`}
              role="tab"
              aria-selected={activeTab === 'explorer'}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <FaFolderOpen className="text-sm sm:text-base" />
                <span className="text-sm sm:text-base">Explorador</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 sm:py-4 px-2 sm:px-4 font-medium transition-all border-b-2 hover:text-dashcam-600 whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-dashcam-500 text-dashcam-600'
                  : 'border-transparent text-neutral-600 hover:border-neutral-300'
              }`}
              role="tab"
              aria-selected={activeTab === 'settings'}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <FaHdd className="text-sm sm:text-base" />
                <span className="text-sm sm:text-base">Ajustes</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-3 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Estado del disco principal */}
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200/70 hover:shadow-xl transition-all duration-500">
                  <DiskInfoPanel 
                    diskInfo={diskInfo}
                    actionLoading={actionLoading}
                    formatBytes={formatBytes}
                    onMount={() => handleDriveMount()}
                    onEject={() => handleDriveEject(diskInfo.device)}
                  />
                </div>

                {/* Estadísticas de videos */}
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200/70 hover:shadow-xl transition-all duration-500">
                  <VideoStatsPanel 
                    videoStats={videoStats}
                    actionLoading={actionLoading}
                    formatBytes={formatBytes}
                    onCleanup={handleCleanup}
                    onArchive={handleArchive}
                  />
                </div>
              </div>
            )}
            
            {activeTab === 'usb-drives' && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200/70 hover:shadow-xl transition-all duration-500">
                <UsbDrivesPanel 
                  drives={availableDrives}
                  diskInfo={diskInfo}
                  actionLoading={actionLoading}
                  formatBytes={formatBytes}
                  onMount={handleDriveMount}
                  onEject={handleDriveEject}
                  onViewDetails={handleViewDriveDetails}
                />
              </div>
            )}
            
            {activeTab === 'hdd-backup' && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200/70 hover:shadow-xl transition-all duration-500">
                <HddBackupPanel 
                  copyStatus={copyStatus}
                  drives={availableDrives}
                  actionLoading={actionLoading}
                  formatBytes={formatBytes}
                  formatDate={formatDate}
                  onStartCopy={handleStartHDDCopy}
                  onCancelCopy={handleCancelHDDCopy}
                  onEjectAfterCopy={handleEjectAfterCopy}
                  diskInfo={diskInfo}
                />
              </div>
            )}
            
            {activeTab === 'explorer' && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200/70 hover:shadow-xl transition-all duration-500">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Explorador de archivos</h2>
                    <button 
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700"
                      onClick={handleSwitchDisk}
                    >
                      {selectedDisk === 'internal' ? 'Cambiar a Disco Externo' : 'Cambiar a Disco Interno'}
                    </button>
                  </div>
                  <FileExplorer 
                    onFileSelect={handleFileSelection}
                    showVideosOnly={false}
                    allowFileOperations={true}
                    allowIndexing={true}
                    selectedDisk={selectedDisk}
                    height="60vh"
                  />
                </div>
              </div>
            )}
            
            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200/70 hover:shadow-xl transition-all duration-500">
                <StorageSettingsPanel 
                  settings={settings}
                  onSettingChange={handleSettingChange}
                  onSettingsUpdate={handleSettingsUpdate}
                  actionLoading={actionLoading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para detalles del disco */}
      <DriveDetailsModal 
        isOpen={showDriveDetails}
        onClose={() => setShowDriveDetails(false)}
        driveDetails={selectedDriveDetails}
        formatBytes={formatBytes}
      />
    </div>
  );
}

export default UnifiedStorageManager;
