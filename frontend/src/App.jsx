import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import BulkUploader from './pages/BulkUploader'
import StorageManager from './pages/StorageManager'
import RealTimeMap from './pages/RealTimeMap'
import TripPlanner from './pages/TripPlanner'
import LandmarksManager from './pages/LandmarksManager'
import Navigation from './components/Navigation'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState(false)
  const [socket, setSocket] = useState(null)

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws`)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setSocket(ws)
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
      // Try to reconnect after a delay
      setTimeout(() => {
        setSocket(null)
      }, 5000)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Update recording status if included in the message
        if (data.recording !== undefined) {
          setRecordingStatus(data.recording)
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }
    
    return () => {
      ws.close()
    }
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* Status bar */}
      <div className="bg-dashcam-800 text-white py-2 px-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Smart Dashcam</h1>
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-1 ${recordingStatus ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-sm">{recordingStatus ? 'Recording' : 'Standby'}</span>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-grow overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/map" element={<RealTimeMap />} />
          <Route path="/trips" element={<TripPlanner />} />
          <Route path="/landmarks-manager" element={<LandmarksManager />} />
          <Route path="/uploader" element={<BulkUploader />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/storage" element={<StorageManager />} />
        </Routes>
      </div>
      
      {/* Navigation bar */}
      <Navigation />
    </div>
  )
}

export default App