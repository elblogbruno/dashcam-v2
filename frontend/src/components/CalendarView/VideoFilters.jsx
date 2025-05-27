import React, { useState } from 'react';
import { FaFilter, FaTags, FaCarSide, FaMobileAlt, FaInfoCircle } from 'react-icons/fa';
import PropTypes from 'prop-types';

const VideoFilters = ({ filters, onFilterChange, allTags, sourceOptions }) => {
  const [showFilters, setShowFilters] = useState(false);

  // Manejar cambios en el tipo de video a mostrar
  const handleTypeChange = (type, value) => {
    onFilterChange({
      ...filters,
      [type]: value
    });
  };

  // Manejar cambios en la selección de etiquetas
  const handleTagChange = (tag) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];

    onFilterChange({
      ...filters,
      tags: newTags
    });
  };

  // Manejar cambios en la fuente de video
  const handleSourceChange = (source) => {
    onFilterChange({
      ...filters,
      videoSource: source
    });
  };

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 sm:px-3 rounded-md transition-colors"
        >
          <FaFilter className="mr-1 sm:mr-2 text-dashcam-600" />
          <span className="hidden xs:inline">{showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
          <span className="xs:hidden">Filtros</span>
          {(filters.tags.length > 0 || filters.videoSource !== 'all') && (
            <span className="ml-1 bg-dashcam-600 text-white text-xs rounded-full px-1.5 py-0.5">
              {filters.tags.length + (filters.videoSource !== 'all' ? 1 : 0)}
            </span>
          )}
        </button>
        
        <div className="flex items-center space-x-3">
          <label className="flex items-center text-xs sm:text-sm text-gray-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.showTrips} 
              onChange={() => handleTypeChange('showTrips', !filters.showTrips)}
              className="mr-1 h-3 w-3 sm:h-4 sm:w-4"
            />
            <FaCarSide className="mr-0.5 sm:mr-1 text-dashcam-600" /> <span className="hidden xs:inline">Viajes</span>
          </label>
          
          <label className="flex items-center text-xs sm:text-sm text-gray-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.showExternalVideos} 
              onChange={() => handleTypeChange('showExternalVideos', !filters.showExternalVideos)}
              className="mr-1 h-3 w-3 sm:h-4 sm:w-4"
            />
            <FaMobileAlt className="mr-0.5 sm:mr-1 text-green-600" /> <span className="hidden xs:inline">Externos</span>
          </label>
        </div>
      </div>
      
      {showFilters && (
        <div className="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-200 mb-3 animate-fadeIn">
          <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-1">
            <div className="text-xs sm:text-sm font-medium text-gray-700 flex items-center">
              <FaInfoCircle className="mr-1 text-dashcam-600" />
              {filters.tags.length > 0 || filters.videoSource !== 'all' ? 
                'Mostrando videos filtrados' : 
                <span className="hidden xs:inline">Selecciona opciones para filtrar los videos</span>}
            </div>
            
            {(filters.tags.length > 0 || filters.videoSource !== 'all') && (
              <button
                onClick={() => onFilterChange({
                  ...filters,
                  tags: [],
                  videoSource: 'all'
                })}
                className="text-xs text-dashcam-600 hover:text-dashcam-800 underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Filtro por fuente */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center text-gray-700">
                <FaMobileAlt className="mr-1 text-dashcam-600" /> Fuente
              </h3>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {sourceOptions.map(source => (
                  <button
                    key={source}
                    onClick={() => handleSourceChange(source)}
                    className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full transition-colors ${
                      filters.videoSource === source 
                        ? 'bg-dashcam-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {source === 'all' ? 'Todas' : source}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Filtro por etiquetas */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center text-gray-700">
                <FaTags className="mr-1 text-dashcam-600" /> Etiquetas
              </h3>
              {allTags.length > 0 ? (
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleTagChange(tag)}
                      className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full transition-colors ${
                        filters.tags.includes(tag) 
                          ? 'bg-dashcam-600 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic">
                  No hay etiquetas disponibles
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

VideoFilters.propTypes = {
  filters: PropTypes.shape({
    showTrips: PropTypes.bool.isRequired,
    showExternalVideos: PropTypes.bool.isRequired,
    tags: PropTypes.array.isRequired,
    videoSource: PropTypes.string.isRequired
  }).isRequired,
  onFilterChange: PropTypes.func.isRequired,
  allTags: PropTypes.array.isRequired,
  sourceOptions: PropTypes.array.isRequired
};

export default VideoFilters;
