import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { 
  FaBars, FaTimes, FaDesktop, FaMobileAlt, FaRaspberryPi, 
  FaCar, FaMap, FaCalendarAlt, FaHdd, FaMapMarkerAlt, 
  FaRoute, FaArrowRight, FaTachometerAlt, FaStop, FaPlay,
  FaClock, FaThermometerHalf, FaMemory, FaMicrochip, FaMicrophone, FaMicrophoneSlash
} from 'react-icons/fa'

// Importar los componentes individuales del Dashboard
import {
  AlertBanner,
  ActiveTripBanner,
  CameraView,
  LocationInfo,
  QuickNavigation,
  RecordingControls,
  SimplifiedView,
  StreamingModeSelector,
  SystemStatus,
  TripStats
} from '../components/Dashboard'

// Crear una instancia de axios con configuración global
const axiosInstance = axios.create({
  timeout: 10000, // Aumentamos el timeout a 10 segundos
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

// Controlador para limitar las solicitudes simultáneas al servidor
const RequestController = {
  activeRequests: 0,
  maxSimultaneousRequests: 2, // Limitar a 2 solicitudes simultáneas
  queue: [],
  
  async executeRequest(requestFn) {
    // Si hay demasiadas solicitudes, poner en cola
    if (this.activeRequests >= this.maxSimultaneousRequests) {
      return new Promise((resolve, reject) => {
        this.queue.push({ requestFn, resolve, reject });
      });
    }
    
    // Ejecutar la solicitud
    try {
      this.activeRequests++;
      return await requestFn();
    } finally {
      this.activeRequests--;
      this._processQueue();
    }
  },
  
  _processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.maxSimultaneousRequests) {
      const { requestFn, resolve, reject } = this.queue.shift();
      
      // Ejecutar solicitud desde la cola
      this.executeRequest(requestFn).then(resolve).catch(reject);
    }
  },
  
  // Cancelar solicitudes en cola (por ejemplo, al cambiar de página)
  clearQueue() {
    this.queue.forEach(item => {
      item.reject(new Error('Request cancelled - page change'));
    });
    this.queue = [];
  }
};

function Dashboard() {
  const navigate = useNavigate();
  const [location, setLocation] = useState({ lat: 0, lon: 0, speed: 0 })
  const [landmark, setLandmark] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  
  // Estado para modo de streaming (0: MJPEG, 1: WebRTC, 2: HTTP)
  const [streamingMode, setStreamingMode] = useState(0) // Establecido a 0 (MJPEG) por defecto
  
  // Estado para detección de Raspberry Pi
  const [isRaspberryPi, setIsRaspberryPi] = useState(false)
  
  // Estado para modo simplificado (pantalla grande)
  const [simplifiedView, setSimplifiedView] = useState(false)

  // Estado para el elemento actual en la vista simplificada
  const [currentSlide, setCurrentSlide] = useState(0)
  
  // Estado para controlar la visualización de estadísticas de rendimiento
  const [showPerformanceStats, setShowPerformanceStats] = useState(false)
  
  // Mantenemos el estado de cameraImages para fallback si MJPEG falla
  const [cameraImages, setCameraImages] = useState({
    road: null,
    interior: null
  })
  
  const [systemStatus, setSystemStatus] = useState({
    cpu_usage: 0,
    memory_usage: 0,
    cpu_temp: 0,
    storage: {
      available: 0,
      total: 0,
      percent_used: 0
    },
    uptime: '',
    version: '',
    throttling: false,
    throttling_reason: '',
    last_update: null
  })
  const [activeTrip, setActiveTrip] = useState(null)
  const [tripStats, setTripStats] = useState({
    recent_trips: []
  })
  
  // Camera status
  const [cameraStatus, setCameraStatus] = useState({
    road_camera: true,
    interior_camera: true,
    errors: []
  })

  // Estado para errores de MJPEG
  const [webrtcErrors, setWebrtcErrors] = useState({
    road: false,
    interior: false
  })
  
  // Add state for tracking image load errors
  const [imageErrors, setImageErrors] = useState({
    road: false,
    interior: false
  })
  
  // Estado para controlar la actualización manual de imágenes
  const [isRefreshing, setIsRefreshing] = useState({
    road: false,
    interior: false
  })
  
  // Refs for tracking connection attempts
  const connectionAttempts = useRef({
    road: 0,
    interior: 0
  })
  
  // Interval refs for cleanup
  const refreshIntervals = useRef({
    road: null,
    interior: null
  })

  // Estado para controlar la visibilidad de la barra de navegación en modo simplificado
  const [showNavbar, setShowNavbar] = useState(false);
  
  // Función para mostrar/ocultar la barra de navegación
  const toggleNavbar = () => {
    setShowNavbar(!showNavbar);
  };

  // Manejador de errores de streaming
  const handleStreamError = (cameraType, error) => {
    console.error(`Error de streaming ${streamingMode === 0 ? 'MJPEG' : 'WebRTC'} para cámara ${cameraType}:`, error);
    setWebrtcErrors(prev => ({
      ...prev,
      [cameraType]: true
    }));
    
    // Si el modo actual falla, volver al método de fallback (HTTP)
    if (streamingMode === 0 || streamingMode === 1) {
      console.log(`Fallback a streaming HTTP para cámara ${cameraType}`);
      // Cambiar temporalmente al modo HTTP para esta sesión
      setStreamingMode(2);
      // Iniciar carga de imágenes como fallback
      loadCameraFrame(cameraType);
    }
  };

  // Limpiar las solicitudes al desmontar el componente
  useEffect(() => {
    return () => {
      // Limpiar intervalos
      if (refreshIntervals.current.road) {
        clearInterval(refreshIntervals.current.road);
      }
      if (refreshIntervals.current.interior) {
        clearInterval(refreshIntervals.current.interior);
      }
      
      // Limpiar colas de solicitudes
      RequestController.clearQueue();
      
      // Liberar URLs de objetos de imagen
      if (cameraImages.road) {
        URL.revokeObjectURL(cameraImages.road);
      }
      if (cameraImages.interior) {
        URL.revokeObjectURL(cameraImages.interior);
      }
    };
  }, []);

  // Inicializar la aplicación de forma escalonada
  useEffect(() => {
    // Primero cargamos solo información del sistema
    fetchSystemStatus();
    
    // Si estamos en modo HTTP, cargar las imágenes tradicionales
    if (streamingMode === 2) {
      // Retrasar la carga de imágenes de cámaras
      const delayedCameraInit = setTimeout(() => {
        refreshCameraFrames();
      }, 1000); // Retrasar 1 segundo
      
      return () => {
        clearTimeout(delayedCameraInit);
      };
    }
    
    // Cargar datos de grabación después
    const delayedRecordingStatus = setTimeout(() => {
      fetchRecordingStatus();
    }, 2000); // Retrasar 2 segundos
    
    // Cargar estadísticas de viaje después
    const delayedTripStats = setTimeout(() => {
      fetchTripStats();
    }, 3000); // Retrasar 3 segundos
    
    // Configurar intervalos para actualizaciones periódicas
    const statsInterval = setInterval(() => {
      fetchSystemStatus();
    }, 10000); // Cada 10 segundos
    
    return () => {
      // Limpiar todos los timeouts e intervalos
      clearTimeout(delayedRecordingStatus);
      clearTimeout(delayedTripStats);
      clearInterval(statsInterval);
    };
  }, [streamingMode]);
  
  // Función para obtener el estado de grabación
  const fetchRecordingStatus = async () => {
    try {
      const response = await RequestController.executeRequest(() =>
        axiosInstance.get('/api/recording/status')
      );
      setIsRecording(response.data.recording);
      setIsMicEnabled(response.data.mic_enabled !== undefined ? response.data.mic_enabled : true);
    } catch (error) {
      console.error('Error fetching recording status:', error);
    }
  };
  
  // Función actualizada para obtener el estado del sistema
  const fetchSystemStatus = async () => {
    try {
      const response = await RequestController.executeRequest(() =>
        axiosInstance.get('/api/system/status')
      );
      
      if (response.data.camera_status) {
        setCameraStatus(response.data.camera_status);
      }
      
      if (response.data.system_stats) {
        // Actualizamos con datos recibidos y añadimos timestamp
        setSystemStatus(prevStatus => ({
          ...prevStatus,
          ...response.data.system_stats,
          last_update: new Date().toISOString()
        }));
        
        // Verificar si el sistema está sobrecargado
        const stats = response.data.system_stats;
        const isThrottling = 
          stats.cpu_usage > 90 || 
          stats.memory_usage > 90 || 
          stats.cpu_temp > 80;
        
        if (isThrottling && !response.data.system_stats.throttling) {
          // Actualizar indicador de throttling con razón
          let reason = [];
          if (stats.cpu_usage > 90) reason.push("CPU sobrecargada");
          if (stats.memory_usage > 90) reason.push("Memoria agotada");
          if (stats.cpu_temp > 80) reason.push("Temperatura crítica");
          
          setSystemStatus(prevStatus => ({
            ...prevStatus,
            throttling: true,
            throttling_reason: reason.join(", ")
          }));
          
          // Añadir advertencia a los errores del sistema
          setCameraStatus(prevStatus => {
            const updatedErrors = [...prevStatus.errors];
            const warningMsg = `Rendimiento reducido: ${reason.join(", ")}`;
            
            if (!updatedErrors.includes(warningMsg)) {
              updatedErrors.push(warningMsg);
            }
            
            return {
              ...prevStatus,
              errors: updatedErrors
            };
          });
        } else if (!isThrottling && response.data.system_stats.throttling) {
          // Si ya no hay throttling, actualizar estado y quitar la advertencia
          setSystemStatus(prevStatus => ({
            ...prevStatus,
            throttling: false,
            throttling_reason: ''
          }));
          
          // Quitar advertencia de los errores del sistema
          setCameraStatus(prevStatus => ({
            ...prevStatus,
            errors: prevStatus.errors.filter(e => !e.includes("Rendimiento reducido"))
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
      
      // Verificar si han pasado más de 30 segundos desde la última actualización
      if (systemStatus.last_update) {
        const lastUpdate = new Date(systemStatus.last_update);
        const now = new Date();
        const timeDiff = (now - lastUpdate) / 1000; // en segundos
        
        if (timeDiff > 30) {
          // Añadir advertencia de que los datos pueden estar desactualizados
          setCameraStatus(prevStatus => {
            const updatedErrors = [...prevStatus.errors];
            const warningMsg = `Datos del sistema desactualizados (${Math.floor(timeDiff)}s)`;
            
            // Reemplazar mensaje existente o añadir uno nuevo
            const existingIndex = updatedErrors.findIndex(e => e.includes("Datos del sistema desactualizados"));
            if (existingIndex >= 0) {
              updatedErrors[existingIndex] = warningMsg;
            } else {
              updatedErrors.push(warningMsg);
            }
            
            return {
              ...prevStatus,
              errors: updatedErrors
            };
          });
        }
      }
    }
  };
  
  // Función para obtener estadísticas de viaje
  const fetchTripStats = async () => {
    try {
      const response = await RequestController.executeRequest(() =>
        axiosInstance.get('/api/trips/stats')
      );
      setTripStats(response.data);
    } catch (error) {
      console.error('Error fetching trip stats:', error);
    }
  };
  
  // Check for active planned trip
  useEffect(() => {
    const savedTrip = localStorage.getItem('activeTrip')
    if (savedTrip) {
      try {
        setActiveTrip(JSON.parse(savedTrip))
      } catch (e) {
        console.error('Error parsing saved trip:', e)
      }
    }
  }, [])

  // Setup WebSocket for real-time updates
  useEffect(() => {
    let ws = null;
    
    // Retrasar la conexión WebSocket para no competir con otras solicitudes iniciales
    const wsTimeout = setTimeout(() => {
      try {
        ws = new WebSocket(`ws://${window.location.hostname}:8000/ws`);
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check if this is the new status_update message type
            if (data.type === 'status_update') {
              // Update location and speed
              if (data.location) {
                setLocation(data.location);
              }
              
              // Update nearby landmark
              if (data.landmark) {
                setLandmark(data.landmark);
              }
              
              // Update recording status
              if (data.recording !== undefined) {
                setIsRecording(data.recording);
              }
              
              // Update microphone status
              if (data.mic_enabled !== undefined) {
                setIsMicEnabled(data.mic_enabled);
              }
              
              // Update camera status
              if (data.camera_status) {
                setCameraStatus(data.camera_status);
              }
              
              // Update system stats with timestamp
              if (data.system_stats) {
                updateSystemStatus(data.system_stats);
              }
            } 
            else {
              // Handle legacy message format
              if (data.location) {
                setLocation(data.location);
              }
              
              if (data.landmark) {
                setLandmark(data.landmark);
              }
              
              if (data.recording !== undefined) {
                setIsRecording(data.recording);
              }
              
              if (data.mic_enabled !== undefined) {
                setIsMicEnabled(data.mic_enabled);
              }
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };
      } catch (e) {
        console.error('Error setting up WebSocket:', e);
      }
    }, 4000); // Retrasar 4 segundos
    
    return () => {
      clearTimeout(wsTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);
  
  // Función auxiliar para actualizar el estado del sistema con los datos del WebSocket
  const updateSystemStatus = (systemStats) => {
    // Actualizar datos del sistema recibidos vía WebSocket con marca de tiempo
    setSystemStatus(prevStatus => ({
      ...prevStatus,
      ...systemStats,
      last_update: new Date().toISOString()
    }));
    
    // Verificar si el sistema está sobrecargado
    const isThrottling = 
      systemStats.cpu_usage > 90 || 
      systemStats.memory_usage > 90 || 
      systemStats.cpu_temp > 80;
    
    if (isThrottling && !systemStats.throttling) {
      // Actualizar indicador de throttling con razón
      let reason = [];
      if (systemStats.cpu_usage > 90) reason.push("CPU sobrecargada");
      if (systemStats.memory_usage > 90) reason.push("Memoria agotada");
      if (systemStats.cpu_temp > 80) reason.push("Temperatura crítica");
      
      setSystemStatus(prevStatus => ({
        ...prevStatus,
        throttling: true,
        throttling_reason: reason.join(", ")
      }));
      
      // Añadir advertencia a los errores del sistema
      setCameraStatus(prevStatus => {
        const updatedErrors = [...prevStatus.errors];
        const warningMsg = `Rendimiento reducido: ${reason.join(", ")}`;
        
        if (!updatedErrors.includes(warningMsg)) {
          updatedErrors.push(warningMsg);
        }
        
        return {
          ...prevStatus,
          errors: updatedErrors
        };
      });
    } else if (!isThrottling && systemStats.throttling) {
      // Si ya no hay throttling, actualizar estado y quitar la advertencia
      setSystemStatus(prevStatus => ({
        ...prevStatus,
        throttling: false,
        throttling_reason: ''
      }));
      
      // Quitar advertencia de los errores del sistema
      setCameraStatus(prevStatus => ({
        ...prevStatus,
        errors: prevStatus.errors.filter(e => !e.includes("Rendimiento reducido"))
      }));
    }
  };

  // Detectar si se está accediendo desde un Raspberry Pi
  useEffect(() => { 
    // Detectar Raspberry Pi basado en el User Agent o en la resolución de pantalla
    const checkIfRaspberryPi = () => { 
      // Verificar si el hostname contiene "raspberrypi" o "pi"
      const isRpiHostname = window.location.hostname.includes('raspberrypi') || 
                           window.location.hostname.includes('pi');
      
      // Verificar si es una pantalla táctil o tiene resolución típica de Raspberry Pi display
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      
      // Resoluciones comunes de pantallas para Raspberry Pi
      const isRpiDisplay = 
        (screenWidth === 800 && screenHeight === 480) || // Display oficial de 7"
        (screenWidth === 480 && screenHeight === 320) || // Display de 3.5"
        (screenWidth === 1024 && screenHeight === 600); // Pantallas táctiles comunes
      
      return isRpiHostname || isRpiDisplay;
    };
    
    const isRpi = checkIfRaspberryPi();
    setIsRaspberryPi(isRpi);
    
    // Por defecto, activar el modo simplificado si se detecta que es un Raspberry Pi
    if (isRpi) {
      setSimplifiedView(true);
    }
  }, []);

  // Función para cargar un único fotograma
  const loadCameraFrame = async (cameraType) => {
    if ((cameraType === 'road' && !cameraStatus.road_camera) || 
        (cameraType === 'interior' && !cameraStatus.interior_camera) ||
        isRefreshing[cameraType]) {
      return;
    }
    
    // Indicar que estamos actualizando
    setIsRefreshing(prev => ({
      ...prev,
      [cameraType]: true
    }));
    
    const timestamp = new Date().getTime();
    const url = `/api/cameras/${cameraType}/frame?t=${timestamp}`;
    
    try {
      // Usar RequestController para limitar solicitudes simultáneas
      const response = await RequestController.executeRequest(() => 
        axiosInstance.get(url, { responseType: 'blob' })
      );
      
      // Liberar URL anterior para evitar fugas de memoria
      if (cameraImages[cameraType]) {
        URL.revokeObjectURL(cameraImages[cameraType]);
      }
      
      const imageUrl = URL.createObjectURL(response.data);
      
      setCameraImages(prev => ({
        ...prev,
        [cameraType]: imageUrl
      }));
      
      // Reiniciar contador de intentos
      connectionAttempts.current[cameraType] = 0;
      
      // Reiniciar error
      setImageErrors(prev => ({
        ...prev,
        [cameraType]: false
      }));
    } catch (error) {
      console.error(`Error loading ${cameraType} camera frame:`, error);
      
      // Incrementar contador de intentos
      connectionAttempts.current[cameraType]++;
      
      // Después de 5 errores, marcar la cámara como no disponible
      if (connectionAttempts.current[cameraType] >= 5) {
        setCameraStatus(prev => {
          const updatedErrors = [...prev.errors];
          const errorMsg = `${cameraType === 'road' ? 'Road' : 'Interior'} camera not responding`;
          
          if (!updatedErrors.includes(errorMsg)) {
            updatedErrors.push(errorMsg);
          }
          
          return {
            ...prev,
            [`${cameraType}_camera`]: false,
            errors: updatedErrors
          };
        });
        
        // Detener el intervalo para esta cámara
        if (refreshIntervals.current[cameraType]) {
          clearInterval(refreshIntervals.current[cameraType]);
          refreshIntervals.current[cameraType] = null;
        }
      } else {
        // Si no hemos excedido el máximo de intentos, reintentar después de un breve retraso
        // usando un tiempo exponencial entre reintentos
        const retryDelay = Math.min(2000, 500 * Math.pow(2, connectionAttempts.current[cameraType] - 1));
        console.log(`Reintentando carga de cámara ${cameraType} en ${retryDelay}ms (intento ${connectionAttempts.current[cameraType]})`);
        
        setTimeout(() => {
          if (!document.hidden) { // Solo cargar si la página está visible
            setIsRefreshing(prev => ({
              ...prev,
              [cameraType]: false
            }));
            loadCameraFrame(cameraType);
          }
        }, retryDelay);
      }
      
      setImageErrors(prev => ({
        ...prev,
        [cameraType]: true
      }));
    } finally {
      // Asegurar que isRefreshing se reinicia eventualmente (excepto en caso de reintento)
      if (connectionAttempts.current[cameraType] === 0 || connectionAttempts.current[cameraType] >= 5) {
        setIsRefreshing(prev => ({
          ...prev,
          [cameraType]: false
        }));
      }
    }
  };
  
  // Función para actualizar las imágenes de la cámara con fotogramas únicos
  const refreshCameraFrames = () => {
    // Limpiar los intervalos existentes
    if (refreshIntervals.current.road) {
      clearInterval(refreshIntervals.current.road);
    }
    if (refreshIntervals.current.interior) {
      clearInterval(refreshIntervals.current.interior);
    }
    
    // Cargar primero la cámara de carretera
    if (cameraStatus.road_camera) {
      loadCameraFrame('road');
      
      // Configurar intervalo con un retraso
      setTimeout(() => {
        refreshIntervals.current.road = setInterval(() => {
          if (!document.hidden && !isRefreshing.road) {
            loadCameraFrame('road');
          }
        }, 3000); // Actualizar cada 3 segundos
      }, 500);
    }
    
    // Cargar la cámara interior con un retraso
    if (cameraStatus.interior_camera) {
      // Retrasar la carga de la segunda cámara para no saturar el servidor
      setTimeout(() => {
        loadCameraFrame('interior');
        
        // Configurar intervalo
        setTimeout(() => {
          refreshIntervals.current.interior = setInterval(() => {
            if (!document.hidden && !isRefreshing.interior) {
              loadCameraFrame('interior');
            }
          }, 3000); // Actualizar cada 3 segundos
        }, 500);
      }, 1500); // Retrasar 1.5 segundos después de la cámara de carretera
    }
  };
  
  // Función para forzar la recarga manual de una cámara
  const manualRefreshCamera = (cameraType) => {
    // Reiniciar estado de la cámara
    if (cameraType === 'road' || cameraType === 'all') {
      connectionAttempts.current.road = 0;
      setCameraStatus(prev => ({
        ...prev,
        road_camera: true,
        errors: prev.errors.filter(e => !e.includes('Road camera'))
      }));
      
      if (refreshIntervals.current.road) {
        clearInterval(refreshIntervals.current.road);
      }
      
      loadCameraFrame('road');
      
      refreshIntervals.current.road = setInterval(() => {
        if (!document.hidden && !isRefreshing.road) {
          loadCameraFrame('road');
        }
      }, 3000);
    }
    
    if (cameraType === 'interior' || cameraType === 'all') {
      connectionAttempts.current.interior = 0;
      setCameraStatus(prev => ({
        ...prev,
        interior_camera: true,
        errors: prev.errors.filter(e => !e.includes('Interior camera'))
      }));
      
      if (refreshIntervals.current.interior) {
        clearInterval(refreshIntervals.current.interior);
      }
      
      // Retrasar ligeramente para no coincidir con la cámara de carretera
      setTimeout(() => {
        loadCameraFrame('interior');
        
        refreshIntervals.current.interior = setInterval(() => {
          if (!document.hidden && !isRefreshing.interior) {
            loadCameraFrame('interior');
          }
        }, 3000);
      }, 750);
    }
  };

  // Function to start recording
  const startRecording = async () => {
    // Check if we have an active planned trip
    const payload = activeTrip ? { planned_trip_id: activeTrip.id } : {};
    
    try {
      const response = await RequestController.executeRequest(() =>
        axiosInstance.post('/api/recording/start', payload)
      );
      
      if (response.data.status === 'success') {
        console.log('Recording started:', response.data);
        setIsRecording(true);
      } else if (response.data.status === 'error') {
        console.error('Failed to start recording:', response.data.message);
        // Show error message to the user
        alert(`Failed to start recording: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error starting recording. Check camera connections.');
    }
  };

  // Function to stop recording
  const stopRecording = async () => {
    try {
      const response = await RequestController.executeRequest(() =>
        axiosInstance.post('/api/recording/stop')
      );
      
      console.log('Recording stopped:', response.data);
      setIsRecording(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  // Function to toggle microphone
  const toggleMicrophone = async () => {
    try {
      await RequestController.executeRequest(() =>
        axiosInstance.post('/api/recording/toggle-mic', { enabled: !isMicEnabled })
      );
      
      setIsMicEnabled(!isMicEnabled);
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  };
  
  // Function to start navigation with active trip
  const startNavigation = () => {
    if (activeTrip) {
      navigate('/map');
    }
  };
  
  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '-- Bytes'
    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    // Manejo seguro para evitar errores de cálculo
    if (i < 0 || i >= sizes.length || !isFinite(bytes / Math.pow(k, i))) {
      return bytes + ' Bytes'
    }
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }
  
  // Format seconds to hours:minutes:seconds
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Función para cambiar entre modos de streaming (MJPEG, WebRTC, HTTP)
  const toggleStreamingMode = () => {
    // Rotar entre MJPEG (0) -> WebRTC (1) -> HTTP (2) -> MJPEG (0)
    const newMode = (streamingMode + 1) % 3;
    
    // Limpieza específica según el modo anterior
    // Si estábamos en WebRTC y cambiamos a otro modo, cerrar conexiones WebRTC
    if (streamingMode === 1) {
      // Limpiar cualquier conexión WebRTC existente
      console.log('Cerrando conexiones WebRTC existentes...');
      // Reset errores WebRTC al cambiar de modo
      setWebrtcErrors({
        road: false,
        interior: false
      });
      
      // Solicitar al servidor que cierre las conexiones WebRTC
      try {
        axiosInstance.post('/api/webrtc/close_connections').catch(err => {
          console.error('Error cerrando conexiones WebRTC:', err);
        });
      } catch (e) {
        console.error('Error enviando solicitud para cerrar WebRTC:', e);
      }
    }
    
    // Actualizar estado
    setStreamingMode(newMode);
    
    // Limpiar cualquier intervalo existente de HTTP
    if (refreshIntervals.current.road) {
      clearInterval(refreshIntervals.current.road);
      refreshIntervals.current.road = null;
    }
    if (refreshIntervals.current.interior) {
      clearInterval(refreshIntervals.current.interior);
      refreshIntervals.current.interior = null;
    }
    
    // Si cambiamos a HTTP, iniciar la carga de fotogramas
    if (newMode === 2) {
      refreshCameraFrames();
    }
    
    // Mostrar mensaje al usuario
    setCameraStatus(prev => {
      const updatedErrors = [...prev.errors];
      
      // Eliminar mensajes anteriores sobre el modo de streaming
      const filteredErrors = updatedErrors.filter(e => 
        !e.includes('Modo de streaming cambiado') && 
        !e.includes('MJPEG') && 
        !e.includes('WebRTC') &&
        !e.includes('HTTP')
      );
      
      // Agregar mensaje sobre el modo actual
      let message = '';
      switch(newMode) {
        case 0:
          message = 'Modo cambiado a MJPEG: baja latencia con calidad razonable';
          break;
        case 1:
          message = 'Modo cambiado a WebRTC: conexión de alta calidad';
          break;
        case 2:
          message = 'Modo cambiado a HTTP: mejor estabilidad en conexiones débiles';
          break;
      }
      
      filteredErrors.push(message);
      
      return {
        ...prev,
        errors: filteredErrors
      };
    });
  };
  
  // Función para alternar la visualización de estadísticas de rendimiento
  const togglePerformanceStats = () => {
    setShowPerformanceStats(prev => !prev);
    
    // Mostrar mensaje al usuario
    setCameraStatus(prev => {
      const updatedErrors = [...prev.errors];
      
      // Eliminar mensajes anteriores sobre estadísticas
      const filteredErrors = updatedErrors.filter(e => 
        !e.includes('estadísticas de rendimiento')
      );
      
      // Agregar mensaje sobre el estado actual
      const message = showPerformanceStats 
        ? 'Estadísticas de rendimiento desactivadas'
        : 'Estadísticas de rendimiento activadas';
      
      filteredErrors.push(message);
      
      return {
        ...prev,
        errors: filteredErrors
      };
    });
  };

  // Función para cambiar a la siguiente tarjeta en modo simplificado
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev < 4 ? prev + 1 : 0));
  };

  // Función para cambiar a la tarjeta anterior en modo simplificado
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : 4));
  };

  // Función para alternar entre modo normal y simplificado
  const toggleSimplifiedView = () => {
    setSimplifiedView(!simplifiedView);
  };

  // Función para manejar el deslizamiento en pantallas táctiles
  const touchStartRef = useRef(null);
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    
    // Si el deslizamiento es significativo (más de 50px)
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Deslizamiento hacia la izquierda -> siguiente
        nextSlide();
      } else {
        // Deslizamiento hacia la derecha -> anterior
        prevSlide();
      }
    }
    
    touchStartRef.current = null;
  };

  return (
    <div className="p-2 sm:p-4 h-screen flex flex-col">
      {/* Controles principales en la parte superior */}
      <div className="flex justify-end mb-2 gap-2">
        {/* Botón para alternar entre los modos de streaming */}
        <StreamingModeSelector 
          streamingMode={streamingMode} 
          onToggleStreamingMode={toggleStreamingMode}
          showStats={showPerformanceStats}
          onToggleStats={togglePerformanceStats}
        />
        
        {/* Toggle between normal and simplified view - solo visible en Raspberry Pi */}
        {isRaspberryPi && (
          <button 
            onClick={toggleSimplifiedView}
            className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded-md text-sm"
          >
            {simplifiedView ? (
              <>
                <FaDesktop className="mr-1" /> Vista Normal
              </>
            ) : (
              <>
                <FaMobileAlt className="mr-1" /> Vista Simplificada
              </>
            )}
            <FaRaspberryPi className="ml-2 text-red-600" />
          </button>
        )}
      </div>
      
      {simplifiedView ? (
        <SimplifiedView
          streamingMode={streamingMode}
          cameraStatus={cameraStatus}
          cameraImages={cameraImages}
          isRefreshing={isRefreshing}
          webrtcErrors={webrtcErrors}
          location={location}
          landmark={landmark}
          isRecording={isRecording}
          isMicEnabled={isMicEnabled}
          activeTrip={activeTrip}
          systemStatus={systemStatus}
          tripStats={tripStats}
          currentSlide={currentSlide}
          showNavbar={showNavbar}
          handleStreamError={handleStreamError}
          manualRefreshCamera={manualRefreshCamera}
          startRecording={startRecording}
          stopRecording={stopRecording}
          toggleMicrophone={toggleMicrophone}
          startNavigation={startNavigation}
          nextSlide={nextSlide}
          prevSlide={prevSlide}
          toggleNavbar={toggleNavbar}
          toggleSimplifiedView={toggleSimplifiedView}
          handleTouchStart={handleTouchStart}
          handleTouchEnd={handleTouchEnd}
          formatBytes={formatBytes}
        />
      ) : (
        /* VISTA NORMAL - MEJORADA PARA RESPONSIVIDAD */
        <div>
          {/* System alerts */}
          <AlertBanner 
            errors={cameraStatus.errors} 
            onRefreshCameras={() => manualRefreshCamera('all')} 
          />
          
          {/* Active planned trip card */}
          {activeTrip && (
            <ActiveTripBanner 
              activeTrip={activeTrip} 
              onStartNavigation={startNavigation} 
            />
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {/* Main camera view */}
            <CameraView 
              cameraType="road"
              streamingMode={streamingMode}
              cameraStatus={cameraStatus}
              cameraImages={cameraImages}
              isRefreshing={isRefreshing}
              onRefresh={manualRefreshCamera}
              onError={handleStreamError}
              title="Cámara Frontal"
              showSpeedOverlay={true}
              speedData={location}
              landmarkData={landmark}
              isRecording={isRecording}
              showStats={showPerformanceStats}
            />
            
            {/* Interior camera view */}
            <CameraView 
              cameraType="interior"
              streamingMode={streamingMode}
              cameraStatus={cameraStatus}
              cameraImages={cameraImages}
              isRefreshing={isRefreshing}
              onRefresh={manualRefreshCamera}
              onError={handleStreamError}
              title="Cámara Interior"
              showSpeedOverlay={false}
              showStats={showPerformanceStats}
            />
          </div>
          
          {/* Controls & Quick stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {/* Recording controls */}
            <RecordingControls 
              isRecording={isRecording}
              isMicEnabled={isMicEnabled}
              activeTrip={activeTrip}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onToggleMicrophone={toggleMicrophone}
              onStartNavigation={startNavigation}
            />
            
            {/* Trip stats */}
            <TripStats tripStats={tripStats} />
            
            {/* Quick navigation */}
            <QuickNavigation />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {/* System health */}
            <SystemStatus 
              systemStatus={systemStatus}
              formatBytes={formatBytes}
            />
            
            {/* Location information */}
            <LocationInfo 
              location={location}
              landmark={landmark}
            />
          </div>
          
          <div className="text-xs text-gray-500 text-right mt-2"> 
            Versión del Sistema: {systemStatus.version || 'Desconocida'}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard