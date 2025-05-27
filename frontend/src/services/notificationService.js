// Servicio de notificaciones para toda la aplicación
import { create } from 'zustand';

// Store para mantener el estado de las notificaciones
export const useNotificationStore = create((set) => ({
  notifications: [],
  
  addNotification: (notification) => {
    // Generar un ID único para la notificación
    const id = Date.now().toString();
    const newNotification = {
      id,
      timestamp: new Date(),
      read: false,
      ...notification
    };
    
    // Añadir a la lista de notificaciones
    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }));
    
    // Si se especifica un tiempo de expiración, eliminar automáticamente
    if (notification.timeout) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      }, notification.timeout);
    }
    
    return id;
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },
  
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      )
    }));
  },
  
  clearAll: () => {
    set({ notifications: [] });
  }
}));

// Tipos de notificaciones
export const NotificationType = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};

// Función para crear una notificación de éxito
export const showSuccess = (message, options = {}) => {
  return useNotificationStore.getState().addNotification({
    type: NotificationType.SUCCESS,
    message,
    timeout: options.timeout || 5000,
    ...options
  });
};

// Función para crear una notificación de error
export const showError = (message, options = {}) => {
  return useNotificationStore.getState().addNotification({
    type: NotificationType.ERROR,
    message,
    timeout: options.timeout || 8000,
    ...options
  });
};

// Función para crear una notificación informativa
export const showInfo = (message, options = {}) => {
  return useNotificationStore.getState().addNotification({
    type: NotificationType.INFO,
    message,
    timeout: options.timeout || 4000,
    ...options
  });
};

// Función para crear una notificación de advertencia
export const showWarning = (message, options = {}) => {
  return useNotificationStore.getState().addNotification({
    type: NotificationType.WARNING,
    message,
    timeout: options.timeout || 6000,
    ...options
  });
};
