import React, { useState, useEffect } from 'react';
import { FaMapMarkedAlt, FaCircleNotch } from 'react-icons/fa';

// Indicador de carga optimizado para evitar parpadeos y ser menos intrusivo
const MapLoadingIndicator = ({ loading, count, minimal = true }) => {
  const [visible, setVisible] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(null);
  const [fadeOut, setFadeOut] = useState(false);
  
  // Solo mostrar el indicador si la carga toma más de 400ms
  // Esto evita flashes rápidos de carga para actualizaciones menores
  useEffect(() => {
    if (loading) {
      // Limpiamos cualquier timeout pendiente
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
      
      // Si ya estamos en fadeOut, cancelamos
      if (fadeOut) {
        setFadeOut(false);
      }
      
      // Mostramos el indicador después de cierto tiempo
      const timeout = setTimeout(() => {
        setVisible(true);
      }, 400);
      
      setLoadTimeout(timeout);
    } else {
      // Al detener la carga, en lugar de ocultar inmediatamente, hacemos un fade out
      if (visible) {
        setFadeOut(true);
        
        // Ocultamos después de la animación
        const hideTimeout = setTimeout(() => {
          setVisible(false);
          setFadeOut(false);
        }, 500); // Duración de la transición CSS
        
        setLoadTimeout(hideTimeout);
      }
    }
    
    // Limpiar el timeout al desmontar
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [loading, visible]);
  
  if (!visible) return null;
  
  // Versión mínima (por defecto) muestra solo un indicador pequeño en la esquina
  // con animación de fade-in/fade-out suave y mucha transparencia
  if (minimal) {
    return (
      <div className={`absolute bottom-4 right-4 bg-white/60 backdrop-blur-sm rounded-full h-7 px-3 shadow-sm z-[900] 
                       pointer-events-none flex items-center gap-1.5 transition-opacity duration-500 ease-in-out
                       ${fadeOut ? 'opacity-0' : 'opacity-80'}`}>
        <FaCircleNotch className="text-primary-500 animate-spin h-3 w-3" />
        <span className="text-xs font-medium text-gray-700">
          {count ? `${count} landmarks` : 'Cargando'}
        </span>
      </div>
    );
  }
  
  // Versión completa (pantalla completa) - más sutil y transparente
  return (
    <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-md z-[900] 
                   pointer-events-none transition-opacity duration-500 ease-in-out
                   ${fadeOut ? 'opacity-0' : 'opacity-90'}">
      <div className="flex items-center gap-2">
        <FaCircleNotch className="text-primary-500 animate-spin h-4 w-4" />
        <div className="text-left">
          <p className="text-sm font-medium text-gray-800">Cargando mapa</p>
          {count > 0 && (
            <p className="text-xs text-gray-600">
              {count} landmarks
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapLoadingIndicator;
