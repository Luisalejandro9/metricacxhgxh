import React from 'react';
import {
  LogOut,
  ShieldCheck,
  Pause,
  Play,
  Clock,
  Minus,
  Plus,
  Check,
  RotateCcw,
  Zap,
  Sun,
  Moon
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
  resetAll,
  handleLogout,
  onNavigateToAdmin,
  theme,
  toggleTheme
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-header-top">
          <h1>Soporte Tracker</h1>
          {toggleTheme && (
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Tema Claro (Suizo)' : 'Cambiar a Tema Oscuro'}
            >
              {theme === 'dark' ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
              <span>{theme === 'dark' ? 'CLARO' : 'OSCURO'}</span>
            </button>
          )}
        </div>
        <div className="subtitle">01 / PERFORMANCE TRACKER</div>
      </header>

      <section className="user-info">
        <span id="userEmail">{user?.email}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-logout" onClick={handleLogout} style={{ flex: 1 }}>
            <LogOut size={12} strokeWidth={2} style={{ marginRight: 4 }} /> Salir
          </button>
          {profile?.role === 'admin' && profile?.is_enabled && (
            <button
              className="btn-logout"
              onClick={onNavigateToAdmin}
              style={{
                flex: 1,
                color: 'var(--primary)',
                borderColor: 'var(--primary)'
              }}
            >
              <ShieldCheck size={12} strokeWidth={2} style={{ marginRight: 4 }} /> Admin
            </button>
          )}
        </div>
      </section>

      <section className="timer-section">
        <div className="swiss-section-header">01 / TIMER DE TRABAJO</div>
        <div className="timer-display">{formatTime(timerSeconds)}</div>
        <div className="timer-controls">
          <button className={`btn btn-primary ${isTimerRunning ? 'active' : ''}`} onClick={toggleTimer}>
            {isTimerRunning ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
            <span>{isTimerRunning ? 'Detener Tiempo' : 'Iniciar Tiempo'}</span>
          </button>
          <button className="btn btn-secondary" onClick={onOpenEditTime}>
            <Clock size={14} strokeWidth={2} /> Editar Tiempo
          </button>
        </div>
      </section>

      <section className="action-section">
        <div className="swiss-section-header">02 / REGISTRO RÁPIDO</div>

        <div className="action-row">
          <button className="btn btn-subtract" onClick={() => closedCount > 0 && setClosedCount(c => c - 1)} disabled={!isTimerRunning || closedCount === 0}>
            <Minus size={14} strokeWidth={2} />
          </button>
          <button className="btn btn-action" onClick={() => setClosedCount(c => c + 1)} disabled={!isTimerRunning || closedCount >= managedCount}>
            <span className="btn-label">CASO CERRADO</span>
            <span className="btn-icon"><Check size={14} strokeWidth={2.5} /></span>
          </button>
        </div>

        <div className="action-row">
          <button className="btn btn-subtract" onClick={onSubtractManaged} disabled={!isTimerRunning || managedCount <= closedCount}>
            <Minus size={14} strokeWidth={2} />
          </button>
          <button className="btn btn-action" onClick={onAddManaged} disabled={!isTimerRunning}>
            <span className="btn-label">CASO GESTIONADO</span>
            <span className="btn-icon"><Plus size={14} strokeWidth={2.5} /></span>
          </button>
        </div>

        <div className="action-row">
          <button className="btn btn-subtract" onClick={() => techniciansCount > 0 && setTechniciansCount(t => t - 1)} disabled={!isTimerRunning || techniciansCount === 0}>
            <Minus size={14} strokeWidth={2} />
          </button>
          <button className="btn btn-action" onClick={() => techniciansCount < managedCount && setTechniciansCount(t => t + 1)} disabled={!isTimerRunning || techniciansCount >= managedCount}>
            <span className="btn-label">TCO ENVIADO</span>
            <span className="btn-icon"><Zap size={14} strokeWidth={2} /></span>
          </button>
        </div>

        <button className="btn btn-secondary" onClick={resetAll} style={{ marginTop: '4px' }}>
          <RotateCcw size={14} strokeWidth={2} /> Reiniciar Contador
        </button>
      </section>

      <section className="standards-section">
        <h3>03 / ESTÁNDARES REQUERIDOS</h3>
        <div className="standard-row"><span>GxH (Verde)</span> <span>≥ {standards.GXH_GREEN}</span></div>
        <div className="standard-row"><span>GxH (Mínimo)</span> <span>≥ {standards.GXH_YELLOW}</span></div>
        <div className="standard-row"><span>TMO (máx)</span> <span>{formatTmoMin(standards.TIME_PER_CASE)}</span></div>
        <div className="standard-row"><span>% Resolución</span> <span>≥ {standards.RESOLUTION_GREEN}%</span></div>
        <div className="standard-row"><span>% Cierre</span> <span>≥ {standards.CLOSED_GREEN}%</span></div>
      </section>

      <div className="sidebar-footer"></div>
    </aside>
  );
}

export default DashboardSidebar;
