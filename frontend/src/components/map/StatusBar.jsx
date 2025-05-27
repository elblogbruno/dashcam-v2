import { FaLocationArrow } from 'react-icons/fa'

// Formato de distancias para mostrar
const formatDistance = (meters) => {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

function StatusBar({ isRecording, connectionStatus, statusMessage, navigationStatus, position, speed }) {
  return (
    <div className="bg-dashcam-800 text-white p-2 flex items-center justify-between fixed top-0 left-0 right-0 z-50 h-12 shadow-md">
      <div className="flex items-center space-x-2">
        {isRecording ? (
          <div className="flex items-center bg-green-700 text-white px-3 py-1 rounded-full">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse mr-2"></div>
            <span className="text-sm font-medium">Grabando</span>
          </div>
        ) : (
          <>
            <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">{statusMessage || 'Esperando'}</span>
          </>
        )}
      </div>
      
      <div className="flex items-center space-x-4">
        {navigationStatus && (
          <div className="bg-dashcam-700 px-3 py-1 rounded-full text-sm flex items-center">
            <FaLocationArrow className="mr-1" />
            <span>{formatDistance(navigationStatus.distance)}</span>
          </div>
        )}
        
        {position && (
          <span className="text-xs">
            {position[0].toFixed(6)}, {position[1].toFixed(6)} | {speed ? `${Math.round(speed * 3.6)} km/h` : 'Speed: N/A'}
          </span>
        )}
      </div>
    </div>
  )
}

export default StatusBar
