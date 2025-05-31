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
    <div className="video-filters">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center text-sm bg-opacity-10 bg-white hover:bg-opacity-20 text-nest-text-primary py-1 px-3 rounded-full transition-colors"
        >
          <FaFilter className="mr-1.5 text-nest-accent" />
          <span className="hidden xs:inline">{showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
          <span className="xs:hidden">Filtros</span>
          {(filters.tags.length > 0 || filters.videoSource !== 'all') && (
            <span className="ml-1.5 bg-nest-selected text-white text-xs rounded-full px-1.5 py-0.5">
              {filters.tags.length + (filters.videoSource !== 'all' ? 1 : 0)}
            </span>
          )}
        </button>
        
        <div className="flex items-center space-x-3">
          <label className="flex items-center text-xs sm:text-sm text-nest-text-primary cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.showTrips} 
              onChange={() => handleTypeChange('showTrips', !filters.showTrips)}
              className="mr-1 h-3 w-3 sm:h-4 sm:w-4 accent-nest-accent"
            />
            <FaCarSide className="mr-0.5 sm:mr-1 text-nest-accent" /> <span className="hidden xs:inline">Viajes</span>
          </label>
          
          <label className="flex items-center text-xs sm:text-sm text-nest-text-primary cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.showExternalVideos} 
              onChange={() => handleTypeChange('showExternalVideos', !filters.showExternalVideos)}
              className="mr-1 h-3 w-3 sm:h-4 sm:w-4 accent-nest-accent"
            />
            <FaMobileAlt className="mr-0.5 sm:mr-1 text-nest-accent" /> <span className="hidden xs:inline">Externos</span>
          </label>
        </div>
      </div>
      
      {showFilters && (
        <div className="p-3 rounded-lg border border-nest-border mb-3 animate-fadeIn bg-opacity-20 bg-white">
          <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-1">
            <div className="text-xs sm:text-sm font-medium text-nest-text-secondary flex items-center">
              <FaInfoCircle className="mr-1 text-nest-accent" />
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
                className="text-xs text-nest-accent hover:text-white underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Filtro por fuente */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center text-nest-text-primary">
                <FaMobileAlt className="mr-1 text-nest-accent" /> Fuente
              </h3>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {sourceOptions.map(source => (
                  <button
                    key={source}
                    onClick={() => handleSourceChange(source)}
                    className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full transition-colors ${
                      filters.videoSource === source 
                        ? 'bg-nest-selected text-white' 
                        : 'bg-opacity-10 bg-white text-nest-text-primary hover:bg-opacity-20'
                    }`}
                  >
                    {source === 'all' ? 'Todas' : source}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Filtro por etiquetas */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center text-nest-text-primary">
                <FaTags className="mr-1 text-nest-accent" /> Etiquetas
              </h3>
              {allTags.length > 0 ? (
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleTagChange(tag)}
                      className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full transition-colors ${
                        filters.tags.includes(tag) 
                          ? 'bg-nest-selected text-white' 
                          : 'bg-opacity-10 bg-white text-nest-text-primary hover:bg-opacity-20'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-nest-text-secondary italic">
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
