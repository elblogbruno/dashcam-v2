import { useState, useEffect } from 'react'
import { FaHdd, FaTrash, FaArchive, FaSync, FaChartBar, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'
import axios from 'axios'

function StorageManager() {
  const [diskInfo, setDiskInfo] = useState({
    mounted: false,
    total: 0,
    used: 0,
    free: 0,
    percent: 0,
    device: '',
    path: ''
  })
  
  const [videoStats, setVideoStats] = useState({
    totalVideos: 0,
    totalSize: 0,
    oldestVideo: null,
    newestVideo: null,
    byMonth: []
  })
  
  const [settings, setSettings] = useState({
    autoCleanEnabled: false,
    autoCleanThreshold: 90,
    autoCleanDays: 30,
    mainDrive: '/dev/sda1',
    mountPoint: '/mnt/dashcam_storage'
  })
  
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionResult, setActionResult] = useState(null)
  
  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }
  
  // Load disk info and video stats
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Get disk info
        const diskResponse = await axios.get('/api/storage/disk-info')
        setDiskInfo(diskResponse.data)
        
        // Get video stats
        const statsResponse = await axios.get('/api/storage/video-stats')
        setVideoStats(statsResponse.data)
        
        // Get storage settings
        const settingsResponse = await axios.get('/api/storage/settings')
        setSettings(settingsResponse.data)
      } catch (error) {
        console.error('Error fetching storage data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Handle mount/unmount drive
  const handleDriveMount = async () => {
    setActionLoading(true)
    try {
      const action = diskInfo.mounted ? 'unmount' : 'mount'
      const response = await axios.post(`/api/storage/${action}`)
      
      setActionResult({
        success: response.data.success,
        message: response.data.message || `Drive ${diskInfo.mounted ? 'unmounted' : 'mounted'} successfully`
      })
      
      // Refresh disk info
      const diskResponse = await axios.get('/api/storage/disk-info')
      setDiskInfo(diskResponse.data)
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to mount/unmount drive'
      })
    } finally {
      setActionLoading(false)
      // Clear result after 5 seconds
      setTimeout(() => setActionResult(null), 5000)
    }
  }
  
  // Handle cleanup of old videos
  const handleCleanup = async (days = 30) => {
    if (!confirm(`This will delete videos older than ${days} days. Continue?`)) {
      return
    }
    
    setActionLoading(true)
    try {
      const response = await axios.post('/api/storage/clean', { days })
      
      setActionResult({
        success: true,
        message: `Deleted ${response.data.deleted} videos, freed ${formatBytes(response.data.freedSpace)}`
      })
      
      // Refresh data
      const diskResponse = await axios.get('/api/storage/disk-info')
      setDiskInfo(diskResponse.data)
      
      const statsResponse = await axios.get('/api/storage/video-stats')
      setVideoStats(statsResponse.data)
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to clean old videos'
      })
    } finally {
      setActionLoading(false)
      // Clear result after 5 seconds
      setTimeout(() => setActionResult(null), 5000)
    }
  }
  
  // Handle archiving videos
  const handleArchive = async () => {
    setActionLoading(true)
    try {
      const response = await axios.post('/api/storage/archive')
      
      setActionResult({
        success: true,
        message: `Archived ${response.data.archived} videos, saved ${formatBytes(response.data.savedSpace)}`
      })
      
      // Refresh disk info
      const diskResponse = await axios.get('/api/storage/disk-info')
      setDiskInfo(diskResponse.data)
      
      const statsResponse = await axios.get('/api/storage/video-stats')
      setVideoStats(statsResponse.data)
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to archive videos'
      })
    } finally {
      setActionLoading(false)
      // Clear result after 5 seconds
      setTimeout(() => setActionResult(null), 5000)
    }
  }
  
  // Update settings
  const handleSettingsUpdate = async () => {
    setActionLoading(true)
    try {
      const response = await axios.post('/api/storage/settings', settings)
      
      setActionResult({
        success: true,
        message: 'Storage settings updated successfully'
      })
    } catch (error) {
      setActionResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to update settings'
      })
    } finally {
      setActionLoading(false)
      // Clear result after 5 seconds
      setTimeout(() => setActionResult(null), 5000)
    }
  }
  
  // Handle settings change
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-medium mb-4">Storage Manager</h1>
      
      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin h-10 w-10 border-4 border-dashcam-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading storage information...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Result Message */}
          {actionResult && (
            <div className={`p-3 rounded-md ${actionResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {actionResult.success ? (
                <FaCheckCircle className="inline-block mr-2" />
              ) : (
                <FaExclamationTriangle className="inline-block mr-2" />
              )}
              {actionResult.message}
            </div>
          )}
          
          {/* Disk Status */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-medium">Storage Drive Status</h2>
              <button 
                onClick={handleDriveMount}
                disabled={actionLoading}
                className="btn btn-primary text-sm"
              >
                {diskInfo.mounted ? 'Unmount Drive' : 'Mount Drive'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="mb-2">
                  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${diskInfo.mounted ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">
                    {diskInfo.mounted ? 'Drive Mounted' : 'Drive Not Mounted'}
                  </span>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>Device: {diskInfo.device || 'N/A'}</p>
                  <p>Mount Point: {diskInfo.path || 'N/A'}</p>
                </div>
              </div>
              
              {diskInfo.mounted && (
                <div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Used: {formatBytes(diskInfo.used)} ({diskInfo.percent}%)</span>
                      <span>Free: {formatBytes(diskInfo.free)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          diskInfo.percent > 90 ? 'bg-red-600' : 
                          diskInfo.percent > 70 ? 'bg-yellow-500' : 
                          'bg-green-600'
                        }`}
                        style={{ width: `${diskInfo.percent}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Total Capacity: {formatBytes(diskInfo.total)}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Video Statistics */}
          <div className="card p-4">
            <h2 className="text-lg font-medium mb-3">Video Statistics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="space-y-2">
                  <p><strong>Total Videos:</strong> {videoStats.totalVideos}</p>
                  <p><strong>Total Size:</strong> {formatBytes(videoStats.totalSize)}</p>
                  {videoStats.oldestVideo && (
                    <p><strong>Oldest Video:</strong> {new Date(videoStats.oldestVideo).toLocaleDateString()}</p>
                  )}
                  {videoStats.newestVideo && (
                    <p><strong>Newest Video:</strong> {new Date(videoStats.newestVideo).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
              
              {videoStats.byMonth.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Storage by Month</h3>
                  <div className="space-y-2 text-sm">
                    {videoStats.byMonth.map(month => (
                      <div key={month.month} className="flex justify-between">
                        <span>{month.month}</span>
                        <span>{formatBytes(month.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Storage Actions */}
          <div className="card p-4">
            <h2 className="text-lg font-medium mb-3">Storage Actions</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-md text-center">
                <FaTrash className="text-3xl mx-auto mb-2 text-gray-600" />
                <h3 className="font-medium mb-1">Clean Old Videos</h3>
                <p className="text-sm text-gray-500 mb-3">Delete videos older than specified days</p>
                <div className="flex justify-center space-x-2">
                  <button 
                    onClick={() => handleCleanup(30)}
                    disabled={actionLoading}
                    className="btn btn-secondary text-sm"
                  >
                    30 Days
                  </button>
                  <button 
                    onClick={() => handleCleanup(90)}
                    disabled={actionLoading}
                    className="btn btn-secondary text-sm"
                  >
                    90 Days
                  </button>
                </div>
              </div>
              
              <div className="p-3 border rounded-md text-center">
                <FaArchive className="text-3xl mx-auto mb-2 text-gray-600" />
                <h3 className="font-medium mb-1">Archive Videos</h3>
                <p className="text-sm text-gray-500 mb-3">Compress old videos to save space</p>
                <button 
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className="btn btn-secondary text-sm"
                >
                  Archive Videos
                </button>
              </div>
              
              <div className="p-3 border rounded-md text-center">
                <FaSync className="text-3xl mx-auto mb-2 text-gray-600" />
                <h3 className="font-medium mb-1">Refresh Stats</h3>
                <p className="text-sm text-gray-500 mb-3">Reload storage information</p>
                <button 
                  onClick={() => {
                    setLoading(true)
                    axios.get('/api/storage/disk-info').then(res => setDiskInfo(res.data))
                    axios.get('/api/storage/video-stats').then(res => setVideoStats(res.data))
                      .finally(() => setLoading(false))
                  }}
                  disabled={loading || actionLoading}
                  className="btn btn-secondary text-sm"
                >
                  Refresh Now
                </button>
              </div>
            </div>
          </div>
          
          {/* Storage Settings */}
          <div className="card p-4">
            <h2 className="text-lg font-medium mb-3">Storage Settings</h2>
            
            <div className="space-y-4">
              {/* Auto-clean settings */}
              <div>
                <div className="flex items-center mb-2">
                  <input 
                    type="checkbox" 
                    id="autoCleanEnabled"
                    checked={settings.autoCleanEnabled}
                    onChange={e => handleSettingChange('autoCleanEnabled', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="autoCleanEnabled" className="font-medium">
                    Enable Automatic Cleanup
                  </label>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Automatically delete old videos when storage reaches threshold
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm mb-1">Storage Threshold (%)</label>
                    <input 
                      type="number" 
                      min="50" 
                      max="99"
                      value={settings.autoCleanThreshold}
                      onChange={e => handleSettingChange('autoCleanThreshold', parseInt(e.target.value))}
                      className="input w-full"
                      disabled={!settings.autoCleanEnabled}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Cleanup starts when storage usage exceeds this percentage
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-1">Age Threshold (days)</label>
                    <input 
                      type="number" 
                      min="7" 
                      max="365"
                      value={settings.autoCleanDays}
                      onChange={e => handleSettingChange('autoCleanDays', parseInt(e.target.value))}
                      className="input w-full"
                      disabled={!settings.autoCleanEnabled}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Videos older than this many days will be deleted first
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Drive settings */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Drive Configuration</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Main Drive Device</label>
                    <input 
                      type="text" 
                      value={settings.mainDrive}
                      onChange={e => handleSettingChange('mainDrive', e.target.value)}
                      className="input w-full"
                      placeholder="/dev/sda1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Device path for external storage (e.g., /dev/sda1)
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-1">Mount Point</label>
                    <input 
                      type="text" 
                      value={settings.mountPoint}
                      onChange={e => handleSettingChange('mountPoint', e.target.value)}
                      className="input w-full"
                      placeholder="/mnt/dashcam_storage"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Directory where the drive should be mounted
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <button 
                  onClick={handleSettingsUpdate}
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  {actionLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StorageManager