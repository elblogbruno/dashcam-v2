import React from 'react';
import { FaTrash, FaArchive, FaChartBar, FaVideo, FaCalendarAlt, FaHdd } from 'react-icons/fa';
import { Card, Button } from '../common/UI';
import { Grid, Flex } from '../common/Layout';

function VideoStatsPanel({ videoStats, actionLoading, formatBytes, onCleanup, onArchive }) {
  // Formatear la fecha en español
  const formatDateES = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  return (
    <Card className="p-3">
      {/* Encabezado simplificado */}
      <Flex alignItems="center" className="mb-3">
        <FaChartBar className="text-primary-600 text-sm mr-2" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Estadísticas de Videos</h2>
          <p className="text-xs text-gray-600">Resumen del almacenamiento</p>
        </div>
      </Flex>

      {/* Estadísticas principales */}
      <Grid cols={1} gap={3} className="sm:grid-cols-3 mb-3">
        <Flex alignItems="center" gap={2}>
          <div className="bg-primary-500 p-1.5 rounded text-white">
            <FaVideo className="text-xs" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Videos</p>
            <p className="text-sm font-semibold text-gray-900">{videoStats.totalVideos || 0}</p>
          </div>
        </Flex>

        <Flex alignItems="center" gap={2}>
          <div className="bg-primary-500 p-1.5 rounded text-white">
            <FaHdd className="text-xs" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Tamaño</p>
            <p className="text-sm font-semibold text-gray-900">{formatBytes(videoStats.totalSize || 0)}</p>
          </div>
        </Flex>

        <Flex alignItems="center" gap={2}>
          <div className="bg-primary-500 p-1.5 rounded text-white">
            <FaCalendarAlt className="text-xs" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Rango</p>
            <p className="text-xs font-medium text-gray-900 break-words">
              {formatDateES(videoStats.oldestVideo)} - {formatDateES(videoStats.newestVideo)}
            </p>
          </div>
        </Flex>
      </Grid>

      {/* Acciones con separador */}
      <div className="border-t border-gray-100 pt-3">
        <Flex direction="col" gap={2} className="sm:flex-row">
          <Button
            onClick={() => onCleanup(30)}
            disabled={actionLoading}
            variant="warning"
            size="sm"
            className="w-full sm:w-auto text-xs"
          >
            <FaTrash className="text-xs mr-1" /> 
            Limpiar (30+ días)
          </Button>
          
          <Button
            onClick={onArchive}
            disabled={actionLoading}
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto text-xs"
          >
            <FaArchive className="text-xs mr-1" /> 
            Archivar
          </Button>
        </Flex>
      </div>

      {/* Distribución mensual con separador */}
      {videoStats.byMonth && videoStats.byMonth.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Distribución por Mes</h4>
          <div className="space-y-1">
            {videoStats.byMonth.slice(0, 4).map((month, index) => (
              <Flex key={index} justifyContent="between" alignItems="center" className="py-1 px-2 border border-gray-100 rounded text-xs">
                <span className="font-medium text-gray-900">{month.month}</span>
                <div className="text-right">
                  <span className="text-gray-600">{month.count} videos</span>
                  <br />
                  <span className="text-gray-500">{formatBytes(month.size)}</span>
                </div>
              </Flex>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default VideoStatsPanel;
