// filepath: /root/dashcam-v2/frontend/src/pages/UnifiedStorageManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaHdd, FaSync, FaChartBar, FaCheckCircle, 
  FaExclamationTriangle, FaUsb, FaCopy, FaFolderOpen,
  FaLightbulb
} from 'react-icons/fa';
import axios from 'axios';

// Layout y UI Components
import { PageLayout, Section, Flex, Stack, Grid } from '../components/common/Layout';
import { Button, Card, Alert, Spinner } from '../components/common/UI';

// Importación de componentes modularizados
import DiskInfoPanel from '../components/storage/DiskInfoPanel';
import VideoStatsPanel from '../components/storage/VideoStatsPanel';
import UsbDrivesPanel from '../components/storage/UsbDrivesPanel';
import HddBackupPanel from '../components/storage/HddBackupPanel';
import StorageSettingsPanel from '../components/storage/StorageSettingsPanel';
import DriveDetailsModal from '../components/storage/DriveDetailsModal';
import FileExplorer from '../components/FileExplorer';
import DiskSpaceMonitor from './DiskSpaceMonitor';

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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'usb-drives', 'hdd-backup', 'explorer', 'disk-monitor', 'settings'
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
      <PageLayout>
        <Section className="flex items-center justify-center min-h-[50vh]">
          <Card className="text-center p-8 max-w-md mx-auto">
            <Flex direction="col" align="center" className="gap-4">
              <div className="bg-gradient-to-br from-primary-600 to-primary-500 p-4 rounded-xl shadow-lg">
                <FaHdd className="text-5xl text-white animate-pulse" />
              </div>
              <Spinner size="lg" />
              <Stack spacing="sm" className="text-center">
                <p className="text-lg font-medium text-neutral-700">Cargando información de almacenamiento...</p>
                <p className="text-sm text-neutral-500">Esto puede tardar unos momentos si hay muchos archivos</p>
              </Stack>
            </Flex>
          </Card>
        </Section>
      </PageLayout>
    );
  }

  return (
    <div className="storage-manager-container">
      <PageLayout
        title="Administrador de Almacenamiento"
        icon={<FaHdd size={20} />}
        subtitle="Gestiona el almacenamiento de tu sistema DashCam"
      >
        {/* Alert para acciones */}
        {actionResult && (
          <Alert
            type={actionResult.success ? "success" : "error"}
            onClose={() => setActionResult(null)}
            className="mb-4"
          >
            {actionResult.message}
          </Alert>
        )}

        {/* Pestañas de navegación simplificadas */}
        <div className="border-b border-gray-100 mb-4">
          <nav className="flex space-x-1 overflow-x-auto scrollbar-hide" role="tablist">
            <Button
              onClick={() => setActiveTab('overview')}
              variant={activeTab === 'overview' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaChartBar className="mr-1 text-xs" />
              Resumen
            </Button>
            <Button
              onClick={() => setActiveTab('usb-drives')}
              variant={activeTab === 'usb-drives' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'usb-drives'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaUsb className="mr-1 text-xs" />
              USB
            </Button>
            <Button
              onClick={() => setActiveTab('hdd-backup')}
              variant={activeTab === 'hdd-backup' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'hdd-backup'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaCopy className="mr-1 text-xs" />
              Copia
            </Button>
            <Button
              onClick={() => setActiveTab('explorer')}
              variant={activeTab === 'explorer' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'explorer'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaFolderOpen className="mr-1 text-xs" />
              Explorador
            </Button>
            <Button
              onClick={() => setActiveTab('disk-monitor')}
              variant={activeTab === 'disk-monitor' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'disk-monitor'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaLightbulb className="mr-1 text-xs" />
              Monitor LEDs
            </Button>
            <Button
              onClick={() => setActiveTab('settings')}
              variant={activeTab === 'settings' ? 'primary' : 'ghost'}
              size="sm"
              className={`py-2 px-3 text-xs border-b-2 whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <FaHdd className="mr-1 text-xs" />
              Ajustes
            </Button>
          </nav>
        </div>

        {/* Contenido de las pestañas - SIN Card wrapper adicional */}
        <div className="space-y-3">
          {activeTab === 'overview' && (
            <>
              <DiskInfoPanel 
                diskInfo={diskInfo}
                actionLoading={actionLoading}
                formatBytes={formatBytes}
                onMount={() => handleDriveMount()}
                onEject={() => handleDriveEject(diskInfo.device)}
              />
              <VideoStatsPanel 
                videoStats={videoStats}
                actionLoading={actionLoading}
                formatBytes={formatBytes}
                onCleanup={handleCleanup}
                onArchive={handleArchive}
              />
            </>
          )}
          
          {activeTab === 'usb-drives' && (
            <UsbDrivesPanel 
              drives={availableDrives}
              diskInfo={diskInfo}
              actionLoading={actionLoading}
              formatBytes={formatBytes}
              onMount={handleDriveMount}
              onEject={handleDriveEject}
              onViewDetails={handleViewDriveDetails}
            />
          )}
          
          {activeTab === 'hdd-backup' && (
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
          )}
          
          {activeTab === 'explorer' && (
            <Card className="p-3">
              <Flex className="justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-gray-800">Explorador de archivos</h2>
                <Button
                  onClick={handleSwitchDisk}
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                >
                  {selectedDisk === 'internal' ? 'Cambiar a Disco Externo' : 'Cambiar a Disco Interno'}
                </Button>
              </Flex>
              <FileExplorer 
                onFileSelect={handleFileSelection}
                showVideosOnly={false}
                allowFileOperations={true}
                allowIndexing={true}
                selectedDisk={selectedDisk}
                height="60vh"
              />
            </Card>
          )}
          
          {activeTab === 'disk-monitor' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <DiskSpaceMonitor />
            </div>
          )}
          
          {activeTab === 'settings' && (
            <StorageSettingsPanel 
              settings={settings}
              onSettingChange={handleSettingChange}
              onSettingsUpdate={handleSettingsUpdate}
              actionLoading={actionLoading}
            />
          )}
        </div>

        {/* Modal para detalles del disco */}
        <DriveDetailsModal 
          isOpen={showDriveDetails}
          onClose={() => setShowDriveDetails(false)}
          driveDetails={selectedDriveDetails}
          formatBytes={formatBytes}
        />
      </PageLayout>
    </div>
  );
}

export default UnifiedStorageManager;
