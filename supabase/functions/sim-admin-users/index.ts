import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

type AdminUserPayload = {
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

const findAuthUserByEmail = async (adminClient: ReturnType<typeof createClient>, email: string) => {
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users ?? [];
    const match = users.find((user) => String(user.email ?? "").trim().toLowerCase() === email);
    if (match) return match;
    if (users.length < perPage) return null;
  }
  throw new Error("Limite de paginação atingido ao localizar usuário existente.");
};

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
      .eq("must_change_password", false)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!adminProfile) return json({ error: "Apenas perfis Adm podem gerenciar usuários." }, 403);

    const payload = await request.json() as AdminUserPayload;
    const action = String(payload.action ?? "create");
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "delete") {
      const userId = String(payload.userId ?? "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return json({ error: "Usuário inválido." }, 400);
      }
      if (userId === authData.user.id) {
        return json({ error: "Você não pode excluir a própria conta." }, 409);
      }

      const { data: targetProfile, error: targetError } = await adminClient
        .from("sim_profiles")
        .select("user_id, display_name, role, active")
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!targetProfile) return json({ error: "Usuário ativo não encontrado." }, 404);

      if (targetProfile.role === "admin") {
        const { count, error: countError } = await adminClient
          .from("sim_profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("active", true);
        if (countError) throw countError;
        if ((count ?? 0) <= 1) {
          return json({ error: "O último perfil Adm ativo não pode ser excluído." }, 409);
        }
      }

      const { data: deactivated, error: deactivateError } = await adminClient
        .from("sim_profiles")
        .update({ active: false, role: "user", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("active", true)
        .select("user_id, display_name, role, group_id, active, must_change_password")
        .maybeSingle();
      if (deactivateError) throw deactivateError;
      if (!deactivated) return json({ error: "Usuário ativo não encontrado." }, 404);
      return json({ user: deactivated });
    }

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
        .select("user_id, display_name, role, group_id, active, must_change_password")
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
    if (password !== "claro123" && password.length < 6) {
      return json({ error: "Use a senha padrão claro123 ou uma senha inicial com pelo menos 6 caracteres." }, 400);
    }
    if (!displayName || displayName.length > 120) return json({ error: "Nome inválido." }, 400);
    if (!['admin', 'user'].includes(role)) return json({ error: "Perfil de acesso inválido." }, 400);
    if (!groupId || groupId.length > 80) return json({ error: "Grupo inválido." }, 400);

    const existingAuthUser = await findAuthUserByEmail(adminClient, email);
    if (existingAuthUser) {
      const { data: existingProfile, error: existingProfileError } = await adminClient
        .from("sim_profiles")
        .select("user_id, active")
        .eq("user_id", existingAuthUser.id)
        .maybeSingle();
      if (existingProfileError) throw existingProfileError;
      if (!existingProfile) {
        return json({ error: "Este e-mail já possui uma conta de autenticação sem perfil no SIM. Procure o suporte." }, 409);
      }
      if (existingProfile.active) {
        return json({ error: "Já existe um usuário ativo com este e-mail." }, 409);
      }

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (authUpdateError) return json({ error: "Não foi possível redefinir a conta existente." }, 400);

      const { data: reactivated, error: reactivateError } = await adminClient
        .from("sim_profiles")
        .update({
          display_name: displayName,
          role,
          group_id: groupId,
          active: true,
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", existingAuthUser.id)
        .eq("active", false)
        .select("user_id, display_name, role, group_id, active, must_change_password")
        .maybeSingle();
      if (reactivateError) throw reactivateError;
      if (!reactivated) return json({ error: "O usuário mudou enquanto era reativado. Atualize a página e tente novamente." }, 409);
      return json({ user: reactivated, reactivated: true });
    }

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
      must_change_password: true,
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
        must_change_password: true,
      },
    }, 201);
  } catch (error) {
    console.error("sim-admin-users", error);
    return json({ error: "Falha interna ao gerenciar usuário." }, 500);
  }
});
