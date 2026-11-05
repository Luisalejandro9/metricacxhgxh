import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  ArrowLeft,
  RefreshCw,
  Clock,
  Layers,
  LineChart,
  Settings,
  AlertCircle,
  CheckCircle,
  Sun,
  Moon
} from 'lucide-react';
import { getEffectiveSupabaseUrl, DIRECT_SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import HistoricoTable from './HistoricoTable';
import HistoricoChart from './HistoricoChart';
import HistoricoConfig from './HistoricoConfig';
import '../../App.css';

const DEFAULT_CONFIG = {
  supabaseUrl: DIRECT_SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  ingestToken: '',
  viewToken: '',
  pulsoEmail: 'luis.acosta@konecta.com'
};

export default function PulsoHistorico({ theme, toggleTheme }) {
  const navigate = useNavigate();

  // 1. Estado de Configuración (cargada de localStorage)
  const [config, setConfig] = useState(() => {
    try {
      const savedUrl = localStorage.getItem('pulso_supabase_url');
      const savedKey = localStorage.getItem('pulso_anon_key');
      const savedIngest = localStorage.getItem('pulso_ingest_token');
      const savedView = localStorage.getItem('pulso_view_token');
      const savedEmail = localStorage.getItem('pulso_email');

      return {
        supabaseUrl: savedUrl || DEFAULT_CONFIG.supabaseUrl,
        anonKey: savedKey || DEFAULT_CONFIG.anonKey,
        ingestToken: savedIngest || DEFAULT_CONFIG.ingestToken,
        viewToken: savedView || DEFAULT_CONFIG.viewToken,
        pulsoEmail: savedEmail || DEFAULT_CONFIG.pulsoEmail
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  // 2. Estado de Datos
  const [activeTab, setActiveTab] = useState('tabla'); // 'tabla' | 'evolucion' | 'config'
  const [allRecords, setAllRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Guardar configuración en localStorage
  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('pulso_supabase_url', newConfig.supabaseUrl);
      localStorage.setItem('pulso_anon_key', newConfig.anonKey);
      localStorage.setItem('pulso_ingest_token', newConfig.ingestToken);
      localStorage.setItem('pulso_view_token', newConfig.viewToken);
      localStorage.setItem('pulso_email', newConfig.pulsoEmail);
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
    }
    // Reintentar lectura con el nuevo token
    fetchData(newConfig);
  };

  // 3. Lectura de Métricas vía RPC 'leer'
  const fetchData = useCallback(
    async (cfg = config) => {
      const token = cfg.viewToken?.trim();
      if (!token) {
        setErrorMsg('Falta el Token de Vista (view_token). Configúralo en la pestaña "Configuración & Carga".');
        setAllRecords([]);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);

      try {
        const targetUrl = `${cfg.supabaseUrl}/rest/v1/rpc/leer`;
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`
          },
          body: JSON.stringify({ p_token: token })
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 401 || errText.includes('token de vista invalido')) {
            throw new Error('Token de vista inválido. Verifica el token en la configuración.');
          }
          throw new Error(`Error en servidor (${res.status}): ${errText}`);
        }

        const data = await res.json();
        setAllRecords(Array.isArray(data) ? data : []);
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Error al leer histórico:', err);
        setErrorMsg(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [config]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 4. Ingestión manual (Plan B de pegado)
  const handleIngestData = async ({ info, produ, rel }) => {
    const token = config.ingestToken?.trim();
    if (!token) {
      throw new Error('Falta el Token de Carga (ingest_token). Configúralo primero.');
    }

    const targetUrl = `${config.supabaseUrl}/rest/v1/rpc/ingest`;
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      },
      body: JSON.stringify({
        p_token: token,
        p_info: info,
        p_produ: produ,
        p_rel: rel
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Error HTTP ${res.status}`);
    }

    const resultText = await res.text();
    // Refrescar automáticamente la tabla tras guardar
    await fetchData();
    return resultText;
  };

  // 5. Metadatos de la Última Carga
  const latestSnapshotInfo = useMemo(() => {
    if (!allRecords.length) return null;
    const first = allRecords[0];
    return {
      fecha_hora_carga: first.fecha_hora_carga,
      intervalo: first.intervalo,
      responsable: first.responsable,
      snapshot_id: first.snapshot_id
    };
  }, [allRecords]);

  // Registros que corresponden únicamente a la última carga
  const latestRecords = useMemo(() => {
    if (!latestSnapshotInfo) return [];
    return allRecords.filter((r) => r.snapshot_id === latestSnapshotInfo.snapshot_id);
  }, [allRecords, latestSnapshotInfo]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER DE NAVEGACIÓN */}
      <header
        style={{
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-sidebar)',
          padding: '16px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-light)',
              color: 'var(--text-main)',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '700'
            }}
          >
            <ArrowLeft size={14} /> Volver al Tracker
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} color="var(--primary)" />
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-bright)' }}>
                HISTÓRICO PULSO (CXH / GXH)
              </h1>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '800', letterSpacing: '0.15em' }}>
              REPORTE DIARIO E INTRADÍA DE RENDIMIENTO
            </div>
          </div>
        </div>

        {/* Acciones del Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-main)',
              padding: '8px 14px',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '700'
            }}
            title="Refrescar métricas"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Sincronizando...' : 'Refrescar'}</span>
          </button>

          {toggleTheme && (
            <button
              onClick={toggleTheme}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: '700'
              }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? 'CLARO' : 'OSCURO'}</span>
            </button>
          )}
        </div>
      </header>

      {/* BARRA DE ESTADO DE LA ÚLTIMA CARGA */}
      <section
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          padding: '12px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
          <Clock size={16} color="var(--primary)" />
          {latestSnapshotInfo ? (
            <span>
              Última Carga Registrada:{' '}
              <strong style={{ color: 'var(--text-bright)' }}>{latestSnapshotInfo.fecha_hora_carga}</strong> | Intervalo:{' '}
              <strong style={{ color: 'var(--text-bright)' }}>{latestSnapshotInfo.intervalo}</strong>
              {latestSnapshotInfo.responsable && (
                <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                  (Resp: {latestSnapshotInfo.responsable})
                </span>
              )}
            </span>
          ) : (
            <span style={{ color: 'var(--text-dim)' }}>No hay cargas guardadas en la base de datos aún.</span>
          )}
        </div>

        {lastSyncTime && (
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Última comprobación: {lastSyncTime.toLocaleTimeString()}
          </div>
        )}
      </section>

      {/* MENSAJES DE ERROR GLOBALES */}
      {errorMsg && (
        <div
          style={{
            margin: '20px 28px 0',
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--accent-error)',
            borderRadius: '6px',
            color: 'var(--accent-error)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PESTAÑAS PRINCIPALES */}
      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)' }}>
          <button
            onClick={() => setActiveTab('tabla')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'tabla' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'tabla' ? 'var(--text-bright)' : 'var(--text-muted)',
              borderTop: activeTab === 'tabla' ? '2px solid var(--primary)' : '2px solid transparent',
              borderLeft: activeTab === 'tabla' ? '1px solid var(--border-light)' : 'none',
              borderRight: activeTab === 'tabla' ? '1px solid var(--border-light)' : 'none',
              borderBottom: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '12px',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase'
            }}
          >
            <Layers size={15} /> Tabla Última Carga ({latestRecords.length})
          </button>

          <button
            onClick={() => setActiveTab('evolucion')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'evolucion' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'evolucion' ? 'var(--text-bright)' : 'var(--text-muted)',
              borderTop: activeTab === 'evolucion' ? '2px solid var(--primary)' : '2px solid transparent',
              borderLeft: activeTab === 'evolucion' ? '1px solid var(--border-light)' : 'none',
              borderRight: activeTab === 'evolucion' ? '1px solid var(--border-light)' : 'none',
              borderBottom: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '12px',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase'
            }}
          >
            <LineChart size={15} /> Evolución & Tendencias
          </button>

          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'config' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'config' ? 'var(--text-bright)' : 'var(--text-muted)',
              borderTop: activeTab === 'config' ? '2px solid var(--primary)' : '2px solid transparent',
              borderLeft: activeTab === 'config' ? '1px solid var(--border-light)' : 'none',
              borderRight: activeTab === 'config' ? '1px solid var(--border-light)' : 'none',
              borderBottom: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '12px',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase'
            }}
          >
            <Settings size={15} /> Carga & Configuración
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ padding: '24px 28px', flexGrow: 1 }}>
        {activeTab === 'tabla' && (
          <HistoricoTable records={latestRecords} lastSnapshotInfo={latestSnapshotInfo} />
        )}

        {activeTab === 'evolucion' && (
          <HistoricoChart allRecords={allRecords} />
        )}

        {activeTab === 'config' && (
          <HistoricoConfig
            config={config}
            onSaveConfig={handleSaveConfig}
            onIngestData={handleIngestData}
          />
        )}
      </main>
    </div>
  );
}

