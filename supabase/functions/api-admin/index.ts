import { createClient } from "npm:@supabase/supabase-js@2";
import { apiBusinessActions, apiTableCatalog } from "../_shared/apiRuntimeContract.generated.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALL_SCOPES = [
  "schema.read", "data.read", "data.write", "data.delete", "actions.execute", "audit.read",
] as const;
type Scope = typeof ALL_SCOPES[number];

type Body = {
  action?: "list" | "create" | "revoke" | "contractSummary";
  name?: string;
  scopes?: string[];
  expiresAt?: string | null;
  id?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.slice("Bearer ".length);
  const { data: claimsData, error: claimsError } = await anon.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const callerId = String(claimsData.claims.sub);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles").select("role,is_active").eq("id", callerId).maybeSingle();
  if (!profile || profile.role !== "agency_admin" || profile.is_active !== true) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  if (body.action === "contractSummary") {
    const tables = (apiTableCatalog.tables as unknown[]) ?? [];
    const functions = (apiTableCatalog.functions as unknown[]) ?? [];
    const services = (apiBusinessActions.edgeFunctions as unknown[]) ?? [];
    return json({
      baseUrl: `${supabaseUrl}/functions/v1/external-api`,
      docsUrl: `${supabaseUrl}/functions/v1/external-api/docs`,
      openApiUrl: `${supabaseUrl}/functions/v1/external-api/openapi.json`,
      skillPackageUrl: `${supabaseUrl}/functions/v1/external-api/ai-skill-input.json`,
      tableCount: tables.length,
      functionCount: functions.length,
      serviceCount: services.length,
      scopes: ALL_SCOPES,
    });
  }

  if (body.action === "list") {
    const { data, error } = await admin.rpc("api_key_list");
    if (error) return json({ error: error.message }, 400);
    return json({ keys: data ?? [] });
  }

  if (body.action === "create") {
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 120) return json({ error: "Name must be 2-120 characters" }, 400);
    const scopes = Array.from(new Set(body.scopes ?? [])).filter((scope): scope is Scope => ALL_SCOPES.includes(scope as Scope));
    if (!scopes.includes("schema.read") || !scopes.includes("data.read")) {
      return json({ error: "Every key must include schema.read and data.read" }, 400);
    }
    if (scopes.length !== new Set(body.scopes ?? []).size) return json({ error: "Unknown scope" }, 400);

    let expiresAt: string | null = null;
    if (body.expiresAt) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        return json({ error: "Expiration must be in the future" }, 400);
      }
      expiresAt = parsed.toISOString();
    }

    const { data: existingKeys, error: listError } = await admin.rpc("api_key_list");
    if (listError) return json({ error: listError.message }, 400);
    const activeCount = (existingKeys ?? []).filter((row: any) => !row.revoked_at).length;
    if (activeCount >= 20) return json({ error: "Revoke an unused key before creating another one" }, 409);

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = base64Url(bytes);
    const prefix = `cts_live_${secret.slice(0, 10)}`;
    const rawKey = `${prefix}_${secret}`;
    const keyHash = await sha256(rawKey);
    const { data, error } = await admin.rpc("api_key_create", {
      p_name: name,
      p_key_prefix: prefix,
      p_key_hash: keyHash,
      p_scopes: scopes,
      p_created_by: callerId,
      p_expires_at: expiresAt,
    });
    if (error || !data?.[0]) return json({ error: error?.message ?? "Could not create key" }, 400);
    return json({ key: data[0], secret: rawKey, shownOnce: true }, 201);
  }

  if (body.action === "revoke") {
    if (!body.id) return json({ error: "Key id is required" }, 400);
    const { data, error } = await admin.rpc("api_key_revoke", { p_id: body.id, p_revoked_by: callerId });
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Key not found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
