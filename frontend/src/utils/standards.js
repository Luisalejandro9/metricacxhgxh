/**
 * Utilidades para el parseo de estándares, evaluación semafórica y cálculo de bonificaciones.
 */

import { DEFAULT_GXH_TIERS, DEFAULT_RESOLUTION_TIERS } from './constants';

/**
 * Transforma un registro de la tabla `app_config` de Supabase al objeto de estándares
 * usado por los componentes de React.
 * @param {Object} data - Fila obtenida desde `app_config`.
 * @returns {Object} Objeto normalizado de estándares y tramos de bonificación.
 */
export const parseStandardsFromConfig = (data) => ({
  GXH_GREEN: parseFloat(data.gxh_green),
  GXH_YELLOW: parseFloat(data.gxh_yellow),
  RESOLUTION_GREEN: parseFloat(data.resolution_green),
  RESOLUTION_YELLOW: parseFloat(data.resolution_yellow),
  CLOSED_GREEN: parseFloat(data.closed_green),
  CLOSED_YELLOW: parseFloat(data.closed_yellow),
  TIME_PER_CASE: parseInt(data.time_per_case, 10),
  TIME_PER_MANAGED: parseInt(data.time_per_managed, 10),
  gxh_bonus_tiers: Array.isArray(data.gxh_bonus_tiers) ? data.gxh_bonus_tiers : DEFAULT_GXH_TIERS,
  resolution_bonus_tiers: Array.isArray(data.resolution_bonus_tiers) ? data.resolution_bonus_tiers : DEFAULT_RESOLUTION_TIERS
});

/**
 * Devuelve la clase CSS del semáforo según el valor alcanzado y los umbrales objetivo.
 * @param {number|string} value - Valor actual de la métrica.
 * @param {number} greenTarget - Umbral mínimo para estado óptimo (verde).
 * @param {number} yellowTarget - Umbral mínimo para estado intermedio (amarillo).
 * @returns {string} Nombre de la clase CSS correspondiente.
 */
export const getStatusClass = (value, greenTarget, yellowTarget) => {
  const val = parseFloat(value);
  if (val >= greenTarget) return 'stat-meets-standard';
  if (val >= yellowTarget) return 'stat-warning-standard';
  return 'stat-below-standard';
};

/**
 * Resuelve la bonificación correspondiente a un valor numérico evaluado contra una lista de tramos.
 * @param {number|string} value - Valor numérico de la métrica (ej. GxH o % Resolución).
 * @param {Array<{min: number, bonus: number}>} tiers - Tramos configurados.
 * @param {Array<{min: number, bonus: number}>} fallbackTiers - Tramos por defecto si no hay configurados.
 * @returns {number} Porcentaje o puntaje de bonificación del tramo coincidente.
 */
export const resolveTierBonus = (value, tiers, fallbackTiers) => {
  const numericValue = parseFloat(value);
  const activeTiers = Array.isArray(tiers) ? tiers : fallbackTiers;
  const sorted = [...activeTiers].sort((a, b) => Number(b.min) - Number(a.min));
  const matched = sorted.find(t => numericValue >= Number(t.min));
  return parseFloat(matched?.bonus ?? sorted[sorted.length - 1]?.bonus ?? -2.0);
};
