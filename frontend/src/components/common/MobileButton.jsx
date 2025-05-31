import React from 'react';

/**
 * Componente para botones optimizados para móviles
 * Proporciona un botón con un tamaño adecuado para interacción táctil
 * 
 * @param {Object} props - Propiedades del componente
 * @param {React.ReactNode} props.children - Contenido del botón
 * @param {Function} props.onClick - Función a ejecutar al hacer clic
 * @param {string} props.variant - Variante del botón (primary, secondary, outline, text)
 * @param {string} props.size - Tamaño del botón (sm, md, lg)
 * @param {boolean} props.fullWidth - Si es true, el botón ocupa todo el ancho disponible
 * @param {boolean} props.disabled - Si el botón está deshabilitado
 * @param {string} props.className - Clases adicionales para el botón
 */
const MobileButton = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) => {
  // Estilos base
  const baseClasses = 'mobile-button font-medium transition-all duration-200 no-select';
  
  // Estilos de variante
  const variantClasses = {
    primary: 'bg-dashcam-600 text-white hover:bg-dashcam-700 active:bg-dashcam-800',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300',
    outline: 'bg-transparent border border-dashcam-500 text-dashcam-500 hover:bg-dashcam-50',
    text: 'bg-transparent text-dashcam-600 hover:bg-dashcam-50'
  };
  
  // Estilos de tamaño
  const sizeClasses = {
    sm: 'text-sm py-2 px-3',
    md: 'py-2.5 px-4',
    lg: 'text-lg py-3 px-6'
  };
  
  // Estilos de ancho
  const widthClasses = fullWidth ? 'w-full' : '';
  
  // Estilos para estado deshabilitado
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
  
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses} ${disabledClasses} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default MobileButton;
