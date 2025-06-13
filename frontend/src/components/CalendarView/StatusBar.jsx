import { useState, useEffect } from 'react';
import { 
  FaCalendarAlt, 
  FaVideo, 
  FaPlay, 
  FaPause,
  FaClock, 
  FaMapMarkerAlt,
  FaCamera,
  FaTags,
  FaDownload,
  FaExpand,
  FaCompress,
  FaCarSide,
  FaMobileAlt,
  FaUserAlt,
  FaColumns,
  FaChevronDown
} from 'react-icons/fa';
import { Badge } from '../common/UI';
import { format } from 'date-fns';

// Formato de duración de video
const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function CalendarStatusBar({ 
  selectedDate,
  selectedClip,
  isPlaying,
  currentTime,
  duration,
  activeCamera,
  onCameraChange,
  totalClipsCount,
  filteredClipsCount,
  onToggleFullscreen,
  isFullscreen,
  onToggleCalendar,
  isCalendarOpen,
  onExportDay,
  darkMode = false
}) {
  const [currentLocalTime, setCurrentLocalTime] = useState(new Date());
  const [showCameraDropdown, setShowCameraDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Actualizar reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLocalTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Cerrar dropdown de cámara cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCameraDropdown && !event.target.closest('.camera-dropdown-container')) {
        setShowCameraDropdown(false);
      }
    };

    if (showCameraDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCameraDropdown]);

  // Función para obtener el icono de cámara según el tipo activo
  const getCameraIcon = () => {
    switch (activeCamera) {
      case 'exterior': return <FaVideo className="w-3 h-3" />;
      case 'interior': return <FaUserAlt className="w-3 h-3" />;
      case 'both': return <FaColumns className="w-3 h-3" />;
      default: return <FaCamera className="w-3 h-3" />;
    }
  };

  // Función para calcular posición del dropdown
  const handleDropdownToggle = (event) => {
    if (!showCameraDropdown) {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
    setShowCameraDropdown(!showCameraDropdown);
  };

  return (
    <>
      <div className={`relative z-50 backdrop-blur-lg border-b shadow-lg h-12 sm:h-14 md:h-16 min-h-12 sm:min-h-14 md:min-h-16 flex-shrink-0 transition-colors duration-300 ${
        darkMode 
          ? 'bg-gradient-to-r from-neutral-900 to-neutral-800 border-neutral-700' 
          : 'bg-gradient-to-r from-gray-50 to-white border-gray-200'
      }`}>
        {/* Barra principal del StatusBar */}
        <div className="flex items-center justify-between h-full px-2 sm:px-3 md:px-4 max-w-full">
          
          {/* MÓVIL: Layout ultra compacto para pantallas < 640px */}
          <div className="flex sm:hidden items-center justify-between w-full gap-1">
            {/* Izquierda: Calendario + Cámara */}
            <div className="flex items-center gap-1">
              <button 
                className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all duration-200 font-medium text-xs ${
                  isCalendarOpen 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : darkMode
                      ? 'bg-neutral-800 border-neutral-600 text-neutral-200 active:bg-neutral-700'
                      : 'bg-gray-100 border-gray-300 text-gray-700 active:bg-gray-200'
                }`}
                onClick={onToggleCalendar}
                title="Calendar"
              >
                <FaCalendarAlt className="w-3 h-3 flex-shrink-0" />
                <span className="text-xs font-medium">
                  {format(selectedDate, 'dd/MM')}
                </span>
              </button>

              <div className="relative camera-dropdown-container">
                <button
                  onClick={handleDropdownToggle}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border font-medium text-xs transition-all duration-200 ${
                    showCameraDropdown 
                      ? 'bg-blue-500 border-blue-500 text-white' 
                      : darkMode
                        ? 'bg-neutral-800 border-neutral-600 text-neutral-200 active:bg-neutral-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 active:bg-gray-200'
                  }`}
                >
                  {getCameraIcon()}
                  <FaChevronDown className={`w-2 h-2 transition-transform duration-200 ${showCameraDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Centro: Video info mínima */}
            <div className="flex-1 flex items-center justify-center min-w-0 overflow-hidden">
              {selectedClip ? (
                <div className={`flex items-center gap-1 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                  {isPlaying ? (
                    <FaPlay className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <FaPause className={`w-2.5 h-2.5 ${darkMode ? 'text-neutral-400' : 'text-gray-400'} flex-shrink-0`} />
                  )}
                  <span className="text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap max-w-16">
                    {formatDuration(currentTime)}
                  </span>
                </div>
              ) : (
                <span className={`text-xs font-medium ${darkMode ? 'text-neutral-400' : 'text-gray-400'}`}>--:--</span>
              )}
            </div>

            {/* Derecha: Tiempo + Descarga (prioridad sobre pantalla completa en móvil) */}
            <div className="flex items-center gap-1">
              <span className={`text-xs font-medium ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                {format(currentLocalTime, 'HH:mm')}
              </span>
              <button 
                className={`flex items-center justify-center w-7 h-7 border rounded-md transition-all duration-200 ${
                  darkMode 
                    ? 'bg-neutral-800 border-neutral-600 text-neutral-200 active:bg-neutral-700'
                    : 'bg-gray-100 border-gray-300 text-gray-700 active:bg-gray-200'
                }`}
                onClick={onExportDay}
                title="Descargar día"
              >
                <FaDownload className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* TABLET: Layout mejorado para pantallas sm (640px - 768px) */}
          <div className="hidden sm:flex md:hidden items-center justify-between w-full gap-2">
            {/* Izquierda */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 font-medium text-xs ${
                  isCalendarOpen 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : darkMode
                      ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={onToggleCalendar}
                title="Toggle Calendar"
              >
                <FaCalendarAlt className="w-3 h-3 flex-shrink-0" />
                <span className="text-xs font-medium">
                  {format(selectedDate, 'dd MMM')}
                </span>
              </button>

              <div className={`flex items-center gap-1 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                <FaVideo className="w-3 h-3 text-blue-500 flex-shrink-0" />
                <span className="text-xs font-medium">
                  {filteredClipsCount}
                </span>
              </div>
            </div>

            {/* Centro */}
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden">
              {selectedClip ? (
                <>
                  <div className={`flex items-center gap-1 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                    {isPlaying ? (
                      <FaPlay className="w-3 h-3 text-green-500 flex-shrink-0" />
                    ) : (
                      <FaPause className={`w-3 h-3 ${darkMode ? 'text-neutral-400' : 'text-gray-400'} flex-shrink-0`} />
                    )}
                    <span className="text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap max-w-24">
                      {selectedClip.filename ? selectedClip.filename.split('.')[0] : 'Sin título'}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                    <FaClock className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-medium whitespace-nowrap">
                      {formatDuration(currentTime)}/{formatDuration(duration)}
                    </span>
                  </div>
                </>
              ) : (
                <span className={`text-xs font-medium ${darkMode ? 'text-neutral-400' : 'text-gray-400'}`}>
                  Seleccionar video
                </span>
              )}
            </div>

            {/* Derecha */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative camera-dropdown-container">
                <button
                  onClick={handleDropdownToggle}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium text-xs transition-all duration-200 ${
                    showCameraDropdown 
                      ? 'bg-blue-500 border-blue-500 text-white' 
                      : darkMode
                        ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FaCamera className="w-3 h-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">
                    {activeCamera === 'exterior' ? 'Ext' : 
                     activeCamera === 'interior' ? 'Int' : 'Both'}
                  </span>
                  <FaChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${showCameraDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <span className={`text-xs font-medium ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                {format(currentLocalTime, 'HH:mm')}
              </span>

              <button 
                className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                  darkMode 
                    ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={onExportDay}
                title="Descargar día"
              >
                <FaDownload className="w-3 h-3" />
              </button>

              <button 
                className={`flex items-center justify-center w-8 h-8 border rounded-lg transition-all duration-200 ${
                  darkMode 
                    ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={onToggleFullscreen}
                title="Fullscreen"
              >
                {isFullscreen ? (
                  <FaCompress className="w-3 h-3" />
                ) : (
                  <FaExpand className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* DESKTOP: Layout completo para pantallas md+ (768px+) */}
          <div className="hidden md:flex items-center justify-between w-full gap-4">
            {/* Sección izquierda */}
            <div className="flex items-center gap-4 flex-shrink-0 min-w-0">
              <button 
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 font-medium text-sm whitespace-nowrap hover:transform hover:-translate-y-0.5 ${
                  isCalendarOpen 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : darkMode
                      ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-500'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400'
                }`}
                onClick={onToggleCalendar}
                title="Toggle Calendar"
              >
                <FaCalendarAlt className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {format(selectedDate, 'dd MMM yyyy')}
                </span>
              </button>

              <div className={`flex items-center gap-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                <FaVideo className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {filteredClipsCount !== totalClipsCount 
                    ? `${filteredClipsCount}/${totalClipsCount} clips`
                    : `${totalClipsCount} clips`
                  }
                </span>
              </div>

              <div className={`flex items-center gap-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                <FaCamera className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <div className="relative camera-dropdown-container">
                  <button
                    onClick={handleDropdownToggle}
                    className={`flex items-center gap-2 px-3 py-1.5 min-w-24 rounded-lg border font-medium text-sm cursor-pointer transition-all duration-200 hover:transform hover:-translate-y-0.5 ${
                      showCameraDropdown 
                        ? 'bg-blue-500 border-blue-500 text-white' 
                        : darkMode
                          ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-500'
                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span className="flex-1 text-left whitespace-nowrap">
                      {activeCamera === 'exterior' ? 'Exterior' : 
                       activeCamera === 'interior' ? 'Interior' : 'Ambas'}
                    </span>
                    <FaChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${showCameraDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Sección central */}
            <div className="flex-1 flex items-center justify-center gap-4 min-w-0 overflow-hidden">
              {selectedClip ? (
                <>
                  <div className={`flex items-center gap-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                    {isPlaying ? (
                      <FaPlay className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <FaPause className={`w-3.5 h-3.5 ${darkMode ? 'text-neutral-400' : 'text-gray-400'} flex-shrink-0`} />
                    )}
                    <span className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                      {selectedClip.filename ? selectedClip.filename.split('.')[0] : 'Sin título'}
                    </span>
                  </div>

                  <div className={`flex items-center gap-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                    <FaClock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">
                      {formatDuration(currentTime)} / {formatDuration(duration)}
                    </span>
                  </div>

                  {selectedClip.gps_lat && selectedClip.gps_lon && (
                    <div className={`flex items-center gap-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                      <FaMapMarkerAlt className="w-3.5 h-3.5 text-green-500 flex-shrink-0 animate-pulse" />
                      <span className="text-sm font-medium">GPS</span>
                    </div>
                  )}

                  {selectedClip.tags && selectedClip.tags.length > 0 && (
                    <div className={`hidden lg:flex items-center gap-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                      <FaTags className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        {selectedClip.tags.slice(0, 2).join(', ')}
                        {selectedClip.tags.length > 2 && ` +${selectedClip.tags.length - 2}`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${darkMode ? 'text-neutral-400' : 'text-gray-400'}`}>
                    Selecciona un clip para reproducir
                  </span>
                </div>
              )}
            </div>

            {/* Sección derecha */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className={`flex items-center gap-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>
                <FaClock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {format(currentLocalTime, 'HH:mm:ss')}
                </span>
              </div>

              <button 
                className={`flex items-center justify-center w-10 h-10 border rounded-lg transition-all duration-200 cursor-pointer hover:transform hover:-translate-y-0.5 active:transform active:translate-y-0 ${
                  darkMode 
                    ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-500'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400'
                }`}
                onClick={onToggleFullscreen}
                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen ? (
                  <FaCompress className="w-3.5 h-3.5" />
                ) : (
                  <FaExpand className="w-3.5 h-3.5" />
                )}
              </button>

              <button 
                className={`flex items-center justify-center w-10 h-10 border rounded-lg transition-all duration-200 cursor-pointer hover:transform hover:-translate-y-0.5 active:transform active:translate-y-0 ${
                  darkMode 
                    ? 'bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-500'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400'
                }`}
                onClick={onExportDay}
                title="Exportar clips del día"
              >
                <FaDownload className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown de cámara posicionado con portal para evitar problemas de overflow */}
      {showCameraDropdown && (
        <div 
          className={`fixed border rounded-md shadow-2xl z-[9999] overflow-hidden backdrop-blur-lg ${
            darkMode 
              ? 'bg-neutral-800 border-neutral-600' 
              : 'bg-white border-gray-300'
          }`}
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: '80px'
          }}
        >
          <button
            onClick={() => {
              onCameraChange('exterior');
              setShowCameraDropdown(false);
            }}
            className={`flex items-center gap-1 px-2 py-1.5 w-full text-left text-xs font-medium transition-all duration-200 ${
              activeCamera === 'exterior' 
                ? 'bg-blue-500 text-white' 
                : darkMode
                  ? 'text-neutral-200 hover:bg-neutral-700'
                  : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FaVideo className="w-2.5 h-2.5" />
            <span>Ext</span>
          </button>
          <button
            onClick={() => {
              onCameraChange('interior');
              setShowCameraDropdown(false);
            }}
            className={`flex items-center gap-1 px-2 py-1.5 w-full text-left text-xs font-medium transition-all duration-200 ${
              activeCamera === 'interior' 
                ? 'bg-blue-500 text-white' 
                : darkMode
                  ? 'text-neutral-200 hover:bg-neutral-700'
                  : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FaUserAlt className="w-2.5 h-2.5" />
            <span>Int</span>
          </button>
          <button
            onClick={() => {
              onCameraChange('both');
              setShowCameraDropdown(false);
            }}
            className={`flex items-center gap-1 px-2 py-1.5 w-full text-left text-xs font-medium transition-all duration-200 ${
              activeCamera === 'both' 
                ? 'bg-blue-500 text-white' 
                : darkMode
                  ? 'text-neutral-200 hover:bg-neutral-700'
                  : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FaColumns className="w-2.5 h-2.5" />
            <span>Both</span>
          </button>
        </div>
      )}
    </>
  );
}

export default CalendarStatusBar;
