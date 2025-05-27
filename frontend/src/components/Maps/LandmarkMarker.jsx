import React, { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import landmarkImageManager from '../../services/landmarkImageService';

/**
 * Componente de marcador de landmark con soporte para imágenes offline
 */
const LandmarkMarker = ({ landmark, icon, children, ...props }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Cargar la imagen del landmark si está disponible
  useEffect(() => {
    const loadImage = async () => {
      if (!landmark || !landmark.id) return;
      
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
  }, [landmark]);

  // Determinar si es una estación de gasolina específica
  const isSpecificGasStation = () => {
    if (!landmark || !landmark.name) return false;
    
    const gasStationBrands = ['shell', 'chevron', 'bp', 'exxon', 'mobil', 'texaco', 'arco', '76'];
    const nameLower = landmark.name.toLowerCase();
    
    return gasStationBrands.some(brand => nameLower.includes(brand));
  };
  
  // Obtener la marca específica de la gasolinera
  const getGasStationBrand = () => {
    if (!landmark || !landmark.name) return null;
    
    const gasStationBrands = ['shell', 'chevron', 'bp', 'exxon', 'mobil', 'texaco', 'arco', '76'];
    const nameLower = landmark.name.toLowerCase();
    
    for (const brand of gasStationBrands) {
      if (nameLower.includes(brand)) {
        return brand;
      }
    }
    return null;
  };
  
  // Crear contenido del popup con imagen si está disponible
  const renderPopupContent = () => {
    if (!landmark) return null;
    
    // Determinar el tipo específico de landmark para mostrarlo
    const specificType = isSpecificGasStation() 
      ? `${getGasStationBrand().toUpperCase()} Gas Station`
      : landmark.category || 'Unknown';
    
    return (
      <div className="landmark-popup">
        <div className="text-center">
          <h3 className="font-bold text-sm sm:text-base">{landmark.name}</h3>
          <p className="text-xs text-gray-500 capitalize">
            {specificType} • {landmark.radius_m || 100}m radius
          </p>
          
          {imageLoading && (
            <div className="w-full h-20 flex items-center justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-dashcam-500 border-t-transparent rounded-full"></div>
            </div>
          )}
          
          {imageUrl && !imageLoading && (
            <div className="mt-2 mb-2">
              <img 
                src={imageUrl} 
                alt={landmark.name}
                className="rounded w-full max-h-32 object-cover"
                onError={(e) => {
                  console.warn(`Error loading image for ${landmark.name}`);
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
          
          {landmark.description && (
            <p className="text-xs mt-1">{landmark.description}</p>
          )}
        </div>
        {children}
      </div>
    );
  };

  return (
    <Marker position={[landmark.lat, landmark.lon]} icon={icon} {...props}>
      <Popup>
        {renderPopupContent()}
      </Popup>
    </Marker>
  );
};

export default LandmarkMarker;
