import { useState, useEffect } from 'react'
import axios from 'axios'
import { 
  FaVolumeMute, FaVolumeUp, FaSync, FaCog, FaUpload, 
  FaWifi, FaFileUpload, FaCamera, FaCheck, FaExclamationTriangle,
  FaSearch, FaVideo
} from 'react-icons/fa'

function Settings() {
  const [audioSettings, setAudioSettings] = useState({
    enabled: true,
    volume: 80,
    engine: 'pyttsx3'
  })
  
  const [videoSettings, setVideoSettings] = useState({
    roadQuality: 'high',
    interiorQuality: 'medium',
    autoStartRecording: true,
    roadCamera: '/dev/video0',
    interiorCamera: '/dev/video1'
  })
  
  const [wifiSettings, setWifiSettings] = useState({
    ssid: 'DashCam',
    password: '',
    enabled: true
  })
  
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDate, setUploadDate] = useState('')
  const [uploadLocation, setUploadLocation] = useState({ lat: '', lon: '' })
  const [isUploading, setIsUploading] = useState(false)
  const [syncStatus, setSyncStatus] = useState({ inProgress: false, lastSync: null })
  
  // Camera detection state
  const [availableCameras, setAvailableCameras] = useState([])
  const [isDetectingCameras, setIsDetectingCameras] = useState(false)
  const [cameraTestPreview, setCameraTestPreview] = useState(null)
  const [testingCamera, setTestingCamera] = useState(false)
  const [cameraTestInfo, setCameraTestInfo] = useState(null)
  const [cameraDetectionError, setCameraDetectionError] = useState(null)
  
  // Active section state - para mostrar todas las secciones incluso durante la detección de cámaras
  const [activeSections, setActiveSections] = useState({
    cameras: true,
    audio: true,
    video: true,
    wifi: true,
    landmarks: true,
    upload: true
  })

  // Fetch settings on mount
  useEffect(() => {
    fetchAudioSettings()
    fetchVideoSettings()
    fetchWifiSettings()
    // detectCameras()
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

  // Function to sync landmarks
  const syncLandmarks = async () => {
    try {
      setSyncStatus({ ...syncStatus, inProgress: true })
      const response = await axios.post('/api/landmarks/sync')
      setSyncStatus({ 
        inProgress: false, 
        lastSync: new Date().toLocaleString() 
      })
      alert(`Synced ${response.data.count} landmarks`)
    } catch (error) {
      console.error('Error syncing landmarks:', error)
      setSyncStatus({ ...syncStatus, inProgress: false })
      alert('Failed to sync landmarks')
    }
  }
  
  // Function to detect available cameras
  // const detectCameras = async () => {
  //   setIsDetectingCameras(true)
  //   setCameraDetectionError(null)
    
  //   try {
  //     const response = await axios.get('/api/system/cameras')
      
  //     // Sort cameras: working cameras first, then by suggested use
  //     const cameras = response.data.cameras || []
  //     cameras.sort((a, b) => {
  //       // First, sort by working status
  //       if (a.working !== b.working) {
  //         return a.working ? -1 : 1
  //       }
        
  //       // Then by suggested use (road cameras first)
  //       if (a.suggested_use && b.suggested_use) {
  //         return a.suggested_use.includes('Road') ? -1 : 1
  //       }
        
  //       // Then by device ID
  //       return a.device_id - b.device_id
  //     })
      
  //     setAvailableCameras(cameras)
      
  //     // Auto-suggest cameras if none are currently selected
  //     if (cameras.length > 0 && (!videoSettings.roadCamera || !videoSettings.interiorCamera)) {
  //       const updatedSettings = {...videoSettings}
        
  //       // Find a working road camera
  //       const roadCam = cameras.find(c => c.working && c.suggested_use?.includes('Road'))
  //       if (roadCam && !videoSettings.roadCamera) {
  //         updatedSettings.roadCamera = roadCam.device
  //       }
        
  //       // Find a working interior camera
  //       const interiorCam = cameras.find(c => c.working && c.suggested_use?.includes('Interior'))
  //       if (interiorCam && !videoSettings.interiorCamera) {
  //         updatedSettings.interiorCamera = interiorCam.device
  //       }
        
  //       // If we only have one camera, use it for road view
  //       if (cameras.length === 1 && cameras[0].working && !videoSettings.roadCamera) {
  //         updatedSettings.roadCamera = cameras[0].device
  //       }
        
  //       // Update settings if we made changes
  //       if (updatedSettings.roadCamera !== videoSettings.roadCamera || 
  //           updatedSettings.interiorCamera !== videoSettings.interiorCamera) {
  //         setVideoSettings(updatedSettings)
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error detecting cameras:', error)
  //     setCameraDetectionError(
  //       error.response?.data?.detail || 
  //       'Failed to detect cameras. Please make sure your cameras are properly connected.'
  //     )
  //   } finally {
  //     setIsDetectingCameras(false)
  //   }
  // }
  
  // // Function to test a camera
  // const testCamera = async (cameraPath) => {
  //   setTestingCamera(true)
  //   setCameraTestPreview(null)
  //   setCameraTestInfo(null)
    
  //   try {
  //     // First try to get the preview image through the API
  //     const response = await axios.post('/api/system/test-camera', { camera_path: cameraPath })
      
  //     if (response.data.preview_url) {
  //       // Get the actual image data from the preview endpoint
  //       const previewResponse = await axios.get(response.data.preview_url)
        
  //       // If we got the image, set it and camera info
  //       if (previewResponse.data.image_data_uri) {
  //         setCameraTestPreview(previewResponse.data.image_data_uri)
          
  //         // Store additional camera info
  //         setCameraTestInfo({
  //           resolution: `${response.data.width}x${response.data.height}`,
  //           fps: response.data.fps,
  //           camera: getCameraLabel(cameraPath)
  //         })
  //       } else {
  //         throw new Error('Failed to get camera preview image')
  //       }
  //     } else {
  //       throw new Error('Camera test didn\'t return a preview URL')
  //     }
  //   } catch (error) {
  //     console.error('Error testing camera:', error)
  //     alert(`Failed to test camera: ${error.response?.data?.detail || error.message}`)
  //   } finally {
  //     setTestingCamera(false)
  //   }
  // }
  
  // Function to get camera name/label from device path
  const getCameraLabel = (cameraPath) => {
    const camera = availableCameras.find(cam => cam.device === cameraPath)
    if (!camera) return cameraPath
    
    let label = camera.name
    
    // Add camera type if available
    if (camera.type) {
      label += ` (${camera.type})`
    }
    
    // Add suggested use if available
    if (camera.suggested_use) {
      label += ` - ${camera.suggested_use}`
    }
    
    return label
  }
  
  // Get a shorter camera label for display in dropdowns
  const getShortCameraLabel = (camera) => {
    if (!camera) return '-- Select Camera --'
    
    let label = camera.name || `Camera ${camera.device_id}`
    
    // Add resolution
    if (camera.resolution && camera.resolution !== 'Unknown') {
      label += ` (${camera.resolution})`
    }
    
    // Add a tag if it's not working
    if (camera.working === false) {
      label += ' - Not working'
    }
    
    return label
  }

  // Function to handle file upload
  const handleFileUpload = async (e) => {
    e.preventDefault()
    
    if (!uploadFile || !uploadDate) {
      alert('Please select a file and date')
      return
    }
    
    setIsUploading(true)
    
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('date', uploadDate)
    
    if (uploadLocation.lat && uploadLocation.lon) {
      formData.append('lat', uploadLocation.lat)
      formData.append('lon', uploadLocation.lon)
    }
    
    try {
      await axios.post('/api/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      alert('File uploaded successfully')
      setUploadFile(null)
      setUploadDate('')
      setUploadLocation({ lat: '', lon: '' })
      
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="p-4">
      {/* Sección de navegación rápida - eliminando el botón de cámaras */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={() => document.getElementById('audio-section').scrollIntoView({ behavior: 'smooth' })}
          className="btn btn-secondary text-sm flex items-center"
        >
          <FaVolumeUp className="mr-1" /> Audio
        </button>
        <button 
          onClick={() => document.getElementById('video-section').scrollIntoView({ behavior: 'smooth' })}
          className="btn btn-secondary text-sm flex items-center"
        >
          <FaVideo className="mr-1" /> Video
        </button>
        <button 
          onClick={() => document.getElementById('wifi-section').scrollIntoView({ behavior: 'smooth' })}
          className="btn btn-secondary text-sm flex items-center"
        >
          <FaWifi className="mr-1" /> WiFi
        </button>
        <button 
          onClick={() => document.getElementById('landmarks-section').scrollIntoView({ behavior: 'smooth' })}
          className="btn btn-secondary text-sm flex items-center"
        >
          <FaSync className="mr-1" /> Landmarks
        </button>
      </div>
      
      {/* Resumen de configuración actual - quitando sección de cámaras */}
      <div className="card mb-4 p-4 bg-gray-50">
        <h2 className="text-lg font-medium mb-3">Configuración Actual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">          
          <div className="border rounded-lg p-3 bg-white">
            <h3 className="font-medium mb-2 flex items-center">
              <FaVideo className="mr-1 text-dashcam-600" /> Configuración de Video
            </h3>
            <div className="text-sm">
              <p className="mb-1"><span className="font-medium">Calidad Frontal:</span> {videoSettings.roadQuality}</p>
              <p className="mb-1"><span className="font-medium">Calidad Interior:</span> {videoSettings.interiorQuality}</p>
              <p><span className="font-medium">Auto-iniciar:</span> {videoSettings.autoStartRecording ? "Activado" : "Desactivado"}</p>
            </div>
          </div>
          
          <div className="border rounded-lg p-3 bg-white">
            <h3 className="font-medium mb-2 flex items-center">
              <FaVolumeUp className="mr-1 text-dashcam-600" /> Audio y WiFi
            </h3>
            <div className="text-sm">
              <p className="mb-1"><span className="font-medium">Audio:</span> {audioSettings.enabled ? "Activado" : "Desactivado"}</p>
              <p className="mb-1"><span className="font-medium">Volumen:</span> {audioSettings.volume}%</p>
              <p><span className="font-medium">WiFi:</span> {wifiSettings.enabled ? `Activado (${wifiSettings.ssid})` : "Desactivado"}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Eliminando temporalmente la sección de configuración de cámaras */}
      
      {/* Audio Settings */}
      <div id="audio-section" className="card mb-4 p-0 overflow-hidden">
        <div className="bg-dashcam-700 text-white p-3">
          <h2 className="text-lg font-medium flex items-center">
            <FaVolumeUp className="mr-2" />
            Configuración de Audio
          </h2>
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-600">
              Configura las notificaciones de audio del sistema.
            </p>
            <button 
              className="btn btn-secondary text-sm"
              onClick={testAudio}
            >
              Probar Audio
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="flex items-center mb-2">
                <input 
                  type="checkbox" 
                  checked={audioSettings.enabled} 
                  onChange={() => setAudioSettings({...audioSettings, enabled: !audioSettings.enabled})}
                  className="mr-2"
                />
                Activar Notificaciones de Audio
              </label>
            </div>
            
            <div>
              <label className="block mb-1 text-sm">Volumen: {audioSettings.volume}%</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={audioSettings.volume} 
                onChange={(e) => setAudioSettings({...audioSettings, volume: parseInt(e.target.value)})}
                className="w-full"
              />
            </div>
            
            <button 
              className="btn btn-primary w-full"
              onClick={updateAudioSettings}
            >
              Guardar Configuración de Audio
            </button>
          </div>
        </div>
      </div>
      
      {/* Video Settings */}
      <div id="video-section" className="card mb-4 p-0 overflow-hidden">
        <div className="bg-dashcam-700 text-white p-3">
          <h2 className="text-lg font-medium flex items-center">
            <FaCog className="mr-2" />
            Configuración de Video
          </h2>
        </div>
        
        <div className="p-4">
          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-sm">Calidad de Cámara Frontal</label>
              <select 
                value={videoSettings.roadQuality} 
                onChange={(e) => setVideoSettings({...videoSettings, roadQuality: e.target.value})}
                className="input w-full"
              >
                <option value="low">Baja (480p)</option>
                <option value="medium">Media (720p)</option>
                <option value="high">Alta (1080p)</option>
              </select>
            </div>
            
            <div>
              <label className="block mb-1 text-sm">Calidad de Cámara Interior</label>
              <select 
                value={videoSettings.interiorQuality} 
                onChange={(e) => setVideoSettings({...videoSettings, interiorQuality: e.target.value})}
                className="input w-full"
              >
                <option value="low">Baja (480p)</option>
                <option value="medium">Media (720p)</option>
                <option value="high">Alta (1080p)</option>
              </select>
            </div>
            
            <div>
              <label className="flex items-center mb-2">
                <input 
                  type="checkbox" 
                  checked={videoSettings.autoStartRecording} 
                  onChange={() => setVideoSettings({...videoSettings, autoStartRecording: !videoSettings.autoStartRecording})}
                  className="mr-2"
                />
                Iniciar grabación automáticamente al detectar energía
              </label>
            </div>
            
            <button 
              className="btn btn-primary w-full"
              onClick={updateVideoSettings}
            >
              Guardar Configuración de Video
            </button>
          </div>
        </div>
      </div>
      
      {/* WiFi Hotspot Settings */}
      <div id="wifi-section" className="card mb-4 p-0 overflow-hidden">
        <div className="bg-dashcam-700 text-white p-3">
          <h2 className="text-lg font-medium flex items-center">
            <FaWifi className="mr-2" />
            Configuración de WiFi
          </h2>
        </div>
        
        <div className="p-4">
          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-sm">Nombre de Red (SSID)</label>
              <input 
                type="text" 
                value={wifiSettings.ssid} 
                onChange={(e) => setWifiSettings({...wifiSettings, ssid: e.target.value})}
                className="input w-full"
                placeholder="DashCam"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm">Contraseña (dejar vacío para red abierta)</label>
              <input 
                type="password" 
                value={wifiSettings.password} 
                onChange={(e) => setWifiSettings({...wifiSettings, password: e.target.value})}
                className="input w-full"
                placeholder="Contraseña"
              />
            </div>
            
            <div>
              <label className="flex items-center mb-2">
                <input 
                  type="checkbox" 
                  checked={wifiSettings.enabled} 
                  onChange={() => setWifiSettings({...wifiSettings, enabled: !wifiSettings.enabled})}
                  className="mr-2"
                />
                Activar Punto de Acceso WiFi
              </label>
            </div>
            
            <button 
              className="btn btn-primary w-full"
              onClick={updateWifiSettings}
            >
              Guardar Configuración de WiFi
            </button>
          </div>
        </div>
      </div>
      
      {/* Landmarks Sync */}
      <div id="landmarks-section" className="card mb-4 p-0 overflow-hidden">
        <div className="bg-dashcam-700 text-white p-3">
          <h2 className="text-lg font-medium flex items-center">
            <FaSync className="mr-2" />
            Base de Datos de Puntos de Interés
          </h2>
        </div>
        
        <div className="p-4">
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Sincroniza la base de datos local de puntos de interés con los últimos datos.
              {syncStatus.lastSync && (
                <span className="block mt-1">Última sincronización: {syncStatus.lastSync}</span>
              )}
            </p>
            
            <button 
              className="btn btn-primary w-full"
              onClick={syncLandmarks}
              disabled={syncStatus.inProgress}
            >
              {syncStatus.inProgress ? 'Sincronizando...' : 'Sincronizar Puntos de Interés'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings