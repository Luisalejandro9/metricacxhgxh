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

  const colors = {
    positive: { color: 'var(--accent-success)', background: 'rgba(34, 197, 94, 0.08)' },
    negative: { color: 'var(--accent-error)', background: 'rgba(239, 68, 68, 0.07)' },
    neutral: { color: 'var(--text-muted)', background: 'var(--bg-main)' }
  };

  return (
    <div
      aria-label="Margen de técnicos para cada tramo de bonificación de resolución"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: compact ? 3 : 6,
        width: '100%',
        minWidth: compact ? 300 : 0,
        boxSizing: 'border-box'
      }}
    >
      {items.map(item => {
        const status = item.difference > 0 ? 'positive' : item.difference < 0 ? 'negative' : 'neutral';
        const value = item.difference > 0 ? `+${item.difference}` : item.difference < 0 ? `−${Math.abs(item.difference)}` : '0';
        const description = item.difference > 0 ? 'a favor' : item.difference < 0 ? 'faltan' : 'justo';
        return (
          <div
            key={item.bonus}
            title={`${item.bonus > 0 ? '+' : ''}${item.bonus}%: ${item.difference > 0 ? `${item.difference} a favor` : item.difference < 0 ? `faltan ${Math.abs(item.difference)}` : 'justo'}`}
            style={{
              ...colors[status],
              borderRadius: 6,
              padding: compact ? '5px 2px' : '8px 4px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: compact ? 3 : 5,
              textAlign: 'center',
              boxSizing: 'border-box'
            }}
          >
            <strong style={{ fontSize: compact ? 9 : 11, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              {item.bonus > 0 ? '+' : ''}{item.bonus}%
            </strong>
            <span style={{
              fontSize: compact ? 10 : 13,
              lineHeight: 1.15,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap'
            }}>
              {value}
            </span>
            <span style={{ fontSize: compact ? 7 : 9, lineHeight: 1.1, opacity: 0.8, whiteSpace: 'nowrap' }}>
              {description}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default ResolutionDifferenceBreakdown;
