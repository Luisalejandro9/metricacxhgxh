import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import './App.css';

// --- Email Domain Restriction Helper ---
// Restricts authentications to @konecta.com and approved administrators
const isEmailAllowed = (email) => {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return (
    emailLower.endsWith('@konecta.com') ||
    emailLower === 'lacosta.develop@gmail.com' ||
    emailLower === 'lacosta151999@gmail.com'
  );
};

function App() {
  // --- Global State ---
  const [user, setUser] = useState(null); // Current authenticated user
  const [profile, setProfile] = useState(undefined); // undefined: not loaded, null: not found, object: loaded
  const [loading, setLoading] = useState(true); // Loading state for initial session check
  const [networkError, setNetworkError] = useState(false); // Detects DNS/Fetch errors (intermittent DNS blocking)
  const [authError, setAuthError] = useState(null); // Standard auth failures
  // --- Profile Sync ---
  const syncProfile = async (userId) => {
    if (!userId) { setProfile(null); return; }
    try {
      // Timeout after 5 seconds to prevent hanging
      const result = await Promise.race([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 5000))
      ]);
      
      if (!result.error && result.data) {
        setProfile(result.data);
        setNetworkError(false);
      } else {
        const error = result.error;
        console.warn('Profile sync warning or error:', error);
        
        // If it's a network/fetch error or timeout, do NOT set profile to null
        const isNetworkErr = error?.message?.toLowerCase().includes('fetch') || 
                             error?.message?.toLowerCase().includes('network') ||
                             error?.message?.toLowerCase().includes('timeout') ||
                             error?.status === 0;
        
        if (isNetworkErr) {
          setNetworkError(true);
          console.warn('Network error during profile sync. Retaining existing profile state.');
          return;
        }

        // PROFILE IS MISSING - Check if there is an active session to auto-create
        console.warn('Perfil no encontrado, intentando auto-crear perfil por defecto...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!sessionError && session && session.user && session.user.id === userId) {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([
              { 
                id: userId, 
                email: session.user.email, 
                role: 'operator', 
                is_enabled: true 
              }
            ])
            .select()
            .single();

          if (!createError && newProfile) {
            console.log('Perfil auto-creado con éxito:', newProfile);
            setProfile(newProfile);
            setNetworkError(false);
            return;
          } else {
            console.error('Error al auto-crear perfil:', createError);
            const isCreateNetworkErr = createError?.message?.toLowerCase().includes('fetch') ||
                                       createError?.message?.toLowerCase().includes('timeout');
            if (isCreateNetworkErr) {
              setNetworkError(true);
              return;
            }
          }
        }
        setProfile(null);
      }
    } catch (err) {
      console.error('Profile sync error:', err);
      const isNetworkErr = err.message?.toLowerCase().includes('fetch') || 
                           err.message?.toLowerCase().includes('timeout') || 
                           err.message?.toLowerCase().includes('network');
      if (isNetworkErr) {
        setNetworkError(true);
      } else {
        setProfile(null);
      }
    }
  };

  // --- Check if Supabase DNS is Reachable ---
  const checkSupabaseConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // We try to fetch the Supabase URL. Even with no-cors, if it resolves, the DNS block is lifted!
      await fetch(import.meta.env.VITE_SUPABASE_URL, { 
        method: 'GET', 
        mode: 'no-cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        // --- 1. Check if there is an active local Demo Session ---
        const demoSessionStr = sessionStorage.getItem('demo_session');
        if (demoSessionStr) {
          const demoSession = JSON.parse(demoSessionStr);
          if (mounted) {
            setUser(demoSession.user);
            setProfile(demoSession.profile);
            setLoading(false);
            return;
          }
        }

        // --- 2. Standard Supabase Session Check ---
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted && data?.session) {
          const email = data.session.user.email;
          if (isEmailAllowed(email)) {
            setUser(data.session.user);
            await syncProfile(data.session.user.id);
          } else {
            console.warn('Acceso denegado: Email no corporativo ni admin autorizado.');
            setAuthError('Acceso restringido. Solo se permite el inicio de sesión real a usuarios con correo @konecta.com.');
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
        if (err.message?.toLowerCase().includes('fetch')) {
          setNetworkError(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        // Keep demo sessions active even if Supabase triggers onAuthStateChange (e.g. on background syncs)
        const demoSessionStr = sessionStorage.getItem('demo_session');
        if (demoSessionStr) {
          const demoSession = JSON.parse(demoSessionStr);
          setUser(demoSession.user);
          setProfile(demoSession.profile);
          return;
        }

        if (session) {
          const email = session.user.email;
          if (isEmailAllowed(email)) {
            setUser(session.user);
            await syncProfile(session.user.id);
          } else {
            console.warn('Acceso denegado en cambio de estado: Email no corporativo.');
            setAuthError('Acceso restringido. Solo se permite el inicio de sesión real a usuarios con correo @konecta.com.');
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          }
        } else {
          // If the event is explicitly SIGNED_OUT, then clear session
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
          } else {
            // Check if connection is active before clearing the user/session
            const isReachable = await checkSupabaseConnection();
            if (!isReachable) {
              console.warn('onAuthStateChange: Supabase is unreachable. Retaining current session.');
              setNetworkError(true);
              return;
            }
            setUser(null);
            setProfile(null);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- Background Connection Recovery Loop ---
  useEffect(() => {
    let intervalId = null;

    if (networkError && !user) {
      console.log('DNS/Network block active. Starting background connection recovery check...');
      intervalId = setInterval(async () => {
        const isReachable = await checkSupabaseConnection();
        if (isReachable) {
          console.log('Supabase connection restored! Re-checking session...');
          clearInterval(intervalId);
          setNetworkError(false);
          setLoading(true);
          
          try {
            const { data, error } = await supabase.auth.getSession();
            if (!error && data?.session) {
              setUser(data.session.user);
              await syncProfile(data.session.user.id);
            }
          } catch (err) {
            console.error('Session retry failed:', err);
          } finally {
            setLoading(false);
          }
        }
      }, 4000); // Check every 4 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [networkError, user]);

  // --- Force Logout on Disabled/Deleted Profile ---
  useEffect(() => {
    if (user && profile !== undefined) {
      if (user.isDemo) return; // Skip forced logout checks for local demo sessions
      if (profile === null || profile.is_enabled === false) {
        console.warn('Perfil deshabilitado o eliminado. Forzando cierre de sesión...');
        supabase.auth.signOut();
      }
    }
  }, [user, profile]);

  // --- Authentication Handler ---
  // Triggers the Google OAuth flow and handles specific network/auth errors
  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      setNetworkError(false);
      
      // Check if Supabase is reachable before trying to redirect to auth
      const isReachable = await checkSupabaseConnection();
      if (!isReachable) {
        console.warn('Conexión con Supabase fallida antes del redireccionamiento OAuth.');
        setAuthError('bloqueo_dns');
        return;
      }

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
      if (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network')) {
        setAuthError('bloqueo_dns');
      } else {
        setAuthError('No se pudo conectar con el servicio de autenticación. Verifica tu conexión a internet.');
      }
    }
  };

  // --- Spectator Demo Authentication Handler ---
  // Sets up simulated spectator credentials in sessionStorage
  const handleSpectatorLogin = () => {
    const demoUser = {
      id: 'demo-spectator-id',
      email: 'espectador@demo.local',
      isDemo: true
    };
    const demoProfile = {
      id: 'demo-spectator-id',
      email: 'espectador@demo.local',
      role: 'operator',
      is_enabled: true
    };
    
    // Save to sessionStorage so it persists page reloads
    sessionStorage.setItem('demo_session', JSON.stringify({ user: demoUser, profile: demoProfile }));
    
    setUser(demoUser);
    setProfile(demoProfile);
    setAuthError(null);
    setNetworkError(false);
  };

  const envsMissing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Removed standby / DNS blocked full-screen recovery screen to allow normal rendering of Login screen with custom alerts

  // Render modern high-fidelity loading screen
  if (loading && !networkError) return (
    <div className="login-overlay active">
      <div className="login-bg">
        <div className="bg-shape bg-shape-1"></div>
        <div className="bg-shape bg-shape-2"></div>
        <div className="bg-shape bg-shape-3"></div>
      </div>
      <div className="login-card" style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="spinner" style={{ width: '50px', height: '50px', border: '4px solid rgba(99, 102, 241, 0.1)', borderTopColor: 'var(--primary-light)' }}></div>
          <h2 style={{ fontSize: '20px', color: 'var(--text-bright)' }}>Sincronizando sesión...</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Cargando tus credenciales y preparando tu espacio de trabajo.</p>
        </div>
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

      <Routes>
        {/* LOGIN ROUTE */}
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" /> : <Login handleGoogleLogin={handleGoogleLogin} handleSpectatorLogin={handleSpectatorLogin} envsMissing={envsMissing} authError={authError} setNetworkError={setNetworkError} />
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
