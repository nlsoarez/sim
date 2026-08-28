import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

type AdminActionPayload = {
  action?: unknown;
  documentId?: unknown;
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
      .eq("must_change_password", false)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!adminProfile) return json({ error: "Apenas perfis Adm podem executar esta ação." }, 403);

    const payload = await request.json() as AdminActionPayload;
    if (String(payload.action ?? "") !== "delete_document") {
      return json({ error: "Ação inválida." }, 400);
    }

    const documentId = String(payload.documentId ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
      return json({ error: "Documento inválido." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: document, error: documentError } = await adminClient
      .from("sim_documents")
      .select("id, storage_path")
      .eq("id", documentId)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return json({ error: "Documento não encontrado." }, 404);

    const { error: storageError } = await adminClient.storage
      .from("sim-documents")
      .remove([document.storage_path]);
    if (storageError) return json({ error: "Não foi possível excluir o arquivo armazenado." }, 502);

    const { error: metadataError } = await adminClient
      .from("sim_documents")
      .delete()
      .eq("id", documentId);
    if (metadataError) {
      console.error("document metadata delete failed after storage removal", metadataError);
      return json({ error: "O arquivo foi removido, mas a referência não pôde ser excluída." }, 500);
    }

    return json({ deleted: true, documentId });
  } catch (error) {
    console.error("sim-admin-actions", error);
    return json({ error: "Falha interna ao executar a ação administrativa." }, 500);
  }
});
