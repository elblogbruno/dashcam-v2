import React from 'react';
import { 
  FaTrash, 
  FaCopy, 
  FaArrowRight,
  FaPaste,
  FaExternalLinkAlt
} from 'react-icons/fa';

const FileActions = ({ 
  selectedItem, 
  clipboard, 
  action,
  onDelete, 
  onCopy, 
  onMove, 
  onPaste,
  onIndex
}) => {
  const isDisabled = !selectedItem;
  const canPaste = clipboard && action;
  
  return (
    <div className="file-actions">
      <button 
        className="action-button" 
        onClick={onDelete} 
        disabled={isDisabled}
        title="Eliminar"
      >
        <FaTrash /> Eliminar
      </button>
      
      <button 
        className="action-button" 
        onClick={onCopy} 
        disabled={isDisabled}
        title="Copiar"
      >
        <FaCopy /> Copiar
      </button>
      
      <button 
        className="action-button" 
        onClick={onMove} 
        disabled={isDisabled}
        title="Mover"
      >
        <FaArrowRight /> Mover
      </button>
      
      <button 
        className="action-button" 
        onClick={onPaste} 
        disabled={!canPaste}
        title={`Pegar (${action === 'move' ? 'Mover' : 'Copiar'})`}
      >
        <FaPaste /> Pegar
      </button>
      
      {onIndex && (
        <button 
          className="action-button index-button" 
          onClick={onIndex} 
          disabled={!selectedItem || !selectedItem.is_video}
          title="Indexar video externo"
        >
          <FaExternalLinkAlt /> Indexar Video
        </button>
      )}
    </div>
  );
};

export default FileActions;
