import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // URL Check
    
    // Initial session check
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Debug] Error al obtener sesión:', error.message);
      } else if (session) {
        setUser(session.user);
      } else {
      }
      setLoading(false);
    };

    checkSession();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin + '/dashboard' 
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error al iniciar sesión:', err.message);
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
      <Routes>
        {/* LOGIN ROUTE */}
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" /> : <Login handleGoogleLogin={handleGoogleLogin} envsMissing={envsMissing} authError={authError} />
          } 
        />

        {/* DASHBOARD ROUTE */}
        <Route 
          path="/dashboard" 
          element={
            user ? <Dashboard user={user} /> : <Navigate to="/" />
          } 
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} />} />
      </Routes>
    </Router>
  );
}

export default App;
