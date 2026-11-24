import React from 'react';
import { AlertCircle, LogOut, Trash2, Eraser, Ban, UserRoundCheck } from 'lucide-react';

function DeleteConfirmModal({
  show,
  targetUser,
  mode = 'delete',
  isDeleting,
  onCancel,
  onConfirm
}) {
  if (!show || !targetUser) return null;

  const config = {
    clear: {
      title: '¿Limpiar solo los datos?',
      description: <>Se eliminarán las métricas registradas de <strong>{targetUser.email}</strong>. El perfil y su sesión actual permanecerán activos.</>,
      warning: 'No se cerrará ninguna sesión ni se quitará el acceso.',
      action: 'Limpiar datos',
      Icon: Eraser
    },
    delete: {
      title: '¿Limpiar datos y cerrar sesión?',
      description: <>Se eliminarán las métricas y el perfil de <strong>{targetUser.email}</strong> del directorio, y se cerrarán sus sesiones activas. La cuenta de autenticación no se elimina.</>,
      warning: 'Esto cerrará su sesión de forma remota en todos sus dispositivos.',
      action: 'Limpiar y cerrar',
      Icon: LogOut
    },
    ban: {
      title: '¿Banear a este usuario?',
      description: <>Se deshabilitará el acceso de <strong>{targetUser.email}</strong> a la plataforma y se revocarán sus sesiones renovables. Sus métricas y perfil se conservarán.</>,
      warning: 'El usuario no podrá utilizar la plataforma mientras esté baneado.',
      action: 'Confirmar baneo',
      Icon: Ban
    },
    unban: {
      title: '¿Desbanear a este usuario?',
      description: <>Se rehabilitará el acceso de <strong>{targetUser.email}</strong>. Sus métricas existentes se conservarán, excepto las que hayan sido limpiadas previamente.</>,
      warning: 'El usuario podrá volver a iniciar sesión.',
      action: 'Desbanear usuario',
      Icon: UserRoundCheck
    }
  }[mode] || {
    title: '¿Confirmar acción?',
    description: <>Se aplicará la acción a <strong>{targetUser.email}</strong>.</>,
    warning: 'Esta acción requiere confirmación.',
    action: 'Confirmar',
    Icon: AlertCircle
  };

  const ActionIcon = config.Icon;
  return (
    <div className="login-overlay drilldown-modal" style={{ zIndex: 3000 }}>
      <div className="modal" style={{ maxWidth: '450px', textAlign: 'center', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '30px' }}>
        <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '15px' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: 'var(--accent-error)' }}>
            <AlertCircle size={32} />
          </div>
        </div>
        <h2 style={{ fontSize: 22, marginBottom: 12, color: 'var(--text-bright)' }}>{config.title}</h2>
        <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{config.description}</p>
        <div style={{ background: 'rgba(239,68,68,0.05)', padding: 12, borderRadius: 10, border: '1px solid rgba(239,68,68,0.1)', marginBottom: 25, fontSize: 12, color: 'var(--accent-error)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <ActionIcon size={16} />
          <span>{config.warning}</span>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel} disabled={isDeleting}>Cancelar</button>
          <button className="btn" style={{ flex: 1, backgroundColor: 'var(--accent-error)', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={onConfirm} disabled={isDeleting}>
            <ActionIcon size={16} />
            {isDeleting ? 'Procesando...' : config.action}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
