import { useState, useEffect, useRef } from 'react'

export const useThumbnails = (files) => {
  const [thumbnails, setThumbnails] = useState({})
  const objectUrlsRef = useRef({})

  useEffect(() => {
    files.forEach((file, index) => {
      if (!thumbnails[index] && file.file instanceof File) {
        generateThumbnailForFile(file, index)
      }
    })
    
    return () => {
      Object.values(objectUrlsRef.current).forEach(url => {
        if (url) URL.revokeObjectURL(url)
      })
      objectUrlsRef.current = {}
    }
  }, [files])

  const generateThumbnailForFile = (file, index) => {
    try {
      if (thumbnails[index]) return

      if (!file.file.type.startsWith('video/') && 
          !['mp4', 'mov', 'avi', 'webm', 'insv', 'mts', 'm2ts', 'mkv'].some(ext => 
              file.name.toLowerCase().endsWith(`.${ext}`))) {
        console.warn("Archivo no reconocido como video:", file.name)
        setThumbnails(prev => ({
          ...prev,
          [index]: null
        }))
        return
      }
      
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      
      const objectUrl = URL.createObjectURL(file.file)
      objectUrlsRef.current[index] = objectUrl
      video.src = objectUrl

      const timeoutId = setTimeout(() => {
        console.warn("Timeout generando miniatura para:", file.name)
        setThumbnails(prev => ({
          ...prev,
          [index]: null
        }))
        
        if (objectUrlsRef.current[index]) {
          URL.revokeObjectURL(objectUrlsRef.current[index])
          delete objectUrlsRef.current[index]
        }
      }, 3000)
      
      const handleVideoError = (error) => {
        clearTimeout(timeoutId)
        console.error("Error con el video:", error)
        setThumbnails(prev => ({
          ...prev,
          [index]: null
        }))
        
        if (objectUrlsRef.current[index]) {
          URL.revokeObjectURL(objectUrlsRef.current[index])
          delete objectUrlsRef.current[index]
        }
      }
      
      video.onloadedmetadata = () => {
        try {
          const seekTime = Math.min(1, video.duration / 2)
          video.currentTime = seekTime
        } catch (error) {
          handleVideoError(error)
        }
      }
      
      video.onseeked = () => {
        clearTimeout(timeoutId)
        
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth || 320
          canvas.height = video.videoHeight || 180
          
          const ctx = canvas.getContext('2d')
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            
            try {
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7)
              
              setThumbnails(prev => ({
                ...prev,
                [index]: thumbnailUrl
              }))
            } catch (e) {
              console.warn("Error generando URL de datos:", e)
              setThumbnails(prev => ({
                ...prev,
                [index]: null
              }))
            }
          } else {
            console.warn("Dimensiones de video no válidas:", file.name)
            setThumbnails(prev => ({
              ...prev,
              [index]: null
            }))
          }
        } catch (error) {
          handleVideoError(error)
        } finally {
          if (objectUrlsRef.current[index]) {
            URL.revokeObjectURL(objectUrlsRef.current[index])
            delete objectUrlsRef.current[index]
          }
        }
      }
      
      video.onerror = handleVideoError
    } catch (error) {
      console.error("Error general generando miniatura:", error)
      setThumbnails(prev => ({
        ...prev,
        [index]: null
      }))
    }
  }

  return thumbnails
}
