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

  // Fetch settings on mount
  useEffect(() => {
    fetchAudioSettings()
    fetchVideoSettings()
    fetchWifiSettings()
    detectCameras()
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
  const detectCameras = async () => {
    setIsDetectingCameras(true)
    setCameraDetectionError(null)
    
    try {
      const response = await axios.get('/api/system/cameras')
      
      // Sort cameras: working cameras first, then by suggested use
      const cameras = response.data.cameras || []
      cameras.sort((a, b) => {
        // First, sort by working status
        if (a.working !== b.working) {
          return a.working ? -1 : 1
        }
        
        // Then by suggested use (road cameras first)
        if (a.suggested_use && b.suggested_use) {
          return a.suggested_use.includes('Road') ? -1 : 1
        }
        
        // Then by device ID
        return a.device_id - b.device_id
      })
      
      setAvailableCameras(cameras)
      
      // Auto-suggest cameras if none are currently selected
      if (cameras.length > 0 && (!videoSettings.roadCamera || !videoSettings.interiorCamera)) {
        const updatedSettings = {...videoSettings}
        
        // Find a working road camera
        const roadCam = cameras.find(c => c.working && c.suggested_use?.includes('Road'))
        if (roadCam && !videoSettings.roadCamera) {
          updatedSettings.roadCamera = roadCam.device
        }
        
        // Find a working interior camera
        const interiorCam = cameras.find(c => c.working && c.suggested_use?.includes('Interior'))
        if (interiorCam && !videoSettings.interiorCamera) {
          updatedSettings.interiorCamera = interiorCam.device
        }
        
        // If we only have one camera, use it for road view
        if (cameras.length === 1 && cameras[0].working && !videoSettings.roadCamera) {
          updatedSettings.roadCamera = cameras[0].device
        }
        
        // Update settings if we made changes
        if (updatedSettings.roadCamera !== videoSettings.roadCamera || 
            updatedSettings.interiorCamera !== videoSettings.interiorCamera) {
          setVideoSettings(updatedSettings)
        }
      }
    } catch (error) {
      console.error('Error detecting cameras:', error)
      setCameraDetectionError(
        error.response?.data?.detail || 
        'Failed to detect cameras. Please make sure your cameras are properly connected.'
      )
    } finally {
      setIsDetectingCameras(false)
    }
  }
  
  // Function to test a camera
  const testCamera = async (cameraPath) => {
    setTestingCamera(true)
    setCameraTestPreview(null)
    setCameraTestInfo(null)
    
    try {
      // First try to get the preview image through the API
      const response = await axios.post('/api/system/test-camera', { camera_path: cameraPath })
      
      if (response.data.preview_url) {
        // Get the actual image data from the preview endpoint
        const previewResponse = await axios.get(response.data.preview_url)
        
        // If we got the image, set it and camera info
        if (previewResponse.data.image_data_uri) {
          setCameraTestPreview(previewResponse.data.image_data_uri)
          
          // Store additional camera info
          setCameraTestInfo({
            resolution: `${response.data.width}x${response.data.height}`,
            fps: response.data.fps,
            camera: getCameraLabel(cameraPath)
          })
        } else {
          throw new Error('Failed to get camera preview image')
        }
      } else {
        throw new Error('Camera test didn\'t return a preview URL')
      }
    } catch (error) {
      console.error('Error testing camera:', error)
      alert(`Failed to test camera: ${error.response?.data?.detail || error.message}`)
    } finally {
      setTestingCamera(false)
    }
  }
  
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
      {/* Camera Settings */}
      <div className="card mb-4 p-0 overflow-hidden">
        <div className="bg-dashcam-700 text-white p-3">
          <h2 className="text-lg font-medium flex items-center">
            <FaCamera className="mr-2" />
            Camera Management
          </h2>
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              Detected cameras: {availableCameras.length}
            </p>
            <button 
              className="btn btn-secondary text-sm flex items-center"
              onClick={detectCameras}
              disabled={isDetectingCameras}
            >
              <FaSearch className="mr-1" />
              {isDetectingCameras ? 'Detecting...' : 'Refresh Camera List'}
            </button>
          </div>
          
          {cameraDetectionError && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700">
              <p className="flex items-center">
                <FaExclamationTriangle className="mr-2" />
                {cameraDetectionError}
              </p>
            </div>
          )}
          
          {availableCameras.length > 0 ? (
            <>
              {/* Camera selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Road camera */}
                <div className="border rounded-lg p-3">
                  <label className="block font-medium mb-2">Road Camera (Front-facing)</label>
                  <select 
                    value={videoSettings.roadCamera} 
                    onChange={(e) => setVideoSettings({...videoSettings, roadCamera: e.target.value})}
                    className="input w-full mb-3"
                  >
                    <option value="">-- Select Camera --</option>
                    {availableCameras.map(camera => (
                      <option 
                        key={`road-${camera.device}`} 
                        value={camera.device}
                        disabled={!camera.working}
                      >
                        {getShortCameraLabel(camera)}
                        {camera.suggested_use?.includes('Road') && " ✓"}
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {videoSettings.roadCamera && 
                        availableCameras.find(c => c.device === videoSettings.roadCamera)?.type === 'USB' && 
                        'USB camera - If disconnected, you may need to reconfigure'}
                    </div>
                    <button 
                      onClick={() => testCamera(videoSettings.roadCamera)}
                      disabled={!videoSettings.roadCamera || testingCamera}
                      className="btn btn-secondary text-sm flex items-center"
                    >
                      <FaVideo className="mr-1" />
                      {testingCamera ? 'Testing...' : 'Test Camera'}
                    </button>
                  </div>
                </div>
                
                {/* Interior camera */}
                <div className="border rounded-lg p-3">
                  <label className="block font-medium mb-2">Interior Camera (Driver-facing)</label>
                  <select 
                    value={videoSettings.interiorCamera} 
                    onChange={(e) => setVideoSettings({...videoSettings, interiorCamera: e.target.value})}
                    className="input w-full mb-3"
                  >
                    <option value="">-- Select Camera --</option>
                    {availableCameras.map(camera => (
                      <option 
                        key={`interior-${camera.device}`} 
                        value={camera.device}
                        disabled={!camera.working}
                      >
                        {getShortCameraLabel(camera)}
                        {camera.suggested_use?.includes('Interior') && " ✓"}
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {videoSettings.interiorCamera && 
                        availableCameras.find(c => c.device === videoSettings.interiorCamera)?.type === 'USB' && 
                        'USB camera - If disconnected, you may need to reconfigure'}
                    </div>
                    <button 
                      onClick={() => testCamera(videoSettings.interiorCamera)}
                      disabled={!videoSettings.interiorCamera || testingCamera}
                      className="btn btn-secondary text-sm flex items-center"
                    >
                      <FaVideo className="mr-1" />
                      {testingCamera ? 'Testing...' : 'Test Camera'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Available camera info table */}
              <div className="mb-4 overflow-hidden border rounded-lg">
                <div className="bg-gray-50 px-3 py-2 border-b font-medium">Detected Cameras</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resolution</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Suggested Use</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {availableCameras.map(camera => (
                        <tr key={camera.device} className={!camera.working ? 'bg-red-50' : ''}>
                          <td className="px-4 py-2 text-sm">{camera.device}</td>
                          <td className="px-4 py-2 text-sm">{camera.name}</td>
                          <td className="px-4 py-2 text-sm">{camera.resolution}</td>
                          <td className="px-4 py-2 text-sm">
                            {camera.working ? (
                              <span className="text-green-600 flex items-center">
                                <FaCheck className="mr-1" size={12} /> Working
                              </span>
                            ) : (
                              <span className="text-red-600 flex items-center">
                                <FaExclamationTriangle className="mr-1" size={12} /> Not working
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm">{camera.suggested_use || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Camera test preview */}
              {cameraTestPreview && (
                <div className="mb-4 border rounded-lg p-3">
                  <h3 className="font-medium mb-2">Camera Test Preview</h3>
                  
                  {cameraTestInfo && (
                    <div className="mb-3 text-sm text-gray-600">
                      <p><span className="font-medium">Camera:</span> {cameraTestInfo.camera}</p>
                      <p><span className="font-medium">Resolution:</span> {cameraTestInfo.resolution}</p>
                      <p><span className="font-medium">FPS:</span> {cameraTestInfo.fps}</p>
                    </div>
                  )}
                  
                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <img 
                      src={cameraTestPreview} 
                      alt="Camera Test" 
                      className="w-full h-auto max-h-48 object-contain mx-auto"
                    />
                  </div>
                  <button 
                    onClick={() => setCameraTestPreview(null)}
                    className="btn btn-secondary text-sm mt-2 mx-auto block"
                  >
                    Close Preview
                  </button>
                </div>
              )}
              
              <div className="text-center mt-4">
                <button 
                  className="btn btn-primary"
                  onClick={updateVideoSettings}
                >
                  Save Camera Settings
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              {isDetectingCameras ? (
                <div className="animate-pulse">
                  <div className="h-10 w-10 border-4 border-dashcam-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-500">Detecting cameras...</p>
                </div>
              ) : (
                <div className="text-gray-500">
                  <FaExclamationTriangle className="text-4xl text-yellow-500 mx-auto mb-3" />
                  <p className="mb-3">No cameras detected</p>
                  <p className="text-sm mb-4">Make sure your cameras are properly connected and try again.</p>
                  <div className="flex flex-col space-y-2 max-w-md mx-auto text-left bg-gray-50 p-3 rounded-lg border mb-4">
                    <p className="font-medium">Troubleshooting tips:</p>
                    <ul className="list-disc pl-5 text-sm">
                      <li>Check that your cameras are properly connected to USB ports</li>
                      <li>Try disconnecting and reconnecting your cameras</li>
                      <li>Verify that other applications aren't currently using the cameras</li>
                      <li>If using USB hubs, try connecting cameras directly to the device</li>
                      <li>Some cameras may require additional drivers to be installed</li>
                    </ul>
                  </div>
                  <button 
                    className="btn btn-primary text-sm"
                    onClick={detectCameras}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Audio Settings */}
      <div className="card mb-4 p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium flex items-center">
            <FaVolumeUp className="mr-2 text-dashcam-600" />
            Audio Settings
          </h2>
          <button 
            className="btn btn-secondary text-sm"
            onClick={testAudio}
          >
            Test Audio
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
              Enable Audio Notifications
            </label>
          </div>
          
          <div>
            <label className="block mb-1 text-sm">Volume: {audioSettings.volume}%</label>
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
            Save Audio Settings
          </button>
        </div>
      </div>
      
      {/* Video Settings */}
      <div className="card mb-4 p-4">
        <h2 className="text-lg font-medium mb-3 flex items-center">
          <FaCog className="mr-2 text-dashcam-600" />
          Video Settings
        </h2>
        
        <div className="space-y-3">
          <div>
            <label className="block mb-1 text-sm">Road Camera Quality</label>
            <select 
              value={videoSettings.roadQuality} 
              onChange={(e) => setVideoSettings({...videoSettings, roadQuality: e.target.value})}
              className="input w-full"
            >
              <option value="low">Low (480p)</option>
              <option value="medium">Medium (720p)</option>
              <option value="high">High (1080p)</option>
            </select>
          </div>
          
          <div>
            <label className="block mb-1 text-sm">Interior Camera Quality</label>
            <select 
              value={videoSettings.interiorQuality} 
              onChange={(e) => setVideoSettings({...videoSettings, interiorQuality: e.target.value})}
              className="input w-full"
            >
              <option value="low">Low (480p)</option>
              <option value="medium">Medium (720p)</option>
              <option value="high">High (1080p)</option>
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
              Auto-start recording when power is detected
            </label>
          </div>
          
          <button 
            className="btn btn-primary w-full"
            onClick={updateVideoSettings}
          >
            Save Video Settings
          </button>
        </div>
      </div>
      
      {/* WiFi Hotspot Settings */}
      <div className="card mb-4 p-4">
        <h2 className="text-lg font-medium mb-3 flex items-center">
          <FaWifi className="mr-2 text-dashcam-600" />
          WiFi Hotspot Settings
        </h2>
        
        <div className="space-y-3">
          <div>
            <label className="block mb-1 text-sm">Network Name (SSID)</label>
            <input 
              type="text" 
              value={wifiSettings.ssid} 
              onChange={(e) => setWifiSettings({...wifiSettings, ssid: e.target.value})}
              className="input w-full"
              placeholder="DashCam"
            />
          </div>
          
          <div>
            <label className="block mb-1 text-sm">Password (leave empty for open network)</label>
            <input 
              type="password" 
              value={wifiSettings.password} 
              onChange={(e) => setWifiSettings({...wifiSettings, password: e.target.value})}
              className="input w-full"
              placeholder="Password"
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
              Enable WiFi Hotspot
            </label>
          </div>
          
          <button 
            className="btn btn-primary w-full"
            onClick={updateWifiSettings}
          >
            Save WiFi Settings
          </button>
        </div>
      </div>
      
      {/* Landmarks Sync */}
      <div className="card mb-4 p-4">
        <h2 className="text-lg font-medium mb-3 flex items-center">
          <FaSync className="mr-2 text-dashcam-600" />
          Landmarks Database
        </h2>
        
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Sync the local landmarks database with the latest points of interest.
            {syncStatus.lastSync && (
              <span className="block mt-1">Last sync: {syncStatus.lastSync}</span>
            )}
          </p>
          
          <button 
            className="btn btn-primary w-full"
            onClick={syncLandmarks}
            disabled={syncStatus.inProgress}
          >
            {syncStatus.inProgress ? 'Syncing...' : 'Sync Landmarks'}
          </button>
        </div>
      </div>
      
      {/* External Video Upload */}
      <div className="card mb-4 p-4">
        <h2 className="text-lg font-medium mb-3 flex items-center">
          <FaUpload className="mr-2 text-dashcam-600" />
          Upload External Video
        </h2>
        
        <form onSubmit={handleFileUpload}>
          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-sm">Video File (from Insta360 or other camera)</label>
              <input 
                type="file" 
                accept="video/*" 
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm">Date</label>
              <input 
                type="date" 
                value={uploadDate} 
                onChange={(e) => setUploadDate(e.target.value)}
                className="input w-full"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-sm">Latitude (optional)</label>
                <input 
                  type="text" 
                  value={uploadLocation.lat} 
                  onChange={(e) => setUploadLocation({...uploadLocation, lat: e.target.value})}
                  className="input w-full"
                  placeholder="36.1699"
                />
              </div>
              
              <div>
                <label className="block mb-1 text-sm">Longitude (optional)</label>
                <input 
                  type="text" 
                  value={uploadLocation.lon} 
                  onChange={(e) => setUploadLocation({...uploadLocation, lon: e.target.value})}
                  className="input w-full"
                  placeholder="-115.1398"
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary w-full flex items-center justify-center"
              disabled={isUploading || !uploadFile || !uploadDate}
            >
              <FaFileUpload className="mr-1" />
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Settings