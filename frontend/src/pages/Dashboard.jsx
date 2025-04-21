import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { 
  FaPlay, FaStop, FaMicrophone, FaMicrophoneSlash, 
  FaMapMarkerAlt, FaTachometerAlt, FaExclamationTriangle, 
  FaRoute, FaCalendarAlt, FaHdd, FaCog, FaMap, 
  FaArrowRight, FaCar, FaMemory, FaMicrochip, FaThermometerHalf,
  FaSdCard, FaClock
} from 'react-icons/fa'

function Dashboard() {
  const navigate = useNavigate();
  const [location, setLocation] = useState({ lat: 0, lon: 0, speed: 0 })
  const [landmark, setLandmark] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [liveStream, setLiveStream] = useState({
    road: null,
    interior: null
  })
  const [systemStatus, setSystemStatus] = useState({
    cpu_usage: 0,
    memory_usage: 0,
    cpu_temp: 0,
    storage: {
      available: 0,
      total: 0,
      percent_used: 0
    },
    uptime: '',
    version: '',
  })
  const [activeTrip, setActiveTrip] = useState(null)
  const [tripStats, setTripStats] = useState({
    total_trips: 0,
    recording_time: 0,
    distance_traveled: 0,
    recent_trips: []
  })
  
  // Camera status
  const [cameraStatus, setCameraStatus] = useState({
    road_camera: true,
    interior_camera: true,
    errors: []
  })

  // Add state for tracking image load errors
  const [imageErrors, setImageErrors] = useState({
    road: false,
    interior: false
  })
  
  // Refs for tracking connection attempts
  const connectionAttempts = useRef({
    road: 0,
    interior: 0
  })

  // Fetch initial recording status
  useEffect(() => {
    axios.get('/api/recording/status')
      .then(response => {
        setIsRecording(response.data.recording)
      })
      .catch(error => {
        console.error('Error fetching recording status:', error)
      })

    // Setup periodic refreshing of camera streams
    const streamInterval = setInterval(() => {
      refreshCameraStreams()
    }, 1000) // Update every second

    return () => {
      clearInterval(streamInterval)
    }
  }, [])

  // Fetch initial system status
  useEffect(() => {
    axios.get('/api/system/status')
      .then(response => {
        if (response.data.camera_status) {
          setCameraStatus(response.data.camera_status);
        }
        
        if (response.data.system_stats) {
          setSystemStatus(response.data.system_stats);
        }
      })
      .catch(error => {
        console.error('Error fetching system status:', error)
      })
      
    // Setup interval to fetch system stats every 10 seconds
    const statsInterval = setInterval(() => {
      axios.get('/api/system/status')
        .then(response => {
          if (response.data.system_stats) {
            setSystemStatus(response.data.system_stats);
          }
        })
        .catch(error => {
          console.error('Error updating system stats:', error)
        })
    }, 10000)
    
    return () => {
      clearInterval(statsInterval)
    }
  }, [])
  
  // Fetch trip statistics
  useEffect(() => {
    axios.get('/api/trips/stats')
      .then(response => {
        setTripStats(response.data)
      })
      .catch(error => {
        console.error('Error fetching trip stats:', error)
      })
  }, [])
  
  // Check for active planned trip
  useEffect(() => {
    const savedTrip = localStorage.getItem('activeTrip')
    if (savedTrip) {
      try {
        setActiveTrip(JSON.parse(savedTrip))
      } catch (e) {
        console.error('Error parsing saved trip:', e)
      }
    }
  }, [])

  // Setup WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws`)
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Check if this is the new status_update message type
        if (data.type === 'status_update') {
          // Update location and speed
          if (data.location) {
            setLocation(data.location)
          }
          
          // Update nearby landmark
          if (data.landmark) {
            setLandmark(data.landmark)
          }
          
          // Update recording status
          if (data.recording !== undefined) {
            setIsRecording(data.recording)
          }
          
          // Update camera status
          if (data.camera_status) {
            setCameraStatus(data.camera_status)
          }
          
          // Update system stats
          if (data.system_stats) {
            setSystemStatus(data.system_stats)
          }
        } else {
          // Handle legacy message format
          if (data.location) {
            setLocation(data.location)
          }
          
          if (data.landmark) {
            setLandmark(data.landmark)
          }
          
          if (data.recording !== undefined) {
            setIsRecording(data.recording)
          }
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }
    
    return () => {
      ws.close()
    }
  }, [])

  // Function to refresh camera streams
  const refreshCameraStreams = () => {
    // Only attempt to load streams if we have confirmation cameras are available
    if (cameraStatus.road_camera || cameraStatus.interior_camera) {
      // In a real implementation, this would use MJPEG streams or WebRTC
      // For now, we'll simulate with timestamps to force image refreshes
      const timestamp = new Date().getTime()
      
      // Create stream URLs but handle them with error checking when displaying
      setLiveStream({
        road: cameraStatus.road_camera ? `/api/cameras/road/stream?t=${timestamp}` : null,
        interior: cameraStatus.interior_camera ? `/api/cameras/interior/stream?t=${timestamp}` : null
      })
    }
  }

  // Function to handle image errors
  const handleImageError = (cameraType) => {
    setImageErrors(prev => ({
      ...prev,
      [cameraType]: true
    }))
    
    // Increment connection attempt counter
    connectionAttempts.current[cameraType]++
    
    // After 3 failed attempts, consider the camera unavailable
    if (connectionAttempts.current[cameraType] >= 3) {
      setCameraStatus(prev => {
        const updatedErrors = [...prev.errors]
        const errorMsg = `${cameraType === 'road' ? 'Road' : 'Interior'} camera stream unavailable`
        
        if (!updatedErrors.includes(errorMsg)) {
          updatedErrors.push(errorMsg)
        }
        
        return {
          ...prev,
          [`${cameraType}_camera`]: false,
          errors: updatedErrors
        }
      })
    }
  }

  // Function to start recording
  const startRecording = () => {
    // Check if we have an active planned trip
    const payload = activeTrip ? { planned_trip_id: activeTrip.id } : {}
    
    axios.post('/api/recording/start', payload)
      .then(response => {
        if (response.data.status === 'success') {
          console.log('Recording started:', response.data)
          setIsRecording(true)
        } else if (response.data.status === 'error') {
          console.error('Failed to start recording:', response.data.message)
          // Show error message to the user
          alert(`Failed to start recording: ${response.data.message}`)
        }
      })
      .catch(error => {
        console.error('Error starting recording:', error)
        alert('Error starting recording. Check camera connections.')
      })
  }

  // Function to stop recording
  const stopRecording = () => {
    axios.post('/api/recording/stop')
      .then(response => {
        console.log('Recording stopped:', response.data)
        setIsRecording(false)
      })
      .catch(error => {
        console.error('Error stopping recording:', error)
      })
  }

  // Function to toggle microphone
  const toggleMicrophone = () => {
    axios.post('/api/recording/toggle-mic', { enabled: !isMicEnabled })
      .then(response => {
        setIsMicEnabled(!isMicEnabled)
      })
      .catch(error => {
        console.error('Error toggling microphone:', error)
      })
  }
  
  // Function to start navigation with active trip
  const startNavigation = () => {
    if (activeTrip) {
      navigate('/map');
    }
  }
  
  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }
  
  // Format seconds to hours:minutes:seconds
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-4">
      {/* System alerts */}
      {cameraStatus.errors.length > 0 && (
        <div className="mb-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded-md shadow-sm">
          <h3 className="text-yellow-700 font-medium flex items-center">
            <FaExclamationTriangle className="mr-2" />
            System Alerts
          </h3>
          <ul className="mt-2 list-disc pl-5">
            {cameraStatus.errors.map((error, index) => (
              <li key={index} className="text-yellow-600 text-sm">{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Active planned trip card */}
      {activeTrip && (
        <div className="mb-4 bg-dashcam-50 border-l-4 border-dashcam-500 p-4 rounded-md shadow-sm">
          <h3 className="text-dashcam-700 font-medium flex items-center">
            <FaRoute className="mr-2" />
            Active Planned Trip
          </h3>
          <div className="mt-2">
            <p className="font-medium">{activeTrip.name}</p>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600">
                {new Date(activeTrip.start_date).toLocaleDateString()} - {new Date(activeTrip.end_date).toLocaleDateString()}
              </span>
              <button 
                onClick={startNavigation}
                className="bg-dashcam-600 hover:bg-dashcam-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
              >
                Navigate <FaArrowRight className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Main camera view */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="relative">
            {cameraStatus.road_camera && liveStream.road ? (
              <img 
                src={liveStream.road} 
                alt="Road View" 
                className="w-full h-48 object-cover"
                onError={() => handleImageError('road')}
              />
            ) : (
              <div className="w-full h-48 bg-gray-800 flex items-center justify-center flex-col text-white">
                <div className="text-red-400 mb-2">Road camera not available</div>
                <div className="text-sm text-gray-400">Check camera connection</div>
              </div>
            )}
            
            {/* Overlay for speed and landmark */}
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 flex justify-between">
              <div className="flex items-center">
                <FaTachometerAlt className="mr-1" />
                <span>{Math.round(location.speed)} km/h</span>
              </div>
              {landmark && (
                <div className="flex items-center">
                  <FaMapMarkerAlt className="mr-1 text-red-500" />
                  <span>{landmark.name}</span>
                </div>
              )}
            </div>
            
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-2 right-2 flex items-center bg-red-600 text-white px-2 py-1 rounded-full animate-pulse">
                <span className="h-2 w-2 bg-white rounded-full mr-1"></span>
                <span className="text-xs">REC</span>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-gray-200">
            <h3 className="font-medium text-gray-800">Road Camera</h3>
          </div>
        </div>
        
        {/* Interior camera view */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="relative">
            {cameraStatus.interior_camera && liveStream.interior ? (
              <img 
                src={liveStream.interior} 
                alt="Interior View" 
                className="w-full h-48 object-cover"
                onError={() => handleImageError('interior')}
              />
            ) : (
              <div className="w-full h-48 bg-gray-800 flex items-center justify-center flex-col text-white">
                <div className="text-red-400 mb-2">Interior camera not available</div>
                <div className="text-sm text-gray-400">Check camera connection</div>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-gray-200">
            <h3 className="font-medium text-gray-800">Interior Camera</h3>
          </div>
        </div>
      </div>
      
      {/* Controls & Quick stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Recording controls */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-medium text-gray-800 mb-3">Recording Controls</h3>
          
          <div className="grid grid-cols-2 gap-3">
            {!isRecording ? (
              <button 
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md flex items-center justify-center"
                onClick={startRecording}
              >
                <FaPlay className="mr-1" />
                Start Recording
              </button>
            ) : (
              <button 
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md flex items-center justify-center"
                onClick={stopRecording}
              >
                <FaStop className="mr-1" />
                Stop Recording
              </button>
            )}
            
            <button 
              className={`py-2 px-4 rounded-md flex items-center justify-center ${isMicEnabled ? 'bg-dashcam-500 hover:bg-dashcam-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}
              onClick={toggleMicrophone}
            >
              {isMicEnabled ? (
                <>
                  <FaMicrophone className="mr-1" />
                  Mic On
                </>
              ) : (
                <>
                  <FaMicrophoneSlash className="mr-1" />
                  Mic Off
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Quick stats */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-medium text-gray-800 mb-3">Trip Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-dashcam-600">{tripStats.total_trips}</div>
              <div className="text-sm text-gray-500">Total Trips</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-dashcam-600">
                {Math.round(tripStats.distance_traveled)} km
              </div>
              <div className="text-sm text-gray-500">Distance</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-dashcam-600">
                {Math.floor(tripStats.recording_time / 3600)}h
              </div>
              <div className="text-sm text-gray-500">Recording Time</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-dashcam-600">
                {tripStats.recent_trips.length}
              </div>
              <div className="text-sm text-gray-500">Recent Trips</div>
            </div>
          </div>
        </div>
        
        {/* Quick nav */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-medium text-gray-800 mb-3">Quick Navigation</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/map" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-2 px-4 rounded-md flex items-center justify-center">
              <FaMap className="mr-1" />
              Live Map
            </Link>
            <Link to="/trips" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-2 px-4 rounded-md flex items-center justify-center">
              <FaRoute className="mr-1" />
              Trip Planner
            </Link>
            <Link to="/calendar" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-2 px-4 rounded-md flex items-center justify-center">
              <FaCalendarAlt className="mr-1" />
              Calendar
            </Link>
            <Link to="/storage" className="bg-dashcam-500 hover:bg-dashcam-600 text-white py-2 px-4 rounded-md flex items-center justify-center">
              <FaHdd className="mr-1" />
              Storage
            </Link>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* System health */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 p-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">System Health</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <FaMicrochip className="text-gray-500 mr-2" />
                <div>
                  <div className="text-sm text-gray-500">CPU Usage</div>
                  <div className="font-medium">{systemStatus.cpu_usage}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div 
                      className={`h-1.5 rounded-full ${
                        systemStatus.cpu_usage > 80 ? 'bg-red-500' : 
                        systemStatus.cpu_usage > 50 ? 'bg-yellow-500' : 
                        'bg-green-500'
                      }`}
                      style={{ width: `${systemStatus.cpu_usage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <FaMemory className="text-gray-500 mr-2" />
                <div>
                  <div className="text-sm text-gray-500">Memory</div>
                  <div className="font-medium">{systemStatus.memory_usage}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div 
                      className={`h-1.5 rounded-full ${
                        systemStatus.memory_usage > 80 ? 'bg-red-500' : 
                        systemStatus.memory_usage > 50 ? 'bg-yellow-500' : 
                        'bg-green-500'
                      }`}
                      style={{ width: `${systemStatus.memory_usage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <FaThermometerHalf className="text-gray-500 mr-2" />
                <div>
                  <div className="text-sm text-gray-500">CPU Temperature</div>
                  <div className="font-medium">{systemStatus.cpu_temp}°C</div>
                </div>
              </div>
              <div className="flex items-center">
                <FaClock className="text-gray-500 mr-2" />
                <div>
                  <div className="text-sm text-gray-500">Uptime</div>
                  <div className="font-medium">{systemStatus.uptime}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Location information */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 p-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">Location</h3>
          </div>
          <div className="p-4">
            <div className="mb-3">
              <div className="text-sm text-gray-500 mb-1">Current Coordinates</div>
              <div className="font-medium flex items-center">
                <FaMapMarkerAlt className="text-red-500 mr-1" />
                {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-sm text-gray-500 mb-1">Speed</div>
              <div className="font-medium flex items-center">
                <FaCar className="text-dashcam-600 mr-1" />
                {Math.round(location.speed)} km/h
              </div>
            </div>
            
            {landmark && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Nearest Landmark</div>
                <div className="font-medium text-dashcam-700">{landmark.name}</div>
                {landmark.description && (
                  <div className="text-sm text-gray-600">{landmark.description}</div>
                )}
                {landmark.distance && (
                  <div className="text-xs text-gray-500 mt-1">
                    {landmark.distance < 1000 
                      ? `${Math.round(landmark.distance)}m away` 
                      : `${(landmark.distance / 1000).toFixed(1)}km away`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Storage status */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
        <div className="bg-gray-50 p-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-800">Storage Status</h3>
        </div>
        <div className="p-4">
          <div className="mb-2 flex justify-between">
            <span className="text-sm text-gray-500">
              {formatBytes(systemStatus.storage.total - systemStatus.storage.available)} used of {formatBytes(systemStatus.storage.total)}
            </span>
            <span className="text-sm font-medium">
              {systemStatus.storage.percent_used}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${
                systemStatus.storage.percent_used > 90 ? 'bg-red-500' : 
                systemStatus.storage.percent_used > 70 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${systemStatus.storage.percent_used}%` }}
            ></div>
          </div>
          
          <div className="mt-3 flex justify-end">
            <Link 
              to="/storage" 
              className="text-dashcam-600 hover:text-dashcam-700 text-sm font-medium flex items-center"
            >
              Storage Manager <FaArrowRight className="ml-1" />
            </Link>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 text-right mt-2">
        System Version: {systemStatus.version || 'Unknown'}
      </div>
    </div>
  )
}

export default Dashboard