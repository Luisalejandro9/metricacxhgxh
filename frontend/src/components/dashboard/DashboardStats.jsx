import React from 'react';
import { SquarePen, Save, Zap, Check, AlertTriangle, X, Download } from 'lucide-react';

const formatTmoMin = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00 min";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
};

const formatTime = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds)) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

function DashboardStats({
  user,
  timerSeconds = 0,
  isEditingClosed,
  setIsEditingClosed,
  isEditingManaged,
  setIsEditingManaged,
  closedCount,
  managedCount,
  techniciansCount,
  manualCountInput,
  setManualCountInput,
  saveManualClosed,
  saveManualManaged,
  handleManualInputKeyDown,
  stats,
  standards,
  currentAccum,
  saveToSupabase,
  isSaving,
  isAutoSaving,
  lastSavedAt,
  getStatusClass,
  accumulatedBonusTotal = 0,
  getGxHBonus = () => 0,
  getResolucionBonus = () => 0,
  calculateRecordBonus = () => 0
}) {
  const totalTodayBonus = calculateRecordBonus(stats.managedPerHour, stats.resolutionRate);
  const gxhBonus = getGxHBonus(stats.managedPerHour);
  const resoBonus = getResolucionBonus(stats.resolutionRate);

  // --- CSV Download Handler ---
  const handleDownloadCSV = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = formatTime(timerSeconds);
    const bonusTodayStr = totalTodayBonus.toFixed(2);
    const bonusMonthStr = accumulatedBonusTotal.toFixed(2);

    const headers = [
      'Fecha',
      'Usuario',
      'Tiempo Total',
      'Casos Cerrados',
      'Casos Gestionados',
      'Técnicos Enviados',
      'Gestionados por Hora (GxH)',
      'Cierre Real %',
      'Diferencia Cierre',
      'Diferencia GxH',
      'Diferencia Resolución',
      'TMO GxH (seg)',
      'Resolución Real %',
      'Bonificación Hoy %',
      'Bono Acumulado Mes %'
    ];

    const row = [
      `"${dateStr}"`,
      `"${user?.email || 'Demo/Usuario'}"`,
      `"${timeStr}"`,
      closedCount,
      managedCount,
      techniciansCount,
      stats.managedPerHour,
      `"${stats.closeRate}%"`,
      stats.closingBalance,
      stats.gxhDiff,
      stats.resoDiff,
      stats.tmoManaged,
      `"${stats.resolutionRate}%"`,
      `"${bonusTodayStr}%"`,
      `"${bonusMonthStr}%"`
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" +
      headers.join(',') + "\n" +
      row.join(',');

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const fileName = `${day}-${month}-${year}.csv`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="grid-primary">
        {/* --- 1. CASOS CERRADOS --- */}
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
                    background: 'var(--bg-main)',
                    border: '1px solid var(--primary)',
                    color: 'var(--text-bright)',
                    fontSize: '36px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '800',
                    width: '110px',
                    padding: '4px 10px'
                  }}
                />
              ) : (
                <>
                  <div className="metric-value">{closedCount}</div>
                  <button
                    onClick={() => {
                      setManualCountInput(closedCount.toString());
                      setIsEditingClosed(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Editar manualmente"
                  >
                    <SquarePen size={16} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className={`status-indicator ${parseFloat(stats.closedPerHour) >= standards.GXH_GREEN ? 'standard-meets' :
            parseFloat(stats.closedPerHour) >= standards.GXH_YELLOW ? 'standard-warning' : 'standard-below'
            }`}>
            {parseFloat(stats.closedPerHour) >= standards.GXH_GREEN ? (
              <><Check size={12} strokeWidth={2.5} style={{ marginRight: 4 }} /> CUMPLE CON LA MÉTRICA</>
            ) : parseFloat(stats.closedPerHour) >= standards.GXH_YELLOW ? (
              <><AlertTriangle size={12} strokeWidth={2} style={{ marginRight: 4 }} /> MÉTRICA EN RIESGO</>
            ) : (
              <><X size={12} strokeWidth={2.5} style={{ marginRight: 4 }} /> NO CUMPLE LA MÉTRICA</>
            )}
          </div>
        </div>

        {/* --- 2. CASOS GESTIONADOS --- */}
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
                    background: 'var(--bg-main)',
                    border: '1px solid var(--primary)',
                    color: 'var(--text-bright)',
                    fontSize: '36px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '800',
                    width: '110px',
                    padding: '4px 10px'
                  }}
                />
              ) : (
                <>
                  <div className="metric-value">{managedCount}</div>
                  <button
                    onClick={() => {
                      setManualCountInput(managedCount.toString());
                      setIsEditingManaged(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Editar manualmente"
                  >
                    <SquarePen size={16} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '12px' }}>
            TOTAL CASOS GESTIONADOS EN SESIÓN
          </div>
        </div>

        {/* --- 3. SECCIÓN DE BONIFICACIONES (TOP ROW) --- */}
        <div className="metric-card large-card bonus-card-top" style={{ border: '1px solid var(--primary)' }}>
          <div className="swiss-section-header" style={{ marginBottom: '8px', borderBottomColor: 'var(--primary)' }}>
            <Zap size={14} strokeWidth={2} /> BONIFICACIONES DIARIAS Y MES
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-strong)', padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TOTAL HOY
              </div>
              <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', fontWeight: '900', letterSpacing: '0.08em', color: totalTodayBonus >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                {totalTodayBonus > 0 ? '+' : ''}{totalTodayBonus.toFixed(2)}%
              </div>
            </div>

            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--primary)', padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                BONO ACUM. MES
              </div>
              <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', fontWeight: '900', letterSpacing: '0.08em', color: accumulatedBonusTotal >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                {accumulatedBonusTotal > 0 ? '+' : ''}{accumulatedBonusTotal.toFixed(2)}%
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <div className="standard-row" style={{ margin: 0 }}>
              <span style={{ color: 'var(--text-muted)' }}>GxH Working:</span>
              <span style={{ fontWeight: '800', color: gxhBonus > 0 ? 'var(--accent-success)' : gxhBonus < 0 ? 'var(--accent-error)' : 'var(--text-dim)' }}>
                {gxhBonus > 0 ? '+' : ''}{gxhBonus.toFixed(2)}%
              </span>
            </div>

            <div className="standard-row" style={{ margin: 0 }}>
              <span style={{ color: 'var(--text-muted)' }}>% Reso Neta:</span>
              <span style={{ fontWeight: '800', color: resoBonus > 0 ? 'var(--accent-success)' : resoBonus < 0 ? 'var(--accent-error)' : 'var(--text-dim)' }}>
                {resoBonus > 0 ? '+' : ''}{resoBonus.toFixed(2)}%
              </span>
            </div>

            <div className="standard-row" style={{ margin: 0 }}>
              <span style={{ color: 'var(--text-muted)' }}>% Cierre (≥{standards.CLOSED_GREEN}%):</span>
              <span className={parseFloat(stats.closeRate) >= standards.CLOSED_GREEN ? 'stat-meets-standard' :
                parseFloat(stats.closeRate) >= standards.CLOSED_YELLOW ? 'stat-warning-standard' : 'stat-below-standard'}
                style={{ fontWeight: '800' }}>
                {stats.closeRate}% {parseFloat(stats.closeRate) >= standards.CLOSED_GREEN ? '✓ OK' : '✗ Bajo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- REJILLA SECUNDARIA DE KPIs --- */}
      <div className="grid-secondary">
        <div className="metric-card">
          <span className="metric-label">Gestionado por Hora</span>
          <div className={`metric-value medium ${getStatusClass(stats.managedPerHour, standards.GXH_GREEN, standards.GXH_YELLOW)}`}>
            {stats.managedPerHour}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Cierre Real (Cerr/Gest)</span>
          <div className={`metric-value medium ${getStatusClass(stats.closeRate, standards.CLOSED_GREEN, standards.CLOSED_YELLOW)}`}>
            {stats.closeRate}%
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Diferencia cierre ({standards.CLOSED_GREEN}%)</span>
          <div className={`metric-value medium ${stats.closingBalance >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {stats.closingBalance > 0 ? `+${stats.closingBalance}` : stats.closingBalance}
          </div>
          <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: '700', color: stats.closingBalance >= 0 ? '#22c55e' : 'var(--accent-warning)' }}>
            {stats.closingBalance < 0 ? `Faltan ${Math.abs(stats.closingBalance)} cierres para 0` : '✓ En objetivo (0 pend.)'}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Dif. GxH ({standards.GXH_GREEN.toFixed(1)})</span>
          <div className={`metric-value medium ${parseFloat(stats.gxhDiff) >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {parseFloat(stats.gxhDiff) > 0 ? `+${stats.gxhDiff}` : stats.gxhDiff}
          </div>
          <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: '700', color: parseFloat(stats.gxhDiff) >= 0 ? '#22c55e' : 'var(--accent-warning)' }}>
            {parseFloat(stats.gxhDiff) < 0 ? `Faltan ${Math.ceil(Math.abs(parseFloat(stats.gxhDiff)))} gestiones para 0` : '✓ En objetivo (0 pend.)'}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Dif. Reso ({standards.RESOLUTION_GREEN}%)</span>
          <div className={`metric-value medium ${stats.resoDiff >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {stats.resoDiff > 0 ? `+${stats.resoDiff}` : stats.resoDiff}
          </div>
          <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: '700', color: stats.resoDiff >= 0 ? '#22c55e' : 'var(--accent-warning)' }}>
            {stats.resoDiff < 0 ? `Faltan ${Math.abs(stats.resoDiff)} resoluciones para 0` : '✓ En objetivo (0 pend.)'}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">TMO GxH</span>
          <div className={`metric-value medium ${stats.tmoManaged > standards.TIME_PER_MANAGED ? 'stat-below-standard' : stats.tmoManaged > standards.TIME_PER_MANAGED - 100 ? 'stat-warning-standard' : 'stat-meets-standard'}`} style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
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
          <div className={`metric-value medium ${getStatusClass(stats.resolutionRate, standards.RESOLUTION_GREEN, standards.RESOLUTION_YELLOW)}`}>
            {stats.resolutionRate}%
          </div>
        </div>
      </div>

      <div className="accum-section">
        <div className="metric-card accum-card">
          <span className="metric-label accum-label">Dif. Cierre Acum</span>
          <div className={`metric-value medium ${currentAccum && currentAccum.accumClosingDiff >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {currentAccum ? (currentAccum.accumClosingDiff > 0 ? `+${currentAccum.accumClosingDiff}` : currentAccum.accumClosingDiff) : 0}
          </div>
          {(() => {
            const val = currentAccum ? currentAccum.accumClosingDiff : 0;
            return (
              <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: '700', color: val >= 0 ? '#22c55e' : 'var(--accent-warning)' }}>
                {val < 0 ? `Faltan ${Math.abs(val)} para llegar a 0` : '✓ En objetivo (0 pend.)'}
              </div>
            );
          })()}
        </div>
        <div className="metric-card accum-card">
          <span className="metric-label accum-label">Dif. GxH Acum</span>
          <div className={`metric-value medium ${currentAccum && parseFloat(currentAccum.accumGxhDiff) >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {currentAccum ? (parseFloat(currentAccum.accumGxhDiff) > 0 ? `+${currentAccum.accumGxhDiff}` : currentAccum.accumGxhDiff) : 0}
          </div>
          {(() => {
            const val = currentAccum ? parseFloat(currentAccum.accumGxhDiff) : 0;
            const needed = Math.ceil(Math.abs(val));
            return (
              <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: '700', color: val >= 0 ? '#22c55e' : 'var(--accent-warning)' }}>
                {val < 0 ? `Faltan ${needed} para llegar a 0` : '✓ En objetivo (0 pend.)'}
              </div>
            );
          })()}
        </div>
        <div className="metric-card accum-card">
          <span className="metric-label accum-label">Dif. Reso Acum</span>
          <div className={`metric-value medium ${currentAccum && currentAccum.accumResoDiff >= 0 ? 'stat-meets-standard' : 'stat-below-standard'}`}>
            {currentAccum ? (currentAccum.accumResoDiff > 0 ? `+${currentAccum.accumResoDiff}` : currentAccum.accumResoDiff) : 0}
          </div>
          {(() => {
            const val = currentAccum ? currentAccum.accumResoDiff : 0;
            return (
              <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: '700', color: val >= 0 ? '#22c55e' : 'var(--accent-warning)' }}>
                {val < 0 ? `Faltan ${Math.abs(val)} para llegar a 0` : '✓ En objetivo (0 pend.)'}
              </div>
            );
          })()}
        </div>
      </div>

      {/* --- BOTONES GUARDAR Y DESCARGAR CSV SIDE-BY-SIDE --- */}
      <div className="save-container" style={{ margin: '24px auto', width: '100%', maxWidth: '750px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={saveToSupabase}
          disabled={isSaving || managedCount === 0}
          style={{
            flex: 1,
            minWidth: '220px',
            height: '52px',
            fontWeight: '800',
            fontSize: '15px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: (isSaving || managedCount === 0) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            opacity: (isSaving || managedCount === 0) ? 0.5 : 1
          }}
        >
          <Save size={18} strokeWidth={2} />
          {isSaving ? 'GUARDANDO...' : isAutoSaving ? 'AUTO-GUARDADO...' : 'GUARDAR MÉTRICAS'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleDownloadCSV}
          style={{
            flex: 1,
            minWidth: '220px',
            height: '52px',
            fontWeight: '800',
            fontSize: '15px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-card)',
            color: 'var(--text-bright)'
          }}
          title="Descargar archivo CSV con el detalle de métricas registradas en la sesión"
        >
          <Download size={18} strokeWidth={2} />
          DESCARGAR CSV
        </button>
      </div>
      {lastSavedAt && (
        <div style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginTop: '-12px',
          marginBottom: '20px'
        }}>
          Auto-sincronizado a las {lastSavedAt.toLocaleTimeString()}
        </div>
      )}
    </>
  );
}

export default DashboardStats;
