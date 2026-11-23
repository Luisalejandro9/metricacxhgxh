import React, { useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const COLORS = {
  purple: 'rgba(99, 102, 241, 1)',
  purpleFill: 'rgba(99, 102, 241, 0.18)',
  green: 'rgba(16, 185, 129, 1)',
  greenFill: 'rgba(16, 185, 129, 0.12)',
  pink: 'rgba(236, 72, 153, 1)',
  pinkFill: 'rgba(236, 72, 153, 0.16)',
  yellow: 'rgba(234, 179, 8, 1)',
  yellowFill: 'rgba(234, 179, 8, 0.12)',
  cyan: 'rgba(14, 165, 233, 1)',
  cyanFill: 'rgba(14, 165, 233, 0.12)'
};

const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = value => {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date, amount) => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};
const startOfWeek = date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const timeSeconds = value => {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  const parts = value.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = (value, digits = 2) => num(value).toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pctChange = (current, previous) => previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100;

function summarize(rows) {
  const totals = rows.reduce((acc, row) => {
    const managed = num(row.cases_managed);
    const closed = num(row.cases_closed);
    const technicians = num(row.technicians_sent);
    const seconds = timeSeconds(row.total_time);
    acc.managed += managed;
    acc.closed += closed;
    acc.technicians += technicians;
    acc.seconds += seconds;
    acc.gxhWeighted += num(row.cases_per_hour) * (seconds > 0 ? seconds / 3600 : 0);
    acc.resolutionWeighted += num(row.resolution_rate) * managed;
    acc.tmoWeighted += num(row.tmo_managed) * managed;
    acc.days += 1;
    return acc;
  }, { managed: 0, closed: 0, technicians: 0, seconds: 0, gxhWeighted: 0, resolutionWeighted: 0, tmoWeighted: 0, days: 0 });
  const hours = totals.seconds / 3600;
  return {
    ...totals,
    gxh: hours > 0 ? totals.managed / hours : 0,
    tmo: totals.managed > 0 ? totals.tmoWeighted / totals.managed / 60 : 0,
    resolution: totals.managed > 0 ? totals.resolutionWeighted / totals.managed : 0,
    closeRate: totals.managed > 0 ? totals.closed / totals.managed * 100 : 0
  };
}

function aggregateRows(rows, grouping) {
  const groups = new Map();
  rows.forEach(row => {
    const date = parseDate(row.date);
    let key = row.date;
    let label = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
    if (grouping === 'weekly') {
      const start = startOfWeek(date);
      key = dateKey(start);
      label = `Sem. ${pad(start.getDate())}/${pad(start.getMonth() + 1)}`;
    } else if (grouping === 'monthly') {
      key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      label = date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
    }
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
    groups.get(key).rows.push(row);
  });
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(group => ({
    ...group,
    ...summarize(group.rows)
  }));
}

function MetricToggle({ checked, onChange, children }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{children}
  </label>;
}

function ChartCard({ title, subtitle, data, options, toggles, onToggle, empty }) {
  return <section style={{ marginTop: 18, padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
      <div>
        <h3 style={{ margin: '0 0 5px', color: 'var(--text-bright)', fontSize: 15 }}>{title}</h3>
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 11 }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{toggles}</div>
    </div>
    <div style={{ height: 290, width: '100%' }}>
      {empty ? <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-dim)', fontSize: 13 }}>No hay registros para este período</div> : <Line data={data} options={options} />}
    </div>
  </section>;
}

function DashboardCharts({ history = [], standards = {}, theme = 'dark', scopeLabel = '', dateRange = null, hideDateControls = false }) {
  const [initialDates] = useState(() => {
    const today = new Date();
    return {
      start: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: dateKey(today)
    };
  });
  const [preset, setPreset] = useState('month');
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [grouping, setGrouping] = useState('daily');
  const [compare, setCompare] = useState(true);
  const [show, setShow] = useState({
    gxhTmo: { a: true, b: true },
    resolution: { a: true, b: true },
    closed: { a: true, b: true }
  });

  const setPresetRange = value => {
    setPreset(value);
    const end = new Date();
    let start = new Date(end);
    if (value === '7d') start = addDays(end, -6);
    if (value === '30d') start = addDays(end, -29);
    if (value === 'month') start = new Date(end.getFullYear(), end.getMonth(), 1);
    setStartDate(dateKey(start));
    setEndDate(dateKey(end));
  };

  const effectiveStartDate = dateRange?.start || startDate;
  const effectiveEndDate = dateRange?.end || endDate;

  const range = useMemo(() => {
    const start = parseDate(effectiveStartDate);
    const end = parseDate(effectiveEndDate);
    const safeEnd = end < start ? start : end;
    const duration = Math.max(1, Math.round((safeEnd - start) / 86400000) + 1);
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(duration - 1));
    return { start, end: safeEnd, previousStart, previousEnd, duration };
  }, [effectiveStartDate, effectiveEndDate]);

  const inRange = (row, start, end) => {
    const date = parseDate(row.date);
    return date >= start && date <= end;
  };
  const currentRows = useMemo(() => history.filter(row => inRange(row, range.start, range.end)), [history, range]);
  const previousRows = useMemo(() => history.filter(row => inRange(row, range.previousStart, range.previousEnd)), [history, range]);
  const currentSummary = useMemo(() => summarize(currentRows), [currentRows]);
  const previousSummary = useMemo(() => summarize(previousRows), [previousRows]);
  const currentGroups = useMemo(() => aggregateRows(currentRows, grouping), [currentRows, grouping]);

  const chartBase = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { color: theme === 'light' ? '#334155' : '#e2e8f0', usePointStyle: true, boxWidth: 8, padding: 14, font: { family: 'Inter', size: 11, weight: '600' } } },
      tooltip: {
        backgroundColor: theme === 'light' ? 'rgba(255,255,255,.96)' : 'rgba(15,23,42,.96)',
        titleColor: theme === 'light' ? '#0f172a' : '#f8fafc',
        bodyColor: theme === 'light' ? '#334155' : '#cbd5e1',
        borderColor: theme === 'light' ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)',
        borderWidth: 1, padding: 10, usePointStyle: true
      }
    },
    scales: {
      x: { ticks: { color: theme === 'light' ? '#64748b' : '#94a3b8', maxRotation: 0, autoSkip: true }, grid: { color: theme === 'light' ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.05)' } },
      y: { type: 'linear', position: 'left', ticks: { color: COLORS.purple }, grid: { color: theme === 'light' ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.05)' } },
      y1: { type: 'linear', position: 'right', min: 0, ticks: { color: COLORS.cyan }, grid: { drawOnChartArea: false } }
    }
  };

  const makeDataset = (label, values, color, fill, axis = 'y', dashed = false) => ({
    label, data: values, borderColor: color, backgroundColor: fill, yAxisID: axis,
    tension: 0.32, cubicInterpolationMode: 'monotone', fill: !dashed,
    borderWidth: dashed ? 1.8 : 2.5, borderDash: dashed ? [6, 5] : [],
    pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 14
  });

  const targetLine = (length, value) => Array(length).fill(value);
  const labels = currentGroups.map(group => group.label);
  const gxhTarget = num(standards.GXH_GREEN) || 4;
  const resolutionTarget = num(standards.RESOLUTION_GREEN) || 84;
  const tmoTarget = (num(standards.TIME_PER_MANAGED) || 950) / 60;

  const chart1 = {
    labels,
    datasets: [
      ...(show.gxhTmo.a ? [makeDataset('GxH', currentGroups.map(g => g.gxh), COLORS.purple, COLORS.purpleFill)] : []),
      ...(show.gxhTmo.b ? [makeDataset('TMO (min)', currentGroups.map(g => g.tmo), COLORS.green, COLORS.greenFill, 'y1')] : []),
      ...(show.gxhTmo.a ? [makeDataset(`Objetivo GxH · ${fmt(gxhTarget)}`, targetLine(labels.length, gxhTarget), 'rgba(99,102,241,.75)', 'transparent', 'y', true)] : []),
      ...(show.gxhTmo.b ? [makeDataset(`Objetivo TMO · ${fmt(tmoTarget)} min`, targetLine(labels.length, tmoTarget), 'rgba(16,185,129,.8)', 'transparent', 'y1', true)] : []),
    ]
  };
  const chart2 = {
    labels,
    datasets: [
      ...(show.resolution.a ? [makeDataset('Resolución (%)', currentGroups.map(g => g.resolution), COLORS.pink, COLORS.pinkFill)] : []),
      ...(show.resolution.b ? [makeDataset('Técnicos enviados', currentGroups.map(g => g.technicians), COLORS.yellow, COLORS.yellowFill, 'y1')] : []),
      ...(show.resolution.a ? [makeDataset(`Objetivo resolución · ${fmt(resolutionTarget, 1)}%`, targetLine(labels.length, resolutionTarget), 'rgba(236,72,153,.8)', 'transparent', 'y', true)] : []),
    ]
  };
  const chart3 = {
    labels,
    datasets: [
      ...(show.closed.a ? [makeDataset('GxH', currentGroups.map(g => g.gxh), COLORS.purple, COLORS.purpleFill)] : []),
      ...(show.closed.b ? [makeDataset('Casos cerrados', currentGroups.map(g => g.closed), COLORS.cyan, COLORS.cyanFill, 'y1')] : []),
      ...(show.closed.a ? [makeDataset(`Objetivo GxH · ${fmt(gxhTarget)}`, targetLine(labels.length, gxhTarget), 'rgba(99,102,241,.75)', 'transparent', 'y', true)] : []),
    ]
  };

  const optionsFor = (rightTitle, leftTitle) => ({
    ...chartBase,
    scales: {
      ...chartBase.scales,
      x: { ...chartBase.scales.x, title: { display: true, text: grouping === 'daily' ? 'FECHA' : grouping === 'weekly' ? 'SEMANA' : 'MES', color: theme === 'light' ? '#64748b' : '#94a3b8' } },
      y: { ...chartBase.scales.y, title: { display: true, text: leftTitle, color: theme === 'light' ? '#64748b' : '#94a3b8' } },
      y1: { ...chartBase.scales.y1, title: { display: true, text: rightTitle, color: theme === 'light' ? '#64748b' : '#94a3b8' } }
    }
  });

  const deltaLabel = (current, previous, inverse = false) => {
    const delta = pctChange(current, previous);
    if (delta === null) return 'Sin base comparable';
    const favorable = inverse ? delta <= 0 : delta >= 0;
    return `${delta > 0 ? '+' : ''}${fmt(delta, 1)}% vs período anterior`;
  };
  const kpis = [
    { label: 'GxH promedio', value: fmt(currentSummary.gxh), delta: deltaLabel(currentSummary.gxh, previousSummary.gxh), good: currentSummary.gxh >= previousSummary.gxh },
    { label: 'TMO promedio', value: `${fmt(currentSummary.tmo)} min`, delta: deltaLabel(currentSummary.tmo, previousSummary.tmo, true), good: currentSummary.tmo <= previousSummary.tmo },
    { label: 'Resolución', value: `${fmt(currentSummary.resolution, 1)}%`, delta: deltaLabel(currentSummary.resolution, previousSummary.resolution), good: currentSummary.resolution >= previousSummary.resolution },
    { label: 'Casos cerrados', value: String(currentSummary.closed), delta: deltaLabel(currentSummary.closed, previousSummary.closed), good: currentSummary.closed >= previousSummary.closed }
  ];

  const dailyMap = useMemo(() => new Map(currentRows.map(row => [row.date, row])), [currentRows]);
  const heatDays = useMemo(() => {
    const days = [];
    for (let d = new Date(range.start); d <= range.end; d = addDays(d, 1)) days.push({ date: dateKey(d), row: dailyMap.get(dateKey(d)) });
    return days;
  }, [range, dailyMap]);
  const maxGxh = Math.max(1, ...heatDays.map(day => num(day.row?.cases_per_hour)));
  const weekdayStats = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, day) => ({ day, label: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day], rows: [] }));
    currentRows.forEach(row => buckets[parseDate(row.date).getDay()].rows.push(row));
    return buckets.map(bucket => ({ ...bucket, ...summarize(bucket.rows) }));
  }, [currentRows]);

  const updateToggle = (key, axis, value) => setShow(prev => ({ ...prev, [key]: { ...prev[key], [axis]: value } }));
  const selectStyle = { background: 'var(--bg-card)', color: 'var(--text-bright)', border: '1px solid var(--border-light)', borderRadius: 7, padding: '8px 10px', fontSize: 12 };
  const cardStyle = { padding: 14, borderRadius: 10, border: '1px solid var(--border-light)', background: 'var(--bg-card)' };

  return <div style={{ marginTop: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
      <div>
        <h2 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 18 }}>Análisis de productividad{scopeLabel ? ` · ${scopeLabel}` : ''}</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 11 }}>Tendencias y objetivos de productividad</p>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-dim)', fontSize: 12 }}>
        <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Comparar con período anterior
      </label>
    </div>

    <div style={{ ...cardStyle, display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
      {!hideDateControls && <>
              <label style={{ display: 'grid', gap: 5, color: 'var(--text-dim)', fontSize: 11 }}>PERÍODO
                <select style={selectStyle} value={preset} onChange={e => setPresetRange(e.target.value)}>
                  <option value="month">Este mes</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="custom">Personalizado</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5, color: 'var(--text-dim)', fontSize: 11 }}>DESDE
                <input style={selectStyle} type="date" value={startDate} onChange={e => { setPreset('custom'); setStartDate(e.target.value); }} />
              </label>
              <label style={{ display: 'grid', gap: 5, color: 'var(--text-dim)', fontSize: 11 }}>HASTA
                <input style={selectStyle} type="date" value={endDate} min={startDate} onChange={e => { setPreset('custom'); setEndDate(e.target.value); }} />
              </label>
      </>}
      <label style={{ display: 'grid', gap: 5, color: 'var(--text-dim)', fontSize: 11 }}>AGRUPAR POR
        <select style={selectStyle} value={grouping} onChange={e => setGrouping(e.target.value)}>
          <option value="daily">Día</option><option value="weekly">Semana</option><option value="monthly">Mes</option>
        </select>
      </label>
      <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 'auto' }}>{currentRows.length} registros en el período seleccionado</span>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
      {kpis.map(kpi => <div key={kpi.label} style={cardStyle}>
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 8 }}>{kpi.label}</div>
        <div style={{ color: 'var(--text-bright)', fontSize: 24, fontWeight: 750, letterSpacing: '-.03em' }}>{kpi.value}</div>
        <div style={{ color: compare ? (kpi.good ? '#10b981' : '#ef4444') : 'var(--text-dim)', fontSize: 10, marginTop: 6 }}>{compare ? kpi.delta : 'Período seleccionado'}</div>
      </div>)}
    </div>

    <ChartCard title="Tendencia del período · GxH vs TMO" subtitle="Eje X: tiempo · Eje Y izquierdo: gestiones por hora · Eje Y derecho: TMO en minutos" data={chart1} options={optionsFor('TMO (min)', 'GxH')} empty={!currentGroups.length} toggles={<><MetricToggle checked={show.gxhTmo.a} onChange={v => updateToggle('gxhTmo', 'a', v)}>GxH</MetricToggle><MetricToggle checked={show.gxhTmo.b} onChange={v => updateToggle('gxhTmo', 'b', v)}>TMO</MetricToggle></>} />
    <ChartCard title="Tendencia · Resolución vs Técnicos" subtitle="Eje X: tiempo · Eje Y izquierdo: resolución (%) · Eje Y derecho: técnicos enviados" data={chart2} options={optionsFor('Técnicos', 'Resolución (%)')} empty={!currentGroups.length} toggles={<><MetricToggle checked={show.resolution.a} onChange={v => updateToggle('resolution', 'a', v)}>Resolución</MetricToggle><MetricToggle checked={show.resolution.b} onChange={v => updateToggle('resolution', 'b', v)}>Técnicos</MetricToggle></>} />
    <ChartCard title="Tendencia · GxH vs Casos Cerrados" subtitle="Eje X: tiempo · Eje Y izquierdo: gestiones por hora · Eje Y derecho: casos cerrados" data={chart3} options={optionsFor('Casos cerrados', 'GxH')} empty={!currentGroups.length} toggles={<><MetricToggle checked={show.closed.a} onChange={v => updateToggle('closed', 'a', v)}>GxH</MetricToggle><MetricToggle checked={show.closed.b} onChange={v => updateToggle('closed', 'b', v)}>Cerrados</MetricToggle></>} />

    <section style={{ ...cardStyle, marginTop: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 15 }}>Mapa de calor de productividad</h3>
        <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 11 }}>Intensidad según GxH diario. Sin color indica que no hay registro.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: 6 }}>
        {heatDays.map(day => {
          const value = num(day.row?.cases_per_hour);
          const intensity = day.row ? Math.max(.12, Math.min(.95, value / maxGxh)) : 0;
          return <div key={day.date} title={day.row ? `${day.date} · GxH ${fmt(value)} · ${num(day.row.cases_closed)} cerrados` : `${day.date} · Sin registro`} style={{ minHeight: 48, borderRadius: 7, display: 'grid', placeItems: 'center', background: day.row ? `rgba(16,185,129,${intensity})` : 'var(--bg-app)', border: '1px solid var(--border-light)', color: day.row && intensity > .55 ? '#052e24' : 'var(--text-dim)', fontSize: 11, fontWeight: 650 }}>
            {parseDate(day.date).getDate()}
          </div>;
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: 10, marginTop: 10 }}><span>Menor GxH</span><span>Mayor GxH</span></div>
    </section>

    <section style={{ ...cardStyle, marginTop: 18 }}>
      <h3 style={{ margin: '0 0 5px', color: 'var(--text-bright)', fontSize: 15 }}>Rendimiento por día de la semana</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-dim)', fontSize: 11 }}>Promedios ponderados según los registros del período seleccionado.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540, fontSize: 12 }}>
          <thead><tr style={{ color: 'var(--text-dim)', textAlign: 'left' }}>{['Día', 'Registros', 'GxH promedio', 'Resolución', 'Cerrados'].map(label => <th key={label} style={{ padding: '9px 8px', borderBottom: '1px solid var(--border-light)' }}>{label}</th>)}</tr></thead>
          <tbody>{weekdayStats.map(day => <tr key={day.day} style={{ color: 'var(--text-bright)' }}>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.label}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.rows.length}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>{day.rows.length ? fmt(day.gxh) : '—'}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.rows.length ? `${fmt(day.resolution, 1)}%` : '—'}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.rows.length ? day.closed : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

export default DashboardCharts;
