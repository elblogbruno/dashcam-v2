import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FaSpinner } from 'react-icons/fa';

// Layout y UI Components
import { Alert, Button } from '../components/common/UI';
import { Flex } from '../components/common/Layout';

// LandmarkManager Components
import LandmarkMap from '../components/LandmarkManager/LandmarkMap';
import TopBar from '../components/LandmarkManager/TopBar';
import LandmarkListOverlay from '../components/LandmarkManager/LandmarkListOverlay';
import AddLandmarkForm from '../components/LandmarkManager/AddLandmarkForm';
import LandmarkStatistics from '../components/LandmarkManager/LandmarkStatistics';
import LandmarkSettings from '../components/LandmarkManager/LandmarkSettings';
import MobileLandmarkOverlay from '../components/LandmarkManager/MobileLandmarkOverlay';
import BulkDeleteModal from '../components/LandmarkManager/BulkDeleteModal';

// Custom Hooks
import { useLandmarks } from '../components/LandmarkManager/useLandmarks';
import { useLandmarkMap } from '../components/LandmarkManager/useLandmarkMap';

// Styles
import '../components/LandmarkManager/LandmarkManager.css';

// Initialize map icons
import '../components/LandmarkManager/MapIcons';

const LandmarksManager = () => {
  // Offset para la barra de estado
  const STATUS_BAR_OFFSET = 60;
  const DESKTOP_NAV_WIDTH = 80; // Ancho de la navegación lateral en desktop
  
  // Custom hooks
  const {
    landmarks,
    paginatedLandmarks,
    trips,
    loading,
    selectedLandmark,
    selectedTrip,
    specificTripFilter,
    searchQuery,
    categoryFilter,
    showFilters,
    hasActiveFilters,
    currentPage,
    itemsPerPage,
    totalPages,
    setSearchQuery,
    setCategoryFilter,
    setShowFilters,
    setCurrentPage,
    handleAddLandmark,
    handleDeleteLandmark,
    handleLandmarkSelect,
    handleTripChange,
    clearFilters,
    landmarkCount,
    totalLandmarkCount
  } = useLandmarks();

  const {
    mapCenter,
    mapZoom,
    currentZoom,
    handleZoomChange,
    handleMapClick,
    centerMapOnLandmark,
    resetMapView
  } = useLandmarkMap();

  // Local state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLandmarkList, setShowLandmarkList] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [newLandmark, setNewLandmark] = useState({
    name: '',
    lat: '',
    lon: '',
    radius_m: 100,
    category: '',
    description: ''
  });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showPerformanceWarning, setShowPerformanceWarning] = useState(true);

  // Performance optimization: usar umbral más bajo para el warning
  const performanceThreshold = 100;

  // Effect para calcular dinámicamente la altura del TopBar
  useEffect(() => {
    const updateTopbarHeight = () => {
      const topbarElement = document.getElementById('landmark-topbar');
      if (topbarElement) {
        const height = topbarElement.offsetHeight;
        document.documentElement.style.setProperty('--topbar-height', `${height}px`);
      }
    };

    // Calcular altura inicial
    updateTopbarHeight();

    // Observar cambios en el TopBar (filtros expandidos, etc.)
    const resizeObserver = new ResizeObserver(updateTopbarHeight);
    const topbarElement = document.getElementById('landmark-topbar');
    
    if (topbarElement) {
      resizeObserver.observe(topbarElement);
    }

    // Cleanup
    return () => {
      if (topbarElement) {
        resizeObserver.unobserve(topbarElement);
      }
      resizeObserver.disconnect();
    };
  }, [showFilters]); // Re-ejecutar cuando cambie el estado de filtros

  // Auto-ocultar advertencia de rendimiento después de 10 segundos
  useEffect(() => {
    let timer;
    
    if (landmarkCount > performanceThreshold && showPerformanceWarning) {
      timer = setTimeout(() => {
        setShowPerformanceWarning(false);
      }, 10000); // 10 segundos
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [landmarkCount, performanceThreshold, showPerformanceWarning]);

  // Mostrar advertencia cuando se supera el umbral por primera vez
  useEffect(() => {
    if (landmarkCount > performanceThreshold && !showPerformanceWarning) {
      // Solo mostrar si previamente estaba oculta y ahora hay más landmarks
      setShowPerformanceWarning(true);
    }
  }, [landmarkCount]);

  // Handlers
  const handleAddFormSubmit = async () => {
    try {
      await handleAddLandmark({
        ...newLandmark,
        lat: parseFloat(newLandmark.lat),
        lon: parseFloat(newLandmark.lon)
      });
      setNewLandmark({
        name: '',
        lat: '',
        lon: '',
        radius_m: 100,
        category: '',
        description: ''
      });
      setShowAddForm(false);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleViewOnMap = (landmark) => {
    centerMapOnLandmark(landmark);
    handleLandmarkSelect(landmark);
    setShowLandmarkList(false);
  };

  const handleBackToTrips = () => {
    window.history.back();
  };

  const handleBulkDelete = () => {
    setShowBulkDelete(true);
  };

  const handleBulkDeleteComplete = () => {
    setShowBulkDelete(false);
    // Refresh landmarks will be handled by the BulkDeleteModal via the hook
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando landmarks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Top Bar con filtros integrados */}
      <div 
        id="landmark-topbar"
        className="absolute right-0 z-50 left-0 md:left-20"
        style={{ 
          top: `${STATUS_BAR_OFFSET}px`
        }}
      >
        <TopBar 
          title={specificTripFilter ? `Landmarks - ${specificTripFilter.name}` : 'Landmarks Manager'}
          showBackButton={!!specificTripFilter}
          onBack={handleBackToTrips}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          selectedTrip={selectedTrip}
          onTripChange={handleTripChange}
          trips={trips}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          filteredCount={landmarkCount}
          totalCount={totalLandmarkCount}
          onAddLandmark={() => setShowAddForm(true)}
          onToggleStatistics={() => setShowStatistics(!showStatistics)}
          onToggleSettings={() => setShowSettings(true)}
          onBulkDelete={handleBulkDelete}
          loading={loading}
        />
      </div>

      {/* Contenedor principal con mapa grande */}
      <div 
        className="absolute right-0 bottom-0 overflow-hidden z-0 left-0 md:left-20"
        style={{ 
          top: `${STATUS_BAR_OFFSET}px`,
        }}
      >
        <div className="w-full h-full">
          <LandmarkMap
            landmarks={landmarks}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            selectedLandmark={selectedLandmark}
            onLandmarkSelect={handleLandmarkSelect}
            onLandmarkEdit={(landmark) => {
              // TODO: Implement edit functionality
              toast.info('Funcionalidad de edición próximamente');
            }}
            onLandmarkDelete={handleDeleteLandmark}
            onZoomChange={handleZoomChange}
            onMapClick={handleMapClick}
            tripRoute={selectedTrip?.route_points || null}
          />
        </div>
        
        {/* Overlay para lista de landmarks (versión desktop) */}
        <LandmarkListOverlay
          show={showLandmarkList}
          onToggle={() => setShowLandmarkList(!showLandmarkList)}
          landmarks={paginatedLandmarks}
          selectedLandmark={selectedLandmark}
          onLandmarkSelect={handleLandmarkSelect}
          onLandmarkEdit={(landmark) => {
            // TODO: Implement edit functionality
            toast.info('Funcionalidad de edición próximamente');
          }}
          onLandmarkDelete={handleDeleteLandmark}
          onViewOnMap={handleViewOnMap}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          totalPages={totalPages}
          position="left"
        />
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <AddLandmarkForm
              newLandmark={newLandmark}
              onLandmarkChange={setNewLandmark}
              onSubmit={handleAddFormSubmit}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <LandmarkSettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* Statistics Panel (como modal ahora) */}
      {showStatistics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Estadísticas de Landmarks</h2>
              <Button 
                onClick={() => setShowStatistics(false)} 
                variant="secondary"
                size="sm"
              >
                Cerrar
              </Button>
            </div>
            <div className="p-4">
              <LandmarkStatistics 
                landmarks={landmarks}
                trips={trips}
                selectedTrip={selectedTrip}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDelete && (
        <BulkDeleteModal
          isOpen={showBulkDelete}
          onClose={() => setShowBulkDelete(false)}
          onDeleteComplete={handleBulkDeleteComplete}
          landmarks={landmarks}
          trips={trips}
        />
      )}

      {/* Mobile Overlay para dispositivos móviles */}
      <MobileLandmarkOverlay
        show={showLandmarkList} // Usar el estado real en lugar de false
        onToggle={() => setShowLandmarkList(!showLandmarkList)}
        landmarks={paginatedLandmarks}
        selectedLandmark={selectedLandmark}
        onLandmarkSelect={handleLandmarkSelect}
        onLandmarkEdit={(landmark) => {
          // TODO: Implement edit functionality
          toast.info('Funcionalidad de edición próximamente');
        }}
        onLandmarkDelete={handleDeleteLandmark}
        onViewOnMap={handleViewOnMap}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        selectedTrip={selectedTrip}
        onTripChange={handleTripChange}
        trips={trips}
        showFilters={showFilters}
        onToggleFilters={setShowFilters}
        onClearFilters={clearFilters}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* Performance Warning - auto-hide después de 10 segundos */}
      {landmarkCount > performanceThreshold && showPerformanceWarning && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 z-40">
          <Alert type="warning">
            <Flex align="start" className="gap-2 justify-between"> 
              <div className="flex-1">
                <div className="font-medium">Aviso de Rendimiento</div>
                <div className="text-sm mt-1">
                  Tienes {landmarkCount} landmarks mostrados, lo que podría afectar el rendimiento del mapa.
                  Considera usar filtros para reducir la cantidad de landmarks visibles.
                </div>
              </div>
              <Button
                onClick={() => setShowPerformanceWarning(false)}
                variant="secondary"
                size="xs"
                className="ml-2 flex-shrink-0"
              >
                ×
              </Button>
            </Flex>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default LandmarksManager;
