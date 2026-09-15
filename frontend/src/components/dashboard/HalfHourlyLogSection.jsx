import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, Play, History, X, Eye } from 'lucide-react';

export default function HalfHourlyLogSection({
  closedCount = 0,
  managedCount = 0,
  techniciansCount = 0,
  timerSeconds = 0,
  stats = {}
}) {
  const [logs, setLogs] = useState([]);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [nextCutStr, setNextCutStr] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getHalfHourSlot = (dateObj = new Date()) => {
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = dateObj.getMinutes() < 30 ? '00' : '30';
    return `${h}:${m}`;
  };

  const getNextCutTime = (dateObj = new Date()) => {
    const next = new Date(dateObj);
    if (next.getMinutes() < 30) {
      next.setMinutes(30, 0, 0);
    } else {
      next.setHours(next.getHours() + 1, 0, 0, 0);
    }
    const h = String(next.getHours()).padStart(2, '0');
    const m = String(next.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // Filtra los logs para omitir cualquier corte fantasma con 0s previo al inicio real de actividad
  const filterMeaningfulLogs = (rawLogs) => {
    if (!Array.isArray(rawLogs)) return [];
    const firstActiveIndex = rawLogs.findIndex(item => (item.managed > 0 || item.closed > 0));
    if (firstActiveIndex === -1) {
      return [];
    }
    return rawLogs.slice(firstActiveIndex);
  };

  // Load saved frontend logs for today from localStorage, limpiando cortes en 0 si los hubiera
  useEffect(() => {
    const todayStr = getTodayStr();
    const saved = localStorage.getItem(`gxh_half_hourly_logs_${todayStr}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const filtered = filterMeaningfulLogs(parsed);
        setLogs(filtered);
        // Mantener localStorage limpio sin registros espurios de 0s
        localStorage.setItem(`gxh_half_hourly_logs_${todayStr}`, JSON.stringify(filtered));
      } catch (e) {
        console.error('Error loading half hourly frontend logs', e);
      }
    }
  }, []);

  // Frontend automatic ticker: sólo registra a partir de que empiezan a haber datos reales
  useEffect(() => {
    const updateTicker = () => {
      const now = new Date();
      const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setCurrentTimeStr(timeString);
      setNextCutStr(getNextCutTime(now));

      const todayStr = getTodayStr();
      const currentSlot = getHalfHourSlot(now);

      setLogs((prevLogs) => {
        // Solo comenzamos el registro si ya hay casos gestionados o cerrados, o si ya existían registros con actividad
        const hasStarted = (managedCount > 0 || closedCount > 0 || prevLogs.some(item => item.managed > 0 || item.closed > 0));

        if (!hasStarted) {
          // Si no hay datos, no acumulamos registros en 0 a las 6 de la mañana o de horas inactivas
          if (prevLogs.length > 0) {
            localStorage.setItem(`gxh_half_hourly_logs_${todayStr}`, JSON.stringify([]));
            return [];
          }
          return prevLogs;
        }

        const existingIndex = prevLogs.findIndex(item => item.slot === currentSlot);
        const resoRate = managedCount > 0 ? ((managedCount - techniciansCount) / managedCount) * 100 : 0;

        const currentEntry = {
          slot: currentSlot,
          realTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          closed: closedCount,
          managed: managedCount,
          technicians: techniciansCount,
          gxh: stats.managedPerHour || 0,
          resolutionRate: parseFloat(resoRate.toFixed(2)),
          status: 'EN CURSO'
        };

        let newLogs = [...prevLogs];

        // Marcar los slots anteriores al actual como 'COMPLETADO'
        newLogs = newLogs.map(item => {
          if (item.slot !== currentSlot && item.status === 'EN CURSO') {
            return { ...item, status: 'COMPLETADO' };
          }
          return item;
        });

        if (existingIndex >= 0) {
          // Solo actualizamos el corte activo 'EN CURSO'
          if (newLogs[existingIndex].status === 'EN CURSO') {
            newLogs[existingIndex] = {
              ...newLogs[existingIndex],
              ...currentEntry
            };
          }
        } else {
          newLogs.push(currentEntry);
        }

        // Ordenar cronológicamente
        newLogs.sort((a, b) => a.slot.localeCompare(b.slot));

        // Filtrar para asegurar que no queden registros en 0 previos
        const cleanedLogs = filterMeaningfulLogs(newLogs);

        localStorage.setItem(`gxh_half_hourly_logs_${todayStr}`, JSON.stringify(cleanedLogs));
        return cleanedLogs;
      });
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [closedCount, managedCount, techniciansCount, timerSeconds, stats.managedPerHour]);

  // Lista de cortes con datos
  const activeLogs = filterMeaningfulLogs(logs);

  // Determinar el corte actual que se muestra en la pantalla principal
  const currentSlot = getHalfHourSlot(new Date());
  const currentCut = activeLogs.find(item => item.slot === currentSlot) || (activeLogs.length > 0 ? activeLogs[activeLogs.length - 1] : null);

  // Calcular delta para el corte actual respecto al corte anterior
  let currentDeltaManaged = 0;
  let currentDeltaClosed = 0;
  if (currentCut) {
    const currentCutIdx = activeLogs.findIndex(item => item.slot === currentCut.slot);
    const prevCut = currentCutIdx > 0 ? activeLogs[currentCutIdx - 1] : null;
    currentDeltaManaged = prevCut ? currentCut.managed - prevCut.managed : currentCut.managed;
    currentDeltaClosed = prevCut ? currentCut.closed - prevCut.closed : currentCut.closed;
  }

  return (
    <div className="section-container" style={{ marginTop: '30px' }}>
      {/* HEADER DE SECCIÓN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>04 / REGISTROS AUTOMÁTICOS CADA 30 MINUTOS (HORA REAL)</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', letterSpacing: '0.04em' }}>
            CORTE CRONOLÓGICO ACTIVO DE LA MEDIA HORA ACTUAL
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Reloj y próximo corte */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '6px 14px', 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.06em'
          }}>
            <Clock size={14} style={{ color: 'var(--primary)' }} />
            <span>HORA REAL: <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>{currentTimeStr || '--:--:--'}</strong></span>
            <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>|</span>
            <span>PRÓXIMO CORTE: <strong style={{ fontFamily: 'var(--font-code)' }}>{nextCutStr || '--:--'}</strong></span>
          </div>

          {/* Botón para abrir el Preview con el listado del día */}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.06em',
              backgroundColor: activeLogs.length > 0 ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
              border: '1px solid var(--primary)',
              color: activeLogs.length > 0 ? 'var(--primary-light, #60a5fa)' : 'var(--text-secondary)',
              cursor: activeLogs.length > 0 ? 'pointer' : 'default',
              opacity: activeLogs.length > 0 ? 1 : 0.6,
              transition: 'all 0.2s ease'
            }}
            disabled={activeLogs.length === 0}
            title={activeLogs.length === 0 ? 'Aún no hay cortes con datos registrados hoy' : 'Ver todos los cortes del día en una ventana emergente'}
          >
            <History size={14} />
            <span>PREVIEW CORTES DEL DÍA</span>
            {activeLogs.length > 0 && (
              <span style={{
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                padding: '1px 6px',
                fontSize: '10px',
                fontWeight: '900',
                fontFamily: 'var(--font-code)'
              }}>
                {activeLogs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL: MUESTRA ÚNICAMENTE EL CORTE ACTUAL */}
      <div className="table-responsive">
        <table className="history-table">
          <thead>
            <tr>
              <th>HORA CORTE</th>
              <th>GESTIONADOS (ACUM)</th>
              <th>DIFERENCIA (DELTA)</th>
              <th>CERRADOS (ACUM)</th>
              <th>DIFERENCIA (DELTA)</th>
              <th>TÉCNICOS</th>
              <th>GxH ESTIMADO</th>
              <th>RESOLUCIÓN %</th>
              <th>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {!currentCut ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '26px 20px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <Clock size={14} style={{ color: 'var(--primary)' }} />
                    <span>Aguardando inicio de actividad: Los cortes automáticos se activarán a partir de tu primera gestión o caso cerrado del día.</span>
                  </div>
                </td>
              </tr>
            ) : (
              <tr style={{ backgroundColor: currentCut.status === 'EN CURSO' ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                <td style={{ fontWeight: '800', fontFamily: 'var(--font-code)', color: 'var(--primary)', letterSpacing: '0.06em' }}>
                  {currentCut.slot} hs
                </td>
                <td style={{ fontFamily: 'var(--font-code)', fontSize: '14px', fontWeight: '700' }}>
                  {currentCut.managed}
                </td>
                <td>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    padding: '2px 6px',
                    backgroundColor: currentDeltaManaged > 0 ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                    color: currentDeltaManaged > 0 ? '#22c55e' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)'
                  }}>
                    {currentDeltaManaged >= 0 ? `+${currentDeltaManaged}` : currentDeltaManaged}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-code)', fontSize: '14px', fontWeight: '700' }}>
                  {currentCut.closed}
                </td>
                <td>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    padding: '2px 6px',
                    backgroundColor: currentDeltaClosed > 0 ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                    color: currentDeltaClosed > 0 ? '#22c55e' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)'
                  }}>
                    {currentDeltaClosed >= 0 ? `+${currentDeltaClosed}` : currentDeltaClosed}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-code)' }}>
                  {currentCut.technicians}
                </td>
                <td style={{ fontFamily: 'var(--font-code)' }}>
                  {currentCut.gxh}
                </td>
                <td style={{ fontFamily: 'var(--font-code)' }}>
                  {currentCut.resolutionRate}%
                </td>
                <td>
                  {currentCut.status === 'EN CURSO' ? (
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      fontSize: '10px', 
                      fontWeight: '800', 
                      padding: '3px 8px', 
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: 'var(--primary)',
                      border: '1px solid var(--primary)'
                    }}>
                      <Play size={10} style={{ animation: 'pulse 1.5s infinite' }} /> EN CURSO
                    </span>
                  ) : (
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      fontSize: '10px', 
                      fontWeight: '800', 
                      padding: '3px 8px', 
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      color: '#22c55e',
                      border: '1px solid #22c55e'
                    }}>
                      <CheckCircle2 size={10} /> COMPLETADO
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL PREVIEW CON TODOS LOS CORTES DEL DÍA */}
      {showPreview && (
        <div className="modal-overlay active" onClick={() => setShowPreview(false)}>
          <div 
            className="modal" 
            style={{ 
              maxWidth: '920px', 
              width: '95%', 
              maxHeight: '88vh', 
              display: 'flex', 
              flexDirection: 'column',
              padding: '24px'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Eye size={18} style={{ color: 'var(--primary)' }} />
                <div>
                  <h2 style={{ fontSize: '15px', margin: 0, letterSpacing: '0.04em' }}>
                    04 / PREVIEW DE CORTES DEL DÍA ({getTodayStr()})
                  </h2>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Listado cronológico de cortes registrados a partir del inicio de actividad
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowPreview(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Métricas / Chips resumen de la jornada */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              flexWrap: 'wrap', 
              marginBottom: '16px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              fontSize: '11px',
              letterSpacing: '0.04em'
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>INICIO DE REGISTRO: </span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
                  {activeLogs.length > 0 ? `${activeLogs[0].slot} hs` : '--:--'}
                </strong>
              </div>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>ÚLTIMO CORTE: </span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
                  {activeLogs.length > 0 ? `${activeLogs[activeLogs.length - 1].slot} hs` : '--:--'}
                </strong>
              </div>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>TOTAL CORTES REGISTRADOS: </span>
                <strong style={{ fontFamily: 'var(--font-code)' }}>{activeLogs.length}</strong>
              </div>
            </div>

            {/* Modal Body / Tabla completa de cortes */}
            <div style={{ overflowY: 'auto', maxHeight: '55vh' }} className="table-responsive">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>HORA CORTE</th>
                    <th>GESTIONADOS (ACUM)</th>
                    <th>DIFERENCIA (DELTA)</th>
                    <th>CERRADOS (ACUM)</th>
                    <th>DIFERENCIA (DELTA)</th>
                    <th>TÉCNICOS</th>
                    <th>GxH ESTIMADO</th>
                    <th>RESOLUCIÓN %</th>
                    <th>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLogs.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                        No hay cortes registrados con actividad en el día de hoy.
                      </td>
                    </tr>
                  ) : (
                    activeLogs.map((item, idx) => {
                      const prevItem = idx > 0 ? activeLogs[idx - 1] : null;
                      const deltaM = prevItem ? item.managed - prevItem.managed : item.managed;
                      const deltaC = prevItem ? item.closed - prevItem.closed : item.closed;

                      return (
                        <tr key={item.slot} style={{ backgroundColor: item.status === 'EN CURSO' ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                          <td style={{ fontWeight: '800', fontFamily: 'var(--font-code)', color: 'var(--primary)', letterSpacing: '0.06em' }}>
                            {item.slot} hs
                          </td>
                          <td style={{ fontFamily: 'var(--font-code)', fontSize: '14px', fontWeight: '700' }}>
                            {item.managed}
                          </td>
                          <td>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '700', 
                              padding: '2px 6px',
                              backgroundColor: deltaM > 0 ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                              color: deltaM > 0 ? '#22c55e' : 'var(--text-secondary)',
                              border: '1px solid var(--border-color)'
                            }}>
                              {deltaM >= 0 ? `+${deltaM}` : deltaM}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-code)', fontSize: '14px', fontWeight: '700' }}>
                            {item.closed}
                          </td>
                          <td>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '700', 
                              padding: '2px 6px',
                              backgroundColor: deltaC > 0 ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                              color: deltaC > 0 ? '#22c55e' : 'var(--text-secondary)',
                              border: '1px solid var(--border-color)'
                            }}>
                              {deltaC >= 0 ? `+${deltaC}` : deltaC}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-code)' }}>
                            {item.technicians}
                          </td>
                          <td style={{ fontFamily: 'var(--font-code)' }}>
                            {item.gxh}
                          </td>
                          <td style={{ fontFamily: 'var(--font-code)' }}>
                            {item.resolutionRate}%
                          </td>
                          <td>
                            {item.status === 'EN CURSO' ? (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontSize: '10px', 
                                fontWeight: '800', 
                                padding: '3px 8px', 
                                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                color: 'var(--primary)',
                                border: '1px solid var(--primary)'
                              }}>
                                <Play size={10} style={{ animation: 'pulse 1.5s infinite' }} /> EN CURSO
                              </span>
                            ) : (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontSize: '10px', 
                                fontWeight: '800', 
                                padding: '3px 8px', 
                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                color: '#22c55e',
                                border: '1px solid #22c55e'
                              }}>
                                <CheckCircle2 size={10} /> COMPLETADO
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setShowPreview(false)}
                style={{ padding: '8px 20px', fontSize: '12px', fontWeight: '700' }}
              >
                Cerrar Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
