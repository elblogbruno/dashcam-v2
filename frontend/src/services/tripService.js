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
      const startDownload = await axios.post(`/api/landmarks/${tripId}/download-landmarks`, {
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
      const statusCheck = await axios.get(`/api/landmarks/${tripId}/download-landmarks-status`);
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
    const eventSource = new EventSource(`/api/landmarks/${tripId}/download-landmarks-stream`);
    
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
        console.error(`[DEBUG] EventSource error for geodata:`, error);
        console.error(`[DEBUG] EventSource readyState:`, eventSource.readyState);
        eventSource.close();
        reject(error || new Error("Connection lost while downloading geodata"));
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

export const downloadTripGeodata = async (tripId, options = {}, onProgress = null) => {
  try {
    const { radius_km = 10, format = "both", use_optimization = true } = options;
    
    console.log(`[DEBUG] Starting geodata download for trip: ${tripId}`);
    
    let optimized_radius = radius_km;
    let download_center = null;
    let optimization_used = false;
    
    // Try to calculate optimized radius first
    if (use_optimization) {
      try {
        console.log(`[DEBUG] Calculating optimal radius for trip: ${tripId}`);
        const optimizationResponse = await axios.post(`/api/trip-planner/${tripId}/calculate-optimal-geodata-radius`);
        
        if (optimizationResponse.data && optimizationResponse.data.recommendation?.use_single_radius) {
          optimized_radius = optimizationResponse.data.optimal_radius_km;
          download_center = optimizationResponse.data.center_point;
          optimization_used = true;
          
          console.log(`[DEBUG] Using optimized radius: ${optimized_radius}km at center (${download_center.lat}, ${download_center.lon})`);
          
          if (onProgress) {
            onProgress({
              progress: 5,
              detail: `Optimización calculada: radio de ${optimized_radius.toFixed(1)}km (${(optimizationResponse.data.coverage_efficiency * 100).toFixed(1)}% eficiencia)`
            });
          }
        } else {
          console.log(`[DEBUG] Optimization not efficient for this trip, using traditional approach`);
          if (onProgress) {
            onProgress({
              progress: 5,
              detail: "Optimización no eficiente, usando descarga tradicional por waypoints"
            });
          }
        }
      } catch (optimizationError) {
        console.warn(`[DEBUG] Failed to calculate optimization, falling back to traditional approach:`, optimizationError);
        if (onProgress) {
          onProgress({
            progress: 5,
            detail: "Error en optimización, usando descarga tradicional"
          });
        }
      }
    }
    
    // Start the download process with appropriate parameters
    const downloadParams = {
      radius_km: optimization_used ? optimized_radius : radius_km, // Use optimized radius only if using optimization
      format
    };
    
    // If we have a single optimized center, use single-point download
    if (optimization_used && download_center) {
      downloadParams.use_single_center = true;
      downloadParams.center_lat = download_center.lat;
      downloadParams.center_lon = download_center.lon;
    }
    
    const startResponse = await axios.post(`/api/geocoding/trip-geodata/${tripId}/download-geodata`, downloadParams);
    
    console.log(`[DEBUG] Geodata download initiation response:`, startResponse.data);
    
    // Initial progress update
    if (onProgress) {
      onProgress({
        progress: 0,
        detail: "Geodata download started..."
      });
    }
    
    // If no progress callback, just return the initial response
    if (!onProgress) {
      return startResponse.data;
    }
    
    // Create EventSource to track progress
    console.log(`[DEBUG] Creating EventSource for geodata stream: /api/geocoding/trip-geodata/${tripId}/download-geodata-stream`);
    const eventSource = new EventSource(`/api/geocoding/trip-geodata/${tripId}/download-geodata-stream`);
    
    return new Promise((resolve, reject) => {
      eventSource.onopen = () => {
        console.log(`[DEBUG] EventSource connection opened for geodata stream`);
      };
      
      eventSource.onmessage = (event) => {
        try {
          console.log(`[DEBUG] EventSource received message (length: ${event.data.length}):`, event.data);
          
          // Extract JSON from SSE format if needed
          let jsonData = event.data;
          if (typeof event.data === 'string' && event.data.includes('data: ')) {
            // Extract the JSON part after "data: "
            const lines = event.data.split('\n');
            const dataLine = lines.find(line => line.startsWith('data: '));
            if (dataLine) {
              jsonData = dataLine.substring(6); // Remove "data: " prefix
            }
          }
          
          console.log(`[DEBUG] Extracted JSON data:`, jsonData);
          const data = JSON.parse(jsonData);
          console.log(`[DEBUG] Parsed EventSource data:`, data);
          
          if (data.type === 'progress') {
            if (onProgress) {
              // Pass the complete data object with all granular information
              onProgress(data);
            }
          } else if (data.type === 'complete') {
            eventSource.close();
            resolve(data);
          } else if (data.type === 'error') {
            eventSource.close();
            reject(new Error(data.message || 'Geodata download failed'));
          }
        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        reject(new Error('Connection lost while downloading geodata'));
      };
      
      // Timeout after 30 minutes
      setTimeout(() => {
        eventSource.close();
        reject(new Error('Geodata download timeout'));
      }, 30 * 60 * 1000);
    });
    
  } catch (error) {
    console.error('Error downloading geodata:', error);
    throw error;
  }
};

export const checkGeodataDownloadStatus = async (tripId) => {
  try {
    const response = await axios.get(`/api/geocoding/trip-geodata/${tripId}/download-geodata-status`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Cancel download functions
export const cancelLandmarksDownload = async (tripId) => {
  try {
    const response = await axios.post(`/api/landmarks/${tripId}/cancel-landmarks-download`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const cancelGeodataDownload = async (tripId) => {
  try {
    const response = await axios.post(`/api/geocoding/trip-geodata/${tripId}/cancel-geodata-download`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Pause and Resume download functions
export const pauseLandmarksDownload = async (tripId) => {
  try {
    const response = await axios.post(`/api/landmarks/${tripId}/pause-landmarks-download`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const resumeLandmarksDownload = async (tripId) => {
  try {
    const response = await axios.post(`/api/landmarks/${tripId}/resume-landmarks-download`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const pauseGeodataDownload = async (tripId) => {
  try {
    const response = await axios.post(`/api/geocoding/trip-geodata/${tripId}/pause-geodata-download`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const resumeGeodataDownload = async (tripId) => {
  try {
    const response = await axios.post(`/api/geocoding/trip-geodata/${tripId}/resume-geodata-download`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get download estimates
export const getDownloadEstimate = async (tripId, radiusKm = 10) => {
  try {
    // Use the landmarks optimization endpoint to get estimates
    const response = await axios.post(`/api/landmarks/${tripId}/optimize-landmarks-radius`, {
      radius_km: radiusKm
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
