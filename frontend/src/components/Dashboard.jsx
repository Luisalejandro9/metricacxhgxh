import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Play,
  Pause,
  RotateCcw,
  Minus,
  Save,
  Clock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

const STANDARDS = {
  MANAGED_PER_HOUR: 3.78,
  CLOSED_PER_HOUR: 3.78,
  TIME_PER_CASE: 950,
  TIME_PER_MANAGED: 950,
  RESOLUTION_PERCENTAGE: 76.80
};

function Dashboard({ user }) {
  // Metrics State
  const [closedCount, setClosedCount] = useState(0);
  const [managedCount, setManagedCount] = useState(0);
  const [techniciansCount, setTechniciansCount] = useState(0);

  // History State
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [searchDate, setSearchDate] = useState('');

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // UI State
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);
  const [editTime, setEditTime] = useState({ h: 0, m: 0, s: 0 });
  const [message, setMessage] = useState({ type: null, text: '' });
  const [isSaving, setIsSaving] = useState(false);

  // --- Auth Handlers ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- Data Fetching ---
  const fetchHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    const { data, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error al cargar historial:', error.message);
    } else {
      setHistory(data || []);
    }
    setIsLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();

    // Load persisted timer state
    const savedState = localStorage.getItem('gxh_timer_state');
    if (savedState) {
      try {
        const { seconds, isRunning, startTime } = JSON.parse(savedState);
        if (isRunning && startTime) {
          const now = Date.now();
          const elapsed = Math.floor((now - startTime) / 1000);
          setTimerSeconds(elapsed);
          setIsTimerRunning(true);
          startTimeRef.current = startTime;
        } else {
          setTimerSeconds(seconds || 0);
          setIsTimerRunning(false);
        }
      } catch (e) {
        console.error('Error loading timer state', e);
      }
    }
  }, [user]);

  // Persist timer state
  useEffect(() => {
    const state = {
      seconds: timerSeconds,
      isRunning: isTimerRunning,
      startTime: startTimeRef.current
    };
    localStorage.setItem('gxh_timer_state', JSON.stringify(state));
  }, [timerSeconds, isTimerRunning]);

  // --- Filtered History ---
  const filteredHistory = useMemo(() => {
    if (!searchDate) return history;
    return history.filter(item => item.date.includes(searchDate));
  }, [history, searchDate]);

  // --- Timer Logic ---
  useEffect(() => {
    if (isTimerRunning) {
      // Calculate a virtual start time based on current timerSeconds to handle resume/edits
      startTimeRef.current = Date.now() - (timerSeconds * 1000);

      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        // Only update if the second has actually changed to avoid unnecessary renders
        setTimerSeconds(elapsed);
      }, 500); // Frequent checks to maintain perceived accuracy
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning]);

  // Sync timer when coming back to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTimerRunning && startTimeRef.current) {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        setTimerSeconds(elapsed);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTimerRunning]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);

  const resetAll = () => {
    if (window.confirm('¿Estás seguro de reiniciar todos los contadores?')) {
      setClosedCount(0);
      setManagedCount(0);
      setTechniciansCount(0);
      setTimerSeconds(0);
      setIsTimerRunning(false);
      startTimeRef.current = null;
      localStorage.removeItem('gxh_timer_state');
      showMessage('info', 'Contadores reiniciados.');
    }
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  // --- Derived Metrics ---
  const stats = useMemo(() => {
    const totalHours = timerSeconds / 3600;
    const closeRate = managedCount > 0 ? (closedCount / managedCount) * 100 : 0;
    const resolutionRate = managedCount > 0 ? ((managedCount - techniciansCount) / managedCount) * 100 : 0;
    const managedPerHour = totalHours > 0 ? managedCount / totalHours : 0;
    const closedPerHour = totalHours > 0 ? closedCount / totalHours : 0;
    const tmoCase = closedCount > 0 ? Math.floor(timerSeconds / closedCount) : 0;
    const tmoManaged = managedCount > 0 ? Math.floor(timerSeconds / managedCount) : 0;

    return {
      closeRate: closeRate.toFixed(1),
      resolutionRate: resolutionRate.toFixed(1),
      managedPerHour: managedPerHour.toFixed(1),
      closedPerHour: closedPerHour.toFixed(1),
      tmoCase,
      tmoManaged
    };
  }, [closedCount, managedCount, techniciansCount, timerSeconds]);


  // --- Handlers ---
  const addManaged = () => {
    setManagedCount(prev => prev + 1);
  };

  const subtractManaged = () => {
    if (managedCount > closedCount) {
      setManagedCount(prev => prev - 1);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: null, text: '' }), 4000);
  };

  const saveToSupabase = async () => {
    if (!user) return;
    setIsSaving(true);
    const localDate = new Date();
    const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

    const payload = {
      user_id: user.id,
      date: dateStr,
      total_time: formatTime(timerSeconds),
      cases_closed: closedCount,
      cases_managed: managedCount,
      efficiency: parseFloat(stats.closeRate),
      cases_per_hour: parseFloat(stats.managedPerHour),
      avg_closed_per_hour: parseFloat(stats.closedPerHour),
      tmo_case: stats.tmoCase,
      tmo_managed: stats.tmoManaged,
      technicians_sent: techniciansCount,
      resolution_rate: parseFloat(stats.resolutionRate)
    };

    const { error } = await supabase.from('daily_metrics').insert([payload]);

    if (error) {
      showMessage('error', 'Error al guardar: ' + error.message);
    } else {
      showMessage('success', '¡Métricas guardadas correctamente!');
      await fetchHistory();
    }
    setIsSaving(false);
  };

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>Soporte GxH</h1>
          <div className="subtitle">PERFORMANCE TRACKER</div>
        </header>

        <section className="user-info">
          <span id="userEmail">{user?.email}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Cerrar Sesión <LogOut size={10} style={{ marginLeft: 5 }} />
          </button>
        </section>

        <section className="timer-section">
          <div className="timer-display">{formatTime(timerSeconds)}</div>
          <div className="timer-controls">
            <button className={`btn btn-primary ${isTimerRunning ? 'active' : ''}`} onClick={toggleTimer}>
              {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
              <span>{isTimerRunning ? 'Detener Tiempo' : 'Iniciar Tiempo'}</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setShowEditTimeModal(true)}>
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
            <button className="btn btn-subtract" onClick={subtractManaged} disabled={!isTimerRunning || managedCount <= closedCount}>
              <Minus />
            </button>
            <button className="btn btn-action" onClick={addManaged} disabled={!isTimerRunning}>
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
          <h3>Estándares Requeridos</h3>
          <div className="standard-row"><span>Gestionados p/h</span> <span>{STANDARDS.MANAGED_PER_HOUR}</span></div>
          <div className="standard-row"><span>Cerrados p/h</span> <span>{STANDARDS.CLOSED_PER_HOUR}</span></div>
          <div className="standard-row"><span>TMO (segundos)</span> <span>{STANDARDS.TIME_PER_CASE}s</span></div>
          <div className="standard-row"><span>% Resolución</span> <span>{STANDARDS.RESOLUTION_PERCENTAGE}%</span></div>
        </section>

        <div className="sidebar-footer">Powered by Supabase & React</div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* MESSAGES */}
        {message.text && (
          <div className={`mensaje activo mensaje-${message.type}`}>
            {message.type === 'success' && <CheckCircle2 size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.type === 'error' && <AlertCircle size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.text}
          </div>
        )}

        <div className="grid-primary">
          <div className="metric-card large-card">
            <div>
              <span className="metric-label">Casos Cerrados Hoy</span>
              <div className="metric-value">{closedCount}</div>
            </div>
            <div className={`status-indicator ${parseFloat(stats.closedPerHour) >= STANDARDS.CLOSED_PER_HOUR ? 'standard-meets' : 'standard-below'}`}>
              {parseFloat(stats.closedPerHour) >= STANDARDS.CLOSED_PER_HOUR ? 'CUMPLE CON LA MÉTRICA' : 'NO CUMPLE LA MÉTRICA'}
            </div>
          </div>

          <div className="metric-card large-card">
            <div className="button-row" style={{ marginBottom: 20 }}>
              <button className="btn btn-save" onClick={saveToSupabase} disabled={isSaving || managedCount === 0} style={{ width: '100%', background: 'var(--primary)', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
                {isSaving ? 'GUARDANDO...' : 'GUARDAR'}
              </button>
            </div>
            <div>
              <span className="metric-label">Casos Gestionados</span>
              <div className="metric-value">{managedCount}</div>
            </div>
          </div>
        </div>

        <div className="grid-secondary">
          <div className="metric-card">
            <span className="metric-label">% Cierre (Cerrados/Gest)</span>
            <div className="metric-value medium">{stats.closeRate}%</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Gest. por Hora</span>
            <div className={`metric-value medium ${parseFloat(stats.managedPerHour) < STANDARDS.MANAGED_PER_HOUR ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.managedPerHour}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cerrados por Hora</span>
            <div className={`metric-value medium ${parseFloat(stats.closedPerHour) < STANDARDS.CLOSED_PER_HOUR ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.closedPerHour}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO por Caso</span>
            <div className={`metric-value medium ${stats.tmoCase > STANDARDS.TIME_PER_CASE ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.tmoCase}s
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO por Gestionado</span>
            <div className={`metric-value medium ${stats.tmoManaged > STANDARDS.TIME_PER_MANAGED ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.tmoManaged}s
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Técnicos Enviados</span>
            <div className="metric-value medium">{techniciansCount}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">% Resolución Real</span>
            <div className={`metric-value medium ${parseFloat(stats.resolutionRate) < STANDARDS.RESOLUTION_PERCENTAGE ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.resolutionRate}%
            </div>
          </div>
        </div>

        <div className="history-section">

          <div className="metric-card h-full">
            <div className="table-header">
              <span className="metric-label">Historial de Registros</span>
              <div className="filter-group">
                <label>Filtrar por fecha:</label>
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="filter-input"
                />
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
                      <th>TCO</th>
                      <th>Cierre</th>
                      <th>G/h</th>
                      <th>TMO Cerr.</th>
                      <th>TMO Gest.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => (
                      <tr key={item.id}>
                        <td>{item.date}</td>
                        <td>{item.cases_managed}</td>
                        <td>{item.cases_closed}</td>
                        <td>{item.technicians_sent}</td>
                        <td>{item.efficiency}%</td>
                        <td>{item.cases_per_hour}</td>
                        <td>{item.tmo_case}s</td>
                        <td>{item.tmo_managed}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* EDIT TIME MODAL */}
      <div className={`modal-overlay ${showEditTimeModal ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h2>Editar Tiempo Transcurrido</h2>
            <button className="btn-close" onClick={() => setShowEditTimeModal(false)}><X /></button>
          </div>
          <div className="time-inputs">
            <div className="input-group">
              <label>Horas</label>
              <input type="number" min="0" value={editTime.h} onChange={e => setEditTime({ ...editTime, h: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="input-divider">:</div>
            <div className="input-group">
              <label>Minutos</label>
              <input type="number" min="0" max="59" value={editTime.m} onChange={e => setEditTime({ ...editTime, m: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="input-divider">:</div>
            <div className="input-group">
              <label>Segundos</label>
              <input type="number" min="0" max="59" value={editTime.s} onChange={e => setEditTime({ ...editTime, s: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEditTimeModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
              const total = (editTime.h * 3600) + (editTime.m * 60) + editTime.s;
              setTimerSeconds(total);
              if (isTimerRunning) {
                startTimeRef.current = Date.now() - (total * 1000);
              }
              setShowEditTimeModal(false);
            }}>Guardar Cambios</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
