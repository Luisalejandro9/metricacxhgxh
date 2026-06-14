import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Database,
  ArrowLeft,
  Trophy,
  Zap,
  Mail,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

// Subcomponents
import ConfigPanel from './admin/ConfigPanel';
import MonitorPanel from './admin/MonitorPanel';
import UserDetailsModal from './admin/modals/UserDetailsModal';
import DeleteConfirmModal from './admin/modals/DeleteConfirmModal';

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
      const { data, error } = await supabase.rpc('clear_user_data_and_sessions', {
        target_user_id: targetUser.id
      });

      if (error) throw error;

      showMessage('success', `Datos de ${targetUser.email} limpiados y sesión cerrada de forma remota.`);
      setDeleteConfirmModal({ show: false, targetUser: null });
      setViewingUserDetails(null);
      await fetchData(true);
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

  const metricsToday = useMemo(() => filteredMetrics.filter(m => m.date === todayStr), [filteredMetrics, todayStr]);

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
          const upToNow = arr.slice(idx).reverse();
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

  const [countdown, setCountdown] = useState(15);

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
          <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '10px' }} onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} /> Panel Usuario
          </button>

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
            <h3 className="metric-label" style={{ fontSize: '11px', marginBottom: '12px' }}>
              <Trophy size={11} style={{ marginRight: 5 }} /> Ranking Top Eficiencia
            </h3>
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
                  <span style={{ fontSize: 11, fontWeight: '600', color: i === 0 ? 'var(--accent-warning)' : 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                    {u.email.split('@')[0]}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{u.efficiency}%</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="metric-label" style={{ fontSize: '11px', marginBottom: '12px' }}>
              <Mail size={11} style={{ marginRight: 5 }} /> Directorio
            </h3>
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
              }}>
                Mostrar Global
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {activeTab === 'config' ? (
          <ConfigPanel
            formConfig={formConfig}
            isSavingConfig={isSavingConfig}
            resetConfigToDefault={resetConfigToDefault}
            saveConfig={saveConfig}
            handleConfigChange={handleConfigChange}
            handleTierChange={handleTierChange}
            addTier={addTier}
            deleteTier={deleteTier}
          />
        ) : (
          <MonitorPanel
            users={users}
            statsSummary={statsSummary}
            standards={standards}
            metricsToday={metricsToday}
            trendChartData={trendChartData}
            unifiedHistory={unifiedHistory}
            setViewingUserDetails={setViewingUserDetails}
            isRefreshing={isRefreshing}
            fetchData={fetchData}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            formatLastUpdated={formatLastUpdated}
            getStatusClass={getStatusClass}
          />
        )}
      </main>

      <UserDetailsModal
        viewingUserDetails={viewingUserDetails}
        onClose={() => setViewingUserDetails(null)}
        standards={standards}
        getStatusClass={getStatusClass}
        onDeleteClick={(u) => setDeleteConfirmModal({ show: true, targetUser: u })}
      />

      <DeleteConfirmModal
        show={deleteConfirmModal.show}
        targetUser={deleteConfirmModal.targetUser}
        isDeleting={isDeleting}
        onCancel={() => setDeleteConfirmModal({ show: false, targetUser: null })}
        onConfirm={() => handleDeleteUserData(deleteConfirmModal.targetUser)}
      />

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
