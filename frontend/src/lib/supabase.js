import { createClient } from '@supabase/supabase-js';

export const DIRECT_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://oyhlhdlubralrgjbgtqw.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_8493GeAz4c4Iw_4byE16Mg_RHAS4jtw';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Advertencia: Usando credenciales base de Supabase para contingencia.');
}

/**
 * Obtiene la URL efectiva de Supabase.
 * En el navegador (en producción en Netlify o en desarrollo local con Vite),
 * se utiliza el proxy inverso '/supabase' alojado en el mismo dominio.
 * De esta forma, la red corporativa de Konecta jamás consulta el DNS de supabase.co,
 * evitando cualquier bloqueo por DNS o firewall corporativo de forma 100% gratuita.
 */
export function getEffectiveSupabaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
    return `${window.location.origin}/supabase`;
  }
  return DIRECT_SUPABASE_URL;
}

/**
 * Helper para URLs de imágenes y assets almacenados en Supabase Storage.
 * Si una URL proviene de supabase.co, la transforma para usar el proxy del dominio actual,
 * garantizando que los assets carguen siempre incluso bajo bloqueo DNS en la red corporativa.
 */
export function getSafeMediaUrl(url) {
  if (!url) return '';
  if (url.includes('oyhlhdlubralrgjbgtqw.supabase.co')) {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
      return url.replace('https://oyhlhdlubralrgjbgtqw.supabase.co', `${window.location.origin}/supabase`);
    }
  }
  return url;
}

/**
 * Fetch con tolerancia a fallos:
 * 1. Intenta conectarse a través del proxy inverso local (/supabase/...).
 * 2. Si el proxy llegase a no responder (o en un entorno sin proxy),
 *    automáticamente reintenta de forma transparente hacia la URL directa de Supabase.
 */
const resilientFetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();

  try {
    const res = await fetch(input, init);
    // Si el proxy local devolviera 404 o 502/504, intentar URL directa
    if (!res.ok && (res.status === 404 || res.status >= 500) && urlStr.includes('/supabase')) {
      const fallbackUrl = urlStr.replace(/https?:\/\/[^/]+\/supabase/, DIRECT_SUPABASE_URL);
      try {
        return await fetch(fallbackUrl, init);
      } catch {
        return res;
      }
    }
    return res;
  } catch (primaryErr) {
    // Si hubo falla de red hacia el proxy, probar fallback directo
    if (urlStr.includes('/supabase')) {
      try {
        const fallbackUrl = urlStr.replace(/https?:\/\/[^/]+\/supabase/, DIRECT_SUPABASE_URL);
        return await fetch(fallbackUrl, init);
      } catch {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
};

export const supabase = createClient(
  getEffectiveSupabaseUrl(),
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: 'metrica-cx-auth',
      storage: window.localStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: resilientFetch
    }
  }
);
