import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

// Component to manage map center based on current location
function MapUpdater({ position, shouldFollow }) {
  const map = useMap()
  
  useEffect(() => {
    if (position && shouldFollow) {
      map.setView(position, map.getZoom())
    }
  }, [position, shouldFollow, map])
  
  return null
}

export default MapUpdater
