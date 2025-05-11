import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaCog, FaSave, FaSpinner } from 'react-icons/fa';
import { getLandmarkSettings, updateLandmarkSettings } from '../../services/landmarkService';

const LandmarkSettings = () => {
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
    max_landmark_age_days: 60
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Available categories for landmarks
  const availableCategories = [
    { id: "gas_station", name: "Gas Stations" },
    { id: "restaurant", name: "Restaurants & Cafes" },
    { id: "hotel", name: "Hotels & Lodging" },
    { id: "natural", name: "Natural Features" },
    { id: "tourism", name: "Tourism Attractions" },
    { id: "historic", name: "Historic Sites" }
  ];
  
  // Fetch settings when component mounts
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
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    // Convert number inputs to numeric values
    const newValue = type === 'number' ? parseFloat(value) : value;
    
    setSettings(prev => ({
      ...prev,
      [name]: newValue
    }));
  };
  
  // Handle checkbox changes
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    
    setSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  // Handle category selection
  const handleCategoryChange = (category) => {
    const currentCategories = [...settings.point_categories];
    
    if (currentCategories.includes(category)) {
      // Remove category if it's already selected
      const newCategories = currentCategories.filter(cat => cat !== category);
      setSettings(prev => ({
        ...prev,
        point_categories: newCategories
      }));
    } else {
      // Add category if it's not selected
      setSettings(prev => ({
        ...prev,
        point_categories: [...currentCategories, category]
      }));
    }
  };
  
  // Save settings
  const saveSettings = async () => {
    try {
      setSaving(true);
      await updateLandmarkSettings(settings);
      toast.success('Landmark settings saved successfully');
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving landmark settings:', error);
      toast.error('Failed to save landmark settings');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-4 rounded-md">
          <FaSpinner className="animate-spin mx-auto h-8 w-8 text-dashcam-500" />
          <p className="mt-2">Loading settings...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-sm bg-gray-100 hover:bg-gray-200 py-1 px-2 rounded"
      >
        <FaCog /> <span>Landmark Settings</span>
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[1000] landmark-settings-popup">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center bg-dashcam-700 text-white p-4 rounded-t-lg">
              <h2 className="text-lg font-bold">Landmark Download Settings</h2>
              <button onClick={() => setIsOpen(false)} className="text-white">
                &times;
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Auto-download toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Auto-download landmarks</h3>
                  <p className="text-sm text-gray-600">Automatically download landmarks when creating/updating trips</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox"
                    name="auto_download_enabled"
                    checked={settings.auto_download_enabled}
                    onChange={handleCheckboxChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-dashcam-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dashcam-600"></div>
                </label>
              </div>
              
              {/* Download radius */}
              <div>
                <h3 className="font-medium">Download radius (km)</h3>
                <p className="text-sm text-gray-600 mb-1">Distance around each location to search for landmarks</p>
                <input
                  type="range"
                  name="download_radius_km"
                  min="1"
                  max="25"
                  value={settings.download_radius_km}
                  onChange={handleInputChange}
                  className="w-full accent-dashcam-500"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1km</span>
                  <span>{settings.download_radius_km}km</span>
                  <span>25km</span>
                </div>
              </div>
              
              {/* Max landmarks */}
              <div>
                <h3 className="font-medium">Max landmarks per location</h3>
                <p className="text-sm text-gray-600 mb-1">Limit landmarks to prevent performance issues</p>
                <select
                  name="max_landmarks_per_location"
                  value={settings.max_landmarks_per_location}
                  onChange={handleInputChange}
                  className="w-full border rounded p-2"
                >
                  <option value="5">5 (Minimal)</option>
                  <option value="10">10 (Low)</option>
                  <option value="15">15 (Medium - Recommended)</option>
                  <option value="25">25 (High)</option>
                  <option value="50">50 (Very High - May cause performance issues)</option>
                  <option value="0">No limit (Not recommended)</option>
                </select>
              </div>
              
              {/* Categories */}
              <div>
                <h3 className="font-medium">Point of interest categories</h3>
                <p className="text-sm text-gray-600 mb-2">Select which types of landmarks to download</p>
                <div className="grid grid-cols-2 gap-2">
                  {availableCategories.map(category => (
                    <label key={category.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.point_categories.includes(category.id)}
                        onChange={() => handleCategoryChange(category.id)}
                        className="rounded text-dashcam-600 focus:ring-dashcam-500"
                      />
                      <span className="text-gray-800">{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Auto cleanup */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Auto-cleanup old landmarks</h3>
                  <p className="text-sm text-gray-600">Automatically remove landmarks from past trips</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox"
                    name="auto_cleanup"
                    checked={settings.auto_cleanup}
                    onChange={handleCheckboxChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-dashcam-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dashcam-600"></div>
                </label>
              </div>
              
              {/* Cleanup settings */}
              {settings.auto_cleanup && (
                <div className="pl-4 border-l-2 border-dashcam-300 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium">Landmark age (days)</h4>
                    <p className="text-xs text-gray-600">Remove landmarks older than this many days</p>
                    <input
                      type="number"
                      name="max_landmark_age_days"
                      value={settings.max_landmark_age_days}
                      onChange={handleInputChange}
                      min="1"
                      max="365"
                      className="w-full border rounded p-2"
                    />
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium">Cleanup radius (km)</h4>
                    <p className="text-xs text-gray-600">Keep landmarks within this distance of upcoming trips</p>
                    <input
                      type="number"
                      name="cleanup_radius_km"
                      value={settings.cleanup_radius_km}
                      onChange={handleInputChange}
                      min="0"
                      max="500"
                      className="w-full border rounded p-2"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end p-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border rounded-md mr-2"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-2 bg-dashcam-600 hover:bg-dashcam-700 text-white rounded-md flex items-center"
              >
                {saving ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FaSave className="mr-2" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandmarkSettings;