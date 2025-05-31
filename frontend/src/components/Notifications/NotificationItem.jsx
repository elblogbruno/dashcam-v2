import React, { useEffect } from 'react';
import { FaCheck, FaExclamation, FaInfo, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { NotificationType } from '../../services/notificationService';

/**
 * Componente para mostrar una notificación individual
 */
const NotificationItem = ({ notification, onClose }) => {
  // Establecer un temporizador para cerrar la notificación automáticamente
  useEffect(() => {
    if (notification.timeout) {
      const timer = setTimeout(() => {
        onClose();
      }, notification.timeout);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  // Determinar el color y el icono según el tipo de notificación
  const getNotificationStyles = () => {
    switch (notification.type) {
      case NotificationType.SUCCESS:
        return {
          icon: <FaCheck />,
          bgColor: 'bg-green-500',
          borderColor: 'border-green-600'
        };
      case NotificationType.ERROR:
        return {
          icon: <FaExclamation />,
          bgColor: 'bg-red-500',
          borderColor: 'border-red-600'
        };
      case NotificationType.WARNING:
        return {
          icon: <FaExclamationTriangle />,
          bgColor: 'bg-yellow-500',
          borderColor: 'border-yellow-600'
        };
      case NotificationType.INFO:
      default:
        return {
          icon: <FaInfo />,
          bgColor: 'bg-blue-500',
          borderColor: 'border-blue-600'
        };
    }
  };

  const styles = getNotificationStyles();

  return (
    <div 
      className={`${styles.bgColor} text-white rounded-xl shadow-lg border-l-4 ${styles.borderColor} 
        flex items-start p-4 animate-fadeIn pointer-events-auto mx-auto max-w-sm w-full`}
    >
      <div className="flex-shrink-0 mr-3 mt-0.5 text-lg">
        {styles.icon}
      </div>
      <div className="flex-grow">
        {notification.title && (
          <h4 className="font-semibold text-sm mb-0.5">{notification.title}</h4>
        )}
        <p className="text-sm">{notification.message}</p>
      </div>
      <button 
        onClick={onClose} 
        className="flex-shrink-0 ml-2 text-white hover:text-gray-200 focus:outline-none touch-target"
        aria-label="Cerrar notificación"
      >
        <FaTimes />
      </button>
    </div>
  );
};

export default NotificationItem;
