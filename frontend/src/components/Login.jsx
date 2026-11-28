/**
 * @file Login.jsx
 * @description Portal de inicio de sesión de la plataforma.
 * Ofrece autenticación mediante Google Identity Services (ID Token), código OTP por correo
 * corporativo sin redirecciones externas y acceso de demostración en modo espectador.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, RefreshCw, Sun, Moon, KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Pantalla de acceso con selector de tema, alertas de autenticación/red y métodos de ingreso.
 */
function Login({ handleGoogleLogin, handleSpectatorLogin, envsMissing, authError, setNetworkError, theme, toggleTheme }) {
  // --- Referencias y configuración de Google Identity Services ---
  const googleButtonRef = useRef(null);
  const googleHandlerRef = useRef(handleGoogleLogin);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => { googleHandlerRef.current = handleGoogleLogin; }, [handleGoogleLogin]);

  // --- Inicialización y renderizado del botón de Google ---
  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;
    let cancelled = false;
    /**
     * Genera un nonce criptográfico y renderiza el botón oficial de Google Sign-In.
     */
    const renderGoogleButton = async () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      try {
        // Generar un nonce nuevo en cada carga o inicialización de inicio de sesión.
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const rawNonce = btoa(String.fromCharCode(...randomBytes));
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
        const hashedNonce = Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, '0')).join('');
        if (cancelled || !googleButtonRef.current) return;

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          nonce: hashedNonce,
          callback: (response) => googleHandlerRef.current?.(response.credential, rawNonce),
          auto_select: false
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
          shape: 'rectangular', width: Math.max(240, Math.floor(googleButtonRef.current.clientWidth || 360))
        });
      } catch (error) {
        console.error('No se pudo inicializar el acceso seguro de Google:', error);
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderGoogleButton);
      script.addEventListener('error', () => {
        if (!cancelled) console.error('No se pudo cargar Google Identity Services.');
      });
    }
    return () => { cancelled = true; };
  }, [googleClientId]);

  // --- Estado del flujo OTP por correo para acceso directo sin redirecciones OAuth ---
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState(null);

  /**
   * Valida el dominio del correo y solicita a Supabase el envío de un código OTP.
   */
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setOtpMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setOtpMessage({ type: 'error', text: 'Ingresa tu correo corporativo.' });
      return;
    }
    if (!cleanEmail.endsWith('@konecta.com') && cleanEmail !== 'lacosta.develop@gmail.com' && cleanEmail !== 'lacosta151999@gmail.com') {
      setOtpMessage({ type: 'error', text: 'Solo se permiten correos @konecta.com o autorizados.' });
      return;
    }

    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail
      });
      if (error) throw error;
      setOtpSent(true);
      setOtpMessage({ type: 'success', text: 'Código de acceso enviado a tu correo.' });
    } catch (err) {
      console.error('Error enviando código:', err);
      setOtpMessage({ type: 'error', text: err.message || 'Error al enviar código de acceso.' });
    } finally {
      setOtpLoading(false);
    }
  };

  /**
   * Verifica el código OTP de 6 dígitos ingresado por el usuario para iniciar sesión.
   */
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpMessage(null);
    if (!otpToken.trim()) {
      setOtpMessage({ type: 'error', text: 'Ingresa el código de 6 dígitos.' });
      return;
    }

    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpToken.trim(),
        type: 'email'
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error verificando código:', err);
      setOtpMessage({ type: 'error', text: err.message || 'Código inválido o expirado.' });
    } finally {
      setOtpLoading(false);
    }
  };

  // --- Pantalla de advertencia si faltan variables de entorno de Supabase ---
  if (envsMissing) {
    return (
      <div className="login-overlay active">
        <div className="login-card" style={{ border: '1px solid var(--accent-error)' }}>
          <h1 style={{ color: 'var(--accent-error)', fontSize: '20px' }}>Error de Configuración</h1>
          <p>Faltan las variables de entorno <strong>(VITE_SUPABASE_URL / ANON_KEY)</strong>.</p>
          <p>Debes configurarlas en el panel de Vercel o Netlify en Environment Variables.</p>
          <div style={{ marginTop: 20, fontSize: 12, opacity: 0.7 }}>Una vez configuradas, realiza un redeploy para aplicar los cambios.</div>
        </div>
      </div>
    );
  }

  // --- Renderizado principal del portal de acceso ---
  return (
    <div className="login-overlay active">
      <div className="login-bg"></div>

      <div className="login-card" style={{ maxWidth: '440px', width: '100%' }}>
        {/* Encabezado y selector de tema */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: 'var(--primary)', textTransform: 'uppercase' }}>
            Portal de Acceso
          </span>
          {toggleTheme && (
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Tema Claro' : 'Cambiar a Tema Oscuro'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? 'CLARO' : 'OSCURO'}</span>
            </button>
          )}
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-bright)', marginBottom: '4px' }}>Soporte Métricas</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
          Control de Rendimiento Operativo
        </p>

        {/* Notificación de errores estándar */}
        {authError && authError !== 'bloqueo_dns' && (
          <div className="auth-error-notice" style={{ background: 'var(--bg-main)', color: 'var(--accent-error)', padding: '12px', marginBottom: '16px', border: '1px solid var(--accent-error)', fontSize: '12px', fontWeight: '600' }}>
            {authError}
          </div>
        )}

        {/* Notificación de Bloqueo DNS / Red */}
        {authError === 'bloqueo_dns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginBottom: '16px' }}>
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--accent-warning)',
              padding: '14px',
              fontSize: '12px'
            }}>
              <div style={{ color: 'var(--accent-warning)', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Restricción de Red Corporativa
              </div>
              <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: '1.4' }}>
                No se pudo conectar con el servicio de autenticación. Verifica la conexión e inténtalo nuevamente.
              </p>
            </div>
            

          </div>
        )}

        {/* Google Identity Services entrega el ID Token sin redirección a Supabase */}
        <div style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          {googleClientId
            ? <div ref={googleButtonRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
            : <p style={{ color: 'var(--accent-error)', fontSize: '12px' }}>Falta configurar VITE_GOOGLE_CLIENT_ID en Netlify.</p>}
        </div>

        {/* --- ACCESO DIRECTO CON CÓDIGO POR CORREO (SIN REDIRECCIONES EXTERNAS) --- */}
        <div style={{ marginTop: '8px', marginBottom: '16px', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Mail size={13} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-bright)' }}>
              Acceso Directo por Correo (Sin OAuth)
            </span>
          </div>

          {!otpSent ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="email"
                placeholder="usuario@konecta.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={otpLoading}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-bright)'
                }}
              />
              <button
                type="submit"
                disabled={otpLoading}
                className="btn btn-secondary"
                style={{
                  padding: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {otpLoading ? <RefreshCw size={13} className="spinning" /> : <KeyRound size={13} />}
                Solicitar Código de Acceso
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                placeholder="Código de 6 dígitos"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                disabled={otpLoading}
                maxLength={10}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing: '0.1em',
                  textAlign: 'center',
                  borderRadius: '4px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-bright)'
                }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '8px', fontSize: '11px' }}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={otpLoading}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '8px', fontSize: '11px', fontWeight: '700' }}
                >
                  {otpLoading ? <RefreshCw size={13} className="spinning" /> : 'Verificar y Entrar'}
                </button>
              </div>
            </form>
          )}

          {otpMessage && (
            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              color: otpMessage.type === 'success' ? 'var(--accent-success)' : 'var(--accent-error)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {otpMessage.type === 'success' ? <CheckCircle2 size={12} /> : null}
              {otpMessage.text}
            </div>
          )}
        </div>

        {/* --- Acceso Modo Demostración --- */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 12px 0', width: '100%' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
          <span style={{ padding: '0 10px', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Modo Demostración
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={handleSpectatorLogin}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={14} style={{ color: 'var(--primary)' }} />
          Acceso Modo Espectador
        </button>
      </div>
    </div>
  );
}

export default Login;
