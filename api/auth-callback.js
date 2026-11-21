/**
 * Vercel Serverless Function: Auth Callback Proxy
 * 
 * Permite resolver el callback OAuth de Supabase en entornos corporativos (como Konecta)
 * donde el dominio *.supabase.co está bloqueado por DNS o firewall.
 * 
 * Esta función corre en los servidores de Vercel (fuera de la red de Konecta),
 * recibe el código de autorización de Supabase, realiza el intercambio de tokens con Supabase
 * y redirige al usuario de vuelta a la aplicación con el token en el hash o cookies.
 */

export default async function handler(req, res) {
  try {
    const rawUrl = req.query.callbackUrl || req.query.url;
    let targetUrl;

    if (rawUrl) {
      // Si el usuario pasó la URL completa de Supabase (ej: https://oyhlhdlubralrgjbgtqw.supabase.co/auth/v1/callback?code=...)
      try {
        const parsed = new URL(rawUrl);
        targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co${parsed.pathname}${parsed.search}`;
      } catch {
        targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co/auth/v1/callback?${rawUrl}`;
      }
    } else {
      // Si se pasaron los parámetros directamente en la query (code, state, etc.)
      const queryParams = new URLSearchParams(req.query);
      queryParams.delete('callbackUrl');
      queryParams.delete('url');
      targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co/auth/v1/callback?${queryParams.toString()}`;
    }

    // Realizar la petición directamente a Supabase desde los servidores de Vercel
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Vercel-Supabase-Auth-Bypass/1.0'
      }
    });

    const location = response.headers.get('location');

    if (location) {
      // Redirigir al cliente a la ubicación indicada por Supabase (generalmente /#access_token=...)
      // Si la URL apunta a otro dominio configurado, adaptamos al host actual para consistencia
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const currentOrigin = `${proto}://${host}`;

      let clientRedirect = location;
      try {
        const locUrl = new URL(location);
        // Si redirige a metricas-medidor.vercel.app o supabase redirect, usar el host actual
        clientRedirect = `${currentOrigin}${locUrl.pathname}${locUrl.search}${locUrl.hash}`;
      } catch {
        // En caso de ruta relativa
        if (location.startsWith('/')) {
          clientRedirect = `${currentOrigin}${location}`;
        }
      }

      res.writeHead(302, { Location: clientRedirect });
      return res.end();
    }

    // Si Supabase devolvió cuerpo o error
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err) {
    console.error('Error en auth-callback bypass:', err);
    res.status(500).json({ error: 'Error al procesar el callback de Supabase', details: err.message });
  }
}
