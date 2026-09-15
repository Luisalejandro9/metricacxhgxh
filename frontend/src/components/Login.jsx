import React from 'react';
import { ShieldCheck, RefreshCw, Sun, Moon } from 'lucide-react';

function Login({ handleGoogleLogin, handleSpectatorLogin, envsMissing, authError, setNetworkError, theme, toggleTheme }) {
  if (envsMissing) {
    return (
      <div className="login-overlay active">
        <div className="login-card" style={{ border: '2px solid var(--accent-error)' }}>
          <h1 style={{ color: 'var(--accent-error)' }}>¡ERROR DE CONFIGURACIÓN!</h1>
          <p>Faltan las variables de entorno <strong>(VITE_SUPABASE_URL / ANON_KEY)</strong>.</p>
          <p>Debes configurarlas en el panel de Netlify &rarr; Environment Variables.</p>
          <div style={{ marginTop: 20, fontSize: 12, opacity: 0.6 }}>Si acabas de configurarlas, espera un minuto o haz un "Trigger Deploy".</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-overlay active">
      {/* --- Grid Line Background Visuals --- */}
      <div className="login-bg"></div>
 
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.15em', color: 'var(--primary)', textTransform: 'uppercase' }}>
            00 / CONTROL DE ACCESO
          </span>
          {toggleTheme && (
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Tema Claro (Suizo)' : 'Cambiar a Tema Oscuro'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? 'CLARO' : 'OSCURO'}</span>
            </button>
          )}
        </div>

        <h1>SOPORTE MÉTRICAS</h1>
        <p>TRACKER DE PERFORMANCE DIARIO</p>
 
        {/* Displays connection or credential errors during login */}
        {authError && authError !== 'bloqueo_dns' && (
          <div className="auth-error-notice" style={{ background: 'var(--bg-main)', color: 'var(--accent-error)', padding: '12px', marginBottom: '20px', border: '1px solid var(--accent-error)', fontSize: '12px', fontWeight: '700' }}>
            {authError}
          </div>
        )}
 
        {authError === 'bloqueo_dns' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', marginBottom: '10px' }}>
            <div className="dns-block-alert" style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--accent-warning)',
              padding: '16px',
              textAlign: 'center',
            }}>
              <div style={{ 
                color: 'var(--accent-warning)', 
                fontSize: '12px', 
                fontWeight: '800', 
                marginBottom: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span className="pulse-dot" style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'var(--accent-warning)'
                }}></span>
                Bloqueo DNS Detectado
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)', lineHeight: '1.5', fontWeight: '600' }}>
                Bloqueo DNS activo. Vuelve a intentar en unos minutos.
              </p>
            </div>
            
            <button 
              className="btn-google" 
              onClick={handleGoogleLogin} 
              style={{
                background: 'var(--accent-warning)',
                color: '#000000',
                border: '1px solid var(--accent-warning)',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={16} className="spinning-slow" />
              REINTENTAR ACCESO
            </button>
          </div>
        ) : (
          <button className="btn-google" onClick={handleGoogleLogin}>
            <img src="https://www.google.com/favicon.ico" alt="Google" />
            Ingresar con Google
          </button>
        )}

        {/* --- Spectator Login Divider & Button --- */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0 16px 0', width: '100%' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-strong)' }}></div>
          <span style={{ padding: '0 12px', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            DEMO
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-strong)' }}></div>
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={handleSpectatorLogin}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '12px',
            fontWeight: '800',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={16} style={{ color: 'var(--primary)' }} />
          Modo Espectador (Demo)
        </button>
      </div>
    </div>
  );
}

export default Login;
