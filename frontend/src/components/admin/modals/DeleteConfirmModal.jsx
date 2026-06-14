import React from 'react';
import { AlertCircle, LogOut, Trash2 } from 'lucide-react';

function DeleteConfirmModal({
  show,
  targetUser,
  isDeleting,
  onCancel,
  onConfirm
}) {
  if (!show || !targetUser) return null;

  return (
    <div className="login-overlay drilldown-modal" style={{ zIndex: 3000 }}>
      <div className="modal" style={{ maxWidth: '450px', textAlign: 'center', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '30px' }}>
        <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '15px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            color: 'var(--accent-error)'
          }}>
            <AlertCircle size={32} />
          </div>
        </div>
        <h2 style={{
          fontSize: '22px',
          marginBottom: '12px',
          color: 'var(--text-bright)'
        }}>
          ¿Limpiar Métricas y Cerrar Sesión?
        </h2>
        <p style={{
          marginBottom: '20px',
          fontSize: '14px',
          color: 'var(--text-muted)',
          lineHeight: '1.6'
        }}>
          Estás a punto de eliminar de forma permanente todo el historial de métricas de <strong>{targetUser.email}</strong>. Su cuenta de acceso seguirá activa para que pueda ingresar en el futuro.
        </p>
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: '25px', fontSize: '12px', color: 'var(--accent-error)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <LogOut size={16} />
          <span>Esto cerrará su sesión de forma remota en todos sus dispositivos.</span>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel} disabled={isDeleting}>
            Cancelar
          </button>
          <button
            className="btn"
            style={{
              flex: 1,
              backgroundColor: 'var(--accent-error)',
              color: 'white',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 size={16} />
            {isDeleting ? 'Limpiando...' : 'Limpiar y Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
