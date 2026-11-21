import React from 'react';
import { X, Play, Check, Plus, Zap, Save, Award, TrendingUp, AlertTriangle } from 'lucide-react';

function HelpModal({ show, onClose, STANDARDS, formatTmoMin }) {
  if (!show) return null;

  const standards = STANDARDS || {
    GXH_GREEN: 4.00,
    CLOSED_GREEN: 78.8,
    RESOLUTION_GREEN: 84.0,
    TIME_PER_CASE: 950
  };

  return (
    <div className="modal-overlay active">
      <div className="modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        
        {/* Cabecera */}
        <div className="modal-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-bright)' }}>
              Guía Rápida de la Plataforma
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Aprende a usar el contador y asegurar tu bono en 3 pasos sencillos.
            </p>
          </div>
          <button className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', color: 'var(--text-main)' }}>

          {/* PASO A PASO DIARIO */}
          <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ¿Cómo se usa en tu jornada? (3 Pasos)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>1</span>
                <div>
                  <strong>Al iniciar tu turno:</strong> Presiona <span style={{ color: 'var(--primary-light)', fontWeight: '700' }}>"Iniciar Tiempo"</span> para que el reloj empiece a contar tus horas.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>2</span>
                <div>
                  <strong>Durante la atención:</strong> Suma cada llamada o caso con los botones de la barra lateral:
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px', marginTop: '6px' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-bright)' }}>+ Gestionado:</span> Cada cliente atendido.
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontWeight: '700', color: 'var(--accent-success)' }}>✓ Cerrado:</span> Lo resolviste tú.
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontWeight: '700', color: 'var(--accent-warning)' }}>⚡ TCO Enviado:</span> Mandaste técnico.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>3</span>
                <div>
                  <strong>Al terminar tu día:</strong> Presiona <span style={{ color: 'var(--primary-light)', fontWeight: '700' }}>"Guardar Métricas"</span>. ¡Esto asegura que no pierdas tu avance ni tu bono mensual!
                </div>
              </div>
            </div>
          </div>

          {/* QUÉ MIRA TU BONO */}
          <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={14} /> Los 3 números de tu bono
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                <div>
                  <strong>GxH (Velocidad):</strong> Cuántos casos atiendes por hora.
                </div>
                <div style={{ color: 'var(--accent-success)', fontWeight: '800', fontSize: '12px' }}>
                  Meta: ≥ {standards.GXH_GREEN}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                <div>
                  <strong>% Cierre:</strong> Qué porcentaje de casos lograste solucionar.
                </div>
                <div style={{ color: 'var(--accent-success)', fontWeight: '800', fontSize: '12px' }}>
                  Meta: ≥ {standards.CLOSED_GREEN}%
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                <div>
                  <strong>% Resolución:</strong> Casos resueltos sin necesidad de enviar técnico.
                </div>
                <div style={{ color: 'var(--accent-success)', fontWeight: '800', fontSize: '12px' }}>
                  Meta: ≥ {standards.RESOLUTION_GREEN}%
                </div>
              </div>
            </div>
          </div>

          {/* QUÉ SIGNIFICAN LOS COLORES Y LAS DIFERENCIAS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Colores */}
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontWeight: '700', fontSize: '11px', marginBottom: '8px', color: 'var(--text-bright)' }}>
                Los Colores (Semáforo)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)' }}></span>
                  <span><strong>Verde:</strong> Cobras bono completo.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-warning)' }}></span>
                  <span><strong>Amarillo:</strong> Cerca de la meta.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-error)' }}></span>
                  <span><strong>Rojo:</strong> Por debajo de la meta.</span>
                </div>
              </div>
            </div>

            {/* Diferencias (+ / -) */}
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontWeight: '700', fontSize: '11px', marginBottom: '8px', color: 'var(--text-bright)' }}>
                Diferencias (DIF ACUM)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--accent-success)', fontWeight: '800' }}>Número (+) :</span> Tienes ventaja o casos a favor ("colchón").
                </div>
                <div>
                  <span style={{ color: 'var(--accent-error)', fontWeight: '800' }}>Número (-) :</span> Casos que te faltan para alcanzar tu objetivo del mes.
                </div>
              </div>
            </div>
          </div>

          {/* CONSEJO FINAL */}
          <div style={{ padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.25)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>
              <strong>Consejo:</strong> Mantén el timer prendido solo mientras estés trabajando. Si sales a break o refrigerio, pausa el tiempo para no perjudicar tu GxH.
            </span>
          </div>

        </div>

        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '8px 20px', fontSize: '12px', fontWeight: '700' }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;
