import axios from 'axios';

export const fetchActualTripsForPlannedTrip = async (plannedTripId) => {
  try {
    const response = await axios.get(`/api/trip-planner/${plannedTripId}/actual-trips`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const fetchActualTripDetails = async (plannedTripId, tripId) => {
  try {
    const response = await axios.get(`/api/trip-planner/${plannedTripId}/actual-trips/${tripId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteActualTrip = async (plannedTripId, tripId) => {
  try {
    const response = await axios.delete(`/api/trip-planner/${plannedTripId}/actual-trips/${tripId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const fetchTripVideoClips = async (plannedTripId, tripId) => {
  try {
    const response = await axios.get(`/api/trip-planner/${plannedTripId}/actual-trips/${tripId}/video-clips`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const fetchTripGpsTrack = async (plannedTripId, tripId) => {
  try {
    const response = await axios.get(`/api/trip-planner/${plannedTripId}/actual-trips/${tripId}/gps-track`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
