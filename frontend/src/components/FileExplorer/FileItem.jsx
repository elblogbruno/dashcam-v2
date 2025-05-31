import React from 'react';
import { 
  FaFolder, 
  FaFileVideo, 
  FaFile, 
  FaExternalLinkAlt,
  FaExclamationTriangle
} from 'react-icons/fa';
import { formatBytes } from '../../utils/formatUtils';

const FileItem = ({ item, selected, onClick }) => {
  // Manejar posibles formatos diferentes o campos faltantes en item
  const { 
    name, 
    is_directory, 
    size = 0, 
    modified, 
    is_video, 
    external,
    error
  } = item || {};
  
  // Determinar el icono adecuado según el tipo de archivo
  const getIcon = () => {
    if (error) return <FaExclamationTriangle className="file-icon error" title={error} />;
    if (is_directory) return <FaFolder className="file-icon folder" />;
    if (is_video) return <FaFileVideo className="file-icon video" />;
    return <FaFile className="file-icon" />;
  };

  return (
    <div 
      className={`file-item ${selected ? 'selected' : ''}`} 
      onClick={onClick}
      data-testid="file-item"
    >
      <div className="file-icon-container">
        {getIcon()}
        {external && <FaExternalLinkAlt className="external-indicator" title="Archivo externo" />}
      </div>
      <div className="file-details">
        <div className="file-name" style={{ color: 'var(--color-text-primary)' }}>
          {name || 'Sin nombre'}
        </div>
        <div className="file-info">
          {error ? (
            <span className="file-error" style={{ color: 'var(--color-error)' }}>
              {error}
            </span>
          ) : !is_directory ? (
            <>
              <span className="file-size" style={{ color: 'var(--color-text-secondary)' }}>
                {formatBytes(size)}
              </span>
              <span className="file-date" style={{ color: 'var(--color-text-secondary)' }}>
                {modified ? new Date(modified).toLocaleString() : 'Fecha desconocida'}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FileItem;
