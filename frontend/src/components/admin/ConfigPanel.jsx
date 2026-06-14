import React from 'react';

function ConfigPanel({
  formConfig,
  isSavingConfig,
  resetConfigToDefault,
  saveConfig,
  handleConfigChange,
  handleTierChange,
  addTier,
  deleteTier
}) {
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
}

export default ConfigPanel;
