import React from 'react';

function Login({ handleGoogleLogin, envsMissing }) {
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
      <div className="login-card">
        <h1>SOPORTE MÉTRICAS</h1>
        <p>Herramienta interna de gestión de rendimiento</p>
        <button className="btn-google" onClick={handleGoogleLogin}>
          <img src="https://www.google.com/favicon.ico" alt="Google" />
          Continuar con Google
        </button>
      </div>
    </div>
  );
}

export default Login;
