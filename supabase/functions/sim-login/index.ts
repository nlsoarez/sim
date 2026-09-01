import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const invalidCredentials = () => json({ error: "Matrícula/e-mail ou senha inválidos." }, 400);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const body = await request.json();
    const identifier = String(body?.identifier ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!identifier || identifier.length > 160 || !password || password.length > 256) return invalidCredentials();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let email = identifier;
    if (/^[a-z]\d{6,7}$/.test(identifier)) {
      const { data: profile, error: profileError } = await adminClient
        .from("sim_profiles")
        .select("user_id")
        .eq("login_id", identifier.toUpperCase())
        .eq("active", true)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return invalidCredentials();

      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(profile.user_id);
      if (userError || !userData.user?.email) return invalidCredentials();
      email = userData.user.email;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      return invalidCredentials();
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });
    if (authError || !authData.session || !authData.user) return invalidCredentials();

    const { data: activeProfile, error: activeProfileError } = await adminClient
      .from("sim_profiles")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .eq("active", true)
      .maybeSingle();
    if (activeProfileError) throw activeProfileError;
    if (!activeProfile) {
      await authClient.auth.signOut({ scope: "local" });
      return invalidCredentials();
    }

    return json({
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    });
  } catch (error) {
    console.error("sim-login", error);
    return json({ error: "Não foi possível autenticar agora. Tente novamente." }, 500);
  }
});
