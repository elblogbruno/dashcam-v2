import React, { useState } from 'react';
import { FaPlus, FaSearch, FaSpinner, FaTimes } from 'react-icons/fa';
import { Button, Input, Select, Card } from '../common/UI';
import { Stack, Flex } from '../common/Layout';
import { searchPlaces } from '../../services/tripService';

const AddLandmarkForm = ({
  newLandmark,
  onLandmarkChange,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState([]);

  const categories = [
    { value: '', label: 'Select category...' },
    { value: 'gas-station', label: 'Gas Station' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'attraction', label: 'Attraction' },
    { value: 'rest-area', label: 'Rest Area' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'other', label: 'Other' }
  ];

  const handlePlaceSearch = async () => {
    if (!placeSearchQuery.trim()) return;
    
    setSearchingPlace(true);
    try {
      const results = await searchPlaces(placeSearchQuery);
      setPlaceSearchResults(results);
    } catch (error) {
      console.error('Place search failed:', error);
      setPlaceSearchResults([]);
    } finally {
      setSearchingPlace(false);
    }
  };

  const handlePlaceSelect = (place) => {
    onLandmarkChange({
      ...newLandmark,
      name: place.display_name?.split(',')[0] || place.name || 'Unnamed Place',
      lat: parseFloat(place.lat),
      lon: parseFloat(place.lon)
    });
    setPlaceSearchResults([]);
    setPlaceSearchQuery('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Add New Landmark</h2>
        <p className="text-sm text-gray-600 mt-1">
          Create a new landmark by entering details manually or searching for a place.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Place Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search for a place (optional)
          </label>
          <Flex className="gap-2">
            <Input
              type="text"
              placeholder="Search for restaurants, gas stations, etc..."
              value={placeSearchQuery}
              onChange={(e) => setPlaceSearchQuery(e.target.value)}
              className="flex-1"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePlaceSearch();
                }
              }}
            />
            <Button
              type="button"
              onClick={handlePlaceSearch}
              disabled={searchingPlace || !placeSearchQuery.trim()}
              variant="secondary"
              className="flex items-center gap-2"
            >
              {searchingPlace ? <FaSpinner className="animate-spin" /> : <FaSearch />}
              Search
            </Button>
          </Flex>

          {/* Search Results */}
          {placeSearchResults.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {placeSearchResults.map((place, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handlePlaceSelect(place)}
                  className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-900">
                    {place.display_name?.split(',')[0] || place.name || 'Unnamed Place'}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {place.display_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <Input
              type="text"
              placeholder="Landmark name"
              value={newLandmark.name}
              onChange={(e) => onLandmarkChange({ ...newLandmark, name: e.target.value })}
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <Select
              value={newLandmark.category}
              onChange={(e) => onLandmarkChange({ ...newLandmark, category: e.target.value })}
              options={categories}
            />
          </div>

          {/* Latitude */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Latitude *
            </label>
            <Input
              type="number"
              step="any"
              placeholder="e.g., 34.0522"
              value={newLandmark.lat}
              onChange={(e) => onLandmarkChange({ ...newLandmark, lat: e.target.value })}
              required
            />
          </div>

          {/* Longitude */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Longitude *
            </label>
            <Input
              type="number"
              step="any"
              placeholder="e.g., -118.2437"
              value={newLandmark.lon}
              onChange={(e) => onLandmarkChange({ ...newLandmark, lon: e.target.value })}
              required
            />
          </div>

          {/* Radius */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Detection Radius (meters)
            </label>
            <Input
              type="number"
              min="10"
              max="5000"
              placeholder="100"
              value={newLandmark.radius_m}
              onChange={(e) => onLandmarkChange({ ...newLandmark, radius_m: parseInt(e.target.value) })}
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows="3"
              placeholder="Optional description..."
              value={newLandmark.description}
              onChange={(e) => onLandmarkChange({ ...newLandmark, description: e.target.value })}
            />
          </div>
        </div>

        {/* Actions */}
        <Flex justify="end" className="gap-3 pt-4">
          <Button
            type="button"
            onClick={onCancel}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <FaTimes />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !newLandmark.name || !newLandmark.lat || !newLandmark.lon}
            variant="primary"
            className="flex items-center gap-2"
          >
            {loading ? <FaSpinner className="animate-spin" /> : <FaPlus />}
            Add Landmark
          </Button>
        </Flex>
      </form>
    </Card>
  );
};

export default AddLandmarkForm;
