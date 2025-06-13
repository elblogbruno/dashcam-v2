import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { 
  FaVolumeUp, FaSync, FaCog, 
  FaWifi, FaCheck, FaExclamationTriangle,
  FaVideo, FaMicrophone, FaBell, FaBug, FaMapMarkerAlt
} from 'react-icons/fa'

// Importar el nuevo sistema de diseño
import { PageLayout, Section, Grid, Stack, Flex } from '../components/common/Layout'
import { Button, Card, Input, Select, Alert, Badge, Spinner } from '../components/common/UI'

function Settings() {
  const navigate = useNavigate()
  
  const [audioSettings, setAudioSettings] = useState({
    enabled: true,
    volume: 80,
    engine: 'pyttsx3'
  })
  
  // Función para hacer scroll suave a una sección
  const scrollToSection = (sectionId) => {
    // Pequeño retraso para asegurar que el DOM está completamente renderizado
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      } else {
        console.log(`Elemento con ID '${sectionId}' no encontrado`);
      }
    }, 100);
  };

  // Navegar a la sección especificada en el hash de la URL al cargar
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }, 100);
      }
    }
  }, [])
  
  const [videoSettings, setVideoSettings] = useState({
    roadQuality: 'high',
    interiorQuality: 'medium',
    autoStartRecording: true
  })
  
  const [wifiSettings, setWifiSettings] = useState({
    ssid: 'DashCam',
    password: '',
    enabled: true
  })
  

  
  // Active section state
  const [activeSections, setActiveSections] = useState({
    audio: true,
    video: true,
    wifi: true,
    debug: true
  })

  // Fetch settings on mount
  useEffect(() => {
    fetchAudioSettings()
    fetchVideoSettings()
    fetchWifiSettings()
  }, [])

  // Function to fetch audio settings
  const fetchAudioSettings = async () => {
    try {
      const response = await axios.get('/api/settings/audio')
      setAudioSettings(response.data)
    } catch (error) {
      console.error('Error fetching audio settings:', error)
    }
  }

  // Function to fetch video settings
  const fetchVideoSettings = async () => {
    try {
      const response = await axios.get('/api/settings/video')
      setVideoSettings(response.data)
    } catch (error) {
      console.error('Error fetching video settings:', error)
    }
  }

  // Function to fetch WiFi settings
  const fetchWifiSettings = async () => {
    try {
      const response = await axios.get('/api/settings/wifi')
      setWifiSettings(response.data)
    } catch (error) {
      console.error('Error fetching WiFi settings:', error)
    }
  }

  // Function to update audio settings
  const updateAudioSettings = async () => {
    try {
      await axios.post('/api/settings/audio', audioSettings)
      alert('Audio settings updated')
    } catch (error) {
      console.error('Error updating audio settings:', error)
      alert('Failed to update audio settings')
    }
  }

  // Function to update video settings
  const updateVideoSettings = async () => {
    try {
      await axios.post('/api/settings/video', videoSettings)
      alert('Video settings updated')
    } catch (error) {
      console.error('Error updating video settings:', error)
      alert('Failed to update video settings')
    }
  }

  // Function to update WiFi settings
  const updateWifiSettings = async () => {
    try {
      await axios.post('/api/settings/wifi', wifiSettings)
      alert('WiFi settings updated')
    } catch (error) {
      console.error('Error updating WiFi settings:', error)
      alert('Failed to update WiFi settings')
    }
  }

  // Function to test audio
  const testAudio = async () => {
    try {
      await axios.post('/api/audio/test')
      alert('Audio test initiated')
    } catch (error) {
      console.error('Error testing audio:', error)
      alert('Failed to test audio')
    }
  }

  return (
    <PageLayout 
      title="Configuración"
      icon={<FaCog size={20} />}
      subtitle="Ajusta la configuración de tu sistema DashCam"
    >
      {/* Navegación rápida */}
      <Section className="mb-6">
        <Flex gap={2} wrap={true}>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<FaVolumeUp />}
            onClick={() => scrollToSection('audio-section')}
          >
            Audio
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<FaVideo />}
            onClick={() => scrollToSection('video-section')}
          >
            Video
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<FaWifi />}
            onClick={() => scrollToSection('wifi-section')}
          >
            Wi-Fi
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<FaBug />}
            onClick={() => scrollToSection('debug-section')}
          >
            Debug
          </Button>
        </Flex>
      </Section>

      {/* Configuración de Audio */}
      <Section
        id="audio-section"
        title="Configuración de Audio"
        variant="card"
        className="mb-6"
      >
        <Grid cols={2} gap={4}>
          <div>
            <label className="form-label flex items-center">
              <FaVolumeUp className="mr-2" />
              Audio Habilitado
            </label>
            <Button
              variant={audioSettings.enabled ? "success" : "outline"}
              onClick={() => setAudioSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className="w-full"
            >
              {audioSettings.enabled ? 'Habilitado' : 'Deshabilitado'}
            </Button>
          </div>
          
          <div>
            <label className="form-label">Volumen: {audioSettings.volume}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={audioSettings.volume}
              onChange={(e) => setAudioSettings(prev => ({ ...prev, volume: parseInt(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </Grid>
        
        <div className="mt-4">
          <Select
            label="Motor de Síntesis de Voz"
            value={audioSettings.engine}
            onChange={(e) => setAudioSettings(prev => ({ ...prev, engine: e.target.value }))}
            options={[
              { value: 'pyttsx3', label: 'pyttsx3' },
              { value: 'espeak', label: 'eSpeak' },
              { value: 'festival', label: 'Festival' }
            ]}
          />
        </div>
        
        <div className="mt-4">
          <Button 
            variant="primary"
            leftIcon={<FaSync />}
            onClick={updateAudioSettings}
          >
            Guardar Configuración de Audio
          </Button>
        </div>
      </Section>

      {/* Configuración de Video */}
      <Section
        id="video-section"
        title="Configuración de Video"
        variant="card"
        className="mb-6"
      >
        <Grid cols={2} gap={4}>
          <Select
            label="Calidad Cámara Principal"
            value={videoSettings.roadQuality}
            onChange={(e) => setVideoSettings(prev => ({ ...prev, roadQuality: e.target.value }))}
            options={[
              { value: 'low', label: 'Baja (480p)' },
              { value: 'medium', label: 'Media (720p)' },
              { value: 'high', label: 'Alta (1080p)' },
              { value: 'ultra', label: 'Ultra (4K)' }
            ]}
          />
          
          <Select
            label="Calidad Cámara Interior"
            value={videoSettings.interiorQuality}
            onChange={(e) => setVideoSettings(prev => ({ ...prev, interiorQuality: e.target.value }))}
            options={[
              { value: 'low', label: 'Baja (480p)' },
              { value: 'medium', label: 'Media (720p)' },
              { value: 'high', label: 'Alta (1080p)' }
            ]}
          />
        </Grid>
        
        <div className="mt-4">
          <label className="form-label flex items-center">
            <input
              type="checkbox"
              checked={videoSettings.autoStartRecording}
              onChange={(e) => setVideoSettings(prev => ({ ...prev, autoStartRecording: e.target.checked }))}
              className="mr-2"
            />
            Iniciar grabación automáticamente
          </label>
        </div>


        
        <div className="mt-4">
          <Button 
            variant="primary"
            leftIcon={<FaSync />}
            onClick={updateVideoSettings}
          >
            Guardar Configuración de Video
          </Button>
        </div>
      </Section>

      {/* Configuración Wi-Fi */}
      <Section
        id="wifi-section"
        title="Configuración Wi-Fi"
        variant="card"
        className="mb-6"
      >
        <Stack gap={4}>
          <div>
            <label className="form-label flex items-center">
              <FaWifi className="mr-2" />
              Hotspot Habilitado
            </label>
            <Button
              variant={wifiSettings.enabled ? "success" : "outline"}
              onClick={() => setWifiSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className="w-full"
            >
              {wifiSettings.enabled ? 'Habilitado' : 'Deshabilitado'}
            </Button>
          </div>
          
          <Input
            label="Nombre de Red (SSID)"
            value={wifiSettings.ssid}
            onChange={(e) => setWifiSettings(prev => ({ ...prev, ssid: e.target.value }))}
          />
          
          <Input
            label="Contraseña"
            type="password"
            value={wifiSettings.password}
            onChange={(e) => setWifiSettings(prev => ({ ...prev, password: e.target.value }))}
          />
        </Stack>
        
        <div className="mt-4">
          <Button 
            variant="primary"
            leftIcon={<FaSync />}
            onClick={updateWifiSettings}
          >
            Guardar Configuración Wi-Fi
          </Button>
        </div>
      </Section>

      {/* Herramientas de Debug */}
      <Section
        id="debug-section"
        title="Herramientas de Depuración"
        variant="card"
        className="mb-6"
      >
        <Alert variant="warning" className="mb-4">
          <strong>Nota:</strong> Estas herramientas son para desarrolladores y soporte técnico. Su uso incorrecto puede afectar el funcionamiento del sistema.
        </Alert>
        
        <Grid cols={3} gap={4}>
          <Card 
            title="Probador de Notificaciones"
            subtitle="Prueba diferentes tipos de notificaciones del sistema"
            hoverable
            className="cursor-pointer"
            onClick={() => navigate('/notifications')}
          >
            <div className="flex items-center justify-center py-4">
              <div className="w-12 h-12 bg-primary-500 text-white rounded-full flex items-center justify-center">
                <FaBell className="text-xl" />
              </div>
            </div>
          </Card>
          
          <Card 
            title="LEDs del Micrófono"
            subtitle="Control directo de LEDs del ReSpeaker 2mic HAT"
            hoverable
            className="cursor-pointer"
            onClick={() => navigate('/mic-led-tester')}
          >
            <div className="flex items-center justify-center py-4">
              <div className="w-12 h-12 bg-primary-500 text-white rounded-full flex items-center justify-center">
                <FaMicrophone className="text-xl" />
              </div>
            </div>
          </Card>

          <Card 
            title="Probador de Geocodificación"
            subtitle="Prueba y depura las capacidades de geocodificación online y offline"
            hoverable
            className="cursor-pointer"
            onClick={() => navigate('/geocoding-tester')}
          >
            <div className="flex items-center justify-center py-4">
              <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center">
                <FaMapMarkerAlt className="text-xl" />
              </div>
            </div>
          </Card>
        </Grid>
        
        <Card title="Información del Sistema" className="mt-4">
          <Stack gap={2} className="text-sm">
            <Flex justify="between">
              <span><strong>Versión:</strong></span>
              <span>Dashcam v2.0</span>
            </Flex>
            <Flex justify="between">
              <span><strong>Fecha:</strong></span>
              <span>{new Date().toLocaleDateString()}</span>
            </Flex>
            <Flex justify="between">
              <span><strong>Hardware:</strong></span>
              <Badge variant="success">ReSpeaker 2mic HAT detectado</Badge>
            </Flex>
          </Stack>
        </Card>
      </Section>
    </PageLayout>
  )
}

export default Settings