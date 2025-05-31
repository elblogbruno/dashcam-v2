import { FaSun, FaMoon } from 'react-icons/fa'

/**
 * Componente de barra de estado que muestra información del sistema y controles
 */
function StatusBar({ 
  isConnected, 
  recordingStatus, 
  isMapPage, 
  darkMode, 
  onToggleDarkMode 
}) {
  return (
    <div 
      className={`py-2 px-3 md:py-3 md:px-6 lg:px-8 flex justify-between items-center z-40 shadow-md safe-area-top sticky top-0 no-select w-full desktop-header transition-all duration-200 ${
        darkMode 
          ? 'bg-gray-900 text-white' 
          : 'bg-dashcam-800 text-white'
      } ${isMapPage ? 'md:hidden' : ''}`}
    >
      <h1 className="text-lg md:text-2xl font-bold">Smart Dashcam</h1>
      
      <div className="flex items-center space-x-3 md:space-x-6">
        {/* Estado de conexión */}
        <div className="flex items-center touch-target px-2 py-1">
          <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${
            isConnected 
              ? 'bg-green-500 animate-pulse' 
              : 'bg-red-500'
          } ${!isConnected && 'ring-1 ring-red-300 animate-ping'}`}></div>
          <span className="text-sm md:text-base font-medium ml-1.5">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        {/* Estado de grabación */}
        <div className="flex items-center touch-target px-2 py-1">
          <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${
            recordingStatus 
              ? 'bg-red-500 animate-pulse' 
              : 'bg-gray-500'
          }`}></div>
          <span className="text-sm md:text-base font-medium ml-1.5">
            {recordingStatus ? 'Recording' : 'Standby'}
          </span>
        </div>
        
        {/* Botón para alternar tema oscuro/claro */}
        <button 
          onClick={onToggleDarkMode}
          className="flex items-center bg-white/10 hover:bg-white/20 px-3 py-1 rounded-md text-sm transition-colors"
          aria-label="Cambiar tema"
          title="Cambiar tema claro/oscuro"
        >
          {darkMode ? <FaSun className="text-yellow-400" /> : <FaMoon className="text-gray-300" />}
        </button>
      </div>
    </div>
  )
}

export default StatusBar
