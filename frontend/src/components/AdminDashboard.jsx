import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users,
  ArrowLeft,
  Search,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
  Trophy,
  TrendingUp,
  Flame,
  Calendar,
  Zap,
  Activity,
  History,
  ExternalLink,
  X,
  ChevronRight,
  Trash2,
  LogOut
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
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

function AdminDashboard({ user, profile, setNetworkError }) {
  const navigate = useNavigate();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' or 'config'

  // Dynamic Standards State
  const [standards, setStandards] = useState({
    GXH_GREEN: 4.00,
    GXH_YELLOW: 3.50,
    RESOLUTION_GREEN: 84.0,
    RESOLUTION_YELLOW: 81.0,
    CLOSED_GREEN: 78.8,
    CLOSED_YELLOW: 76.8,
    TIME_PER_CASE: 950,
    TIME_PER_MANAGED: 950,
    gxh_bonus_tiers: DEFAULT_GXH_TIERS,
    resolution_bonus_tiers: DEFAULT_RESOLUTION_TIERS
  });
  const [isLoadingStandards, setIsLoadingStandards] = useState(true);

  // Form State for configuration editing
  const [formConfig, setFormConfig] = useState(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Helper for traffic light colors
  const getStatusClass = (value, greenTarget, yellowTarget) => {
    const val = parseFloat(value);
    if (val >= greenTarget) return 'stat-meets-standard';
    if (val >= yellowTarget) return 'stat-warning-standard';
    return 'stat-below-standard';
  };

  // Fetch standards from db
  useEffect(() => {
    const fetchStandards = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('*')
          .eq('key', 'current')
          .maybeSingle();

        if (error) {
          console.warn('Error loading app_config (falling back to default standards):', error.message);
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
      } catch (e) {
        console.error('Failed to load standards:', e);
      } finally {
        setIsLoadingStandards(false);
      }
    };

    fetchStandards();

    // Subscribe to config changes in real time
    const channel = supabase
      .channel('admin_app_config_live')
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
  }, []);

  // Initialize form configuration state
  useEffect(() => {
    if (standards) {
      setFormConfig({
        gxh_green: standards.GXH_GREEN,
        gxh_yellow: standards.GXH_YELLOW,
        resolution_green: standards.RESOLUTION_GREEN,
        resolution_yellow: standards.RESOLUTION_YELLOW,
        closed_green: standards.CLOSED_GREEN,
        closed_yellow: standards.CLOSED_YELLOW,
        time_per_case: standards.TIME_PER_CASE,
        time_per_managed: standards.TIME_PER_MANAGED,
        gxh_bonus_tiers: [...standards.gxh_bonus_tiers],
        resolution_bonus_tiers: [...standards.resolution_bonus_tiers]
      });
    }
  }, [standards]);

  const [users, setUsers] = useState([]);
  const [allMetrics, setAllMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState('all');
  const [viewingUserDetails, setViewingUserDetails] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    show: false,
    targetUser: null
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState({ type: null, text: '' });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: null, text: '' }), 4000);
  };

  const handleDeleteUserData = async (targetUser) => {
    if (!targetUser) return;
    setIsDeleting(true);
    try {
      // Invocar la función RPC en Supabase que borra las métricas y las sesiones en una transacción segura
      const { data, error } = await supabase.rpc('clear_user_data_and_sessions', {
        target_user_id: targetUser.id
      });

      if (error) throw error;

      showMessage('success', `Datos de ${targetUser.email} limpiados y sesión cerrada de forma remota.`);
      setDeleteConfirmModal({ show: false, targetUser: null });
      setViewingUserDetails(null); // Close drill-down modal if open
      await fetchData(true); // Refresh all data
    } catch (error) {
      console.error('Error resetting user data:', error);
      const detailStr = error.details ? ` | Detalles: ${error.details}` : '';
      const hintStr = error.hint ? ` | Sugerencia: ${error.hint}` : '';
      const codeStr = error.code ? ` (Código: ${error.code})` : '';
      showMessage('error', `Error al limpiar datos: ${error.message || error}${detailStr}${hintStr}${codeStr}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('email');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: true });

      if (metricsError) throw metricsError;
      setAllMetrics(metricsData || []);

    } catch (error) {
      console.error('Error fetching admin data:', error.message);
      if (error.message.toLowerCase().includes('fetch')) {
        setNetworkError(true);
      }
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('admin_live_metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, (payload) => {
        setAllMetrics(currentMetrics => {
          if (payload.eventType === 'INSERT') return [...currentMetrics, payload.new].sort((a, b) => new Date(a.date) - new Date(b.date));
          if (payload.eventType === 'UPDATE') return currentMetrics.map(m => m.id === payload.new.id ? payload.new : m);
          if (payload.eventType === 'DELETE') {
            // BUG FIX: Must return elements that are NOT the deleted one
            return currentMetrics.filter(m => m.id !== payload.old.id);
          }
          return currentMetrics;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [setNetworkError]);

  const monthFilteredMetrics = useMemo(() => {
    return allMetrics.filter(m => m.date.startsWith(selectedMonth));
  }, [allMetrics, selectedMonth]);

  const filteredMetrics = useMemo(() => {
    let filtered = [...monthFilteredMetrics];
    if (selectedUserEmail !== 'all') {
      const userObj = users.find(u => u.email === selectedUserEmail);
      if (userObj) filtered = filtered.filter(m => m.user_id === userObj.id);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => users.find(u => u.id === m.user_id)?.email.toLowerCase().includes(term));
    }
    return filtered;
  }, [monthFilteredMetrics, selectedUserEmail, users, searchTerm]);

  // SPLIT METRICS: Today's detailed monitor
  const metricsToday = useMemo(() => filteredMetrics.filter(m => m.date === todayStr), [filteredMetrics, todayStr]);

  // UNIFIED USER HISTORY (Accumulated per Month)
  const unifiedHistory = useMemo(() => {
    return users.map(u => {
      const userRows = monthFilteredMetrics.filter(m => m.user_id === u.id);
      if (userRows.length === 0) return null;

      const totalManaged = userRows.reduce((s, m) => s + (m.cases_managed || 0), 0);
      const totalClosed = userRows.reduce((s, m) => s + (m.cases_closed || 0), 0);
      const totalTechs = userRows.reduce((s, m) => s + (m.technicians_sent || 0), 0);
      const avgGxh = userRows.length > 0 ? (userRows.reduce((s, m) => s + (parseFloat(m.cases_per_hour) || 0), 0) / userRows.length).toFixed(2) : "0.00";
      const efficiency = totalManaged > 0 ? ((totalClosed / totalManaged) * 100).toFixed(1) : "0.0";
      const resolution = totalManaged > 0 ? (userRows.reduce((s, m) => s + (parseFloat(m.resolution_rate) || 0), 0) / userRows.length).toFixed(1) : "0.0";
      const closingBalance = totalManaged > 0 ? (totalClosed - Math.ceil(totalManaged * (standards.CLOSED_GREEN / 100))) : 0;

      // GxH and Reso accumulated differences for Admin
      const totalSeconds = userRows.reduce((s, m) => {
        const [h, min, sec] = m.total_time.split(':').map(Number);
        return s + (h * 3600 + min * 60 + sec);
      }, 0);
      const gxhDiff = totalSeconds > 0 ? (totalManaged - ((totalSeconds / 3600) * standards.GXH_GREEN)) : 0;
      const resoDiff = totalManaged > 0 ? ((totalManaged - totalTechs) - Math.ceil(totalManaged * (standards.RESOLUTION_GREEN / 100))) : 0;

      return {
        ...u,
        totalManaged,
        totalClosed,
        totalTechs,
        avgGxh,
        efficiency,
        resolution,
        closingBalance,
        gxhDiff: gxhDiff.toFixed(1),
        resoDiff,
        recordsCount: userRows.length,
        rows: userRows.sort((a, b) => new Date(b.date) - new Date(a.date)).map((row, idx, arr) => {
          // Calculate running totals for each row to show accum diffs in modal
          const upToNow = arr.slice(idx).reverse(); // arr is desc, so slice and reverse
          const runManaged = upToNow.reduce((s, r) => s + (r.cases_managed || 0), 0);
          const runClosed = upToNow.reduce((s, r) => s + (r.cases_closed || 0), 0);
          const runTechs = upToNow.reduce((s, r) => s + (r.technicians_sent || 0), 0);
          const runSeconds = upToNow.reduce((s, r) => {
            const [h, min, sec] = r.total_time.split(':').map(Number);
            return s + (h * 3600 + min * 60 + sec);
          }, 0);

          return {
            ...row,
            accumClosingDiff: runManaged > 0 ? (runClosed - Math.ceil(runManaged * (standards.CLOSED_GREEN / 100))) : 0,
            accumGxhDiff: runSeconds > 0 ? (runManaged - ((runSeconds / 3600) * standards.GXH_GREEN)).toFixed(1) : "0.0",
            accumResoDiff: runManaged > 0 ? ((runManaged - runTechs) - Math.ceil(runManaged * (standards.RESOLUTION_GREEN / 100))) : 0
          };
        })
      };
    }).filter(Boolean);
  }, [monthFilteredMetrics, users, standards]);

  const statsSummary = useMemo(() => {
    if (filteredMetrics.length === 0) return { totalManaged: 0, totalClosed: 0, totalTechs: 0, avgEfficiency: "0.0" };
    const totalManaged = filteredMetrics.reduce((sum, m) => sum + (m.cases_managed || 0), 0);
    const totalClosed = filteredMetrics.reduce((sum, m) => sum + (m.cases_closed || 0), 0);
    const totalTechs = filteredMetrics.reduce((sum, m) => sum + (m.technicians_sent || 0), 0);
    return {
      totalManaged,
      totalClosed,
      totalTechs,
      avgEfficiency: totalManaged > 0 ? ((totalClosed / totalManaged) * 100).toFixed(1) : "0.0"
    };
  }, [filteredMetrics]);

  const leaderboard = useMemo(() => {
    const list = unifiedHistory.sort((a, b) => parseFloat(b.efficiency) - parseFloat(a.efficiency));
    return list.slice(0, 5);
  }, [unifiedHistory]);

  // Obtener todos los días de trabajo únicos para el gráfico de tendencia histórica
  const allWorkDays = useMemo(() => {
    return [...new Set(filteredMetrics.map(m => m.date))].sort();
  }, [filteredMetrics]);

  const trendChartData = useMemo(() => {
    const managedData = allWorkDays.map(d => filteredMetrics.filter(m => m.date === d).reduce((s, m) => s + (m.cases_managed || 0), 0));
    const closedData = allWorkDays.map(d => filteredMetrics.filter(m => m.date === d).reduce((s, m) => s + (m.cases_closed || 0), 0));
    return {
      labels: allWorkDays.map(d => d.split('-').slice(1).reverse().join('/')),
      datasets: [
        { label: 'Gestionados', data: managedData, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.4, fill: true },
        { label: 'Cerrados', data: closedData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true }
      ]
    };
  }, [filteredMetrics, allWorkDays]);



  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return 'N/A';
    }
  };

  // ACCESS DENIED VIEW WITH REDIRECT
  const [countdown, setCountdown] = useState(15);

  // Profile permission check — independent of data loading
  const isProfileLoaded = profile !== undefined;
  const isAdmin = isProfileLoaded && profile && profile.role === 'admin' && profile.is_enabled;

  useEffect(() => {
    if (isProfileLoaded && !isAdmin) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isProfileLoaded, isAdmin, navigate]);

  const handleConfigChange = (field, value) => {
    setFormConfig(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const handleTierChange = (type, index, field, value) => {
    setFormConfig(prev => {
      const tiers = [...prev[type]];
      tiers[index] = {
        ...tiers[index],
        [field]: parseFloat(value) || 0
      };
      return {
        ...prev,
        [type]: tiers
      };
    });
  };

  const addTier = (type) => {
    setFormConfig(prev => ({
      ...prev,
      [type]: [...prev[type], { min: 0, bonus: 0 }]
    }));
  };

  const deleteTier = (type, index) => {
    setFormConfig(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const saveConfig = async () => {
    if (!formConfig) return;
    setIsSavingConfig(true);
    try {
      const payload = {
        key: 'current',
        gxh_green: formConfig.gxh_green,
        gxh_yellow: formConfig.gxh_yellow,
        resolution_green: formConfig.resolution_green,
        resolution_yellow: formConfig.resolution_yellow,
        closed_green: formConfig.closed_green,
        closed_yellow: formConfig.closed_yellow,
        time_per_case: parseInt(formConfig.time_per_case) || 950,
        time_per_managed: parseInt(formConfig.time_per_managed) || 950,
        gxh_bonus_tiers: formConfig.gxh_bonus_tiers,
        resolution_bonus_tiers: formConfig.resolution_bonus_tiers,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      if (user.isDemo) {
        localStorage.setItem(`demo_app_standards_${user.id}`, JSON.stringify({
          GXH_GREEN: payload.gxh_green,
          GXH_YELLOW: payload.gxh_yellow,
          RESOLUTION_GREEN: payload.resolution_green,
          RESOLUTION_YELLOW: payload.resolution_yellow,
          CLOSED_GREEN: payload.closed_green,
          CLOSED_YELLOW: payload.closed_yellow,
          TIME_PER_CASE: payload.time_per_case,
          TIME_PER_MANAGED: payload.time_per_managed,
          gxh_bonus_tiers: payload.gxh_bonus_tiers,
          resolution_bonus_tiers: payload.resolution_bonus_tiers
        }));
        setStandards({
          GXH_GREEN: payload.gxh_green,
          GXH_YELLOW: payload.gxh_yellow,
          RESOLUTION_GREEN: payload.resolution_green,
          RESOLUTION_YELLOW: payload.resolution_yellow,
          CLOSED_GREEN: payload.closed_green,
          CLOSED_YELLOW: payload.closed_yellow,
          TIME_PER_CASE: payload.time_per_case,
          TIME_PER_MANAGED: payload.time_per_managed,
          gxh_bonus_tiers: payload.gxh_bonus_tiers,
          resolution_bonus_tiers: payload.resolution_bonus_tiers
        });
        showMessage('success', '¡Configuración de espectador guardada localmente!');
        setIsSavingConfig(false);
        return;
      }

      const { error } = await supabase
        .from('app_config')
        .upsert([payload], { onConflict: 'key' });

      if (error) throw error;

      showMessage('success', '¡Configuración actualizada correctamente!');
      setStandards({
        GXH_GREEN: payload.gxh_green,
        GXH_YELLOW: payload.gxh_yellow,
        RESOLUTION_GREEN: payload.resolution_green,
        RESOLUTION_YELLOW: payload.resolution_yellow,
        CLOSED_GREEN: payload.closed_green,
        CLOSED_YELLOW: payload.closed_yellow,
        TIME_PER_CASE: payload.time_per_case,
        TIME_PER_MANAGED: payload.time_per_managed,
        gxh_bonus_tiers: payload.gxh_bonus_tiers,
        resolution_bonus_tiers: payload.resolution_bonus_tiers
      });
    } catch (err) {
      console.error('Error saving config:', err);
      showMessage('error', `Error al guardar: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const resetConfigToDefault = () => {
    if (window.confirm('¿Estás seguro de restablecer todos los valores a los predeterminados de fábrica?')) {
      setFormConfig({
        gxh_green: 4.00,
        gxh_yellow: 3.50,
        resolution_green: 84.0,
        resolution_yellow: 81.0,
        closed_green: 78.8,
        closed_yellow: 76.8,
        time_per_case: 950,
        time_per_managed: 950,
        gxh_bonus_tiers: [...DEFAULT_GXH_TIERS],
        resolution_bonus_tiers: [...DEFAULT_RESOLUTION_TIERS]
      });
      showMessage('info', 'Valores restablecidos a predeterminados. Haz clic en Guardar para aplicar.');
    }
  };

  const renderConfigPanel = () => {
    if (!formConfig) return <div className="loading-state">Cargando formulario...</div>;
    return (
      <div style={{ padding: '0 10px 40px 10px' }}>
        <div className="admin-header" style={{ marginBottom: '30px' }}>
          <div>
            <h2 style={{ fontSize: '32px', margin: 0 }}>Ajustes de Métricas</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Configura los estándares operativos y las tablas de bonificación</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={resetConfigToDefault}>
              Restablecer Valores
            </button>
            <button className="btn btn-primary" onClick={saveConfig} disabled={isSavingConfig}>
              {isSavingConfig ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>

        <div className="grid-primary" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          {/* SECCIÓN 1: ESTÁNDARES */}
          <div className="metric-card" style={{ padding: '30px', background: 'rgba(15, 23, 42, 0.4)' }}>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '18px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '20px' }}>
              🎯 Objetivos y Estándares Operativos
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>GxH Verde (Objetivo)</label>
                <input type="number" step="0.1" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.gxh_green} onChange={e => handleConfigChange('gxh_green', e.target.value)} />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>GxH Amarillo (Mínimo)</label>
                <input type="number" step="0.1" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.gxh_yellow} onChange={e => handleConfigChange('gxh_yellow', e.target.value)} />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>% Resolución Verde</label>
                <input type="number" step="0.1" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.resolution_green} onChange={e => handleConfigChange('resolution_green', e.target.value)} />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>% Resolución Amarillo</label>
                <input type="number" step="0.1" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.resolution_yellow} onChange={e => handleConfigChange('resolution_yellow', e.target.value)} />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>% Cierre Verde</label>
                <input type="number" step="0.1" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.closed_green} onChange={e => handleConfigChange('closed_green', e.target.value)} />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>% Cierre Amarillo</label>
                <input type="number" step="0.1" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.closed_yellow} onChange={e => handleConfigChange('closed_yellow', e.target.value)} />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>TMO Casos (segundos)</label>
                <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.time_per_case} onChange={e => handleConfigChange('time_per_case', e.target.value)} />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>TMO Gestionados (segundos)</label>
                <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
                  value={formConfig.time_per_managed} onChange={e => handleConfigChange('time_per_managed', e.target.value)} />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: TABLA BONIFICACIÓN GXH */}
          <div className="metric-card" style={{ padding: '30px', background: 'rgba(15, 23, 42, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <h3 style={{ color: 'var(--primary-light)', fontSize: '18px', margin: 0 }}>
                📈 Tabla de Bonificaciones por GxH
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '11px' }} onClick={() => addTier('gxh_bonus_tiers')}>
                + Agregar Rango
              </button>
            </div>
            
            <div className="table-container">
              <table className="history-table admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>GxH Mínimo para Calificar</th>
                    <th style={{ textAlign: 'left' }}>Porcentaje de Bono (%)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {formConfig.gxh_bonus_tiers.map((tier, idx) => (
                    <tr key={`gxh-tier-${idx}`}>
                      <td style={{ textAlign: 'left' }}>
                        <input type="number" step="0.01" className="filter-input" style={{ width: '90%', padding: '6px 12px' }}
                          value={tier.min} onChange={e => handleTierChange('gxh_bonus_tiers', idx, 'min', e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <input type="number" step="0.1" className="filter-input" style={{ width: '90%', padding: '6px 12px' }}
                          value={tier.bonus} onChange={e => handleTierChange('gxh_bonus_tiers', idx, 'bonus', e.target.value)} />
                      </td>
                      <td>
                        <button className="btn btn-logout" style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          onClick={() => deleteTier('gxh_bonus_tiers', idx)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECCIÓN 3: TABLA BONIFICACIÓN RESOLUCIÓN */}
          <div className="metric-card" style={{ padding: '30px', background: 'rgba(15, 23, 42, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <h3 style={{ color: 'var(--primary-light)', fontSize: '18px', margin: 0 }}>
                ⚡ Tabla de Bonificaciones por % Resolución
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '11px' }} onClick={() => addTier('resolution_bonus_tiers')}>
                + Agregar Rango
              </button>
            </div>
            
            <div className="table-container">
              <table className="history-table admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>% Resolución Mínimo</th>
                    <th style={{ textAlign: 'left' }}>Porcentaje de Bono (%)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {formConfig.resolution_bonus_tiers.map((tier, idx) => (
                    <tr key={`reso-tier-${idx}`}>
                      <td style={{ textAlign: 'left' }}>
                        <input type="number" step="0.01" className="filter-input" style={{ width: '90%', padding: '6px 12px' }}
                          value={tier.min} onChange={e => handleTierChange('resolution_bonus_tiers', idx, 'min', e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <input type="number" step="0.1" className="filter-input" style={{ width: '90%', padding: '6px 12px' }}
                          value={tier.bonus} onChange={e => handleTierChange('resolution_bonus_tiers', idx, 'bonus', e.target.value)} />
                      </td>
                      <td>
                        <button className="btn btn-logout" style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          onClick={() => deleteTier('resolution_bonus_tiers', idx)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Still waiting for profile from App.jsx
  if (!isProfileLoaded) {
    return (
      <div className="login-overlay">
        <div className="login-card" style={{ textAlign: 'center', padding: '40px' }}>
          <RefreshCw size={48} className="spinning text-primary" style={{ marginBottom: 20 }} />
          <p>Verificando credenciales de administrador...</p>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin' || !profile.is_enabled) {
    return (
      <div className="login-overlay access-denied-bg">
        <div className="login-card" style={{ textAlign: 'center', maxWidth: '400px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto 24px' }}>
            <div className="pulse-circle" style={{ position: 'absolute', inset: '-10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', animation: 'ping 2s infinite' }}></div>
            <AlertCircle size={64} className="text-secondary" style={{ color: 'var(--accent-error)', position: 'relative' }} />
          </div>
          <h1 style={{ fontSize: '28px', color: 'var(--text-bright)', marginBottom: '10px' }}>¡No tienes acceso!</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: '30px', lineHeight: '1.5' }}>Tu cuenta no cuenta con permisos administrativos o ha sido desahibilitada.</p>

          <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: '25px' }}>
            <p style={{ fontSize: '12px', margin: 0, color: 'var(--text-dim)' }}>Redirigiendo automáticamente en</p>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--accent-error)' }}>{countdown}s</div>
          </div>

          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            <ArrowLeft size={16} /> Volver al Dashboard Ahora
          </button>
        </div>
        <style>{`
          .access-denied-bg {
             background: radial-gradient(circle at center, rgba(239, 68, 68, 0.05) 0%, #0a0b14 100%);
          }
          @keyframes ping {
            0% { transform: scale(1); opacity: 1; }
            70%, 100% { transform: scale(1.6); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* MESSAGES */}
      {message.text && (
        <div className={`mensaje activo mensaje-${message.type}`} style={{ zIndex: 4000 }}>
          {message.type === 'success' && <CheckCircle2 size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
          {message.type === 'error' && <AlertCircle size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
          {message.text}
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '10px' }}>
            <Database className="text-primary" size={24} />
            <h1 style={{ margin: 0 }}>Admin Panel</h1>
          </div>
          <div className="subtitle">CONTROL CENTRAL</div>
        </header>

        <section className="user-info">
          <span>{user?.email}</span>
          <div style={{ fontSize: '10px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>ADMINISTRADOR</div>
        </section>

        <nav className="action-section" style={{ gap: '12px', flexGrow: 1, overflowY: 'auto', paddingRight: '5px' }}>
          <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '10px' }} onClick={() => navigate('/dashboard')}><ArrowLeft size={16} /> Panel Usuario</button>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <button 
              className={`btn ${activeTab === 'monitor' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold' }}
              onClick={() => setActiveTab('monitor')}
            >
              📊 Monitorear
            </button>
            <button 
              className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold' }}
              onClick={() => setActiveTab('config')}
            >
              ⚙️ Configurar
            </button>
          </div>

          <div>
            <h3 className="metric-label" style={{ fontSize: '11px', marginBottom: '12px' }}><Trophy size={11} style={{ marginRight: 5 }} /> Ranking Top Eficiencia</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {leaderboard.map((u, i) => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px',
                  background: i === 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid', borderColor: i === 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--border-light)'
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: i === 0 ? 'var(--accent-warning)' : 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 'bold' }}>
                    {i === 0 ? <Zap size={10} color="white" /> : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: '600', color: i === 0 ? 'var(--accent-warning)' : 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>{u.email.split('@')[0]}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{u.efficiency}%</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="metric-label" style={{ fontSize: '11px', marginBottom: '12px' }}><Mail size={11} style={{ marginRight: 5 }} /> Directorio</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {users.map(u => (
                <div key={u.id} className={`user-list-item ${selectedUserEmail === u.email ? 'active' : ''}`} onClick={() => setSelectedUserEmail(u.email)}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid',
                    background: selectedUserEmail === u.email ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    borderColor: selectedUserEmail === u.email ? 'var(--primary-light)' : 'transparent',
                    color: selectedUserEmail === u.email ? 'var(--text-bright)' : 'var(--text-dim)'
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_enabled ? 'var(--accent-success)' : 'var(--text-dim)' }}></div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>{u.email}</span>
                  {u.role !== 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmModal({ show: true, targetUser: u });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(239, 68, 68, 0.6)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-error)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'}
                      title="Limpiar datos e historial y cerrar sesión"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              <div onClick={() => setSelectedUserEmail('all')} style={{
                padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', textAlign: 'center', marginTop: '5px',
                background: selectedUserEmail === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.05)',
                border: '1px solid', borderColor: selectedUserEmail === 'all' ? 'var(--primary-light)' : 'var(--border-light)'
              }}>Mostrar Global</div>
            </div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {activeTab === 'config' ? (
          renderConfigPanel()
        ) : (
          <>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h2 style={{ fontSize: '32px', margin: 0 }}>Admin Panel</h2>
              <div className="live-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div className="pulse-dot"></div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-error)', letterSpacing: '0.1em' }}>EN VIVO</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Gestionando {users.length} operadores activos</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', maxWidth: '650px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 'bold' }}>MES DE CONSULTA</span>
              <input type="month" className="filter-input" style={{ height: '45px', borderRadius: '12px' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
            </div>
            <div style={{ position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 'bold' }}>BUSCAR OPERADOR</span>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input type="text" placeholder="Filtrar por operador..." className="filter-input" style={{ width: '100%', paddingLeft: '40px', height: '45px', borderRadius: '12px' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'transparent' }}>REFRESH</span>
              <button className="btn btn-secondary" onClick={() => fetchData(true)} disabled={isRefreshing} style={{ height: '45px', width: '45px', padding: 0, borderRadius: '12px' }}><RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} /></button>
            </div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid-secondary" style={{ marginBottom: '30px' }}>
          <div className="metric-card">
            <span className="metric-label">Gestionados Acum.</span>
            <div className="metric-value medium">{statsSummary.totalManaged}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cerrados Acum.</span>
            <div className="metric-value medium">{statsSummary.totalClosed}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TCO Acum.</span>
            <div className="metric-value medium">{statsSummary.totalTechs}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cierre Promedio</span>
            <div className={`metric-value medium ${getStatusClass(statsSummary.avgEfficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}`}>{statsSummary.avgEfficiency}%</div>
          </div>
        </div>

        {/* MONITOR JORNADA ACTUAL (LIVE) */}
        <div className="metric-card" style={{ padding: '0', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="table-header" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-light)', background: 'rgba(99, 102, 241, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={16} className="text-primary" />
              <span className="metric-label" style={{ margin: 0, color: 'var(--text-bright)' }}>Monitor de Jornada Actual (Hoy)</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--accent-success)', fontWeight: 'bold' }}>AUTOSINCRONIZADO</div>
          </div>
          <div className="table-container" style={{ maxHeight: '350px' }}>
            <table className="history-table admin-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: '32px' }}>Operador</th>
                  <th>Gest.</th>
                  <th>Cerr.</th>
                  <th>TCO</th>
                  <th>% Cierre</th>
                  <th>Acum. Reso</th>
                  <th>G/h</th>
                  <th>Última Act.</th>
                </tr>
              </thead>
              <tbody>
                {metricsToday.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>No hay actividad registrada para hoy.</td></tr>
                ) : metricsToday.map((item) => {
                  const email = users.find(u => u.id === item.user_id)?.email || 'N/A';
                  return (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'left', paddingLeft: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', color: 'var(--text-bright)' }}>{email.split('@')[0]}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{email}</span>
                        </div>
                      </td>
                      <td>{item.cases_managed}</td>
                      <td>{item.cases_closed}</td>
                      <td>{item.technicians_sent}</td>
                      <td className={getStatusClass(item.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}>{item.efficiency}%</td>
                      <td className={getStatusClass(item.resolution_rate, standards.RESOLUTION_GREEN, standards.RESOLUTION_YELLOW)}>{item.resolution_rate}%</td>
                      <td className={getStatusClass(item.cases_per_hour, standards.GXH_GREEN, standards.GXH_YELLOW)}>{item.cases_per_hour}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{formatLastUpdated(item.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ANALYTICS ROW */}
        <div style={{ marginBottom: '32px' }}>
          <div className="metric-card" style={{ padding: '24px' }}>
            <span className="metric-label"><TrendingUp size={14} style={{ marginRight: 5 }} /> Tendencia Histórica de Gestión</span>
            <div style={{ height: '180px' }}><Line data={trendChartData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } } }, plugins: { legend: { display: false } } }} /></div>
          </div>
        </div>

        {/* UNIFIED HISTORY TABLE (Drill-down) */}
        <div className="metric-card" style={{ padding: '0' }}>
          <div className="table-header" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={16} className="text-secondary" />
              <span className="metric-label" style={{ margin: 0, color: 'var(--text-bright)' }}>Historial Unificado de Operadores</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Haz clic en un operador para ver su detalle</div>
          </div>
          <div className="table-container" style={{ maxHeight: '500px' }}>
            <table className="history-table admin-table clickable-rows">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: '32px' }}>Operador</th>
                  <th>Días Reg.</th>
                  <th>Total Gest.</th>
                  <th>Total Cerr.</th>
                  <th>% Cierre Med.</th>
                  <th>% Reso Med.</th>
                  <th>G/h Med.</th>
                  <th>Dif. Cierre</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {unifiedHistory.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>Iniciando base de datos...</td></tr>
                ) : unifiedHistory.map((u) => (
                  <tr key={u.id} onClick={() => setViewingUserDetails(u)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'left', paddingLeft: '32px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-bright)' }}>{u.email.split('@')[0]}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{u.email}</span>
                      </div>
                    </td>
                    <td>{u.recordsCount}</td>
                    <td style={{ fontWeight: '600' }}>{u.totalManaged}</td>
                    <td style={{ fontWeight: '600' }}>{u.totalClosed}</td>
                    <td className={getStatusClass(u.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}>{u.efficiency}%</td>
                    <td className={getStatusClass(u.resolution, standards.RESOLUTION_GREEN, standards.RESOLUTION_YELLOW)}>{u.resolution}%</td>
                    <td className={getStatusClass(u.avgGxh, standards.GXH_GREEN, standards.GXH_YELLOW)}>{u.avgGxh}</td>
                    <td style={{ fontWeight: '700', color: u.closingBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                      {u.closingBalance > 0 ? `+${u.closingBalance}` : u.closingBalance}
                    </td>
                    <td style={{ color: 'var(--primary)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>Ver <ChevronRight size={14} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </main>

      {/* DRILL-DOWN MODAL: USER DETAILS */}
      {viewingUserDetails && (
        <div className="login-overlay drilldown-modal" style={{ zIndex: 2000 }}>
          <div className="login-card" style={{ maxWidth: '900px', width: '95%', padding: '0', overflow: 'hidden' }}>
            <header style={{ padding: '24px 32px', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-bright)' }}>{viewingUserDetails.email.split('@')[0]}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{viewingUserDetails.email}</p>
              </div>
              <button className="btn btn-secondary" onClick={() => setViewingUserDetails(null)} style={{ padding: '8px' }}><X size={20} /></button>
            </header>

            <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="grid-secondary" style={{ marginBottom: '32px' }}>
                    <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="metric-label">Días de Actividad</span>
                      <div className="metric-value small">{viewingUserDetails.recordsCount}</div>
                    </div>
                    <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="metric-label">Diferencia cierre ({standards.CLOSED_GREEN}%)</span>
                      <div className={`metric-value small ${viewingUserDetails.closingBalance >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
                        {viewingUserDetails.closingBalance > 0 ? `+${viewingUserDetails.closingBalance}` : viewingUserDetails.closingBalance}
                      </div>
                    </div>
                <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="metric-label">Promedio G/h</span>
                  <div className="metric-value small">{viewingUserDetails.avgGxh}</div>
                </div>
                <div className="metric-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="metric-label"> Cierre Total</span>
                  <div className={`metric-value small ${getStatusClass(viewingUserDetails.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}`}>{viewingUserDetails.efficiency}%</div>
                </div>
              </div>

              <h3 className="metric-label" style={{ marginBottom: '15px' }}><Calendar size={14} style={{ marginRight: 8 }} /> Desglose fecha por fecha</h3>
              <table className="history-table admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>T. Conexión</th>
                    <th>Gest.</th>
                    <th>Cerr.</th>
                    <th>TCO</th>
                    <th>% Cierre</th>
                    <th>G/h</th>
                    <th>Dif. Cierre Acum</th>
                    <th>Dif. G/h Acum</th>
                    <th>Dif. Reso Acum</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingUserDetails.rows.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: '700' }}>{row.date}</td>
                      <td>{row.total_time}</td>
                      <td>{row.cases_managed}</td>
                      <td>{row.cases_closed}</td>
                      <td>{row.technicians_sent}</td>
                      <td className={getStatusClass(row.efficiency, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}>{row.efficiency}%</td>
                      <td className={getStatusClass(row.cases_per_hour, standards.GXH_GREEN, standards.GXH_YELLOW)}>{row.cases_per_hour}</td>
                      <td style={{ fontWeight: '700', color: row.accumClosingDiff >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                        {row.accumClosingDiff > 0 ? `+${row.accumClosingDiff}` : row.accumClosingDiff}
                      </td>
                      <td style={{ fontWeight: '700', color: parseFloat(row.accumGxhDiff) >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                        {parseFloat(row.accumGxhDiff) > 0 ? `+${row.accumGxhDiff}` : row.accumGxhDiff}
                      </td>
                      <td style={{ fontWeight: '700', color: row.accumResoDiff >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                        {row.accumResoDiff > 0 ? `+${row.accumResoDiff}` : row.accumResoDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--border-light)' }}>
              {viewingUserDetails.role !== 'admin' ? (
                <button 
                  className="btn" 
                  style={{ 
                    backgroundColor: 'var(--accent-error)', 
                    color: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontWeight: '600',
                    padding: '8px 16px',
                    borderRadius: '8px'
                  }} 
                  onClick={() => setDeleteConfirmModal({ show: true, targetUser: viewingUserDetails })}
                >
                  <Trash2 size={16} />
                  <span>Limpiar Datos y Cerrar Sesión</span>
                </button>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 'bold' }}>CUENTA DE ADMINISTRADOR PROTEGIDA</div>
              )}
              <button className="btn btn-primary" onClick={() => setViewingUserDetails(null)}>Cerrar Detalle</button>
            </footer>
          </div>
        </div>
      )}

      {/* DELETE USER DATA AND LOGOUT CONFIRMATION DIALOG */}
      {deleteConfirmModal.show && deleteConfirmModal.targetUser && (
        <div className="login-overlay drilldown-modal" style={{ zIndex: 3000 }}>
          <div className="modal" style={{ maxWidth: '450px', textAlign: 'center', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '30px' }}>
            <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '15px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                color: 'var(--accent-error)'
              }}>
                <AlertCircle size={32} />
              </div>
            </div>
            <h2 style={{
              fontSize: '22px',
              marginBottom: '12px',
              color: 'var(--text-bright)'
            }}>
              ¿Limpiar Métricas y Cerrar Sesión?
            </h2>
            <p style={{
              marginBottom: '20px',
              fontSize: '14px',
              color: 'var(--text-muted)',
              lineHeight: '1.6'
            }}>
              Estás a punto de eliminar de forma permanente todo el historial de métricas de <strong>{deleteConfirmModal.targetUser.email}</strong>. Su cuenta de acceso seguirá activa para que pueda ingresar en el futuro.
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: '25px', fontSize: '12px', color: 'var(--accent-error)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <LogOut size={16} />
              <span>Esto cerrará su sesión de forma remota en todos sus dispositivos.</span>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteConfirmModal({ show: false, targetUser: null })} disabled={isDeleting}>
                Cancelar
              </button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: 'var(--accent-error)',
                  color: 'white',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onClick={() => handleDeleteUserData(deleteConfirmModal.targetUser)}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Limpiando...' : 'Limpiar y Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pulse-dot {
          width: 8px; height: 8px; background: var(--accent-error); border-radius: 50%;
          box-shadow: 0 0 0 rgba(239, 68, 68, 0.4); animation: pulse-ring 1.5s infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .clickable-rows tbody tr:hover {
           background: rgba(99, 102, 241, 0.05) !important;
        }
        .drilldown-modal {
           backdrop-filter: blur(8px);
           background: rgba(0,0,0,0.6);
        }
      `}</style>
    </div>
  );
}

export default AdminDashboard;
