import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import BulkUploader from './pages/BulkUploader'
import UnifiedStorageManager from './pages/UnifiedStorageManager'
import RealTimeMap from './pages/RealTimeMap'
import TripPlanner from './pages/TripPlanner'
import ActualTripsManager from './pages/ActualTripsManager'
import LandmarksManager from './pages/LandmarksManager'
import NotificationTester from './pages/NotificationTester'
import MicLEDTester from './pages/MicLEDTester'
import DiskSpaceMonitor from './pages/DiskSpaceMonitor'
import GeocodingTester from './components/GeocodingTester/GeocodingTester'
import MapDiagnosticPanel from './components/Maps/MapDiagnosticPanel'
import Navigation from './components/Navigation'
import StatusBar from './components/StatusBar'
import { NotificationCenter } from './components/Notifications'
import { NavigationProvider } from './contexts/NavigationContext'
import { showInfo, showSuccess, showError } from './services/notificationService'
import webSocketManager from './services/WebSocketManager'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState(false)
  const location = useLocation()
  
  // Estado para tema oscuro/claro
  const [darkMode, setDarkMode] = useState(() => {
    // Comprobar preferencias guardadas
    const savedMode = localStorage.getItem('dashcam-dark-mode');
    if (savedMode !== null) {
      return savedMode === 'true';
    }
    // Si no hay preferencia guardada, usar preferencia del sistema
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Determinar si la ruta actual es la página del mapa
  const isMapPage = location.pathname === '/map'

  // Función para alternar entre tema oscuro y claro
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('dashcam-dark-mode', newDarkMode.toString());
    
    // Aplicar clase al elemento HTML para cambios de CSS
    if (newDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  };

  // Aplicar tema oscuro en el DOM cuando cambie el estado
  useEffect(() => {
    // Añadir clase de transición para que el cambio no sea brusco
    document.documentElement.classList.add('theme-transition');
    
    // Aplicar o quitar la clase de modo oscuro
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    
    // Escuchar cambios en las preferencias del sistema
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (event) => {
      // Solo cambiar automáticamente si no hay preferencia guardada
      if (localStorage.getItem('dashcam-dark-mode') === null) {
        setDarkMode(event.matches);
      }
    };
    
    darkModeMediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [darkMode]);

  // Setup WebSocket connection for real-time updates using centralized manager
  useEffect(() => {
    // Configurar listener para manejar mensajes del WebSocket
    const handleWebSocketEvent = (eventType, data) => {
      switch (eventType) {
        case 'connected':
          setIsConnected(true);
          break;
          
        case 'disconnected':
          setIsConnected(false);
          break;
          
        case 'error':
          setIsConnected(false);
          console.error('Error en WebSocket:', data);
          break;
          
        case 'message':
          // Update recording status if included in the message
          if (data.recording !== undefined) {
            setRecordingStatus(data.recording);
          }
        
          // Procesar notificaciones del sistema
          if (data.notification) {
            const notif = data.notification;
            
            // Determinar el tipo de notificación y mostrarla
            switch (notif.type) {
              case 'success':
                showSuccess(notif.message, {
                  title: notif.title || 'Éxito',
                  timeout: notif.timeout || 5000
                });
                break;
              case 'error':
                showError(notif.message, {
                  title: notif.title || 'Error',
                  timeout: notif.timeout || 8000
                });
                break;
              case 'info':
              default:
                showInfo(notif.message, {
                  title: notif.title || 'Información',
                  timeout: notif.timeout || 4000
                });
                break;
            }
          }
          break;
          
        case 'maxReconnectAttemptsReached':
          showError('No se pudo conectar al servidor. Por favor, recarga la página o verifica tu conexión.', {
            title: 'Error de conexión',
            timeout: 0 // No se oculta automáticamente
          });
          break;
      }
    };
    
    // Registrar listener con el WebSocket Manager
    webSocketManager.addListener('app', handleWebSocketEvent);
    
    // Conectar al WebSocket si no está ya conectado
    webSocketManager.connect().catch(error => {
      console.error('Error conectando WebSocket:', error);
    });
    
    // Actualizar estado inicial
    setIsConnected(webSocketManager.isConnected());
    
    // Cleanup al desmontar el componente
    return () => {
      webSocketManager.removeListener('app');
      // No desconectamos aquí porque otros componentes pueden estar usando la conexión
    };
  }, [])

  return (
    <NavigationProvider>
      <div className={`flex min-h-screen max-w-full pb-16 md:pb-0 relative desktop-layout ${darkMode ? 'bg-neutral-900' : 'bg-neutral-50'}`}>
        {/* Navigation for desktop - positioned at the left */}
        <div className="z-50 hidden md:block desktop-sidebar">
          <Navigation darkMode={darkMode} />
        </div>

        {/* Main content container with appropriate spacing for desktop sidebar */}
        <div className={`w-full desktop-content ${darkMode ? 'bg-neutral-900' : 'bg-neutral-50'}`}>
          {/* Status bar - oculta completamente en la página del mapa */}
          {!isMapPage && (
            <StatusBar 
              isConnected={isConnected}
              recordingStatus={recordingStatus}
              isMapPage={isMapPage}
              darkMode={darkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          )}
        
          {/* Main content - usar estructura diferente para la página del mapa */}
          {isMapPage ? (
            <div className="map-page-container h-full w-full overflow-hidden md:h-screen">
              <RealTimeMap />
            </div>
          ) : (
            <div className={`flex-grow overflow-auto w-full relative content-scrollable momentum-scroll desktop-main-container mobile-main-content ${darkMode ? 'bg-neutral-900' : 'bg-neutral-50'}`}>
              <div className={`content-wrapper w-full px-4 py-3 pb-20 md:pb-8 ${darkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-neutral-50 text-neutral-800'}`}>
                <Routes>
                  <Route path="/" element={<Dashboard darkMode={darkMode} />} />
                  <Route path="/calendar" element={<Calendar darkMode={darkMode} />} />
                  {/* Ruta del mapa renderizada fuera de este contenedor */}
                  <Route path="/trips" element={<TripPlanner />} />
                  <Route path="/trips/:plannedTripId/actual-trips" element={<ActualTripsManager />} />
                  <Route path="/landmarks-manager" element={<LandmarksManager />} />
                  <Route path="/uploader" element={<BulkUploader />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/storage" element={<UnifiedStorageManager />} />
                  <Route path="/storage/disk-monitor" element={<DiskSpaceMonitor />} />
                  <Route path="/notifications" element={<NotificationTester />} />
                  <Route path="/mic-led-tester" element={<MicLEDTester />} />
                  <Route path="/geocoding-tester" element={<GeocodingTester />} />
                  <Route path="/map-diagnostic" element={<MapDiagnosticPanel />} />
                </Routes>
              </div>
            </div>
          )}
        </div>
        
        {/* Navigation bar - solo visible en móvil (oculto en desktop) */}
        <div className="z-50 md:hidden">
          <Navigation darkMode={darkMode} />
        </div>
        
        {/* Sistema de notificaciones */}
        <NotificationCenter />
      </div>
    </NavigationProvider>
  );
}

export default App;