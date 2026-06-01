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
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
const STANDARDS = {
  // GxH Working
  GXH_GREEN: 4.00,
  GXH_YELLOW: 3.50,

  // % Resolución Neta (bonifica)
  RESOLUTION_GREEN: 81.5,
  RESOLUTION_YELLOW: 78.6,

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
  if (val >= 81.5) return 3.0;
  if (val >= 80.1) return 2.0;
  if (val >= 78.6) return 1.0;
  if (val >= 77.2) return 0.0;
  if (val >= 75.8) return -1.0;
  return -2.0;
};

// Bono diario = GxH + Resolución (Cierre NO bonifica, solo es objetivo)
const calculateRecordBonus = (managedPerHour, resolutionRate) => {
  return getGxHBonus(managedPerHour) + getResolucionBonus(resolutionRate);
};

// Formatear segundos de TMO a minutos amigables (ej: 950s -> 15:50 min)
const formatTmoMin = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00 min";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
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
    // Filtrar por mes seleccionado primero para separar los datos y que no se mezclen los acumulados
    const monthFiltered = history.filter(item => item.date.startsWith(searchMonth));

    // Sort ascending to calculate accumulators correctly
    const sorted = [...monthFiltered].sort((a, b) => new Date(a.date) - new Date(b.date));

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

      // Compute accumulated metrics first
      const accumCloseRate = runningManaged > 0 ? ((runningClosed / runningManaged) * 100).toFixed(2) : "0.00";
      const accumResoRate = runningManaged > 0 ? (((runningManaged - runningTechnicians) / runningManaged) * 100).toFixed(2) : "0.00";
      const accumGxH = totalHours > 0 ? (runningManaged / totalHours).toFixed(2) : "0.00";

      // Bono del periodo acumulado hasta este día (usa acumulados, NO valores del día)
      const accumBonus = calculateRecordBonus(accumGxH, accumResoRate);

      // Diferencia de cierre del día (naturales)
      const closingDiff = item.cases_managed > 0 ? (item.cases_closed - Math.ceil(item.cases_managed * 0.79)) : 0;

      // Diferencias acumuladas del mes hasta este día
      const accumClosingDiff = runningManaged > 0 ? (runningClosed - Math.ceil(runningManaged * 0.79)) : 0;
      const accumGxhDiff = runningSeconds > 0 ? (runningManaged - ((runningSeconds / 3600) * 4.0)) : 0;
      const accumResoDiff = runningManaged > 0 ? ((runningManaged - runningTechnicians) - Math.ceil(runningManaged * 0.81)) : 0;
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
        accumBonus, // bono según acumulados hasta este día
        closingDiff,
        accumClosingDiff,
        accumGxhDiff: accumGxhDiff.toFixed(2),
        accumResoDiff,
        accumTmoManaged
      };
    });

    // Return in ascending order as requested (older first)
    return withAccum;
  }, [history, searchMonth]);

  // --- Bono Mensual Acumulado ---
  // Es el bono que corresponde al ÚLTIMO estado acumulado (Acum. GxH + Acum. Reso actuales)
  const accumulatedBonusTotal = useMemo(() => {
    if (historyWithAccum.length === 0) return 0;
    const lastItem = historyWithAccum[historyWithAccum.length - 1];
    return lastItem.accumBonus || 0;
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

    // Diferencias vs Objetivos
    const closingBalance = managedCount > 0 ? (closedCount - Math.ceil(managedCount * (STANDARDS.CLOSED_GREEN / 100))) : 0;
    const gxhDiff = totalHours > 0 ? (managedCount - (totalHours * STANDARDS.GXH_GREEN)) : 0;
    const resoDiff = managedCount > 0 ? ((managedCount - techniciansCount) - Math.ceil(managedCount * (STANDARDS.RESOLUTION_GREEN / 100))) : 0;

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
  }, [closedCount, managedCount, techniciansCount, timerSeconds]);

  // --- Chart Data ---
  const chartData = useMemo(() => {
    // Sort chronological (oldest to newest) for the chart
    const sorted = [...filteredHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      labels: sorted.map(d => {
        const parts = d.date.split('-');
        return `${parts[2]}/${parts[1]}`; // DD/MM
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
      id: editingRecord.id,
      user_id: user.id,
      date: recordEditData.date,
      total_time: formatTime(totalSeconds),
      cases_closed: recordEditData.closed,
      cases_managed: recordEditData.managed,
      efficiency: parseFloat(closeRate.toFixed(2)),
      cases_per_hour: parseFloat(managedPerHour.toFixed(2)),
      avg_closed_per_hour: parseFloat(closedPerHour.toFixed(2)),
      tmo_case: tmoCase,
      tmo_managed: tmoManaged,
      technicians_sent: recordEditData.technicians,
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
          <div className="standard-row"><span>TMO (máx)</span> <span>{formatTmoMin(STANDARDS.TIME_PER_CASE)} ({STANDARDS.TIME_PER_CASE}s)</span></div>
          <div className="standard-row"><span>% Resolución</span> <span>≥ {STANDARDS.RESOLUTION_GREEN}%</span></div>
          <div className="standard-row"><span>% Cierre</span> <span>≥ {STANDARDS.CLOSED_GREEN}%</span></div>
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
            {managedCount > 0 && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: stats.closingBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-error)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px' }}>
                <span>Diferencia cierre (79%):</span>
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
            <span className="metric-label">Diferencia cierre (79%)</span>
            <div className={`metric-value medium ${stats.closingBalance >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
              {stats.closingBalance > 0 ? `+${stats.closingBalance}` : stats.closingBalance}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Dif. GxH (4.0)</span>
            <div className={`metric-value medium ${parseFloat(stats.gxhDiff) >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
              {parseFloat(stats.gxhDiff) > 0 ? `+${stats.gxhDiff}` : stats.gxhDiff}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Dif. Reso (81.5%)</span>
            <div className={`metric-value medium ${stats.resoDiff >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
              {stats.resoDiff > 0 ? `+${stats.resoDiff}` : stats.resoDiff}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO CxH</span>
            <div className={`metric-value medium ${stats.tmoCase > STANDARDS.TIME_PER_CASE ? 'stat-below-standard' : stats.tmoCase > STANDARDS.TIME_PER_CASE - 100 ? 'stat-warning-standard' : 'stat-meets-standard'}`} style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
              <span>{formatTmoMin(stats.tmoCase)}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: 'normal' }}>({stats.tmoCase}s)</span>
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO GxH</span>
            <div className={`metric-value medium ${stats.tmoManaged > STANDARDS.TIME_PER_MANAGED ? 'stat-below-standard' : stats.tmoManaged > STANDARDS.TIME_PER_MANAGED - 100 ? 'stat-warning-standard' : 'stat-meets-standard'}`} style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
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
                        <td className={getStatusClass(item.accumCloseRate, STANDARDS.CLOSED_GREEN, STANDARDS.CLOSED_YELLOW)} style={{ fontWeight: 'bold' }}>
                          {item.accumCloseRate}%
                        </td>
                        <td className={getStatusClass(item.accumResoRate, STANDARDS.RESOLUTION_GREEN, STANDARDS.RESOLUTION_YELLOW)} style={{ fontWeight: 'bold' }}>
                          {item.accumResoRate}%
                        </td>
                        <td className={getStatusClass(item.accumGxH, STANDARDS.GXH_GREEN, STANDARDS.GXH_YELLOW)} style={{ fontWeight: 'bold' }}>
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

        <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-bright)', fontSize: '16px' }}>Tendencia del Mes (GxH vs TMO)</h3>
          <div style={{ height: '300px', width: '100%' }}>
            {filteredHistory.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>No hay datos suficientes para graficar</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-bright)', fontSize: '16px' }}>Tendencia Resolución vs Técnicos</h3>
          <div style={{ height: '300px', width: '100%' }}>
            {filteredHistory.length > 0 ? (
              <Line data={chartDataReso} options={chartOptionsReso} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>No hay datos suficientes para graficar</div>
            )}
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
