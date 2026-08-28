import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

type TeamsMessagePayload = {
  target?: unknown;
  title?: unknown;
  text?: unknown;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const isAllowedWebhook = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".environment.api.powerplatform.com");
  } catch {
    return false;
  }
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
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser(accessToken);
    if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

    const { data: adminProfile, error: profileError } = await callerClient
      .from("sim_profiles")
      .select("user_id, display_name")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .eq("active", true)
      .eq("must_change_password", false)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!adminProfile) return json({ error: "Apenas perfis Adm podem enviar mensagens ao Teams." }, 403);

    const payload = await request.json() as TeamsMessagePayload;
    const target = String(payload.target ?? "").trim();
    const title = String(payload.title ?? "").trim();
    const text = String(payload.text ?? "").trim();
    if (!target) return json({ error: "Destinatário inválido." }, 400);
    if (!title || title.length > 160) return json({ error: "Título inválido." }, 400);
    if (text.length > 5000) return json({ error: "Mensagem muito longa." }, 400);

    let webhookKey = "all";
    let targetLabel = "Todos os usuários";
    if (target !== "todos" && !target.startsWith("group:")) {
      const { data: targetProfile, error: targetError } = await callerClient
        .from("sim_profiles")
        .select("login_id, display_name")
        .eq("user_id", target)
        .eq("active", true)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!targetProfile) return json({ error: "Usuário destinatário não encontrado." }, 404);
      webhookKey = String(targetProfile.login_id ?? "").trim().toUpperCase();
      targetLabel = targetProfile.display_name;
    } else if (target.startsWith("group:")) {
      targetLabel = `Grupo ${target.slice(6)}`;
    }

    const { data: webhookRoute, error: webhookError } = await adminClient
      .from("sim_teams_webhooks")
      .select("webhook_url")
      .eq("route_key", webhookKey)
      .maybeSingle();
    if (webhookError) throw webhookError;
    const webhookUrl = webhookRoute?.webhook_url;
    if (!webhookUrl) {
      return json({ error: "Este destinatário não possui webhook do Teams configurado." }, 422);
    }
    if (!isAllowedWebhook(webhookUrl)) throw new Error("Webhook do Teams inválido.");

    const sentAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const card = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        { type: "TextBlock", text: title, weight: "Bolder", size: "Medium", color: "Attention", wrap: true },
        ...(text ? [{ type: "TextBlock", text, wrap: true }] : []),
        { type: "TextBlock", text: `Enviado por ${adminProfile.display_name} • Para: ${targetLabel} • ${sentAt}`, wrap: true, isSubtle: true, spacing: "Small" },
      ],
    };

    const teamsResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(card),
      signal: AbortSignal.timeout(15000),
    });
    if (!teamsResponse.ok) {
      console.error("sim-teams-message", { target: webhookKey, status: teamsResponse.status });
      return json({ error: "O Workflow do Teams recusou a mensagem." }, 502);
    }

    return json({ sent: true, target: targetLabel, workflowStatus: teamsResponse.status });
  } catch (error) {
    console.error("sim-teams-message", error instanceof Error ? error.message : error);
    return json({ error: "Falha ao enviar a mensagem ao Teams." }, 500);
  }
});
