import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const NavigationContext = createContext({
  currentRoute: '/',
  isDashboard: true,
  isMapPage: false,
  shouldStreamBeActive: true
});

export function NavigationProvider({ children }) {
  const location = useLocation();
  const [currentRoute, setCurrentRoute] = useState(location.pathname);
  
  useEffect(() => {
    setCurrentRoute(location.pathname);
  }, [location.pathname]);
  
  const isDashboard = currentRoute === '/';
  const isMapPage = currentRoute === '/map';
  
  // Los streams deben estar activos solo en el dashboard
  const shouldStreamBeActive = isDashboard;
  
  const value = {
    currentRoute,
    isDashboard,
    isMapPage,
    shouldStreamBeActive
  };
  
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation debe usarse dentro de NavigationProvider');
  }
  return context;
}
