/**
 * @fileoverview Modal para ajustar manualmente el tiempo transcurrido del
 * temporizador activo de la jornada.
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Diálogo de edición manual de horas, minutos y segundos del timer.
 * @param {object} props
 * @param {boolean} props.show - Controla la visibilidad del modal.
 * @param {Function} props.onClose - Cierra el modal sin aplicar cambios.
 * @param {number} props.timerSeconds - Tiempo actual acumulado en segundos.
 * @param {Function} props.onSave - Callback que recibe el nuevo total en segundos.
 */
function EditTimeModal({ show, onClose, timerSeconds, onSave }) {
  const [localTime, setLocalTime] = useState({ h: 0, m: 0, s: 0 });

  // Descompone los segundos totales en horas, minutos y segundos al abrir el modal
  useEffect(() => {
    if (show) {
      const h = Math.floor(timerSeconds / 3600);
      const m = Math.floor((timerSeconds % 3600) / 60);
      const s = timerSeconds % 60;
      setLocalTime({ h, m, s });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  /** Convierte el tiempo editado a segundos totales y lo envía al padre. */
  const handleSave = () => {
    const total = (localTime.h * 3600) + (localTime.m * 60) + localTime.s;
    onSave(total);
  };

  return (
    <div className="modal-overlay active">
      <div className="modal">
        {/* CABECERA */}
        <div className="modal-header">
          <h2>Editar Tiempo Transcurrido</h2>
          <button className="btn-close" onClick={onClose}><X /></button>
        </div>

        {/* CAMPOS DE HORAS, MINUTOS Y SEGUNDOS */}
        <div className="time-inputs">
          <div className="input-group">
            <label>Horas</label>
            <input type="number" min="0" value={localTime.h} onChange={e => setLocalTime({ ...localTime, h: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="input-divider">:</div>
          <div className="input-group">
            <label>Minutos</label>
            <input type="number" min="0" max="59" value={localTime.m} onChange={e => setLocalTime({ ...localTime, m: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="input-divider">:</div>
          <div className="input-group">
            <label>Segundos</label>
            <input type="number" min="0" max="59" value={localTime.s} onChange={e => setLocalTime({ ...localTime, s: parseInt(e.target.value) || 0 })} />
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="modal-footer" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
}

export default EditTimeModal;
