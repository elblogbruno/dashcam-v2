import React, { useState } from 'react';
import axios from 'axios';
import { showSuccess, showError, showInfo, showWarning } from '../services/notificationService';

const NotificationTester = () => {
  const [message, setMessage] = useState('Esta es una notificación de prueba');
  const [title, setTitle] = useState('Notificación de prueba');
  const [type, setType] = useState('info');
  const [loading, setLoading] = useState(false);

  // Función para enviar una notificación solo a través del servicio local
  const sendLocalNotification = () => {
    switch (type) {
      case 'success':
        showSuccess(message, { title });
        break;
      case 'error':
        showError(message, { title });
        break;
      case 'warning':
        showWarning(message, { title });
        break;
      case 'info':
      default:
        showInfo(message, { title });
        break;
    }
  };

  // Función para enviar una notificación a través del backend (sin audio)
  const sendBackendNotification = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/audio/notifications/test', {
        message,
        title,
        type
      });
      console.log('Notificación enviada:', response.data);
    } catch (error) {
      console.error('Error al enviar la notificación:', error);
      showError('Error al enviar la notificación: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Función para enviar una notificación a través del backend (con audio)
  const sendBackendNotificationWithAudio = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/audio/notifications/announce', {
        message,
        title,
        type
      });
      console.log('Notificación con audio enviada:', response.data);
    } catch (error) {
      console.error('Error al enviar la notificación con audio:', error);
      showError('Error al enviar la notificación con audio: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Probador de Notificaciones</h1>
        <a href="/settings#debug-section" className="text-dashcam-600 hover:text-dashcam-800 text-sm">
          &larr; Volver a Configuración
        </a>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="message">
            Mensaje:
          </label>
          <input
            id="message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="title">
            Título:
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 mb-2" htmlFor="type">
            Tipo:
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="info">Información</option>
            <option value="success">Éxito</option>
            <option value="error">Error</option>
            <option value="warning">Advertencia</option>
          </select>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <button
            onClick={sendLocalNotification}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Enviar Notificación Local
          </button>
          
          <button
            onClick={sendBackendNotification}
            disabled={loading}
            className={`bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Enviar Notificación Backend
          </button>
          
          <button
            onClick={sendBackendNotificationWithAudio}
            disabled={loading}
            className={`bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Enviar Notificación + Audio
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Instrucciones:</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Enviar Notificación Local</strong>: Usa el servicio de notificaciones del frontend directamente.
          </li>
          <li>
            <strong>Enviar Notificación Backend</strong>: Envía la notificación a través del backend sin reproducir audio.
          </li>
          <li>
            <strong>Enviar Notificación + Audio</strong>: Envía la notificación a través del backend y reproduce el mensaje por audio.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationTester;
