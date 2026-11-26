import React, { useState } from 'react';

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

const formatBonus = bonus => `${bonus > 0 ? '+' : ''}${bonus}%`;

const getDifferenceLabel = difference => {
  if (difference > 0) return `+${difference} a favor`;
  if (difference < 0) return `Faltan ${Math.abs(difference)}`;
  return 'Justo';
};

function ResolutionDifferenceBreakdown({ managed, technicians, tiers, compact = false }) {
  const items = getResolutionTierDifferences(managed, technicians, tiers);
  const zeroIndex = items.findIndex(item => item.bonus === 0);
  const [selectedBonus, setSelectedBonus] = useState(0);
  const [menu, setMenu] = useState(null);

  if (!items.length) return <span>Sin datos</span>;

  const selected = items.find(item => item.bonus === selectedBonus) || items[zeroIndex] || items[0];
  const isNegative = selected.difference < 0;
  const isPositive = selected.difference > 0;

  const openMenu = event => {
    if (menu) {
      setMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = Math.min(items.length * 46 + 12, 300);
    const top = rect.bottom + menuHeight + 8 <= window.innerHeight
      ? rect.bottom + 4
      : Math.max(8, rect.top - menuHeight - 4);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - 228);
    setMenu({ top, left });
  };

  return (
    <div style={{ display: 'inline-flex', position: 'relative', maxWidth: '100%' }}>
      <button
        type="button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        title="Seleccionar objetivo de bonificación de resolución"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minWidth: compact ? 112 : 142,
          maxWidth: '100%',
          padding: compact ? '6px 8px' : '8px 10px',
          border: '1px solid var(--border-light)',
          borderRadius: 7,
          background: 'var(--bg-card)',
          color: isNegative ? 'var(--accent-error)' : isPositive ? 'var(--accent-success)' : 'var(--text-muted)',
          fontSize: compact ? 11 : 12,
          fontWeight: 800,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        <span>{formatBonus(selected.bonus)}</span>
        <span>{getDifferenceLabel(selected.difference)}</span>
        <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.65 }}>▾</span>
      </button>

      {menu && (
        <>
          <button
            type="button"
            aria-label="Cerrar selector de objetivo"
            onClick={() => setMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent', border: 0, padding: 0, cursor: 'default' }}
          />
          <div
            role="menu"
            aria-label="Elegir objetivo de resolución"
            style={{
              position: 'fixed',
              top: menu.top,
              left: menu.left,
              zIndex: 9999,
              width: 220,
              maxHeight: 300,
              overflowY: 'auto',
              padding: 5,
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              background: 'var(--bg-card)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.24)'
            }}
          >
            <div style={{ padding: '7px 9px 8px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, letterSpacing: '.06em' }}>
              ELEGÍ TU OBJETIVO
            </div>
            {items.map(item => {
              const active = item.bonus === selected.bonus;
              const color = item.difference < 0
                ? 'var(--accent-error)'
                : item.difference > 0
                  ? 'var(--accent-success)'
                  : 'var(--text-muted)';
              return (
                <button
                  key={item.bonus}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSelectedBonus(item.bonus);
                    setMenu(null);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 9px',
                    border: 0,
                    borderRadius: 6,
                    background: active ? 'var(--bg-main)' : 'transparent',
                    color: 'var(--text-bright)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: active ? 800 : 600 }}>
                    <span style={{ color: 'var(--primary-light)', minWidth: 30 }}>{formatBonus(item.bonus)}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Objetivo</span>
                  </span>
                  <strong style={{ color, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {getDifferenceLabel(item.difference)}
                  </strong>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default ResolutionDifferenceBreakdown;
