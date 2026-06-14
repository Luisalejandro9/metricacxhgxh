import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

// Subcomponents
import ConfirmModal from './dashboard/modals/ConfirmModal';
import HelpModal from './dashboard/modals/HelpModal';
import EditTimeModal from './dashboard/modals/EditTimeModal';
import EditRecordModal from './dashboard/modals/EditRecordModal';
import DashboardSidebar from './dashboard/DashboardSidebar';
import DashboardStats from './dashboard/DashboardStats';
import HistoryTables from './dashboard/HistoryTables';
import DashboardCharts from './dashboard/DashboardCharts';

const STANDARDS = {
  // GxH Working
  GXH_GREEN: 4.00,
  GXH_YELLOW: 3.50,

  // % Resolución Neta (bonifica)
  RESOLUTION_GREEN: 84.0,
  RESOLUTION_YELLOW: 81.0,

  // Cierre — solo objetivo, NO bonifica
  CLOSED_GREEN: 78.8,
  CLOSED_YELLOW: 76.8,

  // Tiempos
  TIME_PER_CASE: 950,
  TIME_PER_MANAGED: 950,
};

const DEFAULT_GXH_TIERS = [
  { min: 4.50, bonus: 2.0 },
  { min: 4.00, bonus: 1.0 },
  { min: 3.50, bonus: 0.0 },
  { min: 3.00, bonus: -1.0 },
  { min: 0.00, bonus: -2.0 }
];

const DEFAULT_RESOLUTION_TIERS = [
  { min: 84.00, bonus: 3.0 },
  { min: 83.00, bonus: 2.0 },
  { min: 82.00, bonus: 1.0 },
  { min: 81.00, bonus: 0.0 },
  { min: 80.00, bonus: -1.0 },
  { min: 0.00, bonus: -2.0 }
];

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

function Dashboard({ user, profile, setNetworkError }) {
  const navigate = useNavigate();

  // Dynamic Standards State
  const [standards, setStandards] = useState(() => {
    if (user?.isDemo) {
      const local = localStorage.getItem(`demo_app_standards_${user.id}`);
      if (local) {
        try {
          return JSON.parse(local);
        } catch (e) {
          console.error('Error loading demo standards', e);
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

  // Dynamic Bonus Calculators using useCallback
  const getGxHBonus = useCallback((value) => {
    const val = parseFloat(value);
    const tiers = standards.gxh_bonus_tiers || DEFAULT_GXH_TIERS;
    const sorted = [...tiers].sort((a, b) => b.min - a.min);
    for (const t of sorted) {
      if (val >= t.min) return parseFloat(t.bonus);
    }
    return parseFloat(sorted[sorted.length - 1]?.bonus || -2.0);
  }, [standards.gxh_bonus_tiers]);

  const getResolucionBonus = useCallback((value) => {
    const val = parseFloat(value);
    const tiers = standards.resolution_bonus_tiers || DEFAULT_RESOLUTION_TIERS;
    const sorted = [...tiers].sort((a, b) => b.min - a.min);
    for (const t of sorted) {
      if (val >= t.min) return parseFloat(t.bonus);
    }
    return parseFloat(sorted[sorted.length - 1]?.bonus || -2.0);
  }, [standards.resolution_bonus_tiers]);

  const calculateRecordBonus = useCallback((managedPerHour, resolutionRate) => {
    return getGxHBonus(managedPerHour) + getResolucionBonus(resolutionRate);
  }, [getGxHBonus, getResolucionBonus]);

  // Fetch standards from db on mount and subscribe to live changes
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
          console.warn('Error fetching app_config (falling back to default standards):', error.message);
        } else if (data) {
          setStandards({
            GXH_GREEN: parseFloat(data.gxh_green),
            GXH_YELLOW: parseFloat(data.gxh_yellow),
            RESOLUTION_GREEN: parseFloat(data.resolution_green),
            RESOLUTION_YELLOW: parseFloat(data.resolution_yellow),
            CLOSED_GREEN: parseFloat(data.closed_green),
            CLOSED_YELLOW: parseFloat(data.closed_yellow),
            TIME_PER_CASE: parseInt(data.time_per_case),
            TIME_PER_MANAGED: parseInt(data.time_per_managed),
            gxh_bonus_tiers: Array.isArray(data.gxh_bonus_tiers) ? data.gxh_bonus_tiers : DEFAULT_GXH_TIERS,
            resolution_bonus_tiers: Array.isArray(data.resolution_bonus_tiers) ? data.resolution_bonus_tiers : DEFAULT_RESOLUTION_TIERS
          });
        }
      } catch (err) {
        console.error('Failed to load standards:', err);
      } finally {
        setIsLoadingStandards(false);
      }
    };

    fetchStandards();

    // Subscribe to configuration changes in real time
    if (!user?.isDemo) {
      const channel = supabase
        .channel('app_config_live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (payload) => {
          if (payload.new && payload.new.key === 'current') {
            const data = payload.new;
            setStandards({
              GXH_GREEN: parseFloat(data.gxh_green),
              GXH_YELLOW: parseFloat(data.gxh_yellow),
              RESOLUTION_GREEN: parseFloat(data.resolution_green),
              RESOLUTION_YELLOW: parseFloat(data.resolution_yellow),
              CLOSED_GREEN: parseFloat(data.closed_green),
              CLOSED_YELLOW: parseFloat(data.closed_yellow),
              TIME_PER_CASE: parseInt(data.time_per_case),
              TIME_PER_MANAGED: parseInt(data.time_per_managed),
              gxh_bonus_tiers: Array.isArray(data.gxh_bonus_tiers) ? data.gxh_bonus_tiers : DEFAULT_GXH_TIERS,
              resolution_bonus_tiers: Array.isArray(data.resolution_bonus_tiers) ? data.resolution_bonus_tiers : DEFAULT_RESOLUTION_TIERS
            });
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

  const getStatusClass = (value, greenTarget, yellowTarget) => {
    const val = parseFloat(value);
    if (val >= greenTarget) return 'stat-meets-standard';
    if (val >= yellowTarget) return 'stat-warning-standard';
    return 'stat-below-standard';
  };

  // --- Centralized Error Helper ---
  const handleSupabaseError = (error, context) => {
    console.error(`${context}:`, error.message);
    if (error.message.toLowerCase().includes('fetch')) {
      setNetworkError(true);
    } else {
      showMessage('error', `${context}: ${error.message}`);
    }
  };

  // --- Auth Handlers ---
  const handleLogout = async () => {
    if (user?.isDemo) {
      sessionStorage.removeItem('demo_session');
      window.location.reload();
      return;
    }
    await supabase.auth.signOut();
  };

  // --- Data Fetching ---
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
  useEffect(() => {
    if (managedCount === 0 && timerSeconds === 0) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveToSupabase();
    }, 4000);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [closedCount, managedCount, techniciansCount]);

  const historyWithAccum = useMemo(() => {
    const monthFiltered = history.filter(item => item.date.startsWith(searchMonth));
    const sorted = [...monthFiltered].sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningManaged = 0;
    let runningClosed = 0;
    let runningTechnicians = 0;
    let runningSeconds = 0;

    const withAccum = sorted.map(item => {
      const [h, m, s] = item.total_time.split(':').map(Number);
      const rowSeconds = (h * 3600) + (m * 60) + s;

      runningManaged += item.cases_managed || 0;
      runningClosed += item.cases_closed || 0;
      runningTechnicians += item.technicians_sent || 0;
      runningSeconds += rowSeconds;

      const totalHours = runningSeconds / 3600;

      const accumCloseRate = runningManaged > 0 ? ((runningClosed / runningManaged) * 100).toFixed(2) : "0.00";
      const accumResoRate = runningManaged > 0 ? (((runningManaged - runningTechnicians) / runningManaged) * 100).toFixed(2) : "0.00";
      const accumGxH = totalHours > 0 ? (runningManaged / totalHours).toFixed(2) : "0.00";

      const accumBonus = calculateRecordBonus(accumGxH, accumResoRate);

      const closingDiff = item.cases_managed > 0 ? (item.cases_closed - Math.ceil(item.cases_managed * (standards.CLOSED_GREEN / 100))) : 0;

      const accumClosingDiff = runningManaged > 0 ? (runningClosed - Math.ceil(runningManaged * (standards.CLOSED_GREEN / 100))) : 0;
      const accumGxhDiff = runningSeconds > 0 ? (runningManaged - ((runningSeconds / 3600) * standards.GXH_GREEN)) : 0;
      const accumResoDiff = runningManaged > 0 ? ((runningManaged - runningTechnicians) - Math.ceil(runningManaged * (standards.RESOLUTION_GREEN / 100))) : 0;
      const accumTmoManaged = runningManaged > 0 ? Math.floor(runningSeconds / runningManaged) : 0;

      return {
        ...item,
        accumManaged: runningManaged,
        accumClosed: runningClosed,
        accumTechnicians: runningTechnicians,
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
    const resoDiff = managedCount > 0 ? ((managedCount - techniciansCount) - Math.ceil(managedCount * (standards.RESOLUTION_GREEN / 100))) : 0;

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
  const chartData = useMemo(() => {
    const sorted = [...filteredHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      labels: sorted.map(d => {
        const parts = d.date.split('-');
        return `${parts[2]}/${parts[1]}`;
      }),
      datasets: [
        {
          label: 'GxH (Gest/Hora)',
          data: sorted.map(d => parseFloat(d.cases_per_hour)),
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          yAxisID: 'y',
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(99, 102, 241, 1)'
        },
        {
          label: 'TMO Gest. (min)',
          data: sorted.map(d => parseFloat((d.tmo_managed / 60).toFixed(2))),
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          yAxisID: 'y1',
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)'
        }
      ]
    };
  }, [filteredHistory]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        labels: { color: '#e2e8f0', font: { family: 'Inter', size: 12, weight: '500' } }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        ticks: { color: 'rgba(99, 102, 241, 1)' },
        grid: { color: 'rgba(255,255,255,0.05)' },
        title: { display: true, text: 'GxH', color: '#94a3b8' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        ticks: { color: 'rgba(16, 185, 129, 1)' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'TMO (min)', color: '#94a3b8' }
      },
    },
  };

  const chartDataReso = useMemo(() => {
    const sorted = [...filteredHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      labels: sorted.map(d => {
        const parts = d.date.split('-');
        return `${parts[2]}/${parts[1]}`;
      }),
      datasets: [
        {
          label: '% Resolución',
          data: sorted.map(d => parseFloat(d.resolution_rate)),
          borderColor: 'rgba(236, 72, 153, 1)',
          backgroundColor: 'rgba(236, 72, 153, 0.2)',
          yAxisID: 'y',
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(236, 72, 153, 1)'
        },
        {
          label: 'Técnicos Enviados',
          data: sorted.map(d => parseInt(d.technicians_sent)),
          borderColor: 'rgba(234, 179, 8, 1)',
          backgroundColor: 'rgba(234, 179, 8, 0.2)',
          yAxisID: 'y1',
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(234, 179, 8, 1)'
        }
      ]
    };
  }, [filteredHistory]);

  const chartOptionsReso = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        labels: { color: '#e2e8f0', font: { family: 'Inter', size: 12, weight: '500' } }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        ticks: { color: 'rgba(236, 72, 153, 1)' },
        grid: { color: 'rgba(255,255,255,0.05)' },
        title: { display: true, text: '% Resolución', color: '#94a3b8' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        ticks: { color: 'rgba(234, 179, 8, 1)' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Técnicos', color: '#94a3b8' },
        min: 0,
        suggestedMax: 10
      },
    },
  };

  const chartDataGxhCerrados = useMemo(() => {
    const sorted = [...filteredHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      labels: sorted.map(d => {
        const parts = d.date.split('-');
        return `${parts[2]}/${parts[1]}`;
      }),
      datasets: [
        {
          label: 'GxH (Gest/Hora)',
          data: sorted.map(d => parseFloat(d.cases_per_hour)),
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          yAxisID: 'y',
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(99, 102, 241, 1)'
        },
        {
          label: 'Casos Cerrados',
          data: sorted.map(d => parseInt(d.cases_closed)),
          borderColor: 'rgba(14, 165, 233, 1)',
          backgroundColor: 'rgba(14, 165, 233, 0.2)',
          yAxisID: 'y1',
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(14, 165, 233, 1)'
        }
      ]
    };
  }, [filteredHistory]);

  const chartOptionsGxhCerrados = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        labels: { color: '#e2e8f0', font: { family: 'Inter', size: 12, weight: '500' } }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        ticks: { color: 'rgba(99, 102, 241, 1)' },
        grid: { color: 'rgba(255,255,255,0.05)' },
        title: { display: true, text: 'GxH', color: '#94a3b8' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        ticks: { color: 'rgba(14, 165, 233, 1)' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Casos Cerrados', color: '#94a3b8' },
        min: 0
      },
    },
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: null, text: '' }), 4000);
  };

  // --- Save Metrics to Database ---
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

    if (user.isDemo) {
      payload.id = "demo-" + Date.now();
      const demoDataStr = localStorage.getItem(`demo_metrics_${user.id}`);
      let demoList = demoDataStr ? JSON.parse(demoDataStr) : [];
      const existingIndex = demoList.findIndex(item => item.date === dateStr);
      if (existingIndex !== -1) {
        payload.id = demoList[existingIndex].id;
        demoList[existingIndex] = payload;
      } else {
        demoList.unshift(payload);
      }
      localStorage.setItem(`demo_metrics_${user.id}`, JSON.stringify(demoList));
      
      setTimeout(() => {
        showMessage('success', '¡Métricas de espectador guardadas localmente!');
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

    if (user.isDemo) {
      payload.id = "demo-" + Date.now();
      const demoDataStr = localStorage.getItem(`demo_metrics_${user.id}`);
      let demoList = demoDataStr ? JSON.parse(demoDataStr) : [];
      const existingIndex = demoList.findIndex(item => item.date === dateStr);
      if (existingIndex !== -1) {
        payload.id = demoList[existingIndex].id;
        demoList[existingIndex] = payload;
      } else {
        demoList.unshift(payload);
      }
      localStorage.setItem(`demo_metrics_${user.id}`, JSON.stringify(demoList));
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
    if (managedCount > closedCount) {
      setManagedCount(prev => prev - 1);
    }
  };

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
        standards={standards}
        accumulatedBonusTotal={accumulatedBonusTotal}
        stats={stats}
        getGxHBonus={getGxHBonus}
        getResolucionBonus={getResolucionBonus}
        calculateRecordBonus={calculateRecordBonus}
        resetAll={resetAll}
        handleLogout={handleLogout}
        onNavigateToAdmin={() => navigate('/admin')}
      />

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button 
            className="btn" 
            style={{ 
              borderRadius: 'var(--radius-full)', 
              padding: '8px 16px', 
              background: 'rgba(99, 102, 241, 0.1)', 
              color: 'var(--primary-light)', 
              border: '1px solid rgba(99, 102, 241, 0.2)',
              fontSize: '12px',
              fontWeight: '700'
            }}
            onClick={() => setShowHelpModal(true)}
          >
            <BookOpen size={16} style={{ marginRight: '8px' }} /> Manual / Cómo funciona
          </button>
        </div>

        {message.text && (
          <div className={`mensaje activo mensaje-${message.type}`}>
            {message.type === 'success' && <CheckCircle2 size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.type === 'error' && <AlertCircle size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.text}
          </div>
        )}

        <DashboardStats
          isEditingClosed={isEditingClosed}
          setIsEditingClosed={setIsEditingClosed}
          isEditingManaged={isEditingManaged}
          setIsEditingManaged={setIsEditingManaged}
          closedCount={closedCount}
          managedCount={managedCount}
          techniciansCount={techniciansCount}
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
        />

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
        />

        <DashboardCharts
          filteredHistory={filteredHistory}
          chartData={chartData}
          chartOptions={chartOptions}
          chartDataReso={chartDataReso}
          chartOptionsReso={chartOptionsReso}
          chartDataGxhCerrados={chartDataGxhCerrados}
          chartOptionsGxhCerrados={chartOptionsGxhCerrados}
        />
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
