import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useAuthController } from './hooks/useAuthController';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import TechStatusDashboard from './components/TechStatusDashboard';
import AutoUpdater from './components/AutoUpdater';
import './App.css';

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    user, profile, loading, networkError, setNetworkError, authError,
    handleGoogleLogin, handleSpectatorLogin, envsMissing
  } = useAuthController();

  // Render clean executive loading screen
  if (loading && !networkError) return (
    <div className="login-overlay active">
      <div className="login-card" style={{ maxWidth: '380px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 32px' }}>
        <div className="spinner" style={{ width: '42px', height: '42px', borderWidth: '3px' }} aria-hidden="true"></div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-bright)', margin: 0 }}>Sincronizando sesión</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, borderBottom: 'none', paddingBottom: 0, textTransform: 'none', letterSpacing: 'normal' }}>Preparando tu espacio de trabajo...</p>
      </div>
    </div>
  );

  return (
    <Router>
      {/* GLOBAL CONNECTION ERROR NOTIFICATION */}
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

      {/* SILENT AUTO-UPDATER TOAST */}
      <AutoUpdater />

      <Routes>
        {/* LOGIN ROUTE */}
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" /> : <Login handleGoogleLogin={handleGoogleLogin} handleSpectatorLogin={handleSpectatorLogin} envsMissing={envsMissing} authError={authError} setNetworkError={setNetworkError} theme={theme} toggleTheme={toggleTheme} />
          } 
        />

        {/* DASHBOARD ROUTE */}
        <Route 
          path="/dashboard" 
          element={
            user ? <Dashboard user={user} profile={profile} setNetworkError={setNetworkError} theme={theme} toggleTheme={toggleTheme} /> : <Navigate to="/" />
          } 
        />

        {/* ADMIN DASHBOARD ROUTE */}
        <Route 
          path="/admin" 
          element={
            user ? 
              <AdminDashboard user={user} profile={profile} setNetworkError={setNetworkError} theme={theme} toggleTheme={toggleTheme} /> : 
              <Navigate to="/" />
          } 
        />

        {/* TECHNICAL STATUS DASHBOARD ROUTE */}
        <Route
          path="/historico"
          element={<Navigate to={user ? "/dashboard" : "/"} replace />}
        />

        <Route 
          path="/status" 
          element={<TechStatusDashboard onExit={() => window.location.href = '/'} />} 
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} />} />
      </Routes>
    </Router>
  );
}

export default App;
