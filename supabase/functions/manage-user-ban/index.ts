import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROOT_ADMINS = new Map([
  ["1e9fa2df-d9be-43b1-9141-ab78edbd0442", "luis.acosta@konecta.com"],
  ["921703ad-c1fe-4641-a728-548bf6c6a220", "lacosta161999@gmail.com"],
]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Falta configuración segura de Supabase en la función." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Debes iniciar sesión." }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Sesión inválida o expirada." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const actorId = authData.user.id;
    const { data: actor, error: actorError } = await adminClient
      .from("profiles")
      .select("id,email,role,is_enabled")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError) throw actorError;
    if (!actor || actor.role !== "admin" || actor.is_enabled !== true) {
      return json({ error: "Solo un administrador habilitado puede gestionar baneos." }, 403);
    }

    const { targetUserId, banned } = await req.json();
    if (typeof targetUserId !== "string" || typeof banned !== "boolean") {
      return json({ error: "Parámetros inválidos." }, 400);
    }
    if (targetUserId === actorId) {
      return json({ error: "No puedes banear ni desbanear tu propia cuenta." }, 403);
    }
    if (ROOT_ADMINS.has(targetUserId)) {
      return json({ error: "Las cuentas de administrador total están protegidas." }, 403);
    }

    const actorEmail = String(actor.email || "").trim().toLowerCase();
    const isSuperAdmin = ROOT_ADMINS.get(actorId) === actorEmail;

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id,email,role,is_enabled")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) return json({ error: "El perfil seleccionado no existe." }, 404);
    if (target.role === "admin" && !isSuperAdmin) {
      return json({ error: "Solo los administradores totales pueden banear o desbanear a otro administrador." }, 403);
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { ban_duration: banned ? "876000h" : "none" },
    );
    if (authUpdateError) throw authUpdateError;

    const { data: updatedProfile, error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ is_enabled: !banned })
      .eq("id", targetUserId)
      .select("id,email,role,is_enabled")
      .single();

    if (profileUpdateError) {
      await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: banned ? "none" : "876000h",
      });
      throw profileUpdateError;
    }

    return json({
      success: true,
      banned,
      profile: updatedProfile,
      message: banned ? "Usuario baneado." : "Usuario rehabilitado.",
    });
  } catch (error) {
    console.error("manage-user-ban:", error);
    return json({ error: error?.message || "No se pudo actualizar el baneo." }, 500);
  }
});
