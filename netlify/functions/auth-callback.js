/**
 * Netlify Function: Auth Callback Proxy
 * 
 * Permite resolver el callback OAuth de Supabase en entornos corporativos (como Konecta)
 * donde el dominio *.supabase.co está bloqueado por DNS o firewall.
 */

export const handler = async (event) => {
  try {
    const query = event.queryStringParameters || {};
    const rawUrl = query.callbackUrl || query.url;
    let targetUrl;

    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co${parsed.pathname}${parsed.search}`;
      } catch {
        targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co/auth/v1/callback?${rawUrl}`;
      }
    } else {
      const queryParams = new URLSearchParams(query);
      queryParams.delete('callbackUrl');
      queryParams.delete('url');
      targetUrl = `https://oyhlhdlubralrgjbgtqw.supabase.co/auth/v1/callback?${queryParams.toString()}`;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Netlify-Supabase-Auth-Bypass/1.0'
      }
    });

    const location = response.headers.get('location');

    if (location) {
      const host = event.headers['x-forwarded-host'] || event.headers.host || 'metricascxhgxh.netlify.app';
      const proto = event.headers['x-forwarded-proto'] || 'https';
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

      return {
        statusCode: 302,
        headers: {
          Location: clientRedirect,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: ''
      };
    }

    const data = await response.text();
    return {
      statusCode: response.status,
      body: data
    };
  } catch (err) {
    console.error('Error en Netlify auth-callback bypass:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al procesar el callback de Supabase', details: err.message })
    };
  }
};
