import React, { useState } from 'react';
import { format } from 'date-fns';
import { FaRegClock, FaMapMarkerAlt, FaDownload, FaVideo, FaChevronDown, FaChevronUp, FaRoute, FaGlobe } from 'react-icons/fa';
import PropTypes from 'prop-types';

const SelectedClipInfo = ({ selectedClip, getVideoUrl, isMobile = false, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  if (!selectedClip) {
    return null;
  }
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const formatClipTime = (timeStr) => {
    try {
      if (!timeStr) return '';
      return format(new Date(timeStr), 'HH:mm:ss');
    } catch (e) {
      return timeStr;
    }
  };

  // Función para extraer metadatos GPS del video
  const getGPSMetadata = () => {
    if (!selectedClip) return null;
    
    // Primero verificar si hay metadatos de GPS en el clip directamente
    if (selectedClip.start_lat && selectedClip.start_lon) {
      return {
        track: [
          {
            lat: selectedClip.start_lat,
            lon: selectedClip.start_lon,
            timestamp: selectedClip.start_time
          },
          {
            lat: selectedClip.end_lat || selectedClip.start_lat,
            lon: selectedClip.end_lon || selectedClip.start_lon,
            timestamp: selectedClip.end_time || selectedClip.start_time
          }
        ],
        total_distance: selectedClip.end_lat && selectedClip.end_lon ? 
          calculateDistance(selectedClip.start_lat, selectedClip.start_lon, selectedClip.end_lat, selectedClip.end_lon) : 0,
        point_count: selectedClip.end_lat && selectedClip.end_lon ? 2 : 1,
        bounds: {
          north: Math.max(selectedClip.start_lat, selectedClip.end_lat || selectedClip.start_lat),
          south: Math.min(selectedClip.start_lat, selectedClip.end_lat || selectedClip.start_lat),
          east: Math.max(selectedClip.start_lon, selectedClip.end_lon || selectedClip.start_lon),
          west: Math.min(selectedClip.start_lon, selectedClip.end_lon || selectedClip.start_lon)
        }
      };
    }
    
    // Fallback a metadatos embebidos si existen
    if (!selectedClip.metadata) return null;
    
    try {
      const metadata = typeof selectedClip.metadata === 'string' 
        ? JSON.parse(selectedClip.metadata) 
        : selectedClip.metadata;
      
      return metadata.gps_track || null;
    } catch (e) {
      console.error('Error parsing GPS metadata:', e);
      return null;
    }
  };

  // Función auxiliar para calcular distancia entre dos puntos GPS
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Función para formatear coordenadas GPS
  const formatCoordinate = (coord) => {
    if (typeof coord === 'number') {
      return coord.toFixed(6);
    }
    return coord || 'N/A';
  };

  const startTime = formatClipTime(selectedClip.start_time);
  const endTime = formatClipTime(selectedClip.end_time);
  const gpsMetadata = getGPSMetadata();

  return (
    <div className={`bg-[#2e3033] rounded-xl border border-white/10 m-3 overflow-hidden transition-all duration-300 flex-shrink-0 ${
      isCollapsed ? 'max-h-16 min-h-16' : 'max-h-fit'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-[#2e3033]">
        <h3 className="text-base font-semibold text-white m-0">Clip seleccionado</h3>
        <div className="flex gap-2 items-center">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCollapse();
            }} 
            className="bg-transparent border border-white/10 text-white/70 cursor-pointer p-2 rounded-md flex items-center justify-center transition-all duration-200 w-8 h-8 hover:text-white hover:bg-white/10 hover:border-[#3b82f6]"
            aria-label={isCollapsed ? "Expandir" : "Colapsar"}
          >
            {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className={`transition-all duration-300 overflow-y-auto flex flex-col ${
        isCollapsed ? 'max-h-0 p-0 opacity-0 overflow-hidden' : 'p-5 gap-4'
      }`}>
        {/* Información de tiempo */}
        <div className="flex items-start gap-3">
          <div className="text-[#3b82f6] text-base mt-0.5 flex-shrink-0">
            <FaRegClock />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Clip Details</div>
              {selectedClip.id && (
                <div className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-white/70">
                  ID: {selectedClip.id}
                </div>
              )}
            </div>
            <div className="font-medium text-white leading-relaxed p-2 bg-white/5 rounded-md border border-white/10">
              {startTime} - {endTime}
            </div>
            {selectedClip.duration && (
              <div className="text-xs text-white/70 mt-1.5">
                Duración: {Math.floor(selectedClip.duration / 60)}:{(selectedClip.duration % 60).toString().padStart(2, '0')} min
              </div>
            )}
          </div>
        </div>

        {/* Información GPS */}
        {(selectedClip.start_lat || gpsMetadata) && (
          <div className="flex items-start gap-3">
            <div className="text-green-500 text-base mt-0.5 flex-shrink-0">
              <FaGlobe />
            </div>
            <div className="flex-1">
              <div className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-2">Información GPS</div>
              
              {/* Coordenadas de inicio y fin */}
              {selectedClip.start_lat && selectedClip.start_lon && (
                <div className="space-y-2">
                  <div className="p-2 bg-white/5 rounded-md border border-white/10">
                    <div className="text-xs text-white/70 mb-1">Inicio:</div>
                    <div className="font-mono text-white text-sm">
                      {formatCoordinate(selectedClip.start_lat)}, {formatCoordinate(selectedClip.start_lon)}
                    </div>
                  </div>
                  
                  {selectedClip.end_lat && selectedClip.end_lon && (
                    <div className="p-2 bg-white/5 rounded-md border border-white/10">
                      <div className="text-xs text-white/70 mb-1">Fin:</div>
                      <div className="font-mono text-white text-sm">
                        {formatCoordinate(selectedClip.end_lat)}, {formatCoordinate(selectedClip.end_lon)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadatos de pista GPS */}
              {gpsMetadata && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <FaRoute />
                    <span>Pista GPS</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {gpsMetadata.total_distance && (
                      <div className="p-2 bg-white/5 rounded border border-white/10">
                        <div className="text-white/70">Distancia:</div>
                        <div className="text-white font-medium">
                          {gpsMetadata.total_distance < 1000 
                            ? `${Math.round(gpsMetadata.total_distance)}m`
                            : `${(gpsMetadata.total_distance / 1000).toFixed(2)}km`
                          }
                        </div>
                      </div>
                    )}
                    
                    {gpsMetadata.point_count && (
                      <div className="p-2 bg-white/5 rounded border border-white/10">
                        <div className="text-white/70">Puntos GPS:</div>
                        <div className="text-white font-medium">{gpsMetadata.point_count}</div>
                      </div>
                    )}
                  </div>

                  {gpsMetadata.bounds && (
                    <div className="p-2 bg-white/5 rounded border border-white/10">
                      <div className="text-white/70 text-xs mb-1">Límites de la ruta:</div>
                      <div className="font-mono text-white text-xs leading-relaxed">
                        N: {formatCoordinate(gpsMetadata.bounds.north)}<br />
                        S: {formatCoordinate(gpsMetadata.bounds.south)}<br />
                        E: {formatCoordinate(gpsMetadata.bounds.east)}<br />
                        W: {formatCoordinate(gpsMetadata.bounds.west)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Información de ubicación y geocodificación inversa */}
        {(selectedClip.landmark_id || selectedClip.location) && (
          <div className="flex items-start gap-3">
            <div className="text-red-500 text-base mt-0.5 flex-shrink-0">
              <FaMapMarkerAlt />
            </div>
            <div className="flex-1">
              <div className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-2">Ubicación</div>
              
              {/* Información de landmark si existe */}
              {selectedClip.landmark_id && (
                <div className="font-medium text-white leading-relaxed p-2 bg-white/5 rounded-md border border-white/10 mb-3">
                  {selectedClip.landmark_name || selectedClip.landmark_id}
                </div>
              )}
              
              {/* Información de geocodificación inversa */}
              {selectedClip.location && (() => {
                try {
                  const locationData = typeof selectedClip.location === 'string' 
                    ? JSON.parse(selectedClip.location) 
                    : selectedClip.location;
                  
                  return (
                    <div className="space-y-2">
                      {/* Dirección principal */}
                      {locationData.display_name && (
                        <div className="p-3 bg-blue-500/10 rounded-md border border-blue-500/20">
                          <div className="text-xs text-blue-300 mb-1 font-semibold">Dirección:</div>
                          <div className="text-white text-sm leading-relaxed">
                            {locationData.display_name}
                          </div>
                        </div>
                      )}
                      
                      {/* Detalles de ubicación */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {locationData.city && (
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <div className="text-white/70">Ciudad:</div>
                            <div className="text-white font-medium">{locationData.city}</div>
                          </div>
                        )}
                        
                        {locationData.town && (
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <div className="text-white/70">Municipio:</div>
                            <div className="text-white font-medium">{locationData.town}</div>
                          </div>
                        )}
                        
                        {locationData.village && (
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <div className="text-white/70">Pueblo:</div>
                            <div className="text-white font-medium">{locationData.village}</div>
                          </div>
                        )}
                        
                        {locationData.state && (
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <div className="text-white/70">Estado/Provincia:</div>
                            <div className="text-white font-medium">{locationData.state}</div>
                          </div>
                        )}
                        
                        {locationData.country && (
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <div className="text-white/70">País:</div>
                            <div className="text-white font-medium">
                              {locationData.country} {locationData.country_code && `(${locationData.country_code.toUpperCase()})`}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Timestamp de geocodificación */}
                      {locationData.timestamp && (
                        <div className="p-2 bg-white/5 rounded border border-white/10">
                          <div className="text-white/70 text-xs mb-1">Geocodificado:</div>
                          <div className="text-white font-mono text-xs">
                            {format(new Date(locationData.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } catch (e) {
                  console.error('Error parsing location data:', e);
                  return (
                    <div className="p-2 bg-red-500/20 rounded-md border border-red-500/30">
                      <div className="text-red-400 text-xs">Error al procesar datos de ubicación</div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}

        {/* Acciones de descarga */}
        <div className="border-t border-white/10 pt-4">
          <div className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-3">Acciones disponibles</div>
          <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-row flex-wrap'}`}>
            {selectedClip.road_video_file && getVideoUrl && (
              <a 
                href={getVideoUrl(selectedClip.road_video_file)} 
                download={`clip-exterior-${selectedClip.id || 'video'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-4 py-2.5 text-white rounded-md font-medium text-sm no-underline transition-opacity duration-200 min-h-9 justify-center bg-[#3b82f6] hover:opacity-80 ${
                  isMobile ? 'w-full' : 'flex-1 min-w-28'
                }`}
              >
                <FaDownload /> 
                <span>Exterior</span>
              </a>
            )}

            {selectedClip.interior_video_file && getVideoUrl && (
              <a 
                href={getVideoUrl(selectedClip.interior_video_file)} 
                download={`clip-interior-${selectedClip.id || 'video'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-4 py-2.5 text-white rounded-md font-medium text-sm no-underline transition-opacity duration-200 min-h-9 justify-center bg-[#10b981] hover:opacity-80 ${
                  isMobile ? 'w-full' : 'flex-1 min-w-28'
                }`}
              >
                <FaDownload /> 
                <span>Interior</span>
              </a>
            )}

            {(!selectedClip.road_video_file && !selectedClip.interior_video_file) && (
              <div className="text-sm italic p-2 rounded bg-white/5 text-white/70">
                No hay videos disponibles para descarga
              </div>
            )}

            {(selectedClip.road_video_file || selectedClip.interior_video_file) && !getVideoUrl && (
              <div className="text-sm italic p-2 rounded bg-red-500/20 text-red-400">
                Función de descarga no disponible
              </div>
            )}
            
            {isMobile && (
              <button 
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/10 text-white rounded-md text-sm cursor-pointer transition-colors duration-200 w-full justify-center mt-3 hover:bg-white/15"
                onClick={() => {
                  window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                  });
                }}
              >
                <FaVideo /> Ver video
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

SelectedClipInfo.propTypes = {
  selectedClip: PropTypes.object,
  getVideoUrl: PropTypes.func.isRequired,
  isMobile: PropTypes.bool,
  onClose: PropTypes.func
};

export default SelectedClipInfo;
