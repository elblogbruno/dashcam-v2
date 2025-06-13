import React, { useState, useEffect } from 'react';

const SpeedDisplay = ({ speed, className = "" }) => {
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [unit, setUnit] = useState('kmh');
  const [previousSpeed, setPreviousSpeed] = useState(0);

  useEffect(() => {
    if (speed && speed.kmh !== undefined) {
      setPreviousSpeed(displaySpeed);
      setDisplaySpeed(unit === 'kmh' ? speed.kmh : speed.mph);
    }
  }, [speed, unit]);

  const toggleUnit = () => {
    setUnit(unit === 'kmh' ? 'mph' : 'kmh');
  };

  const getSpeedColor = () => {
    if (displaySpeed === 0) return 'text-gray-400';
    if (displaySpeed < 30) return 'text-green-400';
    if (displaySpeed < 60) return 'text-yellow-400';
    if (displaySpeed < 90) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSpeedAnimation = () => {
    const diff = Math.abs(displaySpeed - previousSpeed);
    if (diff > 5) return 'animate-pulse';
    return '';
  };

  const getSourceBadge = () => {
    if (!speed || !speed.source) return null;
    
    const sourceColors = {
      'gps': 'bg-green-500',
      'calculated': 'bg-blue-500',
      'combined': 'bg-purple-500',
      'none': 'bg-gray-500'
    };

    const sourceLabels = {
      'gps': 'GPS',
      'calculated': 'CALC',
      'combined': 'MIX',
      'none': 'N/A'
    };

    return (
      <span className={`inline-block px-1 py-0.5 text-xs rounded-sm text-white ${sourceColors[speed.source] || 'bg-gray-500'}`}>
        {sourceLabels[speed.source] || 'N/A'}
      </span>
    );
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Velocidad</h3>
        {getSourceBadge()}
      </div>
      
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline">
          <span 
            className={`text-3xl font-bold tabular-nums ${getSpeedColor()} ${getSpeedAnimation()}`}
          >
            {Math.round(displaySpeed)}
          </span>
          <button
            onClick={toggleUnit}
            className="ml-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {unit.toUpperCase()}
          </button>
        </div>
        
        {speed && speed.source !== 'none' && (
          <div className="text-xs text-gray-500">
            <div>GPS: {Math.round(speed.gps_speed_kmh || 0)} km/h</div>
            <div>Calc: {Math.round(speed.calculated_speed_kmh || 0)} km/h</div>
          </div>
        )}
      </div>

      {/* Indicador de señal GPS */}
      {speed && (
        <div className="mt-2 flex items-center text-xs">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            speed.source === 'none' ? 'bg-gray-500' :
            speed.source === 'gps' || speed.source === 'combined' ? 'bg-green-500' : 'bg-blue-500'
          }`}></div>
          <span className="text-gray-400">
            {speed.source === 'none' ? 'Sin señal' :
             speed.source === 'gps' ? 'Señal GPS' :
             speed.source === 'calculated' ? 'Calculada' :
             speed.source === 'combined' ? 'GPS + Calc' : 'Desconocido'}
          </span>
        </div>
      )}
    </div>
  );
};

export default SpeedDisplay;
