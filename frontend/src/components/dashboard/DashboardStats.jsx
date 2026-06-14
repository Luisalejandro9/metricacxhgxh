import React from 'react';
import { Edit3, Save } from 'lucide-react';

const formatTmoMin = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00 min";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
};

function DashboardStats({
  isEditingClosed,
  setIsEditingClosed,
  isEditingManaged,
  setIsEditingManaged,
  closedCount,
  managedCount,
  manualCountInput,
  setManualCountInput,
  saveManualClosed,
  saveManualManaged,
  handleManualInputKeyDown,
  stats,
  standards,
  currentAccum,
  saveToSupabase,
  isSaving,
  isAutoSaving,
  lastSavedAt,
  getStatusClass
}) {
  return (
    <>
      <div className="grid-primary">
        <div className="metric-card large-card">
          <div style={{ position: 'relative' }}>
            <span className="metric-label">Casos Cerrados Hoy</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isEditingClosed ? (
                <input
                  type="number"
                  className="metric-value-input"
                  value={manualCountInput}
                  onChange={(e) => setManualCountInput(e.target.value)}
                  onBlur={saveManualClosed}
                  onKeyDown={(e) => handleManualInputKeyDown(e, 'closed')}
                  autoFocus
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--primary)',
                    color: 'var(--text-bright)',
                    fontSize: '32px',
                    fontWeight: '800',
                    width: '100px',
                    borderRadius: '8px',
                    padding: '4px 10px'
                  }}
                />
              ) : (
                <>
                  <div className="metric-value">{closedCount}</div>
                  <button
                    onClick={() => {
                      setManualCountInput(closedCount.toString());
                      setIsEditingClosed(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary-light)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                  >
                    <Edit3 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className={`status-indicator ${parseFloat(stats.closedPerHour) >= standards.GXH_GREEN ? 'standard-meets' :
            parseFloat(stats.closedPerHour) >= standards.GXH_YELLOW ? 'standard-warning' : 'standard-below'
            }`}>
            {parseFloat(stats.closedPerHour) >= standards.GXH_GREEN ? 'CUMPLE CON LA MÉTRICA' :
              parseFloat(stats.closedPerHour) >= standards.GXH_YELLOW ? 'MÉTRICA EN RIESGO' : 'NO CUMPLE LA MÉTRICA'}
          </div>
        </div>

        <div className="metric-card large-card">
          <div style={{ position: 'relative' }}>
            <span className="metric-label">Casos Gestionados</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isEditingManaged ? (
                <input
                  type="number"
                  className="metric-value-input"
                  value={manualCountInput}
                  onChange={(e) => setManualCountInput(e.target.value)}
                  onBlur={saveManualManaged}
                  onKeyDown={(e) => handleManualInputKeyDown(e, 'managed')}
                  autoFocus
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--primary)',
                    color: 'var(--text-bright)',
                    fontSize: '32px',
                    fontWeight: '800',
                    width: '100px',
                    borderRadius: '8px',
                    padding: '4px 10px'
                  }}
                />
              ) : (
                <>
                  <div className="metric-value">{managedCount}</div>
                  <button
                    onClick={() => {
                      setManualCountInput(managedCount.toString());
                      setIsEditingManaged(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary-light)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                  >
                    <Edit3 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-secondary">
        <div className="metric-card">
          <span className="metric-label">Gestionado por Hora</span>
          <div className={`metric-value medium ${getStatusClass(stats.managedPerHour, standards.GXH_GREEN, standards.GXH_YELLOW)}`}>
            {stats.managedPerHour}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Cierre Real (Cerr/Gest)</span>
          <div className={`metric-value medium ${getStatusClass(stats.closeRate, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}`}>
            {stats.closeRate}%
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Diferencia cierre ({standards.CLOSED_GREEN}%)</span>
          <div className={`metric-value medium ${stats.closingBalance >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {stats.closingBalance > 0 ? `+${stats.closingBalance}` : stats.closingBalance}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Dif. GxH ({standards.GXH_GREEN.toFixed(1)})</span>
          <div className={`metric-value medium ${parseFloat(stats.gxhDiff) >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {parseFloat(stats.gxhDiff) > 0 ? `+${stats.gxhDiff}` : stats.gxhDiff}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Dif. Reso ({standards.RESOLUTION_GREEN}%)</span>
          <div className={`metric-value medium ${stats.resoDiff >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {stats.resoDiff > 0 ? `+${stats.resoDiff}` : stats.resoDiff}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">TMO GxH</span>
          <div className={`metric-value medium ${stats.tmoManaged > standards.TIME_PER_MANAGED ? 'stat-below-standard' : stats.tmoManaged > standards.TIME_PER_MANAGED - 100 ? 'stat-warning-standard' : 'stat-meets-standard'}`} style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
            <span>{formatTmoMin(stats.tmoManaged)}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: 'normal' }}>({stats.tmoManaged}s)</span>
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Técnicos Enviados</span>
          <div className="metric-value medium">{techniciansCount}</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">% Resolución Real</span>
          <div className={`metric-value medium ${getStatusClass(stats.resolutionRate, standards.RESOLUTION_GREEN, standards.RESOLUTION_YELLOW)}`}>
            {stats.resolutionRate}%
          </div>
        </div>
      </div>

      <div className="accum-section">
        <div className="metric-card accum-card">
          <span className="metric-label accum-label">Dif. Cierre Acum</span>
          <div className={`metric-value medium ${currentAccum && currentAccum.accumClosingDiff >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {currentAccum ? (currentAccum.accumClosingDiff > 0 ? `+${currentAccum.accumClosingDiff}` : currentAccum.accumClosingDiff) : 0}
          </div>
        </div>
        <div className="metric-card accum-card">
          <span className="metric-label accum-label">Dif. GxH Acum</span>
          <div className={`metric-value medium ${currentAccum && parseFloat(currentAccum.accumGxhDiff) >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {currentAccum ? (parseFloat(currentAccum.accumGxhDiff) > 0 ? `+${currentAccum.accumGxhDiff}` : currentAccum.accumGxhDiff) : 0}
          </div>
        </div>
        <div className="metric-card accum-card">
          <span className="metric-label accum-label">Dif. Reso Acum</span>
          <div className={`metric-value medium ${currentAccum && currentAccum.accumResoDiff >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {currentAccum ? (currentAccum.accumResoDiff > 0 ? `+${currentAccum.accumResoDiff}` : currentAccum.accumResoDiff) : 0}
          </div>
        </div>
      </div>

      <div className="save-container" style={{ margin: '30px auto', width: '100%', maxWidth: '600px', padding: '0 20px' }}>
        <button
          className="btn btn-save"
          onClick={saveToSupabase}
          disabled={isSaving || managedCount === 0}
          style={{
            width: '100%',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            color: 'white',
            fontWeight: '800',
            fontSize: '22px',
            border: 'none',
            cursor: (isSaving || managedCount === 0) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            opacity: (isSaving || managedCount === 0) ? 0.6 : 1,
            transform: 'translateY(0)'
          }}
        >
          <Save size={26} />
          {isSaving ? 'GUARDANDO...' : isAutoSaving ? 'AUTO-GUARDADO...' : 'GUARDAR MÉTRICAS'}
        </button>
        {lastSavedAt && (
          <div style={{
            fontSize: '11px',
            color: 'var(--text-dim)',
            textAlign: 'center',
            marginTop: '10px',
            fontWeight: '500'
          }}>
            Auto-sincronizado a las {lastSavedAt.toLocaleTimeString()}
          </div>
        )}
      </div>
    </>
  );
}

export default DashboardStats;
