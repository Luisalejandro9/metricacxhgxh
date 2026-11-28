/**
 * @fileoverview Utilidades y componente visual para calcular y mostrar el avance
 * hacia los escalones de bonificación por tasa de resolución (casos sin TCO).
 */
import React from 'react';

// Escala de bonificación por defecto (% mínimo de resolución -> % de bono)
const DEFAULT_TIERS = [
  { min: 84.5, bonus: 3 },
  { min: 83.5, bonus: 2 },
  { min: 82.4, bonus: 1 },
  { min: 81.3, bonus: 0 },
  { min: 80.2, bonus: -1 },
  { min: 0, bonus: -2 }
];

/**
 * Calcula la diferencia de casos resueltos respecto a cada escalón de bonificación.
 * @param {number|string} managed - Total de casos gestionados.
 * @param {number|string} technicians - Total de técnicos (TCO) enviados.
 * @param {Array<{min: number, bonus: number}>} [tiers=DEFAULT_TIERS] - Escalones configurados.
 * @returns {Array<{bonus: number, min: number, difference: number}>} Lista ordenada descendentemente por mínimo requerido.
 */
export const getResolutionTierDifferences = (managed, technicians, tiers = DEFAULT_TIERS) => {
  const total = Number(managed) || 0;
  const sent = Number(technicians) || 0;
  if (total <= 0) return [];

  const resolved = total - sent;
  return [...(Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_TIERS)]
    .sort((a, b) => Number(b.min) - Number(a.min))
    .map(tier => ({
      bonus: Number(tier.bonus),
      min: Number(tier.min),
      difference: resolved - Math.ceil(total * Number(tier.min) / 100)
    }));
};

/**
 * Calcula el progreso hacia el siguiente escalón positivo de bonificación por resolución
 * o el excedente si ya se alcanzó el techo del 3%.
 * Misma escalera del ranking administrativo: piso 0%, luego 1%, 2% y techo 3%.
 * @param {number|string} managed - Total de casos gestionados.
 * @param {number|string} technicians - Total de técnicos (TCO) enviados.
 * @param {Array<{min: number, bonus: number}>} [tiers=DEFAULT_TIERS] - Escalones configurados.
 * @returns {object|null} Resumen con bono actual, objetivo, diferencia, casos faltantes y etiqueta legible.
 */
export const getResolutionBonusProgress = (managed, technicians, tiers = DEFAULT_TIERS) => {
  const total = Number(managed) || 0;
  const sent = Number(technicians) || 0;
  if (total <= 0) return null;

  // Ordenar todos los escalones de mayor a menor exigencia para detectar el tramo actual
  const allTiers = [...(Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_TIERS)]
    .sort((a, b) => Number(b.min) - Number(a.min));
  const resolutionRate = ((total - sent) / total) * 100;
  const currentTier = allTiers.find(tier => resolutionRate >= Number(tier.min));
  const currentBonus = Number(currentTier?.bonus ?? allTiers[allTiers.length - 1]?.bonus ?? -2);

  // Filtrar escalones no negativos (0% a 3%) para definir la meta de progreso
  const positiveTiers = allTiers
    .filter(tier => Number(tier.bonus) >= 0 && Number(tier.bonus) <= 3)
    .sort((a, b) => Number(a.bonus) - Number(b.bonus));

  if (!positiveTiers.length) return null;

  const nextTier = positiveTiers.find(tier => Number(tier.bonus) > Math.max(0, currentBonus));
  const topTier = positiveTiers.reduce((highest, tier) =>
    !highest || Number(tier.bonus) > Number(highest.bonus) ? tier : highest, null);
  const progressTarget = currentBonus < 0
    ? positiveTiers.find(tier => Number(tier.bonus) === 0)
    : nextTier;

  const resolvedCases = total - sent;
  const difference = progressTarget
    ? resolvedCases - Math.ceil(total * Number(progressTarget.min) / 100)
    : topTier
      ? resolvedCases - Math.ceil(total * Number(topTier.min) / 100)
      : 0;

  // Los casos nuevos aumentan tanto el numerador como el denominador:
  // (resueltos + x) / (gestionados + x) >= objetivo.
  const targetRate = progressTarget ? Number(progressTarget.min) / 100 : null;
  const casesNeeded = targetRate !== null && targetRate < 1
    ? Math.max(0, Math.ceil((targetRate * total - resolvedCases) / (1 - targetRate)))
    : 0;

  return {
    currentBonus,
    targetBonus: progressTarget ? Number(progressTarget.bonus) : null,
    difference,
    casesNeeded,
    label: progressTarget
      ? `Faltan ${casesNeeded} casos sin TCO → ${Number(progressTarget.bonus).toFixed(0)}%`
      : `Sobrante ${Math.max(0, difference)}`
  };
};

/**
 * Insignia informativa que muestra cuántos casos sin TCO faltan para el próximo
 * escalón de resolución o el excedente acumulado al alcanzar el máximo.
 * @param {object} props
 * @param {number|string} props.managed - Casos gestionados.
 * @param {number|string} props.technicians - Técnicos enviados.
 * @param {Array<{min: number, bonus: number}>} [props.tiers] - Escalones de resolución.
 * @param {boolean} [props.compact=false] - Si true, reduce tamaño de fuente y padding.
 */
function ResolutionDifferenceBreakdown({ managed, technicians, tiers, compact = false }) {
  const progress = getResolutionBonusProgress(managed, technicians, tiers);
  if (!progress) return <span>Sin datos</span>;

  const isSurplus = progress.targetBonus === null;
  const color = isSurplus
    ? 'var(--accent-success)'
    : progress.difference < 0
      ? 'var(--accent-warning)'
      : 'var(--text-muted)';

  return (
    <span
      title={isSurplus
        ? 'Techo alcanzado: bonificación de resolución del 3%'
        : `Faltan ${progress.casesNeeded} casos gestionados sin TCO para llegar al ${progress.targetBonus}% de bonificación de resolución`}
      className={`resolution-progress-badge${compact ? ' compact' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        maxWidth: '100%',
        padding: compact ? '9px 12px' : '10px 13px',
        border: '1px solid var(--border-light)',
        borderRadius: 8,
        color,
        fontSize: compact ? 14 : 15,
        fontWeight: 800,
        lineHeight: 1.35,
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {progress.label}
    </span>
  );
}

export default ResolutionDifferenceBreakdown;
