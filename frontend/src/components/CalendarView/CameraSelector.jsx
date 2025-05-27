import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaVideo, FaUserAlt, FaColumns } from 'react-icons/fa';

const CameraSelector = ({ selectedCamera, onCameraChange }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detector de cambio de tamaño para adaptar la UI
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const options = [
    { id: 'exterior', icon: <FaVideo />, label: 'Exterior' },
    { id: 'interior', icon: <FaUserAlt />, label: 'Interior' },
    { id: 'both', icon: <FaColumns />, label: 'Ambas' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-dashcam-50 p-2 border-b border-gray-200">
        <h3 className="text-sm font-medium text-dashcam-700">Cámaras</h3>
      </div>
      <div className={`p-2 ${isMobile ? 'flex justify-center' : ''}`}>
        <div className={`flex ${isMobile ? 'flex-row space-x-4' : 'flex-col space-y-2'}`}>
          {options.map((option) => (
            <button
              key={option.id}
              className={`
                flex items-center p-2 rounded-lg transition-colors
                ${selectedCamera === option.id ? 'bg-dashcam-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                ${isMobile ? 'px-3 py-1.5' : 'w-full justify-center'}
              `}
              onClick={() => onCameraChange(option.id)}
            >
              <span className="mr-2">{option.icon}</span>
              <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

CameraSelector.propTypes = {
  selectedCamera: PropTypes.string.isRequired,
  onCameraChange: PropTypes.func.isRequired,
};

export default CameraSelector;

