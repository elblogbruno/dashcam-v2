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
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col gap-2 w-full pointer-events-none p-4 safe-area-top">
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
