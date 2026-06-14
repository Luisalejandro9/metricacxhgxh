import React from 'react';
import { X } from 'lucide-react';

function HelpModal({ show, onClose, STANDARDS, formatTmoMin }) {
  if (!show) return null;

  return (
    <div className="modal-overlay active">
      <div className="modal" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Manual de la Plataforma</h2>
          <button className="btn-close" onClick={onClose}><X /></button>
        </div>
        <div style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '15px' }}>¡Bienvenido al Contador CxH / GxH! Esta herramienta está diseñada para ayudarte a registrar, calcular y alcanzar tus objetivos operativos y tus bonificaciones del mes de forma sencilla.</p>
          
          <h3 style={{ color: 'var(--primary-light)', marginTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>Glosario de Términos</h3>
          <ul style={{ marginBottom: '20px', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}><strong>GxH (Gestionado por Hora):</strong> Mide la cantidad de casos que gestionas en promedio durante cada hora de trabajo. El objetivo ideal es mantenerlo igual o superior a <span style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>{STANDARDS.GXH_GREEN}</span>.</li>
            <li style={{ marginBottom: '8px' }}><strong>Cierre Real (Cerr/Gest):</strong> Es el porcentaje de casos que logras cerrar exitosamente en base a todos los que gestionaste. El objetivo es <span style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>{STANDARDS.CLOSED_GREEN}%</span>.</li>
            <li style={{ marginBottom: '8px' }}><strong>TMO (Tiempo Medio Operativo):</strong> Es el tiempo promedio que te toma gestionar o cerrar un caso. Tu límite saludable son <span style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>{formatTmoMin(STANDARDS.TIME_PER_CASE)}</span>.</li>
            <li style={{ marginBottom: '8px' }}><strong>% Resolución Real:</strong> Se calcula en base a la cantidad de casos gestionados en los que NO necesitaste enviar técnicos. Si envías demasiados técnicos, este porcentaje baja. Tu objetivo es <span style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>{STANDARDS.RESOLUTION_GREEN}%</span>.</li>
          </ul>

          <h3 style={{ color: 'var(--primary-light)', marginTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>¿Qué significan las diferencias (DIF ACUM)?</h3>
          <p style={{ marginBottom: '10px' }}>Los indicadores de "DIF" (Diferencia) acumulada te indican cuántos casos te faltan o te sobran respecto a tu objetivo durante todo el mes. Si el número es <strong>positivo (+)</strong>, significa que tienes un "colchón" a favor. Si es <strong>negativo (-)</strong>, estás por debajo de la meta.</p>
          <ul style={{ marginBottom: '20px', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}><strong>Dif. Cierre Acum:</strong> Cuántos cierres netos te faltan o te sobran para asegurar tu meta mensual de cierre ({STANDARDS.CLOSED_GREEN}%).</li>
            <li style={{ marginBottom: '8px' }}><strong>Dif. GxH Acum:</strong> Cuántos casos de ventaja tienes o te faltan gestionar para cumplir tu objetivo de GxH de {STANDARDS.GXH_GREEN} de acuerdo al tiempo que llevas conectado.</li>
            <li style={{ marginBottom: '8px' }}><strong>Dif. Reso Acum:</strong> Cuántos casos te faltan o te sobran (sin mandar técnico) para lograr tu objetivo de resolución.</li>
          </ul>

          <h3 style={{ color: 'var(--primary-light)', marginTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>¿Cómo usar la plataforma día a día?</h3>
          <ol style={{ paddingLeft: '20px', marginBottom: '20px' }}>
            <li style={{ marginBottom: '8px' }}>Al empezar tu jornada, dale clic al botón principal <strong>"Iniciar Tiempo"</strong>.</li>
            <li style={{ marginBottom: '8px' }}>Por cada caso nuevo que atiendas, presiona <strong>"CASO GESTIONADO (+)"</strong>.</li>
            <li style={{ marginBottom: '8px' }}>Si además lograste solucionar el caso sin escalarlo o dejarlo abierto, presiona <strong>"CASO CERRADO (✓)"</strong>.</li>
            <li style={{ marginBottom: '8px' }}>Si fue absolutamente necesario enviar a un técnico, registra <strong>"TCO ENVIADO (⚡)"</strong>.</li>
            <li style={{ marginBottom: '8px', color: 'var(--primary-light)', fontWeight: 'bold' }}>Lo más importante: al finalizar el día, debes darle clic al botón "GUARDAR MÉTRICAS" que se encuentra abajo de los indicadores para consolidar tu avance mensual y calcular tu bono correctamente.</li>
          </ol>
          
          <div style={{ padding: '15px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '13px' }}>
            <strong>Bono Mensual Acumulado:</strong> Se muestra en el panel izquierdo y representa tu porcentaje de bono estimado basándose en tus métricas acumuladas de todo el mes. ¡Mantenlo siempre en verde!
          </div>
        </div>
        <div className="modal-footer" style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose}>¡Entendido!</button>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;
