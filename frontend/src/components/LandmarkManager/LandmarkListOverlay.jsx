import React from 'react';
import { FaTimes, FaList, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Button, Card } from '../common/UI';
import LandmarkList from './LandmarkList';
import { Flex } from '../common/Layout';

const LandmarkListOverlay = ({
  show,
  onToggle,
  landmarks,
  selectedLandmark,
  onLandmarkSelect,
  onLandmarkEdit,
  onLandmarkDelete,
  onViewOnMap,
  currentPage,
  itemsPerPage,
  onPageChange,
  totalPages,
  position = 'left' // 'left' o 'right'
}) => {
  if (!show) {
    // Mostrar solo un botón flotante para abrir el panel cuando está cerrado, centrado verticalmente
    // Solo en escritorio (sm y superiores)
    return (
      <div className={`
        hidden sm:block fixed ${position === 'left' ? 'left-0 md:left-20' : 'right-0'} 
        top-1/2 -translate-y-1/2 transform
        z-[999]
      `}>
        <Button
          onClick={onToggle}
          variant="primary"
          size="sm"
          className={`
            rounded-r-full rounded-l-none px-3 py-4 shadow-lg hover:shadow-xl
            transition-all duration-200 hover:scale-105
            ${position === 'right' ? 'rounded-l-full rounded-r-none' : ''}
          `}
        >
          <FaList className="text-white" />
        </Button>
      </div>
    );
  }
  
  const isLeft = position === 'left';

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="sm:hidden fixed inset-0 bg-black bg-opacity-25 z-[998]"
        onClick={onToggle}
      />
      
      {/* Overlay Panel */}
      <div 
        className={`
          fixed bottom-0 z-[999] bg-white shadow-xl border-r border-gray-200
          transition-transform duration-300 ease-in-out
          ${isLeft ? 'left-0 md:left-20' : 'right-0'}
          ${show ? 'translate-x-0' : isLeft ? '-translate-x-full' : 'translate-x-full'}
          w-full sm:w-96 max-w-md
        `}
        style={{ 
          top: `calc(25px + var(--topbar-height, 80px))`
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-white sticky top-0 z-10">
            <h2 className="text-lg font-semibold text-gray-900">
              Landmarks ({landmarks.length})
            </h2>
            {/* <Button
              onClick={onToggle}
              variant="secondary"
              size="sm"
              className="rounded-full w-8 h-8 p-0 flex items-center justify-center"
            >
              <FaTimes />
            </Button> */}
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <LandmarkList
                landmarks={landmarks}
                selectedLandmark={selectedLandmark}
                onLandmarkSelect={(landmark) => {
                  onLandmarkSelect(landmark);
                  onViewOnMap(landmark); // También centra el mapa en la selección
                }}
                onLandmarkEdit={onLandmarkEdit}
                onLandmarkDelete={onLandmarkDelete}
                onViewOnMap={onViewOnMap}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                onPageChange={onPageChange}
              />
            </div>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-3 border-t bg-gray-50 sticky bottom-0">
              <Flex justify="between" align="center">
                <Button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <FaChevronLeft />
                  Anterior
                </Button>
                
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                
                <Button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  Siguiente
                  <FaChevronRight />
                </Button>
              </Flex>
            </div>
          )}
          
          {/* Handle for desktop */}
          <div 
            className={`hidden sm:flex absolute top-1/2 transform -translate-y-1/2
            ${isLeft ? 'right-[-20px]' : 'left-[-20px]'} 
            cursor-pointer hover:bg-gray-200 transition-colors`}
            onClick={onToggle}
          >
            <div className="bg-white border rounded-full p-1 shadow-md">
              {isLeft ? <FaChevronLeft /> : <FaChevronRight />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LandmarkListOverlay;
