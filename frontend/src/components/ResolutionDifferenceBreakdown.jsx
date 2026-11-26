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

function ResolutionDifferenceBreakdown({ managed, technicians, tiers, compact = false }) {
  const items = getResolutionTierDifferences(managed, technicians, tiers);
  if (!items.length) return <span>Sin datos</span>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: compact ? '3px 8px' : '4px 10px', minWidth: compact ? 180 : 220 }}>
      {items.map(item => (
        <span key={item.bonus} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, whiteSpace: 'nowrap', fontSize: compact ? 10 : 11, color: item.difference > 0 ? 'var(--accent-success)' : item.difference < 0 ? 'var(--accent-error)' : 'var(--text-muted)' }}>
          <strong>{item.bonus > 0 ? '+' : ''}{item.bonus}%</strong>
          <span>{item.difference > 0 ? `+${item.difference}` : item.difference < 0 ? `Faltan ${Math.abs(item.difference)}` : 'Justo'}</span>
        </span>
      ))}
    </div>
  );
}

export default ResolutionDifferenceBreakdown;
