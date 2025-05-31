import React from 'react'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import PropTypes from 'prop-types'

const Pagination = ({ 
  currentPage, 
  totalPages, 
  startIndex, 
  endIndex, 
  totalFiles, 
  onPageChange 
}) => {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
      <div className="text-sm text-gray-500">
        Mostrando {startIndex + 1}-{Math.min(endIndex, totalFiles)} de {totalFiles} archivos
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 
            rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaChevronLeft className="text-sm" />
        </button>
        
        <div className="flex space-x-1">
          {[...Array(totalPages)].map((_, i) => {
            const page = i + 1
            const isCurrentPage = page === currentPage
            
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  isCurrentPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            )
          })}
        </div>
        
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 
            rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaChevronRight className="text-sm" />
        </button>
      </div>
    </div>
  )
}

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  startIndex: PropTypes.number.isRequired,
  endIndex: PropTypes.number.isRequired,
  totalFiles: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired
}

export default Pagination
