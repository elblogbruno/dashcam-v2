import { useState, useEffect } from 'react'

export const useRaspberryPiDetection = () => {
  // Estado para detección de Raspberry Pi
  const [isRaspberryPi, setIsRaspberryPi] = useState(false);
  
  // Detectar si se está accediendo desde un Raspberry Pi
  useEffect(() => {
    // Para pruebas: Descomenta la siguiente línea para forzar el modo Raspberry Pi
    // return setIsRaspberryPi(true);
    
    // Detectar Raspberry Pi basado en el User Agent o en la resolución de pantalla
    const checkIfRaspberryPi = () => {
      // Verificar si el hostname contiene "raspberrypi" o "pi"
      const isRpiHostname = window.location.hostname.includes('raspberrypi') || 
                           window.location.hostname.includes('pi');
      
      // Verificar si es una pantalla táctil o tiene resolución típica de Raspberry Pi display
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      
      // Resoluciones comunes de pantallas para Raspberry Pi
      const isRpiDisplay = 
        (screenWidth === 800 && screenHeight === 480) || // Display oficial de 7"
        (screenWidth === 480 && screenHeight === 320) || // Display de 3.5"
        (screenWidth === 1024 && screenHeight === 600); // Pantallas táctiles comunes
      
      return isRpiHostname || isRpiDisplay;
    };
    
    const isRpi = checkIfRaspberryPi();
    setIsRaspberryPi(isRpi);
  }, []);

  return isRaspberryPi;
};

export default useRaspberryPiDetection;