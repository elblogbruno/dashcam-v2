import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { FaCheck, FaCheckDouble, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';
import L from 'leaflet';

const KmlPreview = ({ points, onClose, onConfirm, type = 'waypoints' }) => {
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  
  useEffect(() => {
    // Initialize map when component mounts
    if (mapRef.current && !mapInstanceRef.current) {
      // Create map instance
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [0, 0],  // Default center, will be updated
        zoom: 4,
        scrollWheelZoom: true
      });
      
      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }
    
    // Clear any existing markers
    if (markersRef.current.length > 0) {
      markersRef.current.forEach(marker => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
    }
    
    // Add markers for all points
    if (points && points.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds();
      
      points.forEach((point, index) => {
        const icon = L.divIcon({
          className: 'custom-marker-icon',
          html: `<div class="marker-pin" style="background-color: ${selectedPoints.includes(index) ? '#3B82F6' : '#EF4444'}; width: 20px; height: 20px; border-radius: 10px; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 12px;">${index + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        
        const marker = L.marker([point.lat, point.lon], { icon }).addTo(mapInstanceRef.current);
        
        marker.bindPopup(`
          <div class="font-medium">${point.name || 'Point ' + (index + 1)}</div>
          <div class="text-xs mt-1">Lat: ${point.lat.toFixed(6)}</div>
          <div class="text-xs">Lon: ${point.lon.toFixed(6)}</div>
          ${point.description ? `<div class="text-xs mt-1">${point.description}</div>` : ''}
        `);
        
        marker.on('click', () => {
          marker.openPopup();
          togglePointSelection(index);
        });
        
        markersRef.current.push(marker);
        bounds.extend([point.lat, point.lon]);
      });
      
      // Fit the map to show all markers
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
    
  }, [points, selectedPoints]);
  
  const togglePointSelection = (index) => {
    setSelectedPoints(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };
  
  const handleSelectAll = () => {
    if (!selectAll) {
      setSelectedPoints(points.map((_, index) => index));
    } else {
      setSelectedPoints([]);
    }
    setSelectAll(!selectAll);
  };
  
  const handleConfirm = () => {
    const selectedItems = points.filter((_, index) => selectedPoints.includes(index));
    onConfirm(selectedItems);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-dashcam-700 text-white p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            <FaMapMarkerAlt className="inline-block mr-2 mb-1" />
            {type === 'waypoints' ? 'Selecciona puntos de ruta' : 'Selecciona puntos de interés'}
          </h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200"
          >
            <FaTimes size={20} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 h-[60vh]">
          {/* Map preview */}
          <div className="h-full bg-gray-100" ref={mapRef}></div>
          
          {/* Points list */}
          <div className="h-full overflow-y-auto bg-gray-50 border-l border-gray-200">
            <div className="p-3 border-b border-gray-200 bg-gray-100 sticky top-0 z-10 flex items-center justify-between">
              <div>
                <span className="font-medium">
                  {points.length} {type === 'waypoints' ? 'puntos' : 'marcadores'} encontrados
                </span>
                <span className="ml-2 text-gray-600 text-sm">
                  ({selectedPoints.length} seleccionados)
                </span>
              </div>
              
              <button 
                onClick={handleSelectAll}
                className="bg-dashcam-600 hover:bg-dashcam-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
              >
                <FaCheckDouble className="mr-1" />
                {selectAll ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            
            <div className="divide-y divide-gray-200">
              {points.map((point, index) => (
                <div 
                  key={index}
                  className={`p-3 hover:bg-gray-100 cursor-pointer flex items-center justify-between ${
                    selectedPoints.includes(index) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => togglePointSelection(index)}
                >
                  <div className="flex items-center">
                    <div 
                      className={`w-6 h-6 rounded-full mr-3 flex items-center justify-center ${
                        selectedPoints.includes(index) ? 'bg-dashcam-600 text-white' : 'bg-gray-300'
                      }`}
                    >
                      {selectedPoints.includes(index) && <FaCheck size={12} />}
                    </div>
                    <div>
                      <div className="font-medium">{point.name || `Punto ${index + 1}`}</div>
                      <div className="text-xs text-gray-500">
                        {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-100 p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md mr-2"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="bg-dashcam-600 hover:bg-dashcam-700 text-white px-4 py-2 rounded-md"
            disabled={selectedPoints.length === 0}
          >
            Importar {selectedPoints.length} {type === 'waypoints' ? 'puntos' : 'marcadores'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KmlPreview;
