import React, { useState, useEffect, useRef } from 'react';
import { Save, Copy, Check, Bookmark, UploadCloud, AlertTriangle, Shield, CheckCircle2, Terminal } from 'lucide-react';

export default function HistoricoConfig({ config, onSaveConfig, onIngestData }) {
  const [url, setUrl] = useState(config.supabaseUrl || '');
  const [anonKey, setAnonKey] = useState(config.anonKey || '');
  const [ingestToken, setIngestToken] = useState(config.ingestToken || '');
  const [viewToken, setViewToken] = useState(config.viewToken || '');
  const [email, setEmail] = useState(config.pulsoEmail || 'luis.acosta@konecta.com');

  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [copiedConsole, setCopiedConsole] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pasteJson, setPasteJson] = useState('');
  const [isSubmittingPaste, setIsSubmittingPaste] = useState(false);
  const [pasteResult, setPasteResult] = useState(null);

  const bookmarkLinkRef = useRef(null);

  useEffect(() => {
    setUrl(config.supabaseUrl || '');
    setAnonKey(config.anonKey || '');
    setIngestToken(config.ingestToken || '');
    setViewToken(config.viewToken || '');
    setEmail(config.pulsoEmail || 'luis.acosta@konecta.com');
  }, [config]);

  const handleSave = (e) => {
    e.preventDefault();
    onSaveConfig({
      supabaseUrl: url.trim().replace(/\/$/, ''),
      anonKey: anonKey.trim(),
      ingestToken: ingestToken.trim(),
      viewToken: viewToken.trim(),
      pulsoEmail: email.trim()
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Código JS puro del script de captura
  const getRawScriptCode = () => {
    const C = {
      u: url.trim().replace(/\/$/, ''),
      k: anonKey.trim(),
      t: ingestToken.trim(),
      e: email.trim()
    };

    return `(async()=>{
  const C = ${JSON.stringify(C)};
  const g = p => fetch('/api/api/'+p, {credentials:'include', cache:'no-store'})
    .then(r => { if(!r.ok) throw new Error(p+' '+r.status); return r.json(); });
  let d;
  try {
    const i = await g('obtenerUltimoIntervalo'),
          p = await g('produDiariaPorEquipo?email='+C.e),
          l = await g('getRelDiaria?mail='+C.e).catch(()=>[]);
    d = {i,p,l};
    const r = await fetch(C.u+'/rest/v1/rpc/ingest', {
      method:'POST',
      headers:{'Content-Type':'application/json', apikey:C.k, Authorization:'Bearer '+C.k},
      body: JSON.stringify({p_token:C.t, p_info:i, p_produ:p, p_rel:l})
    });
    alert('Pulso histórico: ' + await r.text());
  } catch(e) {
    if (d) { try { await navigator.clipboard.writeText(JSON.stringify(d)); } catch(_){} }
    alert('No se pudo enviar ('+e.message+'). Si hay datos, quedaron en el portapapeles: pégalos en la web.');
  }
})()`;
  };

  const getBookmarkletHref = () => {
    return `javascript:${encodeURIComponent(getRawScriptCode())}`;
  };

  // Asignar href imperativamente al DOM nativo para evitar que React 19 bloquee 'javascript:'
  useEffect(() => {
    if (bookmarkLinkRef.current) {
      bookmarkLinkRef.current.setAttribute('href', getBookmarkletHref());
    }
  }, [url, anonKey, ingestToken, email]);

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(getBookmarkletHref());
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 2500);
    } catch (err) {
      console.error('Error al copiar bookmarklet:', err);
    }
  };

  const handleCopyConsoleScript = async () => {
    try {
      await navigator.clipboard.writeText(getRawScriptCode());
      setCopiedConsole(true);
      setTimeout(() => setCopiedConsole(false), 2500);
    } catch (err) {
      console.error('Error al copiar script:', err);
    }
  };

  const handleProcessPaste = async () => {
    if (!pasteJson.trim()) return;
    setIsSubmittingPaste(true);
    setPasteResult(null);
    try {
      const parsed = JSON.parse(pasteJson);
      if (!parsed.i || !parsed.p) {
        throw new Error('El JSON pegado no contiene la estructura esperada {i, p, l}.');
      }
      const res = await onIngestData({
        info: parsed.i,
        produ: parsed.p,
        rel: parsed.l || []
      });
      setPasteResult({ ok: true, msg: `Carga exitosa: ${res}` });
      setPasteJson('');
    } catch (err) {
      setPasteResult({ ok: false, msg: `Error: ${err.message}` });
    } finally {
      setIsSubmittingPaste(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
      {/* 1. Configuración de Credenciales */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '24px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Shield size={18} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-bright)', textTransform: 'uppercase' }}>
            Credenciales de Conexión
          </h3>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Estos datos se guardan únicamente en el <code>localStorage</code> de tu navegador. Nunca se suben al repositorio.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
              SUPABASE URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tu-proyecto.supabase.co"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', borderRadius: '4px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
              SUPABASE ANON KEY
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="sb_publishable_..."
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', borderRadius: '4px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
              TOKEN DE CARGA (INGEST_TOKEN)
            </label>
            <input
              type="password"
              value={ingestToken}
              onChange={(e) => setIngestToken(e.target.value)}
              placeholder="Clave de ingestión para el bookmarklet"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', borderRadius: '4px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
              TOKEN DE VISTA (VIEW_TOKEN)
            </label>
            <input
              type="password"
              value={viewToken}
              onChange={(e) => setViewToken(e.target.value)}
              placeholder="Clave para leer el histórico"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', borderRadius: '4px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
              CORREO PULSO DEL SUPERVISOR
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@konecta.com"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', borderRadius: '4px' }}
              required
            />
          </div>

          <button
            type="submit"
            style={{
              marginTop: '10px',
              padding: '12px',
              background: savedSuccess ? 'var(--accent-success)' : 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '700',
              fontSize: '12px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {savedSuccess ? <Check size={16} /> : <Save size={16} />}
            {savedSuccess ? 'Configuración Guardada' : 'Guardar en LocalStorage'}
          </button>
        </form>
      </div>

      {/* 2. Bookmarklet y Métodos de Captura */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Métodos de Carga */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Bookmark size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-bright)', textTransform: 'uppercase' }}>
              Carga desde Pulso (2 Métodos)
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Elige el método que te resulte más cómodo para capturar las métricas de Pulso:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Método A: Marcador */}
            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-light)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Opción 1: Arrastrar a Marcadores
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                Arrastra este botón a tu barra de favoritos. Luego, haz clic en él cuando estés en Pulso.
              </p>
              <a
                ref={bookmarkLinkRef}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('¡Arrastra este botón a tu barra de marcadores del navegador!\n\n(O usa la Opción 2 de abajo si prefieres copiar el script).');
                }}
                draggable="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '12px 18px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontWeight: '800',
                  fontSize: '12px',
                  letterSpacing: '0.04em',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                  cursor: 'grab',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
                title="Arrastra este enlace a tu barra de marcadores"
              >
                📥 Cargar Pulso (Arrastrar a Marcadores)
              </a>
            </div>

            {/* Método B: Consola F12 (100% infalible) */}
            <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-success)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Opción 2: Copiar Script para Consola F12 (Más Directo)
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                Pulsa el botón, ve a Pulso, abre la consola con <code>F12</code>, pega con <code>Ctrl+V</code> y presiona <code>Enter</code>.
              </p>
              <button
                type="button"
                onClick={handleCopyConsoleScript}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: copiedConsole ? 'var(--accent-success)' : 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: copiedConsole ? '#ffffff' : 'var(--text-main)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {copiedConsole ? <Check size={16} /> : <Terminal size={16} color="var(--accent-success)" />}
                {copiedConsole ? '¡Script Copiado! Ve a Pulso > F12 > Consola y Pega' : 'Copiar Script para Consola (F12)'}
              </button>
            </div>

            {/* Copiar Bookmarklet como texto */}
            <button
              type="button"
              onClick={handleCopyBookmarklet}
              style={{
                padding: '8px',
                background: 'transparent',
                border: '1px dashed var(--border-light)',
                color: 'var(--text-dim)',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {copiedBookmarklet ? <Check size={12} color="var(--accent-success)" /> : <Copy size={12} />}
              {copiedBookmarklet ? 'URL del Marcador Copiada' : 'Copiar URL completa del Bookmarklet (para crear favorito manual)'}
            </button>
          </div>
        </div>

        {/* Plan B: Pegar Datos de Portapapeles */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <UploadCloud size={18} color="var(--accent-warning)" />
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-bright)', textTransform: 'uppercase' }}>
              Plan B: Pegar Datos (Contingencia CSP)
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Si la política de red de Pulso bloquea el envío directo a Supabase, el script copia el JSON automáticamente al portapapeles. Pégalo aquí:
          </p>

          <textarea
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            placeholder='Pega aquí el JSON {"i":{...}, "p":[...], "l":[...]}'
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-main)',
              fontSize: '11px',
              fontFamily: 'monospace',
              borderRadius: '4px',
              resize: 'vertical',
              marginBottom: '12px'
            }}
          />

          <button
            type="button"
            onClick={handleProcessPaste}
            disabled={!pasteJson.trim() || isSubmittingPaste}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: pasteJson.trim() ? 'var(--accent-warning)' : 'var(--bg-hover)',
              color: pasteJson.trim() ? '#000' : 'var(--text-dim)',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '800',
              fontSize: '11px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: pasteJson.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isSubmittingPaste ? 'Ingresando en Supabase...' : 'Enviar Datos Pegados a Supabase'}
          </button>

          {pasteResult && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                background: pasteResult.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: pasteResult.ok ? 'var(--accent-success)' : 'var(--accent-error)',
                border: `1px solid ${pasteResult.ok ? 'var(--accent-success)' : 'var(--accent-error)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {pasteResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{pasteResult.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
