import React from 'react';
import { FaHome, FaExclamationTriangle } from 'react-icons/fa';

const PathBreadcrumb = ({ path, onNavigate }) => {
  // Si no hay ruta definida, mostrar un indicador de ruta no válida
  if (!path) {
    return (
      <div className="path-breadcrumb path-error">
        <FaExclamationTriangle /> Ruta no disponible
      </div>
    );
  }

  // Dividir la ruta en segmentos
  const segments = path.split('/').filter(Boolean);
  
  // Generar los elementos de la ruta
  const breadcrumbItems = segments.map((segment, index) => {
    // Construir la ruta para este segmento
    const currentPath = '/' + segments.slice(0, index + 1).join('/');
    
    return (
      <span key={currentPath}>
        <span className="breadcrumb-separator">/</span>
        <button 
          className="breadcrumb-button"
          onClick={() => onNavigate(currentPath)}
        >
          {segment}
        </button>
      </span>
    );
  });

  return (
    <div className="path-breadcrumb" data-testid="path-breadcrumb">
      <button 
        className="breadcrumb-button home"
        onClick={() => onNavigate('/')}
      >
        <FaHome />
      </button>
      {breadcrumbItems}
    </div>
  );
};

export default PathBreadcrumb;
