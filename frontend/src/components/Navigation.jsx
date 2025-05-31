import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavigation } from '../contexts/NavigationContext';

function Navigation() {
  const location = useLocation();
  const { currentPage, setCurrentPage } = useNavigation();
  const [showLabels, setShowLabels] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Auto-hide labels on smaller screens for more space
  useEffect(() => {
    const handleResize = () => {
      setShowLabels(window.innerWidth > 480);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Manejo mejorado para cerrar el menú "más" al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMoreMenu && !event.target.closest('.more-menu-container')) {
        setShowMoreMenu(false);
      }
    };
    
    // Usar mousedown para capturar clics antes de que otros controladores de eventos
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMoreMenu]);
  
  // Cerrar el menú al cambiar de ruta
  useEffect(() => {
    setShowMoreMenu(false);
  }, [location.pathname]);

  // Navigation items with mobile-optimized icons
  // Items principales que siempre aparecen en la barra de navegación móvil
  const primaryNavItems = [
    {
      path: '/',
      name: 'Dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      path: '/calendar',
      name: 'Calendar',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      path: '/map',
      name: 'Live Map',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      path: '/trips',
      name: 'Trips',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    }
  ];
  
  // Items secundarios que aparecen en el menú "Más" en móvil
  const secondaryNavItems = [
    {
      path: '/settings',
      name: 'Settings',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      path: '/storage',
      name: 'Storage',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h.01M12 16h.01" />
        </svg>
      )
    },
    {
      path: '/uploader',
      name: 'Upload',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )
    },
    {
      path: '/landmarks-manager',
      name: 'Landmarks',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
        </svg>
      )
    }
  ];
  
  // Todos los elementos de navegación para desktop
  const allNavItems = [...primaryNavItems, ...secondaryNavItems];

  const handleNavClick = (name) => {
    setCurrentPage(name);
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Íconos para el botón "Más" en la barra de navegación móvil
  const MoreIcon = () => (
    <svg className={`w-6 h-6 transition-transform duration-200 ${showMoreMenu ? 'rotate-90' : ''}`} 
         fill="none" 
         stroke="currentColor" 
         viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );
  
  // Renderizar un elemento de navegación
  const renderNavItem = (item) => {
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => handleNavClick(item.name)}
        className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-200 rounded-xl mx-1 touch-target no-select md:w-16 md:h-16 md:mx-auto md:p-3 md:desktop-nav-item ${
          active
            ? 'text-dashcam-600 bg-dashcam-50 md:active'
            : 'text-gray-600 hover:text-dashcam-600 hover:bg-gray-50 active:bg-gray-100'
        }`}
      >
        <div className={`transition-transform duration-200 ${active ? 'scale-115' : ''}`}>
          {item.icon}
        </div>
        {showLabels && (
          <span className={`text-xs mt-1 font-medium leading-tight text-center ${
            active ? 'text-dashcam-600' : 'text-gray-500'
          }`}>
            {item.name}
          </span>
        )}
        {!showLabels && active && (
          <div className="nav-indicator"></div>
        )}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom shadow-lg md:shadow-none md:border-t-0 md:border-r md:border-gray-100 md:static md:h-full md:w-20 md:flex md:flex-col">
      <div className="flex justify-around items-center h-16 px-2 max-w-7xl mx-auto w-full md:h-full md:flex-col md:justify-start md:pt-10 md:space-y-6">
        {/* Elementos principales en móvil */}
        {primaryNavItems.map(renderNavItem)}
        
        {/* Botón "Más" solo en móvil - mejorado para asegurar visibilidad y manejo de clics */}
        <div className="md:hidden flex-1 relative more-menu-container">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMoreMenu(!showMoreMenu);
            }}
            className={`flex flex-col items-center justify-center w-full py-2 px-1 transition-all duration-200 rounded-xl mx-1 touch-target no-select relative z-[100] ${
              showMoreMenu ? 'text-dashcam-600 bg-dashcam-50' : 'text-gray-600'
            }`}
            aria-label="Mostrar más opciones"
            aria-expanded={showMoreMenu}
          >
            <MoreIcon />
            {showLabels && (
              <span className={`text-xs mt-1 font-medium leading-tight text-center ${
                showMoreMenu ? 'text-dashcam-600' : 'text-gray-500'
              }`}>
                Más
              </span>
            )}
          </button>
          
          {/* Menú desplegable - con mejor posicionamiento, z-index elevado y animación */}
          <div 
            className={`fixed z-[9999] bottom-16 right-1 bg-white rounded-lg shadow-lg border border-gray-200 w-52 p-2 transition-all duration-200 origin-bottom-right transform ${
              showMoreMenu ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'
            }`}
            style={{ 
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
              maxHeight: '80vh',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              borderWidth: '1px',
              borderColor: 'rgba(0, 0, 0, 0.15)'
            }}
          >
            {secondaryNavItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    handleNavClick(item.name);
                    setShowMoreMenu(false);
                  }}
                  className={`flex items-center px-3 py-2 rounded-lg mb-1 touch-target ${
                    active ? 'bg-dashcam-50 text-dashcam-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="mr-3 flex-shrink-0 text-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
                      {item.icon.props.children}
                    </svg>
                  </div>
                  <span className="font-medium text-gray-800">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
        
        {/* Separador visible solo en escritorio */}
        <div className="hidden md:block w-12 h-px bg-gray-200 my-4 mx-auto"></div>
        
        {/* Todos los elementos en desktop */}
        {secondaryNavItems.map((item) => (
          <div key={item.path} className="hidden md:block">
            {renderNavItem(item)}
          </div>
        ))}
      </div>
    </nav>
  );
}

export default Navigation;
