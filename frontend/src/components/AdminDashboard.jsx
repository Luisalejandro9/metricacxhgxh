import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Database,
  ClipboardList,
  X,
  ArrowLeft,
  Mail,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Activity,
  ShieldCheck,
  UserRoundCog,
  UserX,
  UserCheck,
  BarChart3,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

// Subcomponents
import ConfigPanel from './admin/ConfigPanel';
import MonitorPanel from './admin/MonitorPanel';
import UserDetailsModal from './admin/modals/UserDetailsModal';
import DeleteConfirmModal from './admin/modals/DeleteConfirmModal';

const SUPER_ADMIN_EMAILS = new Set([
  'luis.acosta@konecta.com',
  'lacosta161999@gmail.com'
]);

const isProtectedSuperAdmin = (target) =>
  SUPER_ADMIN_EMAILS.has(String(target?.email || '').trim().toLowerCase());

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

function AdminDashboard({ user, profile, setNetworkError, theme, toggleTheme }) {
  const navigate = useNavigate();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState('monitor');

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

  const calculateRecordBonus = useCallback((managedPerHour, resolutionRate) => {
    const resolveTierBonus = (value, tiers, fallback) => {
      const numericValue = Number(value);
      const sorted = [...(Array.isArray(tiers) ? tiers : fallback)].sort((a, b) => Number(b.min) - Number(a.min));
      const tier = sorted.find(item => numericValue >= Number(item.min));
      return Number(tier?.bonus ?? sorted[sorted.length - 1]?.bonus ?? -2);
    };
    return resolveTierBonus(managedPerHour, standards.gxh_bonus_tiers, DEFAULT_GXH_TIERS)
      + resolveTierBonus(resolutionRate, standards.resolution_bonus_tiers, DEFAULT_RESOLUTION_TIERS);
  }, [standards.gxh_bonus_tiers, standards.resolution_bonus_tiers]);

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
          console.warn('Error al cargar app_config:', error.message);
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
        console.error('Error al obtener estándares:', e);
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
  const [showTechnicianRanking, setShowTechnicianRanking] = useState(false);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState(null);
  const [roleConfirmUser, setRoleConfirmUser] = useState(null);
  const [roleConfirmMakeAdmin, setRoleConfirmMakeAdmin] = useState(true);

  // --- FILTRO DE EXCLUSIÓN DE DIRECTORIO (MOSTRAR GLOBAL EXCEPTO...) ---
  const [excludedUserIds, setExcludedUserIds] = useState([]);

  const toggleExcludeUser = (userId) => {
    setExcludedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const clearExcludedUsers = () => {
    setExcludedUserIds([]);
  };

  // --- FILTRO DE RANGO DE FECHA (POR EJEMPLO 05/10/2026 AL 23/10/2026) ---
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  const handleResetToCurrentMonth = () => {
    const d = new Date();
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setStartDate(start);
    setEndDate(end);
  };

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
    if (!targetUser || isProtectedSuperAdmin(targetUser)) return;
    if (targetUser.role === 'admin' && !isSuperAdmin) {
      showMessage('error', 'Solo los administradores totales pueden limpiar datos de otros administradores.');
      return;
    }
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('clear_user_data_and_sessions', {
        target_user_id: targetUser.id
      });

      if (error) throw error;

      showMessage('success', `Datos de ${targetUser.email} limpiados y sesión cerrada de forma remota.`);
      setDeleteConfirmModal({ show: false, targetUser: null, mode: 'delete' });
      setViewingUserDetails(null);
      await fetchData(true);
    } catch (error) {
      console.error('Error al limpiar datos del usuario:', error);
      const detailStr = error.details ? ` | Detalles: ${error.details}` : '';
      const hintStr = error.hint ? ` | Sugerencia: ${error.hint}` : '';
      const codeStr = error.code ? ` (Código: ${error.code})` : '';
      showMessage('error', `Error al limpiar datos: ${error.message || error}${detailStr}${hintStr}${codeStr}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearOnlyMetrics = async (targetUser) => {
    if (!targetUser || isProtectedSuperAdmin(targetUser)) return;
    if (targetUser.role === 'admin' && !isSuperAdmin) {
      showMessage('error', 'Solo los administradores totales pueden limpiar métricas de otros administradores.');
      return;
    }
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('clear_user_metrics', {
        target_user_id: targetUser.id
      });
      if (error) throw error;
      showMessage('success', `Se limpiaron las métricas de ${targetUser.email}. Su perfil y sesión permanecen activos. (${data || 0} registros)`);
      setDeleteConfirmModal({ show: false, targetUser: null, mode: 'clear' });
      setViewingUserDetails(null);
      await fetchData(true);
    } catch (error) {
      console.error('Error al limpiar métricas:', error);
      showMessage('error', error.message || 'No se pudieron limpiar las métricas.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetUserBan = async (targetUser, banned) => {
    if (!targetUser || isProtectedSuperAdmin(targetUser)) return;
    if (targetUser.role === 'admin' && !isSuperAdmin) {
      showMessage('error', 'Solo los administradores totales pueden banear o desbanear a otros administradores.');
      return;
    }
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user-ban', {
        body: { targetUserId: targetUser.id, banned }
      });
      if (error) throw error;
      if (!data?.success || !data?.profile) throw new Error(data?.error || 'Supabase no confirmó el cambio de estado.');
      showMessage('success', banned
        ? `${targetUser.email} fue baneado en Supabase Auth y en la plataforma.`
        : `${targetUser.email} fue rehabilitado y puede volver a ingresar.`);
      setUsers(current => current.map(item => item.id === targetUser.id
        ? { ...item, is_enabled: data.profile.is_enabled }
        : item));
      setDeleteConfirmModal({ show: false, targetUser: null, mode: banned ? 'ban' : 'unban' });
      setViewingUserDetails(null);
      await fetchData(true);
    } catch (error) {
      console.error('Error al actualizar el baneo:', error);
      showMessage('error', error.message || 'No se pudo actualizar el estado del usuario.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmUserAction = () => {
    const { targetUser, mode } = deleteConfirmModal;
    if (mode === 'clear') return handleClearOnlyMetrics(targetUser);
    if (mode === 'ban') return handleSetUserBan(targetUser, true);
    if (mode === 'unban') return handleSetUserBan(targetUser, false);
    return handleDeleteUserData(targetUser);
  };

  const handleSetAdminRole = async (targetUser, makeAdmin) => {
    if (!targetUser?.id || targetUser.id === user?.id || isProtectedSuperAdmin(targetUser)) return;
    if (targetUser.role === 'admin' && !isSuperAdmin) {
      showMessage('error', 'Solo los administradores totales pueden modificar el rol de otro administrador.');
      return;
    }
    setRoleUpdatingUserId(targetUser.id);
    try {
      const { data, error } = await supabase.rpc('set_profile_admin_role', {
        p_target_user_id: targetUser.id,
        p_make_admin: makeAdmin
      });
      if (error) throw error;
      if (!data?.id) throw new Error('Supabase no devolvió el perfil actualizado.');

      setUsers(current => current.map(item => item.id === data.id
        ? { ...item, role: data.role, is_enabled: data.is_enabled }
        : item));
      showMessage('success', makeAdmin
        ? `${data.email} ahora tiene permisos de administrador.`
        : `Se retiraron los permisos de administrador a ${data.email}.`);
      setRoleConfirmUser(null);
    } catch (error) {
      console.error('Error al actualizar rol del perfil:', error);
      showMessage('error', error.message || 'No se pudo actualizar el rol.');
    } finally {
      setRoleUpdatingUserId(null);
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
      console.error('Error al cargar datos administrativos:', error.message);
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

  // Filtrado por Rango de Fecha (startDate a endDate)
  const dateFilteredMetrics = useMemo(() => {
    return allMetrics.filter(m => {
      if (!m.date) return false;
      if (startDate && m.date < startDate) return false;
      if (endDate && m.date > endDate) return false;
      return true;
    });
  }, [allMetrics, startDate, endDate]);

  // Métricas con filtrado de usuario seleccionado, exclusión de perfiles y término de búsqueda
  const filteredMetrics = useMemo(() => {
    let filtered = [...dateFilteredMetrics];
    if (selectedUserEmail !== 'all') {
      const userObj = users.find(u => u.email === selectedUserEmail);
      if (userObj) filtered = filtered.filter(m => m.user_id === userObj.id);
    } else if (excludedUserIds.length > 0) {
      // Exclusión en modo Global
      filtered = filtered.filter(m => !excludedUserIds.includes(m.user_id));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => users.find(u => u.id === m.user_id)?.email.toLowerCase().includes(term));
    }
    return filtered;
  }, [dateFilteredMetrics, selectedUserEmail, users, searchTerm, excludedUserIds]);


  // Historial completo para que el comparativo del gráfico también pueda leer el período anterior.
  const chartHistory = useMemo(() => {
    let filtered = [...allMetrics];
    if (selectedUserEmail !== 'all') {
      const userObj = users.find(u => u.email === selectedUserEmail);
      if (userObj) filtered = filtered.filter(m => m.user_id === userObj.id);
    } else if (excludedUserIds.length > 0) {
      filtered = filtered.filter(m => !excludedUserIds.includes(m.user_id));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => users.find(u => u.id === m.user_id)?.email.toLowerCase().includes(term));
    }
    return filtered;
  }, [allMetrics, selectedUserEmail, users, excludedUserIds, searchTerm]);

  const metricsToday = useMemo(() => filteredMetrics.filter(m => m.date === todayStr), [filteredMetrics, todayStr]);

  // Ranking global por resolución neta y técnicos enviados en el período seleccionado.
  const technicianRanking = useMemo(() => {
    const rows = users.map(person => {
      const records = dateFilteredMetrics.filter(metric => metric.user_id === person.id);
      const totalManaged = records.reduce((sum, metric) => sum + (Number(metric.cases_managed) || 0), 0);
      const totalTechnicians = records.reduce((sum, metric) => sum + (Number(metric.technicians_sent) || 0), 0);
      if (totalManaged <= 0) return null;

      const resolutionRate = ((totalManaged - totalTechnicians) / totalManaged) * 100;
      // Margen de técnicos respecto al objetivo global de resolución configurado.
      // Positivo: puede absorber más envíos; negativo: está por debajo del objetivo.
      const resolutionDifference = (totalManaged - totalTechnicians) - Math.ceil(totalManaged * (standards.RESOLUTION_GREEN / 100));
      const tiers = [...(Array.isArray(standards.resolution_bonus_tiers) ? standards.resolution_bonus_tiers : DEFAULT_RESOLUTION_TIERS)]
        .sort((a, b) => Number(b.min) - Number(a.min));
      const resolutionTier = tiers.find(tier => resolutionRate >= Number(tier.min));
      const resolutionPenalty = Number(resolutionTier?.bonus ?? tiers[tiers.length - 1]?.bonus ?? -2);

      return {
        id: person.id,
        email: person.email,
        totalManaged,
        totalTechnicians,
        resolutionRate,
        resolutionDifference,
        resolutionPenalty
      };
    }).filter(Boolean);

    return rows.sort((a, b) =>
      b.resolutionDifference - a.resolutionDifference
      || b.resolutionRate - a.resolutionRate
      || a.totalTechnicians - b.totalTechnicians
      || a.email.localeCompare(b.email)
    );
  }, [users, dateFilteredMetrics, standards.resolution_bonus_tiers]);


  // Historial unificado considerando exclusión de usuarios en modo global
  const unifiedHistory = useMemo(() => {
    const targetUsers = selectedUserEmail === 'all'
      ? users.filter(u => !excludedUserIds.includes(u.id))
      : users.filter(u => u.email === selectedUserEmail);

    return targetUsers.map(u => {
      const userRows = dateFilteredMetrics.filter(m => m.user_id === u.id);
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
  }, [dateFilteredMetrics, users, standards, selectedUserEmail, excludedUserIds]);

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
  const isSuperAdmin = Boolean(isAdmin && SUPER_ADMIN_EMAILS.has(String(profile?.email || user?.email || '').trim().toLowerCase()));

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
        showMessage('success', 'Configuración de espectador guardada localmente.');
        setIsSavingConfig(false);
        return;
      }

      const { error } = await supabase
        .from('app_config')
        .upsert([payload], { onConflict: 'key' });

      if (error) throw error;

      showMessage('success', 'Configuración actualizada exitosamente.');
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
      console.error('Error al guardar configuración:', err);
      showMessage('error', `Error al guardar: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const resetConfigToDefault = () => {
    if (window.confirm('¿Restablecer todos los valores a los predeterminados?')) {
      setFormConfig({
        gxh_green: 4.00,
        gxh_yellow: 3.50,
        resolution_green: 84.0,
        resolution_yellow: 81.0,
        closed_green: 78.8,
        closed_yellow: 76.8,
        time_per_case: 950,
        time_per_managed: 950,
        gxh_bonus_tiers: DEFAULT_GXH_TIERS,
        resolution_bonus_tiers: DEFAULT_RESOLUTION_TIERS
      });
      showMessage('info', 'Valores restablecidos a predeterminados. Presiona Guardar para aplicar.');
    }
  };

  if (!isProfileLoaded) {
    return (
      <div className="login-overlay">
        <div className="login-card" style={{ textAlign: 'center', padding: '40px' }}>
          <Activity size={32} className="spinning text-primary" style={{ marginBottom: 16 }} />
          <p>Verificando credenciales de administrador...</p>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin' || !profile.is_enabled) {
    return (
      <div className="login-overlay">
        <div className="login-card" style={{ textAlign: 'center', maxWidth: '400px', border: '1px solid var(--accent-error)' }}>
          <AlertCircle size={48} style={{ color: 'var(--accent-error)', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '22px', color: 'var(--text-bright)', marginBottom: '10px' }}>Acceso No Autorizado</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>Tu cuenta no tiene permisos administrativos o ha sido deshabilitada.</p>

          <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-muted)' }}>Redirigiendo automáticamente en</p>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--accent-error)' }}>{countdown}s</div>
          </div>

          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            <ArrowLeft size={15} /> Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Mensajes de notificación */}
      {message.text && (
        <div className={`mensaje activo mensaje-${message.type}`} style={{ zIndex: 4000 }}>
          {message.type === 'success' && <CheckCircle2 size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
          {message.type === 'error' && <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
          {message.text}
        </div>
      )}

      {/* BARRA LATERAL (SIDEBAR) */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="sidebar-header-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database className="text-primary" size={18} />
              <h1 style={{ margin: 0, fontSize: '17px' }}>Panel de Administración</h1>
            </div>
            {toggleTheme && (
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Cambiar a Tema Claro' : 'Cambiar a Tema Oscuro'}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                <span>{theme === 'dark' ? 'CLARO' : 'OSCURO'}</span>
              </button>
            )}
          </div>
          <div className="subtitle">PANEL DE CONTROL</div>
        </header>

        <section className="user-info">
          <span>{user?.email}</span>
          <div style={{ fontSize: '10px', background: 'var(--primary)', color: '#ffffff', padding: '2px 8px', fontWeight: 'bold', textTransform: 'uppercase' }}>ADMINISTRADOR</div>
        </section>

        <nav className="action-section" style={{ gap: '10px', flexGrow: 1, overflowY: 'auto', paddingRight: '5px' }}>
          <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '4px' }} onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} /> Panel Usuario
          </button>

          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '11px', fontWeight: 'bold' }}
            onClick={() => navigate('/status')}
          >
            <Activity size={13} style={{ color: '#10b981' }} /> Diagnóstico y Estado de Red
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn ${activeTab === 'monitor' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => setActiveTab('monitor')}
              >
                <BarChart3 size={13} /> Monitoreo
              </button>
              <button
                className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => setActiveTab('config')}
              >
                <Settings size={13} /> Configuración
              </button>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="metric-label" style={{ fontSize: '11px', margin: 0 }}>
                <Mail size={11} style={{ marginRight: 5 }} /> Directorio
              </h3>
              {excludedUserIds.length > 0 && selectedUserEmail === 'all' && (
                <span style={{ fontSize: '10px', color: 'var(--accent-warning)', fontWeight: 'bold' }}>
                  {excludedUserIds.length} excluido{excludedUserIds.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {users.map(u => {
                const isExcluded = excludedUserIds.includes(u.id);
                const isSelected = selectedUserEmail === u.email;

                return (
                  <div
                    key={u.id}
                    className={`user-list-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedUserEmail(u.email)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid',
                      background: isSelected ? 'rgba(99, 102, 241, 0.12)' : isExcluded && selectedUserEmail === 'all' ? 'rgba(234, 179, 8, 0.05)' : 'transparent',
                      borderColor: isSelected ? 'var(--primary-light)' : isExcluded && selectedUserEmail === 'all' ? 'rgba(234, 179, 8, 0.3)' : 'transparent',
                      color: isSelected ? 'var(--text-bright)' : isExcluded && selectedUserEmail === 'all' ? 'var(--text-muted)' : 'var(--text-dim)',
                      opacity: isExcluded && selectedUserEmail === 'all' ? 0.75 : 1
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_enabled ? 'var(--accent-success)' : 'var(--text-dim)' }}></div>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flexGrow: 1,
                      textDecoration: isExcluded && selectedUserEmail === 'all' ? 'line-through' : 'none'
                    }}>
                      {u.email}
                    </span>

                    {/* Botón para Excluir / Incluir en vista Global */}
                    {selectedUserEmail === 'all' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExcludeUser(u.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isExcluded ? 'var(--accent-warning)' : 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px'
                        }}
                        title={isExcluded ? 'Volver a incluir en el registro global' : 'Excluir del registro global conjunto'}
                      >
                        {isExcluded ? <UserCheck size={13} /> : <UserX size={13} />}
                      </button>
                    )}

                    {u.role === 'admin' ? (
                      isSuperAdmin && !isProtectedSuperAdmin(u) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoleConfirmMakeAdmin(false);
                            setRoleConfirmUser(u);
                          }}
                          disabled={!u.is_enabled || roleUpdatingUserId === u.id}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-warning)', cursor: u.is_enabled ? 'pointer' : 'not-allowed', opacity: u.is_enabled ? 1 : 0.45, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Retirar permisos de administrador"
                        >
                          {roleUpdatingUserId === u.id ? <Activity size={12} className="spinning" /> : <UserRoundCog size={12} />}
                        </button>
                      ) : (
                        <span title={isProtectedSuperAdmin(u) ? 'Administrador total protegido' : 'Administrador'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent-success)', fontSize: 10, fontWeight: 700 }}>
                          <ShieldCheck size={12} />
                        </span>
                      )
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoleConfirmMakeAdmin(true);
                          setRoleConfirmUser(u);
                        }}
                        disabled={!u.is_enabled || roleUpdatingUserId === u.id}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: u.is_enabled ? 'pointer' : 'not-allowed', opacity: u.is_enabled ? 1 : 0.45, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={u.is_enabled ? 'Otorgar permisos de administrador' : 'El perfil está deshabilitado'}
                      >
                        {roleUpdatingUserId === u.id ? <Activity size={12} className="spinning" /> : <UserRoundCog size={12} />}
                      </button>
                    )}

                    {(u.role !== 'admin' || (isSuperAdmin && !isProtectedSuperAdmin(u))) && !isProtectedSuperAdmin(u) && (
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
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-error)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'}
                        title="Limpiar datos e historial del usuario"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}

              <div
                onClick={() => setSelectedUserEmail('all')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textAlign: 'center',
                  marginTop: '6px',
                  background: selectedUserEmail === 'all' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid',
                  borderColor: selectedUserEmail === 'all' ? 'var(--primary-light)' : 'var(--border-light)',
                  fontWeight: selectedUserEmail === 'all' ? '700' : '500'
                }}
              >
                {selectedUserEmail === 'all' && excludedUserIds.length > 0
                  ? `Mostrar Global (Excepto ${excludedUserIds.length} ${excludedUserIds.length === 1 ? 'perfil' : 'perfiles'})`
                  : 'Mostrar Global (Todos)'}
              </div>

              {selectedUserEmail === 'all' && excludedUserIds.length === 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowTechnicianRanking(true)}
                  style={{ width: '100%', marginTop: '6px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontSize: '10px', fontWeight: 700 }}
                >
                  <ClipboardList size={13} /> Ver ranking de técnicos
                </button>
              )}

              {excludedUserIds.length > 0 && selectedUserEmail === 'all' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '4px', fontSize: '10px', marginTop: '2px' }}
                  onClick={clearExcludedUsers}
                >
                  Restablecer (Incluir todos)
                </button>
              )}
            </div>
          </div>
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
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
            unifiedHistory={unifiedHistory}
            setViewingUserDetails={setViewingUserDetails}
            isRefreshing={isRefreshing}
            fetchData={fetchData}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            handleResetToCurrentMonth={handleResetToCurrentMonth}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            formatLastUpdated={formatLastUpdated}
            getStatusClass={getStatusClass}
            selectedUserEmail={selectedUserEmail}
            excludedUserIds={excludedUserIds}
            clearExcludedUsers={clearExcludedUsers}
            chartHistory={chartHistory}
            calculateRecordBonus={calculateRecordBonus}
            theme={theme}
            chartScopeLabel={selectedUserEmail === 'all' ? 'Global' : selectedUserEmail}
          />
        )}
      </main>

      <UserDetailsModal
        viewingUserDetails={viewingUserDetails}
        onClose={() => setViewingUserDetails(null)}
        standards={standards}
        getStatusClass={getStatusClass}
        isSuperAdmin={isSuperAdmin}
        isProtectedAccount={isProtectedSuperAdmin(viewingUserDetails)}
        onClearDataClick={(u) => setDeleteConfirmModal({ show: true, targetUser: u, mode: 'clear' })}
        onDeleteClick={(u) => setDeleteConfirmModal({ show: true, targetUser: u, mode: 'delete' })}
        onBanClick={(u) => setDeleteConfirmModal({ show: true, targetUser: u, mode: u.is_enabled ? 'ban' : 'unban' })}
      />

      {roleConfirmUser && (
        <div role="presentation" onClick={() => setRoleConfirmUser(null)} style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <section role="dialog" aria-modal="true" aria-labelledby="role-confirm-title" onClick={event => event.stopPropagation()} className="login-card" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <ShieldCheck size={20} style={{ color: 'var(--primary-light)' }} />
              <h2 id="role-confirm-title" style={{ margin: 0, fontSize: 18 }}>{roleConfirmMakeAdmin ? 'Otorgar Rol Administrador' : 'Retirar Rol Administrador'}</h2>
            </div>
            <p style={{ color: 'var(--text-main)', lineHeight: 1.5 }}>{roleConfirmMakeAdmin ? <>¿Confirmas otorgar permisos de administrador a <strong>{roleConfirmUser.email}</strong>?</> : <>¿Confirmas retirar los permisos de administrador a <strong>{roleConfirmUser.email}</strong>?</>}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>{roleConfirmMakeAdmin ? 'Tendrá acceso administrativo al sistema, sujeto a los límites de su nivel de administrador.' : 'El perfil conservará sus datos y métricas, pero volverá a tener permisos de usuario.'}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} disabled={roleUpdatingUserId === roleConfirmUser.id} onClick={() => setRoleConfirmUser(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={roleUpdatingUserId === roleConfirmUser.id} onClick={() => handleSetAdminRole(roleConfirmUser, roleConfirmMakeAdmin)}>
                <ShieldCheck size={14} />{roleUpdatingUserId === roleConfirmUser.id ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </section>
        </div>
      )}

      <DeleteConfirmModal
        show={deleteConfirmModal.show}
        targetUser={deleteConfirmModal.targetUser}
        mode={deleteConfirmModal.mode || 'delete'}
        isDeleting={isDeleting}
        onCancel={() => setDeleteConfirmModal({ show: false, targetUser: null, mode: 'delete' })}
        onConfirm={handleConfirmUserAction}
      />


      {showTechnicianRanking && selectedUserEmail === 'all' && excludedUserIds.length === 0 && (
        <div
          role="presentation"
          onClick={() => setShowTechnicianRanking(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="technician-ranking-title"
            onClick={event => event.stopPropagation()}
            className="login-card"
            style={{ width: '100%', maxWidth: 900, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <h2 id="technician-ranking-title" style={{ margin: 0, fontSize: 17 }}>Ranking de técnicos enviados y resolución</h2>
                <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 11 }}>
                  Período: {startDate || 'Inicio'} al {endDate || 'Actualidad'} · Ordenado por mayor margen disponible frente al objetivo de resolución
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTechnicianRanking(false)} aria-label="Cerrar ranking" style={{ padding: 7 }}>
                <X size={16} />
              </button>
            </header>

            <div style={{ overflow: 'auto', padding: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '10px 8px', width: 48 }}>#</th>
                    <th style={{ padding: '10px 8px' }}>Técnico</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Resolución</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Técnicos enviados</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Diferencia a favor / en contra</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Bonificación</th>
                  </tr>
                </thead>
                <tbody>
                  {technicianRanking.map((item, index) => {
                    const penalized = item.resolutionPenalty <= -1;
                    return (
                      <tr key={item.id} style={{
                        background: penalized ? 'rgba(239, 68, 68, 0.16)' : 'transparent',
                        borderBottom: '1px solid var(--border-light)',
                        color: penalized ? 'var(--text-bright)' : 'var(--text-main)'
                      }}>
                        <td style={{ padding: '11px 8px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{index + 1}</td>
                        <td style={{ padding: '11px 8px', fontWeight: 600 }}>{item.email}</td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{item.resolutionRate.toFixed(1)}%</td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{item.totalTechnicians}</td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: item.resolutionDifference > 0 ? 'var(--accent-success)' : item.resolutionDifference < 0 ? 'var(--accent-error)' : 'var(--text-muted)' }}>
                          {item.resolutionDifference > 0 ? `+${item.resolutionDifference} a favor` : item.resolutionDifference < 0 ? `${item.resolutionDifference} en contra` : '0 · justo'}
                        </td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: penalized ? 'var(--accent-error)' : 'var(--text-muted)' }}>
                          {item.resolutionPenalty > 0 ? '+' : ''}{item.resolutionPenalty.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  {technicianRanking.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No hay métricas registradas en el período seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
              <p style={{ margin: '12px 2px 0', color: 'var(--text-muted)', fontSize: 10 }}>
                Las filas rojas indican una bonificación de resolución de −1 o inferior según los tramos configurados actualmente.
              </p>
            </div>
          </section>
        </div>
      )}

      <style>{`
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
