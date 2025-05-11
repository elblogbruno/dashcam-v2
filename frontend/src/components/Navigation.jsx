import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FaCar, FaCalendarAlt, FaCog, FaCloudUploadAlt, 
  FaHdd, FaMap, FaRoute, FaBars, FaTimes, FaEllipsisH
} from 'react-icons/fa';
import useRaspberryPiDetection from '../hooks/useRaspberryPiDetection';

const Navigation = () => {
  const isRaspberryPi = useRaspberryPiDetection();
  // En Raspberry Pi, la barra de navegación se oculta por defecto
  const [showNavbar, setShowNavbar] = useState(!isRaspberryPi);
  // Estado para controlar la visibilidad del menú adicional
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const toggleNavbar = () => {
    setShowNavbar(!showNavbar);
    if (showMoreMenu) setShowMoreMenu(false);
  };

  const toggleMoreMenu = () => {
    setShowMoreMenu(!showMoreMenu);
  };

  // Definición de los elementos principales y secundarios de navegación
  const primaryNavItems = [
    { path: '/', icon: <FaCar className="text-xl mb-1" />, label: 'Dashboard', exact: true },
    { path: '/map', icon: <FaMap className="text-xl mb-1" />, label: 'Map', exact: false },
    { path: '/trips', icon: <FaRoute className="text-xl mb-1" />, label: 'Trips', exact: false },
  ];
  
  const secondaryNavItems = [
    { path: '/calendar', icon: <FaCalendarAlt className="text-xl mb-1" />, label: 'Calendar', exact: false },
    { path: '/uploader', icon: <FaCloudUploadAlt className="text-xl mb-1" />, label: 'Upload', exact: false },
    { path: '/storage', icon: <FaHdd className="text-xl mb-1" />, label: 'Storage', exact: false },
    { path: '/settings', icon: <FaCog className="text-xl mb-1" />, label: 'Settings', exact: false },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      {/* Botón hamburguesa para mostrar/ocultar la navegación solo en modo Raspberry Pi */}
      {isRaspberryPi && (
        <button 
          className="absolute -top-12 right-4 p-3 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full shadow-lg transition-all z-10"
          onClick={toggleNavbar}
          aria-label={showNavbar ? "Ocultar navegación" : "Mostrar navegación"}
        >
          {showNavbar ? <FaTimes /> : <FaBars />}
        </button>
      )}
      
      {/* Barra de navegación - visible por defecto en PC, oculta por defecto en Raspberry Pi */}
      {showNavbar && (
        <nav className="flex justify-center overflow-x-auto relative">
          <div className="flex min-w-fit md:min-w-0 items-center">
            {/* Elementos de navegación principales - siempre visibles */}
            {primaryNavItems.map((item) => (
              <NavLink 
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex flex-col items-center py-2 px-3 sm:px-4 ${isActive ? 'text-dashcam-600' : 'text-gray-500 hover:text-dashcam-500'}`
                }
                end={item.exact}
              >
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </NavLink>
            ))}
            
            {/* Botón para mostrar más opciones (solo visible en móvil) */}
            <div className="md:hidden relative">
              <button
                type="button"
                className="flex flex-col items-center py-2 px-3 sm:px-4 text-gray-500 hover:text-dashcam-500"
                onClick={toggleMoreMenu}
                aria-label={showMoreMenu ? "Ocultar opciones adicionales" : "Mostrar más opciones"}
              >
                <FaEllipsisH className="text-xl mb-1" />
                <span className="text-xs">Más</span>
              </button>
            </div>
            
            {/* Elementos de navegación secundarios - siempre visibles en desktop, ocultos en móvil */}
            {secondaryNavItems.map((item) => (
              <div key={item.path} className="hidden md:block">
                <NavLink 
                  to={item.path} 
                  className={({ isActive }) => 
                    `flex flex-col items-center py-2 px-3 sm:px-4 ${isActive ? 'text-dashcam-600' : 'text-gray-500 hover:text-dashcam-500'}`
                  }
                  end={item.exact}
                >
                  {item.icon}
                  <span className="text-xs">{item.label}</span>
                </NavLink>
              </div>
            ))}
          </div>
        </nav>
      )}
      
      {/* Menú desplegable flotante para opciones adicionales en móvil */}
      {showMoreMenu && (
        <div 
          className="absolute bottom-full right-4 mb-2 bg-white border border-gray-200 shadow-xl rounded-lg z-50 w-48"
          style={{ maxHeight: '70vh', overflowY: 'auto' }}
        >
          {secondaryNavItems.map((item) => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className={({ isActive }) => 
                `flex items-center py-3 px-4 ${isActive ? 'text-dashcam-600' : 'text-gray-700 hover:text-dashcam-500 hover:bg-gray-50'}`
              }
              end={item.exact}
              onClick={() => setShowMoreMenu(false)}
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

export default Navigation;