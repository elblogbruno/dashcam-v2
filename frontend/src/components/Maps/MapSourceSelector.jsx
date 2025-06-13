import React, { useState, useEffect } from 'react';
import { FaGlobe, FaMapMarked, FaCaretDown, FaInfoCircle } from 'react-icons/fa';
import { showInfo } from '../../services/notificationService';
import OfflineMapsInfo from './OfflineMapsInfo';

/**
 * Componente que muestra un selector de fuente de mapa
 */
const MapSourceSelector = ({ 
  mapSource, 
  setMapSource,
  offlineMapsAvailable,
  tripId
}) => {
  const [showMapOptions, setShowMapOptions] = useState(false);
  const [mapSourceOptions, setMapSourceOptions] = useState(['online']);
  const [showOfflineInfo, setShowOfflineInfo] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState('down');
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = React.useRef(null);
  const buttonRef = React.useRef(null);

  // Determinar dirección del dropdown basado en el espacio disponible
  const calculateDropdownDirection = () => {
    if (!buttonRef.current) return 'down';
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const dropdownHeight = 120; // Estimación aproximada de altura del dropdown
    
    // En pantallas pequeñas (móvil), usar lógica especial
    if (isMobile) {
      // Si estamos muy cerca del borde inferior, mostrar hacia arriba
      if (buttonRect.bottom > viewportHeight * 0.7) {
        return 'up';
      }
      // Si estamos muy cerca del borde superior, mostrar hacia abajo
      if (buttonRect.top < viewportHeight * 0.3) {
        return 'down';
      }
    }
    
    // Si hay suficiente espacio abajo, usar 'down', sino usar 'up'
    if (spaceBelow >= dropdownHeight) {
      return 'down';
    } else if (spaceAbove >= dropdownHeight) {
      return 'up';
    } else {
      // Si no hay espacio suficiente en ningún lado, preferir abajo
      return 'down';
    }
  };

  // Detectar si es móvil
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Determinar qué opciones de mapa mostrar según la disponibilidad
  useEffect(() => {
    // Siempre mostrar ambas opciones, incluso si offline no está disponible aún
    // Esto permite al usuario seleccionar la preferencia para cuando estén disponibles
    const options = ['online', 'offline'];
    setMapSourceOptions(options);
  }, [offlineMapsAvailable]);

  // Actualizar dirección del dropdown cuando se abre
  useEffect(() => {
    if (showMapOptions) {
      const direction = calculateDropdownDirection();
      setDropdownDirection(direction);
      
      // En móvil, hacer scroll para asegurar que el dropdown sea visible
      if (isMobile) {
        setTimeout(() => {
          if (dropdownRef.current) {
            dropdownRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'nearest'
            });
          }
        }, 100);
      }
    }
  }, [showMapOptions]);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Excluir el botón y el dropdown del "click outside"
      if (dropdownRef.current && 
          !dropdownRef.current.contains(event.target) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target)) {
        setShowMapOptions(false);
      }
    };

    if (showMapOptions) {
      // Usar un pequeño delay para evitar conflictos con el click del botón
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
        document.addEventListener('touchstart', handleClickOutside, true);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside, true);
        document.removeEventListener('touchstart', handleClickOutside, true);
      };
    }
  }, [showMapOptions]);
  
  // Obtener el icono según la fuente de mapa
  const getMapSourceIcon = () => {
    switch (mapSource) {
      case 'offline': return <FaMapMarked size={12} />;
      default: return <FaGlobe size={12} />;
    }
  };
  
  // Obtener el texto según la fuente de mapa
  const getMapSourceText = () => {
    switch (mapSource) {
      case 'offline': return 'Mapas OSM Offline';
      default: return 'Mapas Online';
    }
  };
  
  // Obtener el color del botón según la fuente
  const getButtonClass = () => {
    switch (mapSource) {
      case 'offline': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowMapOptions(!showMapOptions);
          }}
          className={`${getButtonClass()} text-white px-3 py-2 rounded-md shadow-md flex items-center justify-center text-xs min-h-[44px] touch-manipulation w-full`}
          title="Cambiar fuente de mapas"
        >
          <span className="flex items-center">
            {getMapSourceIcon()}
            <span className="ml-1 text-xs hidden sm:inline">{getMapSourceText()}</span>
            <span className="ml-1 text-xs sm:hidden">
              {mapSource === 'offline' ? 'OSM' : 'Online'}
            </span>
            <FaCaretDown 
              className={`ml-1 transition-transform duration-200 ${
                showMapOptions ? 'rotate-180' : 'rotate-0'
              }`} 
              size={10} 
            />
          </span>
        </button>
        
        {showMapOptions && (
          <div 
            ref={dropdownRef}
            className={`absolute w-full min-w-[160px] bg-white rounded-md shadow-xl overflow-hidden z-[9999] border border-gray-200 ${
              dropdownDirection === 'up' 
                ? 'bottom-full mb-2' 
                : 'top-full mt-2'
            } ${
              // En móvil, hacer el dropdown más prominente y centrado
              isMobile 
                ? 'left-1/2 transform -translate-x-1/2 min-w-[200px] shadow-2xl' 
                : 'right-0'
            }`}
          >
            {mapSourceOptions.map((source) => (
              <button 
                key={source}
                onClick={(e) => {
                  e.stopPropagation();
                  setMapSource(source);
                  setShowMapOptions(false);
                  localStorage.setItem('preferredMapSource', source);
                  const messages = {
                    'online': 'Usando mapas online (requiere conexión a Internet)',
                    'offline': 'Usando mapas offline descargados (OSM)'
                  };
                  showInfo(messages[source] || 'Cambiando fuente de mapas...', {
                    title: 'Fuente de mapas',
                    timeout: 3000
                  });
                }}
                className={`w-full text-left px-4 py-3 text-sm ${
                  mapSource === source ? 'bg-gray-100 font-medium' : ''
                } hover:bg-gray-100 active:bg-gray-200 flex items-center min-h-[44px] touch-manipulation transition-colors duration-150`}
              >
                {source === 'offline' && <FaMapMarked className="mr-2" size={12} />}
                {source === 'online' && <FaGlobe className="mr-2" size={12} />}
                {source === 'offline' && 'Mapas OSM Offline'}
                {source === 'online' && 'Mapas Online'}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Botón de información para mapas offline */}
      {offlineMapsAvailable && (
        <div className="mt-1">
          <button
            onClick={() => setShowOfflineInfo(!showOfflineInfo)}
            className="text-xs flex items-center text-gray-300 hover:text-white w-full justify-center"
            title="Ver información de mapas offline"
          >
            <FaInfoCircle className="mr-1" size={10} />
            <span>Información de mapas offline</span>
          </button>
        </div>
      )}
      
      {/* Panel de información de mapas offline */}
      <div className={`mt-1 transition-all duration-300 overflow-hidden ${showOfflineInfo ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <OfflineMapsInfo tripId={tripId} isVisible={showOfflineInfo} />
      </div>
    </div>
  );
};

export default MapSourceSelector;
