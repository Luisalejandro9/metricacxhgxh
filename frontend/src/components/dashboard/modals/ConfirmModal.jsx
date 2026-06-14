import React from 'react';
import { AlertCircle } from 'lucide-react';

function ConfirmModal({ show, title, message, confirmText = 'Confirmar', type = 'danger', onConfirm, onCancel }) {
  if (!show) return null;

  return (
    <div className="modal-overlay active">
      <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '15px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            color: type === 'danger' ? 'var(--accent-error)' : 'var(--primary-light)'
          }}>
            <AlertCircle size={32} />
          </div>
        </div>
        <h2 style={{
          fontSize: '22px',
          marginBottom: '12px',
          color: 'var(--text-bright)'
        }}>
          {title}
        </h2>
        <p style={{
          marginBottom: '30px',
          fontSize: '15px',
          color: 'var(--text-muted)',
          lineHeight: '1.5'
        }}>
          {message}
        </p>
        <div className="modal-footer" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn"
            style={{
              flex: 1,
              backgroundColor: type === 'danger' ? 'var(--accent-error)' : 'var(--primary)',
              color: 'white',
              fontWeight: '700'
            }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
