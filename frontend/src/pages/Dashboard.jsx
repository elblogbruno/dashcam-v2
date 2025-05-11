import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { 
  FaPlay, FaStop, FaMicrophone, FaMicrophoneSlash, 
  FaMapMarkerAlt, FaTachometerAlt, FaExclamationTriangle, 
  FaRoute, FaCalendarAlt, FaHdd, FaCog, FaMap, 
  FaArrowRight, FaCar, FaMemory, FaMicrochip, FaThermometerHalf,
  FaSdCard, FaClock, FaSync, FaCamera, FaChevronLeft, FaChevronRight,
  FaDesktop, FaMobileAlt, FaRaspberryPi, FaAngleLeft, FaAngleRight,
  FaBars, FaTimes
} from 'react-icons/fa'
import WebRTCCamera from '../components/WebRTCCamera'
import useRaspberryPiDetection from '../hooks/useRaspberryPiDetection'

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
  
  // Estado para WebRTC
  const [useWebRTC, setUseWebRTC] = useState(true)
  
  // Estado para detección de Raspberry Pi
  const [isRaspberryPi, setIsRaspberryPi] = useState(false)
  
  // Estado para modo simplificado (pantalla grande)
  const [simplifiedView, setSimplifiedView] = useState(false)
  
  // Estado para el elemento actual en la vista simplificada
  const [currentSlide, setCurrentSlide] = useState(0)
  
  // Mantenemos el estado de cameraImages para fallback si WebRTC falla
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

  // Estado para errores de WebRTC
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

  // Manejador de errores de WebRTC
  const handleWebRTCError = (cameraType, error) => {
    console.error(`WebRTC error for ${cameraType} camera:`, error);
    setWebrtcErrors(prev => ({
      ...prev,
      [cameraType]: true
    }));
    
    // Si WebRTC falla, volver al método de fallback
    if (useWebRTC) {
      console.log(`Fallback to HTTP streaming for ${cameraType} camera`);
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
    
    // Si no se usa WebRTC, cargar las imágenes tradicionales
    if (!useWebRTC) {
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
  }, [useWebRTC]);
  
  // Función para obtener el estado de grabación
  const fetchRecordingStatus = async () => {
    try {
      const response = await RequestController.executeRequest(() =>
        axiosInstance.get('/api/recording/status')
      );
      setIsRecording(response.data.recording);
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
              
              // Update camera status
              if (data.camera_status) {
                setCameraStatus(data.camera_status);
              }
              
              // Update system stats with timestamp
              if (data.system_stats) {
                // Actualizar datos del sistema recibidos vía WebSocket con marca de tiempo
                setSystemStatus(prevStatus => ({
                  ...prevStatus,
                  ...data.system_stats,
                  last_update: new Date().toISOString()
                }));
                
                // Verificar si el sistema está sobrecargado
                const stats = data.system_stats;
                const isThrottling = 
                  stats.cpu_usage > 90 || 
                  stats.memory_usage > 90 || 
                  stats.cpu_temp > 80;
                
                if (isThrottling && !data.system_stats.throttling) {
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
                } else if (!isThrottling && data.system_stats.throttling) {
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

  // Función para alternar entre WebRTC y HTTP
  const toggleStreamingMode = () => {
    const newMode = !useWebRTC;
    setUseWebRTC(newMode);
    
    // Limpiar cualquier intervalo existente
    if (refreshIntervals.current.road) {
      clearInterval(refreshIntervals.current.road);
      refreshIntervals.current.road = null;
    }
    if (refreshIntervals.current.interior) {
      clearInterval(refreshIntervals.current.interior);
      refreshIntervals.current.interior = null;
    }
    
    // Si cambiamos a HTTP, iniciar la carga de imágenes
    if (!newMode) {
      refreshCameraFrames();
    }
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
      {/* Toggle between normal and simplified view - solo visible en Raspberry Pi */}
      {isRaspberryPi && (
        <div className="flex justify-end mb-2">
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
        </div>
      )}
      
      {simplifiedView ? (
        /* VISTA SIMPLIFICADA PARA RASPBERRY PI */
        <div 
          className="w-full flex-grow relative overflow-hidden" 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Contenido según el slide actual - ocupa todo el espacio disponible */}
          <div className="absolute inset-0 flex items-center justify-center p-2">
            {/* Slide 0: Cámara Frontal */}
            {currentSlide === 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden w-full h-full max-h-[85vh]">
                <div className="relative h-full">
                  {cameraStatus.road_camera ? (
                    useWebRTC ? (
                      <WebRTCCamera 
                        cameraType="road" 
                        height="100%" 
                        className="w-full"
                        onError={(error) => handleWebRTCError('road', error)}
                      />
                    ) : (
                      <div className="relative h-full">
                        {cameraImages.road ? (
                          <img 
                            src={cameraImages.road} 
                            alt="Road View" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                            <FaCamera className="text-3xl sm:text-5xl mb-2 sm:mb-4" />
                            <div className="text-sm sm:text-xl text-gray-400 mb-2">Cargando cámara frontal...</div>
                          </div>
                        )}
                        
                        <button 
                          onClick={() => manualRefreshCamera('road')}
                          disabled={isRefreshing.road}
                          className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full"
                          title="Refresh road camera"
                        >
                          <FaSync className={`text-lg ${isRefreshing.road ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white p-4">
                      <div className="text-xl sm:text-2xl text-red-400 mb-2 sm:mb-4 text-center">Cámara frontal no disponible</div>
                      <div className="text-sm sm:text-xl text-gray-400 mb-2 sm:mb-4 text-center">Verifique la conexión de la cámara</div>
                      <button 
                        onClick={() => manualRefreshCamera('road')}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm sm:text-lg flex items-center"
                      >
                        <FaSync className="mr-2" /> Intentar de nuevo
                      </button>
                    </div>
                  )}
                  
                  {/* Overlay for speed and landmark */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 sm:p-4 flex justify-between z-10">
                    <div className="flex items-center text-base sm:text-xl">
                      <FaTachometerAlt className="mr-1 sm:mr-2" />
                      <span>{Math.round(location.speed)} km/h</span>
                    </div>
                    {landmark && (
                      <div className="flex items-center text-base sm:text-xl">
                        <FaMapMarkerAlt className="mr-1 sm:mr-2 text-red-500" />
                        <span className="truncate max-w-[120px] sm:max-w-full">{landmark.name}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Recording indicator */}
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-full animate-pulse z-10 text-sm sm:text-lg">
                      <span className="h-2 w-2 sm:h-3 sm:w-3 bg-white rounded-full mr-1 sm:mr-2"></span>
                      <span>REC</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Slide 1: Cámara Interior */}
            {currentSlide === 1 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden w-full h-full max-h-[75vh]">
                {/* ... contenido similar al Slide 0 con las mismas optimizaciones de responsividad ... */}
                <div className="relative h-full">
                  {cameraStatus.interior_camera ? (
                    useWebRTC ? (
                      <WebRTCCamera 
                        cameraType="interior" 
                        height="100%" 
                        className="w-full"
                        onError={(error) => handleWebRTCError('interior', error)}
                      />
                    ) : (
                      <div className="relative h-full">
                        {cameraImages.interior ? (
                          <img 
                            src={cameraImages.interior} 
                            alt="Interior View" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                            <FaCamera className="text-3xl sm:text-5xl mb-2 sm:mb-4" />
                            <div className="text-sm sm:text-xl text-gray-400 mb-2">Cargando cámara interior...</div>
                          </div>
                        )}
                        
                        <button 
                          onClick={() => manualRefreshCamera('interior')}
                          disabled={isRefreshing.interior}
                          className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full"
                          title="Refresh interior camera"
                        >
                          <FaSync className={`text-lg ${isRefreshing.interior ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white p-4">
                      <div className="text-xl sm:text-2xl text-red-400 mb-2 sm:mb-4 text-center">Cámara interior no disponible</div>
                      <div className="text-sm sm:text-xl text-gray-400 mb-2 sm:mb-4 text-center">Verifique la conexión de la cámara</div>
                      <button 
                        onClick={() => manualRefreshCamera('interior')}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm sm:text-lg flex items-center"
                      >
                        <FaSync className="mr-2" /> Intentar de nuevo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Slide 2: Controles */}
            {currentSlide === 2 && (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-2xl overflow-y-auto max-h-[85vh]">
                <h3 className="text-xl sm:text-2xl font-medium text-gray-800 mb-4 sm:mb-6 text-center">Controles de Grabación</h3>
                
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  {!isRecording ? (
                    <button 
                      className="bg-green-500 hover:bg-green-600 text-white py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl"
                      onClick={startRecording}
                    >
                      <FaPlay className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                      Iniciar Grabación
                    </button>
                  ) : (
                    <button 
                      className="bg-red-500 hover:bg-red-600 text-white py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl"
                      onClick={stopRecording}
                    >
                      <FaStop className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                      Detener Grabación
                    </button>
                  )}
                  
                  <button 
                    className={`py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl ${isMicEnabled ? 'bg-dashcam-500 hover:bg-dashcam-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}
                    onClick={toggleMicrophone}
                  >
                    {isMicEnabled ? (
                      <>
                        <FaMicrophone className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                        Micrófono Activado
                      </>
                    ) : (
                      <>
                        <FaMicrophoneSlash className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                        Micrófono Desactivado
                      </>
                    )}
                  </button>
                  
                  {activeTrip && (
                    <button 
                      onClick={startNavigation}
                      className="bg-dashcam-600 hover:bg-dashcam-700 text-white py-4 sm:py-6 px-4 sm:px-6 rounded-lg flex items-center justify-center text-lg sm:text-xl"
                    >
                      <FaRoute className="mr-2 sm:mr-3 text-xl sm:text-2xl" />
                      Iniciar Navegación
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Slide 3: Información */}
            {currentSlide === 3 && (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full max-w-2xl overflow-y-auto max-h-[85vh] px-2">
                {/* Location information */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
                  <div className="bg-gray-50 p-3 sm:p-4 border-b border-gray-200"> 
                    <h3 className="text-lg sm:text-xl font-medium text-gray-800">Ubicación</h3>
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className="mb-3 sm:mb-4">
                      <div className="text-base sm:text-lg text-gray-500 mb-1">Coordenadas Actuales:</div>
                      <div className="text-base sm:text-xl font-medium flex items-center flex-wrap">
                        <FaMapMarkerAlt className="text-red-500 mr-1 flex-shrink-0" />
                        <span className="break-all">
                          {location && location.lat ? location.lat.toFixed(6) : '0.000000'}, 
                          {location && location.lon ? location.lon.toFixed(6) : '0.000000'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-3 sm:mb-4"> 
                      <div className="text-base sm:text-lg text-gray-500 mb-1">Velocidad:</div>
                      <div className="text-base sm:text-xl font-medium flex items-center">
                        <FaCar className="text-dashcam-600 mr-2 text-base sm:text-xl flex-shrink-0" />
                        {Math.round(location.speed)} km/h
                      </div>
                    </div>
                    
                    {landmark && (
                      <div> 
                        <div className="text-base sm:text-lg text-gray-500 mb-1">Punto de Interés Cercano:</div>
                        <div className="text-base sm:text-xl font-medium text-dashcam-700">{landmark.name}</div>
                        {landmark.description && (
                          <div className="text-sm sm:text-lg text-gray-600 mt-1">{landmark.description}</div>
                        )}
                        <div className="text-sm sm:text-base text-gray-500 mt-1">
                          {landmark.distance !== undefined 
                            ? `${landmark.distance < 1000 
                                ? `${Math.round(landmark.distance)}m de distancia` 
                                : `${(landmark.distance / 1000).toFixed(1)}km de distancia`}`
                            : 'Distancia desconocida'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Trip Stats */}
                <div className="bg-white rounded-lg shadow-md p-3 sm:p-5">
                  <h3 className="text-lg sm:text-xl font-medium text-gray-800 mb-3 sm:mb-4">Estadísticas de Viaje</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5">
                    <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl sm:text-2xl font-bold text-dashcam-600">{tripStats.total_trips || 0}</div>
                      <div className="text-sm sm:text-lg text-gray-500">Viajes Totales</div>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl sm:text-2xl font-bold text-dashcam-600">
                        {Math.round(tripStats.distance_traveled || 0)} km
                      </div>
                      <div className="text-sm sm:text-lg text-gray-500">Distancia</div>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl sm:text-2xl font-bold text-dashcam-600">
                        {Math.floor((tripStats.recording_time || 0) / 3600)}h
                      </div>
                      <div className="text-sm sm:text-lg text-gray-500">Tiempo Grabado</div>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl sm:text-2xl font-bold text-dashcam-600">
                        {tripStats.recent_trips ? tripStats.recent_trips.length : 0}
                      </div>
                      <div className="text-sm sm:text-lg text-gray-500">Viajes Recientes</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Slide 4: Sistema */}
            {currentSlide === 4 && (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full max-w-2xl overflow-y-auto max-h-[85vh] px-2">
                {/* System health */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
                  <div className="bg-gray-50 p-3 sm:p-4 border-b border-gray-200">
                    <h3 className="text-lg sm:text-xl font-medium text-gray-800">Estado del Sistema</h3>
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className="space-y-3 sm:space-y-5">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-base sm:text-lg text-gray-500">CPU:</span>
                          <span className="text-base sm:text-lg font-medium">{systemStatus.cpu_usage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                          <div 
                            className={`h-full rounded-full ${
                              systemStatus.cpu_usage > 80 ? 'bg-red-500' : 
                              systemStatus.cpu_usage > 50 ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${systemStatus.cpu_usage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-base sm:text-lg text-gray-500">Memoria:</span>
                          <span className="text-base sm:text-lg font-medium">{systemStatus.memory_usage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                          <div 
                            className={`h-full rounded-full ${
                              systemStatus.memory_usage > 80 ? 'bg-red-500' : 
                              systemStatus.memory_usage > 50 ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${systemStatus.memory_usage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-base sm:text-lg text-gray-500">Temperatura:</span>
                          <span className="text-base sm:text-lg font-medium">{systemStatus.cpu_temp}°C</span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-base sm:text-lg text-gray-500">Tiempo Activo:</span>
                          <span className="text-base sm:text-lg font-medium">{systemStatus.uptime}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 sm:mt-5">
                      <div className="text-base sm:text-lg text-gray-500 mb-1">Almacenamiento:</div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-sm sm:text-base">
                          {formatBytes(systemStatus.storage.total - systemStatus.storage.available)} de {formatBytes(systemStatus.storage.total)}
                        </span>
                        <span className="text-sm sm:text-base font-medium">
                          {systemStatus.storage.percent_used}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                        <div 
                          className={`h-full rounded-full ${
                            systemStatus.storage.percent_used > 90 ? 'bg-red-500' : 
                            systemStatus.storage.percent_used > 70 ? 'bg-yellow-500' : 
                            'bg-green-500'
                          }`}
                          style={{ width: `${systemStatus.storage.percent_used}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Quick Navigation */}
                <div className="bg-white rounded-lg shadow-md p-3 sm:p-5">
                  <h3 className="text-lg sm:text-xl font-medium text-gray-800 mb-3 sm:mb-4">Navegación Rápida</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <Link to="/map" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                      <FaMap className="mr-1 sm:mr-2" />
                      Mapa en Vivo
                    </Link>
                    <Link to="/trips" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                      <FaRoute className="mr-1 sm:mr-2" />
                      Planificar Viaje
                    </Link>
                    <Link to="/calendar" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                      <FaCalendarAlt className="mr-1 sm:mr-2" />
                      Calendario
                    </Link>
                    <Link to="/storage" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-3 sm:py-5 px-3 sm:px-4 rounded-lg flex items-center justify-center text-base sm:text-lg">
                      <FaHdd className="mr-1 sm:mr-2" />
                      Almacenamiento
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Botón para mostrar/ocultar la navegación - siempre visible */}
          <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-50 flex flex-col space-y-2">
            {/* Toggle entre vista normal y simplificada */}
            <button 
              onClick={toggleSimplifiedView}
              className="p-2 sm:p-3 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full shadow-lg transition-all"
              title={simplifiedView ? "Cambiar a vista normal" : "Cambiar a vista simplificada"}
            >
              {simplifiedView ? <FaDesktop /> : <FaMobileAlt />}
            </button>
            
            {/* Botón de navegación */}
            <button 
              onClick={toggleNavbar}
              className="p-2 sm:p-3 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full shadow-lg transition-all"
              title={showNavbar ? "Ocultar navegación" : "Mostrar navegación"}
            >
              {showNavbar ? <FaTimes /> : <FaBars />}
            </button>
          </div>
          
          {/* Navegación por deslizamiento - ahora solo visible cuando se activa */}
          {showNavbar && (
            <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex flex-col z-40">
              <div className="mb-2 bg-black bg-opacity-70 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
                <div className="flex justify-between items-center text-white">
                  <button 
                    onClick={prevSlide}
                    className="p-2 sm:p-3 bg-black bg-opacity-40 hover:bg-opacity-60 rounded-full focus:outline-none transition-colors"
                  >
                    <FaAngleLeft className="text-base sm:text-xl" />
                  </button>
                  
                  <div className="text-base sm:text-lg font-medium">
                    {currentSlide === 0 && "Cámara Frontal"}
                    {currentSlide === 1 && "Cámara Interior"}
                    {currentSlide === 2 && "Controles"}
                    {currentSlide === 3 && "Información"}
                    {currentSlide === 4 && "Sistema"}
                  </div>
                  
                  <button 
                    onClick={nextSlide}
                    className="p-2 sm:p-3 bg-black bg-opacity-40 hover:bg-opacity-60 rounded-full focus:outline-none transition-colors"
                  >
                    <FaAngleRight className="text-base sm:text-xl" />
                  </button>
                </div>
                
                {/* Indicador de slide actual */}
                <div className="flex justify-center mt-1 sm:mt-2">
                  {[0, 1, 2, 3, 4].map(index => (
                    <div 
                      key={index}
                      className={`mx-1 h-1 sm:h-2 rounded-full transition-all duration-300 ${
                        currentSlide === index ? 'w-6 sm:w-8 bg-white' : 'w-1 sm:w-2 bg-white bg-opacity-40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Instrucciones de deslizamiento - ahora en la parte inferior */}
          <div className="absolute bottom-2 sm:bottom-4 left-0 right-0 text-center">
            <div className="bg-black bg-opacity-40 text-white text-xs sm:text-sm py-1 sm:py-2 px-3 sm:px-4 rounded-full inline-block backdrop-blur-sm">
              Desliza para cambiar de vista
            </div>
          </div>
        </div>
      ) : (
        /* VISTA NORMAL - MEJORADA PARA RESPONSIVIDAD */
        <div>
          {/* System alerts */}
          {cameraStatus.errors.length > 0 && (
            <div className="mb-3 sm:mb-4 bg-yellow-100 border-l-4 border-yellow-500 p-3 sm:p-4 rounded-md shadow-sm">
              <h3 className="text-yellow-700 font-medium flex items-center text-sm sm:text-base">
                <FaExclamationTriangle className="mr-2" />
                Alertas del sistema
              </h3>
              <ul className="mt-1 sm:mt-2 list-disc pl-5">
                {cameraStatus.errors.map((error, index) => (
                  <li key={index} className="text-yellow-600 text-xs sm:text-sm">{error}</li>
                ))}
              </ul>
              <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0">
                <button 
                  onClick={() => manualRefreshCamera('all')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-xs sm:text-sm flex items-center justify-center sm:justify-start"
                >
                  <FaSync className="mr-1" /> Actualizar cámaras
                </button>
                
                <button 
                  onClick={toggleStreamingMode}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-xs sm:text-sm flex items-center justify-center sm:justify-start"
                >
                  <FaCamera className="mr-1" /> 
                  {useWebRTC ? 'Cambiar a modo HTTP' : 'Cambiar a modo WebRTC'}
                </button>
              </div>
            </div>
          )}
          
          {/* Active planned trip card */}
          {activeTrip && (
            <div className="mb-3 sm:mb-4 bg-dashcam-50 border-l-4 border-dashcam-500 p-3 sm:p-4 rounded-md shadow-sm">
              <h3 className="text-dashcam-700 font-medium flex items-center text-sm sm:text-base">
                <FaRoute className="mr-2" />
                Viaje planificado activo
              </h3>
              <div className="mt-1 sm:mt-2">
                <p className="font-medium text-sm sm:text-base">{activeTrip.name}</p>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 gap-2 sm:gap-0">
                  <span className="text-xs sm:text-sm text-gray-600">
                    {new Date(activeTrip.start_date).toLocaleDateString()} - {new Date(activeTrip.end_date).toLocaleDateString()}
                  </span>
                  <button 
                    onClick={startNavigation}
                    className="bg-dashcam-600 hover:bg-dashcam-700 text-white px-3 py-1 rounded-md text-xs sm:text-sm flex items-center justify-center"
                  >
                    Navegar <FaArrowRight className="ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {/* Main camera view */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="relative h-36 sm:h-48 md:h-56 lg:h-64">
                {cameraStatus.road_camera ? (
                  useWebRTC ? (
                    // WebRTC Camera
                    <WebRTCCamera 
                      cameraType="road" 
                      height="100%" 
                      className="w-full"
                      onError={(error) => handleWebRTCError('road', error)}
                    />
                  ) : (
                    // Fallback HTTP Streaming
                    <div className="relative h-full">
                      {cameraImages.road ? (
                        <img 
                          src={cameraImages.road} 
                          alt="Road View" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                          <FaCamera className="text-xl sm:text-2xl mb-2" />
                          <div className="text-xs sm:text-sm text-gray-400 mb-2">Cargando cámara frontal...</div>
                        </div>
                      )}
                      
                      {/* Botón de actualización manual */}
                      <button 
                        onClick={() => manualRefreshCamera('road')}
                        disabled={isRefreshing.road}
                        className="absolute top-2 left-2 bg-black bg-opacity-50 text-white p-1 rounded-full"
                        title="Refresh road camera"
                      >
                        <FaSync className={`text-xs sm:text-sm ${isRefreshing.road ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                    <div className="text-sm sm:text-base text-red-400 mb-2">Cámara frontal no disponible</div>
                    <div className="text-xs sm:text-sm text-gray-400">Verificar conexión</div>
                    <button 
                      onClick={() => manualRefreshCamera('road')}
                      className="mt-2 bg-gray-600 hover:bg-gray-700 text-white px-2 sm:px-3 py-1 rounded-md text-xs flex items-center"
                    >
                      <FaSync className="mr-1" /> Reintentar
                    </button>
                  </div>
                )}
                
                {/* Overlay for speed and landmark */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 sm:p-2 flex justify-between z-10">
                  <div className="flex items-center text-xs sm:text-sm">
                    <FaTachometerAlt className="mr-1" />
                    <span>{Math.round(location.speed)} km/h</span>
                  </div>
                  {landmark && (
                    <div className="flex items-center text-xs sm:text-sm">
                      <FaMapMarkerAlt className="mr-1 text-red-500" />
                      <span className="truncate max-w-[100px] sm:max-w-[150px]">{landmark.name}</span>
                    </div>
                  )}
                </div>
                
                {/* Recording indicator */}
                {isRecording && (
                  <div className="absolute top-2 right-2 flex items-center bg-red-600 text-white px-1 sm:px-2 py-0.5 sm:py-1 rounded-full animate-pulse z-10">
                    <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-white rounded-full mr-0.5 sm:mr-1"></span>
                    <span className="text-xs">REC</span>
                  </div>
                )}
              </div>
              
              <div className="p-2 sm:p-3 border-t border-gray-200">
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Cámara Frontal</h3>
              </div>
            </div>
            
            {/* Interior camera view */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="relative h-36 sm:h-48 md:h-56 lg:h-64">
                {cameraStatus.interior_camera ? (
                  useWebRTC ? (
                    // WebRTCCamera
                    <WebRTCCamera 
                      cameraType="interior" 
                      height="100%" 
                      className="w-full"
                      onError={(error) => handleWebRTCError('interior', error)}
                    />
                  ) : (
                    // Fallback HTTP Streaming
                    <div className="relative h-full">
                      {cameraImages.interior ? (
                        <img 
                          src={cameraImages.interior} 
                          alt="Interior View" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                          <FaCamera className="text-xl sm:text-2xl mb-2" />
                          <div className="text-xs sm:text-sm text-gray-400 mb-2">Cargando cámara interior...</div>
                        </div>
                      )}
                      
                      {/* Botón de actualización manual */}
                      <button 
                        onClick={() => manualRefreshCamera('interior')}
                        disabled={isRefreshing.interior}
                        className="absolute top-2 left-2 bg-black bg-opacity-50 text-white p-1 rounded-full"
                        title="Refresh interior camera"
                      >
                        <FaSync className={`text-xs sm:text-sm ${isRefreshing.interior ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col text-white">
                    <div className="text-sm sm:text-base text-red-400 mb-2">Cámara interior no disponible</div>
                    <div className="text-xs sm:text-sm text-gray-400">Verificar conexión</div>
                    <button 
                      onClick={() => manualRefreshCamera('interior')}
                      className="mt-2 bg-gray-600 hover:bg-gray-700 text-white px-2 sm:px-3 py-1 rounded-md text-xs flex items-center"
                    >
                      <FaSync className="mr-1" /> Reintentar
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-2 sm:p-3 border-t border-gray-200">
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Cámara Interior</h3>
              </div>
            </div>
          </div>
          
          {/* Controls & Quick stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {/* Recording controls */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
              <h3 className="font-medium text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Controles de Grabación</h3>
              
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {!isRecording ? (
                  <button 
                    className="bg-green-500 hover:bg-green-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm"
                    onClick={startRecording}
                  >
                    <FaPlay className="mr-1" />
                    Iniciar Grabación
                  </button>
                ) : (
                  <button 
                    className="bg-red-500 hover:bg-red-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm"
                    onClick={stopRecording}
                  >
                    <FaStop className="mr-1" />
                    Detener Grabación
                  </button>
                )}
                
                <button 
                  className={`py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm ${isMicEnabled ? 'bg-dashcam-500 hover:bg-dashcam-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}
                  onClick={toggleMicrophone}
                >
                  {isMicEnabled ? (
                    <>
                      <FaMicrophone className="mr-1" />
                      Micrófono On
                    </>
                  ) : (
                    <>
                      <FaMicrophoneSlash className="mr-1" />
                      Micrófono Off
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Quick stats */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
              <h3 className="font-medium text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Estadísticas de Viaje</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="text-center">
                  <div className="text-base sm:text-xl font-bold text-dashcam-600">{tripStats.total_trips || 0}</div>
                  <div className="text-xs sm:text-sm text-gray-500">Viajes Totales</div>
                </div>
                <div className="text-center">
                  <div className="text-base sm:text-xl font-bold text-dashcam-600">
                    {Math.round(tripStats.distance_traveled || 0)} km
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Distancia</div>
                </div>
                <div className="text-center">
                  <div className="text-base sm:text-xl font-bold text-dashcam-600">
                    {Math.floor((tripStats.recording_time || 0) / 3600)}h
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Tiempo Grabado</div>
                </div>
                <div className="text-center">
                  <div className="text-base sm:text-xl font-bold text-dashcam-600">
                    {tripStats.recent_trips ? tripStats.recent_trips.length : 0}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Viajes Recientes</div>
                </div>
              </div>
            </div>
            
            {/* Quick nav */}
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
              <h3 className="font-medium text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Navegación Rápida</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Link to="/map" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
                  <FaMap className="mr-1" />
                  Mapa en Vivo
                </Link>
                <Link to="/trips" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
                  <FaRoute className="mr-1" />
                  Planificación
                </Link>
                <Link to="/calendar" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
                  <FaCalendarAlt className="mr-1" />
                  Calendario
                </Link>
                <Link to="/storage" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-1.5 sm:py-2 px-2 sm:px-4 rounded-md flex items-center justify-center text-xs sm:text-sm">
                  <FaHdd className="mr-1" />
                  Almacenamiento
                </Link>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
            {/* System health */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
              <div className="bg-gray-50 p-2 sm:p-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Estado del Sistema</h3>
              </div>
              <div className="p-2 sm:p-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="flex items-center">
                    <FaMicrochip className="text-gray-500 mr-2 hidden sm:block" />
                    <div className="w-full">
                      <div className="text-xs sm:text-sm text-gray-500">Uso de CPU</div>
                      <div className="text-sm sm:font-medium">{systemStatus.cpu_usage}%</div>
                      <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5 mt-1">
                        <div 
                          className={`h-1 sm:h-1.5 rounded-full ${
                            systemStatus.cpu_usage > 80 ? 'bg-red-500' : 
                            systemStatus.cpu_usage > 50 ? 'bg-yellow-500' : 
                            'bg-green-500'
                          }`}
                          style={{ width: `${systemStatus.cpu_usage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <FaMemory className="text-gray-500 mr-2 hidden sm:block" />
                    <div className="w-full">
                      <div className="text-xs sm:text-sm text-gray-500">Memoria</div>
                      <div className="text-sm sm:font-medium">{systemStatus.memory_usage}%</div>
                      <div className="w-full bg-gray-200 rounded-full h-1 sm:h-1.5 mt-1">
                        <div 
                          className={`h-1 sm:h-1.5 rounded-full ${
                            systemStatus.memory_usage > 80 ? 'bg-red-500' : 
                            systemStatus.memory_usage > 50 ? 'bg-yellow-500' : 
                            'bg-green-500'
                          }`}
                          style={{ width: `${systemStatus.memory_usage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <FaThermometerHalf className="text-gray-500 mr-2 hidden sm:block" />
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500">Temperatura</div>
                      <div className="text-sm sm:font-medium">{systemStatus.cpu_temp}°C</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <FaClock className="text-gray-500 mr-2 hidden sm:block" />
                    <div>
                      <div className="text-xs sm:text-sm text-gray-500">Tiempo Activo</div>
                      <div className="text-sm sm:font-medium">{systemStatus.uptime}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Location information */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden"> 
              <div className="bg-gray-50 p-2 sm:p-3 border-b border-gray-200"> 
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">Ubicación</h3>
              </div>
              <div className="p-2 sm:p-4">
                <div className="mb-2 sm:mb-3">
                  <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Coordenadas Actuales</div>
                  <div className="text-xs sm:text-sm font-medium flex items-center flex-wrap">
                    <FaMapMarkerAlt className="text-red-500 mr-1 flex-shrink-0" />
                    <span className="break-all">
                      {location && location.lat ? location.lat.toFixed(6) : '0.000000'}, 
                      {location && location.lon ? location.lon.toFixed(6) : '0.000000'}
                    </span>
                  </div>
                </div>
                
                <div className="mb-2 sm:mb-3"> 
                  <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Velocidad</div>
                  <div className="text-xs sm:text-sm font-medium flex items-center">
                    <FaCar className="text-dashcam-600 mr-1 flex-shrink-0" />
                    {Math.round(location.speed)} km/h
                  </div>
                </div>
                
                {landmark && (
                  <div> 
                    <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Punto de Interés Cercano</div>
                    <div className="text-xs sm:text-sm font-medium text-dashcam-700">{landmark.name}</div>
                    {landmark.description && (
                      <div className="text-xs sm:text-sm text-gray-600">{landmark.description}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {landmark.distance !== undefined 
                        ? `${landmark.distance < 1000 
                            ? `${Math.round(landmark.distance)}m de distancia` 
                            : `${(landmark.distance / 1000).toFixed(1)}km de distancia`}`
                        : 'Distancia desconocida'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Storage status */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-3 sm:mb-4"> 
            <div className="bg-gray-50 p-2 sm:p-3 border-b border-gray-200"> 
              <h3 className="font-medium text-gray-800 text-sm sm:text-base">Estado del Almacenamiento</h3>
            </div>
            <div className="p-2 sm:p-4">
              <div className="mb-2 flex justify-between">
                <span className="text-xs sm:text-sm text-gray-500">
                  {formatBytes(systemStatus.storage.total - systemStatus.storage.available)} usado de {formatBytes(systemStatus.storage.total)}
                </span>
                <span className="text-xs sm:text-sm font-medium">
                  {systemStatus.storage.percent_used}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2.5">
                <div 
                  className={`h-1.5 sm:h-2.5 rounded-full ${
                    systemStatus.storage.percent_used > 90 ? 'bg-red-500' : 
                    systemStatus.storage.percent_used > 70 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${systemStatus.storage.percent_used}%` }}
                ></div>
              </div>
              
              <div className="mt-2 sm:mt-3 flex justify-end"> 
                <Link 
                  to="/storage" 
                  className="text-dashcam-600 hover:text-dashcam-700 text-xs sm:text-sm font-medium flex items-center"
                > 
                  Gestor de Almacenamiento <FaArrowRight className="ml-1" />
                </Link>
              </div>
            </div>
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