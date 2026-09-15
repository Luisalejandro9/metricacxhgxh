import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, Play } from 'lucide-react';

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

  // Load saved frontend logs for today from localStorage
  useEffect(() => {
    const todayStr = getTodayStr();
    const saved = localStorage.getItem(`gxh_half_hourly_logs_${todayStr}`);
    if (saved) {
      try {
        setLogs(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading half hourly frontend logs', e);
      }
    }
  }, []);

  // Pure frontend automatic ticker: records and locks snapshots every 30 mins
  useEffect(() => {
    const updateTicker = () => {
      const now = new Date();
      const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setCurrentTimeStr(timeString);
      setNextCutStr(getNextCutTime(now));

      const todayStr = getTodayStr();
      const currentSlot = getHalfHourSlot(now);

      setLogs((prevLogs) => {
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

        // Mark all past slots before the current active slot as 'COMPLETADO'
        newLogs = newLogs.map(item => {
          if (item.slot !== currentSlot && item.status === 'EN CURSO') {
            return { ...item, status: 'COMPLETADO' };
          }
          return item;
        });

        if (existingIndex >= 0) {
          // Keep completed values intact; only update the active 'EN CURSO' slot
          if (newLogs[existingIndex].status === 'EN CURSO') {
            newLogs[existingIndex] = {
              ...newLogs[existingIndex],
              ...currentEntry
            };
          }
        } else {
          // Auto-start tracking if user has activity or timer running
          if (managedCount > 0 || closedCount > 0 || timerSeconds > 0 || prevLogs.length > 0) {
            newLogs.push(currentEntry);
          }
        }

        // Sort chronologically by slot time
        newLogs.sort((a, b) => a.slot.localeCompare(b.slot));

        // Save strictly to client-side localStorage
        localStorage.setItem(`gxh_half_hourly_logs_${todayStr}`, JSON.stringify(newLogs));
        return newLogs;
      });
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [closedCount, managedCount, techniciansCount, timerSeconds, stats.managedPerHour]);

  return (
    <div className="section-container" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>04 / REGISTROS AUTOMÁTICOS CADA 30 MINUTOS (HORA REAL)</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', letterSpacing: '0.04em' }}>
            CORTE CRONOLÓGICO AUTOMÁTICO EN EL FRONTEND (CADA MEDIA HORA DE RELOJ)
          </div>
        </div>

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
          <span>PRÓXIMO CORTE AUTOMÁTICO: <strong style={{ fontFamily: 'var(--font-code)' }}>{nextCutStr || '--:--'}</strong></span>
        </div>
      </div>

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
            {logs.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  El contador registrará automáticamente los avances al llegar a cada media hora (ej: 08:00, 08:30, 09:00, 09:30...).
                </td>
              </tr>
            ) : (
              logs.map((item, idx) => {
                const prevItem = idx > 0 ? logs[idx - 1] : null;
                const deltaManaged = prevItem ? item.managed - prevItem.managed : item.managed;
                const deltaClosed = prevItem ? item.closed - prevItem.closed : item.closed;

                return (
                  <tr key={item.slot} style={{ backgroundColor: item.status === 'EN CURSO' ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
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
                        backgroundColor: deltaManaged > 0 ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                        color: deltaManaged > 0 ? '#22c55e' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)'
                      }}>
                        {deltaManaged >= 0 ? `+${deltaManaged}` : deltaManaged}
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
                        backgroundColor: deltaClosed > 0 ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                        color: deltaClosed > 0 ? '#22c55e' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)'
                      }}>
                        {deltaClosed >= 0 ? `+${deltaClosed}` : deltaClosed}
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
    </div>
  );
}
