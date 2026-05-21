import React from 'react';
import { ShieldCheck } from 'lucide-react';

function Login({ handleGoogleLogin, handleSpectatorLogin, envsMissing, authError, setNetworkError }) {
  if (envsMissing) {
    return (
      <div className="login-overlay active">
        <div className="login-card" style={{ border: '2px solid red' }}>
          <h1 style={{ color: 'red' }}>¡ERROR DE CONFIGURACIÓN!</h1>
          <p>Faltan las variables de entorno <strong>(VITE_SUPABASE_URL / ANON_KEY)</strong>.</p>
          <p>Debes configurarlas en el panel de Netlify &rarr; Environment Variables.</p>
          <div style={{ marginTop: 20, fontSize: 12, opacity: 0.6 }}>Si acabas de configurarlas, espera un minuto o haz un "Trigger Deploy".</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-overlay active">
      {/* --- Animated Background Visuals --- */}
      <div className="login-bg">
        <div className="bg-shape bg-shape-1"></div>
        <div className="bg-shape bg-shape-2"></div>
        <div className="bg-shape bg-shape-3"></div>
        <div className="bg-line bg-line-1"></div>
        <div className="bg-line bg-line-2"></div>
        <div className="bg-line bg-line-3"></div>
      </div>
 
      <div className="login-card">
        <h1>SOPORTE MÉTRICAS</h1>
        <p>Control diario.</p>
 
        {/* Displays connection or credential errors during login */}
        {authError && (
          <div className="auth-error-notice" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-error)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '13px' }}>
            {authError}
          </div>
        )}
 
        <button className="btn-google" onClick={handleGoogleLogin}>
          <img src="https://www.google.com/favicon.ico" alt="Google" />
          Logear con Google
        </button>

        {/* --- Spectator Login Divider & Button --- */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 16px 0', width: '100%' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
          <span style={{ padding: '0 12px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>o prueba el sistema</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
        </div>

        <button 
          className="btn-google" 
          onClick={handleSpectatorLogin}
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
            color: 'var(--text-bright)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(168, 85, 247, 0.22))';
            e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.45)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))';
            e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.25)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.05)';
          }}
        >
          <ShieldCheck size={18} style={{ color: 'var(--primary-light)' }} />
          Ingresar como Espectador (Demo)
        </button>
      </div>
    </div>
  );
}

export default Login;

