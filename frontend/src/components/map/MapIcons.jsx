import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix for the default marker icon issue in Leaflet with webpack
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

// Apply default icon to all markers
L.Marker.prototype.options.icon = DefaultIcon

// Custom colored icons for different marker types
export const createColoredIcon = (color) => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 12px; border: 3px solid white; box-shadow: 1px 1px 3px rgba(0,0,0,0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

// Car icon for current location
export const carIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #4a69bd; color: white; width: 30px; height: 30px; border-radius: 15px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 1px 1px 3px rgba(0,0,0,0.4);">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
             <path d="M4 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6 8a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H6ZM4.862 4.276 3.906 6.19a.51.51 0 0 0 .497.731c.91-.073.995-.375 1.076-.493C5.778 6.094 4.83 6.15 5 6.5h6.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V6.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H3.333c-.168 0-.334-.036-.5-.11V7.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H2.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H1.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H1a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H2a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1V5.942l-.777-2.388A1.5 1.5 0 0 0 10.261 2H5.75a1.5 1.5 0 0 0-1.461 1.157l-.777 2.388V7.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h2.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H4a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h3.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H5.5a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1V5.793l-1-3.076A1.5 1.5 0 0 0 10.568 1H5.442a1.5 1.5 0 0 0-1.426.913l-.758 2.331A.5.5 0 0 0 3.5 4.5H4Z"/>
           </svg>
         </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
})

// Start and destination icons
export const startIcon = createColoredIcon('#4CAF50') // Green
export const destinationIcon = createColoredIcon('#F44336') // Red
export const waypointIcon = createColoredIcon('#FF9800') // Orange
