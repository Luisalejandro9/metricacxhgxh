import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import './App.css';

function App() {
  // --- Global State ---
  const [user, setUser] = useState(null); // Current authenticated user
  const [profile, setProfile] = useState(null); // User profile with role and enablement status
  const [loading, setLoading] = useState(true); // Loading state for initial session check
  const [networkError, setNetworkError] = useState(false); // Detects DNS/Fetch errors (intermittent DNS blocking)
  const [authError, setAuthError] = useState(null); // Standard auth failures
  useEffect(() => {
    // --- Profile Sync ---
    // Fetches the user profile from Supabase profiles table
    const syncProfile = async (userId) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) {
          console.error('[Debug] Error al obtener perfil:', error.message);
          return null;
        } else {
          setProfile(data);
          return data;
        }
      } catch (err) {
        console.error('Error syncing profile:', err);
        return null;
      }
    };

    // --- Initial Session Verification ---
    // Checks if a valid session exists in Supabase on app load
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Debug] Error al obtener sesión:', error.message);
          if (error.message.toLowerCase().includes('fetch')) {
            setNetworkError(true);
          }
        } else if (session) {
          setUser(session.user);
          await syncProfile(session.user.id);
        }
      } catch (err) {
        if (err.message.toLowerCase().includes('fetch')) {
          setNetworkError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // --- Real-time Auth Listener ---
    // Updates the 'user' state automatically when logging in or out
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        await syncProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Authentication Handler ---
  // Triggers the Google OAuth flow and handles specific network/auth errors
  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      setNetworkError(false);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin + '/dashboard' 
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error al iniciar sesión:', err.message);
      // If Supabase is blocked during login, show the network banner
      if (err.message.toLowerCase().includes('fetch')) {
        setNetworkError(true);
      }
      setAuthError('No se pudo conectar con el servicio de autenticación. Verifica tu conexión a internet.');
    }
  };

  const envsMissing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (loading) return (
    <div className="loading" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',fontSize:24, background:'#f5f5f7'}}>
      Cargando sesión...
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

      <Routes>
        {/* LOGIN ROUTE */}
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" /> : <Login handleGoogleLogin={handleGoogleLogin} envsMissing={envsMissing} authError={authError} setNetworkError={setNetworkError} />
          } 
        />

        {/* DASHBOARD ROUTE */}
        <Route 
          path="/dashboard" 
          element={
            user ? <Dashboard user={user} profile={profile} setNetworkError={setNetworkError} /> : <Navigate to="/" />
          } 
        />

        {/* ADMIN DASHBOARD ROUTE */}
        <Route 
          path="/admin" 
          element={
            user ? 
              <AdminDashboard user={user} profile={profile} setNetworkError={setNetworkError} /> : 
              <Navigate to="/" />
          } 
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} />} />
      </Routes>
    </Router>
  );
}

export default App;
