import { FaTimes } from 'react-icons/fa'

// Formato de distancia
const formatDistance = (meters) => {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

function NavigationSidebar({ activeTrip, navigationSidebarOpen, setNavigationSidebarOpen, completedWaypoints, navigationStatus }) {
  if (!activeTrip || !navigationSidebarOpen) return null;
  
  // Get all navigation points (start + waypoints + end)
  const getAllNavigationPoints = () => {
    if (!activeTrip) return []
    
    return [
      { ...activeTrip.start_location, name: 'Start', type: 'start' },
      ...(activeTrip.waypoints || []).map((wp, i) => ({ 
        ...wp, 
        name: `Waypoint ${i+1}`, 
        type: 'waypoint',
        completed: completedWaypoints.includes(i + 1)
      })),
      { ...activeTrip.end_location, name: 'Destination', type: 'end' }
    ]
  }
  
  return (
    <div className="w-64 bg-white shadow-lg overflow-auto h-full z-40 absolute left-0 top-0 bottom-0">
      <div className="p-3 bg-dashcam-700 text-white flex justify-between items-center">
        <h3 className="font-medium">Navigation</h3>
        <button 
          onClick={() => setNavigationSidebarOpen(false)}
          className="text-white hover:text-gray-200"
        >
          <FaTimes />
        </button>
      </div>
      
      <div className="p-3">
        <div className="mb-4">
          <h4 className="font-medium text-dashcam-800">{activeTrip.name}</h4>
          <p className="text-sm text-gray-600">{getAllNavigationPoints().length - 1} points remaining</p>
        </div>
        
        <div className="space-y-2">
          {getAllNavigationPoints().map((point, index) => {
            const isCompleted = index === 0 ? 
              completedWaypoints.includes(0) : 
              (point.type === 'waypoint' && point.completed);
            
            const isNext = !isCompleted && !completedWaypoints.includes(index);
            
            return (
              <div 
                key={index}
                className={`p-2 border rounded-md ${
                  isCompleted ? 'bg-gray-100 border-gray-300' :
                  isNext ? 'bg-dashcam-50 border-dashcam-500 border-2' :
                  'border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <div 
                    className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isNext ? 'bg-dashcam-500 text-white' :
                      'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{point.name}</div>
                    <div className="text-xs text-gray-500">
                      {isCompleted ? 'Completed' : 
                       isNext && navigationStatus ? 
                        `${formatDistance(navigationStatus.distance)} remaining` : 
                        ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}

export default NavigationSidebar
