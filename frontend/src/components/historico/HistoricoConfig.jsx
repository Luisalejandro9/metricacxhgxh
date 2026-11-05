import React, { useState, useEffect, useRef } from 'react';
import { Save, Copy, Check, Bookmark, UploadCloud, AlertTriangle, Shield, CheckCircle2 } from 'lucide-react';

export default function HistoricoConfig({ config, onSaveConfig, onIngestData }) {
  const [url, setUrl] = useState(config.supabaseUrl || '');
  const [anonKey, setAnonKey] = useState(config.anonKey || '');
  const [ingestToken, setIngestToken] = useState(config.ingestToken || '');
  const [viewToken, setViewToken] = useState(config.viewToken || '');
  const [email, setEmail] = useState(config.pulsoEmail || 'luis.acosta@konecta.com');

  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const bookmarkLinkRef = useRef(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pasteJson, setPasteJson] = useState('');
  const [isSubmittingPaste, setIsSubmittingPaste] = useState(false);
  const [pasteResult, setPasteResult] = useState(null);


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

  // Script auxiliar: obtiene los datos de Pulso y copia únicamente el JSON estructurado para el Plan B.
  // No envía información directamente a Supabase.
  const getCopyDataScript = () => {
    const e = email.trim();
    return `(async()=> {
  const g = p => fetch('/api/api/'+p, {credentials:'include', cache:'no-store'})
    .then(r => { if(!r.ok) throw new Error(p+' '+r.status); return r.json(); });
  try {
    const rawI = await g('produDiaria/obtenerUltimoIntervalo'),
          i = Array.isArray(rawI) ? rawI[0] : rawI,
          p = await g('produDiariaPorEquipo?email='+encodeURIComponent(${JSON.stringify(e)})),
          l = await g('getRelDiaria?mail='+encodeURIComponent(${JSON.stringify(e)})).catch(()=>[]);
    const d = {i,p,l};
    await navigator.clipboard.writeText(JSON.stringify(d));
    alert('Datos copiados en formato JSON. Volvé a Métrica CXH y pegá el contenido en Plan B.');
  } catch(e) {
    alert('No se pudieron copiar los datos de Pulso: '+e.message);
  }
})()`;
  };

  const getBookmarkletHref = () => `javascript:${encodeURIComponent(getCopyDataScript())}`;

  useEffect(() => {
    if (bookmarkLinkRef.current) {
      bookmarkLinkRef.current.setAttribute('href', getBookmarkletHref());
    }
  }, [email]);

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(getBookmarkletHref());
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 2500);
    } catch (err) {
      console.error('Error al copiar bookmarklet:', err);
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
              TOKEN DE VISTA (VIEW_TOKEN) <span style={{ fontWeight: 'normal', color: 'var(--accent-success)' }}>- Opcional (Lectura automática en la app)</span>
            </label>
            <input
              type="password"
              value={viewToken}
              onChange={(e) => setViewToken(e.target.value)}
              placeholder="Opcional. Los usuarios de la app leen automáticamente."
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', borderRadius: '4px' }}
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

      {/* 2. Marcador para obtener datos y flujo de Plan B */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Bookmark size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-bright)', textTransform: 'uppercase' }}>
              Obtener datos de Pulso
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Arrastrá este marcador a la barra de favoritos. Luego, estando en Pulso, hacé clic en él: consultará los datos y copiará el JSON con estructura { '{' }i, p, l{ '}' } al portapapeles. No los envía a Supabase. Volvé a Métrica CXH y pegá el contenido en el Plan B.
          </p>
          <a
            ref={bookmarkLinkRef}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('Arrastrá este marcador a la barra de favoritos del navegador. Luego abrí Pulso y hacé clic en el marcador para copiar los datos.');
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
              cursor: 'grab',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
            title="Arrastrá este enlace a tu barra de favoritos"
          >
            📋 Obtener datos de Pulso (arrastrar a favoritos)
          </a>
          <button
            type="button"
            onClick={handleCopyBookmarklet}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '9px',
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
            {copiedBookmarklet ? 'URL del marcador copiada' : 'Copiar URL del marcador'}
          </button>
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
