import React from 'react';
import { 
  FaHdd, 
  FaExternalLinkAlt, 
  FaSync, 
  FaExclamationTriangle 
} from 'react-icons/fa';

const DiskInfoStatus = ({ disks, selectedDisk, onRefresh }) => {
  // Asegurarse de que disks sea un objeto y proporcionar valores predeterminados completos
  const disksObj = disks || {};
  const { 
    internal = { mountPoint: '/mnt/dashcam_storage', mounted: false, total: 0, used: 0, free: 0 }, 
    external = [] 
  } = disksObj;
  
  // Función para mostrar el espacio libre
  const formatDiskSpace = (disk) => {
    if (!disk || !disk.total || typeof disk.total !== 'number' || 
        typeof disk.used !== 'number' || typeof disk.free !== 'number') {
      return 'No disponible';
    }
    
    try {
      const usedPercent = ((disk.used / Math.max(disk.total, 1)) * 100).toFixed(1);
      const totalGB = (disk.total / (1024 * 1024 * 1024)).toFixed(1);
      const freeGB = (disk.free / (1024 * 1024 * 1024)).toFixed(1);
      
      return `${freeGB}GB libre de ${totalGB}GB (${usedPercent}% usado)`;
    } catch (err) {
      console.error('Error formateando información del disco:', err);
      return 'Error en formato';
    }
  };

  return (
    <div className="disk-info-status">
      <div className={`disk-item ${selectedDisk === 'internal' ? 'selected' : ''}`}>
        <div className="disk-icon">
          <FaHdd />
        </div>
        <div className="disk-details">
          <div className="disk-title">Disco Interno</div>
          <div className="disk-space">
            {internal?.mounted ? (
              formatDiskSpace(internal)
            ) : (
              <span className="disk-not-available">
                <FaExclamationTriangle /> No montado
              </span>
            )}
          </div>
        </div>
      </div>

      {external.length > 0 && external.map((ext, index) => (
        <div 
          key={ext.device || index} 
          className={`disk-item ${selectedDisk === 'external' ? 'selected' : ''}`}
        >
          <div className="disk-icon">
            <FaExternalLinkAlt />
          </div>
          <div className="disk-details">
            <div className="disk-title">
              {ext.label || ext.model || `Disco Externo ${ext.device ? `(${ext.device})` : ''}`}
            </div>
            <div className="disk-space">
              {ext.mounted ? (
                formatDiskSpace(ext)
              ) : (
                <span className="disk-not-available">
                  <FaExclamationTriangle /> No montado
                </span>
              )}
            </div>
          </div>
        </div>
      ))}

      <button 
        className="refresh-button" 
        onClick={onRefresh} 
        title="Actualizar información de discos"
      >
        <FaSync />
      </button>
    </div>
  );
};

export default DiskInfoStatus;
