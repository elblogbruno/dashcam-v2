import React, { useState } from 'react';
import { FaSearch, FaFilter, FaPlus, FaChartBar, FaCog, FaArrowLeft, FaTimes, FaChevronDown, FaChevronUp, FaTrash, FaDatabase } from 'react-icons/fa';
import { Input, Select, Button, Badge } from '../common/UI';
import { Flex } from '../common/Layout';

const TopBar = ({
  // Navigation
  onBack,
  showBackButton,
  title,
  
  // Search
  searchQuery,
  onSearchChange,
  
  // Filters
  categoryFilter,
  onCategoryChange,
  selectedTrip,
  onTripChange,
  trips,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onClearFilters,
  
  // Stats
  filteredCount,
  totalCount,
  
  // Actions
  onAddLandmark,
  onToggleStatistics,
  onToggleSettings,
  onBulkDelete, // Nueva prop para eliminación masiva
  
  // Loading
  loading
}) => {
  const [expandedFilters, setExpandedFilters] = useState(false);

  const categories = [
    { value: '', label: 'Todas las categorías' },
    { value: 'gas_station', label: 'Gasolinera' },
    { value: 'restaurant', label: 'Restaurante' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'attraction', label: 'Atracción turística' },
    { value: 'rest_area', label: 'Área de descanso' },
    { value: 'emergency', label: 'Emergencia' },
    { value: 'other', label: 'Otros' }
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 shadow-sm z-10 relative min-h-[60px] max-h-[140px] overflow-hidden">
      {/* Main bar with essential controls */}
      <Flex justify="between" align="center" className="mb-2 min-h-[44px]">
        <Flex align="center" className="gap-3">
          {showBackButton && (
            <Button
              onClick={onBack}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <FaArrowLeft />
              <span className="hidden xs:inline">Volver</span>
            </Button>
          )}
          <div className="mr-4">
            <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
            {!loading && (
              <div className="text-xs text-gray-600">
                Mostrando {filteredCount} de {totalCount} landmarks
              </div>
            )}
          </div>

          {/* Lista y búsqueda en la misma línea */}
          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar landmarks..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Button
              onClick={onToggleFilters}
              variant={hasActiveFilters ? "primary" : "secondary"}
              size="sm"
              className="flex items-center gap-1 whitespace-nowrap"
            >
              <FaFilter />
              <span>Filtros</span>
              {expandedFilters ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            </Button>
          </div>
        </Flex>

        <Flex align="center" className="gap-2">
          {/* Mobile search toggle */}
          <div className="sm:hidden">
            <Button
              onClick={() => setExpandedFilters(!expandedFilters)}
              variant={hasActiveFilters ? "primary" : "secondary"}
              size="sm"
              className="flex items-center gap-1"
            >
              <FaSearch />
            </Button>
          </div>

          <Button
            onClick={onAddLandmark}
            variant="primary"
            size="sm"
            className="flex items-center gap-1"
          >
            <FaPlus />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>

          {/* Bulk Delete Button - Solo mostrar si hay landmarks */}
          {totalCount > 0 && onBulkDelete && (
            <Button
              onClick={onBulkDelete}
              variant="danger"
              size="sm"
              className="flex items-center gap-1"
            >
              <FaTrash />
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          )}

          <Button
            onClick={onToggleStatistics}
            variant="secondary"
            size="sm"
            className="hidden sm:flex items-center gap-1"
          >
            <FaChartBar />
            <span className="hidden md:inline">Estadísticas</span>
          </Button>

          <Button
            onClick={onToggleSettings}
            variant="secondary"
            size="sm"
            className="flex items-center gap-1"
          >
            <FaCog />
            <span className="hidden md:inline">Configuración</span>
          </Button>
        </Flex>
      </Flex>

      {/* Mobile search field */}
      <div className={`sm:hidden mb-2 ${expandedFilters ? 'block' : 'hidden'}`}>
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar landmarks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
      </div>

      {/* Expanded filters section */}
      {(showFilters || expandedFilters) && (
        <div className="pt-2 pb-1 border-t border-gray-100">
          <Flex align="center" className="gap-2" wrap>
            <div className="flex-1 min-w-[150px]">
              <Select
                value={categoryFilter}
                onChange={(e) => onCategoryChange(e.target.value)}
                options={categories}
                className="w-full text-sm"
              />
            </div>
            
            <div className="flex-1 min-w-[150px]">
              <Select
                value={selectedTrip?.id || ''}
                onChange={(e) => {
                  const trip = trips.find(t => t.id === parseInt(e.target.value));
                  onTripChange(trip || null);
                }}
                options={[
                  { value: '', label: 'Todos los viajes' },
                  ...trips.map(trip => ({
                    value: trip.id,
                    label: trip.name || `Viaje ${trip.id}`
                  }))
                ]}
                className="w-full text-sm"
              />
            </div>

            {hasActiveFilters && (
              <Button
                onClick={onClearFilters}
                variant="secondary"
                size="sm"
                className="flex items-center gap-1 whitespace-nowrap"
              >
                <FaTimes />
                Limpiar
              </Button>
            )}
          </Flex>
        </div>
      )}
    </div>
  );
};

export default TopBar;
