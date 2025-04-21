import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'
import { format } from 'date-fns'
import { FaUpload, FaFileVideo, FaCheckCircle, FaTimesCircle, FaFolderOpen, FaCalendarAlt } from 'react-icons/fa'

function BulkUploader() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [uploadDate, setUploadDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [uploadLocation, setUploadLocation] = useState({ lat: '', lon: '' })
  const [dragActive, setDragActive] = useState(false)
  const [uploadResults, setUploadResults] = useState([])
  const [useFileDate, setUseFileDate] = useState(true)
  
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  // Set up drag and drop event handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  // Handle dropped files
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [])

  // Process selected files
  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).filter(file => 
      file.type.startsWith('video/') || 
      file.name.endsWith('.mp4') || 
      file.name.endsWith('.avi') || 
      file.name.endsWith('.mov') ||
      file.name.endsWith('.insv') // Insta360 files
    )
    
    if (newFiles.length === 0) {
      alert('No video files found. Supported formats: MP4, AVI, MOV, INSV')
      return
    }
    
    // Create file entries with metadata
    const filesWithMeta = newFiles.map(file => {
      // Try to extract date from filename (common format for cameras: yyyymmdd_hhmmss)
      let fileDate = null
      const dateMatch = file.name.match(/(\d{4})(\d{2})(\d{2})/)
      if (dateMatch) {
        const [_, year, month, day] = dateMatch
        fileDate = `${year}-${month}-${day}`
      }
      
      return {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        fileDate,
        status: 'pending' // pending, uploading, success, error
      }
    })
    
    setFiles(prev => [...prev, ...filesWithMeta])
  }

  // Handle file selection via button
  const onSelectFilesClick = () => {
    fileInputRef.current.click()
  }
  
  // Handle folder selection via button
  const onSelectFolderClick = () => {
    folderInputRef.current.click()
  }

  // Handle file input change
  const onFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  // Handle folder input change (gets all files in the folder)
  const onFolderInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  // Remove a file from the list
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Clear all files
  const clearFiles = () => {
    setFiles([])
    setUploadProgress({})
    setUploadResults([])
  }

  // Upload all files
  const uploadFiles = async () => {
    if (files.length === 0) return
    
    setUploading(true)
    setUploadResults([])
    const results = []
    
    for (let i = 0; i < files.length; i++) {
      const fileObj = files[i]
      
      // Skip files that have already been processed
      if (fileObj.status === 'success') continue
      
      // Update status to uploading
      setFiles(prev => {
        const updated = [...prev]
        updated[i] = { ...updated[i], status: 'uploading' }
        return updated
      })
      
      // Determine which date to use for this file
      const fileUploadDate = useFileDate && fileObj.fileDate ? fileObj.fileDate : uploadDate
      
      try {
        const formData = new FormData()
        formData.append('file', fileObj.file)
        formData.append('date', fileUploadDate)
        
        if (uploadLocation.lat && uploadLocation.lon) {
          formData.append('lat', uploadLocation.lat)
          formData.append('lon', uploadLocation.lon)
        }
        
        // Track upload progress
        const config = {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(prev => ({
              ...prev,
              [i]: percentCompleted
            }))
          }
        }
        
        const response = await axios.post('/api/videos/upload', formData, config)
        
        // Update file status to success
        setFiles(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], status: 'success', response: response.data }
          return updated
        })
        
        results.push({
          file: fileObj.name,
          success: true,
          message: 'Uploaded successfully',
          date: fileUploadDate
        })
        
      } catch (error) {
        console.error(`Error uploading file ${fileObj.name}:`, error)
        
        // Update file status to error
        setFiles(prev => {
          const updated = [...prev]
          updated[i] = { 
            ...updated[i], 
            status: 'error', 
            error: error.response?.data?.detail || error.message 
          }
          return updated
        })
        
        results.push({
          file: fileObj.name,
          success: false,
          message: error.response?.data?.detail || error.message,
          date: fileUploadDate
        })
      }
    }
    
    setUploadResults(results)
    setUploading(false)
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-medium mb-4">Bulk Video Uploader</h1>
      
      {/* Drag & Drop Area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 
          ${dragActive ? 'border-dashcam-500 bg-dashcam-50' : 'border-gray-300'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <FaUpload className="mx-auto text-3xl text-gray-400 mb-3" />
        <p className="mb-2">
          Drag and drop video files here
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Supported formats: MP4, AVI, MOV, INSV (Insta360)
        </p>
        <div className="flex justify-center space-x-4">
          <button 
            onClick={onSelectFilesClick}
            className="btn btn-primary flex items-center"
          >
            <FaFileVideo className="mr-2" />
            Select Files
          </button>
          <button 
            onClick={onSelectFolderClick}
            className="btn btn-secondary flex items-center"
          >
            <FaFolderOpen className="mr-2" />
            Select Folder
          </button>
        </div>
        
        {/* Hidden file inputs */}
        <input 
          ref={fileInputRef}
          type="file" 
          multiple 
          accept="video/*,.insv"
          className="hidden"
          onChange={onFileInputChange}
        />
        <input 
          ref={folderInputRef}
          type="file" 
          webkitdirectory="true"
          directory="true"
          multiple
          className="hidden"
          onChange={onFolderInputChange}
        />
      </div>
      
      {/* Upload Options */}
      <div className="card p-4 mb-4">
        <h2 className="text-lg font-medium mb-3">Upload Options</h2>
        
        <div className="space-y-3">
          <div className="flex items-center">
            <input 
              id="useFileDate" 
              type="checkbox" 
              checked={useFileDate} 
              onChange={() => setUseFileDate(!useFileDate)}
              className="mr-2"
            />
            <label htmlFor="useFileDate">
              Try to extract date from filenames (if possible)
            </label>
          </div>
          
          <div>
            <label className="block mb-1 text-sm">Default Date (for files without embedded date)</label>
            <div className="flex items-center">
              <FaCalendarAlt className="text-gray-500 mr-2" />
              <input 
                type="date" 
                value={uploadDate} 
                onChange={(e) => setUploadDate(e.target.value)}
                className="input flex-grow"
                disabled={uploading}
              />
            </div>
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
                disabled={uploading}
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
                disabled={uploading}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* File List */}
      {files.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium">{files.length} File{files.length !== 1 ? 's' : ''} Selected</h2>
            <div>
              <button 
                onClick={clearFiles}
                className="btn btn-secondary text-sm mr-2"
                disabled={uploading}
              >
                Clear All
              </button>
              <button 
                onClick={uploadFiles}
                className="btn btn-primary text-sm"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload All'}
              </button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((file, index) => (
              <div 
                key={index} 
                className={`border rounded-md p-3 ${
                  file.status === 'success' ? 'bg-green-50 border-green-200' : 
                  file.status === 'error' ? 'bg-red-50 border-red-200' : 
                  file.status === 'uploading' ? 'bg-blue-50 border-blue-200' : 
                  'bg-white border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-grow">
                    <div className="flex items-center">
                      <FaFileVideo className="text-gray-500 mr-2" />
                      <span className="font-medium truncate">{file.name}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                      {file.fileDate && (
                        <span className="ml-2">
                          • Detected date: {file.fileDate}
                        </span>
                      )}
                    </div>
                    
                    {file.status === 'error' && (
                      <div className="text-sm text-red-600 mt-1">
                        Error: {file.error || 'Upload failed'}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center">
                    {file.status === 'success' && (
                      <FaCheckCircle className="text-green-500 mr-2" />
                    )}
                    {file.status === 'error' && (
                      <FaTimesCircle className="text-red-500 mr-2" />
                    )}
                    {!uploading && file.status !== 'uploading' && (
                      <button 
                        onClick={() => removeFile(index)}
                        className="text-gray-500 hover:text-red-500"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Progress bar */}
                {(file.status === 'uploading' || uploadProgress[index]) && (
                  <div className="w-full bg-gray-200 rounded-full h-2.5 my-2">
                    <div 
                      className="bg-dashcam-600 h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress[index] || 0}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Upload Results Summary */}
      {uploadResults.length > 0 && (
        <div className="card p-4">
          <h2 className="text-lg font-medium mb-3">Upload Results</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm mb-2">
              <span>Successfully uploaded: {uploadResults.filter(r => r.success).length}</span>
              <span>Failed: {uploadResults.filter(r => !r.success).length}</span>
            </div>
            
            <p className="text-center py-2 bg-green-100 text-green-800 rounded">
              Videos will appear in your Calendar view
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default BulkUploader