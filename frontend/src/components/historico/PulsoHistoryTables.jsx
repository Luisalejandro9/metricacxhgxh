import React, { useMemo } from 'react';

const cell = { padding: '10px 12px', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const header = { ...cell, textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', overflowX: 'auto', marginBottom: '18px' };
const fmt = (n, digits = 2) => Number.isFinite(Number(n)) ? Number(n).toFixed(digits) : '—';
const dateOf = (r) => String(r.fecha_hora_carga || '').split(/[T ]/)[0] || '—';
const netManaged = (r) => Math.max(0, (Number(r.gestionados) || 0) - (Number(r.transferidos) || 0));

export default function PulsoHistoryTables({ allRecords = [] }) {
  const data = useMemo(() => {
    const snapshots = new Map();
    allRecords.forEach((r) => {
      const key = String(r.snapshot_id || (String(r.fecha_hora_carga || '') + '|' + String(r.intervalo || '')));
      if (!snapshots.has(key)) snapshots.set(key, { key, fecha: r.fecha_hora_carga, intervalo: r.intervalo, records: [] });
      snapshots.get(key).records.push(r);
    });
    const ordered = [...snapshots.values()].sort((a, b) =>
      String(a.fecha || '').concat(' ', a.intervalo || '').localeCompare(String(b.fecha || '').concat(' ', b.intervalo || ''))
    );
    const daily = new Map();
    const agentDay = new Map();
    ordered.forEach((snapshot) => {
      const day = dateOf({ fecha_hora_carga: snapshot.fecha });
      const agents = snapshot.records.filter(r => r.agente && r.agente !== 'TOTAL EQUIPO');
      const managed = agents.reduce((s, r) => s + netManaged(r), 0);
      const closed = agents.reduce((s, r) => s + (Number(r.cerrados) || 0), 0);
      const discarded = agents.reduce((s, r) => s + (Number(r.descartados) || 0), 0);
      const working = agents.reduce((s, r) => s + (Number(r.working_s) || 0), 0);
      daily.set(snapshot.key, { ...snapshot, day, managed, closed, discarded, working });
      agents.forEach(r => agentDay.set(day + '|' + r.agente, { ...r, day, agente: r.agente }));
    });
    const byDay = new Map();
    [...agentDay.values()].forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
    });
    const running = new Map();
    const accumulated = [];
    [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([day, rows]) => {
      rows.forEach(r => {
        const prior = running.get(r.agente) || { managed: 0, closed: 0, discarded: 0, working: 0 };
        const next = {
          managed: prior.managed + netManaged(r),
          closed: prior.closed + (Number(r.cerrados) || 0),
          discarded: prior.discarded + (Number(r.descartados) || 0),
          working: prior.working + (Number(r.working_s) || 0)
        };
        running.set(r.agente, next);
        accumulated.push({ day, agente: r.agente, ...next });
      });
    });
    return { daily: [...daily.values()].reverse(), accumulated: accumulated.reverse() };
  }, [allRecords]);

  const table = (title, columns, rows, rowKey) => (
    <section style={card}>
      <div style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-bright)', borderBottom: '1px solid var(--border-light)' }}>{title} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({rows.length})</span></div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
        <thead><tr>{columns.map(c => <th key={c.label} style={header}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((r, i) => <tr key={rowKey(r, i)} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
          {columns.map(c => <td key={c.label} style={cell}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
        </tr>) : <tr><td colSpan={columns.length} style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No hay datos históricos guardados.</td></tr>}</tbody>
      </table>
    </section>
  );

  return <div>
    {table('Historial de registros Pulso', [
      { label: 'Fecha', key: 'day' }, { label: 'Intervalo', key: 'intervalo' },
      { label: 'Agentes', render: r => r.records.filter(x => x.agente && x.agente !== 'TOTAL EQUIPO').length },
      { label: 'Gestionados netos', render: r => r.managed }, { label: 'Cerrados', render: r => r.closed },
      { label: '% Cierre', render: r => r.managed ? fmt(r.closed / r.managed * 100) + '%' : '—' },
      { label: 'GxH equipo', render: r => r.working ? fmt(r.managed / (r.working / 3600)) : '—' }
    ], data.daily, r => r.key)}
    {table('Historial de acumulados Pulso por agente', [
      { label: 'Fecha', key: 'day' }, { label: 'Agente', key: 'agente' },
      { label: 'Gestionados netos acumulados', key: 'managed' }, { label: 'Cerrados acumulados', key: 'closed' },
      { label: '% Cierre acumulado', render: r => r.managed ? fmt(r.closed / r.managed * 100) + '%' : '—' },
      { label: '% Resolución neta acumulada', render: r => r.managed ? fmt((r.managed - r.discarded) / r.managed * 100) + '%' : '—' },
      { label: 'GxH acumulado', render: r => r.working ? fmt(r.managed / (r.working / 3600)) : '—' }
    ], data.accumulated, (r, i) => r.day + r.agente + i)}
  </div>;
}
