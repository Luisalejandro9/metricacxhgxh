import { supabase, DIRECT_SUPABASE_URL } from './supabase';

const REPORT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos de espera mínima por navegador

/**
 * Centinela Pasivo de Incidentes:
 * Se ejecuta de manera completamente anónima y discreta.
 * NO envía IPs, NO envía nombres de usuario, NO envía identificadores de computadora.
 * Solo envía un reporte si detecta que la red local bloqueó la resolución directa de Supabase
 * pero el proxy de Netlify logró salvar la conexión con éxito.
 */
export async function runPassiveSentinelCheck() {
  // Evitar reportes repetidos en una misma sesión (máximo 1 reporte cada 15 min)
  try {
    const lastReport = sessionStorage.getItem('last_sentinel_report');
    if (lastReport && Date.now() - parseInt(lastReport, 10) < REPORT_COOLDOWN_MS) {
      return;
    }
  } catch {
    // Continuar si sessionStorage no está disponible
  }

  try {
    // 1. Probar conexión directa con timeout corto de 2.5s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    let isDirectBlocked = false;
    try {
      await fetch(`${DIRECT_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
    } catch {
      clearTimeout(timeoutId);
      isDirectBlocked = true;
    }

    // Si la conexión directa funcionó normal (ej: en casa con internet abierto), no hacemos nada
    if (!isDirectBlocked) {
      return;
    }

    // 2. Si la directa falló, verificar si el proxy de Netlify sí está respondiendo
    const { error: proxyError } = await supabase
      .from('network_incidents')
      .select('id', { count: 'exact', head: true });

    // Si el proxy sí funciona mientras la directa falló, estamos en presencia de un bloqueo de Konecta mitigado
    if (!proxyError) {
      // Registrar log técnico 100% anónimo
      await supabase.from('network_incidents').insert([
        {
          event_type: 'dns_block_mitigated',
          details: 'Bloqueo DNS detectado en la red local. Tráfico canalizado exitosamente por el proxy de Netlify.',
        },
      ]);

      try {
        sessionStorage.setItem('last_sentinel_report', Date.now().toString());
      } catch {}
    }
  } catch {
    // Silencioso ante cualquier eventualidad
  }
}

/**
 * Recupera los incidentes registrados en las últimas 24 horas (usado en /status)
 */
export async function fetchRecentIncidents() {
  try {
    const sinceTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('network_incidents')
      .select('*')
      .gte('created_at', sinceTime)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Limpia el historial de incidentes
 */
export async function clearAllIncidents() {
  try {
    const { error } = await supabase
      .from('network_incidents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    return !error;
  } catch {
    return false;
  }
}
