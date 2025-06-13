import { useState, useEffect } from 'react'
import { 
  FaLocationArrow, 
  FaVideo, 
  FaWifi, 
  FaSatellite, 
  FaTachometerAlt, 
  FaClock, 
  FaRoad,
  FaCompass,
  FaSignal,
  FaBatteryFull,
  FaExclamationTriangle
} from 'react-icons/fa'
import { Badge } from '../common/UI'

// Formato de distancias para mostrar
const formatDistance = (meters) => {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

// Formato de tiempo de grabación
const formatRecordingTime = (startTime) => {
  if (!startTime) return '00:00';
  const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Obtener dirección cardinal desde heading
const getCardinalDirection = (heading) => {
  if (heading === null || heading === undefined) return 'N/A';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}

function StatusBar({ 
  isRecording, 
  connectionStatus, 
  statusMessage, 
  navigationStatus, 
  position, 
  speed,
  recordingStartTime,
  heading 
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(null);
  
  // Actualizar tiempo cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Obtener nivel de batería (si está disponible)
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(Math.round(battery.level * 100));
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <FaWifi className="text-green-500" />;
      case 'connecting': return <FaSignal className="text-yellow-500 animate-pulse" />;
      default: return <FaExclamationTriangle className="text-red-500" />;
    }
  };

  const getSpeedColor = (speedKmh) => {
    if (speedKmh === 0) return 'text-gray-500';
    if (speedKmh <= 50) return 'text-green-600';
    if (speedKmh <= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const speedKmh = speed ? Math.round(speed * 3.6) : 0;

  return (
    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white shadow-lg z-50">
      <div className="px-2 sm:px-4 py-2">
        {/* Fila principal */}
        <div className="flex items-center justify-between">
          {/* Sección izquierda - Estado de grabación y conexión */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Estado de grabación */}
            {isRecording ? (
              <div className="flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-lg px-2 py-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <FaVideo className="text-red-400 text-xs" />
                <span className="text-red-300 text-xs font-medium">
                  REC {formatRecordingTime(recordingStartTime)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-gray-700/50 border border-gray-600/30 rounded-lg px-2 py-1">
                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                <span className="text-gray-300 text-xs">Standby</span>
              </div>
            )}

            {/* Estado de conexión */}
            <div className="flex items-center gap-1 bg-gray-700/30 rounded px-2 py-1">
              {getConnectionIcon()}
              <span className="text-xs text-gray-300 hidden sm:inline ml-1">
                {connectionStatus === 'connected' ? 'GPS' : 'Sin GPS'}
              </span>
            </div>
          </div>

          {/* Sección central - Información de navegación (solo en pantallas más grandes) */}
          <div className="hidden md:flex items-center gap-3">
            {navigationStatus && (
              <div className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-lg px-3 py-1">
                <FaLocationArrow className="text-blue-400 text-xs" />
                <span className="text-blue-300 text-xs font-medium">
                  {formatDistance(navigationStatus.distance)}
                </span>
              </div>
            )}
            
            {statusMessage && (
              <div className="text-xs text-gray-300 max-w-48 truncate">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Sección derecha - Métricas del vehículo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Velocidad */}
            <div className="flex items-center gap-1 bg-gray-700/30 rounded px-2 py-1">
              <FaTachometerAlt className="text-blue-400 text-xs" />
              <span className={`text-xs font-bold ${getSpeedColor(speedKmh)}`}>
                {speedKmh}
              </span>
              <span className="text-xs text-gray-400">km/h</span>
            </div>

            {/* Dirección compass (solo en pantallas medianas y grandes) */}
            {heading !== null && heading !== undefined && (
              <div className="hidden sm:flex items-center gap-1 bg-gray-700/30 rounded px-2 py-1">
                <FaCompass className="text-green-400 text-xs" />
                <span className="text-xs text-green-300 font-medium">
                  {getCardinalDirection(heading)}
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round(heading)}°
                </span>
              </div>
            )}

            {/* Hora actual */}
            <div className="flex items-center gap-1 bg-gray-700/30 rounded px-2 py-1">
              <FaClock className="text-yellow-400 text-xs" />
              <span className="text-xs text-yellow-300 font-mono">
                {currentTime.toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                })}
              </span>
            </div>

            {/* Batería (si está disponible) */}
            {batteryLevel !== null && (
              <div className="hidden lg:flex items-center gap-1 bg-gray-700/30 rounded px-2 py-1">
                <FaBatteryFull className={`text-xs ${
                  batteryLevel > 50 ? 'text-green-400' : 
                  batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <span className="text-xs text-gray-300">{batteryLevel}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Fila secundaria para móvil - Información adicional */}
        <div className="md:hidden mt-1 pt-1 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {navigationStatus && (
                <div className="flex items-center gap-1">
                  <FaRoad className="text-blue-400" />
                  <span className="text-blue-300">{formatDistance(navigationStatus.distance)}</span>
                </div>
              )}
              {position && (
                <div className="flex items-center gap-1">
                  <FaSatellite className="text-green-400" />
                  <span className="text-green-300">GPS</span>
                </div>
              )}
            </div>
            
            <div className="text-gray-400 truncate max-w-32">
              {statusMessage || 'Sistema listo'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusBar
