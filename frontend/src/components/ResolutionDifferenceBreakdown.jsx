import React from 'react';

const DEFAULT_TIERS = [
  { min: 84.5, bonus: 3 },
  { min: 83.5, bonus: 2 },
  { min: 82.4, bonus: 1 },
  { min: 81.3, bonus: 0 },
  { min: 80.2, bonus: -1 },
  { min: 0, bonus: -2 }
];

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

// Misma escalera del ranking administrativo: piso 0%, luego 1%, 2% y techo 3%.
export const getResolutionBonusProgress = (managed, technicians, tiers = DEFAULT_TIERS) => {
  const total = Number(managed) || 0;
  const sent = Number(technicians) || 0;
  if (total <= 0) return null;

  const allTiers = [...(Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_TIERS)]
    .sort((a, b) => Number(b.min) - Number(a.min));
  const resolutionRate = ((total - sent) / total) * 100;
  const currentTier = allTiers.find(tier => resolutionRate >= Number(tier.min));
  const currentBonus = Number(currentTier?.bonus ?? allTiers[allTiers.length - 1]?.bonus ?? -2);

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
