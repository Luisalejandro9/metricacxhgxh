import React from 'react';
import { Search, RefreshCw, Activity, TrendingUp, History, ChevronRight, Calendar, UserX } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import DashboardCharts from '../dashboard/DashboardCharts';

function MonitorPanel({
  users,
  statsSummary,
  standards,
  metricsToday,
  trendChartData,
  unifiedHistory,
  setViewingUserDetails,
  isRefreshing,
  fetchData,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  handleResetToCurrentMonth,
  searchTerm,
  setSearchTerm,
  formatLastUpdated,
  getStatusClass,
  selectedUserEmail,
  excludedUserIds,
  clearExcludedUsers,
  chartHistory = [],
  theme = 'dark',
  chartScopeLabel = 'Global'
}) {
  const excludedUsersList = users.filter(u => excludedUserIds?.includes(u.id));

  return (
    <>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '26px', margin: 0, fontWeight: '700' }}>Panel de Monitoreo</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-success)' }}></span>
              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>TIEMPO REAL</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '13px' }}>
            {users.length} operadores registrados en la plataforma
          </p>
        </div>

        {/* CONTROLES DE FILTRO: RANGO DE FECHA Y BÚSQUEDA */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Filtro Rango de Fechas (Desde - Hasta) */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: '700' }}>DESDE</span>
              <input
                type="date"
                className="filter-input"
                style={{ height: '34px', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', border: '1px solid var(--border-strong)', background: 'var(--bg-main)', color: 'var(--text-bright)' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: '700' }}>HASTA</span>
              <input
                type="date"
                className="filter-input"
                style={{ height: '34px', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', border: '1px solid var(--border-strong)', background: 'var(--bg-main)', color: 'var(--text-bright)' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              title="Restablecer al mes actual"
              onClick={handleResetToCurrentMonth}
              style={{ height: '34px', alignSelf: 'flex-end', padding: '0 8px', fontSize: '10px', fontWeight: '700' }}
            >
              Mes Actual
            </button>
          </div>

          {/* Búsqueda por Operador */}
          <div style={{ position: 'relative', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Buscar operador..."
              className="filter-input"
              style={{ width: '100%', paddingLeft: '32px', height: '38px', borderRadius: '8px', fontSize: '11px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            title="Actualizar datos"
            style={{ height: '38px', width: '38px', padding: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* BANNER INFORMATIVO DE EXCLUSIÓN GLOBAL ACTIVA */}
      {selectedUserEmail === 'all' && excludedUserIds?.length > 0 && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.35)',
          borderRadius: '6px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserX size={15} style={{ color: 'var(--accent-warning)' }} />
            <span>
              <strong>Vista global filtrada:</strong> Se están excluyendo {excludedUserIds.length} {excludedUserIds.length === 1 ? 'perfil' : 'perfiles'} (
              {excludedUsersList.map(u => u.email).join(', ')}) del cálculo consolidado.
            </span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: '10px', fontWeight: '700' }}
            onClick={clearExcludedUsers}
          >
            Quitar Exclusión
          </button>
        </div>
      )}

      {/* TARJETAS DE RESUMEN */}
      <div className="grid-secondary" style={{ marginBottom: '24px' }}>
        <div className="metric-card">
          <span className="metric-label">Gestionados Acum.</span>
          <div className="metric-value medium">{statsSummary.totalManaged}</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Cerrados Acum.</span>
          <div className="metric-value medium">{statsSummary.totalClosed}</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">TCO Acum.</span>
          <div className="metric-value medium">{statsSummary.totalTechs}</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Cierre Promedio</span>
          <div className={`metric-value medium ${getStatusClass(statsSummary.avgEfficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}`}>
            {statsSummary.avgEfficiency}%
          </div>
        </div>
      </div>

      {/* MONITOR DE JORNADA ACTUAL */}
      <div className="metric-card" style={{ padding: '0', marginBottom: '24px', border: '1px solid var(--border-light)' }}>
        <div className="table-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={15} className="text-primary" />
            <span className="metric-label" style={{ margin: 0, color: 'var(--text-bright)' }}>Monitor de Jornada Actual</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sincronización en vivo</div>
        </div>
        <div className="table-container" style={{ maxHeight: '350px' }}>
          <table className="history-table admin-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: '20px' }}>Operador</th>
                <th>Gest.</th>
                <th>Cerr.</th>
                <th>TCO</th>
                <th>% Cierre</th>
                <th>Acum. Reso</th>
                <th>G/h</th>
                <th>Última Act.</th>
              </tr>
            </thead>
            <tbody>
              {metricsToday.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>No hay actividad registrada para la fecha actual.</td></tr>
              ) : metricsToday.map((item) => {
                const email = users.find(u => u.id === item.user_id)?.email || 'N/A';
                return (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'left', paddingLeft: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-bright)' }}>{email.split('@')[0]}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{email}</span>
                      </div>
                    </td>
                    <td>{item.cases_managed}</td>
                    <td>{item.cases_closed}</td>
                    <td>{item.technicians_sent}</td>
                    <td className={getStatusClass(item.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}>{item.efficiency}%</td>
                    <td className={getStatusClass(item.resolution_rate, standards.RESOLUTION_GREEN, standards.RESOLUTION_YELLOW)}>{item.resolution_rate}%</td>
                    <td className={getStatusClass(item.cases_per_hour, standards.GXH_GREEN, standards.GXH_YELLOW)}>{item.cases_per_hour}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{formatLastUpdated(item.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ANÁLISIS AVANZADO GLOBAL / POR OPERADOR */}
      <DashboardCharts
        history={chartHistory}
        standards={standards}
        theme={theme}
        scopeLabel={chartScopeLabel}
      />

      {/* TABLA HISTORIAL UNIFICADO */}
      <div className="metric-card" style={{ padding: '0' }}>
        <div className="table-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={15} className="text-secondary" />
            <span className="metric-label" style={{ margin: 0, color: 'var(--text-bright)' }}>Historial Unificado de Operadores</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Haz clic en un operador para ver su detalle</div>
        </div>
        <div className="table-container" style={{ maxHeight: '500px' }}>
          <table className="history-table admin-table clickable-rows">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: '20px' }}>Operador</th>
                <th>Días Reg.</th>
                <th>Total Gest.</th>
                <th>Total Cerr.</th>
                <th>% Cierre Med.</th>
                <th>% Reso Med.</th>
                <th>G/h Med.</th>
                <th>Dif. Cierre</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {unifiedHistory.length === 0 ? (
                <tr><td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>No hay registros para los filtros seleccionados.</td></tr>
              ) : unifiedHistory.map((u) => (
                <tr key={u.id} onClick={() => setViewingUserDetails(u)} style={{ cursor: 'pointer' }}>
                  <td style={{ textAlign: 'left', paddingLeft: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-bright)' }}>{u.email.split('@')[0]}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{u.email}</span>
                    </div>
                  </td>
                  <td>{u.recordsCount}</td>
                  <td style={{ fontWeight: '600' }}>{u.totalManaged}</td>
                  <td style={{ fontWeight: '600' }}>{u.totalClosed}</td>
                  <td className={getStatusClass(u.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}>{u.efficiency}%</td>
                  <td className={getStatusClass(u.resolution, standards.RESOLUTION_GREEN, standards.RESOLUTION_YELLOW)}>{u.resolution}%</td>
                  <td className={getStatusClass(u.avgGxh, standards.GXH_GREEN, standards.GXH_YELLOW)}>{u.avgGxh}</td>
                  <td style={{ fontWeight: '700', color: u.closingBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                    {u.closingBalance > 0 ? `+${u.closingBalance}` : u.closingBalance}
                  </td>
                  <td style={{ color: 'var(--primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', fontSize: '11px' }}>
                      Ver <ChevronRight size={13} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default MonitorPanel;
