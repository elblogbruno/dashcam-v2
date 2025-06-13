import React, { useState } from 'react';
import axios from 'axios';
import { FaBell, FaVolumeUp, FaArrowLeft } from 'react-icons/fa';
import { showSuccess, showError, showInfo, showWarning } from '../services/notificationService';

// Importar el nuevo sistema de diseño
import { PageLayout, Section, Grid, Stack, Flex } from '../components/common/Layout';
import { Button, Card, Input, Select, Spinner } from '../components/common/UI';

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
    <PageLayout
      title="Probador de Notificaciones"
      icon={<FaBell />}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.href = "/settings#debug-section"}
        >
          <FaArrowLeft className="mr-2" />
          Volver a Configuración
        </Button>
      }
    >
      <Grid cols={1} gap="lg" className="max-w-4xl mx-auto">
        {/* Formulario de configuración */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurar Notificación</h2>
            
            <Stack space="md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="message">
                  Mensaje:
                </label>
                <Input
                  id="message"
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe el mensaje de la notificación"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="title">
                  Título:
                </label>
                <Input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título de la notificación"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="type">
                  Tipo:
                </label>
                <Select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="info">Información</option>
                  <option value="success">Éxito</option>
                  <option value="error">Error</option>
                  <option value="warning">Advertencia</option>
                </Select>
              </div>
            </Stack>
          </div>
        </Card>

        {/* Botones de acción */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enviar Notificación</h2>
            
            <Grid cols={1} gap="sm" className="sm:grid-cols-3">
              <Button
                onClick={sendLocalNotification}
                variant="primary"
                size="lg"
                className="w-full"
              >
                <FaBell className="mr-2" />
                Notificación Local
              </Button>
              
              <Button
                onClick={sendBackendNotification}
                variant="secondary"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <FaBell className="mr-2" />
                    Backend (Sin Audio)
                  </>
                )}
              </Button>
              
              <Button
                onClick={sendBackendNotificationWithAudio}
                variant="warning"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <FaVolumeUp className="mr-2" />
                    Backend + Audio
                  </>
                )}
              </Button>
            </Grid>
          </div>
        </Card>
        
        {/* Instrucciones */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Instrucciones</h2>
            
            <Stack space="sm">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2">
                  <FaBell className="inline mr-2" />
                  Notificación Local
                </h3>
                <p className="text-blue-800 text-sm">
                  Usa el servicio de notificaciones del frontend directamente.
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-900 mb-2">
                  <FaBell className="inline mr-2" />
                  Backend (Sin Audio)
                </h3>
                <p className="text-green-800 text-sm">
                  Envía la notificación a través del backend sin reproducir audio.
                </p>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h3 className="font-medium text-orange-900 mb-2">
                  <FaVolumeUp className="inline mr-2" />
                  Backend + Audio
                </h3>
                <p className="text-orange-800 text-sm">
                  Envía la notificación a través del backend y reproduce el mensaje por audio.
                </p>
              </div>
            </Stack>
          </div>
        </Card>
      </Grid>
    </PageLayout>
  );
};

export default NotificationTester;
