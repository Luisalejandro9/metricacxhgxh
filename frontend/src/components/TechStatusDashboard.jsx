import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  Server,
  HardDrive,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  Terminal,
  Cpu,
  LogOut,
  Building2,
  Trash2,
  Shield
} from 'lucide-react';
import { supabase, DIRECT_SUPABASE_URL, getEffectiveSupabaseUrl } from '../lib/supabase';
import { fetchRecentIncidents, clearAllIncidents } from '../lib/incidentSentinel';

const TECH_PASS = '1553758631';
const CURRENT_VERSION = typeof __APP_BUILD_VERSION__ !== 'undefined' ? __APP_BUILD_VERSION__ : 'dev';

export function TechStatusDashboard({ onExit }) {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('tech_status_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Diagnostic states
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // 1. Direct DNS test (to see if Konecta is blocking supabase.co)
  const [directDnsTest, setDirectDnsTest] = useState({ status: 'loading' });

  // 2. Proxy test (to see if our Netlify bypass is working)
  const [proxyTest, setProxyTest] = useState({ status: 'loading' });

  // 3. Tables test
  const [tableTests, setTableTests] = useState({
    daily_metrics: { table: 'daily_metrics', label: 'Métricas Diarias', status: 'loading' },
    profiles: { table: 'profiles', label: 'Perfiles / Usuarios', status: 'loading' },
    app_config: { table: 'app_config', label: 'Configuración Global', status: 'loading' },
    network_incidents: { table: 'network_incidents', label: 'Centinela de Red', status: 'loading' },
  });

  // 4. Version test
  const [serverVersion, setServerVersion] = useState('Verificando...');
  const [versionSyncStatus, setVersionSyncStatus] = useState('checking');

  // 5. Offline Cache stats
  const [cacheStats, setCacheStats] = useState({
    timerState: false,
    countsToday: 0,
    halfHourlyLogs: 0,
    totalBytes: 0,
  });

  // 6. Centinela Remoto: Incidentes de bloqueo DNS en la oficina (Konecta)
  const [officeIncidents, setOfficeIncidents] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [clearingIncidents, setClearingIncidents] = useState(false);

  // Login Handler
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === TECH_PASS) {
      setIsAuthenticated(true);
      sessionStorage.setItem('tech_status_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Contraseña incorrecta. Acceso denegado.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('tech_status_auth');
    setPasswordInput('');
  };

  // Inspect LocalStorage cache
  const readCacheStats = () => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (key && val) {
          total += key.length + val.length;
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const timerState = !!localStorage.getItem('gxh_timer_state');
      const countsStr = localStorage.getItem(`gxh_counts_${todayStr}`);
      const logsStr = localStorage.getItem(`gxh_half_hourly_logs_${todayStr}`);

      let countsCount = 0;
      if (countsStr) {
        try { countsCount = Object.keys(JSON.parse(countsStr)).length; } catch {}
      }

      let logsCount = 0;
      if (logsStr) {
        try { logsCount = JSON.parse(logsStr).length; } catch {}
      }

      setCacheStats({
        timerState,
        countsToday: countsCount,
        halfHourlyLogs: logsCount,
        totalBytes: total,
      });
    } catch {
      // Ignore
    }
  };

  // Test 1: Direct DNS query to supabase.co
  const runDirectDnsTest = useCallback(async () => {
    setDirectDnsTest({ status: 'loading' });
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      // Attempt direct connection to Supabase hostname (bypassing Netlify proxy)
      const res = await fetch(`${DIRECT_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);

      setDirectDnsTest({
        status: 'open',
        durationMs: duration,
        details: `Conexión directa libre (${res.status} OK, ${duration}ms). No hay bloqueo DNS activo en este momento.`,
      });
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const isTimeout = err?.name === 'AbortError';
      setDirectDnsTest({
        status: 'blocked',
        durationMs: duration,
        details: isTimeout
          ? `TIMEOUT (${duration}ms) - Red de Konecta bloqueando silenciosamente los paquetes a supabase.co.`
          : `BLOQUEO DNS DETECTADO: ${err.message || 'DNS NXDOMAIN / Fallo de resolución'}.`,
      });
    }
  }, []);

  // Test 2: Netlify Proxy query
  const runProxyTest = useCallback(async () => {
    setProxyTest({ status: 'loading' });
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      // Test the local proxy URL: /supabase/rest/v1/
      const proxyBase = getEffectiveSupabaseUrl();
      const res = await fetch(`${proxyBase}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          apikey: supabase.supabaseKey || '',
        },
      });
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);

      if (res.ok || res.status === 200 || res.status === 204 || res.status === 401) {
        setProxyTest({
          status: 'ok',
          durationMs: duration,
          httpStatus: res.status,
          details: `Proxy de Netlify funcionando al 100%. Latencia de enlace: ${duration}ms.`,
        });
      } else {
        setProxyTest({
          status: 'error',
          durationMs: duration,
          httpStatus: res.status,
          details: `Proxy respondió con código HTTP ${res.status}.`,
        });
      }
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setProxyTest({
        status: 'error',
        durationMs: duration,
        details: `Fallo de conexión hacia el proxy: ${err.message || 'Error de red'}`,
      });
    }
  }, []);

  // Test 3: Table queries through the configured client
  const runTableTests = useCallback(async () => {
    const tables = [
      { key: 'daily_metrics', label: 'Métricas Diarias' },
      { key: 'profiles', label: 'Perfiles / Usuarios' },
      { key: 'app_config', label: 'Configuración Global' },
      { key: 'network_incidents', label: 'Centinela de Red' },
    ];

    for (const tbl of tables) {
      setTableTests((prev) => ({
        ...prev,
        [tbl.key]: { table: tbl.key, label: tbl.label, status: 'loading' },
      }));

      const start = performance.now();
      try {
        const { count, error } = await supabase
          .from(tbl.key)
          .select('id', { count: 'exact', head: true });

        const duration = Math.round(performance.now() - start);

        if (error) {
          setTableTests((prev) => ({
            ...prev,
            [tbl.key]: { table: tbl.key, label: tbl.label, status: 'error', durationMs: duration, errorMsg: error.message },
          }));
        } else {
          setTableTests((prev) => ({
            ...prev,
            [tbl.key]: { table: tbl.key, label: tbl.label, status: 'ok', count: count || 0, durationMs: duration },
          }));
        }
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        setTableTests((prev) => ({
          ...prev,
          [tbl.key]: { table: tbl.key, label: tbl.label, status: 'error', durationMs: duration, errorMsg: err.message },
        }));
      }
    }
  }, []);

  // Test 4: Version checking
  const runVersionTest = useCallback(async () => {
    setVersionSyncStatus('checking');
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const v = data?.version || 'Desconocida';
        setServerVersion(v);
        if (v === CURRENT_VERSION || CURRENT_VERSION === 'dev') {
          setVersionSyncStatus('ok');
        } else {
          setVersionSyncStatus('update_available');
        }
      } else {
        setServerVersion('Error al consultar');
      }
    } catch {
      setServerVersion('No disponible');
    }
  }, []);

  // Test 6: Sonda del Centinela Remoto (Incidentes de la oficina)
  const loadOfficeIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const data = await fetchRecentIncidents();
      setOfficeIncidents(data);
    } catch {
      // Silencioso
    } finally {
      setLoadingIncidents(false);
    }
  }, []);

  const handleClearIncidents = async () => {
    if (!window.confirm('¿Deseas vaciar el historial de incidentes de la oficina?')) return;
    setClearingIncidents(true);
    try {
      const ok = await clearAllIncidents();
      if (ok) {
        setOfficeIncidents([]);
      }
    } finally {
      setClearingIncidents(false);
    }
  };

  // Run all tests
  const runAllDiagnostics = useCallback(async () => {
    setIsRunningAll(true);
    readCacheStats();
    await Promise.all([
      runDirectDnsTest(),
      runProxyTest(),
      runTableTests(),
      runVersionTest(),
      loadOfficeIncidents(),
    ]);
    setLastCheckTime(new Date());
    setIsRunningAll(false);
  }, [runDirectDnsTest, runProxyTest, runTableTests, runVersionTest, loadOfficeIncidents]);

  useEffect(() => {
    if (isAuthenticated) {
      runAllDiagnostics();
    }
  }, [isAuthenticated, runAllDiagnostics]);

  // Copy diagnostic report
  const copyReportToClipboard = () => {
    const recentOfficeBlocks = officeIncidents.filter((inc) => {
      const t = new Date(inc.created_at).getTime();
      return Date.now() - t < 30 * 60 * 1000;
    });

    const report = `
═══════════════════════════════════════════════════════════
   REPORTE TÉCNICO DE RED & TELEMETRÍA - CONTADOR CxH GxH
═══════════════════════════════════════════════════════════
Fecha y Hora: ${new Date().toLocaleString()}
Dominio Actual: ${typeof window !== 'undefined' ? window.location.origin : ''}
URL Efectiva Supabase: ${getEffectiveSupabaseUrl()}

[ 1. ESTADO DE BLOQUEO DNS DE KONECTA (EQUIPO LOCAL) ]
- Conexión Directa a Supabase (${DIRECT_SUPABASE_URL}):
  Estado: ${directDnsTest.status.toUpperCase()} (${directDnsTest.durationMs || 0}ms)
  Detalles: ${directDnsTest.details || ''}
- Proxy Inverso Blindado (${getEffectiveSupabaseUrl()}):
  Estado: ${proxyTest.status.toUpperCase()} (${proxyTest.durationMs || 0}ms)
  Detalles: ${proxyTest.details || ''}

[ 2. CENTINELA DE RED EN LA OFICINA (KONECTA REMOTO) ]
- Bloqueos DNS reportados hoy (últimas 24h): ${officeIncidents.length}
- Bloqueos en los últimos 30 minutos: ${recentOfficeBlocks.length}
- Diagnóstico en Sede: ${recentOfficeBlocks.length > 0 ? '🔴 BLOQUEO ACTIVO DETECTADO (MITIGADO POR PROXY)' : officeIncidents.length > 0 ? '🟡 BLOQUEOS MITIGADOS HOY' : '🟢 RED DESPEJADA (0 INCIDENTES)'}

[ 3. SALUD DE TABLAS EN TIEMPO REAL ]
- Métricas Diarias: ${tableTests.daily_metrics?.status === 'ok' ? `OK (${tableTests.daily_metrics.count} registros, ${tableTests.daily_metrics.durationMs}ms)` : `ERROR: ${tableTests.daily_metrics?.errorMsg}`}
- Perfiles / Usuarios: ${tableTests.profiles?.status === 'ok' ? `OK (${tableTests.profiles.count} registros, ${tableTests.profiles.durationMs}ms)` : `ERROR: ${tableTests.profiles?.errorMsg}`}
- Configuración Global: ${tableTests.app_config?.status === 'ok' ? `OK (${tableTests.app_config.count} registros, ${tableTests.app_config.durationMs}ms)` : `ERROR: ${tableTests.app_config?.errorMsg}`}
- Centinela de Red: ${tableTests.network_incidents?.status === 'ok' ? `OK (${tableTests.network_incidents.count} registros, ${tableTests.network_incidents.durationMs}ms)` : `ERROR: ${tableTests.network_incidents?.errorMsg}`}

[ 4. VERSIÓN & AUTO-UPDATER ]
- Versión en Navegador: ${CURRENT_VERSION}
- Versión en Netlify: ${serverVersion}
- Estado de Sincronización: ${versionSyncStatus === 'ok' ? 'AL DÍA' : 'ACTUALIZACIÓN PENDIENTE'}

[ 5. CACHÉ OFFLINE LOCALSTORAGE ]
- Total en Caché: ${(cacheStats.totalBytes / 1024).toFixed(1)} KB almacenados
- Timer Activo: ${cacheStats.timerState ? 'SÍ' : 'NO'} | Cortes 30 min: ${cacheStats.halfHourlyLogs}
═══════════════════════════════════════════════════════════
`.trim();

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // ─────────────────────────────────────────────────────────────
  // GATE SCREEN: Security Login Form
  // ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="tech-status-container">
        <div className="tech-login-card">
          <div className="tech-login-header">
            <div className="tech-login-badge">
              <Terminal size={14} />
              <span>SISTEMA INTERNO</span>
            </div>
            <h2>CENTRO DE ESTADO TÉCNICO</h2>
            <p>Diagnóstico de infraestructura, conectividad y defensas anti-bloqueo DNS.</p>
          </div>

          <form onSubmit={handleLogin} className="tech-login-form">
            <div className="tech-input-group">
              <label>CONTRASEÑA DE INGENIERÍA</label>
              <div className="tech-input-wrapper">
                <Lock size={16} className="tech-input-icon" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Ingresa la clave de acceso..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="tech-input"
                />
              </div>
            </div>

            {loginError && (
              <div className="tech-error-msg">
                <AlertTriangle size={15} />
                <span>{loginError}</span>
              </div>
            )}

            <div className="tech-form-buttons">
              <button type="button" onClick={onExit} className="tech-btn-secondary">
                <ArrowLeft size={15} />
                <span>VOLVER AL SITIO</span>
              </button>
              <button type="submit" className="tech-btn-primary">
                <span>INGRESAR AL PANEL</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // AUTHENTICATED: Full Technical Diagnostics Console
  // ─────────────────────────────────────────────────────────────
  const isDirectBlocked = directDnsTest.status === 'blocked';
  const isProxyWorking = proxyTest.status === 'ok';
  const recentOfficeBlocks = officeIncidents.filter((inc) => {
    const t = new Date(inc.created_at).getTime();
    return Date.now() - t < 30 * 60 * 1000;
  });

  return (
    <div className="tech-status-container">
      {/* Top Header Bar */}
      <header className="tech-topbar">
        <div className="tech-topbar-left">
          <button onClick={onExit} className="tech-back-btn" title="Regresar al portal principal">
            <ArrowLeft size={16} />
            <span>PORTAL PRINCIPAL</span>
          </button>
          <div className="tech-title-block">
            <div className="tech-title-row">
              <Activity size={18} className="tech-icon-pulse" />
              <h1>DIAGNÓSTICO TÉCNICO // ESTADO DE RED</h1>
            </div>
            <span className="tech-subtitle">
              MONITOR DE DEFENSAS ANTI-BLOQUEO DNS, PROXY Y SINCRONIZACIÓN (CxH / GxH)
            </span>
          </div>
        </div>

        <div className="tech-topbar-actions">
          <button
            onClick={copyReportToClipboard}
            className="tech-action-btn"
            title="Copiar reporte al portapapeles"
          >
            {copiedReport ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
            <span>{copiedReport ? 'COPIADO' : 'COPIAR REPORTE'}</span>
          </button>
          <button
            onClick={runAllDiagnostics}
            disabled={isRunningAll}
            className="tech-action-btn primary"
            title="Re-ejecutar todas las pruebas de red y base de datos"
          >
            <RefreshCw size={14} className={isRunningAll ? 'spin' : ''} />
            <span>{isRunningAll ? 'DIAGNOSTICANDO...' : 'TEST EN VIVO'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="tech-action-btn danger"
            title="Cerrar sesión de diagnóstico"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Diagnostic Body */}
      <main className="tech-main-grid">
        {/* Banner: Overall Health Verdict */}
        <section className={`tech-verdict-banner ${isProxyWorking ? 'status-protected' : 'status-critical'}`}>
          <div className="tech-verdict-icon">
            {isProxyWorking ? (
              <ShieldCheck size={36} />
            ) : (
              <ShieldOff size={36} />
            )}
          </div>
          <div className="tech-verdict-body">
            <div className="tech-verdict-tag">
              {isProxyWorking ? 'ESCUDO OPERATIVO' : 'FALLA CRÍTICA'}
            </div>
            <h3>
              {isDirectBlocked && isProxyWorking
                ? 'EL BYPASS ESTÁ SALVANDO LA CONEXIÓN (BLOQUEO DE KONECTA MITIGADO)'
                : isProxyWorking
                  ? 'SISTEMA PROTEGIDO // CONEXIÓN TOTALMENTE OPERATIVA'
                  : 'ALERTA: FALLO EN PROXY O SIN INTERNET'}
            </h3>
            <p>
              {isDirectBlocked && isProxyWorking
                ? 'La red de Konecta tiene bloqueado en este momento el dominio directo de Supabase. Sin embargo, el sitio web sigue funcionando perfectamente en todas las PCs gracias al proxy inverso en tu dominio de Netlify.'
                : isProxyWorking
                  ? 'Todas las peticiones se canalizan de forma transparente a través de Netlify (/supabase). No se registran pérdidas de paquetes ni bloqueos activos.'
                  : 'El proxy no está respondiendo y la conexión directa está interrumpida. El banner de advertencia se mostrará arriba del header.'}
            </p>
          </div>
          <div className="tech-verdict-meta">
            <Clock size={13} />
            <span>Último test: {lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Iniciando...'}</span>
          </div>
        </section>

        {/* SECTION 1: Dual Network / DNS Probe */}
        <div className="tech-dual-grid">
          {/* Direct Supabase DNS Probe */}
          <div className={`tech-card ${isDirectBlocked ? 'card-warning' : 'card-ok'}`}>
            <div className="tech-card-header">
              <div className="tech-card-title">
                {isDirectBlocked ? <WifiOff size={18} /> : <Wifi size={18} />}
                <span>1. CONEXIÓN DIRECTA A SUPABASE</span>
              </div>
              <span className={`tech-pill-badge ${isDirectBlocked ? 'badge-red' : 'badge-green'}`}>
                {directDnsTest.status === 'loading'
                  ? 'SONDEANDO...'
                  : isDirectBlocked
                    ? 'BLOQUEO ACTIVO'
                    : 'LIBRE'}
              </span>
            </div>
            <div className="tech-card-content">
              <div className="tech-metric-row">
                <span className="tech-metric-label">Destino de Red:</span>
                <code className="tech-code">{DIRECT_SUPABASE_URL}</code>
              </div>
              <div className="tech-metric-row">
                <span className="tech-metric-label">Latencia:</span>
                <span className="tech-metric-val">{directDnsTest.durationMs ? `${directDnsTest.durationMs} ms` : '—'}</span>
              </div>
              <div className="tech-log-box">
                {directDnsTest.details || 'Ejecutando ping directo sin intermediarios...'}
              </div>
            </div>
          </div>

          {/* Netlify Proxy Probe */}
          <div className={`tech-card ${isProxyWorking ? 'card-ok' : 'card-error'}`}>
            <div className="tech-card-header">
              <div className="tech-card-title">
                <ShieldCheck size={18} />
                <span>2. PROXY INVERSO DEL DOMINIO (NETLIFY)</span>
              </div>
              <span className={`tech-pill-badge ${isProxyWorking ? 'badge-green' : 'badge-red'}`}>
                {proxyTest.status === 'loading'
                  ? 'PROBANDO...'
                  : isProxyWorking
                    ? 'PROTEGIENDO'
                    : 'ERROR'}
              </span>
            </div>
            <div className="tech-card-content">
              <div className="tech-metric-row">
                <span className="tech-metric-label">Ruta Proxy:</span>
                <code className="tech-code">{getEffectiveSupabaseUrl()}</code>
              </div>
              <div className="tech-metric-row">
                <span className="tech-metric-label">Latencia de Enlace:</span>
                <span className="tech-metric-val">{proxyTest.durationMs ? `${proxyTest.durationMs} ms` : '—'}</span>
              </div>
              <div className="tech-log-box">
                {proxyTest.details || 'Comprobando respuesta a través de /supabase/*...'}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Database Tables Live Status */}
        <div className="tech-card">
          <div className="tech-card-header">
            <div className="tech-card-title">
              <Server size={18} />
              <span>3. SALUD DE TABLAS Y BASE DE DATOS (LECTURA EN VIVO)</span>
            </div>
            <button
              onClick={runTableTests}
              className="tech-sub-btn"
              title="Volver a consultar las tablas"
            >
              <RefreshCw size={12} />
              <span>TEST TABLAS</span>
            </button>
          </div>
          <div className="tech-card-content">
            <div className="tech-tables-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {Object.values(tableTests).map((t) => (
                <div key={t.table} className={`tech-table-item ${t.status}`}>
                  <div className="tech-table-head">
                    <span className="tech-table-name">{t.label.toUpperCase()}</span>
                    {t.status === 'ok' ? (
                      <CheckCircle2 size={16} className="color-ok" />
                    ) : t.status === 'error' ? (
                      <XCircle size={16} className="color-err" />
                    ) : (
                      <RefreshCw size={14} className="spin color-loading" />
                    )}
                  </div>
                  <div className="tech-table-body">
                    <div className="tech-table-count">
                      {t.status === 'ok' ? `${t.count ?? 0} registros` : t.status === 'loading' ? 'Verificando...' : 'Fallo'}
                    </div>
                    <div className="tech-table-ms">
                      {t.durationMs ? `${t.durationMs} ms` : '—'}
                    </div>
                  </div>
                  {t.errorMsg && <div className="tech-table-err">{t.errorMsg}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: Auto-Updater & LocalStorage Resiliency */}
        <div className="tech-dual-grid">
          {/* Version / AutoUpdater Card */}
          <div className="tech-card">
            <div className="tech-card-header">
              <div className="tech-card-title">
                <Cpu size={18} />
                <span>4. MONITOR DE VERSIONES & AUTO-UPDATER</span>
              </div>
              <span className={`tech-pill-badge ${versionSyncStatus === 'ok' ? 'badge-green' : 'badge-yellow'}`}>
                {versionSyncStatus === 'ok' ? 'SINCRONIZADO' : 'PENDIENTE'}
              </span>
            </div>
            <div className="tech-card-content">
              <div className="tech-metric-row">
                <span className="tech-metric-label">Versión en Navegador:</span>
                <code className="tech-code">{CURRENT_VERSION}</code>
              </div>
              <div className="tech-metric-row">
                <span className="tech-metric-label">Versión en Netlify:</span>
                <code className="tech-code">{serverVersion}</code>
              </div>
              <div className="tech-metric-row">
                <span className="tech-metric-label">Mecánica Silenciosa:</span>
                <span className="tech-metric-val">ACTIVA (Sondeo cada 30s)</span>
              </div>
              <div className="tech-info-note">
                Cuando subes cambios a Netlify, el Auto-Updater recarga automáticamente las pestañas en segundo plano cuando el operador cambia de ventana, sin necesidad de F5.
              </div>
            </div>
          </div>

          {/* LocalStorage Offline Caching */}
          <div className="tech-card">
            <div className="tech-card-header">
              <div className="tech-card-title">
                <HardDrive size={18} />
                <span>5. INTEGRIDAD DE CACHÉ LOCAL (LOCALSTORAGE)</span>
              </div>
              <span className="tech-pill-badge badge-green">DISPONIBLE</span>
            </div>
            <div className="tech-card-content">
              <div className="tech-cache-grid">
                <div className="tech-cache-item">
                  <span>Timer Activo</span>
                  <strong>{cacheStats.timerState ? 'GUARDADO' : 'INACTIVO'}</strong>
                </div>
                <div className="tech-cache-item">
                  <span>Cortes 30m</span>
                  <strong>{cacheStats.halfHourlyLogs} cortes</strong>
                </div>
                <div className="tech-cache-item">
                  <span>Métricas Hoy</span>
                  <strong>{cacheStats.countsToday} campos</strong>
                </div>
                <div className="tech-cache-item highlight" style={{ gridColumn: 'span 3' }}>
                  <span>Espacio Total Utilizado en Caché</span>
                  <strong>{(cacheStats.totalBytes / 1024).toFixed(1)} KB</strong>
                </div>
              </div>
              <div className="tech-info-note">
                El contador y los registros cada 30 minutos se guardan localmente para no perder datos ante cortes temporales de conexión.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Live Office Network Monitor (Passive Sentinel) */}
        <div className={`tech-card ${recentOfficeBlocks.length > 0 ? 'card-warning' : officeIncidents.length > 0 ? 'card-ok' : 'card-ok'}`}>
          <div className="tech-card-header">
            <div className="tech-card-title">
              <Building2 size={18} />
              <span>6. ESTADO DE LA RED DE LA OFICINA EN VIVO (CENTINELA REMOTO)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`tech-pill-badge ${recentOfficeBlocks.length > 0 ? 'badge-red' : officeIncidents.length > 0 ? 'badge-yellow' : 'badge-green'}`}>
                {recentOfficeBlocks.length > 0
                  ? 'BLOQUEO EN CURSO'
                  : officeIncidents.length > 0
                    ? `${officeIncidents.length} HOY (MITIGADOS)`
                    : 'RED DESPEJADA'}
              </span>
              <button
                onClick={loadOfficeIncidents}
                disabled={loadingIncidents}
                className="tech-sub-btn"
                title="Actualizar registro de incidentes de la oficina"
              >
                <RefreshCw size={12} className={loadingIncidents ? 'spin' : ''} />
                <span>{loadingIncidents ? 'REVISANDO...' : 'REFRESCAR'}</span>
              </button>
              {officeIncidents.length > 0 && (
                <button
                  onClick={handleClearIncidents}
                  disabled={clearingIncidents}
                  className="tech-sub-btn"
                  style={{ color: '#f87171' }}
                  title="Limpiar registro de incidentes"
                >
                  <Trash2 size={12} />
                  <span>{clearingIncidents ? 'LIMPIANDO...' : 'VACIAR'}</span>
                </button>
              )}
            </div>
          </div>
          <div className="tech-card-content">
            <div className="tech-office-summary">
              <div className="tech-office-stat">
                <span className="tech-stat-label">Estado en Sede Konecta:</span>
                <span className={`tech-stat-badge ${recentOfficeBlocks.length > 0 ? 'stat-alert' : 'stat-ok'}`}>
                  {recentOfficeBlocks.length > 0 ? '🔴 Bloqueo activo detectado en los últimos 30 min' : '🟢 Sin bloqueos recientes en los últimos 30 min'}
                </span>
              </div>
              <div className="tech-office-stat">
                <span className="tech-stat-label">Total eventos hoy (24h):</span>
                <span className="tech-stat-val">{officeIncidents.length} reporte(s)</span>
              </div>
              <div className="tech-office-stat">
                <span className="tech-stat-label">Último incidente registrado:</span>
                <span className="tech-stat-val">
                  {officeIncidents.length > 0
                    ? new Date(officeIncidents[0].created_at).toLocaleString()
                    : 'Ninguno en las últimas 24 horas'}
                </span>
              </div>
            </div>

            {/* Lista cronológica de incidentes */}
            {officeIncidents.length > 0 ? (
              <div className="tech-incidents-list">
                {officeIncidents.map((incident) => {
                  const dateObj = new Date(incident.created_at);
                  const isRecent = Date.now() - dateObj.getTime() < 30 * 60 * 1000;
                  return (
                    <div key={incident.id} className={`tech-incident-row ${isRecent ? 'recent' : ''}`}>
                      <div className="tech-incident-time">
                        <Clock size={12} />
                        <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="tech-incident-date">{dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</span>
                      </div>
                      <div className="tech-incident-body">
                        <div className="tech-incident-tag">
                          <Shield size={11} />
                          <span>MITIGADO POR PROXY NETLIFY</span>
                        </div>
                        <p className="tech-incident-desc">{incident.details}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="tech-log-box" style={{ borderLeftColor: '#10b981' }}>
                🟢 No se han registrado incidentes de bloqueo DNS desde las computadoras de la oficina hoy. Si la red de Konecta activa un bloqueo mientras estás en tu casa, aparecerá registrado aquí de inmediato de forma 100% pasiva y anónima.
              </div>
            )}

            <div className="tech-info-note" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={14} style={{ color: '#10b981', flexShrink: 0 }} />
              <span>
                <strong>100% Seguro ante IT Corporativo:</strong> El centinela pasivo no registra direcciones IP, nombres de máquinas ni identificadores de agentes. Es una telemetría técnica estándar idéntica a la que usan herramientas de uptime y observabilidad web, sin riesgo de alertas de seguridad ni spyware.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TechStatusDashboard;
