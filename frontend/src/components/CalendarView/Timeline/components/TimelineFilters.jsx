import React from 'react';

const TimelineFilters = ({
  filters,
  onFiltersChange,
  allTags,
  sourceOptions,
  isMobile,
  darkMode = false
}) => {
  const toggleTag = (tag) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    
    onFiltersChange({
      ...filters,
      tags: newTags
    });
  };

  const handleSourceChange = (source) => {
    onFiltersChange({
      ...filters,
      videoSource: source
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      showTrips: true,
      showExternalVideos: true,
      tags: [],
      videoSource: 'all'
    });
  };

  return (
    <div className={`mt-3 p-4 ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-300'} rounded-lg border transition-colors duration-300 ${isMobile ? 'p-3' : ''}`}>
      {/* Content Type Filters */}
      <div className="mb-4">
        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>Tipo de contenido</label>
        <div className={`flex gap-4 ${isMobile ? 'flex-col gap-2' : ''}`}>
          <label className={`flex items-center gap-2 cursor-pointer text-sm ${darkMode ? 'text-neutral-300' : 'text-gray-600'}`}>
            <input
              type="checkbox"
              checked={filters.showTrips}
              onChange={(e) => onFiltersChange({...filters, showTrips: e.target.checked})}
              className="accent-blue-500"
            />
            Viajes
          </label>
          <label className={`flex items-center gap-2 cursor-pointer text-sm ${darkMode ? 'text-neutral-300' : 'text-gray-600'}`}>
            <input
              type="checkbox"
              checked={filters.showExternalVideos}
              onChange={(e) => onFiltersChange({...filters, showExternalVideos: e.target.checked})}
              className="accent-blue-500"
            />
            Videos externos
          </label>
        </div>
      </div>
      
      {/* Video Source Filter */}
      <div className="mb-4">
        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>Fuente de video</label>
        <select
          value={filters.videoSource}
          onChange={(e) => handleSourceChange(e.target.value)}
          className={`${darkMode ? 'bg-neutral-600 border-neutral-500 text-white' : 'bg-white border-gray-300 text-gray-900'} border px-3 py-1 rounded text-sm min-w-[120px] focus:outline-none focus:border-blue-500 transition-colors duration-300`}
        >
          {sourceOptions.map(option => (
            <option key={option} value={option}>
              {option === 'all' ? 'Todas' : option === 'dashcam' ? 'Dashcam' : 'Externa'}
            </option>
          ))}
        </select>
      </div>
      
      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="mb-4">
          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-neutral-200' : 'text-gray-700'}`}>Etiquetas</label>
          <div className={`flex flex-wrap gap-1 ${isMobile ? 'gap-1' : 'gap-2'}`}>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 rounded-full text-xs cursor-pointer transition-all duration-200 ${
                  filters.tags.includes(tag)
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : darkMode
                      ? 'bg-neutral-600 border-neutral-500 text-neutral-300 hover:bg-neutral-500 hover:text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                } border`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Clear Filters */}
      <button
        onClick={clearFilters}
        className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs transition-all duration-200"
      >
        Limpiar filtros
      </button>
    </div>
  );
};

export default TimelineFilters;
