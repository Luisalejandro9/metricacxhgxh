/**
 * @file useAuthController.js
 * @description Hook controlador de autenticación y sesión de usuario.
 * Gestiona el inicio de sesión con Google ID Token, modo demostración, sincronización
 * del perfil en Supabase, validación de dominio corporativo y recuperación ante bloqueos de red.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase, getEffectiveSupabaseUrl } from '../lib/supabase';
import { runPassiveSentinelCheck } from '../lib/incidentSentinel';

/**
 * Valida si el correo pertenece al dominio corporativo o a cuentas administrativas autorizadas.
 */
const isEmailAllowed = (email) => {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return normalized.endsWith('@konecta.com') ||
    normalized === 'lacosta.develop@gmail.com' ||
    normalized === 'lacosta151999@gmail.com';
};

/**
 * Hook principal que administra el ciclo de vida de la sesión, el perfil y el estado de conectividad.
 */
export function useAuthController() {
  // --- Estado global de autenticación ---
  const [user, setUser] = useState(null); // Usuario autenticado actual
  const [profile, setProfile] = useState(undefined); // undefined: sin cargar, null: no encontrado, objeto: cargado
  const [loading, setLoading] = useState(true); // Estado de carga para la verificación inicial de sesión
  const [networkError, setNetworkError] = useState(false); // Detecta errores de DNS o red (bloqueos intermitentes)
  const [authError, setAuthError] = useState(null); // Errores estándar de autenticación

  // Referencias para evitar cierres obsoletos y renderizados redundantes en los listeners
  const userRef = useRef(user);
  const profileRef = useRef(profile);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // --- Sincronización del perfil de usuario ---
  /**
   * Consulta el perfil del usuario en `profiles` con timeout de seguridad y aprovisionamiento automático si falta.
   */
  const syncProfile = async (userId) => {
    if (!userId) { setProfile(null); return; }
    try {
      // Límite de 5 segundos para evitar bloqueos indefinidos
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

        const profileMissing = error?.code === 'PGRST116';
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
        console.error('No se modifica el perfil local por un error inesperado de sincronización.');
      }
    }
  };

  // --- Verificación de conectividad con Supabase (o su proxy en Netlify) ---
  /**
   * Envía una petición HEAD con timeout corto al proxy efectivo para comprobar conectividad.
   */
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

  // --- Centinela pasivo de incidentes de red ---
  useEffect(() => {
    const sentinelTimeout = setTimeout(runPassiveSentinelCheck, 3500);
    const sentinelInterval = setInterval(runPassiveSentinelCheck, 10 * 60 * 1000);
    return () => {
      clearTimeout(sentinelTimeout);
      clearInterval(sentinelInterval);
    };
  }, []);

  // --- Inicialización de sesión y suscripción a cambios de autenticación ---
  useEffect(() => {
    let mounted = true;

    /**
     * Evalúa la sesión inicial (demo local, código OAuth en URL o sesión activa en Supabase).
     */
    const checkSession = async () => {
      try {
        // --- 1. Verificar si existe una sesión local de demostración activa ---
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

        // Evitar verificación duplicada si ya fue procesada por onAuthStateChange
        if (userRef.current) {
          if (mounted) setLoading(false);
          return;
        }

        // --- 2. Verificar código OAuth en la URL e intercambiarlo por sesión ---
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

        // --- 3. Verificación estándar de sesión en Supabase ---
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted && data?.session) {
          const email = data.session.user.email;
          if (isEmailAllowed(email)) {
            // Proteger actualización usando referencias actuales
            if (!userRef.current) {
              setUser(data.session.user);
            }
            if (profileRef.current === undefined) {
              await syncProfile(data.session.user.id);
            }
          } else {
            console.warn('Acceso denegado: Email no corporativo ni admin autorizado.');
            setAuthError('Acceso restringido. Solo se permite el inicio de sesión real a usuarios con correo @konecta.com.');
            setUser(null);
            setProfile(null);
            setTimeout(() => { void supabase.auth.signOut(); }, 0);
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

    // Listener reactivo para eventos de sesión en Supabase (login, logout, refresco de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        // Mantener activas las sesiones demo aunque Supabase dispare onAuthStateChange (p. ej. en sincronizaciones en segundo plano)
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
            // Actualizar usuario solo si cambió o está vacío
            if (!userRef.current || userRef.current.id !== session.user.id || userRef.current.email !== session.user.email) {
              setUser(session.user);
            }
            // Sincronizar perfil solo si aún no está cargado para este usuario
            if (profileRef.current === undefined || profileRef.current === null || profileRef.current.id !== session.user.id) {
              setTimeout(() => { void syncProfile(session.user.id); }, 0);
            }
          } else {
            console.warn('Acceso denegado en cambio de estado: Email no corporativo.');
            setAuthError('Acceso restringido. Solo se permite el inicio de sesión real a usuarios con correo @konecta.com.');
            setUser(null);
            setProfile(null);
            setTimeout(() => { void supabase.auth.signOut(); }, 0);
          }
        } else {
          // Si no había usuario activo, limpiar estado y salir
          if (!userRef.current) {
            setUser(null);
            setProfile(null);
            return;
          }

          // Si el evento es explícitamente SIGNED_OUT, limpiar la sesión
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
          } else {
            // Si el evento no es SIGNED_OUT, es una verificación transitoria (como refresco de token o foco de pestaña).
            // No limpiar usuario ni perfil aquí para evitar desmontar el panel y provocar recargas lentas.
            // En su lugar, comprobar rápidamente la conexión para actualizar el estado de error de red.
            setTimeout(async () => {
              const isReachable = await checkSupabaseConnection();
              setNetworkError(!isReachable);
              if (!isReachable) {
                console.warn('onAuthStateChange: Supabase is unreachable during transient state.');
              }
            }, 0);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- Bucle de recuperación de conexión en segundo plano ---
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
      }, 4000); // Comprobar cada 4 segundos
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [networkError, user]);

  // --- Cierre de sesión forzado si el perfil está deshabilitado o eliminado ---
  useEffect(() => {
    if (user && profile !== undefined) {
      if (user.isDemo) return; // Omitir verificación de cierre forzado en sesiones locales de demostración
      if (profile?.is_enabled === false) {
        console.warn('Perfil deshabilitado o eliminado. Forzando cierre de sesión...');
        supabase.auth.signOut();
      }
    }
  }, [user, profile]);

  // --- Flujo de Google Identity Services: ID Token (sin redirección OAuth a Supabase) ---
  /**
   * Inicia sesión en Supabase intercambiando el ID Token y el nonce emitidos por Google.
   */
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

  // --- Manejador de acceso en modo espectador (demostración) ---
  /**
   * Configura credenciales simuladas de espectador en sessionStorage para probar la plataforma sin backend.
   */
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
    
    // Guardar en sessionStorage para conservar la sesión tras recargas
    sessionStorage.setItem('demo_session', JSON.stringify({ user: demoUser, profile: demoProfile }));
    
    setUser(demoUser);
    setProfile(demoProfile);
    setAuthError(null);
    setNetworkError(false);
  };

  const envsMissing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Se omite pantalla completa de bloqueo DNS para permitir el renderizado normal del Login con alertas personalizadas


  return {
    user, profile, loading, networkError, setNetworkError, authError,
    setAuthError, handleGoogleLogin, handleSpectatorLogin, envsMissing
  };
}
