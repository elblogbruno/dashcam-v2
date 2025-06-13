import React from 'react';
import { FaMapMarkerAlt, FaEdit, FaTrash, FaEye } from 'react-icons/fa';
import { Button, Badge } from '../common/UI';
import { Flex, Stack } from '../common/Layout';

const LandmarkListItem = ({ 
  landmark, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  onViewOnMap 
}) => {
  const getCategoryBadgeColor = (category) => {
    const colors = {
      'gas-station': 'bg-red-100 text-red-800',
      'restaurant': 'bg-green-100 text-green-800',
      'hotel': 'bg-blue-100 text-blue-800',
      'attraction': 'bg-purple-100 text-purple-800',
      'rest-area': 'bg-yellow-100 text-yellow-800',
      'emergency': 'bg-red-100 text-red-800',
      'default': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.default;
  };

  return (
    <div 
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        isSelected 
          ? 'border-primary-500 bg-primary-50' 
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
      onClick={() => onSelect(landmark)}
    >
      <Flex justify="between" align="start" className="mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            {landmark.name}
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <FaMapMarkerAlt className="text-primary-600" />
            <span>{landmark.lat.toFixed(6)}, {landmark.lon.toFixed(6)}</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {landmark.category && (
              <Badge 
                className={getCategoryBadgeColor(landmark.category)}
                size="sm"
              >
                {landmark.category}
              </Badge>
            )}
            
            <Badge variant="secondary" size="sm">
              {landmark.radius_m}m radius
            </Badge>
            
            {landmark.trip_count > 0 && (
              <Badge variant="primary" size="sm">
                {landmark.trip_count} visit{landmark.trip_count !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          
          {landmark.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {landmark.description}
            </p>
          )}
        </div>
      </Flex>
      
      <Flex justify="end" className="gap-2 mt-3">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onViewOnMap(landmark);
          }}
          variant="secondary"
          size="sm"
          className="flex items-center gap-1"
        >
          <FaEye size={12} />
          View
        </Button>
        
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(landmark);
          }}
          variant="secondary"
          size="sm"
          className="flex items-center gap-1"
        >
          <FaEdit size={12} />
          Edit
        </Button>
        
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(landmark);
          }}
          variant="danger"
          size="sm"
          className="flex items-center gap-1"
        >
          <FaTrash size={12} />
          Delete
        </Button>
      </Flex>
    </div>
  );
};

const LandmarkList = ({ 
  landmarks, 
  selectedLandmark, 
  onLandmarkSelect, 
  onLandmarkEdit, 
  onLandmarkDelete,
  onViewOnMap,
  currentPage,
  itemsPerPage,
  onPageChange
}) => {
  // Calculate pagination
  const totalPages = Math.ceil(landmarks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLandmarks = landmarks.slice(startIndex, endIndex);

  if (landmarks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FaMapMarkerAlt className="mx-auto mb-4 text-4xl" />
        <p>No landmarks found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {currentLandmarks.map(landmark => (
          <LandmarkListItem
            key={landmark.id}
            landmark={landmark}
            isSelected={selectedLandmark?.id === landmark.id}
            onSelect={onLandmarkSelect}
            onEdit={onLandmarkEdit}
            onDelete={onLandmarkDelete}
            onViewOnMap={onViewOnMap}
          />
        ))}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <Flex justify="center" className="gap-2 mt-6">
          <Button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            variant="secondary"
            size="sm"
          >
            Previous
          </Button>
          
          <span className="px-3 py-1 text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            variant="secondary"
            size="sm"
          >
            Next
          </Button>
        </Flex>
      )}
    </div>
  );
};

export default LandmarkList;
