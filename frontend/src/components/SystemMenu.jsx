import { useState, useRef, useEffect } from 'react';
import { 
  FaPowerOff, 
  FaUndo, 
  FaCog, 
  FaExclamationTriangle,
  FaPlay,
  FaChevronDown 
} from 'react-icons/fa';
import systemControlService from '../services/systemControlService';
import { showSuccess, showError, showInfo, showWarning } from '../services/notificationService';

/**
 * Componente de menú del sistema para controlar apagado, reinicio y pruebas
 */
function SystemMenu({ darkMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef(null);

  // Cerrar menú cuando se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showNotification = (message, type = 'info', title = 'Sistema') => {
    const options = { title };
    
    switch (type) {
      case 'success':
        showSuccess(message, options);
        break;
      case 'error':
        showError(message, options);
        break;
      case 'warning':
        showWarning(message, options);
        break;
      case 'info':
      default:
        showInfo(message, options);
        break;
    }
  };

  const handleGracefulShutdown = async () => {
    if (!confirm('¿Estás seguro de que quieres apagar el sistema? Esta acción guardará todos los datos y apagará el dispositivo de forma segura.')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await systemControlService.gracefulShutdown();
      showNotification(result.message, 'warning', 'Apagado del Sistema');
      setIsOpen(false);
    } catch (error) {
      showNotification(`Error al apagar el sistema: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceShutdown = async () => {
    if (!confirm('⚠️ ADVERTENCIA: ¿Estás seguro de que quieres forzar el apagado? Esta acción apagará inmediatamente el sistema y podría causar pérdida de datos no guardados.')) {
      return;
    }

    if (!confirm('⚠️ ÚLTIMA ADVERTENCIA: Esta acción es irreversible y podría dañar datos. ¿Continuar con el apagado forzado?')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await systemControlService.forceShutdown();
      showNotification(result.message, 'error', 'Apagado Forzado');
      setIsOpen(false);
    } catch (error) {
      showNotification(`Error al forzar apagado: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReboot = async () => {
    if (!confirm('¿Estás seguro de que quieres reiniciar el sistema? Esta acción guardará todos los datos y reiniciará el dispositivo.')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await systemControlService.rebootSystem();
      showNotification(result.message, 'info', 'Reinicio del Sistema');
      setIsOpen(false);
    } catch (error) {
      showNotification(`Error al reiniciar el sistema: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSequence = async () => {
    setIsLoading(true);
    try {
      const result = await systemControlService.testShutdownSequence();
      showNotification(result.message, 'info', 'Prueba de Sistema');
      setIsOpen(false);
    } catch (error) {
      showNotification(`Error en la prueba: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Botón del menú */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
          darkMode
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Menú del sistema"
      >
        <FaCog className="w-4 h-4" />
        <span className="hidden md:inline">Sistema</span>
        <FaChevronDown 
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Menú desplegable */}
      {isOpen && (
        <div className={`absolute right-0 top-full mt-2 w-64 rounded-lg shadow-lg border z-50 ${
          darkMode
            ? 'bg-gray-800 border-gray-600'
            : 'bg-white border-gray-200'
        }`}>
          <div className="py-2">
            {/* Encabezado */}
            <div className={`px-4 py-2 border-b ${
              darkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <h3 className={`font-semibold text-sm ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Control del Sistema
              </h3>
            </div>

            {/* Opciones del menú */}
            <div className="py-1">
              {/* Apagado ordenado */}
              <button
                onClick={handleGracefulShutdown}
                disabled={isLoading}
                className={`w-full px-4 py-2 text-left flex items-center space-x-3 transition-colors ${
                  darkMode
                    ? 'hover:bg-gray-700 text-white'
                    : 'hover:bg-gray-100 text-gray-900'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <FaPowerOff className="w-4 h-4 text-orange-500" />
                <div>
                  <div className="font-medium text-sm">Apagar Sistema</div>
                  <div className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Apagado seguro con guardado de datos
                  </div>
                </div>
              </button>

              {/* Reiniciar */}
              <button
                onClick={handleReboot}
                disabled={isLoading}
                className={`w-full px-4 py-2 text-left flex items-center space-x-3 transition-colors ${
                  darkMode
                    ? 'hover:bg-gray-700 text-white'
                    : 'hover:bg-gray-100 text-gray-900'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <FaUndo className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="font-medium text-sm">Reiniciar Sistema</div>
                  <div className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Reinicio completo del sistema
                  </div>
                </div>
              </button>

              {/* Separador */}
              <div className={`my-1 border-t ${
                darkMode ? 'border-gray-600' : 'border-gray-200'
              }`}></div>

              {/* Prueba de secuencia */}
              <button
                onClick={handleTestSequence}
                disabled={isLoading}
                className={`w-full px-4 py-2 text-left flex items-center space-x-3 transition-colors ${
                  darkMode
                    ? 'hover:bg-gray-700 text-white'
                    : 'hover:bg-gray-100 text-gray-900'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <FaPlay className="w-4 h-4 text-green-500" />
                <div>
                  <div className="font-medium text-sm">Probar Secuencia</div>
                  <div className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Probar LEDs y sonidos sin apagar
                  </div>
                </div>
              </button>

              {/* Separador */}
              <div className={`my-1 border-t ${
                darkMode ? 'border-gray-600' : 'border-gray-200'
              }`}></div>

              {/* Apagado forzado */}
              <button
                onClick={handleForceShutdown}
                disabled={isLoading}
                className={`w-full px-4 py-2 text-left flex items-center space-x-3 transition-colors ${
                  darkMode
                    ? 'hover:bg-red-900 text-white'
                    : 'hover:bg-red-50 text-gray-900'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <FaExclamationTriangle className="w-4 h-4 text-red-500" />
                <div>
                  <div className="font-medium text-sm text-red-600">Apagado Forzado</div>
                  <div className={`text-xs ${
                    darkMode ? 'text-red-400' : 'text-red-500'
                  }`}>
                    ⚠️ Solo en emergencias
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemMenu;
