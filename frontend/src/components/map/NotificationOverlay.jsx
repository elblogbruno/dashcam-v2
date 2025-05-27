import { FaExclamationTriangle, FaArrowUp } from 'react-icons/fa'

// Formato de distancias para mostrar
const formatDistance = (meters) => {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

function NotificationOverlay({ position, navigationStatus }) {
  return (
    <>
      {/* GPS warning message - movido más abajo para evitar superposición con los controles */}
      {!position && (
        <div className="absolute top-20 left-0 right-0 flex justify-center pointer-events-none z-30">
          <div className="bg-yellow-500 text-white py-2 px-4 rounded-lg flex items-center shadow-lg">
            <FaExclamationTriangle className="mr-2" />
            <span>Esperando señal GPS...</span>
          </div>
        </div>
      )}
      
      {/* Navigation notification - movido más abajo para evitar superposición con los controles */}
      {navigationStatus && navigationStatus.nextPoint && (
        <div className="absolute top-20 left-0 right-0 flex justify-center pointer-events-none z-30">
          <div className="bg-black bg-opacity-75 text-white py-2 px-4 rounded-lg flex items-center shadow-lg">
            <FaArrowUp className="mr-2" />
            <span>
              {navigationStatus.distance < 100 ? 
                `Llegando a ${navigationStatus.nextPoint.name}` : 
                `${formatDistance(navigationStatus.distance)} hasta ${navigationStatus.nextPoint.name}`}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

export default NotificationOverlay
