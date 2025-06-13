import React from 'react';
import { FaTimes, FaList } from 'react-icons/fa';
import { Button, Card } from '../common/UI';
import LandmarkList from './LandmarkList';
import LandmarkFilters from './LandmarkFilters';
import { Stack } from '../common/Layout';

const MobileLandmarkOverlay = ({
  show,
  onToggle,
  landmarks,
  selectedLandmark,
  onLandmarkSelect,
  onLandmarkEdit,
  onLandmarkDelete,
  onViewOnMap,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  selectedTrip,
  onTripChange,
  trips,
  showFilters,
  onToggleFilters,
  onClearFilters,
  currentPage,
  itemsPerPage,
  onPageChange
}) => {
  if (!show) {
    return (
      <div className="sm:hidden fixed bottom-6 right-4 z-[1000]">
        <Button
          onClick={onToggle}
          variant="primary"
          size="lg"
          className="bg-primary-600 hover:bg-primary-700 text-white shadow-2xl rounded-full w-16 h-16 p-0 transition-all duration-200 hover:scale-105 border-2 border-white"
          title="Mostrar lista de landmarks"
        >
          <FaList size={20} />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="sm:hidden fixed inset-0 bg-black bg-opacity-50 z-[999] backdrop-blur-sm"
        onClick={onToggle}
      />
      
      {/* Overlay Panel */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-[1000] bg-white rounded-t-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header con indicador de arrastre */}
        <div className="flex flex-col">
          {/* Drag indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <h2 className="text-xl font-semibold text-gray-900">
              Landmarks ({landmarks.length})
            </h2>
            <Button
              onClick={onToggle}
              variant="secondary"
              size="sm"
              className="rounded-full w-9 h-9 p-0 hover:bg-gray-100 transition-colors"
            >
              <FaTimes size={14} />
            </Button>
          </div>
        </div>
          
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Filters */}
            <div className="bg-gray-50 rounded-xl p-3">
              <LandmarkFilters
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                categoryFilter={categoryFilter}
                onCategoryChange={onCategoryChange}
                selectedTrip={selectedTrip}
                onTripChange={onTripChange}
                trips={trips}
                showFilters={showFilters}
                onToggleFilters={onToggleFilters}
                filteredCount={landmarks.length}
                totalCount={landmarks.length}
                onClearFilters={onClearFilters}
              />
            </div>
            
            {/* List */}
            <div className="space-y-2">
              <LandmarkList
                landmarks={landmarks}
                selectedLandmark={selectedLandmark}
                onLandmarkSelect={(landmark) => {
                  onLandmarkSelect(landmark);
                  onToggle(); // Close overlay when selecting a landmark
                }}
                onLandmarkEdit={onLandmarkEdit}
                onLandmarkDelete={onLandmarkDelete}
                onViewOnMap={(landmark) => {
                  onViewOnMap(landmark);
                  onToggle(); // Close overlay when viewing on map
                }}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                onPageChange={onPageChange}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileLandmarkOverlay;
