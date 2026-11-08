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
import PulsoHistoryTables from './PulsoHistoryTables';
import '../../App.css';

export default function PulsoHistorico({ theme, toggleTheme, user, profile }) {
  const isAdmin = profile?.role === 'admin' || (user?.email && (
    user.email === 'lacosta.develop@gmail.com' ||
    user.email === 'lacosta151999@gmail.com' ||
    user.email === 'luis.acosta@konecta.com'
  ));
  const navigate = useNavigate();

  // Estado de Datos
  const [activeTab, setActiveTab] = useState('tabla'); // tabla | historial | evolucion
  const [allRecords, setAllRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [snapshotDate, setSnapshotDate] = useState('');
  const [isSavingSnapshotDate, setIsSavingSnapshotDate] = useState(false);
  const [snapshotDateMessage, setSnapshotDateMessage] = useState(null);

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

  // El selector permite corregir el día de referencia sin cambiar la hora de captura.
  const getDateInputValue = (value) => {
    if (!value) return '';
    const isoMatch = String(value).match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
    if (isoMatch) return isoMatch[0];
    const localMatch = String(value).match(/^(\\d{2})[\\/-](\\d{2})[\\/-](\\d{4})/);
    if (localMatch) return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
    return '';
  };

  useEffect(() => {
    setSnapshotDate(getDateInputValue(latestSnapshotInfo?.fecha_hora_carga));
    setSnapshotDateMessage(null);
  }, [latestSnapshotInfo?.snapshot_id, latestSnapshotInfo?.fecha_hora_carga]);

  const handleSaveSnapshotDate = async () => {
    if (!isAdmin || !latestSnapshotInfo?.snapshot_id || !snapshotDate) return;
    const token = localStorage.getItem('pulso_ingest_token')?.trim();
    if (!token) {
      setSnapshotDateMessage({ type: 'error', text: 'Falta el Token de Carga. Configuralo en Admin > Carga & Configuración Pulso.' });
      return;
    }

    setIsSavingSnapshotDate(true);
    setSnapshotDateMessage(null);
    try {
      const { error } = await supabase.rpc('corregir_fecha_snapshot', {
        p_token: token,
        p_snapshot_id: latestSnapshotInfo.snapshot_id,
        p_fecha: snapshotDate
      });
      if (error) throw error;
      setSnapshotDateMessage({ type: 'success', text: 'Fecha del corte actualizada correctamente.' });
      await fetchData();
    } catch (err) {
      console.error('Error al corregir fecha de carga:', err);
      setSnapshotDateMessage({ type: 'error', text: err.message || 'No se pudo actualizar la fecha.' });
    } finally {
      setIsSavingSnapshotDate(false);
    }
  };

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

      {isAdmin && latestSnapshotInfo && (
        <section style={{ margin: '16px 28px 0', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-bright)' }}>Corregir fecha del corte</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Cambia el día al que corresponden estos datos; no modifica las métricas ni el intervalo.</div>
          </div>
          <input
            type="date"
            value={snapshotDate}
            onChange={(e) => setSnapshotDate(e.target.value)}
            aria-label="Fecha correspondiente al corte"
            style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: '4px', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '12px' }}
          />
          <button
            type="button"
            onClick={handleSaveSnapshotDate}
            disabled={isSavingSnapshotDate || !snapshotDate || snapshotDate === getDateInputValue(latestSnapshotInfo.fecha_hora_carga)}
            style={{ padding: '8px 14px', border: 'none', borderRadius: '4px', background: 'var(--primary)', color: '#fff', fontWeight: '700', fontSize: '12px', cursor: isSavingSnapshotDate ? 'wait' : 'pointer', opacity: isSavingSnapshotDate || !snapshotDate || snapshotDate === getDateInputValue(latestSnapshotInfo.fecha_hora_carga) ? 0.55 : 1 }}
          >
            {isSavingSnapshotDate ? 'Guardando...' : 'Guardar fecha'}
          </button>
          {snapshotDateMessage && (
            <div style={{ flexBasis: '100%', fontSize: '12px', color: snapshotDateMessage.type === 'success' ? 'var(--accent-success)' : 'var(--accent-error)' }}>
              {snapshotDateMessage.text}
            </div>
          )}
        </section>
      )}

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
            onClick={() => setActiveTab('historial')}
            style={{
              padding: '12px 20px',
              background: activeTab === 'historial' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'historial' ? 'var(--text-bright)' : 'var(--text-muted)',
              borderTop: activeTab === 'historial' ? '2px solid var(--primary)' : '2px solid transparent',
              borderLeft: activeTab === 'historial' ? '1px solid var(--border-light)' : 'none',
              borderRight: activeTab === 'historial' ? '1px solid var(--border-light)' : 'none',
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
            <Layers size={15} /> Historial de registros y acumulados
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

        {activeTab === 'historial' && <PulsoHistoryTables allRecords={allRecords} />}

        {activeTab === 'evolucion' && (
          <HistoricoChart allRecords={allRecords} />
        )}
      </main>
    </div>
  );
}
