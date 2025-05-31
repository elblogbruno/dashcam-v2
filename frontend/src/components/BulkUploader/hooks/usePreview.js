import { useState, useEffect } from 'react'

export const usePreview = () => {
  const [previewFile, setPreviewFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  const openPreview = (file, index) => {
    if (file && file.file instanceof File) {
      try {
        const url = URL.createObjectURL(file.file)
        setPreviewUrl(url)
        setPreviewFile({ ...file, index })
      } catch (error) {
        console.error('Error creating object URL for preview:', error)
      }
    }
  }

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    
    setPreviewUrl(null)
    setPreviewFile(null)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return {
    previewFile,
    previewUrl,
    openPreview,
    closePreview
  }
}
