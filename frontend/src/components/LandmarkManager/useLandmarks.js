import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { fetchAllLandmarks, searchLandmarks, addLandmark, deleteLandmark } from '../../services/landmarkService';
import { fetchTrips } from '../../services/tripService';

export const useLandmarks = () => {
  const [landmarks, setLandmarks] = useState([]);
  const [filteredLandmarks, setFilteredLandmarks] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [specificTripFilter, setSpecificTripFilter] = useState(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showStatistics, setShowStatistics] = useState(false);

  // Pagination
  const itemsPerPage = 20;

  // Load initial data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [landmarksData, tripsData] = await Promise.all([
          fetchAllLandmarks(),
          fetchTrips()
        ]);

        setLandmarks(landmarksData);
        setFilteredLandmarks(landmarksData);
        setTrips(tripsData);
        
        // Check if we have a specific trip to filter by from localStorage
        const selectedTripData = localStorage.getItem('selectedTripForLandmarks');
        if (selectedTripData) {
          try {
            const selectedTrip = JSON.parse(selectedTripData);
            const matchingTrip = tripsData.find(trip => trip.id === selectedTrip.id);
            
            if (matchingTrip) {
              setSpecificTripFilter(selectedTrip);
              setSelectedTrip(matchingTrip);
              
              const tripLandmarks = await fetch(`/api/landmarks/by-trip/${selectedTrip.id}`)
                .then(res => res.json());
              
              setFilteredLandmarks(tripLandmarks);
              document.title = `Landmarks for ${selectedTrip.name} - Smart Dashcam`;
              localStorage.removeItem('selectedTripForLandmarks');
            }
          } catch (e) {
            console.error('Failed to parse selected trip data:', e);
            localStorage.removeItem('selectedTripForLandmarks');
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load landmarks');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Helper function to normalize category names for comparison
  const normalizeCategoryName = (categoryName) => {
    if (!categoryName) return '';
    return categoryName.toLowerCase().replace(/[-_]/g, '_');
  };

  // Filter landmarks based on search query, category, and trip
  useEffect(() => {
    let filtered = landmarks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(landmark =>
        landmark.name.toLowerCase().includes(query) ||
        landmark.description?.toLowerCase().includes(query) ||
        landmark.category?.toLowerCase().includes(query)
      );
    }

    // Apply category filter with normalized comparison
    if (categoryFilter) {
      const normalizedCategoryFilter = normalizeCategoryName(categoryFilter);
      filtered = filtered.filter(landmark => 
        normalizeCategoryName(landmark.category) === normalizedCategoryFilter
      );
    }

    // Apply trip filter
    if (selectedTrip && !specificTripFilter) {
      // This would need to be implemented based on your backend API
      // For now, we'll keep all landmarks
    }

    setFilteredLandmarks(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [landmarks, searchQuery, categoryFilter, selectedTrip, specificTripFilter]);

  // Paginated landmarks
  const paginatedLandmarks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLandmarks.slice(startIndex, endIndex);
  }, [filteredLandmarks, currentPage, itemsPerPage]);

  // Actions
  const handleAddLandmark = async (landmarkData) => {
    try {
      const newLandmark = await addLandmark(landmarkData);
      setLandmarks(prev => [...prev, newLandmark]);
      toast.success('Landmark added successfully');
      return newLandmark;
    } catch (error) {
      console.error('Failed to add landmark:', error);
      toast.error('Failed to add landmark');
      throw error;
    }
  };

  const handleDeleteLandmark = async (landmark) => {
    if (!window.confirm(`Are you sure you want to delete "${landmark.name}"?`)) {
      return;
    }

    try {
      await deleteLandmark(landmark.id);
      setLandmarks(prev => prev.filter(l => l.id !== landmark.id));
      setSelectedLandmark(null);
      toast.success('Landmark deleted successfully');
    } catch (error) {
      console.error('Failed to delete landmark:', error);
      toast.error('Failed to delete landmark');
    }
  };

  const handleLandmarkSelect = (landmark) => {
    setSelectedLandmark(landmark);
  };

  const handleTripChange = async (trip) => {
    setSelectedTrip(trip);
    if (trip) {
      try {
        const tripLandmarks = await fetch(`/api/landmarks/by-trip/${trip.id}`)
          .then(res => res.json());
        setFilteredLandmarks(tripLandmarks);
      } catch (error) {
        console.error('Failed to fetch trip landmarks:', error);
        toast.error('Failed to load trip landmarks');
      }
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setSelectedTrip(null);
    setSpecificTripFilter(null);
  };

  const hasActiveFilters = searchQuery || categoryFilter || selectedTrip;

  return {
    // Data
    landmarks: filteredLandmarks,
    paginatedLandmarks,
    trips,
    loading,
    selectedLandmark,
    selectedTrip,
    specificTripFilter,
    
    // Search and filters
    searchQuery,
    categoryFilter,
    showFilters,
    hasActiveFilters,
    
    // Pagination
    currentPage,
    itemsPerPage,
    totalPages: Math.ceil(filteredLandmarks.length / itemsPerPage),
    
    // UI state
    showStatistics,
    
    // Actions
    setSearchQuery,
    setCategoryFilter,
    setShowFilters,
    setCurrentPage,
    setShowStatistics,
    handleAddLandmark,
    handleDeleteLandmark,
    handleLandmarkSelect,
    handleTripChange,
    clearFilters,
    
    // Counts
    landmarkCount: filteredLandmarks.length,
    totalLandmarkCount: landmarks.length
  };
};
