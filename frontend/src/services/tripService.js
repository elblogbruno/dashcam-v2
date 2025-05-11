import axios from 'axios';

export const fetchTrips = async () => {
  try {
    const response = await axios.get('/api/trip-planner');
    return response.data.trips.sort((a, b) => 
      new Date(a.start_date) - new Date(b.start_date)
    );
  } catch (error) {
    throw error;
  }
};

export const createTrip = async (tripData) => {
  try {
    // Format trip data consistently with updateTrip
    const formattedTripData = {
      ...tripData,
      // Ensure start_location contains only the required numerical fields
      start_location: {
        lat: parseFloat(tripData.start_location.lat),
        lon: parseFloat(tripData.start_location.lon)
      },
      // Ensure end_location contains only the required numerical fields
      end_location: {
        lat: parseFloat(tripData.end_location.lat),
        lon: parseFloat(tripData.end_location.lon)
      },
      // Format waypoints to ensure proper structure
      waypoints: tripData.waypoints?.map(waypoint => ({
        lat: parseFloat(waypoint.lat),
        lon: parseFloat(waypoint.lon),
        name: waypoint.name || undefined
      })) || [],
      // Store origin and destination names separately if they exist
      origin_name: tripData.start_location.name || undefined,
      destination_name: tripData.end_location.name || undefined
    };
    
    console.log("Sending formatted trip data:", formattedTripData);
    const response = await axios.post('/api/trip-planner', formattedTripData);
    return response.data;
  } catch (error) {
    console.error('Trip creation error details:', error.response?.data || error.message);
    throw error;
  }
};

export const updateTrip = async (tripData) => {
  try {
    // Create a properly formatted version of the trip data
    const formattedTripData = {
      ...tripData,
      // Ensure start_location contains only the required numerical fields
      start_location: {
        lat: parseFloat(tripData.start_location.lat),
        lon: parseFloat(tripData.start_location.lon)
      },
      // Ensure end_location contains only the required numerical fields
      end_location: {
        lat: parseFloat(tripData.end_location.lat),
        lon: parseFloat(tripData.end_location.lon)
      },
      // Format waypoints to ensure proper structure
      waypoints: tripData.waypoints?.map(waypoint => ({
        lat: parseFloat(waypoint.lat),
        lon: parseFloat(waypoint.lon),
        name: waypoint.name || undefined
      })) || [],
      // Store origin and destination names separately if they exist
      origin_name: tripData.start_location.name || undefined,
      destination_name: tripData.end_location.name || undefined
    };

    console.log("Sending formatted trip data:", formattedTripData);
    const response = await axios.put(`/api/trip-planner/${tripData.id}`, formattedTripData);
    return response.data;
  } catch (error) {
    console.error('Trip update error details:', error.response?.data || error.message);
    throw error;
  }
};

export const deleteTrip = async (tripId) => {
  try {
    await axios.delete(`/api/trip-planner/${tripId}`);
    return true;
  } catch (error) {
    throw error;
  }
};

export const downloadLandmarks = async (tripId, onProgressUpdate) => {
  try {
    console.log(`[DEBUG] Starting landmark download for trip: ${tripId}`);
    
    // First explicitly start the download process (this was missing)
    try {
      console.log(`[DEBUG] Initiating download via POST request`);
      const startDownload = await axios.post(`/api/trip-planner/${tripId}/download-landmarks`, {
        radius_km: 10 // Default radius of 10km
      });
      console.log(`[DEBUG] Download initiation response:`, startDownload.data);
      
      // Initial progress update
      if (onProgressUpdate) {
        onProgressUpdate({
          progress: 0,
          detail: "Download started..."
        });
      }
      
      // Wait a moment for the backend to set up the download
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (e) {
      // If there's an error, check if it's because the download is already in progress
      console.log(`[DEBUG] Error starting download:`, e);
      if (e.response && e.response.status === 200 && e.response.data.status === "in_progress") {
        console.log(`[DEBUG] Download already in progress:`, e.response.data);
        // Continue with monitoring progress
      } else {
        throw e; // Re-throw if it's a different error
      }
    }

    // Then check if a download is already in progress for this trip
    try {
      console.log(`[DEBUG] Checking if download is in progress via status endpoint`);
      const statusCheck = await axios.get(`/api/trip-planner/${tripId}/download-landmarks-status`);
      console.log(`[DEBUG] Status check response:`, statusCheck.data);
      
      if (statusCheck.data && statusCheck.data.status === "in_progress") {
        console.log(`[DEBUG] Download already in progress with status:`, statusCheck.data);
        if (onProgressUpdate) {
          onProgressUpdate({
            progress: statusCheck.data.progress || 0,
            detail: statusCheck.data.detail || "Download already in progress..."
          });
        }
      }
    } catch (e) {
      // Status check endpoint might not exist, continue with the stream
      console.log(`[DEBUG] Error checking download status:`, e);
      console.log(`[DEBUG] Could not check download status, proceeding with stream`);
    }

    console.log(`[DEBUG] Creating EventSource for stream endpoint`);
    // Create an EventSource to listen for server-sent events
    const eventSource = new EventSource(`/api/trip-planner/${tripId}/download-landmarks-stream`);
    
    let lastProgressUpdate = 0;
    let lastDetailMessage = "";
    
    return new Promise((resolve, reject) => {
      eventSource.onmessage = (event) => {
        console.log(`[DEBUG] Received event:`, event.data);
        const data = JSON.parse(event.data);
        console.log(`[DEBUG] Parsed event data:`, data);
        
        if (data.type === 'progress') {
          console.log(`[DEBUG] Progress update: ${data.progress}% - ${data.detail}`);
          // Avoid sending too many updates with the same information
          const shouldUpdate = 
            Math.abs(data.progress - lastProgressUpdate) >= 5 || // Update if progress changed by 5% or more
            data.detail !== lastDetailMessage; // Or if detail message changed
            
          if (shouldUpdate && onProgressUpdate) {
            lastProgressUpdate = data.progress;
            lastDetailMessage = data.detail;
            
            onProgressUpdate({
              progress: data.progress,
              detail: data.detail
            });
          }
        } else if (data.type === 'complete') {
          if (onProgressUpdate) {
            onProgressUpdate({
              progress: 100,
              detail: data.message || "Download complete!"
            });
          }
          eventSource.close();
          resolve(data);
        } else if (data.type === 'error') {
          eventSource.close();
          reject(new Error(data.message || "Download failed"));
        }
      };
      
      eventSource.onerror = (error) => {
        console.log(`[DEBUG] EventSource error:`, error);
        eventSource.close();
        reject(error || new Error("Connection lost while downloading landmarks"));
      };
    });
  } catch (error) {
    console.log(`[DEBUG] Overall error in downloadLandmarks:`, error);
    throw error;
  }
};

export const searchPlaces = async (query) => {
  try {
    const response = await axios.post('/api/trip-planner/search-places', {
      query,
      limit: 5
    });
    return response.data.results;
  } catch (error) {
    throw error;
  }
};
