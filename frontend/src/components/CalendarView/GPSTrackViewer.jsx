import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaRoute, FaExpand, FaCompress, FaMapMarkerAlt, FaTachometerAlt, FaSatellite } from 'react-icons/fa';

const GPSTrackViewer = ({ gpsMetadata, compact = false, onToggleView = null }) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!gpsMetadata || !gpsMetadata.waypoints || gpsMetadata.waypoints.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (onToggleView) {
      onToggleView(!isExpanded);
    }
  };

  // Calcular los límites para normalizar las coordenadas
  const bounds = gpsMetadata.bounds || {
    north: Math.max(...gpsMetadata.waypoints.map(w => w.lat)),
    south: Math.min(...gpsMetadata.waypoints.map(w => w.lat)),
    east: Math.max(...gpsMetadata.waypoints.map(w => w.lon)),
    west: Math.min(...gpsMetadata.waypoints.map(w => w.lon))
  };

  // Normalizar coordenadas para el SVG (0-100)
  const normalizeCoords = (lat, lon) => {
    const latRange = bounds.north - bounds.south;
    const lonRange = bounds.east - bounds.west;
    
    // Evitar división por cero
    const normalizedLat = latRange > 0 ? ((lat - bounds.south) / latRange) * 80 + 10 : 50;
    const normalizedLon = lonRange > 0 ? ((lon - bounds.west) / lonRange) * 80 + 10 : 50;
    
    // Invertir latitud para que el norte esté arriba
    return {
      x: normalizedLon,
      y: 100 - normalizedLat
    };
  };

  // Crear la ruta SVG
  const createSVGPath = () => {
    const points = gpsMetadata.waypoints.map(waypoint => {
      const normalized = normalizeCoords(waypoint.lat, waypoint.lon);
      return `${normalized.x},${normalized.y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  const formatSpeed = (speed) => {
    if (speed === null || speed === undefined) return 'N/A';
    return `${Math.round(speed)} km/h`;
  };

  const formatAltitude = (altitude) => {
    if (altitude === null || altitude === undefined) return 'N/A';
    return `${Math.round(altitude)}m`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden transition-all duration-300 ${
      isExpanded ? 'h-auto' : 'h-16'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-white/20">
        <div className="flex items-center gap-2 text-white">
          <FaRoute className="text-blue-400" />
          <span className="font-medium">Pista GPS</span>
          <span className="text-xs text-white/70">
            {gpsMetadata.point_count} puntos
          </span>
        </div>
        
        {compact && (
          <button
            onClick={toggleExpanded}
            className="text-white/70 hover:text-white transition-colors p-1 rounded"
            aria-label={isExpanded ? "Colapsar" : "Expandir"}
          >
            {isExpanded ? <FaCompress /> : <FaExpand />}
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Estadísticas de la pista */}
          <div className="grid grid-cols-2 gap-3">
            {gpsMetadata.total_distance && (
              <div className="bg-white/5 rounded p-2">
                <div className="text-xs text-white/70">Distancia Total</div>
                <div className="text-white font-medium">
                  {gpsMetadata.total_distance < 1000 
                    ? `${Math.round(gpsMetadata.total_distance)}m`
                    : `${(gpsMetadata.total_distance / 1000).toFixed(2)}km`
                  }
                </div>
              </div>
            )}
            
            {gpsMetadata.waypoints.length > 0 && (
              <div className="bg-white/5 rounded p-2">
                <div className="text-xs text-white/70">Duración</div>
                <div className="text-white font-medium">
                  {(() => {
                    const start = new Date(gpsMetadata.waypoints[0].timestamp);
                    const end = new Date(gpsMetadata.waypoints[gpsMetadata.waypoints.length - 1].timestamp);
                    const duration = Math.round((end - start) / 1000);
                    return `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Visualización de la pista */}
          <div className="relative bg-white/5 rounded-lg p-3">
            <div className="text-xs text-white/70 mb-2">Ruta recorrida</div>
            
            <svg 
              viewBox="0 0 100 100" 
              className="w-full h-32 border border-white/10 rounded bg-gray-900/50"
              style={{ aspectRatio: '1' }}
            >
              {/* Grid de fondo */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
              
              {/* Ruta GPS */}
              <path
                d={createSVGPath()}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Puntos de inicio y fin */}
              {gpsMetadata.waypoints.length > 0 && (
                <>
                  {/* Punto de inicio */}
                  {(() => {
                    const start = normalizeCoords(
                      gpsMetadata.waypoints[0].lat, 
                      gpsMetadata.waypoints[0].lon
                    );
                    return (
                      <circle
                        cx={start.x}
                        cy={start.y}
                        r="1.5"
                        fill="#10b981"
                        stroke="white"
                        strokeWidth="0.5"
                      />
                    );
                  })()}
                  
                  {/* Punto de fin */}
                  {(() => {
                    const end = normalizeCoords(
                      gpsMetadata.waypoints[gpsMetadata.waypoints.length - 1].lat,
                      gpsMetadata.waypoints[gpsMetadata.waypoints.length - 1].lon
                    );
                    return (
                      <circle
                        cx={end.x}
                        cy={end.y}
                        r="1.5"
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth="0.5"
                      />
                    );
                  })()}
                </>
              )}
              
              {/* Puntos interactivos */}
              {gpsMetadata.waypoints.map((waypoint, index) => {
                const normalized = normalizeCoords(waypoint.lat, waypoint.lon);
                return (
                  <circle
                    key={index}
                    cx={normalized.x}
                    cy={normalized.y}
                    r="0.8"
                    fill="rgba(59, 130, 246, 0.6)"
                    className="cursor-pointer hover:fill-blue-400"
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>
            
            {/* Leyenda */}
            <div className="flex justify-between items-center mt-2 text-xs text-white/70">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Inicio</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Fin</span>
                </div>
              </div>
              
              <div className="text-right">
                <div>N ↑</div>
              </div>
            </div>
          </div>

          {/* Información del punto hover */}
          {hoveredPoint !== null && gpsMetadata.waypoints[hoveredPoint] && (
            <div className="bg-white/10 rounded-lg p-3 border border-white/20">
              <div className="text-xs text-white/70 mb-2">
                Punto {hoveredPoint + 1} de {gpsMetadata.waypoints.length}
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/70 flex items-center gap-1">
                    <FaMapMarkerAlt />
                    Coordenadas:
                  </span>
                  <span className="text-white font-mono">
                    {gpsMetadata.waypoints[hoveredPoint].lat.toFixed(6)}, {gpsMetadata.waypoints[hoveredPoint].lon.toFixed(6)}
                  </span>
                </div>
                
                {gpsMetadata.waypoints[hoveredPoint].speed !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-white/70 flex items-center gap-1">
                      <FaTachometerAlt />
                      Velocidad:
                    </span>
                    <span className="text-white">
                      {formatSpeed(gpsMetadata.waypoints[hoveredPoint].speed)}
                    </span>
                  </div>
                )}
                
                {gpsMetadata.waypoints[hoveredPoint].altitude !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Altitud:</span>
                    <span className="text-white">
                      {formatAltitude(gpsMetadata.waypoints[hoveredPoint].altitude)}
                    </span>
                  </div>
                )}
                
                {gpsMetadata.waypoints[hoveredPoint].satellites !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-white/70 flex items-center gap-1">
                      <FaSatellite />
                      Satélites:
                    </span>
                    <span className="text-white">
                      {gpsMetadata.waypoints[hoveredPoint].satellites}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-white/70">Tiempo:</span>
                  <span className="text-white">
                    {formatTime(gpsMetadata.waypoints[hoveredPoint].timestamp)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

GPSTrackViewer.propTypes = {
  gpsMetadata: PropTypes.object,
  compact: PropTypes.bool,
  onToggleView: PropTypes.func
};

export default GPSTrackViewer;
