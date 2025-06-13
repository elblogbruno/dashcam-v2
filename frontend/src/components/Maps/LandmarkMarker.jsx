import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import landmarkImageManager from '../../services/landmarkImageService';

/**
 * Componente de marcador de landmark con soporte para imágenes offline
 * - Optimizado para rendimiento con lazy loading de imágenes
 * - Manejo mejorado de limpieza de eventos para evitar errores de Leaflet
 */
const LandmarkMarker = ({ landmark, isSelected, onSelect, onEdit, onDelete, ...props }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const markerRef = useRef(null);

  // Solo cargar la imagen del landmark cuando es seleccionado para mejorar rendimiento
  useEffect(() => {
    // Solo cargamos la imagen si el landmark está seleccionado
    if (!landmark || !landmark.id || !isSelected) {
      // Limpiar imagen anterior si ya no está seleccionado
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      return;
    }
    
    const loadImage = async () => {
      try {
        setImageLoading(true);
        const image = await landmarkImageManager.getLandmarkImageUrl(landmark.id);
        
        if (image) {
          setImageUrl(image);
        }
      } catch (error) {
        console.warn(`Error loading landmark image for ${landmark.name}:`, error);
      } finally {
        setImageLoading(false);
      }
    };
    
    loadImage();
    
    // Limpiar URL del objeto al desmontar para evitar memory leaks
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [landmark, isSelected, imageUrl]);

  // Limpiar recursos al desmontar el componente
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, []);

  // Crear icono de landmark con colores según categoría
  const createLandmarkIcon = useCallback(() => {
    const categoryConfig = {
      'gas_station': { color: '#FF6B6B', icon: '⛽' },
      'gas-station': { color: '#FF6B6B', icon: '⛽' }, // Compatibilidad
      'restaurant': { color: '#4ECDC4', icon: '🍽️' },
      'hotel': { color: '#45B7D1', icon: '🏨' },
      'attraction': { color: '#96CEB4', icon: '🎯' },
      'rest_area': { color: '#FFEAA7', icon: '🛌' },
      'rest-area': { color: '#FFEAA7', icon: '🛌' }, // Compatibilidad
      'emergency': { color: '#FF7675', icon: '🚨' },
      'default': { color: '#74B9FF', icon: '📍' }
    };
    
    const config = categoryConfig[landmark?.category] || categoryConfig.default;
 
    const isHighlighted = isSelected;
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${config.color};
          color: white;
          border: 2px solid ${isHighlighted ? '#FFD700' : 'white'};
          border-radius: 50%;
          width: ${isHighlighted ? '32px' : '24px'};
          height: ${isHighlighted ? '32px' : '24px'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isHighlighted ? '16px' : '14px'};
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: all 0.2s ease;
        ">
          ${config.icon}
        </div>
      `,
      className: 'landmark-marker-icon',
      iconSize: [isHighlighted ? 32 : 24, isHighlighted ? 32 : 24],
      iconAnchor: [isHighlighted ? 16 : 12, isHighlighted ? 16 : 12]
    });
  }, [landmark?.category, isSelected]);

  // Handlers con validación de props
  const handleMarkerClick = useCallback(() => {
    if (onSelect && landmark) {
      onSelect(landmark);
    }
  }, [onSelect, landmark]);

  const handleEdit = useCallback(() => {
    if (onEdit && landmark) {
      onEdit(landmark);
    }
  }, [onEdit, landmark]);

  const handleDelete = useCallback(() => {
    if (onDelete && landmark) {
      onDelete(landmark);
    }
  }, [onDelete, landmark]);

  // Validación de landmark
  if (!landmark || !landmark.lat || !landmark.lon) {
    return null;
  }

  return (
    <Marker
      ref={markerRef}
      position={[landmark.lat, landmark.lon]}
      icon={createLandmarkIcon()}
      eventHandlers={{
        click: handleMarkerClick
      }}
      {...props}
    >
      <Popup closeOnClick={false} autoClose={false}>
        <div className="max-w-xs">
          <div className="font-semibold text-lg mb-2 text-gray-800">
            {landmark.name || 'Landmark sin nombre'}
          </div>
          
          {landmark.description && (
            <div className="text-sm text-gray-600 mb-2">
              {landmark.description}
            </div>
          )}
          
          <div className="text-xs text-gray-500 mb-2">
            <div>Categoría: {landmark.category || 'Sin categoría'}</div>
            <div>Coordenadas: {landmark.lat.toFixed(6)}, {landmark.lon.toFixed(6)}</div>
            {landmark.radius_m && (
              <div>Radio: {landmark.radius_m}m</div>
            )}
          </div>

          {/* Imagen del landmark si está disponible */}
          {isSelected && imageLoading && (
            <div className="flex justify-center py-2">
              <div className="text-sm text-gray-500">Cargando imagen...</div>
            </div>
          )}
          
          {isSelected && imageUrl && !imageLoading && (
            <div className="mb-2">
              <img 
                src={imageUrl} 
                alt={landmark.name || 'Landmark'} 
                className="w-full h-32 object-cover rounded"
                onError={() => {
                  console.warn('Error loading landmark image');
                  setImageUrl(null);
                }}
              />
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-2 mt-2">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
              >
                Editar
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

export default LandmarkMarker;
