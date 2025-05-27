import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import BulkUploader from './pages/BulkUploader'
import UnifiedStorageManager from './pages/UnifiedStorageManager'
import RealTimeMap from './pages/RealTimeMap'
import TripPlanner from './pages/TripPlanner'
import LandmarksManager from './pages/LandmarksManager'
import NotificationTester from './pages/NotificationTester'
import MicLEDTester from './pages/MicLEDTester'
import MapDiagnosticPanel from './components/Maps/MapDiagnosticPanel'
import Navigation from './components/Navigation'
import { NotificationCenter } from './components/Notifications'
import { NavigationProvider } from './contexts/NavigationContext'
import { showInfo, showSuccess, showError } from './services/notificationService'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState(false)
  const [socket, setSocket] = useState(null)
  const location = useLocation()
  
  // Determinar si la ruta actual es la página del mapa
  const isMapPage = location.pathname === '/map'

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    const MAX_RECONNECT_ATTEMPTS = 10;
    const BASE_RECONNECT_DELAY = 1000; // 1 segundo inicial
    let reconnectAttempts = 0;
    let reconnectTimeout = null;
    
    function connectWebSocket() {
      // Limpiar cualquier timeout pendiente
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Crear nueva conexión WebSocket
      const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws`);
      
      ws.onopen = () => {
        console.log('WebSocket conectado correctamente');
        setIsConnected(true);
        setSocket(ws);
        // Resetear los intentos de reconexión cuando se conecta correctamente
        reconnectAttempts = 0;
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket desconectado con código: ${event.code}, razón: ${event.reason}`);
        setIsConnected(false);
        
        // No intentar reconectar si el cierre fue limpio (código 1000)
        if (event.code === 1000) {
          console.log('Cierre limpio del WebSocket, no se intentará reconectar');
          return;
        }
        
        // Intentar reconectar con backoff exponencial
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts);
          console.log(`Intentando reconexión ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS} en ${delay}ms`);
          
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket();
          }, delay);
        } else {
          console.error(`Se alcanzó el máximo de intentos de reconexión (${MAX_RECONNECT_ATTEMPTS})`);
          showError('No se pudo conectar al servidor. Por favor, recarga la página o verifica tu conexión.', {
            title: 'Error de conexión',
            timeout: 0 // No se oculta automáticamente
          });
        }
      };
      
      ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        // No hacemos nada aquí, el evento onclose se disparará después
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Update recording status if included in the message
          if (data.recording !== undefined) {
            setRecordingStatus(data.recording)
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
        } catch (e) {
          console.error('Error al procesar mensaje del WebSocket:', e)
        }
      };
      
      return ws;
    }
    
    // Iniciar la conexión WebSocket
    const wsConnection = connectWebSocket();
    
    // Limpieza al desmontar el componente
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsConnection) {
        wsConnection.close(1000, "Componente desmontado");
      }
    }
  }, [])

  return (
    <NavigationProvider>
      <div className="flex flex-col min-h-screen max-w-full">
        {/* Status bar - ocultar en la página de mapa ya que tiene su propia barra */}
        {!isMapPage && (
          <div className="bg-dashcam-800 text-white py-2 px-4 flex justify-between items-center z-50">
            <h1 className="text-xl font-bold">Smart Dashcam</h1>
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-1 ${recordingStatus ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-sm">{recordingStatus ? 'Recording' : 'Standby'}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Main content - usar estructura diferente para la página del mapa */}
        {isMapPage ? (
          <div className="map-page-container">
            <RealTimeMap />
          </div>
        ) : (
          <div className="flex-grow overflow-auto w-full relative">
            <div className="content-wrapper w-full"> 
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                {/* Ruta del mapa renderizada fuera de este contenedor */}
                <Route path="/trips" element={<TripPlanner />} />
                <Route path="/landmarks-manager" element={<LandmarksManager />} />
                <Route path="/uploader" element={<BulkUploader />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/storage" element={<UnifiedStorageManager />} />
                <Route path="/notifications" element={<NotificationTester />} />
                <Route path="/mic-led-tester" element={<MicLEDTester />} />
                <Route path="/map-diagnostic" element={<MapDiagnosticPanel />} />
              </Routes>
            </div>
          </div>
        )}
        
        {/* Navigation bar - siempre visible, incluso en la página de mapa, pero con z-index alto */}
        <div className="z-50 relative">
          <Navigation />
        </div>
        
        {/* Sistema de notificaciones */}
        <NotificationCenter />
      </div>
    </NavigationProvider>
  )
}

export default App