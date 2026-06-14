import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

function EditRecordModal({ show, onClose, editingRecord, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    date: '',
    h: 0,
    m: 0,
    s: 0,
    closed: 0,
    managed: 0,
    technicians: 0
  });

  useEffect(() => {
    if (show && editingRecord) {
      const [h, m, s] = editingRecord.total_time.split(':').map(Number);
      setFormData({
        date: editingRecord.date,
        h, m, s,
        closed: editingRecord.cases_closed,
        managed: editingRecord.cases_managed,
        technicians: editingRecord.technicians_sent
      });
    }
  }, [show, editingRecord]);

  if (!show) return null;

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="modal-overlay active">
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Editar Registro</h2>
          <button className="btn-close" onClick={onClose}><X /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="input-group">
            <label>Fecha</label>
            <input type="date" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
              value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
          </div>
          <div className="input-group">
            <label>Gestiones</label>
            <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
              value={formData.managed} onChange={e => setFormData({ ...formData, managed: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="input-group">
            <label>Cerrados</label>
            <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
              value={formData.closed} onChange={e => setFormData({ ...formData, closed: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="input-group">
            <label>TCO Enviados</label>
            <input type="number" className="filter-input" style={{ width: '100%', marginTop: '5px' }}
              value={formData.technicians} onChange={e => setFormData({ ...formData, technicians: parseInt(e.target.value) || 0 })} />
          </div>
        </div>

        <label className="metric-label" style={{ textAlign: 'center', marginBottom: '10px' }}>Tiempo Total</label>
        <div className="time-inputs">
          <div className="input-group">
            <label>H</label>
            <input type="number" min="0" value={formData.h} onChange={e => setFormData({ ...formData, h: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="input-divider">:</div>
          <div className="input-group">
            <label>M</label>
            <input type="number" min="0" max="59" value={formData.m} onChange={e => setFormData({ ...formData, m: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="input-divider">:</div>
          <div className="input-group">
            <label>S</label>
            <input type="number" min="0" max="59" value={formData.s} onChange={e => setFormData({ ...formData, s: parseInt(e.target.value) || 0 })} />
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Actualizar Registro'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditRecordModal;
