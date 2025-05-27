import {
  FaPlay, FaStop, FaDownload, FaMapMarkerAlt, 
  FaCrosshairs, FaRoute, FaTimes, FaListUl, FaEye, FaEyeSlash
} from 'react-icons/fa'

function ControlPanel({ 
  isRecording, 
  activeTrip,
  startTrip, 
  endTrip, 
  navigationSidebarOpen, 
  setNavigationSidebarOpen,
  showPlannedRoute, 
  setShowPlannedRoute,
  showLandmarks, 
  setShowLandmarks,
  downloadLandmarks,
  createLandmark,
  centerOnPosition,
  clearPlannedTrip
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-2 flex space-x-2 z-40"> {/* Añadido z-index alto */}
      {!isRecording ? (
        <button 
          onClick={startTrip}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md flex items-center"
          title="Iniciar viaje"
        >
          <FaPlay className="mr-1" /> <span className="text-xs sm:text-sm">Iniciar viaje</span>
        </button>
      ) : (
        <button 
          onClick={endTrip}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md flex items-center"
          title="Finalizar viaje"
        >
          <FaStop className="mr-1" /> <span className="text-xs sm:text-sm">Finalizar viaje</span>
        </button>
      )}
      
      {activeTrip && (
        <button
          onClick={() => setNavigationSidebarOpen(!navigationSidebarOpen)}
          className="bg-dashcam-600 hover:bg-dashcam-700 text-white p-2 rounded-full"
          title="Toggle Navigation Panel"
        >
          <FaListUl />
        </button>
      )}
      
      {activeTrip && (
        <button
          onClick={() => setShowPlannedRoute(!showPlannedRoute)}
          className={`${showPlannedRoute ? 'bg-dashcam-500' : 'bg-gray-400'} hover:bg-dashcam-600 text-white p-2 rounded-full`}
          title={showPlannedRoute ? "Hide Planned Route" : "Show Planned Route"}
        >
          <FaRoute />
        </button>
      )}
      
      <button
        onClick={() => setShowLandmarks(!showLandmarks)}
        className={`${showLandmarks ? 'bg-purple-500' : 'bg-gray-400'} hover:bg-purple-600 text-white p-2 rounded-full`}
        title={showLandmarks ? "Hide Landmarks" : "Show Landmarks"}
      >
        {showLandmarks ? <FaEye /> : <FaEyeSlash />}
      </button>
      
      <button 
        onClick={downloadLandmarks}
        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full"
        title="Download Landmarks"
      >
        <FaDownload />
      </button>
      
      <button 
        onClick={createLandmark}
        className="bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-full"
        title="Create Landmark at Current Position"
      >
        <FaMapMarkerAlt />
      </button>
      
      <button 
        onClick={centerOnPosition}
        className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-full"
        title="Center on Current Position"
      >
        <FaCrosshairs />
      </button>
      
      {activeTrip && (
        <button 
          onClick={clearPlannedTrip}
          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full"
          title="Clear Planned Trip"
        >
          <FaTimes />
        </button>
      )}
    </div>
  )
}

export default ControlPanel
