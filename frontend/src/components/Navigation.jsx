import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavigation } from '../contexts/NavigationContext';
import { Flex } from './common/Layout';
import { Button, Badge } from './common/UI';

function Navigation({ darkMode }) {
  const location = useLocation();
  const { currentPage, setCurrentPage } = useNavigation();
  const [showLabels, setShowLabels] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  // Si no se proporciona darkMode como prop, intentamos detectar el tema del sistema
  const isDarkMode = darkMode !== undefined ? darkMode : document.documentElement.classList.contains('dark-mode');

  // Auto-hide labels on smaller screens for more space
  useEffect(() => {
    const handleResize = () => {
      setShowLabels(window.innerWidth > 480);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Enhanced handling to close "more" menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMoreMenu && !event.target.closest('.more-menu-container')) {
        setShowMoreMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMoreMenu]);
  
  // Close menu when route changes
  useEffect(() => {
    setShowMoreMenu(false);
  }, [location.pathname]);

  // Primary navigation items that always appear in mobile navigation bar
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
  
  // Secondary navigation items that appear in "More" menu on mobile
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

  const handleNavClick = (name) => {
    setCurrentPage(name);
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // More icon for mobile navigation bar
  const MoreIcon = () => (
    <svg className={`w-6 h-6 transition-transform duration-200 ${showMoreMenu ? 'rotate-90' : ''}`} 
         fill="none" 
         stroke="currentColor" 
         viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );
  
  // Render navigation item with unified design system
  const renderNavItem = (item) => {
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => handleNavClick(item.name)}
        className={`group flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-200 rounded-xl mx-1 min-h-[48px] md:w-16 md:h-16 md:mx-auto md:p-3 ${
          active
            ? isDarkMode
              ? 'text-primary-400 bg-primary-900/40 shadow-sm'
              : 'text-primary-600 bg-primary-50 shadow-sm'
            : isDarkMode
              ? 'text-gray-300 hover:text-primary-400 hover:bg-neutral-700 active:bg-neutral-600'
              : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50 active:bg-gray-100'
        }`}
      >
        <div className={`transition-all duration-200 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
          {item.icon}
        </div>
        {showLabels && (
          <span className={`text-xs mt-1 font-medium leading-tight text-center ${
            active 
              ? isDarkMode 
                ? 'text-primary-400' 
                : 'text-primary-600'
              : isDarkMode
                ? 'text-gray-400'
                : 'text-gray-500'
          }`}>
            {item.name}
          </span>
        )}
        {!showLabels && active && (
          <div className="w-1 h-1 bg-primary-600 rounded-full mt-1"></div>
        )}
      </Link>
    );
  };

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 pb-safe shadow-lg backdrop-blur-sm md:shadow-none md:border-t-0 md:border-r md:static md:h-full md:w-20 md:flex md:flex-col ${
      isDarkMode 
        ? 'bg-neutral-800/95 border-t border-neutral-700 md:border-neutral-700 md:bg-neutral-800/100' 
        : 'bg-white/95 border-t border-gray-200 md:border-gray-100 md:bg-white/100'
    }`}>
      <Flex 
        align="center" 
        justify="around" 
        className="h-16 px-2 max-w-7xl mx-auto w-full md:h-full md:flex-col md:justify-start md:pt-10 md:space-y-6"
      >
        {/* Primary navigation items */}
        {primaryNavItems.map(renderNavItem)}
        
        {/* More button for mobile only */}
        <div className="md:hidden flex-1 relative more-menu-container">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowMoreMenu(!showMoreMenu);
            }}
            className={`flex flex-col items-center justify-center w-full py-2 px-1 transition-all duration-200 rounded-xl mx-1 min-h-[48px] relative ${
              showMoreMenu 
                ? isDarkMode 
                  ? 'text-primary-400 bg-primary-900/40' 
                  : 'text-primary-600 bg-primary-50'
                : isDarkMode
                  ? 'text-gray-300'
                  : 'text-gray-600'
            }`}
            aria-label="Mostrar más opciones"
            aria-expanded={showMoreMenu}
          >
            <MoreIcon />
            {showLabels && (
              <span className={`text-xs mt-1 font-medium leading-tight text-center ${
                showMoreMenu 
                  ? isDarkMode 
                    ? 'text-primary-400' 
                    : 'text-primary-600'
                  : isDarkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}>
                Más
              </span>
            )}
          </Button>
          
          {/* Dropdown menu with enhanced styling */}
          <div 
            className={`fixed z-[9999] bottom-16 right-1 rounded-lg shadow-xl border w-52 p-2 transition-all duration-200 origin-bottom-right ${
              showMoreMenu ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'
            } ${isDarkMode 
              ? 'bg-neutral-800 border-neutral-700 text-white' 
              : 'bg-white border-gray-200 text-gray-800'
            }`}
            style={{ 
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '80vh',
              overflowY: 'auto'
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
                  className={`flex items-center px-3 py-2 rounded-lg mb-1 min-h-[44px] transition-all duration-200 ${
                    active 
                      ? isDarkMode 
                        ? 'bg-primary-900/40 text-primary-400 shadow-sm' 
                        : 'bg-primary-50 text-primary-600 shadow-sm' 
                      : isDarkMode
                        ? 'hover:bg-neutral-700 text-neutral-300 hover:text-white'
                        : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                  }`}
                >
                  <div className="mr-3 flex-shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
        
        {/* Separator for desktop */}
        <div className="hidden md:block w-12 h-px bg-gray-200 my-4 mx-auto"></div>
        
        {/* All secondary items for desktop */}
        {secondaryNavItems.map((item) => (
          <div key={item.path} className="hidden md:block">
            {renderNavItem(item)}
          </div>
        ))}
      </Flex>
    </nav>
  );
}

export default Navigation;
