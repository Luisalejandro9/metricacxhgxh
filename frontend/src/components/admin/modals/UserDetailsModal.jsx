import React from 'react';
import { X, Calendar, Trash2 } from 'lucide-react';

function UserDetailsModal({
  viewingUserDetails,
  onClose,
  standards,
  getStatusClass,
  onDeleteClick
}) {
  if (!viewingUserDetails) return null;

  return (
    <div className="login-overlay drilldown-modal" style={{ zIndex: 2000 }}>
      <div className="login-card" style={{ maxWidth: '900px', width: '95%', padding: '0', overflow: 'hidden' }}>
        <header style={{ padding: '24px 32px', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-bright)' }}>{viewingUserDetails.email.split('@')[0]}</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{viewingUserDetails.email}</p>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </header>

        <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="grid-secondary" style={{ marginBottom: '32px' }}>
            <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="metric-label">Días de Actividad</span>
              <div className="metric-value small">{viewingUserDetails.recordsCount}</div>
            </div>
            <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="metric-label">Diferencia cierre ({standards.CLOSED_GREEN}%)</span>
              <div className={`metric-value small ${viewingUserDetails.closingBalance >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
                {viewingUserDetails.closingBalance > 0 ? `+${viewingUserDetails.closingBalance}` : viewingUserDetails.closingBalance}
              </div>
            </div>
            <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="metric-label">Promedio G/h</span>
              <div className="metric-value small">{viewingUserDetails.avgGxh}</div>
            </div>
            <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="metric-label">Cierre Total</span>
              <div className={`metric-value small ${getStatusClass(viewingUserDetails.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}`}>
                {viewingUserDetails.efficiency}%
              </div>
            </div>
          </div>

          <h3 className="metric-label" style={{ marginBottom: '15px' }}>
            <Calendar size={14} style={{ marginRight: 8 }} /> Desglose fecha por fecha
          </h3>
          <table className="history-table admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>T. Conexión</th>
                <th>Gest.</th>
                <th>Cerr.</th>
                <th>TCO</th>
                <th>% Cierre</th>
                <th>G/h</th>
                <th>Dif. Cierre Acum</th>
                <th>Dif. G/h Acum</th>
                <th>Dif. Reso Acum</th>
              </tr>
            </thead>
            <tbody>
              {viewingUserDetails.rows.map(row => (
                <tr key={row.id}>
                  <td style={{ fontWeight: '700' }}>{row.date}</td>
                  <td>{row.total_time}</td>
                  <td>{row.cases_managed}</td>
                  <td>{row.cases_closed}</td>
                  <td>{row.technicians_sent}</td>
                  <td className={getStatusClass(row.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}>{row.efficiency}%</td>
                  <td className={getStatusClass(row.cases_per_hour, standards.GXH_GREEN, standards.GXH_YELLOW)}>{row.cases_per_hour}</td>
                  <td style={{ fontWeight: '700', color: row.accumClosingDiff >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                    {row.accumClosingDiff > 0 ? `+${row.accumClosingDiff}` : row.accumClosingDiff}
                  </td>
                  <td style={{ fontWeight: '700', color: parseFloat(row.accumGxhDiff) >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                    {parseFloat(row.accumGxhDiff) > 0 ? `+${row.accumGxhDiff}` : row.accumGxhDiff}
                  </td>
                  <td style={{ fontWeight: '700', color: row.accumResoDiff >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                    {row.accumResoDiff > 0 ? `+${row.accumResoDiff}` : row.accumResoDiff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--border-light)' }}>
          {viewingUserDetails.role !== 'admin' ? (
            <button
              className="btn"
              style={{
                backgroundColor: 'var(--accent-error)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                padding: '8px 16px',
                borderRadius: '8px'
              }}
              onClick={() => onDeleteClick(viewingUserDetails)}
            >
              <Trash2 size={16} />
              <span>Limpiar Datos y Cerrar Sesión</span>
            </button>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 'bold' }}>CUENTA DE ADMINISTRADOR PROTEGIDA</div>
          )}
          <button className="btn btn-primary" onClick={onClose}>Cerrar Detalle</button>
        </footer>
      </div>
    </div>
  );
}

export default UserDetailsModal;
