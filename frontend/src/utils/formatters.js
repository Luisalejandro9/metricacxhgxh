/**
 * Funciones utilitarias de formateo de tiempo, fechas y marcas temporales.
 */

/**
 * Formatea una duración en segundos al formato "M:SS min" utilizado para TMO.
 * @param {number} seconds - Cantidad de segundos a formatear.
 * @returns {string} Cadena formateada (ej. "15:50 min").
 */
export const formatTmoMin = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00 min';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
};

/**
 * Convierte un total de segundos al formato de reloj "HH:MM:SS".
 * @param {number} totalSeconds - Segundos totales acumulados.
 * @returns {string} Hora formateada (ej. "02:15:09").
 */
export const formatTime = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

/**
 * Obtiene la fecha local en formato ISO corto "YYYY-MM-DD".
 * Evita desfases de zona horaria frente a toISOString().
 * @param {Date} [date=new Date()] - Fecha a formatear.
 * @returns {string} Fecha en formato YYYY-MM-DD.
 */
export const getTodayDateStr = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Formatea una marca de tiempo ISO a hora local legible (HH:MM:SS).
 * @param {string|number|Date} timestamp - Marca temporal a convertir.
 * @returns {string} Hora local o 'N/A' si es inválida.
 */
export const formatLastUpdated = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'N/A';
  }
};
