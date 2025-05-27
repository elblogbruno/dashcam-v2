import React, { useEffect } from 'react';
import { useNotificationStore } from '../../services/notificationService';
import NotificationItem from './NotificationItem';

/**
 * Componente que muestra todas las notificaciones activas en la aplicación
 * Las notificaciones se muestran en una lista flotante en la esquina superior derecha
 */
const NotificationCenter = () => {
  const { notifications, removeNotification } = useNotificationStore();

  // Filtrar notificaciones no leídas para mostrarlas
  const activeNotifications = notifications.filter(n => !n.read);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {activeNotifications.map(notification => (
        <NotificationItem 
          key={notification.id} 
          notification={notification} 
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

export default NotificationCenter;
