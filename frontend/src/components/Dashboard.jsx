import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, BookOpen, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import { STANDARDS, DEFAULT_GXH_TIERS, DEFAULT_RESOLUTION_TIERS } from '../utils/constants';
import { formatTmoMin, formatTime, getTodayDateStr } from '../utils/formatters';
import { parseStandardsFromConfig, getStatusClass, resolveTierBonus } from '../utils/standards';

// Subcomponentes del Dashboard
import ConfirmModal from './dashboard/modals/ConfirmModal';
import HelpModal from './dashboard/modals/HelpModal';
import EditTimeModal from './dashboard/modals/EditTimeModal';
import EditRecordModal from './dashboard/modals/EditRecordModal';
import DashboardSidebar from './dashboard/DashboardSidebar';
import DashboardStats from './dashboard/DashboardStats';
import HistoryTables from './dashboard/HistoryTables';

// Carga diferida de gráficos (Chart.js) para reducir el tamaño del bundle inicial
const DashboardCharts = lazy(() => import('./dashboard/DashboardCharts'));

/**
 * Componente principal del Dashboard operativo.
 * Gestiona el temporizador de jornada, contadores diarios, cálculo de métricas en vivo,
 * auto-guardado inteligente en Supabase (o localStorage en modo Demo) y el historial mensual.
 */
function Dashboard({ user, profile, setNetworkError, theme, toggleTheme }) {
  const navigate = useNavigate();
  // Separar el estado local por identidad y entorno para impedir cruces entre Demo y usuarios reales.
  const storageScope = user ? `${user.isDemo ? 'demo' : 'user'}_${user.id}` : 'anonymous';
  const timerStateStorageKey = `gxh_timer_state_${storageScope}`;
  const countsStorageKey = (date) => `gxh_counts_${storageScope}_${date}`;

  // Estado dinámico de estándares del servicio (cargados desde app_config)
  const [standards, setStandards] = useState(() => {
    if (user?.isDemo) {
      const local = localStorage.getItem(`demo_app_standards_${user.id}`);
      if (local) {
        try {
          return JSON.parse(local);
        } catch (e) {
          console.error('Error al cargar estándares demo:', e);
        }
      }
    }
    return {
      ...STANDARDS,
      gxh_bonus_tiers: DEFAULT_GXH_TIERS,
      resolution_bonus_tiers: DEFAULT_RESOLUTION_TIERS
    };
  });
  const [isLoadingStandards, setIsLoadingStandards] = useState(true);

  // Calculadoras dinámicas de bonificación según tramos configurados
  const getGxHBonus = useCallback((value) => {
    return resolveTierBonus(value, standards.gxh_bonus_tiers, DEFAULT_GXH_TIERS);
  }, [standards.gxh_bonus_tiers]);

  const getResolucionBonus = useCallback((value) => {
    return resolveTierBonus(value, standards.resolution_bonus_tiers, DEFAULT_RESOLUTION_TIERS);
  }, [standards.resolution_bonus_tiers]);

  const calculateRecordBonus = useCallback((managedPerHour, resolutionRate) => {
    return getGxHBonus(managedPerHour) + getResolucionBonus(resolutionRate);
  }, [getGxHBonus, getResolucionBonus]);

  // Carga inicial de estándares y suscripción en tiempo real a cambios de configuración
  useEffect(() => {
    const fetchStandards = async () => {
      if (!user) return;
      try {
        if (user.isDemo) {
          setIsLoadingStandards(false);
          return;
        }

        const { data, error } = await supabase
          .from('app_config')
          .select('*')
          .eq('key', 'current')
          .maybeSingle();

        if (error) {
          console.warn('Error al cargar app_config (usando estándares por defecto):', error.message);
        } else if (data) {
          setStandards(parseStandardsFromConfig(data));
        }
      } catch (err) {
        console.error('Error al cargar estándares:', err);
      } finally {
        setIsLoadingStandards(false);
      }
    };

    fetchStandards();

    // Suscripción en tiempo real a modificaciones de app_config
    if (!user?.isDemo) {
      const channel = supabase
        .channel('app_config_live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload) => {
          if (payload.new && payload.new.key === 'current') {
            setStandards(parseStandardsFromConfig(payload.new));
          }
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Metrics State
  const [closedCount, setClosedCount] = useState(0);
  const [managedCount, setManagedCount] = useState(0);
  const [techniciansCount, setTechniciansCount] = useState(0);
  const [transferredCount, setTransferredCount] = useState(0);

  // History State
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [searchDate, setSearchDate] = useState('');
  const [searchMonth, setSearchMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

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
  const [showHelpModal, setShowHelpModal] = useState(false);
  const autoSaveTimeoutRef = useRef(null);

  // --- Confirmation Modal Management ---
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

  // --- Manejador centralizado de errores de Supabase ---
  const handleSupabaseError = (error, context) => {
    console.error(`${context}:`, error.message);
    if (error.message.toLowerCase().includes('fetch')) {
      setNetworkError(true);
    } else {
      showMessage('error', `${context}: ${error.message}`);
    }
  };

  // --- Cierre de sesión ---
  const handleLogout = async () => {
    if (user?.isDemo) {
      sessionStorage.removeItem('demo_session');
      window.location.reload();
      return;
    }
    await supabase.auth.signOut();
  };

  // --- Carga de historial desde Supabase o almacenamiento local Demo ---
  const fetchHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);

    if (user.isDemo) {
      const demoData = localStorage.getItem(`demo_metrics_${user.id}`);
      setHistory(demoData ? JSON.parse(demoData) : []);
      setIsLoadingHistory(false);
      return;
    }

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

    // Recuperar estado persistido del temporizador y contadores del día actual
    const savedState = localStorage.getItem(timerStateStorageKey);
    const todayStr = getTodayDateStr();
    const savedCounts = localStorage.getItem(countsStorageKey(todayStr));

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        const { seconds, isRunning, startTime, date } = parsed;

        // Solo restaurar si pertenece a la fecha de hoy
        if (date === todayStr) {
          if (isRunning && startTime) {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            setTimerSeconds(elapsed >= 0 ? elapsed : 0);
            setIsTimerRunning(true);
            startTimeRef.current = startTime;
          } else {
            setTimerSeconds(seconds || 0);
            setIsTimerRunning(false);
          }
        } else {
          // Reiniciar temporizador obsoleto de jornadas anteriores a 00:00:00
          setTimerSeconds(0);
          setIsTimerRunning(false);
          localStorage.removeItem(timerStateStorageKey);
        }
      } catch (e) {
        console.error('Error al cargar estado del temporizador:', e);
        setTimerSeconds(0);
        setIsTimerRunning(false);
      }
    } else {
      setTimerSeconds(0);
      setIsTimerRunning(false);
    }

    if (savedCounts) {
      try {
        const { closed, managed, technicians, transferred = 0 } = JSON.parse(savedCounts);
        setClosedCount(closed || 0);
        setManagedCount(managed || 0);
        setTechniciansCount(technicians || 0);
        setTransferredCount(transferred || 0);
      } catch (e) {
        console.error('Error al cargar contadores guardados:', e);
      }
    }
  }, [user]);

  // Persistir estado del temporizador etiquetado con la fecha local
  useEffect(() => {
    const todayStr = getTodayDateStr();
    const state = {
      seconds: timerSeconds,
      isRunning: isTimerRunning,
      startTime: startTimeRef.current,
      date: todayStr
    };
    localStorage.setItem(timerStateStorageKey, JSON.stringify(state));
  }, [timerSeconds, isTimerRunning, user, timerStateStorageKey]);

  // Persistir contadores diarios en localStorage
  useEffect(() => {
    const dateStr = getTodayDateStr();
    const counts = {
      closed: closedCount,
      managed: managedCount,
      technicians: techniciansCount,
      transferred: transferredCount
    };
    localStorage.setItem(countsStorageKey(dateStr), JSON.stringify(counts));
  }, [closedCount, managedCount, techniciansCount, transferredCount, user, storageScope]);

  // --- Auto-guardado inteligente tras 4s de inactividad en los contadores ---
  useEffect(() => {
    if (managedCount === 0 && timerSeconds === 0) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveToSupabase();
    }, 4000);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [closedCount, managedCount, techniciansCount, transferredCount]);

  const historyWithAccum = useMemo(() => {
    const monthFiltered = history.filter(item => item.date.startsWith(searchMonth));
    const sorted = [...monthFiltered].sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningManaged = 0;
    let runningClosed = 0;
    let runningTechnicians = 0;
    let runningTransferred = 0;
    let runningSeconds = 0;

    const withAccum = sorted.map(item => {
      const [h, m, s] = item.total_time.split(':').map(Number);
      const rowSeconds = (h * 3600) + (m * 60) + s;

      runningManaged += item.cases_managed || 0;
      runningClosed += item.cases_closed || 0;
      runningTechnicians += item.technicians_sent || 0;
      runningTransferred += item.cases_transferred || 0;
      runningSeconds += rowSeconds;

      const totalHours = runningSeconds / 3600;

      const accumCloseRate = runningManaged > 0 ? ((runningClosed / runningManaged) * 100).toFixed(2) : "0.00";
      const accumResoRate = runningManaged > 0 ? (((runningManaged - runningTechnicians) / runningManaged) * 100).toFixed(2) : "0.00";
      const accumGxH = totalHours > 0 ? (runningManaged / totalHours).toFixed(2) : "0.00";

      const accumBonus = calculateRecordBonus(accumGxH, accumResoRate);

      const closingDiff = item.cases_managed > 0 ? (item.cases_closed - Math.ceil(item.cases_managed * (standards.CLOSED_GREEN / 100))) : 0;

      const accumClosingDiff = runningManaged > 0 ? (runningClosed - Math.ceil(runningManaged * (standards.CLOSED_GREEN / 100))) : 0;
      const accumGxhDiff = runningSeconds > 0 ? (runningManaged - ((runningSeconds / 3600) * standards.GXH_GREEN)) : 0;
      const zeroResolutionTier = (standards.resolution_bonus_tiers || DEFAULT_RESOLUTION_TIERS).find(tier => Number(tier.bonus) === 0);
      const accumResoDiff = runningManaged > 0 ? ((runningManaged - runningTechnicians) - Math.ceil(runningManaged * (Number(zeroResolutionTier?.min ?? standards.RESOLUTION_GREEN) / 100))) : 0;
      const accumTmoManaged = runningManaged > 0 ? Math.floor(runningSeconds / runningManaged) : 0;

      return {
        ...item,
        accumManaged: runningManaged,
        accumClosed: runningClosed,
        accumTechnicians: runningTechnicians,
        accumTransferred: runningTransferred,
        accumSeconds: runningSeconds,
        accumCloseRate,
        accumResoRate,
        accumGxH,
        accumBonus,
        closingDiff,
        accumClosingDiff,
        accumGxhDiff: accumGxhDiff.toFixed(2),
        accumResoDiff,
        accumTmoManaged
      };
    });

    return withAccum;
  }, [history, searchMonth, calculateRecordBonus, standards]);

  const accumulatedBonusTotal = useMemo(() => {
    if (historyWithAccum.length === 0) return 0;
    const lastItem = historyWithAccum[historyWithAccum.length - 1];
    return lastItem.accumBonus || 0;
  }, [historyWithAccum]);

  const currentAccum = useMemo(() => {
    if (historyWithAccum.length === 0) return null;
    return historyWithAccum[historyWithAccum.length - 1];
  }, [historyWithAccum]);

  const filteredHistory = useMemo(() => {
    if (!searchDate) return historyWithAccum;
    return historyWithAccum.filter(item => item.date.includes(searchDate));
  }, [historyWithAccum, searchDate]);

  // --- Timer Logic ---
  useEffect(() => {
    if (isTimerRunning) {
      startTimeRef.current = Date.now() - (timerSeconds * 1000);
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        setTimerSeconds(elapsed);
      }, 500);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning]);

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
    if (!isNowRunning) {
      autoSaveToSupabase();
    }
  };

  const resetAll = () => {
    requestConfirm(
      '¿Reiniciar Todo?',
      '¿Estás seguro de reiniciar todos los contadores? Se perderá el progreso que no hayas guardado.',
      () => {
        setClosedCount(0);
        setManagedCount(0);
        setTechniciansCount(0);
        setTransferredCount(0);
        setTimerSeconds(0);
        setIsTimerRunning(false);
        startTimeRef.current = null;
        localStorage.removeItem('gxh_timer_state');
        localStorage.removeItem(countsStorageKey(getTodayDateStr()));
        showMessage('info', 'Contadores reiniciados.');
      },
      'danger',
      'Reiniciar'
    );
  };

  // --- Manual Edit Handlers ---
  const saveManualClosed = () => {
    const val = parseInt(manualCountInput) || 0;
    if (val > managedCount - transferredCount) {
      showMessage('error', 'Cerrados y transferidos no pueden superar los casos gestionados');
      return;
    }
    setClosedCount(val);
    setIsEditingClosed(false);
  };

  const saveManualManaged = () => {
    const val = parseInt(manualCountInput) || 0;
    if (val < closedCount + transferredCount) {
      showMessage('error', 'Gestionados no puede ser menor que la suma de cerrados y transferidos');
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

  // --- Derived Metrics ---
  const stats = useMemo(() => {
    const totalHours = timerSeconds / 3600;
    const closeRate = managedCount > 0 ? (closedCount / managedCount) * 100 : 0;
    const resolutionRate = managedCount > 0 ? ((managedCount - techniciansCount) / managedCount) * 100 : 0;
    const managedPerHour = totalHours > 0 ? managedCount / totalHours : 0;
    const closedPerHour = totalHours > 0 ? closedCount / totalHours : 0;
    const tmoCase = closedCount > 0 ? Math.floor(timerSeconds / closedCount) : 0;
    const tmoManaged = managedCount > 0 ? Math.floor(timerSeconds / managedCount) : 0;

    const closingBalance = managedCount > 0 ? (closedCount - Math.ceil(managedCount * (standards.CLOSED_GREEN / 100))) : 0;
    const gxhDiff = totalHours > 0 ? (managedCount - (totalHours * standards.GXH_GREEN)) : 0;
    const zeroResolutionTier = (standards.resolution_bonus_tiers || DEFAULT_RESOLUTION_TIERS).find(tier => Number(tier.bonus) === 0);
    const resoDiff = managedCount > 0 ? ((managedCount - techniciansCount) - Math.ceil(managedCount * (Number(zeroResolutionTier?.min ?? standards.RESOLUTION_GREEN) / 100))) : 0;

    return {
      closeRate: closeRate.toFixed(2),
      resolutionRate: resolutionRate.toFixed(2),
      managedPerHour: managedPerHour.toFixed(2),
      closedPerHour: closedPerHour.toFixed(2),
      tmoCase,
      tmoManaged,
      closingBalance,
      gxhDiff: gxhDiff.toFixed(2),
      resoDiff
    };
  }, [closedCount, managedCount, techniciansCount, timerSeconds, standards]);

  // --- Chart Data ---
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: null, text: '' }), 4000);
  };

  // --- Construcción unificada del payload de métricas diarias ---
  const buildMetricsPayload = (dateStr) => ({
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
    cases_transferred: transferredCount,
    resolution_rate: parseFloat(stats.resolutionRate)
  });

  // --- Persistencia local para sesiones en modo Demo / Espectador ---
  const persistDemoMetrics = (payload, dateStr) => {
    payload.id = "demo-" + Date.now();
    const demoDataStr = localStorage.getItem(`demo_metrics_${user.id}`);
    const demoList = demoDataStr ? JSON.parse(demoDataStr) : [];
    const existingIndex = demoList.findIndex(item => item.date === dateStr);
    if (existingIndex !== -1) {
      payload.id = demoList[existingIndex].id;
      demoList[existingIndex] = payload;
    } else {
      demoList.unshift(payload);
    }
    localStorage.setItem(`demo_metrics_${user.id}`, JSON.stringify(demoList));
    return demoList;
  };

  // --- Guardado manual de métricas en base de datos ---
  const saveToSupabase = async () => {
    if (!user) return;
    setIsSaving(true);
    const dateStr = getTodayDateStr();
    const payload = buildMetricsPayload(dateStr);

    if (user.isDemo) {
      const demoList = persistDemoMetrics(payload, dateStr);
      setTimeout(() => {
        showMessage('success', 'Métricas de espectador guardadas localmente.');
        setLastSavedAt(new Date());
        setHistory(demoList);
        setIsSaving(false);
      }, 500);
      return;
    }

    const { error } = await supabase.from('daily_metrics').upsert([payload], { onConflict: 'user_id,date' });

    if (error) {
      handleSupabaseError(error, 'Error al guardar métricas');
    } else {
      showMessage('success', 'Métricas guardadas correctamente.');
      setLastSavedAt(new Date());
      setNetworkError(false);
      await fetchHistory();
    }
    setIsSaving(false);
  };

  // --- Auto-guardado en segundo plano ---
  const autoSaveToSupabase = async () => {
    if (!user || managedCount === 0 || isSaving) return;

    setIsAutoSaving(true);
    const dateStr = getTodayDateStr();
    const payload = buildMetricsPayload(dateStr);

    if (user.isDemo) {
      const demoList = persistDemoMetrics(payload, dateStr);
      setLastSavedAt(new Date());
      setHistory(demoList);
      setIsAutoSaving(false);
      return;
    }

    const { error } = await supabase.from('daily_metrics').upsert([payload], { onConflict: 'user_id,date' });

    if (!error) {
      setLastSavedAt(new Date());
      setNetworkError(false);
      const { data } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (data) setHistory(data);
    }
    setIsAutoSaving(false);
  };

  const handleDeleteRecord = async (id) => {
    requestConfirm(
      '¿Eliminar Registro?',
      '¿Seguro deseas borrar este registro? No podrás recuperarlo...',
      async () => {
        if (user.isDemo) {
          const demoDataStr = localStorage.getItem(`demo_metrics_${user.id}`);
          let demoList = demoDataStr ? JSON.parse(demoDataStr) : [];
          demoList = demoList.filter(item => item.id !== id);
          localStorage.setItem(`demo_metrics_${user.id}`, JSON.stringify(demoList));
          
          showMessage('success', 'Registro demo eliminado correctamente.');
          setHistory(demoList);
          return;
        }

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
    setEditingRecord(record);
    setShowEditRecordModal(true);
  };

  const addManaged = () => {
    setManagedCount(prev => prev + 1);
  };

  const subtractManaged = () => {
    if (managedCount > closedCount + transferredCount) {
      setManagedCount(prev => prev - 1);
    }
  };

  const addTransferred = () => setTransferredCount(prev => prev < managedCount - closedCount ? prev + 1 : prev);
  const subtractTransferred = () => setTransferredCount(prev => Math.max(0, prev - 1));

  return (
    <div className="app-layout">
      <DashboardSidebar
        user={user}
        profile={profile}
        timerSeconds={timerSeconds}
        isTimerRunning={isTimerRunning}
        toggleTimer={toggleTimer}
        onOpenEditTime={() => setShowEditTimeModal(true)}
        closedCount={closedCount}
        setClosedCount={setClosedCount}
        managedCount={managedCount}
        onAddManaged={addManaged}
        onSubtractManaged={subtractManaged}
        techniciansCount={techniciansCount}
        setTechniciansCount={setTechniciansCount}
        transferredCount={transferredCount}
        onAddTransferred={addTransferred}
        onSubtractTransferred={subtractTransferred}
        standards={standards}
        accumulatedBonusTotal={accumulatedBonusTotal}
        stats={stats}
        getGxHBonus={getGxHBonus}
        getResolucionBonus={getResolucionBonus}
        calculateRecordBonus={calculateRecordBonus}
        resetAll={resetAll}
        handleLogout={handleLogout}
        onNavigateToAdmin={() => navigate('/admin')}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '20px' }}>
          {(profile?.role === 'admin' || user?.isDemo) && (
            <button 
              className="btn btn-secondary" 
              style={{ 
                padding: '6px 14px', 
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--border-strong)'
              }}
              onClick={() => navigate('/status')}
              title="Centro de Estado Técnico y Anti-bloqueo DNS"
            >
              <Activity size={14} style={{ color: '#10b981' }} /> ESTADO RED / STATUS
            </button>
          )}
          <button 
            className="btn btn-secondary" 
            style={{ 
              padding: '6px 14px', 
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.05em'
            }}
            onClick={() => setShowHelpModal(true)}
          >
            <BookOpen size={14} style={{ marginRight: '6px' }} /> MANUAL / CÓMO FUNCIONA
          </button>
        </div>

        {message.text && (
          <div className={`mensaje activo mensaje-${message.type}`}>
            {message.type === 'success' && <CheckCircle2 size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.type === 'error' && <AlertCircle size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.text}
          </div>
        )}

        <section style={{ margin: '4px 0 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: 'var(--primary-light)' }}>NIVEL 1</span>
            <h1 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 20 }}>Registro de jornada</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>Cargá tus gestiones, cierres y técnicos enviados. Los indicadores se actualizan con estos datos.</p>
        </section>

        <DashboardStats
          user={user}
          timerSeconds={timerSeconds}
          isEditingClosed={isEditingClosed}
          setIsEditingClosed={setIsEditingClosed}
          isEditingManaged={isEditingManaged}
          setIsEditingManaged={setIsEditingManaged}
          closedCount={closedCount}
          managedCount={managedCount}
          techniciansCount={techniciansCount}
          transferredCount={transferredCount}
          manualCountInput={manualCountInput}
          setManualCountInput={setManualCountInput}
          saveManualClosed={saveManualClosed}
          saveManualManaged={saveManualManaged}
          handleManualInputKeyDown={handleManualInputKeyDown}
          stats={stats}
          standards={standards}
          currentAccum={currentAccum}
          saveToSupabase={saveToSupabase}
          isSaving={isSaving}
          isAutoSaving={isAutoSaving}
          lastSavedAt={lastSavedAt}
          getStatusClass={getStatusClass}
          accumulatedBonusTotal={accumulatedBonusTotal}
          getGxHBonus={getGxHBonus}
          getResolucionBonus={getResolucionBonus}
          calculateRecordBonus={calculateRecordBonus}
        />

        <section style={{ margin: '30px 0 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: 'var(--primary-light)' }}>NIVEL 4</span>
            <h2 style={{ margin: 0, color: 'var(--text-bright)', fontSize: 17 }}>Historial y evolución</h2>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>Consultá tus registros anteriores, corregí datos y analizá tu evolución.</p>
        </section>
        <HistoryTables
          isLoadingHistory={isLoadingHistory}
          filteredHistory={filteredHistory}
          searchMonth={searchMonth}
          setSearchMonth={setSearchMonth}
          searchDate={searchDate}
          setSearchDate={setSearchDate}
          handleOpenEditModal={handleOpenEditModal}
          handleDeleteRecord={handleDeleteRecord}
          getStatusClass={getStatusClass}
          standards={standards}
          latestRecordDate={history.reduce((latest, item) => !latest || item.date > latest ? item.date : latest, null)}
          currentDate={new Date().toLocaleDateString('en-CA')}
        />

        <Suspense fallback={<div className="metric-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando gráficos de evolución...</div>}>
          <DashboardCharts
            history={history}
            standards={standards}
            calculateRecordBonus={calculateRecordBonus}
            theme={theme}
          />
        </Suspense>
      </main>

      <EditTimeModal
        show={showEditTimeModal}
        onClose={() => setShowEditTimeModal(false)}
        timerSeconds={timerSeconds}
        onSave={(total) => {
          setTimerSeconds(total);
          if (isTimerRunning) {
            startTimeRef.current = Date.now() - (total * 1000);
          }
          setShowEditTimeModal(false);
          setTimeout(() => autoSaveToSupabase(), 500);
        }}
      />

      <EditRecordModal
        show={showEditRecordModal}
        onClose={() => setShowEditRecordModal(false)}
        editingRecord={editingRecord}
        isSaving={isSaving}
        onSave={async (formData) => {
          setIsSaving(true);
          const totalSeconds = (formData.h * 3600) + (formData.m * 60) + formData.s;
          const totalHours = totalSeconds / 3600;

          const closeRate = formData.managed > 0 ? (formData.closed / formData.managed) * 100 : 0;
          const resolutionRate = formData.managed > 0 ? ((formData.managed - formData.technicians) / formData.managed) * 100 : 0;
          const managedPerHour = totalHours > 0 ? formData.managed / totalHours : 0;
          const closedPerHour = totalHours > 0 ? formData.closed / totalHours : 0;
          const tmoCase = formData.closed > 0 ? Math.floor(totalSeconds / formData.closed) : 0;
          const tmoManaged = formData.managed > 0 ? Math.floor(totalSeconds / formData.managed) : 0;

          const payload = {
            id: editingRecord.id,
            user_id: user.id,
            date: formData.date,
            total_time: formatTime(totalSeconds),
            cases_closed: formData.closed,
            cases_managed: formData.managed,
            efficiency: parseFloat(closeRate.toFixed(2)),
            cases_per_hour: parseFloat(managedPerHour.toFixed(2)),
            avg_closed_per_hour: parseFloat(closedPerHour.toFixed(2)),
            tmo_case: tmoCase,
            tmo_managed: tmoManaged,
            technicians_sent: formData.technicians,
            cases_transferred: Math.min(formData.transferred, Math.max(0, formData.managed - formData.closed)),
            resolution_rate: parseFloat(resolutionRate.toFixed(2))
          };

          if (user.isDemo) {
            const demoDataStr = localStorage.getItem(`demo_metrics_${user.id}`);
            let demoList = demoDataStr ? JSON.parse(demoDataStr) : [];
            demoList = demoList.map(item => item.id === editingRecord.id ? payload : item);
            localStorage.setItem(`demo_metrics_${user.id}`, JSON.stringify(demoList));
            
            showMessage('success', 'Registro demo actualizado correctamente.');
            setShowEditRecordModal(false);
            setHistory(demoList);
            setIsSaving(false);
            return;
          }

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
        }}
      />

      <ConfirmModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />

      <HelpModal
        show={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        STANDARDS={STANDARDS}
        formatTmoMin={formatTmoMin}
      />
    </div>
  );
}

export default Dashboard;
