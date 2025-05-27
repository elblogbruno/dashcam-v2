import React from 'react';
import PropTypes from 'prop-types';

/**
 * Componente que muestra estadísticas de rendimiento sobre streams de video
 */
const PerformanceStats = ({ stats, videoRef, cameraType = '' }) => {
  // Valores por defecto si no hay estadísticas
  const {
    fps = 0,
    latency = 0,
    avgLatency = 0,
    resolution = '',
    frameSize = ''
  } = stats || {};

  return (
    <div className="performance-stats absolute bottom-0 left-0 text-xs text-white bg-black bg-opacity-60 p-1 m-1 rounded">
      <div>FPS: <span className="font-bold">{fps}</span></div>
      <div>Latencia: <span className="font-bold">{avgLatency}ms</span></div>
      {resolution && <div>Resolución: <span className="font-bold">{resolution}</span></div>}
      {frameSize && <div>Tamaño: <span className="font-bold">{frameSize}</span></div>}
      {cameraType && <div>Cámara: <span className="font-bold">{cameraType}</span></div>}
    </div>
  );
};

PerformanceStats.propTypes = {
  stats: PropTypes.shape({
    fps: PropTypes.number,
    latency: PropTypes.number,
    avgLatency: PropTypes.number,
    resolution: PropTypes.string,
    frameSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  videoRef: PropTypes.object,
  cameraType: PropTypes.string
};

export default PerformanceStats;
