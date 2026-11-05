import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, User, Activity } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const METRIC_OPTIONS = [
  { id: 'gxh', label: 'GxH (Gestiones por Hora)', isTime: false, unit: '' },
  { id: 'cxh', label: 'CxH (Cierres por Hora)', isTime: false, unit: '' },
  { id: 'pct_cierre', label: '% Cierre', isTime: false, unit: '%' },
  { id: 'resolucion', label: '% Resolución Neta', isTime: false, unit: '%' },
  { id: 'gestionados', label: 'Casos Gestionados', isTime: false, unit: '' },
  { id: 'cerrados', label: 'Casos Cerrados', isTime: false, unit: '' },
  { id: 'tmo_s', label: 'TMO Promedio (min)', isTime: 'min', unit: 'm' },
  { id: 'working_s', label: 'Tiempo de Trabajo (horas)', isTime: 'h', unit: 'h' },
  { id: 'login_s', label: 'Tiempo de Login (horas)', isTime: 'h', unit: 'h' },
  { id: 'break_s', label: 'Tiempo de Break (min)', isTime: 'min', unit: 'm' },
  { id: 'auxiliares_s', label: 'Auxiliares (min)', isTime: 'min', unit: 'm' },
  { id: 'service_fan', label: 'Service Fan', isTime: false, unit: '' }
];

export default function HistoricoChart({ allRecords }) {
  const [selectedAgent, setSelectedAgent] = useState('PROMEDIO_EQUIPO');
  const [selectedMetric, setSelectedMetric] = useState('gxh');

  // Obtener lista única de agentes ordenados alfabéticamente
  const agentList = useMemo(() => {
    const set = new Set();
    allRecords.forEach((r) => {
      if (r.agente && r.agente !== 'TOTAL EQUIPO') {
        set.add(r.agente);
      }
    });
    return Array.from(set).sort();
  }, [allRecords]);

  // Agrupar registros por Snapshot / Carga
  const snapshotsMap = useMemo(() => {
    // Mapa: `${fecha_hora_carga}_${intervalo}` -> lista de métricas
    const map = new Map();
    allRecords.forEach((r) => {
      const key = `${r.fecha_hora_carga || ''} | ${r.intervalo || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          fecha: r.fecha_hora_carga,
          intervalo: r.intervalo,
          records: []
        });
      }
      map.get(key).records.push(r);
    });

    // Ordenar cronológicamente (antiguos primero, recientes al final para evolución)
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const dateA = `${a.fecha} ${a.intervalo}`;
      const dateB = `${b.fecha} ${b.intervalo}`;
      return dateA.localeCompare(dateB);
    });

    return list;
  }, [allRecords]);

  const metricMeta = useMemo(() => {
    return METRIC_OPTIONS.find((m) => m.id === selectedMetric) || METRIC_OPTIONS[0];
  }, [selectedMetric]);

  // Construir datos del gráfico
  const chartData = useMemo(() => {
    const labels = snapshotsMap.map((s) => `${s.fecha ? s.fecha.split('T')[0] : ''} ${s.intervalo || ''}`);
    const dataPoints = snapshotsMap.map((s) => {
      if (selectedAgent === 'PROMEDIO_EQUIPO') {
        let total = 0;
        let count = 0;
        s.records.forEach((r) => {
          let val = r[selectedMetric];
          if (val !== null && val !== undefined && !isNaN(val)) {
            let num = parseFloat(val);
            if (metricMeta.isTime === 'h') num = num / 3600;
            else if (metricMeta.isTime === 'min') num = num / 60;
            total += num;
            count++;
          }
        });
        return count > 0 ? parseFloat((total / count).toFixed(2)) : null;
      } else {
        const row = s.records.find((r) => r.agente === selectedAgent);
        if (!row) return null;
        let val = row[selectedMetric];
        if (val === null || val === undefined || isNaN(val)) return null;
        let num = parseFloat(val);
        if (metricMeta.isTime === 'h') num = num / 3600;
        else if (metricMeta.isTime === 'min') num = num / 60;
        return parseFloat(num.toFixed(2));
      }
    });

    return {
      labels,
      datasets: [
        {
          label: `${selectedAgent === 'PROMEDIO_EQUIPO' ? 'Promedio del Equipo' : selectedAgent} - ${metricMeta.label}`,
          data: dataPoints,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: '#60a5fa',
          pointBorderColor: '#1d4ed8',
          borderWidth: 2
        }
      ]
    };
  }, [snapshotsMap, selectedAgent, selectedMetric, metricMeta]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#f4f4f5',
          font: { family: 'Inter, sans-serif', weight: '600', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#ffffff',
        bodyColor: '#e4e4e7',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context) => {
            const val = context.parsed.y;
            return ` ${metricMeta.label}: ${val}${metricMeta.unit}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#a1a1aa', font: { size: 11, family: 'monospace' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#a1a1aa', font: { size: 11, family: 'monospace' } }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Selector de Controles */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          background: 'var(--bg-card)',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid var(--border-light)',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px', flex: 1 }}>
          <User size={16} color="var(--primary)" />
          <div style={{ width: '100%' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '4px' }}>
              SELECCIONAR AGENTE
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              <option value="PROMEDIO_EQUIPO">📊 Promedio del Equipo (General)</option>
              {agentList.map((ag) => (
                <option key={ag} value={ag}>
                  👤 {ag}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px', flex: 1 }}>
          <Activity size={16} color="var(--accent-success)" />
          <div style={{ width: '100%' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '4px' }}>
              MÉTRICA A EVALUAR
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
        aria-label="Gráfico de evolución temporal de métricas de Pulso"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-bright)', textTransform: 'uppercase' }}>
              Evolución Temporal ({metricMeta.label})
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
            {snapshotsMap.length} Cargas Registradas
          </span>
        </div>

        <div style={{ height: '380px', width: '100%' }}>
          {snapshotsMap.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
              No hay cargas históricas guardadas aún.
            </div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
}

