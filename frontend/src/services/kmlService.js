import { API_BASE_URL } from '../config';
import { toast } from 'react-hot-toast';

/**
 * Upload a KML/KMZ file to extract waypoints
 * @param {File} file - The KML/KMZ file to upload
 * @returns {Promise<Array>} List of waypoints extracted from the file
 */
export const uploadKmlFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/trip-planner/upload-kml`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to upload KML/KMZ file');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error uploading KML/KMZ file:', error);
    throw error;
  }
};

/**
 * Import waypoints from a KML/KMZ file into an existing trip
 * @param {string} tripId - The ID of the trip
 * @param {File} file - The KML/KMZ file to upload
 * @param {Array} selectedWaypoints - Optional list of waypoint indices to import
 * @returns {Promise<Object>} Updated trip object
 */
export const importWaypointsToTrip = async (tripId, file, selectedWaypoints = null) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    if (selectedWaypoints !== null) {
      formData.append('selected_waypoints', JSON.stringify(selectedWaypoints));
    }
    
    const response = await fetch(`${API_BASE_URL}/trip-planner/${tripId}/import-waypoints`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to import waypoints');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error importing waypoints:', error);
    throw error;
  }
};

/**
 * Import landmarks from a KML/KMZ file for a trip
 * @param {string} tripId - The ID of the trip
 * @param {File} file - The KML/KMZ file to upload
 * @param {Array} selectedPlacemarks - Optional list of placemark indices to import
 * @returns {Promise<Object>} Result of the import operation
 */
export const importLandmarksFromKml = async (tripId, file, selectedPlacemarks = null) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    if (selectedPlacemarks !== null) {
      formData.append('selected_placemarks', JSON.stringify(selectedPlacemarks));
    }
    
    const response = await fetch(`${API_BASE_URL}/trip-planner/${tripId}/import-landmarks-from-kml`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to import landmarks');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error importing landmarks from KML:', error);
    throw error;
  }
};
