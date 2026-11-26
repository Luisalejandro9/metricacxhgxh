import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
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

function DashboardCharts({ history = [], standards = {}, theme = 'dark', scopeLabel = '', dateRange = null, hideDateControls = false, calculateRecordBonus = () => 0 }) {
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
  const [heatMetric, setHeatMetric] = useState('gxh');
  const [selectedWeekday, setSelectedWeekday] = useState(null);
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
  // Reproduce the monthly accumulated-bonus calculation used by the dashboard:
  // cumulative managed / cumulative hours and cumulative net resolution, reset each month.
  const monthlyBonusSeries = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const monthState = new Map();
    const lastBonusByDate = new Map();
    sorted.forEach(row => {
      const month = row.date.slice(0, 7);
      const state = monthState.get(month) || { managed: 0, technicians: 0, seconds: 0 };
      state.managed += num(row.cases_managed);
      state.technicians += num(row.technicians_sent);
      state.seconds += timeSeconds(row.total_time);
      const hours = state.seconds / 3600;
      const accumulatedGxh = hours > 0 ? state.managed / hours : 0;
      const accumulatedResolution = state.managed > 0
        ? ((state.managed - state.technicians) / state.managed) * 100
        : 0;
      state.bonus = calculateRecordBonus(accumulatedGxh, accumulatedResolution);
      monthState.set(month, state);
      lastBonusByDate.set(row.date, state.bonus);
    });
    return [...lastBonusByDate.entries()]
      .filter(([date]) => date >= dateKey(range.start) && date <= dateKey(range.end))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bonus]) => ({ date, bonus }));
  }, [history, calculateRecordBonus, range]);
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

  const bonusLabels = monthlyBonusSeries.map(item => {
    const date = parseDate(item.date);
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  });
  const bonusAreaChart = {
    labels: bonusLabels,
    datasets: [{
      label: 'Bono acumulado del mes (%)',
      data: monthlyBonusSeries.map(item => item.bonus),
      borderColor: context => {
        const value = context?.p1?.parsed?.y ?? context?.p0?.parsed?.y ?? 0;
        return value < 0 ? 'rgba(239, 68, 68, 1)' : COLORS.green;
      },
      backgroundColor: context => {
        const value = context?.p1?.parsed?.y ?? context?.p0?.parsed?.y ?? 0;
        return value < 0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)';
      },
      segment: {
        borderColor: context => {
          const midpoint = ((context.p0.parsed.y || 0) + (context.p1.parsed.y || 0)) / 2;
          return midpoint < 0 ? 'rgba(239, 68, 68, 1)' : COLORS.green;
        }
      },
      fill: { target: { value: 0 }, above: 'rgba(16, 185, 129, 0.18)', below: 'rgba(239, 68, 68, 0.18)' },
      tension: 0.32,
      cubicInterpolationMode: 'monotone',
      borderWidth: 2.5,
      pointRadius: 2,
      pointHoverRadius: 5
    }]
  };
  const bonusAreaOptions = {
    ...chartBase,
    plugins: {
      ...chartBase.plugins,
      legend: { ...chartBase.plugins.legend, display: true }
    },
    scales: {
      ...chartBase.scales,
      x: { ...chartBase.scales.x, title: { display: true, text: 'FECHA', color: theme === 'light' ? '#64748b' : '#94a3b8' } },
      y: { ...chartBase.scales.y, title: { display: true, text: 'BONIFICACIÓN ACUMULADA (%)', color: theme === 'light' ? '#64748b' : '#94a3b8' } },
      y1: { display: false }
    }
  };

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

  const fmtCompact = (value, digits = 2) => num(value).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
  const signedValue = (value, digits = 2) => `${value > 0 ? '+' : ''}${fmtCompact(value, digits)}`;
  const deltaLabel = (current, previous, unit, digits = 2) => {
    const absoluteDelta = current - previous;
    const percentDelta = pctChange(current, previous);
    const absoluteText = `${signedValue(absoluteDelta, digits)} ${unit}`;
    const percentText = percentDelta === null
      ? 'sin base porcentual'
      : `${signedValue(percentDelta, 1)}% vs período anterior`;
    return `${absoluteText} · ${percentText}`;
  };
  const kpis = [
    { label: 'GxH promedio', value: fmt(currentSummary.gxh), delta: deltaLabel(currentSummary.gxh, previousSummary.gxh, 'GxH', 2), good: currentSummary.gxh >= previousSummary.gxh },
    { label: 'TMO promedio', value: `${fmt(currentSummary.tmo)} min`, delta: deltaLabel(currentSummary.tmo, previousSummary.tmo, 'min', 2), good: currentSummary.tmo <= previousSummary.tmo },
    { label: 'Resolución', value: `${fmt(currentSummary.resolution, 1)}%`, delta: deltaLabel(currentSummary.resolution, previousSummary.resolution, 'p.p.', 2), good: currentSummary.resolution >= previousSummary.resolution },
    { label: 'Casos cerrados', value: String(currentSummary.closed), delta: deltaLabel(currentSummary.closed, previousSummary.closed, 'casos', 0), good: currentSummary.closed >= previousSummary.closed }
  ];

  const dailyMap = useMemo(() => {
    const byDate = new Map();
    currentRows.forEach(row => {
      if (!byDate.has(row.date)) byDate.set(row.date, []);
      byDate.get(row.date).push(row);
    });
    return new Map([...byDate.entries()].map(([date, rows]) => {
      const summary = summarize(rows);
      return [date, {
        cases_per_hour: summary.gxh,
        cases_closed: summary.closed,
        cases_managed: summary.managed,
        close_rate: summary.closeRate,
        resolution_rate: summary.resolution
      }];
    }));
  }, [currentRows]);
  const heatDays = useMemo(() => {
    const days = [];
    for (let d = new Date(range.start); d <= range.end; d = addDays(d, 1)) days.push({ date: dateKey(d), row: dailyMap.get(dateKey(d)) });
    return days;
  }, [range, dailyMap]);
  const heatMetricConfig = {
    gxh: { label: 'GxH', field: 'cases_per_hour', target: gxhTarget, unit: '' },
    closeRate: { label: 'Cierre %', field: 'close_rate', target: num(standards.CLOSE_RATE_GREEN) || 80, unit: '%' },
    resolution: { label: 'Resolución', field: 'resolution_rate', target: resolutionTarget, unit: '%' }
  };
  const selectedHeatMetric = heatMetricConfig[heatMetric];
  const maxHeatValue = Math.max(1, ...heatDays.map(day => num(day.row?.[selectedHeatMetric.field])));
  const heatMetricFormat = value => `${fmt(value, 2)}${selectedHeatMetric.unit}`;
  const heatThreshold80 = selectedHeatMetric.target * 0.8;
  const heatThreshold100 = selectedHeatMetric.target;
  const weekdayStats = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, day) => ({ day, label: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day], rows: [] }));
    currentRows.forEach(row => buckets[parseDate(row.date).getDay()].rows.push(row));
    return buckets.map(bucket => {
      const totals = summarize(bucket.rows);
      const records = bucket.rows.length;
      return {
        ...bucket,
        ...totals,
        avgManaged: records ? totals.managed / records : 0,
        avgClosed: records ? totals.closed / records : 0
      };
    });
  }, [currentRows]);

  const weekdayDateGroups = useMemo(() => {
    if (!selectedWeekday) return [];
    const grouped = new Map();
    selectedWeekday.rows.forEach(row => {
      if (!grouped.has(row.date)) grouped.set(row.date, []);
      grouped.get(row.date).push(row);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({ date, rows, ...summarize(rows) }));
  }, [selectedWeekday]);

  const weekdayInsights = useMemo(() => {
    const activeDays = weekdayStats.filter(day => day.rows.length > 0 && day.managed > 0);
    if (!activeDays.length) return { insights: [], note: 'Todavía no hay datos suficientes para analizar el rendimiento.' };

    // Para comparar rendimiento, exigimos una muestra mínima y un volumen razonable.
    // Así, un único turno excepcional no convierte automáticamente a un día en el mejor.
    const sortedVolumes = activeDays.map(day => day.managed).sort((a, b) => a - b);
    const middle = Math.floor(sortedVolumes.length / 2);
    const medianManaged = sortedVolumes.length % 2
      ? sortedVolumes[middle]
      : (sortedVolumes[middle - 1] + sortedVolumes[middle]) / 2;
    const minManaged = Math.max(10, medianManaged * 0.5);
    const representativeDays = activeDays.filter(day => day.rows.length >= 2 && day.managed >= minManaged);
    const topBy = (days, field) => [...days].sort((a, b) => b[field] - a[field])[0];

    const mostManaged = topBy(activeDays, 'managed');
    const mostClosed = topBy(activeDays, 'closed');
    const insights = [
      {
        title: 'Mayor volumen gestionado',
        text: `${mostManaged.label} concentra ${fmtCompact(mostManaged.managed, 0)} casos gestionados en ${mostManaged.rows.length} registros.`
      },
      {
        title: 'Mayor cantidad de cierres',
        text: `${mostClosed.label} acumula ${fmtCompact(mostClosed.closed, 0)} casos cerrados en ${mostClosed.rows.length} registros.`
      }
    ];

    if (representativeDays.length >= 2) {
      const bestClosedAverage = topBy(representativeDays, 'avgClosed');
      const bestGxh = topBy(representativeDays, 'gxh');
      const bestResolution = topBy(representativeDays, 'resolution');
      insights.push(
        {
          title: 'Mejor promedio de cierres (muestra válida)',
          text: `${bestClosedAverage.label} promedia ${fmtCompact(bestClosedAverage.avgClosed, 2)} cierres por registro, con ${fmtCompact(bestClosedAverage.managed, 0)} casos gestionados.`
        },
        {
          title: 'Mejor productividad (muestra válida)',
          text: `${bestGxh.label} alcanza ${fmt(bestGxh.gxh)} GxH con ${fmtCompact(bestGxh.managed, 0)} casos gestionados.`
        },
        {
          title: 'Mayor resolución (muestra válida)',
          text: `${bestResolution.label} registra ${fmt(bestResolution.resolution, 1)}% de resolución sobre ${fmtCompact(bestResolution.managed, 0)} casos gestionados.`
        }
      );
    } else {
      insights.push({
        title: 'Comparación de rendimiento',
        text: 'Todavía no hay al menos dos días con volumen y cantidad de registros suficientes para comparar métricas de forma confiable.'
      });
    }

    const excludedDays = activeDays.filter(day => !representativeDays.includes(day));
    const note = `Los rankings de rendimiento consideran días con al menos 2 registros y ${fmtCompact(minManaged, 0)} casos gestionados (50% de la mediana diaria como mínimo). ${excludedDays.length ? `Se excluyen del ranking: ${excludedDays.map(day => `${day.label} (${day.rows.length} registro/s, ${fmtCompact(day.managed, 0)} gestionados)`).join('; ')}.` : 'Todos los días con actividad cumplen el mínimo de muestra.'}`;
    return { insights, note };
  }, [weekdayStats]);

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

    <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
      <details style={{ ...cardStyle, padding: 0 }}>
        <summary style={{ cursor: 'pointer', padding: '14px 16px', color: 'var(--text-bright)', fontSize: 13, fontWeight: 750 }}>Bono acumulado del mes · Evolución diaria</summary>
        <div style={{ padding: '0 14px 14px' }}>
          <ChartCard title="BONO ACUM. MES" subtitle="Evolución diaria del porcentaje acumulado, reiniciado al comenzar cada mes." data={bonusAreaChart} options={bonusAreaOptions} empty={!monthlyBonusSeries.length} />
        </div>
      </details>
      <details style={{ ...cardStyle, padding: 0 }}>
        <summary style={{ cursor: 'pointer', padding: '14px 16px', color: 'var(--text-bright)', fontSize: 13, fontWeight: 750 }}>GxH vs TMO</summary>
        <div style={{ padding: '0 14px 14px' }}>
          <ChartCard title="Tendencia del período · GxH vs TMO" subtitle="Eje X: tiempo · Eje Y izquierdo: gestiones por hora · Eje Y derecho: TMO en minutos" data={chart1} options={optionsFor('TMO (min)', 'GxH')} empty={!currentGroups.length} toggles={<><MetricToggle checked={show.gxhTmo.a} onChange={v => updateToggle('gxhTmo', 'a', v)}>GxH</MetricToggle><MetricToggle checked={show.gxhTmo.b} onChange={v => updateToggle('gxhTmo', 'b', v)}>TMO</MetricToggle></>} />
        </div>
      </details>
      <details style={{ ...cardStyle, padding: 0 }}>
        <summary style={{ cursor: 'pointer', padding: '14px 16px', color: 'var(--text-bright)', fontSize: 13, fontWeight: 750 }}>Resolución vs Técnicos</summary>
        <div style={{ padding: '0 14px 14px' }}>
          <ChartCard title="Tendencia · Resolución vs Técnicos" subtitle="Eje X: tiempo · Eje Y izquierdo: resolución (%) · Eje Y derecho: técnicos enviados" data={chart2} options={optionsFor('Técnicos', 'Resolución (%)')} empty={!currentGroups.length} toggles={<><MetricToggle checked={show.resolution.a} onChange={v => updateToggle('resolution', 'a', v)}>Resolución</MetricToggle><MetricToggle checked={show.resolution.b} onChange={v => updateToggle('resolution', 'b', v)}>Técnicos</MetricToggle></>} />
        </div>
      </details>
      <details style={{ ...cardStyle, padding: 0 }}>
        <summary style={{ cursor: 'pointer', padding: '14px 16px', color: 'var(--text-bright)', fontSize: 13, fontWeight: 750 }}>GxH vs Casos Cerrados</summary>
        <div style={{ padding: '0 14px 14px' }}>
          <ChartCard title="Tendencia · GxH vs Casos Cerrados" subtitle="Eje X: tiempo · Eje Y izquierdo: gestiones por hora · Eje Y derecho: casos cerrados" data={chart3} options={optionsFor('Casos cerrados', 'GxH')} empty={!currentGroups.length} toggles={<><MetricToggle checked={show.closed.a} onChange={v => updateToggle('closed', 'a', v)}>GxH</MetricToggle><MetricToggle checked={show.closed.b} onChange={v => updateToggle('closed', 'b', v)}>Cerrados</MetricToggle></>} />
        </div>
      </details>
    </div>

    <section style={{ ...cardStyle, marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 15 }}>Mapa de calor de productividad</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 11 }}>Visualiza el desempeño diario según el indicador seleccionado.</p>
        </div>
        <label style={{ display: 'grid', gap: 4, color: 'var(--text-dim)', fontSize: 10 }}>
          INDICADOR
          <select value={heatMetric} onChange={e => setHeatMetric(e.target.value)} style={selectStyle}>
            <option value="gxh">GxH</option>
            <option value="closeRate">Cierre %</option>
            <option value="resolution">Resolución %</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: 6 }}>
        {heatDays.map(day => {
          const value = num(day.row?.[selectedHeatMetric.field]);
          const hasData = Boolean(day.row) && (heatMetric === 'gxh' ? num(day.row.cases_managed) > 0 : num(day.row.cases_managed) > 0);
          const target = selectedHeatMetric.target;
          const targetRatio = target > 0 ? value / target : 0;
          const intensity = hasData ? Math.max(.12, Math.min(.95, value / maxHeatValue)) : 0;
          const traffic = targetRatio < 0.8
            ? { color: '239,68,68', text: '#fff1f2', label: 'Bajo objetivo' }
            : targetRatio < 1
              ? { color: '234,179,8', text: '#422006', label: 'Cerca del objetivo' }
              : { color: '34,197,94', text: '#052e16', label: 'Objetivo alcanzado' };
          const alpha = 0.35 + intensity * 0.55;
          return <div key={day.date} title={hasData ? `${day.date} · ${selectedHeatMetric.label}: ${fmt(value)}${selectedHeatMetric.unit} · ${num(day.row.cases_managed)} gestionados · ${num(day.row.cases_closed)} cerrados · ${traffic.label} (${fmt(targetRatio * 100, 0)}% del objetivo)` : `${day.date} · Sin registro`} style={{ minHeight: 48, borderRadius: 7, display: 'grid', placeItems: 'center', background: hasData ? `rgba(${traffic.color},${alpha})` : 'var(--bg-app)', border: '1px solid var(--border-light)', color: hasData ? traffic.text : 'var(--text-dim)', fontSize: 11, fontWeight: 650 }}>
            {parseDate(day.date).getDate()}
          </div>;
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, color: 'var(--text-dim)', fontSize: 10, marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', flexShrink: 0 }} />
          {'Menos de ' + heatMetricFormat(heatThreshold80) + ' (80% del objetivo)'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#eab308', flexShrink: 0 }} />
          {heatMetricFormat(heatThreshold80) + ' a menos de ' + heatMetricFormat(heatThreshold100)}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e', flexShrink: 0 }} />
          {heatMetricFormat(heatThreshold100) + ' o más (objetivo alcanzado)'}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>
          Objetivo de {selectedHeatMetric.label}: {heatMetricFormat(selectedHeatMetric.target)}
        </span>
      </div>
    </section>

    <section style={{ ...cardStyle, marginTop: 18 }}>
      <h3 style={{ margin: '0 0 5px', color: 'var(--text-bright)', fontSize: 15 }}>Rendimiento por día de la semana</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-dim)', fontSize: 11 }}>Totales y promedios calculados sobre los registros del período seleccionado.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 12 }}>
          <thead><tr style={{ color: 'var(--text-dim)', textAlign: 'left' }}>{['Día', 'Registros', 'Técnicos enviados', 'Gestionados', 'GxH promedio', 'Resolución', 'Cerrados', 'Detalle'].map(label => <th key={label} style={{ padding: '9px 8px', borderBottom: '1px solid var(--border-light)' }}>{label}</th>)}</tr></thead>
          <tbody>{weekdayStats.map(day => <tr key={day.day} style={{ color: 'var(--text-bright)' }}>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.label}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.rows.length}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>{day.rows.length ? fmtCompact(day.technicians, 0) : '—'}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>{day.rows.length ? fmtCompact(day.managed, 0) : '—'}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>{day.rows.length ? fmt(day.gxh) : '—'}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.rows.length ? `${fmt(day.resolution, 1)}%` : '—'}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}>{day.rows.length ? fmtCompact(day.closed, 0) : '—'}</td>
            <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-light)' }}><button type="button" disabled={!day.rows.length} onClick={() => setSelectedWeekday(day)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-light)', background: day.rows.length ? 'var(--bg-app)' : 'transparent', color: day.rows.length ? 'var(--text-bright)' : 'var(--text-dim)', cursor: day.rows.length ? 'pointer' : 'not-allowed', fontSize: 11, opacity: day.rows.length ? 1 : .5 }}>Ver detalle</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    {selectedWeekday && <div role="presentation" onClick={e => { if (e.target === e.currentTarget) setSelectedWeekday(null); }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.68)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="weekday-detail-title" style={{ width: 'min(900px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div><h3 id="weekday-detail-title" style={{ margin: 0, color: 'var(--text-bright)', fontSize: 17 }}>Detalle de {selectedWeekday.label}</h3><p style={{ margin: '5px 0 0', color: 'var(--text-dim)', fontSize: 11 }}>Fechas individuales incluidas en el período seleccionado</p></div>
          <button type="button" onClick={() => setSelectedWeekday(null)} aria-label="Cerrar detalle" style={{ border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-bright)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer' }}>Cerrar ✕</button>
        </div>
        {weekdayDateGroups.map(group => {
          const date = parseDate(group.date);
          const dateLabel = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
          return <div key={group.date} style={{ border: '1px solid var(--border-light)', borderRadius: 9, padding: 13, marginBottom: 10, background: 'var(--bg-app)' }}>
            <h4 style={{ margin: '0 0 10px', color: 'var(--text-bright)', fontSize: 13, textTransform: 'capitalize' }}>{dateLabel}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 8 }}>
              {[['Registros', group.rows.length], ['Técnicos enviados', fmtCompact(group.technicians, 0)], ['Gestionados', fmtCompact(group.managed, 0)], ['GxH promedio', fmt(group.gxh)], ['Resolución', `${fmt(group.resolution, 1)}%`], ['Cerrados', fmtCompact(group.closed, 0)], ['TMO promedio', `${fmt(group.tmo)} min`], ['Tiempo total', `${(group.seconds / 3600).toLocaleString('es-AR', { maximumFractionDigits: 2 })} h`]].map(([label, value]) => <div key={label} style={{ padding: 9, borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}><div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{label}</div><div style={{ color: 'var(--text-bright)', fontWeight: 700, fontSize: 14, marginTop: 4 }}>{value}</div></div>)}
            </div>
          </div>;
        })}
        {!weekdayDateGroups.length && <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>No hay registros para este día.</p>}
      </section>
    </div>}

    <section style={{ ...cardStyle, marginTop: 14, border: '1px solid rgba(99,102,241,.28)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <Sparkles size={16} style={{ color: '#a5b4fc' }} />
        <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 15 }}>Indicadores inteligentes</h3>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-dim)', letterSpacing: '.05em' }}>ANÁLISIS AUTOMÁTICO</span>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--text-dim)', fontSize: 11 }}>Conclusiones generadas a partir de los datos registrados y los filtros actuales.</p>
      {weekdayInsights.insights.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9 }}>
          {weekdayInsights.insights.map(insight => (
            <div key={insight.title} style={{ padding: 11, borderRadius: 8, background: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 10, marginBottom: 5, fontWeight: 700 }}>{insight.title}</div>
              <div style={{ color: 'var(--text-bright)', fontSize: 12, lineHeight: 1.5 }}>{insight.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>Todavía no hay datos suficientes para generar conclusiones.</div>
      )}
      <p style={{ margin: '10px 0 0', color: 'var(--text-dim)', fontSize: 10, lineHeight: 1.5 }}>{weekdayInsights.note}</p>
    </section>
  </div>;
}

export default DashboardCharts;
