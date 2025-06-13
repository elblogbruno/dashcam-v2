import React, { useState, useEffect } from 'react';
import { 
  FaHdd, 
  FaPlay, 
  FaStop, 
  FaSync, 
  FaCog, 
  FaLightbulb,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle
} from 'react-icons/fa';
import axios from 'axios';

// Layout y UI Components
import { PageLayout, Section, Flex, Stack, Grid } from '../components/common/Layout';
import { Button, Card, Alert, Badge } from '../components/common/UI';

function DiskSpaceMonitor() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [thresholds, setThresholds] = useState({
    critical: 10,
    low: 30,
    medium: 70
  });

  // Fetch monitor status
  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/disk-space-monitor/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching status:', error);
      setMessage({
        type: 'error',
        text: 'Error al obtener estado: ' + (error.response?.data?.detail || error.message)
      });
    }
  };

  // Fetch thresholds
  const fetchThresholds = async () => {
    try {
      const response = await axios.get('/api/disk-space-monitor/thresholds');
      setThresholds(response.data.thresholds);
    } catch (error) {
      console.error('Error fetching thresholds:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchThresholds();
    
    // Poll status every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Start monitor
  const startMonitor = async () => {
    setLoading(true);
    try {
      await axios.post('/api/disk-space-monitor/start');
      setMessage({
        type: 'success',
        text: 'Monitor de espacio en disco iniciado'
      });
      await fetchStatus();
    } catch (error) {
      console.error('Error starting monitor:', error);
      setMessage({
        type: 'error',
        text: 'Error al iniciar monitor: ' + (error.response?.data?.detail || error.message)
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Stop monitor
  const stopMonitor = async () => {
    setLoading(true);
    try {
      await axios.post('/api/disk-space-monitor/stop');
      setMessage({
        type: 'success',
        text: 'Monitor de espacio en disco detenido'
      });
      await fetchStatus();
    } catch (error) {
      console.error('Error stopping monitor:', error);
      setMessage({
        type: 'error',
        text: 'Error al detener monitor: ' + (error.response?.data?.detail || error.message)
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Test LEDs
  const testLEDs = async () => {
    setLoading(true);
    try {
      await axios.post('/api/disk-space-monitor/test-leds');
      setMessage({
        type: 'success',
        text: 'Prueba de LEDs completada'
      });
    } catch (error) {
      console.error('Error testing LEDs:', error);
      setMessage({
        type: 'error',
        text: 'Error al probar LEDs: ' + (error.response?.data?.detail || error.message)
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Update thresholds
  const updateThresholds = async () => {
    setLoading(true);
    try {
      await axios.post('/api/disk-space-monitor/update-thresholds', thresholds);
      setMessage({
        type: 'success',
        text: 'Umbrales actualizados correctamente'
      });
    } catch (error) {
      console.error('Error updating thresholds:', error);
      setMessage({
        type: 'error',
        text: 'Error al actualizar umbrales: ' + (error.response?.data?.detail || error.message)
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get LED status color and description
  const getLEDStatus = (ledStatus) => {
    switch (ledStatus) {
      case 'critical':
        return { color: 'text-red-500', bg: 'bg-red-100', text: 'CRÍTICO: Todos los LEDs parpadeando en rojo' };
      case 'low':
        return { color: 'text-red-500', bg: 'bg-red-100', text: 'BAJO: LED rojo encendido' };
      case 'medium':
        return { color: 'text-yellow-500', bg: 'bg-yellow-100', text: 'MEDIO: LED amarillo encendido' };
      case 'good':
        return { color: 'text-green-500', bg: 'bg-green-100', text: 'BUENO: LED verde encendido' };
      default:
        return { color: 'text-gray-500', bg: 'bg-gray-100', text: 'Desconocido' };
    }
  };

  return (
    <PageLayout
      title="Monitor de Espacio en Disco"
      icon={<FaHdd />}
      action={
        <a href="/settings#debug-section" className="text-primary-600 hover:text-primary-800 text-sm">
          &larr; Volver a Configuración
        </a>
      }
    >
      {message && (
        <Alert
          type={message.type}
          onClose={() => setMessage(null)}
          className="mb-4"
        >
          {message.text}
        </Alert>
      )}

      <Stack spacing="lg">
        {/* Status Card */}
        <Card>
          <h2 className="text-lg font-medium mb-4">Estado del Monitor</h2>
          
          {status ? (
            <Grid cols="1" mdCols="2" className="gap-6">
              <Stack spacing="md">
                <Flex align="center" className="gap-2">
                  <span className={`w-3 h-3 rounded-full ${status.running ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">
                    {status.running ? 'Monitor Activo' : 'Monitor Detenido'}
                  </span>
                </Flex>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Intervalo de verificación: {status.check_interval} segundos</p>
                  <p>Control de LEDs: {status.enable_leds ? 'Habilitado' : 'Deshabilitado'}</p>
                  <p>Ruta monitorizada: {status.data_path}</p>
                  <p>LEDs disponibles: {status.led_controller_available ? 'Sí' : 'No'}</p>
                </div>
              </Stack>
              
              <Flex justify="end" align="start" className="gap-2">
                <Button
                  onClick={status.running ? stopMonitor : startMonitor}
                  disabled={loading}
                  variant={status.running ? 'danger' : 'primary'}
                  size="md"
                >
                  {status.running ? <FaStop className="mr-2" /> : <FaPlay className="mr-2" />}
                  {status.running ? 'Detener' : 'Iniciar'}
                </Button>
                
                <Button
                  onClick={testLEDs}
                  disabled={loading || !status.enable_leds}
                  variant="secondary"
                  size="md"
                >
                  <FaLightbulb className="mr-2" /> Probar LEDs
                </Button>
              </Flex>
            </Grid>
          ) : (
            <div className="text-center py-4">
              <FaSync className="animate-spin mx-auto text-2xl text-gray-400 mb-2" />
              <p className="text-gray-500">Cargando estado del monitor...</p>
            </div>
          )}
        </Card>

        {/* Current Disk Usage */}
        {status?.current_usage && (
          <Card>
            <h2 className="text-lg font-medium mb-4">Uso Actual del Disco</h2>
            
            <Grid cols="1" mdCols="2" className="gap-6">
              <Stack spacing="md">
                <div className="space-y-2">
                  <Flex justify="between">
                    <span className="text-sm text-gray-600">Espacio libre:</span>
                    <span className="font-medium">{status.current_usage.free_percent.toFixed(1)}%</span>
                  </Flex>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        status.current_usage.free_percent < 10
                          ? 'bg-red-500' 
                          : status.current_usage.free_percent < 30
                          ? 'bg-red-400'
                          : status.current_usage.free_percent < 70
                          ? 'bg-yellow-400'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.max(5, status.current_usage.free_percent)}%` }}
                    />
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Total: {formatBytes(status.current_usage.total_bytes)}</p>
                  <p>Usado: {formatBytes(status.current_usage.used_bytes)} ({status.current_usage.used_percent.toFixed(1)}%)</p>
                  <p>Libre: {formatBytes(status.current_usage.free_bytes)}</p>
                  <p>Ruta: {status.current_usage.path}</p>
                </div>
              </Stack>
              
              <div>
                {status.last_status && (
                  <div className={`p-4 rounded-lg ${getLEDStatus(status.last_status.led_status).bg}`}>
                    <Flex align="center" className="gap-2 mb-2">
                      {status.last_status.led_status === 'critical' && <FaExclamationTriangle className="text-red-500" />}
                      {status.last_status.led_status === 'low' && <FaExclamationTriangle className="text-red-500" />}
                      {status.last_status.led_status === 'medium' && <FaInfoCircle className="text-yellow-500" />}
                      {status.last_status.led_status === 'good' && <FaCheckCircle className="text-green-500" />}
                      <span className={`font-medium ${getLEDStatus(status.last_status.led_status).color}`}>
                        Estado LEDs
                      </span>
                    </Flex>
                    <p className="text-sm">{getLEDStatus(status.last_status.led_status).text}</p>
                  </div>
                )}
              </div>
            </Grid>
          </Card>
        )}

        {/* Threshold Configuration */}
        <Card>
          <h2 className="text-lg font-medium mb-4">Configuración de Umbrales</h2>
          
          <Grid cols="1" mdCols="3" className="gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Crítico (%) - Parpadeo rojo
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={thresholds.critical}
                onChange={(e) => setThresholds(prev => ({ ...prev, critical: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Todos los LEDs parpadean en rojo cuando el espacio libre es menor a este porcentaje
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Bajo (%) - LED rojo
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={thresholds.low}
                onChange={(e) => setThresholds(prev => ({ ...prev, low: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                LED rojo encendido cuando el espacio libre es menor a este porcentaje
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Medio (%) - LED amarillo
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={thresholds.medium}
                onChange={(e) => setThresholds(prev => ({ ...prev, medium: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                LED amarillo encendido cuando el espacio libre es menor a este porcentaje
              </p>
            </div>
          </Grid>
          
          <Flex justify="end">
            <Button
              onClick={updateThresholds}
              disabled={loading}
              variant="primary"
              size="md"
            >
              <FaCog className="mr-2" /> Actualizar Umbrales
            </Button>
          </Flex>
        </Card>

        {/* LED States Description */}
        <Card>
          <h2 className="text-lg font-medium mb-4">Estados de los LEDs</h2>
          
          <Grid cols="1" mdCols="2" className="gap-4">
            <Stack spacing="sm">
              <Flex align="center" className="gap-3">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <div>
                  <span className="font-medium text-green-700">LED Verde (LED 0)</span>
                  <p className="text-xs text-gray-600">Espacio libre &gt;= 70% - Todo bien</p>
                </div>
              </Flex>
              
              <Flex align="center" className="gap-3">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <div>
                  <span className="font-medium text-yellow-700">LED Amarillo (LED 1)</span>
                  <p className="text-xs text-gray-600">Espacio libre 30-70% - Precaución</p>
                </div>
              </Flex>
            </Stack>
            
            <Stack spacing="sm">
              <Flex align="center" className="gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <div>
                  <span className="font-medium text-red-700">LED Rojo (LED 2)</span>
                  <p className="text-xs text-gray-600">Espacio libre 10-30% - Espacio bajo</p>
                </div>
              </Flex>
              
              <Flex align="center" className="gap-3">
                <div className="w-4 h-4 rounded-full bg-red-600 animate-pulse"></div>
                <div>
                  <span className="font-medium text-red-700">Todos Parpadeando</span>
                  <p className="text-xs text-gray-600">Espacio libre &lt; 10% - ¡CRÍTICO!</p>
                </div>
              </Flex>
            </Stack>
          </Grid>
        </Card>

        {/* Information */}
        <Card>
          <h2 className="text-lg font-medium mb-4">Información</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              Este monitor supervisa continuamente el espacio libre del disco duro y utiliza 
              los 3 LEDs del ReSpeaker 2mic HAT para indicar el estado del almacenamiento.
            </p>
            <p>
              <strong>Funcionamiento:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Verifica el espacio libre cada {status?.check_interval || 30} segundos</li>
              <li>Activa diferentes LEDs según los umbrales configurados</li>
              <li>En estado crítico (&lt;10% libre), todos los LEDs parpadean en rojo</li>
              <li>Se inicia automáticamente con el sistema</li>
            </ul>
          </div>
        </Card>
      </Stack>
    </PageLayout>
  );
}

export default DiskSpaceMonitor;
