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
    <div className="w-full">
      <div className="flex justify-center gap-2 w-full">
        {options.map((option) => (
          <button
            key={option.id}
            className={`px-4 py-2 rounded-full flex items-center justify-center gap-2 transition-all ${
              selectedCamera === option.id 
                ? 'bg-nest-selected text-white' 
                : 'bg-opacity-10 bg-white text-nest-text-primary border border-nest-border'
            }`}
            onClick={() => onCameraChange(option.id)}
          >
            <span>{option.icon}</span>
            <span className={isMobile ? 'text-xs' : 'text-sm'}>{option.label}</span>
          </button>
        ))}
        </div>
      </div> 
  );
};

CameraSelector.propTypes = {
  selectedCamera: PropTypes.string.isRequired,
  onCameraChange: PropTypes.func.isRequired,
};

export default CameraSelector;

