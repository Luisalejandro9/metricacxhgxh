import React from 'react';
import {
  LogOut,
  ShieldCheck,
  Pause,
  Play,
  Clock,
  Minus,
  RotateCcw,
  Zap
} from 'lucide-react';

const formatTmoMin = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00 min";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
};

const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

function DashboardSidebar({
  user,
  profile,
  timerSeconds,
  isTimerRunning,
  toggleTimer,
  onOpenEditTime,
  closedCount,
  setClosedCount,
  managedCount,
  onAddManaged,
  onSubtractManaged,
  techniciansCount,
  setTechniciansCount,
  standards,
  accumulatedBonusTotal,
  stats,
  getGxHBonus,
  getResolucionBonus,
  calculateRecordBonus,
  resetAll,
  handleLogout,
  onNavigateToAdmin
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>Soporte Tracker</h1>
        <div className="subtitle">PERFORMANCE TRACKER</div>
      </header>

      <section className="user-info">
        <span id="userEmail">{user?.email}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-logout" onClick={handleLogout} style={{ flex: 1 }}>
            <LogOut size={10} style={{ marginRight: 5 }} /> Salir
          </button>
          {profile?.role === 'admin' && profile?.is_enabled && (
            <button
              className="btn-logout"
              onClick={onNavigateToAdmin}
              style={{
                flex: 1,
                background: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--primary-light)',
                borderColor: 'rgba(99, 102, 241, 0.2)'
              }}
            >
              <ShieldCheck size={10} style={{ marginRight: 5 }} /> Admin
            </button>
          )}
        </div>
      </section>

      <section className="timer-section">
        <div className="timer-display">{formatTime(timerSeconds)}</div>
        <div className="timer-controls">
          <button className={`btn btn-primary ${isTimerRunning ? 'active' : ''}`} onClick={toggleTimer}>
            {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
            <span>{isTimerRunning ? 'Detener Tiempo' : 'Iniciar Tiempo'}</span>
          </button>
          <button className="btn btn-secondary" onClick={onOpenEditTime}>
            <Clock size={16} /> Editar Tiempo
          </button>
        </div>
      </section>

      <section className="action-section">
        <div className="action-row">
          <button className="btn btn-subtract" onClick={() => closedCount > 0 && setClosedCount(c => c - 1)} disabled={!isTimerRunning || closedCount === 0}>
            <Minus />
          </button>
          <button className="btn btn-action" onClick={() => setClosedCount(c => c + 1)} disabled={!isTimerRunning || closedCount >= managedCount}>
            <span className="btn-label">CASO CERRADO</span>
            <span className="btn-icon">✓</span>
          </button>
        </div>

        <div className="action-row">
          <button className="btn btn-subtract" onClick={onSubtractManaged} disabled={!isTimerRunning || managedCount <= closedCount}>
            <Minus />
          </button>
          <button className="btn btn-action" onClick={onAddManaged} disabled={!isTimerRunning}>
            <span className="btn-label">CASO GESTIONADO</span>
            <span className="btn-icon">+</span>
          </button>
        </div>

        <div className="action-row">
          <button className="btn btn-subtract" onClick={() => techniciansCount > 0 && setTechniciansCount(t => t - 1)} disabled={!isTimerRunning || techniciansCount === 0}>
            <Minus />
          </button>
          <button className="btn btn-action" onClick={() => techniciansCount < managedCount && setTechniciansCount(t => t + 1)} disabled={!isTimerRunning || techniciansCount >= managedCount}>
            <span className="btn-label">TCO ENVIADO</span>
            <span className="btn-icon">⚡</span>
          </button>
        </div>

        <button className="btn btn-secondary" onClick={resetAll}>
          <RotateCcw size={16} /> Reiniciar Todo
        </button>
      </section>

      <section className="standards-section">
        <h3>Metricas Requeridos</h3>
        <div className="standard-row"><span>GxH (Verde)</span> <span>≥ {standards.GXH_GREEN}</span></div>
        <div className="standard-row"><span>GxH (Mínimo)</span> <span>≥ {standards.GXH_YELLOW}</span></div>
        <div className="standard-row"><span>TMO (máx)</span> <span>{formatTmoMin(standards.TIME_PER_CASE)} ({standards.TIME_PER_CASE}s)</span></div>
        <div className="standard-row"><span>% Resolución</span> <span>≥ {standards.RESOLUTION_GREEN}%</span></div>
        <div className="standard-row"><span>% Cierre</span> <span>≥ {standards.CLOSED_GREEN}%</span></div>
      </section>

      <section className="standards-section" style={{ marginTop: '12px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.1))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <h3 style={{ color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={14} /> Bono Mensual Acumulado
        </h3>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: accumulatedBonusTotal >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
            {accumulatedBonusTotal > 0 ? '+' : ''}{accumulatedBonusTotal.toFixed(2)}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Estimado en el Mes</div>
        </div>
      </section>

      <section className="standards-section" style={{ marginTop: '12px' }}>
        <h3>📊 Bonificaciones Hoy</h3>
        <div style={{ marginBottom: '10px' }}>
          <div className="metric-label" style={{ fontSize: '10px', marginBottom: '4px', color: 'var(--primary-light)' }}>GxH Working</div>
          <div className="standard-row">
            <span>Actual: {stats.managedPerHour}</span>
            <span style={{
              fontWeight: '800',
              color: getGxHBonus(stats.managedPerHour) > 0 ? 'var(--accent-success)' :
                getGxHBonus(stats.managedPerHour) < 0 ? 'var(--accent-error)' : 'var(--text-dim)'
            }}>
              {getGxHBonus(stats.managedPerHour) > 0 ? '+' : ''}{getGxHBonus(stats.managedPerHour).toFixed(2)}%
            </span>
          </div>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <div className="metric-label" style={{ fontSize: '10px', marginBottom: '4px', color: 'var(--primary-light)' }}>% Resolución Neta</div>
          <div className="standard-row">
            <span>Actual: {stats.resolutionRate}%</span>
            <span style={{
              fontWeight: '800',
              color: getResolucionBonus(stats.resolutionRate) > 0 ? 'var(--accent-success)' :
                getResolucionBonus(stats.resolutionRate) < 0 ? 'var(--accent-error)' : 'var(--text-dim)'
            }}>
              {getResolucionBonus(stats.resolutionRate) > 0 ? '+' : ''}{getResolucionBonus(stats.resolutionRate).toFixed(2)}%
            </span>
          </div>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <div className="metric-label" style={{ fontSize: '10px', marginBottom: '4px', color: 'var(--text-dim)' }}>% Cierre (objetivo ≥{standards.CLOSED_GREEN}%)</div>
          <div className="standard-row">
            <span>Actual: {stats.closeRate}%</span>
            <span className={parseFloat(stats.closeRate) >= standards.CLOSED_GREEN ? 'stat-meets-standard' :
              parseFloat(stats.closeRate) >= standards.CLOSED_YELLOW ? 'stat-warning-standard' : 'stat-below-standard'}
              style={{ fontWeight: '800', fontSize: '13px' }}>
              {parseFloat(stats.closeRate) >= standards.CLOSED_GREEN ? '✓ OK' :
                parseFloat(stats.closeRate) >= standards.CLOSED_YELLOW ? '⚠ Riesgo' : '✗ Bajo'}
            </span>
          </div>
          {managedCount > 0 && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: stats.closingBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-error)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px' }}>
              <span>Diferencia cierre ({standards.CLOSED_GREEN}%):</span>
              <span style={{ fontWeight: '800' }}>
                {stats.closingBalance > 0 ? `+${stats.closingBalance}` : stats.closingBalance} casos
              </span>
            </div>
          )}
        </div>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: '700' }}>TOTAL HOY:</span>
          <span style={{ fontSize: '16px', fontWeight: '900', color: calculateRecordBonus(stats.managedPerHour, stats.resolutionRate) >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
            {calculateRecordBonus(stats.managedPerHour, stats.resolutionRate) > 0 ? '+' : ''}{calculateRecordBonus(stats.managedPerHour, stats.resolutionRate).toFixed(2)}%
          </span>
        </div>
      </section>

      <div className="sidebar-footer"></div>
    </aside>
  );
}

export default DashboardSidebar;
