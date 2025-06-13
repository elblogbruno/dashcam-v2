import React from 'react';
import { FaSearch, FaFilter, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import { Input, Select, Button, Badge } from '../common/UI';
import { Flex } from '../common/Layout';

const LandmarkFilters = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  selectedTrip,
  onTripChange,
  trips,
  showFilters,
  onToggleFilters,
  filteredCount,
  totalCount,
  onClearFilters
}) => {
  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'gas-station', label: 'Gas Station' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'attraction', label: 'Attraction' },
    { value: 'rest-area', label: 'Rest Area' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'other', label: 'Other' }
  ];

  const hasActiveFilters = searchQuery || categoryFilter || selectedTrip;

  return (
    <div className="space-y-4">
      {/* Search and filter toggle */}
      <Flex justify="between" align="center" className="gap-4">
        <div className="flex-1">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search landmarks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Button
          onClick={onToggleFilters}
          variant={showFilters ? "primary" : "secondary"}
          className="flex items-center gap-2"
        >
          <FaFilter />
          Filters
          {hasActiveFilters && (
            <Badge variant="danger" size="sm">!</Badge>
          )}
        </Button>
      </Flex>

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <Flex className="gap-4" wrap>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <Select
                value={categoryFilter}
                onChange={(e) => onCategoryChange(e.target.value)}
                options={categories}
              />
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trip
              </label>
              <Select
                value={selectedTrip?.id || ''}
                onChange={(e) => {
                  const trip = trips.find(t => t.id === parseInt(e.target.value));
                  onTripChange(trip || null);
                }}
                options={[
                  { value: '', label: 'All Trips' },
                  ...trips.map(trip => ({
                    value: trip.id,
                    label: trip.name || `Trip ${trip.id}`
                  }))
                ]}
              />
            </div>
          </Flex>

          {/* Filter actions */}
          <Flex justify="between" align="center">
            <div className="text-sm text-gray-600">
              Showing {filteredCount} of {totalCount} landmarks
            </div>
            
            {hasActiveFilters && (
              <Button
                onClick={onClearFilters}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <FaTimes />
                Clear Filters
              </Button>
            )}
          </Flex>
        </div>
      )}
    </div>
  );
};

export default LandmarkFilters;
