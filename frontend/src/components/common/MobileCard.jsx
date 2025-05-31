import React from 'react';

/**
 * Componente de tarjeta optimizado para dispositivos móviles
 * Proporciona un contenedor consistente para los elementos de la interfaz
 * 
 * @param {Object} props - Propiedades del componente
 * @param {React.ReactNode} props.children - Contenido de la tarjeta
 * @param {string} props.title - Título opcional de la tarjeta
 * @param {Function} props.onPress - Función a ejecutar al pulsar la tarjeta (opcional)
 * @param {string} props.className - Clases adicionales para la tarjeta
 * @param {boolean} props.noPadding - Si es true, elimina el padding interno
 */
const MobileCard = ({ 
  children, 
  title, 
  onPress, 
  className = '', 
  noPadding = false 
}) => {
  const handlePress = () => {
    if (onPress) onPress();
  };

  return (
    <div 
      className={`mobile-card bg-white ${!noPadding ? 'p-4' : ''} ${onPress ? 'active:bg-gray-50 cursor-pointer' : ''} ${className}`}
      onClick={handlePress}
    >
      {title && (
        <div className="mb-3 border-b border-gray-100 pb-2">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
};

export default MobileCard;
