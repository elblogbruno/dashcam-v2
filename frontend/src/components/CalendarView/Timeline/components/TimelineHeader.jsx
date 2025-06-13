import React from 'react';
import { FaTh, FaList, FaFilter } from 'react-icons/fa';
import TimelineFilters from './TimelineFilters';

const TimelineHeader = ({
  videoClipsCount,
  viewMode,
  setViewMode,
  showFilters,
  setShowFilters,
  filters,
  onFiltersChange,
  allTags,
  sourceOptions,
  isMobile,
  darkMode = false
}) => {
  return (
    <div className={`flex-shrink-0 ${darkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-white border-gray-200'} border-b p-3 ${isMobile ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <div className={`flex items-center justify-between gap-4 ${isMobile ? 'flex-col gap-3 items-stretch' : ''}`}>
        <span className={`font-medium ${darkMode ? 'text-neutral-100' : 'text-gray-800'} ${isMobile ? 'text-sm w-full mb-2' : ''}`}>
          {videoClipsCount} {videoClipsCount === 1 ? 'clip' : 'clips'}
        </span>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className={`flex gap-1 rounded-md p-1 ${darkMode ? 'bg-neutral-600' : 'bg-gray-100'}`}>
            <button
              className={`px-3 py-2 rounded transition-all duration-200 flex items-center justify-center ${
                viewMode === 'grid' 
                  ? 'bg-blue-500 text-white' 
                  : `${darkMode ? 'text-neutral-300 hover:bg-neutral-500' : 'text-gray-600 hover:bg-gray-200'} hover:text-gray-800`
              }`}
              onClick={() => setViewMode('grid')}
              title="Vista de cuadrícula"
              aria-label="Vista de cuadrícula"
            >
              <FaTh size={isMobile ? 14 : 16} />
            </button>
            <button
              className={`px-3 py-2 rounded transition-all duration-200 flex items-center justify-center ${
                viewMode === 'list' 
                  ? 'bg-blue-500 text-white' 
                  : `${darkMode ? 'text-neutral-300 hover:bg-neutral-500' : 'text-gray-600 hover:bg-gray-200'} hover:text-gray-800`
              }`}
              onClick={() => setViewMode('list')}
              title="Vista de lista"
              aria-label="Vista de lista"
            >
              <FaList size={isMobile ? 14 : 16} />
            </button>
          </div>
          
          {/* Filters Toggle */}
          <button
            className={`px-3 py-2 rounded-md transition-all duration-200 flex items-center gap-2 ${
              showFilters 
                ? 'bg-blue-500 text-white' 
                : `${darkMode ? 'bg-neutral-600 text-neutral-300 hover:bg-neutral-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} hover:text-gray-800`
            }`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filtros"
            aria-label={showFilters ? "Ocultar filtros" : "Mostrar filtros"}
          >
            <FaFilter size={isMobile ? 14 : 16} />
            {!isMobile && <span>Filtros</span>}
          </button>
        </div>
      </div>
      
      {showFilters && (
        <TimelineFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          allTags={allTags}
          sourceOptions={sourceOptions}
          isMobile={isMobile}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

export default TimelineHeader;
