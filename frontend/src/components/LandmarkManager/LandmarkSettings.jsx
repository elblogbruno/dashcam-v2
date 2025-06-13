import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaSave, FaSpinner, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { getLandmarkSettings, updateLandmarkSettings } from '../../services/landmarkService';

const LandmarkSettings = ({ onClose }) => {
  const [settings, setSettings] = useState({
    auto_download_enabled: true,
    download_radius_km: 5,
    max_landmarks_per_location: 15,
    point_categories: [
      "gas_station", "restaurant", "hotel", 
      "natural", "tourism", "historic"
    ],
    auto_cleanup: true,
    cleanup_radius_km: 50,
    max_landmark_age_days: 60,
    download_images: true,
    image_download_categories: [
      "restaurant", "hotel", "tourism", "historic"
    ],
    max_image_size_mb: 5,
    image_quality: "medium",
    skip_duplicates: true,
    enable_optimization: true,
    optimization_tolerance: 0.3,
    show_detailed_progress: true,
    enable_audio_notifications: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const availableCategories = [
    { id: "gas_station", name: "Gasolineras", description: "Estaciones de combustible y servicios" },
    { id: "restaurant", name: "Restaurantes y Cafés", description: "Lugares para comer y beber" },
    { id: "hotel", name: "Hoteles y Alojamiento", description: "Lugares para hospedarse" },
    { id: "natural", name: "Lugares Naturales", description: "Parques, montañas, lagos, etc." },
    { id: "tourism", name: "Atracciones Turísticas", description: "Monumentos y lugares de interés" },
    { id: "historic", name: "Sitios Históricos", description: "Lugares de valor histórico" },
    { id: "shopping", name: "Centros Comerciales", description: "Tiendas y centros comerciales" },
    { id: "medical", name: "Servicios Médicos", description: "Hospitales, farmacias, etc." }
  ];

  const imageQualityOptions = [
    { value: "low", label: "Baja (más rápido)", description: "Imágenes pequeñas, descarga rápida" },
    { value: "medium", label: "Media (recomendado)", description: "Balance entre calidad y velocidad" },
    { value: "high", label: "Alta (más lento)", description: "Mejor calidad, descarga más lenta" }
  ];
  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await getLandmarkSettings();
        setSettings(data);
      } catch (error) {
        console.error('Error fetching landmark settings:', error);
        toast.error('Could not load landmark settings');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? parseFloat(value) : value;
    
    setSettings(prev => ({
      ...prev,
      [name]: newValue
    }));
  };
  
  const handleCategoryChange = (category, checked) => {
    if (checked) {
      setSettings(prev => ({
        ...prev,
        point_categories: [...prev.point_categories, category]
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        point_categories: prev.point_categories.filter(cat => cat !== category)
      }));
    }
  };

  const handleImageCategoryChange = (category, checked) => {
    if (checked) {
      setSettings(prev => ({
        ...prev,
        image_download_categories: [...prev.image_download_categories, category]
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        image_download_categories: prev.image_download_categories.filter(cat => cat !== category)
      }));
    }
  };

  const handleToggleChange = (field) => (e) => {
    setSettings(prev => ({
      ...prev,
      [field]: e.target.checked
    }));
  };
  
  const saveSettings = async () => {
    try {
      setSaving(true);
      await updateLandmarkSettings(settings);
      toast.success('Configuración de landmarks guardada exitosamente');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error saving landmark settings:', error);
      toast.error('Error al guardar la configuración de landmarks');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg">
        <div className="flex justify-between items-center bg-dashcam-700 text-white p-4 rounded-t-lg">
          <h2 className="text-lg font-bold">Configuración de Landmarks</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-8 flex flex-col items-center">
          <FaSpinner className="animate-spin h-8 w-8 text-dashcam-500" />
          <p className="mt-2">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg max-h-[95vh] overflow-hidden flex flex-col">
      <div className="flex justify-between items-center bg-dashcam-700 text-white p-4 rounded-t-lg flex-shrink-0">
        <h2 className="text-lg font-bold">Configuración Avanzada de Landmarks</h2>
        <button onClick={onClose} className="text-white hover:text-gray-300">
          <FaTimes size={20} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
          <div className="flex items-start">
            <FaInfoCircle className="text-blue-500 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 mb-1">Sistema de Optimización Avanzado</h3>
              <p className="text-xs text-blue-700">
                Sistema completo de optimización de landmarks con descarga inteligente de imágenes, 
                análisis geométrico y configuraciones granulares.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Auto-descarga de landmarks</h3>
            <p className="text-sm text-gray-600">Descargar automáticamente landmarks al crear/actualizar viajes</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox"
              checked={settings.auto_download_enabled}
              onChange={handleToggleChange('auto_download_enabled')}
              className="sr-only"
            />
            <div className={`relative w-11 h-6 transition-colors ${settings.auto_download_enabled ? 'bg-dashcam-500' : 'bg-gray-200'} rounded-full`}>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.auto_download_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </div>
          </label>
        </div>

        {/* Download radius */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Radio de descarga (km)
          </label>
          <input
            type="number"
            name="download_radius_km"
            value={settings.download_radius_km}
            onChange={handleInputChange}
            min="1"
            max="50"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dashcam-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Radio alrededor de las ubicaciones del viaje para descargar datos de landmarks
          </p>
        </div>

        {/* Max landmarks per location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Máximo de landmarks por ubicación
          </label>
          <input
            type="number"
            name="max_landmarks_per_location"
            value={settings.max_landmarks_per_location}
            onChange={handleInputChange}
            min="5"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dashcam-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Número máximo de landmarks a descargar por ubicación
          </p>
        </div>

        {/* Point categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categorías de puntos a descargar
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availableCategories.map(category => (
              <label key={category.id} className="flex items-start space-x-2 p-2 border rounded-md hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={settings.point_categories.includes(category.id)}
                  onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                  className="h-4 w-4 text-dashcam-600 focus:ring-dashcam-500 border-gray-300 rounded mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">{category.name}</span>
                  <p className="text-xs text-gray-500">{category.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Image Download Settings */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Configuración de Imágenes</h3>
          
          {/* Download images toggle */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Descargar imágenes de landmarks</h4>
              <p className="text-sm text-gray-600">Incluir imágenes en la descarga de landmarks</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox"
                checked={settings.download_images}
                onChange={handleToggleChange('download_images')}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 transition-colors ${settings.download_images ? 'bg-dashcam-500' : 'bg-gray-200'} rounded-full`}>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.download_images ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </label>
          </div>

          {/* Image categories (only show if images are enabled) */}
          {settings.download_images && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categorías para descarga de imágenes
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableCategories.map(category => (
                    <label key={category.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={settings.image_download_categories.includes(category.id)}
                        onChange={(e) => handleImageCategoryChange(category.id, e.target.checked)}
                        className="h-4 w-4 text-dashcam-600 focus:ring-dashcam-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{category.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Solo se descargarán imágenes para estas categorías seleccionadas
                </p>
              </div>

              {/* Image quality */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Calidad de imagen
                </label>
                <select
                  name="image_quality"
                  value={settings.image_quality}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dashcam-500"
                >
                  {imageQualityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {imageQualityOptions.find(opt => opt.value === settings.image_quality)?.description}
                </p>
              </div>

              {/* Max image size */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tamaño máximo por imagen (MB)
                </label>
                <input
                  type="number"
                  name="max_image_size_mb"
                  value={settings.max_image_size_mb}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dashcam-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Imágenes más grandes serán comprimidas o omitidas
                </p>
              </div>

              {/* Skip duplicates */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Evitar imágenes duplicadas</h4>
                  <p className="text-sm text-gray-600">No descargar la misma imagen múltiples veces</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={settings.skip_duplicates}
                    onChange={handleToggleChange('skip_duplicates')}
                    className="sr-only"
                  />
                  <div className={`relative w-11 h-6 transition-colors ${settings.skip_duplicates ? 'bg-dashcam-500' : 'bg-gray-200'} rounded-full`}>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.skip_duplicates ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Optimization Settings */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Configuración de Optimización</h3>
          
          {/* Enable optimization toggle */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Optimización geométrica</h4>
              <p className="text-sm text-gray-600">Usar algoritmos avanzados para optimizar la descarga</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox"
                checked={settings.enable_optimization}
                onChange={handleToggleChange('enable_optimization')}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 transition-colors ${settings.enable_optimization ? 'bg-dashcam-500' : 'bg-gray-200'} rounded-full`}>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.enable_optimization ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </label>
          </div>

          {/* Optimization tolerance (only show if optimization is enabled) */}
          {settings.enable_optimization && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tolerancia de optimización
              </label>
              <input
                type="number"
                name="optimization_tolerance"
                value={settings.optimization_tolerance}
                onChange={handleInputChange}
                min="0.1"
                max="1.0"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dashcam-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nivel de solapamiento permitido entre regiones (0.1 = estricto, 1.0 = permisivo)
              </p>
            </div>
          )}
        </div>

        {/* Cleanup Settings */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Configuración de Limpieza</h3>
          
          {/* Auto cleanup toggle */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Limpieza automática</h4>
              <p className="text-sm text-gray-600">Eliminar landmarks antiguos automáticamente</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox"
                checked={settings.auto_cleanup}
                onChange={handleToggleChange('auto_cleanup')}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 transition-colors ${settings.auto_cleanup ? 'bg-dashcam-500' : 'bg-gray-200'} rounded-full`}>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.auto_cleanup ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </label>
          </div>

          {/* Cleanup settings (only show if auto cleanup is enabled) */}
          {settings.auto_cleanup && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Radio de limpieza (km)
                </label>
                <input
                  type="number"
                  name="cleanup_radius_km"
                  value={settings.cleanup_radius_km}
                  onChange={handleInputChange}
                  min="10"
                  max="200"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dashcam-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Distancia fuera de este radio donde se eliminarán landmarks antiguos
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Edad máxima de landmarks (días)
                </label>
                <input
                  type="number"
                  name="max_landmark_age_days"
                  value={settings.max_landmark_age_days}
                  onChange={handleInputChange}
                  min="7"
                  max="365"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dashcam-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Landmarks más antiguos que este período serán eliminados
                </p>
              </div>
            </>
          )}
        </div>

        {/* Interface Settings */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Configuración de Interfaz</h3>
          
          {/* Show detailed progress */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Progreso detallado</h4>
              <p className="text-sm text-gray-600">Mostrar información granular durante las descargas</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox"
                checked={settings.show_detailed_progress}
                onChange={handleToggleChange('show_detailed_progress')}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 transition-colors ${settings.show_detailed_progress ? 'bg-dashcam-500' : 'bg-gray-200'} rounded-full`}>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.show_detailed_progress ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </label>
          </div>

          {/* Audio notifications */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Notificaciones de audio</h4>
              <p className="text-sm text-gray-600">Reproducir notificaciones durante el proceso</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox"
                checked={settings.enable_audio_notifications}
                onChange={handleToggleChange('enable_audio_notifications')}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 transition-colors ${settings.enable_audio_notifications ? 'bg-dashcam-500' : 'bg-gray-200'} rounded-full`}>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.enable_audio_notifications ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center space-x-2 bg-dashcam-500 text-white px-6 py-3 rounded-md hover:bg-dashcam-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
            <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
 
export default LandmarkSettings;