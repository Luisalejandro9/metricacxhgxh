import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';

const formatTmoMin = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00 min";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
};

function HistoryTables({
  isLoadingHistory,
  filteredHistory,
  searchMonth,
  setSearchMonth,
  searchDate,
  setSearchDate,
  handleOpenEditModal,
  handleDeleteRecord,
  getStatusClass,
  standards
}) {
  return (
    <div className="history-section">
      <div className="metric-card h-full">
        <div className="table-header">
          <span className="metric-label">Historial de Registros</span>
          <div className="filter-group" style={{ display: 'flex', gap: '15px' }}>
            <div>
              <label>Seleccionar Mes:</label>
              <input
                type="month"
                value={searchMonth}
                onChange={(e) => setSearchMonth(e.target.value)}
                className="filter-input"
                style={{ width: '150px' }}
              />
            </div>
            <div>
              <label>Filtrar por fecha:</label>
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="filter-input"
              />
            </div>
          </div>
        </div>

        <div className="table-container">
          {isLoadingHistory ? (
            <div className="loading-state">Cargando historial...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">No hay nada que mostrar aún...</div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Gest.</th>
                  <th>Cerr.</th>
                  <th>Dif. Cierre</th>
                  <th>TCO</th>
                  <th>Cierre</th>
                  <th>G/h</th>
                  <th>TMO Gest.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.cases_managed}</td>
                    <td>{item.cases_closed}</td>
                    <td style={{ fontWeight: '700', color: item.closingDiff >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                      {item.closingDiff > 0 ? `+${item.closingDiff}` : item.closingDiff}
                    </td>
                    <td>{item.technicians_sent}</td>
                    <td>{item.efficiency}%</td>
                    <td>{item.cases_per_hour}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontWeight: '600' }}>{formatTmoMin(item.tmo_managed)}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>({item.tmo_managed}s)</span>
                      </div>
                    </td>
                    <td style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleOpenEditModal(item)} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer' }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDeleteRecord(item.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-error)', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="metric-card h-full" style={{ marginTop: '20px' }}>
        <div className="table-header">
          <span className="metric-label">Historial de Acumulados</span>
        </div>
        <div className="table-container">
          {isLoadingHistory ? (
            <div className="loading-state">Cargando historial...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">No hay nada que mostrar aún...</div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acum. Casos</th>
                  <th>Acum. Cierre</th>
                  <th>Acum. Reso</th>
                  <th>Acum. GxH</th>
                  <th>Dif-cierre Acum</th>
                  <th>Dif. G/h Acum</th>
                  <th>Dif. Reso Acum</th>
                  <th>TMO Promedio</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id + '-accum'}>
                    <td>{item.date}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.accumManaged}</td>
                    <td className={getStatusClass(item.accumCloseRate, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)} style={{ fontWeight: 'bold' }}>
                      {item.accumCloseRate}%
                    </td>
                    <td className={getStatusClass(item.accumResoRate, standards.RESOLUTION_GREEN, standards.RESOLUTION_YELLOW)} style={{ fontWeight: 'bold' }}>
                      {item.accumResoRate}%
                    </td>
                    <td className={getStatusClass(item.accumGxH, standards.GXH_GREEN, standards.GXH_YELLOW)} style={{ fontWeight: 'bold' }}>
                      {item.accumGxH}
                    </td>
                    <td style={{ fontWeight: '800', color: item.accumClosingDiff >= 0 ? 'var(--accent-success)' : 'var(--accent-error)', background: 'rgba(255,255,255,0.02)' }}>
                      {item.accumClosingDiff > 0 ? `+${item.accumClosingDiff}` : item.accumClosingDiff}
                    </td>
                    <td style={{ fontWeight: '700', color: parseFloat(item.accumGxhDiff) >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                      {parseFloat(item.accumGxhDiff) > 0 ? `+${item.accumGxhDiff}` : item.accumGxhDiff}
                    </td>
                    <td style={{ fontWeight: '700', color: item.accumResoDiff >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                      {item.accumResoDiff > 0 ? `+${item.accumResoDiff}` : item.accumResoDiff}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontWeight: '600' }}>{formatTmoMin(item.accumTmoManaged)}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>({item.accumTmoManaged}s)</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryTables;
