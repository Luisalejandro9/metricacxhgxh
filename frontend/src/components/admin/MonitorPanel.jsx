import React from 'react';
import { Search, RefreshCw, Activity, TrendingUp, History, ChevronRight } from 'lucide-react';
import { Line } from 'react-chartjs-2';

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
  selectedMonth,
  setSelectedMonth,
  searchTerm,
  setSearchTerm,
  formatLastUpdated,
  getStatusClass
}) {
  return (
    <>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2 style={{ fontSize: '32px', margin: 0 }}>Admin Panel</h2>
            <div className="live-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div className="pulse-dot"></div>
              <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-error)', letterSpacing: '0.1em' }}>EN VIVO</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Gestionando {users.length} operadores activos</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', maxWidth: '650px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 'bold' }}>MES DE CONSULTA</span>
            <input type="month" className="filter-input" style={{ height: '45px', borderRadius: '12px' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </div>
          <div style={{ position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 'bold' }}>BUSCAR OPERADOR</span>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input type="text" placeholder="Filtrar por operador..." className="filter-input" style={{ width: '100%', paddingLeft: '40px', height: '45px', borderRadius: '12px' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'transparent' }}>REFRESH</span>
            <button className="btn btn-secondary" onClick={() => fetchData(true)} disabled={isRefreshing} style={{ height: '45px', width: '45px', padding: 0, borderRadius: '12px' }}>
              <RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid-secondary" style={{ marginBottom: '30px' }}>
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

      {/* MONITOR JORNADA ACTUAL (LIVE) */}
      <div className="metric-card" style={{ padding: '0', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="table-header" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-light)', background: 'rgba(99, 102, 241, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={16} className="text-primary" />
            <span className="metric-label" style={{ margin: 0, color: 'var(--text-bright)' }}>Monitor de Jornada Actual (Hoy)</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--accent-success)', fontWeight: 'bold' }}>AUTOSINCRONIZADO</div>
        </div>
        <div className="table-container" style={{ maxHeight: '350px' }}>
          <table className="history-table admin-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: '32px' }}>Operador</th>
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
                <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>No hay actividad registrada para hoy.</td></tr>
              ) : metricsToday.map((item) => {
                const email = users.find(u => u.id === item.user_id)?.email || 'N/A';
                return (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'left', paddingLeft: '32px' }}>
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

      {/* ANALYTICS ROW */}
      <div style={{ marginBottom: '32px' }}>
        <div className="metric-card" style={{ padding: '24px' }}>
          <span className="metric-label"><TrendingUp size={14} style={{ marginRight: 5 }} /> Tendencia Histórica de Gestión</span>
          <div style={{ height: '180px' }}>
            <Line
              data={trendChartData}
              options={{
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' }
                  }
                },
                plugins: { legend: { display: false } }
              }}
            />
          </div>
        </div>
      </div>

      {/* UNIFIED HISTORY TABLE (Drill-down) */}
      <div className="metric-card" style={{ padding: '0' }}>
        <div className="table-header" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={16} className="text-secondary" />
            <span className="metric-label" style={{ margin: 0, color: 'var(--text-bright)' }}>Historial Unificado de Operadores</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Haz clic en un operador para ver su detalle</div>
        </div>
        <div className="table-container" style={{ maxHeight: '500px' }}>
          <table className="history-table admin-table clickable-rows">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: '32px' }}>Operador</th>
                <th>Días Reg.</th>
                <th>Total Gest.</th>
                <th>Total Cerr.</th>
                <th>% Cierre Med.</th>
                <th>% Reso Med.</th>
                <th>G/h Med.</th>
                <th>Dif. Cierre</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {unifiedHistory.length === 0 ? (
                <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>Iniciando base de datos...</td></tr>
              ) : unifiedHistory.map((u) => (
                <tr key={u.id} onClick={() => setViewingUserDetails(u)} style={{ cursor: 'pointer' }}>
                  <td style={{ textAlign: 'left', paddingLeft: '32px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                      Ver <ChevronRight size={14} />
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
