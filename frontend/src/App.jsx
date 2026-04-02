import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  // Auth State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Auth Logic ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
