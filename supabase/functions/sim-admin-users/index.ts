import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

type CreateUserPayload = {
  action?: unknown;
  userId?: unknown;
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  role?: unknown;
  groupId?: unknown;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Autenticação obrigatória." }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accessToken = authorization.slice("Bearer ".length);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser(accessToken);
    if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

    const { data: adminProfile, error: profileError } = await callerClient
      .from("sim_profiles")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .eq("active", true)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!adminProfile) return json({ error: "Apenas administradores podem criar usuários." }, 403);

    const payload = await request.json() as CreateUserPayload;
    const action = String(payload.action ?? "create");
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "approve") {
      const userId = String(payload.userId ?? "");
      const groupId = String(payload.groupId ?? "residencial").trim().toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return json({ error: "Solicitação inválida." }, 400);
      }
      if (!groupId || groupId.length > 80) return json({ error: "Grupo inválido." }, 400);

      const { error: confirmationError } = await adminClient.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      if (confirmationError) return json({ error: "Não foi possível validar o e-mail desta solicitação." }, 400);

      const { data: approved, error: approveError } = await adminClient
        .from("sim_profiles")
        .update({ active: true, role: "user", group_id: groupId, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("active", false)
        .select("user_id, display_name, role, group_id, active")
        .maybeSingle();
      if (approveError) throw approveError;
      if (!approved) return json({ error: "Solicitação pendente não encontrada." }, 404);

      const { error: reviewError } = await adminClient
        .from("sim_registration_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: authData.user.id })
        .eq("user_id", userId);
      if (reviewError) throw reviewError;

      return json({ user: approved });
    }

    if (action !== "create") return json({ error: "Ação inválida." }, 400);

    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");
    const displayName = String(payload.displayName ?? "").trim();
    const role = String(payload.role ?? "user");
    const groupId = String(payload.groupId ?? "residencial").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
    if (password.length < 12) return json({ error: "A senha inicial deve ter pelo menos 12 caracteres." }, 400);
    if (!displayName || displayName.length > 120) return json({ error: "Nome inválido." }, 400);
    if (!['admin', 'user'].includes(role)) return json({ error: "Perfil de acesso inválido." }, 400);
    if (!groupId || groupId.length > 80) return json({ error: "Grupo inválido." }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (createError || !created.user) {
      const status = createError?.message?.toLowerCase().includes("already") ? 409 : 400;
      return json({ error: createError?.message ?? "Não foi possível criar o usuário." }, status);
    }

    const { error: insertError } = await adminClient.from("sim_profiles").upsert({
      user_id: created.user.id,
      display_name: displayName,
      role,
      group_id: groupId,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw insertError;
    }

    const { error: reviewError } = await adminClient
      .from("sim_registration_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: authData.user.id })
      .eq("user_id", created.user.id);
    if (reviewError) throw reviewError;

    return json({
      user: {
        user_id: created.user.id,
        display_name: displayName,
        role,
        group_id: groupId,
        active: true,
      },
    }, 201);
  } catch (error) {
    console.error("sim-admin-users", error);
    return json({ error: "Falha interna ao criar usuário." }, 500);
  }
});
