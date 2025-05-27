/**
 * Utilidades para formateo de datos en la aplicación
 */

/**
 * Formatea bytes a una unidad de almacenamiento legible para humanos
 * @param {number} bytes - Cantidad de bytes a formatear
 * @param {number} decimals - Número de decimales a mostrar (por defecto 2)
 * @returns {string} - Representación legible de tamaño de almacenamiento
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Formatea una fecha en formato legible para humanos
 * @param {string|Date} date - Fecha a formatear
 * @param {boolean} includeTime - Si se debe incluir la hora
 * @returns {string} - Fecha formateada
 */
export function formatDate(date, includeTime = true) {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Fecha inválida';
  
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return d.toLocaleDateString('es-ES', options);
}

/**
 * Formatea un tiempo en segundos a formato hh:mm:ss
 * @param {number} seconds - Segundos a formatear
 * @returns {string} - Tiempo formateado
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');
  
  if (hours > 0) {
    return `${hours}:${formattedMinutes}:${formattedSeconds}`;
  }
  
  return `${formattedMinutes}:${formattedSeconds}`;
}

/**
 * Calcula y formatea el porcentaje
 * @param {number} part - Parte del total
 * @param {number} total - Valor total
 * @param {number} decimals - Número de decimales (por defecto 1)
 * @returns {string} - Porcentaje formateado con símbolo %
 */
export function formatPercentage(part, total, decimals = 1) {
  if (!part || !total || total === 0) return '0%';
  
  const percentage = (part / total) * 100;
  return percentage.toFixed(decimals) + '%';
}

/**
 * Formatea un número con separadores de miles
 * @param {number} num - Número a formatear
 * @returns {string} - Número formateado
 */
export function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString('es-ES');
}
