import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-status-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_PASSWORD_SHA256 = "5f867baaf8b90b6a97373444874e42cadb35f925e8d29f4ccfcec06ace595410";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const suppliedPassword = req.headers.get("x-status-password") || "";
    if (!suppliedPassword || await sha256(suppliedPassword) !== STATUS_PASSWORD_SHA256) {
      return json({ error: "Contraseña incorrecta o sesión de diagnóstico inválida." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
      return json({ error: "La función segura no tiene configuradas las credenciales internas." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tableNames = [
      ["daily_metrics", "Métricas Diarias"],
      ["profiles", "Perfiles / Usuarios"],
      ["app_config", "Configuración Global"],
      ["network_incidents", "Centinela de Red"],
    ] as const;

    const tableResults = await Promise.all(tableNames.map(async ([table]) => {
      const started = performance.now();
      const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
      return [table, error
        ? { error: error.message, durationMs: Math.round(performance.now() - started) }
        : { count: count ?? 0, durationMs: Math.round(performance.now() - started) }] as const;
    }));

    const { data: usage, error: usageError } = await admin.rpc("get_database_usage");
    if (usageError) {
      console.error("get_database_usage:", usageError);
      return json({ tables: Object.fromEntries(tableResults), error: "No se pudo consultar el consumo: " + usageError.message }, 500);
    }

    return json({ tables: Object.fromEntries(tableResults), usage });
  } catch (error) {
    console.error("status-diagnostics:", error);
    return json({ error: error instanceof Error ? error.message : "Error interno del diagnóstico." }, 500);
  }
});
