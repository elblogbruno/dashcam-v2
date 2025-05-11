import { useState, useEffect } from 'react'
import axios from 'axios'
import Calendar from 'react-calendar'
import { format } from 'date-fns'
import { FaVideo, FaFileDownload, FaMapMarkerAlt, FaCarSide, FaMobileAlt, FaClock, FaRoad, FaCalendarDay } from 'react-icons/fa'
import 'react-calendar/dist/Calendar.css'

function CalendarView() {
  const [date, setDate] = useState(new Date())
  const [calendarData, setCalendarData] = useState({})
  const [selectedDayTrips, setSelectedDayTrips] = useState([])
  const [externalVideos, setExternalVideos] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)

  // Fetch calendar data on mount
  useEffect(() => {
    fetchCalendarData(date.getFullYear(), date.getMonth() + 1)
  }, [])

  // Fetch trips when date changes
  useEffect(() => {
    fetchTripsForDate(format(date, 'yyyy-MM-dd'))
  }, [date])

  // Function to fetch calendar data for a month
  const fetchCalendarData = async (year, month) => {
    try {
      const response = await axios.get(`/api/trips/calendar?year=${year}&month=${month}`)
      setCalendarData(response.data)
    } catch (error) {
      console.error('Error fetching calendar data:', error)
    }
  }

  // Function to fetch trips for a specific date
  const fetchTripsForDate = async (dateStr) => {
    setIsLoading(true)
    try {
      const response = await axios.get(`/api/trips?date_str=${dateStr}`)
      setSelectedDayTrips(response.data.trips || [])
      setExternalVideos(response.data.external_videos || [])
    } catch (error) {
      console.error('Error fetching trips:', error)
      setSelectedDayTrips([])
      setExternalVideos([])
    } finally {
      setIsLoading(false)
    }
  }

  // Function to generate summary video
  const generateSummary = async (dateStr) => {
    try {
      setIsLoading(true)
      await axios.post(`/api/video/generate-summary?day=${dateStr}`)
      alert('Started generating summary video. This may take a few minutes.')
      // Refresh trips after a delay to show the new summary
      setTimeout(() => {
        fetchTripsForDate(dateStr)
      }, 3000)
    } catch (error) {
      console.error('Error generating summary:', error)
      alert('Error generating summary video. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Function to get tile content for calendar
  const getTileContent = ({ date, view }) => {
    // Only add content to month view
    if (view !== 'month') return null
    
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayData = calendarData[dateStr]
    
    if (!dayData) return null
    
    const hasTrips = dayData.trips > 0
    const hasExternalVideos = dayData.external_videos > 0
    
    if (!hasTrips && !hasExternalVideos) return null

    return (
      <div className="flex flex-col items-center mt-1">
        {hasTrips && (
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-dashcam-500 mr-1"></div>
            <span className="text-xs">{dayData.trips}</span>
          </div>
        )}
        {hasExternalVideos && (
          <div className="flex items-center mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            <span className="text-xs">{dayData.external_videos}</span>
          </div>
        )}
      </div>
    )
  }

  // Function to play a video
  const playVideo = (videoUrl) => {
    setSelectedVideo(videoUrl)
  }

  // Render video player modal
  const renderVideoPlayer = () => {
    if (!selectedVideo) return null
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg overflow-hidden w-full max-w-3xl">
          <div className="p-3 bg-dashcam-800 text-white flex justify-between items-center">
            <h3 className="text-lg font-medium">Video Player</h3>
            <button 
              onClick={() => setSelectedVideo(null)}
              className="text-white hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <div className="p-0">
            <video 
              src={selectedVideo} 
              controls 
              autoPlay 
              className="w-full"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-dashcam-800 flex items-center">
        <FaCalendarDay className="mr-3" /> Calendario de Grabaciones
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar Card */}
        <div className="card lg:col-span-1 p-0 overflow-hidden shadow-xl rounded-xl border border-gray-200 bg-white hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-dashcam-800 to-dashcam-600 text-white p-4 font-semibold text-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaCalendarDay className="mr-2" /> 
                <span>Calendario</span>
              </div>
              <span className="text-sm opacity-80">{format(date, 'MMMM yyyy')}</span>
            </div>
          </div>
          <div className="p-4">
            <Calendar 
              onChange={setDate} 
              value={date}
              tileContent={getTileContent}
              className="w-full border-0"
              tileClassName={({ date, view }) => {
                const dateStr = format(date, 'yyyy-MM-dd')
                const dayData = calendarData[dateStr]
                if (dayData && (dayData.trips > 0 || dayData.external_videos > 0)) {
                  return 'has-events bg-dashcam-50'; // Custom styling with background color
                }
                return null;
              }}
            />
            <div className="mt-6 flex flex-col items-center justify-center bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="text-sm text-gray-700 font-medium mb-2">Leyenda</div>
              <div className="flex items-center justify-center space-x-6">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-dashcam-500 mr-2 shadow-sm"></div>
                  <span className="text-sm">Viajes de Dashcam</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-green-500 mr-2 shadow-sm"></div>
                  <span className="text-sm">Videos Externos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Selected Day Content */}
        <div className="lg:col-span-2">
          {/* Selected day info */}
          <div className="card mb-6 p-0 overflow-hidden shadow-xl rounded-xl border border-gray-200 bg-white hover:shadow-2xl transition-shadow duration-300">
            <div className="bg-gradient-to-r from-dashcam-700 to-dashcam-600 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center">
                <FaClock className="mr-2" />
                {format(date, 'MMMM d, yyyy')}
              </h2>
              {(selectedDayTrips.length > 0) && (
                <button 
                  className="px-4 py-2 bg-dashcam-500 hover:bg-dashcam-600 text-white rounded-lg transition-all duration-200 flex items-center text-sm font-medium shadow-md hover:shadow-lg transform hover:translate-y-[-1px]"
                  onClick={() => generateSummary(format(date, 'yyyy-MM-dd'))}
                  disabled={isLoading}
                >
                  {isLoading ? 'Procesando...' : 'Generar Resumen'}
                </button>
              )}
            </div>
            
            <div className="p-4">
              {isLoading ? (
                <div className="py-10 text-center text-gray-500 animate-pulse">
                  <div className="loader"></div>
                  <p className="mt-3">Loading recordings...</p>
                </div>
              ) : (
                <>
                  {selectedDayTrips.length === 0 && externalVideos.length === 0 ? (
                    <div className="py-10 text-center">
                      <div className="text-gray-400 text-5xl mb-3">
                        <FaVideo />
                      </div>
                      <p className="text-gray-500">No recordings found for this date</p>
                      <p className="text-gray-400 text-sm mt-2">Try selecting a different day</p>
                    </div>
                  ) : (
                    <div>
                      {/* Trip recordings */}
                      {selectedDayTrips.length > 0 && (
                        <div className="mb-8">
                          <h3 className="text-lg font-semibold mb-4 text-dashcam-700 flex items-center border-b pb-3">
                            <FaCarSide className="mr-2" />
                            Viajes ({selectedDayTrips.length})
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {selectedDayTrips.map((trip) => (
                              <div key={trip.id} className="border border-gray-200 rounded-xl p-0 overflow-hidden hover:shadow-lg transition-all duration-300 bg-white transform hover:translate-y-[-2px]">
                                <div className="bg-gradient-to-r from-gray-50 to-white p-4 flex justify-between items-center border-b">
                                  <div className="font-semibold text-dashcam-800 flex items-center">
                                    <FaClock className="mr-2 text-dashcam-600" />
                                    {format(new Date(trip.start_time), 'h:mm a')}
                                    {trip.end_time && ` - ${format(new Date(trip.end_time), 'h:mm a')}`}
                                  </div>
                                  {trip.distance_km && (
                                    <div className="text-sm bg-dashcam-50 text-dashcam-800 flex items-center py-1 px-3 rounded-full">
                                      <FaRoad className="mr-2 text-dashcam-600" />
                                      {trip.distance_km !== undefined ? trip.distance_km.toFixed(1) : '0.0'} km
                                    </div>
                                  )}
                                </div>
                                
                                <div className="p-3 flex justify-between items-center">
                                  <div>
                                    {trip.landmarks && trip.landmarks.length > 0 && (
                                      <div className="text-sm text-gray-600 flex items-center">
                                        <FaMapMarkerAlt className="mr-1 text-red-500" />
                                        {trip.landmarks.length} landmark{trip.landmarks.length !== 1 ? 's' : ''} visited
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex space-x-3">
                                    {(trip.video_files && Array.isArray(trip.video_files) && trip.video_files.length > 0) ? (
                                      <button 
                                        className="text-dashcam-600 hover:text-dashcam-800 flex items-center text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors duration-200"
                                        onClick={() => playVideo(`/api/videos/${trip.video_files[0]}`)}
                                      >
                                        <FaVideo className="mr-1" /> Raw Video
                                      </button>
                                    ) : (
                                      <span className="text-xs text-gray-500">No se encontraron archivos de video</span>
                                    )}
                                    {trip.summary_file && (
                                      <button 
                                        className="text-dashcam-600 hover:text-dashcam-800 flex items-center text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors duration-200"
                                        onClick={() => playVideo(`/api/videos/${trip.summary_file}`)}
                                      >
                                        <FaFileDownload className="mr-1" /> Summary
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* External videos */}
                      {externalVideos.length > 0 && (
                        <div>
                          <h3 className="text-md font-semibold mb-3 text-green-700 flex items-center border-b pb-2">
                            <FaMobileAlt className="mr-2" />
                            External Videos ({externalVideos.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {externalVideos.map((video) => (
                              <div key={video.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200 bg-white">
                                <div className="bg-green-50 p-3 border-b">
                                  <div className="font-semibold text-green-800 flex items-center">
                                    <FaMobileAlt className="mr-2 text-green-600" />
                                    {video.source || 'External'} Video
                                  </div>
                                  {video.upload_time && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Uploaded: {format(new Date(video.upload_time), 'h:mm a')}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="p-3 flex justify-between items-center">
                                  <div>
                                    {(video.lat && video.lon) && (
                                      <div className="text-sm text-gray-600 flex items-center">
                                        <FaMapMarkerAlt className="mr-1 text-red-500" />
                                        Location available
                                      </div>
                                    )}
                                  </div>
                                  <button 
                                    className="text-green-600 hover:text-green-800 flex items-center text-sm bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg transition-colors duration-200"
                                    onClick={() => playVideo(`/api/videos/external/${video.id}`)}
                                  >
                                    <FaVideo className="mr-1" /> Play Video
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Video player modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl overflow-hidden w-full max-w-4xl shadow-2xl">
            <div className="p-3 bg-dashcam-800 text-white flex justify-between items-center">
              <h3 className="text-lg font-medium">Video Player</h3>
              <button 
                onClick={() => setSelectedVideo(null)}
                className="text-white hover:text-gray-300 bg-dashcam-700 hover:bg-dashcam-600 p-1 rounded-full w-7 h-7 flex items-center justify-center transition-colors duration-200"
              >
                ✕
              </button>
            </div>
            <div className="p-0">
              <video 
                src={selectedVideo} 
                controls 
                autoPlay 
                className="w-full"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      )}
      
      {/* Add custom CSS */}
      <style jsx>{`
        .react-calendar {
          border: none;
          font-family: inherit;
          width: 100%;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .react-calendar__navigation {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          height: 48px;
          margin-bottom: 0;
        }
        
        .react-calendar__navigation button {
          min-width: 44px;
          font-weight: 600;
          font-size: 1rem;
          color: #4b5563;
        }
        
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: #f3f4f6;
        }
        
        .react-calendar__month-view__weekdays {
          border-bottom: 1px solid #e5e7eb;
          padding: 0.5rem 0;
          font-weight: 600;
          color: #4b5563;
        }
        
        .react-calendar__tile--active {
          background-color: #3c75ad !important;
          color: white;
          font-weight: 600;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        
        .react-calendar__tile--active:hover {
          background-color: #2563eb !important;
        }
        
        .react-calendar__tile:hover {
          background-color: #f3f4f6;
        }
        
        .react-calendar__month-view__days__day--weekend {
          color: #ef4444;
        }
        
        .react-calendar__tile {
          position: relative;
          height: 60px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          padding-top: 8px;
          font-size: 1rem;
          border-radius: 0.25rem;
          margin: 2px;
          transition: all 0.2s ease;
        }
        
        .react-calendar__tile:hover {
          transform: translateY(-1px);
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        
        .has-events {
          background-color: #edf2f7;
          font-weight: 600;
          border-bottom: 2px solid #3c75ad;
        }
        
        .loader {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #3c75ad;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default CalendarView