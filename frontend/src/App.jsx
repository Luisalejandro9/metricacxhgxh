/**
 * @file App.jsx
 * @description Componente raíz de la aplicación. Configura el enrutamiento principal,
 * el tema visual, la sincronización de sesión, las alertas globales de red y el auto-actualizador.
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useAuthController } from './hooks/useAuthController';
import Login from './components/Login';
import AutoUpdater from './components/AutoUpdater';
import './App.css';

// Carga diferida (code-splitting) de vistas secundarias y pesadas para acelerar el arranque inicial
const Dashboard = lazy(() => import('./components/Dashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const TechStatusDashboard = lazy(() => import('./components/TechStatusDashboard'));

/**
 * Pantalla de carga reutilizable para la sincronización de sesión y la carga diferida de rutas.
 */
function RouteFallback({ title = 'Cargando vista', subtitle = 'Preparando módulos...' }) {
  return (
    <div className="login-overlay active">
      <div className="login-card" style={{ maxWidth: '380px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 32px' }}>
        <div className="spinner" style={{ width: '42px', height: '42px', borderWidth: '3px' }} aria-hidden="true"></div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-bright)', margin: 0 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, borderBottom: 'none', paddingBottom: 0, textTransform: 'none', letterSpacing: 'normal' }}>{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * Componente principal que coordina las rutas protegidas y los estados globales de sesión y red.
 */
function App() {
  // --- Estado global de tema y autenticación ---
  const { theme, toggleTheme } = useTheme();
  const {
    user, profile, loading, networkError, setNetworkError, authError,
    handleGoogleLogin, handleSpectatorLogin, envsMissing
  } = useAuthController();

  // Pantalla de carga inicial mientras se sincroniza la sesión
  if (loading && !networkError) return (
    <RouteFallback title="Sincronizando sesión" subtitle="Preparando tu espacio de trabajo..." />
  );

  return (
    <Router>
      {/* Notificación global de error de conexión */}
      {networkError && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'var(--accent-error)',
          color: 'white',
          padding: '12px',
          textAlign: 'center',
          zIndex: 9999,
          fontWeight: '700',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
        }}>
          <AlertCircle size={20} />
          <span>Error de conexión (DNS bloqueada o sin internet). La plataforma podría dejar de actualizar datos.</span>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              background: 'white',
              color: 'var(--accent-error)',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} /> REINTENTAR
          </button>
        </div>
      )}

      {/* Aviso silencioso de actualización automática */}
      <AutoUpdater />

      {/* --- Definición de rutas de la aplicación con carga diferida --- */}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Ruta de inicio de sesión */}
          <Route 
            path="/" 
            element={
              user ? <Navigate to="/dashboard" /> : <Login handleGoogleLogin={handleGoogleLogin} handleSpectatorLogin={handleSpectatorLogin} envsMissing={envsMissing} authError={authError} setNetworkError={setNetworkError} theme={theme} toggleTheme={toggleTheme} />
            } 
          />

          {/* Ruta del panel principal */}
          <Route 
            path="/dashboard" 
            element={
              user ? <Dashboard user={user} profile={profile} setNetworkError={setNetworkError} theme={theme} toggleTheme={toggleTheme} /> : <Navigate to="/" />
            } 
          />

          {/* Ruta del panel de administración */}
          <Route 
            path="/admin" 
            element={
              user ? 
                <AdminDashboard user={user} profile={profile} setNetworkError={setNetworkError} theme={theme} toggleTheme={toggleTheme} /> : 
                <Navigate to="/" />
            } 
          />

          {/* Redirección de ruta histórica hacia el flujo principal */}
          <Route
            path="/historico"
            element={<Navigate to={user ? "/dashboard" : "/"} replace />}
          />

          {/* Ruta del monitor de estado técnico */}
          <Route
            path="/status"
            element={
              <TechStatusDashboard onExit={() => { window.location.href = user ? '/dashboard' : '/'; }} />
            }
          />

          {/* Ruta de respaldo para rutas no reconocidas */}
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
