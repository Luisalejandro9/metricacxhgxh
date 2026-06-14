import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

function EditTimeModal({ show, onClose, timerSeconds, onSave }) {
  const [localTime, setLocalTime] = useState({ h: 0, m: 0, s: 0 });

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

  const handleSave = () => {
    const total = (localTime.h * 3600) + (localTime.m * 60) + localTime.s;
    onSave(total);
  };

  return (
    <div className="modal-overlay active">
      <div className="modal">
        <div className="modal-header">
          <h2>Editar Tiempo Transcurrido</h2>
          <button className="btn-close" onClick={onClose}><X /></button>
        </div>
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
        <div className="modal-footer" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
}

export default EditTimeModal;
