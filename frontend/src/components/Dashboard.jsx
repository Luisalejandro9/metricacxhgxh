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
  Edit3,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STANDARDS = {
  // GxH Working
  GXH_GREEN: 4.00,
  GXH_YELLOW: 3.50,

  // % Resolución Neta (bonifica)
  RESOLUTION_GREEN: 81.0,
  RESOLUTION_YELLOW: 78.2,

  // Cierre — solo objetivo, NO bonifica
  CLOSED_GREEN: 79.0,
  CLOSED_YELLOW: 77.0,

  // Tiempos
  TIME_PER_CASE: 950,
  TIME_PER_MANAGED: 950,
};

// --- Funciones de Bonificación (solo GxH y Resolución) ---
const getGxHBonus = (value) => {
  const val = parseFloat(value);
  if (val >= 4.50) return 2.0;
  if (val >= 4.00) return 1.0;
  if (val >= 3.50) return 0.0;
  if (val >= 3.00) return -1.0;
  return -2.0;
};

const getResolucionBonus = (value) => {
  const val = parseFloat(value);
  if (val >= 81.0) return 3.0;
  if (val >= 79.6) return 2.0;
  if (val >= 78.2) return 1.0;
  if (val >= 76.8) return 0.0;
  if (val >= 75.4) return -1.0;
  return -2.0;
};

// Bono diario = GxH + Resolución (Cierre NO bonifica, solo es objetivo)
const calculateRecordBonus = (managedPerHour, resolutionRate) => {
  return getGxHBonus(managedPerHour) + getResolucionBonus(resolutionRate);
};

function Dashboard({ user, profile, setNetworkError }) {
  const navigate = useNavigate();
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
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [showEditRecordModal, setShowEditRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isEditingClosed, setIsEditingClosed] = useState(false);
  const [isEditingManaged, setIsEditingManaged] = useState(false);
  const [manualCountInput, setManualCountInput] = useState("");
  const autoSaveTimeoutRef = useRef(null);

  // --- Confirmation Modal Management ---
  // Controls the custom, premium-styled confirmation dialog
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirmar',
    type: 'danger' // 'danger' for red buttons, 'primary' for blue
  });

  // Reusable function to trigger the custom confirmation modal
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

  // --- Centralized Error Helper ---
  // Detects network/DNS issues (e.g., "Failed to fetch") to trigger the global banner
  const handleSupabaseError = (error, context) => {
    console.error(`${context}:`, error.message);
    // If the error message indicates a connection block, alert the global App state
    if (error.message.toLowerCase().includes('fetch')) {
      setNetworkError(true);
    } else {
      // Otherwise, show a temporary floating message
      showMessage('error', `${context}: ${error.message}`);
    }
  };

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
      handleSupabaseError(error, 'Error al cargar historial');
    } else {
      setHistory(data || []);
      setNetworkError(false);
    }
    setIsLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();

    // Load persisted timer state and counts
    const savedState = localStorage.getItem('gxh_timer_state');
    const localDate = new Date();
    const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const savedCounts = localStorage.getItem(`gxh_counts_${todayStr}`);

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

    if (savedCounts) {
      try {
        const { closed, managed, technicians } = JSON.parse(savedCounts);
        setClosedCount(closed || 0);
        setManagedCount(managed || 0);
        setTechniciansCount(technicians || 0);
      } catch (e) {
        console.error('Error loading saved counts', e);
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

  // Persist counts state
  useEffect(() => {
    const localDate = new Date();
    const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const counts = {
      closed: closedCount,
      managed: managedCount,
      technicians: techniciansCount
    };
    localStorage.setItem(`gxh_counts_${dateStr}`, JSON.stringify(counts));
  }, [closedCount, managedCount, techniciansCount]);

  // --- Intelligent Auto-Save (Logic) ---
  // Debounces saving to Supabase to prevent excessive DB calls while ensuring real-time sync
  useEffect(() => {
    // Prevent auto-save on initial mount or if no progress made
    if (managedCount === 0 && timerSeconds === 0) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveToSupabase();
    }, 4000); // 4-second debounce for optimal performance with 23+ users

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [closedCount, managedCount, techniciansCount]); // Auto-save on count changes

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
        // Calculate bonus for this specific day
        dayBonus: calculateRecordBonus(item.cases_per_hour, item.resolution_rate),
        // Calculate accum metrics
        accumCloseRate: runningManaged > 0 ? ((runningClosed / runningManaged) * 100).toFixed(1) : "0.0",
        accumResoRate: runningManaged > 0 ? (((runningManaged - runningTechnicians) / runningManaged) * 100).toFixed(1) : "0.0",
        accumGxH: totalHours > 0 ? (runningManaged / totalHours).toFixed(1) : "0.0"
      };
    });

    // Return in ascending order as requested (older first)
    return withAccum;
  }, [history]);

  // --- Total Accumulated Bonus Calculation ---
  const accumulatedBonusTotal = useMemo(() => {
    return historyWithAccum.reduce((sum, item) => sum + (item.dayBonus || 0), 0);
  }, [historyWithAccum]);

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

  const toggleTimer = () => {
    const isNowRunning = !isTimerRunning;
    setIsTimerRunning(isNowRunning);
    // Auto-save progress when the timer is stopped
    if (!isNowRunning) {
      autoSaveToSupabase();
    }
  };

  // --- Timer Resetter ---
  // Opens the custom confirmation modal before resetting all counts
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
        const localDate = new Date();
        const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
        localStorage.removeItem(`gxh_counts_${dateStr}`);
        showMessage('info', 'Contadores reiniciados.');
      },
      'danger',
      'Reiniciar'
    );
  };

  // --- Manual Edit Handlers ---
  const handleEditClosed = () => {
    setManualCountInput(closedCount.toString());
    setIsEditingClosed(true);
  };

  const handleEditManaged = () => {
    setManualCountInput(managedCount.toString());
    setIsEditingManaged(true);
  };

  const saveManualClosed = () => {
    const val = parseInt(manualCountInput) || 0;
    if (val > managedCount) {
      showMessage('error', 'Cerrados no puede ser mayor que gestionados');
      return;
    }
    setClosedCount(val);
    setIsEditingClosed(false);
  };

  const saveManualManaged = () => {
    const val = parseInt(manualCountInput) || 0;
    if (val < closedCount) {
      showMessage('error', 'Gestionados no puede ser menor que cerrados');
      return;
    }
    setManagedCount(val);
    setIsEditingManaged(false);
  };

  const handleManualInputKeyDown = (e, type) => {
    if (e.key === 'Enter') {
      type === 'closed' ? saveManualClosed() : saveManualManaged();
    } else if (e.key === 'Escape') {
      setIsEditingClosed(false);
      setIsEditingManaged(false);
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

  // --- Save Metrics to Database ---
  // Upserts current session stats into Supabase. Includes network error check.
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
      handleSupabaseError(error, 'Error al guardar métricas');
    } else {
      showMessage('success', '¡Métricas guardadas correctamente!');
      setLastSavedAt(new Date());
      setNetworkError(false);
      await fetchHistory();
    }
    setIsSaving(false);
  };

  // --- Auto-Save Implementation ---
  const autoSaveToSupabase = async () => {
    if (!user || managedCount === 0 || isSaving) return;
    
    setIsAutoSaving(true);
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

    if (!error) {
      setLastSavedAt(new Date());
      setNetworkError(false);
      // Silent history update
      const { data } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (data) setHistory(data);
    }
    setIsAutoSaving(false);
  };

  // --- Delete Record Handler ---
  // Triggers custom confirmation modal before performing the delete operation
  const handleDeleteRecord = async (id) => {
    requestConfirm(
      '¿Eliminar Registro?',
      '¿Seguro deseas borrar este registro? No podrás recuperarlo...',
      async () => {
        const { error } = await supabase.from('daily_metrics').delete().eq('id', id);
        if (error) {
          handleSupabaseError(error, 'Error al eliminar');
        } else {
          showMessage('success', 'Registro eliminado correctamente.');
          setNetworkError(false);
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
      handleSupabaseError(error, 'Error al actualizar registro');
    } else {
      showMessage('success', 'Registro actualizado correctamente.');
      setShowEditRecordModal(false);
      setNetworkError(false);
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-logout" onClick={handleLogout} style={{ flex: 1 }}>
              <LogOut size={10} style={{ marginRight: 5 }} /> Salir
            </button>
            {profile?.role === 'admin' && profile?.is_enabled && (
              <button 
                className="btn-logout" 
                onClick={() => navigate('/admin')}
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

        <section className="standards-section" style={{ marginTop: '12px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.1))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <h3 style={{ color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={14} /> Bono Mensual Acumulado
          </h3>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '32px', fontWeight: '900', color: accumulatedBonusTotal >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                {accumulatedBonusTotal > 0 ? '+' : ''}{accumulatedBonusTotal.toFixed(1)}%
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
                {getGxHBonus(stats.managedPerHour) > 0 ? '+' : ''}{getGxHBonus(stats.managedPerHour).toFixed(1)}%
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
                {getResolucionBonus(stats.resolutionRate) > 0 ? '+' : ''}{getResolucionBonus(stats.resolutionRate).toFixed(1)}%
              </span>
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div className="metric-label" style={{ fontSize: '10px', marginBottom: '4px', color: 'var(--text-dim)' }}>% Cierre (objetivo ≥{STANDARDS.CLOSED_GREEN}%)</div>
            <div className="standard-row">
              <span>Actual: {stats.closeRate}%</span>
              <span className={parseFloat(stats.closeRate) >= STANDARDS.CLOSED_GREEN ? 'stat-meets-standard' :
                               parseFloat(stats.closeRate) >= STANDARDS.CLOSED_YELLOW ? 'stat-warning-standard' : 'stat-below-standard'}
                style={{ fontWeight: '800', fontSize: '13px' }}>
                {parseFloat(stats.closeRate) >= STANDARDS.CLOSED_GREEN ? '✓ OK' :
                 parseFloat(stats.closeRate) >= STANDARDS.CLOSED_YELLOW ? '⚠ Riesgo' : '✗ Bajo'}
              </span>
            </div>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700' }}>TOTAL HOY:</span>
            <span style={{ fontSize: '16px', fontWeight: '900', color: calculateRecordBonus(stats.managedPerHour, stats.resolutionRate) >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                {calculateRecordBonus(stats.managedPerHour, stats.resolutionRate) > 0 ? '+' : ''}{calculateRecordBonus(stats.managedPerHour, stats.resolutionRate).toFixed(1)}%
            </span>
          </div>
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
                      onClick={handleEditClosed}
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
            <div className={`status-indicator ${parseFloat(stats.closedPerHour) >= STANDARDS.GXH_GREEN ? 'standard-meets' :
              parseFloat(stats.closedPerHour) >= STANDARDS.GXH_YELLOW ? 'standard-warning' : 'standard-below'
              }`}>
              {parseFloat(stats.closedPerHour) >= STANDARDS.GXH_GREEN ? 'CUMPLE CON LA MÉTRICA' :
                parseFloat(stats.closedPerHour) >= STANDARDS.GXH_YELLOW ? 'MÉTRICA EN RIESGO' : 'NO CUMPLE LA MÉTRICA'}
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
                      onClick={handleEditManaged}
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
            <span className="metric-label">TMO CxH</span>
            <div className={`metric-value medium ${stats.tmoCase > STANDARDS.TIME_PER_CASE ? 'stat-below-standard' : stats.tmoCase > STANDARDS.TIME_PER_CASE - 100 ? 'stat-warning-standard' : 'stat-meets-standard'}`}>
              {stats.tmoCase}s
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO GxH</span>
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
              // Auto-save manually edited time
              setTimeout(() => autoSaveToSupabase(), 500);
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
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmModal(p => ({ ...p, show: false }))}>
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
