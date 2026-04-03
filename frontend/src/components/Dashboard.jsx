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
  X,
  Trash2,
  Edit3
} from 'lucide-react';

const STANDARDS = {
  // GxH
  GXH_GREEN: 3.99,
  GXH_YELLOW: 3.78,

  // RESO
  RESOLUTION_GREEN: 78.10,
  RESOLUTION_YELLOW: 76.8,

  // CIERRE (Based on image label)
  CLOSED_GREEN: 78.8,
  CLOSED_YELLOW: 76.8,

  // Legacy/Other
  TIME_PER_CASE: 950,
  TIME_PER_MANAGED: 950,
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
  const [showEditRecordModal, setShowEditRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirmar',
    type: 'danger'
  });

  const requestConfirm = (title, message, onConfirm, type = 'danger', confirmText = 'Confirmar') => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, show: false }));
      },
      confirmText,
      type
    });
  };

  // Helper for traffic light colors
  const getStatusClass = (value, greenTarget, yellowTarget) => {
    const val = parseFloat(value);
    if (val >= greenTarget) return 'stat-meets-standard';
    if (val >= yellowTarget) return 'stat-warning-standard';
    return 'stat-below-standard';
  };
  const [recordEditData, setRecordEditData] = useState({
    date: '',
    h: 0, m: 0, s: 0,
    closed: 0,
    managed: 0,
    technicians: 0
  });

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
      showMessage('error', 'No se pudo cargar el historial. Revisa tu conexión.');
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

  const historyWithAccum = useMemo(() => {
    // Sort ascending to calculate accumulators correctly
    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningManaged = 0;
    let runningClosed = 0;
    let runningTechnicians = 0;
    let runningSeconds = 0;

    const withAccum = sorted.map(item => {
      // Parse time string to seconds
      const [h, m, s] = item.total_time.split(':').map(Number);
      const rowSeconds = (h * 3600) + (m * 60) + s;

      runningManaged += item.cases_managed || 0;
      runningClosed += item.cases_closed || 0;
      runningTechnicians += item.technicians_sent || 0;
      runningSeconds += rowSeconds;

      const totalHours = runningSeconds / 3600;

      return {
        ...item,
        accumManaged: runningManaged,
        accumClosed: runningClosed,
        accumTechnicians: runningTechnicians,
        accumSeconds: runningSeconds,
        // Calculate accum metrics
        accumCloseRate: runningManaged > 0 ? ((runningClosed / runningManaged) * 100).toFixed(1) : "0.0",
        accumResoRate: runningManaged > 0 ? (((runningManaged - runningTechnicians) / runningManaged) * 100).toFixed(1) : "0.0",
        accumGxH: totalHours > 0 ? (runningManaged / totalHours).toFixed(1) : "0.0"
      };
    });

    // Return in ascending order as requested (older first)
    return withAccum;
  }, [history]);

  // --- Filtered History ---
  const filteredHistory = useMemo(() => {
    if (!searchDate) return historyWithAccum;
    return historyWithAccum.filter(item => item.date.includes(searchDate));
  }, [historyWithAccum, searchDate]);

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
    requestConfirm(
      '¿Reiniciar Todo?',
      '¿Estás seguro de reiniciar todos los contadores? Se perderá el progreso que no hayas guardado.',
      () => {
        setClosedCount(0);
        setManagedCount(0);
        setTechniciansCount(0);
        setTimerSeconds(0);
        setIsTimerRunning(false);
        startTimeRef.current = null;
        localStorage.removeItem('gxh_timer_state');
        showMessage('info', 'Contadores reiniciados.');
      },
      'danger',
      'Reiniciar'
    );
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

    const { error } = await supabase.from('daily_metrics').upsert([payload], { onConflict: 'user_id,date' });

    if (error) {
      showMessage('error', 'Error al guardar: ' + error.message);
    } else {
      showMessage('success', '¡Métricas guardadas correctamente!');
      await fetchHistory();
    }
    setIsSaving(false);
  };

  const handleDeleteRecord = async (id) => {
    requestConfirm(
      '¿Eliminar Registro?',
      '¿Seguro deseas borrar este registro? No podrás recuperarlo...',
      async () => {
        const { error } = await supabase.from('daily_metrics').delete().eq('id', id);
        if (error) {
          showMessage('error', 'Error al eliminar: ' + error.message);
        } else {
          showMessage('success', 'Registro eliminado correctamente.');
          fetchHistory();
        }
      },
      'danger',
      'Eliminar Registro'
    );
  };

  const handleOpenEditModal = (record) => {
    const [h, m, s] = record.total_time.split(':').map(Number);
    setEditingRecord(record);
    setRecordEditData({
      date: record.date,
      h, m, s,
      closed: record.cases_closed,
      managed: record.cases_managed,
      technicians: record.technicians_sent
    });
    setShowEditRecordModal(true);
  };

  const saveRecordEdit = async () => {
    if (!editingRecord) return;
    setIsSaving(true);

    const totalSeconds = (recordEditData.h * 3600) + (recordEditData.m * 60) + recordEditData.s;
    const totalHours = totalSeconds / 3600;

    const closeRate = recordEditData.managed > 0 ? (recordEditData.closed / recordEditData.managed) * 100 : 0;
    const resolutionRate = recordEditData.managed > 0 ? ((recordEditData.managed - recordEditData.technicians) / recordEditData.managed) * 100 : 0;
    const managedPerHour = totalHours > 0 ? recordEditData.managed / totalHours : 0;
    const closedPerHour = totalHours > 0 ? recordEditData.closed / totalHours : 0;
    const tmoCase = recordEditData.closed > 0 ? Math.floor(totalSeconds / recordEditData.closed) : 0;
    const tmoManaged = recordEditData.managed > 0 ? Math.floor(totalSeconds / recordEditData.managed) : 0;

    const payload = {
      date: recordEditData.date,
      total_time: formatTime(totalSeconds),
      cases_closed: recordEditData.closed,
      cases_managed: recordEditData.managed,
      efficiency: parseFloat(closeRate.toFixed(1)),
      cases_per_hour: parseFloat(managedPerHour.toFixed(1)),
      avg_closed_per_hour: parseFloat(closedPerHour.toFixed(1)),
      tmo_case: tmoCase,
      tmo_managed: tmoManaged,
      technicians_sent: recordEditData.technicians,
      resolution_rate: parseFloat(resolutionRate.toFixed(1))
    };

    const { error } = await supabase
      .from('daily_metrics')
      .update(payload)
      .eq('id', editingRecord.id);

    if (error) {
      showMessage('error', 'Error al actualizar: ' + error.message);
    } else {
      showMessage('success', 'Registro actualizado correctamente.');
      setShowEditRecordModal(false);
      fetchHistory();
    }
    setIsSaving(false);
  };

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>Soporte Tracker</h1>
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
          <h3>Metricas Requeridos</h3>
          <div className="standard-row"><span>GxH (Verde)</span> <span>≥ {STANDARDS.GXH_GREEN}</span></div>
          <div className="standard-row"><span>GxH (Mínimo)</span> <span>≥ {STANDARDS.GXH_YELLOW}</span></div>
          <div className="standard-row"><span>TMO (máx seg)</span> <span>{STANDARDS.TIME_PER_CASE}s</span></div>
          <div className="standard-row"><span>% Resolución</span> <span>≥ {STANDARDS.RESOLUTION_GREEN}%</span></div>
          <div className="standard-row"><span>% Cierre</span> <span>≥ {STANDARDS.CLOSED_GREEN}%</span></div>
        </section>

        <div className="sidebar-footer"></div>
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
            <div className={`status-indicator ${parseFloat(stats.closedPerHour) >= STANDARDS.GXH_GREEN ? 'standard-meets' :
              parseFloat(stats.closedPerHour) >= STANDARDS.GXH_YELLOW ? 'standard-warning' : 'standard-below'
              }`}>
              {parseFloat(stats.closedPerHour) >= STANDARDS.GXH_GREEN ? 'CUMPLE CON LA MÉTRICA' :
                parseFloat(stats.closedPerHour) >= STANDARDS.GXH_YELLOW ? 'MÉTRICA EN RIESGO' : 'NO CUMPLE LA MÉTRICA'}
            </div>
          </div>

          <div className="metric-card large-card">
            <div>
              <span className="metric-label">Casos Gestionados</span>
              <div className="metric-value">{managedCount}</div>
            </div>
          </div>
        </div>
        <div className="grid-secondary">
          <div className="metric-card">
            <span className="metric-label">Gestionado por Hora</span>
            <div className={`metric-value medium ${getStatusClass(stats.managedPerHour, STANDARDS.GXH_GREEN, STANDARDS.GXH_YELLOW)}`}>
              {stats.managedPerHour}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cierre Real (Cerr/Gest)</span>
            <div className={`metric-value medium ${getStatusClass(stats.closeRate, STANDARDS.CLOSED_GREEN, STANDARDS.CLOSED_YELLOW)}`}>
              {stats.closeRate}%
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO por Caso</span>
            <div className={`metric-value medium ${stats.tmoCase > STANDARDS.TIME_PER_CASE ? 'stat-below-standard' : stats.tmoCase > STANDARDS.TIME_PER_CASE - 100 ? 'stat-warning-standard' : 'stat-meets-standard'}`}>
              {stats.tmoCase}s
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO por Gestionado</span>
            <div className={`metric-value medium ${stats.tmoManaged > STANDARDS.TIME_PER_MANAGED ? 'stat-below-standard' : stats.tmoManaged > STANDARDS.TIME_PER_MANAGED - 100 ? 'stat-warning-standard' : 'stat-meets-standard'}`}>
              {stats.tmoManaged}s
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Técnicos Enviados</span>
            <div className="metric-value medium">{techniciansCount}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">% Resolución Real</span>
            <div className={`metric-value medium ${getStatusClass(stats.resolutionRate, STANDARDS.RESOLUTION_GREEN, STANDARDS.RESOLUTION_YELLOW)}`}>
              {stats.resolutionRate}%
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
            {isSaving ? 'GUARDANDO...' : 'GUARDAR METRICAS DEL DIAEstándares '}
          </button>
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
                      <th>TMO Gest.</th>
                      <th>Acum. Cierre</th>
                      <th>Acum. Reso</th>
                      <th>Acum. GxH</th>
                      <th>Acciones</th>
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
                        <td>{item.tmo_managed}s</td>
                        <td className={getStatusClass(item.accumCloseRate, STANDARDS.CLOSED_GREEN, STANDARDS.CLOSED_YELLOW)} style={{ fontWeight: 'bold' }}>
                          {item.accumCloseRate}%
                        </td>
                        <td className={getStatusClass(item.accumResoRate, STANDARDS.RESOLUTION_GREEN, STANDARDS.RESOLUTION_YELLOW)} style={{ fontWeight: 'bold' }}>
                          {item.accumResoRate}%
                        </td>
                        <td className={getStatusClass(item.accumGxH, STANDARDS.GXH_GREEN, STANDARDS.GXH_YELLOW)} style={{ fontWeight: 'bold' }}>
                          {item.accumGxH}
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
              // CRITICAL: Update startTimeRef so running timer doesn't jump back
              if (isTimerRunning) {
                startTimeRef.current = Date.now() - (total * 1000);
              }
              setShowEditTimeModal(false);
            }}>Guardar Cambios</button>
          </div>
        </div>
      </div>

      {/* EDIT RECORD MODAL */}
      <div className={`modal-overlay ${showEditRecordModal ? 'active' : ''}`}>
        <div className="modal" style={{ maxWidth: '600px' }}>
          <div className="modal-header">
            <h2>Editar Registro</h2>
            <button className="btn-close" onClick={() => setShowEditRecordModal(false)}><X /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div className="input-group">
              <label>Fecha</label>
              <input type="date" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                value={recordEditData.date} onChange={e => setRecordEditData({ ...recordEditData, date: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Gestiones</label>
              <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                value={recordEditData.managed} onChange={e => setRecordEditData({ ...recordEditData, managed: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="input-group">
              <label>Cerrados</label>
              <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                value={recordEditData.closed} onChange={e => setRecordEditData({ ...recordEditData, closed: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="input-group">
              <label>TCO Enviados</label>
              <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                value={recordEditData.technicians} onChange={e => setRecordEditData({ ...recordEditData, technicians: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <label className="metric-label" style={{ textAlign: 'center', marginBottom: '10px' }}>Tiempo Total</label>
          <div className="time-inputs">
            <div className="input-group">
              <label>H</label>
              <input type="number" min="0" value={recordEditData.h} onChange={e => setRecordEditData({ ...recordEditData, h: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="input-divider">:</div>
            <div className="input-group">
              <label>M</label>
              <input type="number" min="0" max="59" value={recordEditData.m} onChange={e => setRecordEditData({ ...recordEditData, m: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="input-divider">:</div>
            <div className="input-group">
              <label>S</label>
              <input type="number" min="0" max="59" value={recordEditData.s} onChange={e => setRecordEditData({ ...recordEditData, s: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEditRecordModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveRecordEdit} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Actualizar Registro'}
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      <div className={`modal-overlay ${confirmModal.show ? 'active' : ''}`}>
        <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '15px' }}>
             <div style={{ 
               width: '60px', 
               height: '60px', 
               borderRadius: '50%', 
               background: confirmModal.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               margin: '0 auto 10px',
               color: confirmModal.type === 'danger' ? 'var(--accent-error)' : 'var(--primary-light)'
             }}>
               <AlertCircle size={32} />
             </div>
          </div>
          <h2 style={{ 
            fontSize: '22px', 
            marginBottom: '12px',
            color: 'var(--text-bright)'
          }}>
            {confirmModal.title}
          </h2>
          <p style={{ 
            marginBottom: '30px', 
            fontSize: '15px', 
            color: 'var(--text-muted)',
            lineHeight: '1.5'
          }}>
            {confirmModal.message}
          </p>
          <div className="modal-footer" style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmModal(p => ({...p, show: false}))}>
              Cancelar
            </button>
            <button 
              className="btn" 
              style={{ 
                flex: 1, 
                backgroundColor: confirmModal.type === 'danger' ? 'var(--accent-error)' : 'var(--primary)',
                color: 'white',
                fontWeight: '700'
              }} 
              onClick={confirmModal.onConfirm}
            >
              {confirmModal.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
