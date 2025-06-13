import React, { useState, useEffect } from 'react';
import { FaTrash, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { Button, Select } from '../common/UI';
import { Flex } from '../common/Layout';
import { bulkDeleteLandmarks, getLandmarkCategories } from '../../services/landmarkService';
import { toast } from 'react-hot-toast';

const BulkDeleteModal = ({ 
  isOpen, 
  onClose, 
  onDeleteComplete,
  landmarks = [],
  trips = []
}) => {
  const [deleteMode, setDeleteMode] = useState('category'); // 'category', 'trip', 'selection'
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrip, setSelectedTrip] = useState('');
  const [selectedLandmarks, setSelectedLandmarks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setConfirmDelete(false);
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const categoriesData = await getLandmarkCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Error al cargar categorías');
    }
  };

  const getAffectedCount = () => {
    if (deleteMode === 'category' && selectedCategory) {
      const filtered = landmarks.filter(l => l.category === selectedCategory);
      return filtered.length;
    } else if (deleteMode === 'trip' && selectedTrip) {
      return landmarks.filter(l => l.trip_id === selectedTrip).length;
    } else if (deleteMode === 'selection') {
      return selectedLandmarks.length;
    }
    return 0;
  };

  const handleBulkDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    try {
      setLoading(true);
      
      let criteria = {};
      
      if (deleteMode === 'category') {
        if (!selectedCategory) {
          toast.error('Selecciona una categoría');
          return;
        }
        criteria.category = selectedCategory;
      } else if (deleteMode === 'trip') {
        if (!selectedTrip) {
          toast.error('Selecciona un viaje');
          return;
        }
        criteria.trip_id = selectedTrip;
      } else if (deleteMode === 'selection') {
        if (selectedLandmarks.length === 0) {
          toast.error('Selecciona al menos un landmark');
          return;
        }
        // Procesar en lotes para evitar URLs muy largas
        const batchSize = 50;
        let totalDeleted = 0;
        
        for (let i = 0; i < selectedLandmarks.length; i += batchSize) {
          const batch = selectedLandmarks.slice(i, i + batchSize);
          const batchCriteria = { landmark_ids: batch };
          
          const result = await bulkDeleteLandmarks(batchCriteria);
          totalDeleted += result.deleted_count;
          
          // Mostrar progreso
          const progress = Math.min(100, Math.round(((i + batch.length) / selectedLandmarks.length) * 100));
          toast.loading(`Eliminando landmarks... ${progress}%`);
        }
        
        toast.dismiss(); // Limpiar toast de progreso
        toast.success(`Se eliminaron ${totalDeleted} landmarks exitosamente`);
        onDeleteComplete();
        onClose();
        return;
      }

      const result = await bulkDeleteLandmarks(criteria);
      
      toast.success(`Se eliminaron ${result.deleted_count} landmarks exitosamente`);
      onDeleteComplete();
      onClose();
      
    } catch (error) {
      console.error('Error in bulk delete:', error);
      toast.error('Error al eliminar landmarks: ' + error.message);
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  };

  const resetForm = () => {
    setDeleteMode('category');
    setSelectedCategory('');
    setSelectedTrip('');
    setSelectedLandmarks([]);
    setConfirmDelete(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const affectedCount = getAffectedCount();
  const canDelete = affectedCount > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <Flex justify="between" align="center" className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Eliminación Masiva</h2>
          <Button
            onClick={handleClose}
            variant="secondary"
            size="sm"
            className="p-2"
          >
            <FaTimes />
          </Button>
        </Flex>

        <div className="space-y-4">
          {/* Delete Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de eliminación:
            </label>
            <Select
              value={deleteMode}
              onChange={(e) => {
                setDeleteMode(e.target.value);
                setConfirmDelete(false);
              }}
              options={[
                { value: 'category', label: 'Por categoría' },
                { value: 'trip', label: 'Por viaje' },
                // { value: 'selection', label: 'Selección manual' }
              ]}
              className="w-full"
            />
          </div>

          {/* Category Selection */}
          {deleteMode === 'category' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría:
              </label>
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setConfirmDelete(false);
                }}
                options={[
                  { value: '', label: 'Selecciona una categoría' },
                  ...categories.map(cat => ({
                    value: cat,
                    label: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/[-_]/g, ' ')
                  }))
                ]}
                className="w-full"
              />
            </div>
          )}

          {/* Trip Selection */}
          {deleteMode === 'trip' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Viaje:
              </label>
              <Select
                value={selectedTrip}
                onChange={(e) => {
                  setSelectedTrip(e.target.value);
                  setConfirmDelete(false);
                }}
                options={[
                  { value: '', label: 'Selecciona un viaje' },
                  ...trips.map(trip => ({
                    value: trip.id,
                    label: trip.name || `Viaje ${trip.id}`
                  }))
                ]}
                className="w-full"
              />
            </div>
          )}

          {/* Affected Count */}
          {canDelete && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <Flex align="center" className="gap-2">
                <FaExclamationTriangle className="text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Se eliminarán {affectedCount} landmark{affectedCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-yellow-700">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </Flex>
            </div>
          )}

          {/* Confirmation State */}
          {confirmDelete && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800 mb-2">
                ¿Estás seguro de que quieres eliminar {affectedCount} landmark{affectedCount !== 1 ? 's' : ''}?
              </p>
              <p className="text-xs text-red-700">
                Esta acción es permanente y no se puede deshacer.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <Flex justify="end" className="gap-2 mt-6">
          <Button
            onClick={handleClose}
            variant="secondary"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleBulkDelete}
            variant={confirmDelete ? "danger" : "primary"}
            disabled={!canDelete || loading}
            className="flex items-center gap-2"
          >
            <FaTrash />
            {loading ? 'Eliminando...' : 
             confirmDelete ? 'Confirmar Eliminación' : 
             'Eliminar'}
          </Button>
        </Flex>
      </div>
    </div>
  );
};

export default BulkDeleteModal;
