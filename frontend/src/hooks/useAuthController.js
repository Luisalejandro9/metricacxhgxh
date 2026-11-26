import { useEffect, useRef, useState } from 'react';
import { supabase, getEffectiveSupabaseUrl } from '../lib/supabase';
import { runPassiveSentinelCheck } from '../lib/incidentSentinel';

const isEmailAllowed = (email) => {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return normalized.endsWith('@konecta.com') ||
    normalized === 'lacosta.develop@gmail.com' ||
    normalized === 'lacosta151999@gmail.com';
};

export function useAuthController() {
  // --- Global State ---
  const [user, setUser] = useState(null); // Current authenticated user
  const [profile, setProfile] = useState(undefined); // undefined: not loaded, null: not found, object: loaded
  const [loading, setLoading] = useState(true); // Loading state for initial session check
  const [networkError, setNetworkError] = useState(false); // Detects DNS/Fetch errors (intermittent DNS blocking)
  const [authError, setAuthError] = useState(null); // Standard auth failures

  // Refs to avoid stale closures and redundant renders in auth listeners
  const userRef = useRef(user);
  const profileRef = useRef(profile);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

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
        
        // Solo tratar como perfil ausente el caso explícito de PostgREST (PGRST116).
        // Cualquier otro error (permisos, red, timeout o fallo temporal) no debe
        // convertirse en profile=null porque eso puede disparar un cierre de sesión.
        const isNetworkErr = error?.message?.toLowerCase().includes('fetch') ||
                             error?.message?.toLowerCase().includes('network') ||
                             error?.message?.toLowerCase().includes('timeout') ||
                             error?.status === 0;

        if (isNetworkErr) {
          setNetworkError(true);
          console.warn('Error de red al sincronizar perfil. Se conserva el estado actual.');
          return;
        }

        const profileMissing = error?.code === 'PGRST116' || !result.data;
        if (!profileMissing) {
          console.error('Error no transitorio al consultar perfil; no se cerrará la sesión:', error);
          return;
        }

        console.warn('Perfil realmente ausente, intentando recuperarlo/crearlo...');
        const { data: newProfile, error: createError } = await supabase
          .rpc('ensure_own_profile');

        if (!createError && newProfile && newProfile.id === userId) {
          console.log('Perfil recuperado o creado de forma segura:', newProfile);
          setProfile(newProfile);
          setNetworkError(false);
          return;
        }

        console.error('No se pudo recuperar/crear el perfil. Se mantiene la sesión y se podrá reintentar:', createError);
        const createErrorMessage = createError?.message?.toLowerCase() || '';
        if (createErrorMessage.includes('fetch') || createErrorMessage.includes('timeout') ||
            createErrorMessage.includes('network') || createError?.status === 0) {
          setNetworkError(true);
        }
        // No asignar null: un fallo de provisioning nunca equivale a una cuenta deshabilitada.
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

  // --- Check if Supabase (or its Netlify Proxy) is Reachable ---
  const checkSupabaseConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      
      // Sonda al proxy efectivo (/supabase/rest/v1/)
      await fetch(`${getEffectiveSupabaseUrl()}/rest/v1/`, { 
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      return true;
    } catch {
      // No intentar el dominio directo: en redes corporativas puede estar bloqueado.
      return false;
    }
  };

  // --- Centinela Pasivo de Incidentes de Red ---
  useEffect(() => {
    const sentinelTimeout = setTimeout(runPassiveSentinelCheck, 3500);
    const sentinelInterval = setInterval(runPassiveSentinelCheck, 10 * 60 * 1000);
    return () => {
      clearTimeout(sentinelTimeout);
      clearInterval(sentinelInterval);
    };
  }, []);

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

        // Avoid duplicate check if already handled by onAuthStateChange
        if (userRef.current) {
          if (mounted) setLoading(false);
          return;
        }

        // --- 2. Check for OAuth code or access token in URL ---
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
          try {
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (!exchangeError && exchangeData?.session) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (codeErr) {
            console.warn('OAuth code exchange:', codeErr);
          }
        }

        // --- 3. Standard Supabase Session Check ---
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted && data?.session) {
          const email = data.session.user.email;
          if (isEmailAllowed(email)) {
            // Guard with ref checks
            if (!userRef.current) {
              setUser(data.session.user);
            }
            if (profileRef.current === undefined) {
              await syncProfile(data.session.user.id);
            }
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
            // Only set user if the user object changed/is empty
            if (!userRef.current || userRef.current.id !== session.user.id || userRef.current.email !== session.user.email) {
              setUser(session.user);
            }
            // Only sync profile if it's not already loaded for this user
            if (profileRef.current === undefined || profileRef.current === null || profileRef.current.id !== session.user.id) {
              await syncProfile(session.user.id);
            }
          } else {
            console.warn('Acceso denegado en cambio de estado: Email no corporativo.');
            setAuthError('Acceso restringido. Solo se permite el inicio de sesión real a usuarios con correo @konecta.com.');
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          }
        } else {
          // If there was no active user anyway, just clear and return
          if (!userRef.current) {
            setUser(null);
            setProfile(null);
            return;
          }

          // If the event is explicitly SIGNED_OUT, then clear session
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
          } else {
            // If the event is not SIGNED_OUT, it's a transient check (like token refresh or tab focus).
            // Do NOT clear the user or profile here to prevent unmounting the dashboard and slow reloads.
            // Instead, do a quick connection check to update the network error status.
            const isReachable = await checkSupabaseConnection();
            if (!isReachable) {
              console.warn('onAuthStateChange: Supabase is unreachable during transient state.');
              setNetworkError(true);
            } else {
              setNetworkError(false);
            }
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
      if (profile?.is_enabled === false) {
        console.warn('Perfil deshabilitado o eliminado. Forzando cierre de sesión...');
        supabase.auth.signOut();
      }
    }
  }, [user, profile]);

  // --- Google Identity Services: ID Token flow (sin redirección OAuth a Supabase) ---
  const handleGoogleLogin = async (idToken, nonce) => {
    try {
      setAuthError(null);
      setNetworkError(false);
      if (!idToken || !nonce) throw new Error('Google no devolvió las credenciales necesarias para iniciar sesión.');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error al iniciar sesión con Google ID Token:', err);
      const message = err.message?.toLowerCase() || '';
      if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
        setAuthError('bloqueo_dns');
      } else {
        setAuthError(err.message || 'No se pudo completar el inicio de sesión con Google.');
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


  return {
    user, profile, loading, networkError, setNetworkError, authError,
    setAuthError, handleGoogleLogin, handleSpectatorLogin, envsMissing
  };
}
