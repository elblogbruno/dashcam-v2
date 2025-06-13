import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  FaMapMarkerAlt, FaGlobe, FaDatabase, FaWifi, FaBan,
  FaPlay, FaStop, FaSync, FaDownload, FaSearch, FaInfoCircle,
  FaCheck, FaTimes, FaExclamationTriangle, FaCog
} from 'react-icons/fa';
import axios from 'axios';

// Importar el nuevo sistema de diseño
import { PageLayout, Section, Grid, Stack, Flex } from '../../components/common/Layout';
import { Button, Card, Input, Alert, Badge, Spinner } from '../../components/common/UI';

const GeocodingTester = () => {
  // Estado principal
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    online: false,
    offline: {
      database: false
    },
    checking: false
  });

  // Estado de entrada
  const [testLocation, setTestLocation] = useState({
    lat: 40.7589, // Times Square por defecto
    lon: -73.9851,
    name: 'Times Square, NYC'
  });

  // Estado de configuración
  const [testConfig, setTestConfig] = useState({
    radius: 5.0,
    testType: 'both', // 'online', 'offline', 'both'
    generateGrid: true,
    maxResults: 50
  });

  // Estado de progreso
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    phase: 'idle',
    details: ''
  });

  // Estado para geocodificación simple
  const [simpleGeocoding, setSimpleGeocoding] = useState({
    lat: '',
    lon: '',
    result: null,
    isLoading: false,
    error: null
  });

  // Verificar estado de conectividad al cargar
  useEffect(() => {
    checkConnectivityStatus();
  }, []);

  const checkConnectivityStatus = async () => {
    setConnectionStatus(prev => ({ ...prev, checking: true }));
    
    try {
      // Verificar conectividad online
      const onlineResponse = await axios.get('/api/geocoding/test/connectivity', {
        timeout: 5000
      });
      
      // Verificar métodos offline
      const offlineResponse = await axios.get('/api/geocoding/test/offline-status', {
        timeout: 5000
      });

      setConnectionStatus({
        online: onlineResponse.data.online || false,
        offline: {
          database: offlineResponse.data.database?.available || false
        },
        checking: false
      });
    } catch (error) {
      console.error('Error checking connectivity:', error);
      setConnectionStatus({
        online: false,
        offline: {
          database: false
        },
        checking: false
      });
    }
  };

  const runGeocodingTest = async () => {
    if (!testLocation.lat || !testLocation.lon) {
      toast.error('Por favor ingresa coordenadas válidas');
      return;
    }

    setIsLoading(true);
    setTestResults(null);
    setProgress({
      current: 0,
      total: 100,
      phase: 'starting',
      details: 'Iniciando prueba de geocodificación...'
    });

    try {
      const testPayload = {
        lat: parseFloat(testLocation.lat),
        lon: parseFloat(testLocation.lon),
        location_name: testLocation.name,
        radius_km: testConfig.radius,
        test_type: testConfig.testType,
        generate_grid: testConfig.generateGrid,
        max_results: testConfig.maxResults
      };

      console.log('Enviando prueba de geocodificación:', testPayload);

      // Iniciar la prueba
      const response = await axios.post('/api/geocoding/test/run-test', testPayload);
      
      if (response.data.status === 'started') {
        toast.success('Prueba de geocodificación iniciada');
        
        // Conectar al stream de progreso
        const eventSource = new EventSource('/api/geocoding/test/stream');
        
        eventSource.onopen = () => {
          console.log('EventSource conectado');
        };
        
        eventSource.onmessage = (event) => {
          try {
            console.log('Raw event data:', event.data);
            
            // Extract JSON from SSE format if needed
            let jsonData = event.data;
            if (typeof event.data === 'string' && event.data.includes('data: ')) {
              // Extract the JSON part after "data: "
              const lines = event.data.split('\n');
              const dataLine = lines.find(line => line.startsWith('data: '));
              if (dataLine) {
                jsonData = dataLine.substring(6); // Remove "data: " prefix
              }
            }
            
            const data = JSON.parse(jsonData);
            console.log('Progreso de geocodificación:', data);
            
            if (data.type === 'progress') {
              setProgress({
                current: data.progress || 0,
                total: data.total || 100,
                phase: data.phase || 'processing',
                details: data.details || ''
              });
            } else if (data.type === 'complete') {
              setTestResults(data.results);
              setIsLoading(false);
              eventSource.close();
              toast.success('Prueba de geocodificación completada');
            } else if (data.type === 'error') {
              setIsLoading(false);
              eventSource.close();
              toast.error(`Error en la prueba: ${data.message}`);
            } else if (data.type === 'stopped') {
              setIsLoading(false);
              eventSource.close();
              toast.info('Prueba detenida');
            }
          } catch (error) {
            console.error('Error procesando evento:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('Error en EventSource:', error);
          setIsLoading(false);
          eventSource.close();
          toast.error('Error en la conexión de progreso. La prueba puede continuar en segundo plano.');
        };
        
        // Limpiar EventSource cuando el componente se desmonte
        return () => {
          eventSource.close();
        };
      }
    } catch (error) {
      console.error('Error ejecutando prueba:', error);
      setIsLoading(false);
      toast.error(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const stopTest = async () => {
    try {
      await axios.post('/api/geocoding/test/stop');
      setIsLoading(false);
      setProgress({
        current: 0,
        total: 0,
        phase: 'stopped',
        details: 'Prueba detenida'
      });
      toast.info('Prueba detenida');
    } catch (error) {
      console.error('Error deteniendo prueba:', error);
      toast.error('Error al detener la prueba');
    }
  };

  const clearResults = () => {
    setTestResults(null);
    setProgress({
      current: 0,
      total: 0,
      phase: 'idle',
      details: ''
    });
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setTestLocation({
            lat: position.coords.latitude.toFixed(6),
            lon: position.coords.longitude.toFixed(6),
            name: 'Ubicación actual'
          });
          toast.success('Ubicación actual obtenida');
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
          toast.error('No se pudo obtener la ubicación actual');
        }
      );
    } else {
      toast.error('Geolocalización no disponible en este navegador');
    }
  };

  const downloadResults = () => {
    if (!testResults) return;

    const dataStr = JSON.stringify(testResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `geocoding-test-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    toast.success('Resultados descargados');
  };

  // Función para geocodificación simple
  const runSimpleGeocoding = async () => {
    if (!simpleGeocoding.lat || !simpleGeocoding.lon) {
      toast.error('Por favor ingresa coordenadas válidas');
      return;
    }

    setSimpleGeocoding(prev => ({ ...prev, isLoading: true, error: null, result: null }));

    try {
      const lat = parseFloat(simpleGeocoding.lat);
      const lon = parseFloat(simpleGeocoding.lon);

      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new Error('Coordenadas inválidas');
      }

      // Usar la ruta de geocodificación inversa offline-first
      const response = await axios.get('/api/geocode/reverse-offline-first', {
        params: { lat, lon }
      });

      setSimpleGeocoding(prev => ({ 
        ...prev, 
        result: response.data,
        isLoading: false 
      }));
      
      toast.success('Geocodificación completada');
    } catch (error) {
      console.error('Error en geocodificación simple:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Error desconocido';
      setSimpleGeocoding(prev => ({ 
        ...prev, 
        error: errorMessage,
        isLoading: false 
      }));
      toast.error(`Error: ${errorMessage}`);
    }
  };

  const clearSimpleResults = () => {
    setSimpleGeocoding(prev => ({ 
      ...prev, 
      result: null, 
      error: null 
    }));
  };

  return (
    <PageLayout 
      title="Probador de Geocodificación"
      subtitle="Herramienta de depuración para probar capacidades de geocodificación online y offline"
    >
      <Alert variant="info" className="mb-6">
        <FaInfoCircle className="mr-2" />
        <strong>Información:</strong> Esta herramienta permite probar y depurar el sistema de geocodificación simplificado.
        Puedes probar tanto la geocodificación online (Nominatim) como offline (base de datos SQLite local).
      </Alert>

      {/* Estado de Conectividad */}
      <Section title="Estado de Conectividad" variant="card" className="mb-6">
        <Grid cols={2} gap={4}>
          <Card>
            <Flex align="center" gap={3}>
              {connectionStatus.checking ? (
                <Spinner size="sm" />
              ) : connectionStatus.online ? (
                <FaWifi className="text-green-500 text-xl" />
              ) : (
                <FaBan className="text-red-500 text-xl" />
              )}
              <div>
                <h4 className="font-semibold">Geocodificación Online (Nominatim)</h4>
                <Badge 
                  variant={connectionStatus.online ? "success" : "danger"}
                >
                  {connectionStatus.checking ? 'Verificando...' : 
                   connectionStatus.online ? 'Disponible' : 'No disponible'}
                </Badge>
              </div>
            </Flex>
          </Card>

          <Card>
            <Flex align="center" gap={3}>
              {connectionStatus.checking ? (
                <Spinner size="sm" />
              ) : connectionStatus.offline.database ? (
                <FaDatabase className="text-green-500 text-xl" />
              ) : (
                <FaDatabase className="text-red-500 text-xl" />
              )}
              <div>
                <h4 className="font-semibold">Base de Datos Offline (SQLite)</h4>
                <Badge 
                  variant={connectionStatus.offline.database ? "success" : "danger"}
                >
                  {connectionStatus.checking ? 'Verificando...' : 
                   connectionStatus.offline.database ? 'Disponible' : 'No disponible'}
                </Badge>
              </div>
            </Flex>
          </Card>
        </Grid>

        <div className="mt-4">
          <Button 
            variant="outline"
            leftIcon={<FaSync />}
            onClick={checkConnectivityStatus}
            disabled={connectionStatus.checking}
          >
            Verificar Estado
          </Button>
        </div>
      </Section>

      {/* Geocodificación Simple */}
      <Section title="Geocodificación Simple" variant="card" className="mb-6">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Prueba rápida de geocodificación inversa: ingresa coordenadas y obtén la dirección correspondiente.
          </p>
          
          <Grid cols={2} gap={4}>
            <Input
              label="Latitud"
              type="number"
              step="any"
              value={simpleGeocoding.lat}
              onChange={(e) => setSimpleGeocoding(prev => ({
                ...prev,
                lat: e.target.value
              }))}
              placeholder="40.7589"
            />
            
            <Input
              label="Longitud"
              type="number"
              step="any"
              value={simpleGeocoding.lon}
              onChange={(e) => setSimpleGeocoding(prev => ({
                ...prev,
                lon: e.target.value
              }))}
              placeholder="-73.9851"
            />
          </Grid>

          <Flex gap={3}>
            <Button
              variant="primary"
              leftIcon={simpleGeocoding.isLoading ? <Spinner size="sm" /> : <FaSearch />}
              onClick={runSimpleGeocoding}
              disabled={!simpleGeocoding.lat || !simpleGeocoding.lon || simpleGeocoding.isLoading}
            >
              {simpleGeocoding.isLoading ? 'Geocodificando...' : 'Geocodificar'}
            </Button>

            <Button
              variant="outline"
              leftIcon={<FaMapMarkerAlt />}
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      setSimpleGeocoding(prev => ({
                        ...prev,
                        lat: position.coords.latitude.toFixed(6),
                        lon: position.coords.longitude.toFixed(6)
                      }));
                      toast.success('Ubicación actual obtenida');
                    },
                    (error) => {
                      console.error('Error obteniendo ubicación:', error);
                      toast.error('No se pudo obtener la ubicación actual');
                    }
                  );
                } else {
                  toast.error('Geolocalización no disponible en este navegador');
                }
              }}
              disabled={simpleGeocoding.isLoading}
            >
              Usar Ubicación Actual
            </Button>

            {(simpleGeocoding.result || simpleGeocoding.error) && (
              <Button
                variant="outline"
                leftIcon={<FaTimes />}
                onClick={clearSimpleResults}
                disabled={simpleGeocoding.isLoading}
              >
                Limpiar
              </Button>
            )}
          </Flex>

          {/* Resultado de Geocodificación Simple */}
          {simpleGeocoding.result && (
            <Card className="mt-4">
              <h4 className="font-semibold text-lg mb-3 flex items-center">
                <FaCheck className="mr-2 text-green-500" />
                Resultado de Geocodificación
              </h4>
              
              {simpleGeocoding.result.status === 'success' ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="font-medium text-green-800 mb-2">
                      {simpleGeocoding.result.location.display_name}
                    </div>
                    <div className="text-sm text-green-600 space-y-1">
                      <div><strong>Ciudad:</strong> {simpleGeocoding.result.location.city || 'N/A'}</div>
                      <div><strong>Estado/Provincia:</strong> {simpleGeocoding.result.location.state || 'N/A'}</div>
                      <div><strong>País:</strong> {simpleGeocoding.result.location.country || 'N/A'}</div>
                      <div><strong>Código de País:</strong> {simpleGeocoding.result.location.country_code || 'N/A'}</div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <strong>Coordenadas:</strong> {simpleGeocoding.result.coordinates.lat.toFixed(6)}, {simpleGeocoding.result.coordinates.lon.toFixed(6)}
                  </div>
                  
                  {/* Mostrar información de la fuente de datos */}
                  {simpleGeocoding.result.data_source && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-blue-800 mb-1">
                        Fuente de Datos
                      </div>
                      <div className="text-sm text-blue-600">
                        {simpleGeocoding.result.data_source.description}
                      </div>
                      <div className="text-xs text-blue-500 mt-1">
                        Tipo: {simpleGeocoding.result.data_source.type}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="warning">
                  <FaExclamationTriangle className="mr-2" />
                  {simpleGeocoding.result.message || 'No se encontró información para estas coordenadas'}
                </Alert>
              )}
            </Card>
          )}

          {/* Error de Geocodificación Simple */}
          {simpleGeocoding.error && (
            <Alert variant="danger">
              <FaTimes className="mr-2" />
              <strong>Error:</strong> {simpleGeocoding.error}
            </Alert>
          )}
        </div>
      </Section>

      {/* Configuración de Prueba */}
      <Section title="Configuración de Prueba" variant="card" className="mb-6">
        <Grid cols={2} gap={4}>
          <div>
            <h4 className="font-semibold mb-3">Ubicación de Prueba</h4>
            <Stack gap={3}>
              <Input
                label="Latitud"
                type="number"
                step="any"
                value={testLocation.lat}
                onChange={(e) => setTestLocation(prev => ({
                  ...prev,
                  lat: e.target.value
                }))}
                placeholder="40.7589"
              />
              
              <Input
                label="Longitud"
                type="number"
                step="any"
                value={testLocation.lon}
                onChange={(e) => setTestLocation(prev => ({
                  ...prev,
                  lon: e.target.value
                }))}
                placeholder="-73.9851"
              />

              <Input
                label="Nombre (opcional)"
                value={testLocation.name}
                onChange={(e) => setTestLocation(prev => ({
                  ...prev,
                  name: e.target.value
                }))}
                placeholder="Times Square, NYC"
              />

              <Button
                variant="outline"
                leftIcon={<FaMapMarkerAlt />}
                onClick={useCurrentLocation}
                size="sm"
              >
                Usar Ubicación Actual
              </Button>
            </Stack>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Configuración de Prueba</h4>
            <Stack gap={3}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Radio de búsqueda (km)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={testConfig.radius}
                  onChange={(e) => setTestConfig(prev => ({
                    ...prev,
                    radius: parseFloat(e.target.value) || 5.0
                  }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Prueba
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={testConfig.testType}
                  onChange={(e) => setTestConfig(prev => ({
                    ...prev,
                    testType: e.target.value
                  }))}
                >
                  <option value="both">Ambos (Online y Offline)</option>
                  <option value="online">Solo Online (Nominatim)</option>
                  <option value="offline">Solo Offline (SQLite)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máximo de resultados
                </label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={testConfig.maxResults}
                  onChange={(e) => setTestConfig(prev => ({
                    ...prev,
                    maxResults: parseInt(e.target.value) || 50
                  }))}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="generateGrid"
                  checked={testConfig.generateGrid}
                  onChange={(e) => setTestConfig(prev => ({
                    ...prev,
                    generateGrid: e.target.checked
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="generateGrid" className="ml-2 text-sm text-gray-700">
                  Generar grilla de puntos
                </label>
              </div>
            </Stack>
          </div>
        </Grid>
      </Section>

      {/* Explicación de las Pruebas */}
      <Section title="¿Qué hace cada prueba?" variant="card" className="mb-6">
        <Grid cols={1} gap={4}>
          <Alert variant="info">
            <FaWifi className="mr-2" />
            <div>
              <strong>Geocodificación Online (Nominatim):</strong> Utiliza la API de OpenStreetMap Nominatim 
              para convertir coordenadas en direcciones. Requiere conexión a internet y puede tener 
              límites de velocidad, pero ofrece los datos más actualizados y completos.
            </div>
          </Alert>

          <Alert variant="success">
            <FaDatabase className="mr-2" />
            <div>
              <strong>Base de Datos Offline (SQLite):</strong> Utiliza una base de datos SQLite local 
              con datos pre-descargados para funcionar sin conexión a internet. Más rápida y optimizada 
              para búsquedas por proximidad geográfica. Los datos se descargan automáticamente durante los viajes.
            </div>
          </Alert>

          <Alert variant="warning">
            <FaInfoCircle className="mr-2" />
            <div>
              <strong>Grilla de Puntos:</strong> Cuando está habilitada, la prueba genera múltiples 
              puntos alrededor de la ubicación especificada para probar la cobertura y rendimiento 
              del sistema de geocodificación en un área específica.
            </div>
          </Alert>
        </Grid>
      </Section>

      {/* Controles de Prueba */}
      <Section title="Ejecutar Prueba" variant="card" className="mb-6">
        <Flex gap={3} wrap>
          {!isLoading ? (
            <Button
              variant="primary"
              leftIcon={<FaPlay />}
              onClick={runGeocodingTest}
              disabled={!testLocation.lat || !testLocation.lon}
            >
              Iniciar Prueba
            </Button>
          ) : (
            <Button
              variant="danger"
              leftIcon={<FaStop />}
              onClick={stopTest}
            >
              Detener Prueba
            </Button>
          )}

          <Button
            variant="outline"
            leftIcon={<FaSync />}
            onClick={clearResults}
            disabled={isLoading}
          >
            Limpiar Resultados
          </Button>

          {testResults && (
            <Button
              variant="outline"
              leftIcon={<FaDownload />}
              onClick={downloadResults}
              disabled={isLoading}
            >
              Descargar Resultados
            </Button>
          )}
        </Flex>

        {/* Progreso */}
        {isLoading && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                {progress.phase} - {progress.details}
              </span>
              <span className="text-sm text-gray-500">
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, (progress.current / progress.total) * 100)}%` 
                }}
              ></div>
            </div>
          </div>
        )}
      </Section>

      {/* Resultados de las Pruebas */}
      {testResults && (
        <Section title="Resultados de las Pruebas" variant="card">
          <Grid cols={1} gap={4}>
            {/* Resumen General */}
            <Card>
              <h4 className="font-semibold text-lg mb-3 flex items-center">
                <FaInfoCircle className="mr-2 text-blue-500" />
                Resumen General
              </h4>
              <Grid cols={2} gap={4}>
                <div>
                  <p className="text-sm text-gray-600">Ubicación probada:</p>
                  <p className="font-medium">{testResults.location_name || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-500">
                    {testResults.coordinates?.lat?.toFixed(6)}, {testResults.coordinates?.lon?.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duración total:</p>
                  <p className="font-medium">{testResults.total_duration || 'N/A'}s</p>
                  <p className="text-xs text-gray-500">
                    Radio: {testResults.radius_km || testConfig.radius}km
                  </p>
                </div>
              </Grid>
            </Card>

            {/* Resultados Online */}
            {testResults.online_results && (
              <Card>
                <h4 className="font-semibold text-lg mb-3 flex items-center">
                  <FaGlobe className="mr-2 text-green-500" />
                  Resultados Online
                  <Badge 
                    variant={testResults.online_results.success ? "success" : "danger"} 
                    className="ml-2"
                  >
                    {testResults.online_results.success ? "Exitoso" : "Fallido"}
                  </Badge>
                </h4>
                
                <Grid cols={3} gap={4} className="mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {testResults.online_results.response_time || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">Tiempo de respuesta (s)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.online_results.points_processed || 0}
                    </div>
                    <div className="text-sm text-gray-500">Puntos procesados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {testResults.online_results.results_found || 0}
                    </div>
                    <div className="text-sm text-gray-500">Resultados encontrados</div>
                  </div>
                </Grid>

                {testResults.online_results.error && (
                  <Alert variant="danger">
                    <FaTimes className="mr-2" />
                    Error: {testResults.online_results.error}
                  </Alert>
                )}

                {testResults.online_results.sample_results && testResults.online_results.sample_results.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium mb-2">Muestra de resultados:</h5>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {testResults.online_results.sample_results.slice(0, 5).map((result, index) => (
                        <div key={index} className="py-2 border-b border-gray-200 last:border-b-0">
                          <div className="font-medium text-sm">{result.display_name || result.address}</div>
                          <div className="text-xs text-gray-500">
                            {result.lat?.toFixed(6)}, {result.lon?.toFixed(6)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Resultados Offline */}
            {testResults.offline_results && (
              <Card>
                <h4 className="font-semibold text-lg mb-3 flex items-center">
                  <FaDatabase className="mr-2 text-blue-500" />
                  Resultados Offline (Base de Datos SQLite)
                  <Badge 
                    variant={testResults.offline_results.success ? "success" : "danger"} 
                    className="ml-2"
                  >
                    {testResults.offline_results.success ? "Exitoso" : "Fallido"}
                  </Badge>
                </h4>
                
                <Grid cols={3} gap={4} className="mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {testResults.offline_results.response_time || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">Tiempo de respuesta (s)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.offline_results.points_processed || 0}
                    </div>
                    <div className="text-sm text-gray-500">Puntos procesados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {testResults.offline_results.database_records || 0}
                    </div>
                    <div className="text-sm text-gray-500">Registros en BD</div>
                  </div>
                </Grid>

                {testResults.offline_results.error && (
                  <Alert variant="danger">
                    <FaTimes className="mr-2" />
                    Error: {testResults.offline_results.error}
                  </Alert>
                )}

                {testResults.offline_results.sample_results && testResults.offline_results.sample_results.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium mb-2">Muestra de resultados offline:</h5>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {testResults.offline_results.sample_results.slice(0, 5).map((result, index) => (
                        <div key={index} className="py-2 border-b border-gray-200 last:border-b-0">
                          <div className="font-medium text-sm">{result.address || result.location}</div>
                          <div className="text-xs text-gray-500">
                            {result.lat?.toFixed(6)}, {result.lon?.toFixed(6)}
                          </div>
                          {result.source && (
                            <div className="text-xs text-blue-500 mt-1">
                              Fuente: {result.source}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Comparación de Rendimiento */}
            {testResults.online_results && testResults.offline_results && (
              <Card>
                <h4 className="font-semibold text-lg mb-3 flex items-center">
                  <FaCog className="mr-2 text-orange-500" />
                  Comparación de Rendimiento
                </h4>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Velocidad de respuesta:</span>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-green-600">Online</div>
                        <div className="text-lg">{testResults.online_results.response_time || 'N/A'}s</div>
                      </div>
                      <span className="text-gray-400">vs</span>
                      <div className="text-center">
                        <div className="text-sm font-medium text-blue-600">Offline</div>
                        <div className="text-lg">{testResults.offline_results.response_time || 'N/A'}s</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Cobertura de datos:</span>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-green-600">Online</div>
                        <div className="text-lg">{testResults.online_results.results_found || 0}</div>
                      </div>
                      <span className="text-gray-400">vs</span>
                      <div className="text-center">
                        <div className="text-sm font-medium text-blue-600">Offline</div>
                        <div className="text-lg">{testResults.offline_results.database_records || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Recomendaciones */}
                  <Alert variant="info">
                    <FaInfoCircle className="mr-2" />
                    <div>
                      <strong>Recomendación:</strong>
                      {parseFloat(testResults.offline_results.response_time || 0) < parseFloat(testResults.online_results.response_time || 0) ? (
                        " La geocodificación offline es más rápida para esta ubicación."
                      ) : (
                        " La geocodificación online ofrece mejor rendimiento para esta ubicación."
                      )}
                      {(testResults.online_results.results_found || 0) > (testResults.offline_results.database_records || 0) ? (
                        " Online tiene mejor cobertura de datos."
                      ) : (
                        " Offline tiene cobertura de datos suficiente."
                      )}
                    </div>
                  </Alert>
                </div>
              </Card>
            )}

            {/* Información Técnica */}
            <Card>
              <h4 className="font-semibold text-lg mb-3 flex items-center">
                <FaCog className="mr-2 text-gray-500" />
                Información Técnica
              </h4>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            </Card>
          </Grid>
        </Section>
      )}
    </PageLayout>
  );
};

export default GeocodingTester;
