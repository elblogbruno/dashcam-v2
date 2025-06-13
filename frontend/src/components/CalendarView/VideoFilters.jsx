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
    <div className="relative z-10">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="relative z-10 flex items-center text-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5 text-white transition-all duration-200 hover:bg-white/20 hover:-translate-y-0.5"
        >
          <FaFilter className="mr-1.5 text-nest-accent" />
          <span className="hidden xs:inline">{showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
          <span className="xs:hidden">Filtros</span>
          {(filters.tags.length > 0 || filters.videoSource !== 'all') && (
            <span className="bg-nest-selected text-white rounded-full px-1.5 py-0.5 text-xs font-semibold ml-1.5">
              {filters.tags.length + (filters.videoSource !== 'all' ? 1 : 0)}
            </span>
          )}
        </button>
        
        <div className="flex items-center space-x-3">
          <label className="relative z-10 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-2 py-1 text-gray-100 transition-all duration-200 hover:bg-white/20 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.showTrips} 
              onChange={() => handleTypeChange('showTrips', !filters.showTrips)}
              className="m-0 w-3.5 h-3.5 accent-nest-accent"
            />
            <FaCarSide className="text-nest-accent" /> 
            <span className="hidden xs:inline">Viajes</span>
          </label>
          
          <label className="relative z-10 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-2 py-1 text-gray-100 transition-all duration-200 hover:bg-white/20 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filters.showExternalVideos} 
              onChange={() => handleTypeChange('showExternalVideos', !filters.showExternalVideos)}
              className="m-0 w-3.5 h-3.5 accent-nest-accent"
            />
            <FaMobileAlt className="text-nest-accent" /> 
            <span className="hidden xs:inline">Externos</span>
          </label>
        </div>
      </div>
      
      {showFilters && (
        <div className="relative z-[1050] bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-md border border-white/20 shadow-xl rounded-lg p-3 mb-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-1">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs">
              <FaInfoCircle className="text-nest-accent" />
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
                className="text-nest-accent underline text-xs hover:text-nest-800 transition-colors duration-200"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Filtro por fuente */}
            <div className="mb-4">
              <h3 className="text-slate-800 text-sm font-semibold mb-2 flex items-center gap-1.5">
                <FaMobileAlt className="text-nest-accent" /> Fuente
              </h3>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {sourceOptions.map(source => (
                  <button
                    key={source}
                    onClick={() => handleSourceChange(source)}
                    className={`bg-white/80 border border-black/10 rounded-2xl px-3 py-1 text-xs text-slate-800 cursor-pointer transition-all duration-200 hover:bg-white hover:border-black/20 hover:-translate-y-0.5 ${
                      filters.videoSource === source ? 'bg-nest-selected text-white border-nest-selected hover:bg-nest-accent hover:border-nest-accent' : ''
                    }`}
                  >
                    {source === 'all' ? 'Todas' : source}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Filtro por etiquetas */}
            <div className="mb-4">
              <h3 className="text-slate-800 text-sm font-semibold mb-2 flex items-center gap-1.5">
                <FaTags className="text-nest-accent" /> Etiquetas
              </h3>
              {allTags.length > 0 ? (
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleTagChange(tag)}
                      className={`bg-white/80 border border-black/10 rounded-2xl px-3 py-1 text-xs text-slate-800 cursor-pointer transition-all duration-200 hover:bg-white hover:border-black/20 hover:-translate-y-0.5 ${
                        filters.tags.includes(tag) ? 'bg-nest-selected text-white border-nest-selected hover:bg-nest-accent hover:border-nest-accent' : ''
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-600 italic">
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
