import React from 'react';

function Login({ handleGoogleLogin, envsMissing, authError }) {
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
      {/* Animated Background */}
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

        {authError && (
          <div className="auth-error-notice" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-error)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '13px' }}>
            {authError}
          </div>
        )}

        <button className="btn-google" onClick={handleGoogleLogin}>
          <img src="https://www.google.com/favicon.ico" alt="Google" />
          Logear con Google
        </button>
      </div>
    </div>
  );
}

export default Login;
