import { API_BASE_URL } from '../config';

/**
 * Fetch all landmarks
 * @returns {Promise<Array>} List of all landmarks
 */
export const fetchAllLandmarks = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks`);
    if (!response.ok) throw new Error('Failed to fetch landmarks');
    return await response.json();
  } catch (error) {
    console.error('Error fetching landmarks:', error);
    throw error;
  }
};

/**
 * Download landmarks for a specific trip
 * @param {string} tripId - The ID of the trip
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<Object>} Result of the download
 */
export const downloadTripLandmarks = async (tripId, onProgress = null) => {
  try {
    // Start the download process
    const response = await fetch(`${API_BASE_URL}/trip-planner/${tripId}/download-landmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ radius_km: 10 })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to start landmark download');
    }
    
    const result = await response.json();
    
    // If we don't need progress updates, just return the result
    if (!onProgress) {
      return result;
    }
    
    // Create an EventSource to track progress
    const eventSource = new EventSource(`${API_BASE_URL}/trip-planner/${tripId}/download-landmarks-stream`);
    
    return new Promise((resolve, reject) => {
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress' && onProgress) {
          onProgress(data.progress, data.detail);
        } else if (data.type === 'complete') {
          eventSource.close();
          resolve(data);
        } else if (data.type === 'error') {
          eventSource.close();
          reject(new Error(data.message || 'Download failed'));
        }
      };
      
      eventSource.onerror = (error) => {
        eventSource.close();
        reject(error || new Error('Connection lost while downloading landmarks'));
      };
    });
  } catch (error) {
    console.error('Error downloading landmarks:', error);
    throw error;
  }
};

/**
 * Add a new landmark
 * @param {Object} landmarkData - The landmark data
 * @returns {Promise<Object>} The created landmark
 */
export const addLandmark = async (landmarkData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(landmarkData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to add landmark');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding landmark:', error);
    throw error;
  }
};

/**
 * Search for landmarks based on name or category
 * @param {string} query - The search query
 * @returns {Promise<Array>} List of matching landmarks
 */
export const searchLandmarks = async (query) => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search landmarks');
    return await response.json();
  } catch (error) {
    console.error('Error searching landmarks:', error);
    throw error;
  }
};

/**
 * Delete a landmark
 * @param {string} landmarkId - The ID of the landmark to delete
 * @returns {Promise<Object>} Result of the deletion
 */
export const deleteLandmark = async (landmarkId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/landmarks/${landmarkId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete landmark');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting landmark:', error);
    throw error;
  }
};

/**
 * Get landmark settings
 * @returns {Promise<Object>} The landmark settings
 */
export const getLandmarkSettings = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/trip-planner/settings/landmarks`);
    if (!response.ok) throw new Error('Failed to fetch landmark settings');
    return await response.json();
  } catch (error) {
    console.error('Error fetching landmark settings:', error);
    throw error;
  }
};

/**
 * Update landmark settings
 * @param {Object} settingsData - The settings data
 * @returns {Promise<Object>} The updated settings
 */
export const updateLandmarkSettings = async (settingsData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/trip-planner/settings/landmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingsData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update settings');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating landmark settings:', error);
    throw error;
  }
};