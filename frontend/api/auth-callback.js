/**
 * Vercel Serverless Function: Auth Callback Proxy (Frontend subfolder fallback)
 */

export default async function handler(req, res) {
  try {
    const rawUrl = req.query.callbackUrl || req.query.url;
    let targetUrl;

    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co${parsed.pathname}${parsed.search}`;
      } catch {
        targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co/auth/v1/callback?${rawUrl}`;
      }
    } else {
      const queryParams = new URLSearchParams(req.query);
      queryParams.delete('callbackUrl');
      queryParams.delete('url');
      targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co/auth/v1/callback?${queryParams.toString()}`;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Vercel-Supabase-Auth-Bypass/1.0'
      }
    });

    const location = response.headers.get('location');

    if (location) {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const currentOrigin = `${proto}://${host}`;

      let clientRedirect = location;
      try {
        const locUrl = new URL(location);
        clientRedirect = `${currentOrigin}${locUrl.pathname}${locUrl.search}${locUrl.hash}`;
      } catch {
        if (location.startsWith('/')) {
          clientRedirect = `${currentOrigin}${location}`;
        }
      }

      res.writeHead(302, { Location: clientRedirect });
      return res.end();
    }

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err) {
    console.error('Error en auth-callback bypass:', err);
    res.status(500).json({ error: 'Error al procesar el callback de Supabase', details: err.message });
  }
}
