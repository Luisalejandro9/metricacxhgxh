import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, RefreshCw, Sun, Moon, ExternalLink, KeyRound, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { resolveBypassUrl, supabase } from '../lib/supabase';

function Login({ handleGoogleLogin, handleSpectatorLogin, envsMissing, authError, setNetworkError, theme, toggleTheme }) {\n  const googleButtonRef = useRef(null);\n  const googleHandlerRef = useRef(handleGoogleLogin);\n  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;\n\n  useEffect(() => { googleHandlerRef.current = handleGoogleLogin; }, [handleGoogleLogin]);\n\n  useEffect(() => {\n    if (!googleClientId || !googleButtonRef.current) return undefined;\n    let cancelled = false;\n    const renderGoogleButton = () => {\n      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;\n      googleButtonRef.current.innerHTML = '';\n      window.google.accounts.id.initialize({\n        client_id: googleClientId,\n        callback: (response) => googleHandlerRef.current?.(response.credential),\n        auto_select: false\n      });\n      window.google.accounts.id.renderButton(googleButtonRef.current, {\n        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',\n        shape: 'rectangular', width: Math.max(240, Math.floor(googleButtonRef.current.clientWidth || 360))\n      });\n    };\n    if (window.google?.accounts?.id) {\n      renderGoogleButton();\n    } else {\n      let script = document.querySelector('script[src=\"https://accounts.google.com/gsi/client\"]');\n      if (!script) {\n        script = document.createElement('script');\n        script.src = 'https://accounts.google.com/gsi/client';\n        script.async = true;\n        script.defer = true;\n        document.head.appendChild(script);\n      }\n      script.addEventListener('load', renderGoogleButton);\n      script.addEventListener('error', () => {\n        if (!cancelled) console.error('No se pudo cargar Google Identity Services.');\n      });\n      if (window.google?.accounts?.id) renderGoogleButton();\n    }\n    return () => { cancelled = true; };\n  }, [googleClientId]);
  const [bypassInput, setBypassInput] = useState('');
  const [bypassError, setBypassError] = useState('');
  const [showBypass, setShowBypass] = useState(false);

  // Email OTP state for direct access without OAuth redirects
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState(null);

  const handleBypassSubmit = (e) => {
    e.preventDefault();
    setBypassError('');
    if (!bypassInput.trim()) {
      setBypassError('Ingresa el enlace o código de Supabase.');
      return;
    }
    const success = resolveBypassUrl(bypassInput);
    if (!success) {
      setBypassError('No se pudo procesar el enlace. Verifica que sea válido.');
    }
  };

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

  return (
    <div className="login-overlay active">
      <div className="login-bg"></div>

      <div className="login-card" style={{ maxWidth: '440px', width: '100%' }}>
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
                La red de Konecta tiene bloqueado el dominio directo de Supabase. Puedes reintentar, usar el bypass por enlace o ingresar directamente con código por correo.
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

        {/* --- SISTEMA DE SALTO DE BLOQUEO CORPORATIVO (NETLIFY / VERCEL BYPASS) --- */}
        <div style={{ marginTop: '12px', marginBottom: '16px', border: '1px solid var(--border-light)', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setShowBypass(!showBypass)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              border: 'none',
              color: 'var(--text-bright)',
              fontSize: '11px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ExternalLink size={13} style={{ color: 'var(--primary)' }} />
              ¿Error 404 o enlace bloqueado al logear?
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{showBypass ? 'Ocultar' : 'Bypass'}</span>
          </button>

          {showBypass && (
            <div style={{ padding: '12px', background: 'var(--bg-card)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Si Google te redirigió a una pantalla de error 404 con un enlace largo de Supabase (<code>oyhlhdlubralrgjbgtqw.supabase.co</code>), pega ese enlace aquí para saltar el bloqueo inmediatamente mediante el proxy de Netlify/Vercel:
              </p>

              <form onSubmit={handleBypassSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Pega el enlace largo de Supabase o código..."
                  value={bypassInput}
                  onChange={(e) => setBypassInput(e.target.value)}
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
                {bypassError && (
                  <span style={{ color: 'var(--accent-error)', fontSize: '10px' }}>{bypassError}</span>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
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
                  <ArrowRight size={13} />
                  Saltar Bloqueo y Entrar
                </button>
              </form>
            </div>
          )}
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
