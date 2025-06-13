import React from 'react';
import { FaRoute, FaMapMarkerAlt } from 'react-icons/fa';
import { Button } from '../common/UI';
import TripMapPreview from './TripMapPreview';

const MobileMapDrawer = ({ 
  selectedTrip, 
  isOpen, 
  onClose, 
  onOpen,
  mapKey, 
  selectedTab, 
  onStartNavigation, 
  onManageLandmarks 
}) => {
  if (!selectedTrip) return null;

  return (
    <>
      {/* Floating Action Button for Map - Mobile Only */}
      {!isOpen && (
        <button
          onClick={onOpen}
          className="floating-action-button md:hidden"
          style={{ display: window.innerWidth >= 768 ? 'none' : 'flex' }}
        >
          <FaRoute size={20} />
        </button>
      )}

      {/* Map Drawer - Mobile Only */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="map-drawer-overlay"
            onClick={onClose}
          />
          
          {/* Drawer */}
          <div className="map-drawer">
            {/* Drawer Handle */}
            <div 
              className="flex justify-center py-3 border-b border-gray-200 cursor-pointer"
              onClick={onClose}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {selectedTrip.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {new Date(selectedTrip.start_date).toLocaleDateString()} - {new Date(selectedTrip.end_date).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 flex-shrink-0 ml-2 p-1"
              >
                ✕
              </button>
            </div>
            
            {/* Map Content */}
            <div className="flex-1 min-h-96 relative overflow-hidden">
              <div className="absolute inset-0">
                <TripMapPreview
                  trip={selectedTrip}
                  forceUpdate={mapKey}
                />
              </div>
            </div>
            
            {/* Drawer Actions */}
            {selectedTab === 'upcoming' && selectedTrip && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      onClose();
                      onStartNavigation(selectedTrip);
                    }}
                    variant="primary"
                    size="md"
                    className="flex-1 min-h-[48px]"
                  >
                    <FaRoute className="mr-2" />
                    Start Navigation
                  </Button>
                  <Button
                    onClick={() => {
                      onClose();
                      onManageLandmarks(selectedTrip);
                    }}
                    variant="secondary"
                    size="md"
                    className="flex-shrink-0 min-h-[48px] px-4"
                  >
                    <FaMapMarkerAlt />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default MobileMapDrawer;
