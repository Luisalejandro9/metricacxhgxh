import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    const checkSession = async () => {
      console.log('[Debug] Verificando sesión inicial...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Debug] Error al obtener sesión:', error.message);
      } else if (session) {
        console.log('[Debug] Sesión encontrada para:', session.user.email);
        setUser(session.user);
      } else {
        console.log('[Debug] No hay sesión inicial activa.');
      }
      setLoading(false);
    };

    checkSession();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Debug] Cambio de estado auth detectado:', event);
      if (session) {
        console.log('[Debug] Usuario logeado:', session.user.email);
        setUser(session.user);
      } else {
        console.log('[Debug] Usuario deslogeado.');
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin + '/dashboard' 
      }
    });
    if (error) console.error('Error al iniciar sesión:', error.message);
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
            user ? <Navigate to="/dashboard" /> : <Login handleGoogleLogin={handleGoogleLogin} envsMissing={envsMissing} />
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
