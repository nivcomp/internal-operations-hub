import { createClient } from "npm:@supabase/supabase-js@2";
import {
  apiBusinessActions, apiOpenApi, apiPermissions, apiSkillInput, apiTableCatalog,
} from "../_shared/apiRuntimeContract.generated.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, x-user-access-token, x-confirm-delete, idempotency-key, if-match, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "ETag, X-Request-Id, Retry-After",
};

type ApiClient = { id: string; name: string; key_prefix: string; scopes: string[]; created_at: string; last_used_at: string | null; expires_at: string | null };
type TableShape = {
  name: string;
  row: Record<string, { type: string; required: boolean }>;
  insert: Record<string, { type: string; required: boolean }>;
  update: Record<string, { type: string; required: boolean }>;
  relationships: unknown[];
};
type TablePolicy = { table: string; domain: string; dataClass: string; mutationMode: string; deleteMode: string; agency_admin: string[] };

const tables = (apiTableCatalog.tables as TableShape[]) ?? [];
const tableByName = new Map(tables.map((table) => [table.name, table]));
const policies = (apiPermissions.tablePolicies as TablePolicy[]) ?? [];
const policyByTable = new Map(policies.map((policy) => [policy.table, policy]));
const services = (apiBusinessActions.edgeFunctions as Array<{ service: string; actions: string[] }>) ?? [];
const serviceByName = new Map(services.map((service) => [service.service, service]));
const rateWindow = new Map<string, { minute: number; count: number }>();

function response(body: unknown, status: number, requestId: string, headers: HeadersInit = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": requestId, ...headers },
  });
}

function errorResponse(code: string, message: string, status: number, requestId: string, retryable = false, details: unknown = null) {
  return response({ error: { code, message, details, requestId, retryable } }, status, requestId);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeCursor(offset: number) {
  return btoa(JSON.stringify({ offset })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeCursor(value: string | null) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/")));
    return Number.isInteger(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
  } catch { return 0; }
}

function etagFor(record: unknown) {
  return sha256(JSON.stringify(record)).then((hash) => `"${hash}"`);
}

function effectiveCapabilities(client: ApiClient, policy: TablePolicy) {
  const capabilities: string[] = [];
  if (client.scopes.includes("data.read")) capabilities.push("read");
  if (client.scopes.includes("data.write") && policy.mutationMode === "direct_crud_with_policy") capabilities.push("create", "update");
  if (client.scopes.includes("data.write") && policy.mutationMode === "append_only") capabilities.push("create");
  if (client.scopes.includes("data.delete") && policy.deleteMode === "guarded_admin_delete") capabilities.push("delete");
  return capabilities;
}

function checkRate(clientId: string) {
  const minute = Math.floor(Date.now() / 60_000);
  const current = rateWindow.get(clientId);
  if (!current || current.minute !== minute) {
    rateWindow.set(clientId, { minute, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 120;
}

function docsHtml(baseUrl: string) {
  const safe = baseUrl.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Client-to-Scope API</title><style>body{font-family:Arial,sans-serif;margin:0;background:#f3f6f4;color:#10251d}.wrap{max-width:960px;margin:auto;padding:40px 22px}.hero,.card{background:white;border:1px solid #d9e3dd;border-radius:18px;padding:24px;margin-bottom:18px;box-shadow:0 8px 30px #0b2e2012}h1{font-size:2.2rem;margin:.2rem 0}code,pre{direction:ltr;text-align:left;background:#edf3ef;border-radius:8px;padding:3px 7px}pre{padding:16px;overflow:auto}a{color:#006c4e}.pill{display:inline-block;background:#dff4e9;border-radius:999px;padding:5px 10px;margin:4px}.warn{border-right:4px solid #b87900}</style></head><body><main class="wrap"><section class="hero"><small>Client-to-Scope AI</small><h1>מסמכי API</h1><p>API מאובטח לקריאה, כתיבה, עריכה, מחיקה מבוקרת ופעולות עסקיות.</p><p><span class="pill">82 טבלאות</span><span class="pill">OpenAPI 3.1</span><span class="pill">Audit מלא</span></p></section><section class="card"><h2>חיבור</h2><p>כתובת בסיס:</p><pre>${safe}</pre><p>העבירו את המפתח בכותרת <code>X-API-Key</code>. את המפתח המלא יוצרים ורואים פעם אחת במסך API ואינטגרציות במערכת.</p><pre>curl -H "X-API-Key: $API_KEY" "${safe}/v1/me"</pre></section><section class="card"><h2>הורדות</h2><p><a href="${safe}/openapi.json">OpenAPI JSON</a> · <a href="${safe}/ai-skill-input.json">חבילה מלאה ליצירת AI Skill</a></p></section><section class="card warn"><h2>פעולות מסוכנות</h2><p>מחיקה דורשת scope מתאים, ETag, מפתח idempotency, סיבה והכותרת <code>X-Confirm-Delete: DELETE</code>. אישורים, תשלומים, חתימות והיסטוריה אינם נמחקים ישירות.</p></section><section class="card"><h2>מסלולים מרכזיים</h2><pre>GET /v1/me<br>GET /v1/schema/tables<br>GET /v1/data/{table}<br>POST /v1/data/{table}<br>GET /v1/data/{table}/{id}<br>PATCH /v1/data/{table}/{id}<br>DELETE /v1/data/{table}/{id}<br>POST /v1/actions/{service}/{action}<br>GET /v1/audit-events</pre></section></main></body></html>`;
}

function applyFilter(query: any, node: any, table: TableShape): any {
  if (!node) return query;
  if (Array.isArray(node.and)) return node.and.reduce((next: any, child: any) => applyFilter(next, child, table), query);
  if (node.or) throw new Error("OR filters are not enabled; use AND filters or separate requests");
  const field = String(node.field ?? "");
  const op = String(node.op ?? "");
  if (!table.row[field]) throw new Error(`Unknown filter field: ${field}`);
  const value = node.value;
  if (op === "eq") return query.eq(field, value);
  if (op === "neq") return query.neq(field, value);
  if (op === "gt") return query.gt(field, value);
  if (op === "gte") return query.gte(field, value);
  if (op === "lt") return query.lt(field, value);
  if (op === "lte") return query.lte(field, value);
  if (op === "is" && (value === null || typeof value === "boolean")) return query.is(field, value);
  if (op === "in" && Array.isArray(value) && value.length <= 100) return query.in(field, value);
  if (op === "like" && typeof value === "string") return query.like(field, value);
  if (op === "ilike" && typeof value === "string") return query.ilike(field, value);
  if (op === "contains") return query.contains(field, value);
  throw new Error(`Unsupported filter operator: ${op}`);
}

function validateWrite(body: unknown, shape: Record<string, unknown>) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Body must be a JSON object");
  const unknown = Object.keys(body).filter((key) => !shape[key]);
  if (unknown.length) throw new Error(`Unknown or immutable fields: ${unknown.join(", ")}`);
  return body as Record<string, unknown>;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const marker = "/external-api";
  const markerIndex = url.pathname.indexOf(marker);
  const path = markerIndex >= 0 ? (url.pathname.slice(markerIndex + marker.length) || "/") : url.pathname;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (req.method === "GET" && path === "/docs") return new Response(docsHtml(`${supabaseUrl}/functions/v1/external-api`), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
  if (req.method === "GET" && path === "/openapi.json") return response(apiOpenApi, 200, requestId);
  if (req.method === "GET" && path === "/ai-skill-input.json") return response(apiSkillInput, 200, requestId);

  const rawKey = req.headers.get("X-API-Key")?.trim() ?? "";
  if (!rawKey.startsWith("cts_live_") || rawKey.length < 50) return errorResponse("UNAUTHORIZED", "A valid X-API-Key is required", 401, requestId);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: authenticated, error: authError } = await admin.rpc("api_key_authenticate", { p_key_hash: await sha256(rawKey) });
  const client = authenticated?.[0] as ApiClient | undefined;
  if (authError || !client) return errorResponse("UNAUTHORIZED", "API key is invalid, expired, or revoked", 401, requestId);
  if (!checkRate(client.id)) {
    await admin.rpc("api_audit_append", { p_api_client_id: client.id, p_request_id: requestId, p_operation: "rate_limit", p_http_status: 429 });
    return response({ error: { code: "RATE_LIMITED", message: "Too many requests", requestId, retryable: true } }, 429, requestId, { "Retry-After": "60" });
  }

  const audit = async (operation: string, status: number, tableName?: string, recordId?: string, reason = "", detail: Record<string, unknown> = {}) => {
    const { data } = await admin.rpc("api_audit_append", {
      p_api_client_id: client.id, p_request_id: requestId, p_operation: operation, p_http_status: status,
      p_table_name: tableName ?? null, p_record_id: recordId ?? null, p_reason: reason, p_detail: detail,
    });
    return data as string | null;
  };
  const requireScope = async (scope: string) => {
    if (client.scopes.includes(scope)) return null;
    await audit(`scope_denied:${scope}`, 403);
    return errorResponse("FORBIDDEN", `Missing required scope: ${scope}`, 403, requestId);
  };

  if (req.method === "GET" && path === "/v1/me") {
    const denied = await requireScope("data.read"); if (denied) return denied;
    const auditEventId = await audit("identity.read", 200);
    return response({ integrationId: client.id, name: client.name, keyPrefix: client.key_prefix, applicationRole: "agency_admin", scopes: client.scopes, createdAt: client.created_at, lastUsedAt: client.last_used_at, expiresAt: client.expires_at, auditEventId }, 200, requestId);
  }

  if (req.method === "GET" && path === "/v1/schema/tables") {
    const denied = await requireScope("schema.read"); if (denied) return denied;
    const data = policies.map((policy) => ({ name: policy.table, domain: policy.domain, dataClass: policy.dataClass, mutationMode: policy.mutationMode, capabilities: effectiveCapabilities(client, policy) }));
    await audit("schema.list", 200, undefined, undefined, "", { count: data.length });
    return response({ data }, 200, requestId);
  }

  const schemaMatch = path.match(/^\/v1\/schema\/tables\/([A-Za-z0-9_]+)$/);
  if (req.method === "GET" && schemaMatch) {
    const denied = await requireScope("schema.read"); if (denied) return denied;
    const table = tableByName.get(schemaMatch[1]);
    const policy = policyByTable.get(schemaMatch[1]);
    if (!table || !policy) return errorResponse("NOT_FOUND", "Table is not available", 404, requestId);
    await audit("schema.read", 200, table.name);
    return response({ ...table, policy, effectiveCapabilities: effectiveCapabilities(client, policy) }, 200, requestId);
  }

  if (req.method === "GET" && path === "/v1/audit-events") {
    const denied = await requireScope("audit.read"); if (denied) return denied;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
    const offset = decodeCursor(url.searchParams.get("cursor"));
    const { data, error } = await admin.rpc("api_audit_list", { p_api_client_id: client.id, p_limit: limit, p_offset: offset });
    if (error) return errorResponse("DATABASE_ERROR", error.message, 400, requestId);
    return response({ data: data ?? [], page: { limit, nextCursor: (data?.length ?? 0) === limit ? encodeCursor(offset + limit) : null } }, 200, requestId);
  }

  const actionMatch = path.match(/^\/v1\/actions\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/);
  if (req.method === "POST" && actionMatch) {
    const denied = await requireScope("actions.execute"); if (denied) return denied;
    const service = serviceByName.get(actionMatch[1]);
    if (!service || !service.actions.includes(actionMatch[2])) return errorResponse("NOT_FOUND", "Business action is not available", 404, requestId);
    const userToken = req.headers.get("X-User-Access-Token")?.trim() ?? "";
    if (!userToken) return errorResponse("USER_SESSION_REQUIRED", "Guarded actions require X-User-Access-Token from an active agency-admin session", 401, requestId);
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData } = await anon.auth.getUser(userToken);
    if (!userData.user) return errorResponse("USER_SESSION_REQUIRED", "The agency-admin session is invalid or expired", 401, requestId);
    const { data: profile } = await admin.from("profiles").select("role,is_active").eq("id", userData.user.id).maybeSingle();
    if (!profile || profile.role !== "agency_admin" || profile.is_active !== true) return errorResponse("FORBIDDEN", "An active agency-admin session is required", 403, requestId);
    let body: any;
    try { body = await req.json(); } catch { return errorResponse("INVALID_JSON", "Invalid JSON body", 400, requestId); }
    const input = body?.input && typeof body.input === "object" ? body.input : {};
    const forwarded = actionMatch[1] === "project-documents" ? input : { action: actionMatch[2], ...input };
    const upstream = await fetch(`${supabaseUrl}/functions/v1/${actionMatch[1]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")!, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify(forwarded),
    });
    const payload = await upstream.json().catch(() => ({ error: "Invalid upstream response" }));
    const auditEventId = await audit(`action:${actionMatch[1]}:${actionMatch[2]}`, upstream.status, undefined, undefined, body?.confirmation?.reason ?? "");
    return response({ status: upstream.ok ? "completed" : "failed", data: payload, requestId, auditEventId }, upstream.ok ? 200 : upstream.status, requestId);
  }

  const collectionMatch = path.match(/^\/v1\/data\/([A-Za-z0-9_]+)$/);
  const recordMatch = path.match(/^\/v1\/data\/([A-Za-z0-9_]+)\/([^/]+)$/);
  const tableName = collectionMatch?.[1] ?? recordMatch?.[1];
  if (tableName) {
    const table = tableByName.get(tableName);
    const policy = policyByTable.get(tableName);
    if (!table || !policy) return errorResponse("NOT_FOUND", "Table is not available", 404, requestId);
    const capabilities = effectiveCapabilities(client, policy);

    if (req.method === "GET") {
      const denied = await requireScope("data.read"); if (denied) return denied;
      if (recordMatch) {
        if (!table.row.id) return errorResponse("UNSUPPORTED", "This table has no id field; use collection filters", 422, requestId);
        const recordId = decodeURIComponent(recordMatch[2]);
        const { data, error } = await admin.from(tableName).select("*").eq("id", recordId).maybeSingle();
        if (error) return errorResponse("DATABASE_ERROR", error.message, 400, requestId);
        if (!data) { await audit("data.read", 404, tableName, recordId); return errorResponse("NOT_FOUND", "Record not found", 404, requestId); }
        const auditEventId = await audit("data.read", 200, tableName, recordId);
        return response({ data, meta: { requestId, auditEventId } }, 200, requestId, { ETag: await etagFor(data) });
      }

      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
      const offset = decodeCursor(url.searchParams.get("cursor"));
      const requestedFields = (url.searchParams.get("fields") ?? "*").split(",").map((value) => value.trim()).filter(Boolean);
      if (requestedFields[0] !== "*" && requestedFields.some((field) => !table.row[field])) return errorResponse("INVALID_FIELD", "One or more requested fields do not exist", 422, requestId);
      let query: any = admin.from(tableName).select(requestedFields.join(","));
      const filterValue = url.searchParams.get("filter");
      if (filterValue) {
        try { query = applyFilter(query, JSON.parse(filterValue), table); }
        catch (cause) { return errorResponse("INVALID_FILTER", cause instanceof Error ? cause.message : "Invalid filter", 422, requestId); }
      }
      const order = url.searchParams.get("order");
      if (order) {
        for (const item of order.split(",")) {
          const [field, direction = "asc"] = item.trim().split(".");
          if (!table.row[field] || !["asc", "desc"].includes(direction)) return errorResponse("INVALID_ORDER", `Invalid order: ${item}`, 422, requestId);
          query = query.order(field, { ascending: direction === "asc" });
        }
      }
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return errorResponse("DATABASE_ERROR", error.message, 400, requestId);
      await audit("data.list", 200, tableName, undefined, "", { count: data?.length ?? 0 });
      return response({ data: data ?? [], page: { limit, nextCursor: (data?.length ?? 0) === limit ? encodeCursor(offset + limit) : null } }, 200, requestId);
    }

    if (req.method === "POST" && collectionMatch) {
      const denied = await requireScope("data.write"); if (denied) return denied;
      if (!capabilities.includes("create")) return errorResponse("USE_BUSINESS_ACTION", "Direct creation is protected; use a documented business action", 409, requestId);
      const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
      if (!idempotencyKey || idempotencyKey.length < 8) return errorResponse("IDEMPOTENCY_REQUIRED", "Idempotency-Key of at least 8 characters is required", 400, requestId);
      let raw: unknown;
      try { raw = await req.json(); } catch { return errorResponse("INVALID_JSON", "Invalid JSON body", 400, requestId); }
      let body: Record<string, unknown>;
      try { body = validateWrite(raw, table.insert); } catch (cause) { return errorResponse("VALIDATION_ERROR", (cause as Error).message, 422, requestId); }
      const requestHash = await sha256(`${req.method}:${path}:${JSON.stringify(body)}`);
      const { data: prior } = await admin.rpc("api_idempotency_get", { p_api_client_id: client.id, p_idempotency_key: idempotencyKey });
      if (prior?.[0]) {
        if (prior[0].request_hash !== requestHash) return errorResponse("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for another request", 409, requestId);
        return response(prior[0].response_body, prior[0].response_status, requestId, { "X-Idempotent-Replay": "true" });
      }
      const { data, error } = await admin.from(tableName).insert(body).select().single();
      if (error) { await audit("data.create", 400, tableName, undefined, error.message); return errorResponse("DATABASE_ERROR", error.message, 400, requestId); }
      const auditEventId = await audit("data.create", 201, tableName, String((data as any)?.id ?? ""));
      const result = { data, meta: { requestId, auditEventId } };
      await admin.rpc("api_idempotency_save", { p_api_client_id: client.id, p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_response_status: 201, p_response_body: result });
      return response(result, 201, requestId, { ETag: await etagFor(data) });
    }

    if (recordMatch && (req.method === "PATCH" || req.method === "DELETE")) {
      const denied = await requireScope(req.method === "DELETE" ? "data.delete" : "data.write"); if (denied) return denied;
      const capability = req.method === "DELETE" ? "delete" : "update";
      if (!capabilities.includes(capability)) return errorResponse(req.method === "DELETE" ? "DELETE_PROTECTED" : "USE_BUSINESS_ACTION", "This mutation is protected by table policy", 409, requestId);
      if (!table.row.id) return errorResponse("UNSUPPORTED", "This table has no id field", 422, requestId);
      const recordId = decodeURIComponent(recordMatch[2]);
      const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
      if (!idempotencyKey || idempotencyKey.length < 8) return errorResponse("IDEMPOTENCY_REQUIRED", "Idempotency-Key of at least 8 characters is required", 400, requestId);
      const { data: current, error: readError } = await admin.from(tableName).select("*").eq("id", recordId).maybeSingle();
      if (readError) return errorResponse("DATABASE_ERROR", readError.message, 400, requestId);
      if (!current) return errorResponse("NOT_FOUND", "Record not found", 404, requestId);
      if (req.headers.get("If-Match") !== await etagFor(current)) return errorResponse("PRECONDITION_FAILED", "Read the record again and send its ETag in If-Match", 412, requestId);

      let raw: any = {};
      try { raw = await req.json(); } catch { return errorResponse("INVALID_JSON", "Invalid JSON body", 400, requestId); }
      const requestHash = await sha256(`${req.method}:${path}:${JSON.stringify(raw)}`);
      const { data: prior } = await admin.rpc("api_idempotency_get", { p_api_client_id: client.id, p_idempotency_key: idempotencyKey });
      if (prior?.[0]) {
        if (prior[0].request_hash !== requestHash) return errorResponse("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for another request", 409, requestId);
        return response(prior[0].response_body, prior[0].response_status, requestId, { "X-Idempotent-Replay": "true" });
      }

      if (req.method === "PATCH") {
        let body: Record<string, unknown>;
        try { body = validateWrite(raw, table.update); } catch (cause) { return errorResponse("VALIDATION_ERROR", (cause as Error).message, 422, requestId); }
        const { data, error } = await admin.from(tableName).update(body).eq("id", recordId).select().single();
        if (error) { await audit("data.update", 400, tableName, recordId, error.message); return errorResponse("DATABASE_ERROR", error.message, 400, requestId); }
        const auditEventId = await audit("data.update", 200, tableName, recordId);
        const result = { data, meta: { requestId, auditEventId } };
        await admin.rpc("api_idempotency_save", { p_api_client_id: client.id, p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_response_status: 200, p_response_body: result });
        return response(result, 200, requestId, { ETag: await etagFor(data) });
      }

      if (req.headers.get("X-Confirm-Delete") !== "DELETE") return errorResponse("DELETE_CONFIRMATION_REQUIRED", "X-Confirm-Delete: DELETE is required", 400, requestId);
      const reason = String(raw?.reason ?? "").trim();
      const mode = raw?.mode === "hard" ? "hard" : "soft";
      if (reason.length < 3) return errorResponse("DELETE_REASON_REQUIRED", "A deletion reason is required", 400, requestId);
      let queryResult: { error: any };
      if (mode === "soft" && table.update.archived_at) queryResult = await admin.from(tableName).update({ archived_at: new Date().toISOString() }).eq("id", recordId);
      else if (mode === "soft" && table.update.deleted_at) queryResult = await admin.from(tableName).update({ deleted_at: new Date().toISOString() }).eq("id", recordId);
      else if (mode === "soft") return errorResponse("SOFT_DELETE_UNAVAILABLE", "No archive field; repeat with mode=hard only when intended", 409, requestId);
      else queryResult = await admin.from(tableName).delete().eq("id", recordId);
      if (queryResult.error) { await audit("data.delete", 400, tableName, recordId, reason, { mode, error: queryResult.error.message }); return errorResponse("DATABASE_ERROR", queryResult.error.message, 400, requestId); }
      const auditEventId = await audit("data.delete", 204, tableName, recordId, reason, { mode });
      await admin.rpc("api_idempotency_save", { p_api_client_id: client.id, p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_response_status: 204, p_response_body: { deleted: true, mode, auditEventId } });
      return response(null, 204, requestId);
    }
  }

  return errorResponse("NOT_FOUND", "Endpoint not found", 404, requestId);
});
