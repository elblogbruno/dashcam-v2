import React from 'react';
import { FaTimes } from 'react-icons/fa';
import TripForm from './TripForm';

const TripFormModal = ({ isOpen, onClose, initialData, onSubmit }) => {
  if (!isOpen) return null;

  const handleSubmit = (tripData) => {
    onSubmit(tripData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        {/* Modal Content */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
              {initialData ? 'Edit Trip' : 'Plan New Trip'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 -m-2 touch-manipulation"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
          
          {/* Form Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            <TripForm
              initialData={initialData}
              onSubmit={handleSubmit}
              onCancel={onClose}
              hideHeader={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripFormModal;
