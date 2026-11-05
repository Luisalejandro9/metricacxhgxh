import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  ArrowLeft,
  RefreshCw,
  Clock,
  Layers,
  LineChart,
  ShieldCheck,
  AlertCircle,
  Sun,
  Moon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import HistoricoTable from './HistoricoTable';
import HistoricoChart from './HistoricoChart';
import '../../App.css';

export default function PulsoHistorico({ theme, toggleTheme, user, profile }) {
  const isAdmin = profile?.role === 'admin' || (user?.email && (
    user.email === 'lacosta.develop@gmail.com' ||
    user.email === 'lacosta151999@gmail.com' ||
    user.email === 'luis.acosta@konecta.com'
  ));
  const navigate = useNavigate();

  // Estado de Datos
  const [activeTab, setActiveTab] = useState('tabla'); // 'tabla' | 'evolucion'
  const [allRecords, setAllRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Lectura de Métricas vía RPC 'leer' usando el cliente Supabase
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Llamada resiliente a leer()
      const { data, error } = await supabase.rpc('leer', { p_token: null });

      if (error) {
        throw error;
      }

      setAllRecords(Array.isArray(data) ? data : []);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Error al leer histórico de Pulso:', err);
      setErrorMsg(err.message || 'Error al conectar con la base de datos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extraer información del snapshot más reciente
  const latestSnapshotInfo = useMemo(() => {
    if (!allRecords || allRecords.length === 0) return null;
    const first = allRecords[0];
    return {
      snapshot_id: first.snapshot_id,
      fecha_hora_carga: first.fecha_hora_carga,
      intervalo: first.intervalo,
      responsable: first.responsable
    };
  }, [allRecords]);

  // Filtrar registros que pertenecen únicamente al snapshot más reciente
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

          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid var(--primary)',
                color: 'var(--primary-light)',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700'
              }}
              title="Ir al Panel de Administración"
            >
              <ShieldCheck size={14} /> Panel Admin (Cargar Datos)
            </button>
          )}

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
            <span style={{ color: 'var(--text-dim)' }}>
              {isLoading ? 'Cargando datos...' : 'No hay cargas guardadas en la base de datos aún.'}
            </span>
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
      </main>
    </div>
  );
}
