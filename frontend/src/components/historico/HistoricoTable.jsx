import React, { useState, useMemo } from 'react';
import { Search, Users, ArrowUpDown } from 'lucide-react';

const formatSeconds = (sec) => {
  if (sec === null || sec === undefined || isNaN(sec)) return '--:--:--';
  const s = Math.max(0, parseInt(sec, 10));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remSec = s % 60;
  return [h, m, remSec].map((v) => v.toString().padStart(2, '0')).join(':');
};

export default function HistoricoTable({ records, lastSnapshotInfo }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('gxh');
  const [sortAsc, setSortAsc] = useState(false);

  // Escapar caracteres HTML para evitar XSS
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Pulso cuenta como gestión adicional los casos que el agente transfirió.
  // Para los indicadores calculados usamos la gestión neta, sin alterar los datos de Tracker.
  const getPulsoMetrics = (r) => {
    const gestionados = Math.max(0, (Number(r.gestionados) || 0) - (Number(r.transferidos) || 0));
    const cerrados = Number(r.cerrados) || 0;
    const descartados = Number(r.descartados) || 0;
    return {
      ...r,
      gestionados_corregidos: gestionados,
      pct_cierre_corregido: gestionados > 0 ? (cerrados / gestionados) * 100 : null,
      resolucion_corregida: gestionados > 0 ? ((gestionados - descartados) / gestionados) * 100 : null,
      gxh_corregido: Number(r.working_s) > 0 ? gestionados / (Number(r.working_s) / 3600) : (Number(r.gxh) || 0)
    };
  };

  // Filtrado y ordenación
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((r) => r.agente && r.agente.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = -999999;
      if (valB === null || valB === undefined) valB = -999999;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [records, searchTerm, sortField, sortAsc]);

  // Totales / Promedios del equipo
  const teamSummary = useMemo(() => {
    if (!records.length) return null;
    const count = records.length;
    let cerrados = 0;
    let gestionados = 0;
    let descartados = 0;
    let transferidos = 0;
    let finalizados = 0;
    let working = 0;
    let login = 0;
    let avail = 0;
    let breakTime = 0;
    let auxiliares = 0;
    let totalCxh = 0;
    let totalGxh = 0;
    let totalPctCierre = 0;
    let validResoCount = 0;
    let totalReso = 0;
    let serviceFan = 0;

    records.forEach((raw) => {
      const r = getPulsoMetrics(raw);
      cerrados += r.cerrados || 0;
      gestionados += r.gestionados_corregidos || 0;
      descartados += r.descartados || 0;
      transferidos += r.transferidos || 0;
      finalizados += r.finalizados || 0;
      working += r.working_s || 0;
      login += r.login_s || 0;
      avail += r.avail_s || 0;
      breakTime += r.break_s || 0;
      auxiliares += r.auxiliares_s || 0;
      totalCxh += parseFloat(r.cxh) || 0;
      totalGxh += parseFloat(r.gxh_corregido) || 0;
      totalPctCierre += parseFloat(r.pct_cierre_corregido) || 0;
      if (r.resolucion_corregida !== null && r.resolucion_corregida !== undefined) validResoCount++;
      serviceFan += r.service_fan || 0;
    });

    return {
      count,
      cerrados,
      gestionados,
      descartados,
      transferidos,
      finalizados,
      avgCxh: (totalCxh / count).toFixed(2),
      avgGxh: (totalGxh / count).toFixed(2),
      avgPctCierre: (gestionados > 0 ? (cerrados / gestionados) * 100 : 0).toFixed(1),
      working,
      login,
      avail,
      breakTime,
      auxiliares,
      avgReso: validResoCount > 0 ? (gestionados > 0 ? ((gestionados - descartados) / gestionados) * 100 : 0).toFixed(1) : '-',
      serviceFan
    };
  }, [records]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Barra de control: Buscador y conteo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-card)',
          padding: '12px 16px',
          borderRadius: '6px',
          border: '1px solid var(--border-light)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} color="var(--primary)" />
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-bright)', letterSpacing: '0.05em' }}>
            {records.length} AGENTES EN LA CARGA
          </span>
          {lastSnapshotInfo && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px' }}>
              Carga: <strong>{lastSnapshotInfo.fecha_hora_carga}</strong> ({lastSnapshotInfo.intervalo})
            </span>
          )}
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search
            size={14}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre de agente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-light)',
              borderRadius: '4px',
              color: 'var(--text-main)',
              fontSize: '12px'
            }}
          />
        </div>
      </div>

      {/* Tabla Principal */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          overflowX: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            fontFamily: 'var(--font-mono, monospace)',
            textAlign: 'right'
          }}
        >
          <thead>
            <tr
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '2px solid var(--border-light)',
                color: 'var(--text-muted)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              <th
                onClick={() => handleSort('agente')}
                style={{ textAlign: 'left', padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Agente</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('pct_cierre')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                % Cierre
              </th>
              <th onClick={() => handleSort('gxh')} style={{ padding: '12px 10px', cursor: 'pointer', color: 'var(--primary-light)' }}>
                GxH
              </th>
              <th onClick={() => handleSort('cxh')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                CxH
              </th>
              <th onClick={() => handleSort('gestionados')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Gest.
              </th>
              <th onClick={() => handleSort('cerrados')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Cerr.
              </th>
              <th onClick={() => handleSort('finalizados')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Fin.
              </th>
              <th onClick={() => handleSort('transferidos')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Transf.
              </th>
              <th onClick={() => handleSort('tmo_s')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                TMO
              </th>
              <th onClick={() => handleSort('working_s')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Working
              </th>
              <th onClick={() => handleSort('login_s')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Login
              </th>
              <th onClick={() => handleSort('avail_s')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Avail
              </th>
              <th onClick={() => handleSort('break_s')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Break
              </th>
              <th onClick={() => handleSort('auxiliares_s')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Auxiliares
              </th>
              <th onClick={() => handleSort('resolucion')} style={{ padding: '12px 10px', cursor: 'pointer' }}>
                Resol.
              </th>
              <th onClick={() => handleSort('service_fan')} style={{ padding: '12px 14px', cursor: 'pointer' }}>
                S. Fan
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedRecords.length === 0 ? (
              <tr>
                <td colSpan={16} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                  No se encontraron agentes para los criterios seleccionados.
                </td>
              </tr>
            ) : (
              filteredAndSortedRecords.map((raw, idx) => {
                const r = getPulsoMetrics(raw);
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={r.agente || idx}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: isEven ? 'transparent' : 'rgba(255,255,255,0.015)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        fontWeight: '700',
                        color: 'var(--text-bright)',
                        whiteSpace: 'nowrap'
                      }}
                      dangerouslySetInnerHTML={{ __html: escapeHtml(r.agente) }}
                    />
                    <td style={{ padding: '10px' }}>
                      {r.pct_cierre_corregido !== null ? `${r.pct_cierre_corregido.toFixed(1)}%` : '-'}
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        fontWeight: '800',
                        color: parseFloat(r.gxh_corregido) >= 4.0 ? 'var(--accent-success)' : parseFloat(r.gxh_corregido) >= 3.5 ? 'var(--accent-warning)' : 'var(--accent-error)'
                      }}
                    >
                      {r.gxh_corregido !== null ? parseFloat(r.gxh_corregido).toFixed(2) : '-'}
                    </td>
                    <td style={{ padding: '10px' }}>{r.cxh !== null ? parseFloat(r.cxh).toFixed(2) : '-'}</td>
                    <td style={{ padding: '10px' }}>{r.gestionados_corregidos ?? '-'}</td>
                    <td style={{ padding: '10px' }}>{r.cerrados ?? '-'}</td>
                    <td style={{ padding: '10px' }}>{r.finalizados ?? '-'}</td>
                    <td style={{ padding: '10px' }}>{r.transferidos ?? '-'}</td>
                    <td style={{ padding: '10px' }}>{formatSeconds(r.tmo_s)}</td>
                    <td style={{ padding: '10px' }}>{formatSeconds(r.working_s)}</td>
                    <td style={{ padding: '10px' }}>{formatSeconds(r.login_s)}</td>
                    <td style={{ padding: '10px' }}>{formatSeconds(r.avail_s)}</td>
                    <td style={{ padding: '10px', color: r.break_s > 3600 ? 'var(--accent-warning)' : 'inherit' }}>
                      {formatSeconds(r.break_s)}
                    </td>
                    <td style={{ padding: '10px' }}>{formatSeconds(r.auxiliares_s)}</td>
                    <td style={{ padding: '10px' }}>
                      {r.resolucion_corregida !== null && r.resolucion_corregida !== undefined ? `${parseFloat(r.resolucion_corregida).toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{r.service_fan ?? '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {/* Fila de Totales y Promedios del Equipo */}
          {teamSummary && (
            <tfoot>
              <tr
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderTop: '2px solid var(--primary)',
                  fontWeight: '800',
                  color: 'var(--text-bright)'
                }}
              >
                <td style={{ textAlign: 'left', padding: '12px 14px' }}>TOTAL / PROMEDIO EQUIPO</td>
                <td style={{ padding: '12px 10px' }}>{teamSummary.avgPctCierre}%</td>
                <td style={{ padding: '12px 10px', color: 'var(--primary-light)' }}>{teamSummary.avgGxh}</td>
                <td style={{ padding: '12px 10px' }}>{teamSummary.avgCxh}</td>
                <td style={{ padding: '12px 10px' }}>{teamSummary.gestionados}</td>
                <td style={{ padding: '12px 10px' }}>{teamSummary.cerrados}</td>
                <td style={{ padding: '12px 10px' }}>{teamSummary.finalizados}</td>
                <td style={{ padding: '12px 10px' }}>{teamSummary.transferidos}</td>
                <td style={{ padding: '12px 10px' }}>--:--:--</td>
                <td style={{ padding: '12px 10px' }}>{formatSeconds(teamSummary.working)}</td>
                <td style={{ padding: '12px 10px' }}>{formatSeconds(teamSummary.login)}</td>
                <td style={{ padding: '12px 10px' }}>{formatSeconds(teamSummary.avail)}</td>
                <td style={{ padding: '12px 10px' }}>{formatSeconds(teamSummary.breakTime)}</td>
                <td style={{ padding: '12px 10px' }}>{formatSeconds(teamSummary.auxiliares)}</td>
                <td style={{ padding: '12px 10px' }}>
                  {teamSummary.avgReso !== '-' ? `${teamSummary.avgReso}%` : '-'}
                </td>
                <td style={{ padding: '12px 14px' }}>{teamSummary.serviceFan}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

