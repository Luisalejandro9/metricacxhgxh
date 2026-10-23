import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

const CURRENT_VERSION = typeof __APP_BUILD_VERSION__ !== 'undefined' ? __APP_BUILD_VERSION__ : 'dev';

export function AutoUpdater() {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // En desarrollo local (vite dev), no forzamos recarga constante
    if (import.meta.env.DEV) return;

    let updateDetected = false;

    const performReload = () => {
      setIsUpdating(true);
      window.location.reload();
    };

    const checkVersion = async () => {
      if (updateDetected) return;
      try {
        const res = await fetch(`/version.json?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data?.version && data.version !== CURRENT_VERSION && CURRENT_VERSION !== 'dev') {
          updateDetected = true;
          setHasNewVersion(true);

          // Estrategia 1: Si el usuario tiene la pestaña en segundo plano, se recarga silenciosamente de inmediato.
          if (document.hidden || document.visibilityState === 'hidden') {
            performReload();
            return;
          }

          // Estrategia 2: Si el usuario está mirando la pantalla, esperamos a que cambie de pestaña o minimice.
          const handleHidden = () => {
            if (document.hidden || document.visibilityState === 'hidden') {
              document.removeEventListener('visibilitychange', handleHidden);
              performReload();
            }
          };
          document.addEventListener('visibilitychange', handleHidden);

          // Estrategia 3: Si tras 45 segundos de inactividad continúa en la página, recarga suavemente.
          let idleTimer = null;
          const resetIdle = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
              performReload();
            }, 45000);
          };
          resetIdle();
          window.addEventListener('mousemove', resetIdle, { passive: true });
          window.addEventListener('keydown', resetIdle, { passive: true });
        }
      } catch {
        // Ignorar errores de red silenciosamente
      }
    };

    // Chequeo periódico en segundo plano cada 30 segundos
    const interval = setInterval(checkVersion, 30000);

    // Chequeo inmediato al volver a enfocar la ventana
    const handleFocus = () => checkVersion();
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!hasNewVersion || dismissed) return null;

  return (
    <div className="silent-update-toast" role="status" aria-live="polite">
      <div className="update-toast-content">
        <div className="update-toast-icon">
          <Sparkles size={16} />
        </div>
        <div className="update-toast-text">
          <div className="update-toast-title">NUEVA ACTUALIZACIÓN DISPONIBLE</div>
          <div className="update-toast-desc">
            Se aplicará automáticamente en silencio al cambiar de pestaña.
          </div>
        </div>
      </div>
      <div className="update-toast-actions">
        <button
          className="update-toast-btn"
          onClick={() => {
            setIsUpdating(true);
            window.location.reload();
          }}
          disabled={isUpdating}
          title="Actualizar ahora mismo"
        >
          <RefreshCw size={13} className={isUpdating ? 'spin' : ''} />
          <span>{isUpdating ? 'Actualizando...' : 'Actualizar ahora'}</span>
        </button>
        <button
          className="update-toast-close"
          onClick={() => setDismissed(true)}
          title="Cerrar aviso"
          aria-label="Cerrar aviso"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default AutoUpdater;
