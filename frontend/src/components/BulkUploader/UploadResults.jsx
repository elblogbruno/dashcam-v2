import React from 'react'
import PropTypes from 'prop-types'
import { FaCheckCircle, FaTimesCircle, FaCalendarAlt } from 'react-icons/fa'

/**
 * Componente para mostrar el resumen de los resultados de carga
 */
const UploadResults = ({ uploadResults, isMobile = false }) => {
  if (uploadResults.length === 0) return null;

  const successCount = uploadResults.filter(r => r.success).length;
  const errorCount = uploadResults.filter(r => !r.success).length;

  return (
    <div className={`card ${isMobile ? 'p-4' : 'p-4'} mb-4 bg-white shadow-sm rounded-lg`}>
      <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-medium mb-4`}>Resultados de la Carga</h2>
      
      <div className="space-y-4">
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-3'} mb-4`}>
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-center">
            <div className="bg-green-100 text-green-600 rounded-full p-2 mr-3">
              <FaCheckCircle />
            </div>
            <div>
              <div className="font-medium text-green-800 text-sm">Subidos</div>
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
            </div>
          </div>
          
          {/* En móvil, solo mostrar el panel de errores si hay errores */}
          {(!isMobile || errorCount > 0) && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-center">
              <div className="bg-red-100 text-red-600 rounded-full p-2 mr-3">
                <FaTimesCircle />
              </div>
              <div>
                <div className="font-medium text-red-800 text-sm">Errores</div>
                <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              </div>
            </div>
          )}
        </div>
        
        {successCount > 0 && (
          <div className={`${isMobile ? 'text-sm' : 'text-center'} py-3 sm:py-3 bg-green-100 text-green-800 rounded-lg border border-green-200 px-4`}>
            <div className="flex items-center">
              <FaCalendarAlt className="mr-2 text-green-700" />
              <div>
                <div className="font-medium">Videos disponibles en Calendario</div>
                {!isMobile && (
                  <div className="text-sm mt-1">Navega a la sección Calendario para ver tus videos</div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {errorCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mt-4">
            <div className="font-medium text-yellow-800 mb-1 text-sm">Archivos con error:</div>
            <div className={`${isMobile ? 'max-h-24' : 'max-h-36'} overflow-y-auto`}>
              <ul className="list-disc pl-4 text-xs sm:text-sm text-gray-700 space-y-1">
                {uploadResults.filter(r => !r.success).map((result, index) => (
                  <li key={index} className="truncate">
                    <span className="font-medium">{result.file}</span>: {result.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

UploadResults.propTypes = {
  uploadResults: PropTypes.arrayOf(
    PropTypes.shape({
      file: PropTypes.string.isRequired,
      success: PropTypes.bool.isRequired,
      message: PropTypes.string.isRequired,
      date: PropTypes.string
    })
  ).isRequired,
  isMobile: PropTypes.bool
}

export default UploadResults
