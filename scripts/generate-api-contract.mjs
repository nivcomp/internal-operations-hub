import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const apiDir = resolve(root, "docs/api");
const catalog = JSON.parse(readFileSync(resolve(apiDir, "table-catalog.json"), "utf8"));
const tableNames = catalog.tables.map((table) => table.name);

const domainTables = {
  governance_and_audit: [
    "activity_logs", "approvals", "decision_logs", "registration_audit_log", "copilot_audit_log",
  ],
  ai_and_copilot: [
    "ai_generated_drafts", "ai_project_summaries", "ai_request_classifications", "ai_response_cache",
    "ai_runs", "ai_sessions", "ai_usage_alerts", "ai_usage_events", "ai_usage_limits",
    "copilot_entity_facts", "copilot_messages", "copilot_operator_actions", "copilot_slot_memory",
    "copilot_state", "crm_ai_suggestions", "supplier_skill_suggestions",
  ],
  identity_registration_and_onboarding: [
    "profiles", "onboarding_invitations", "onboarding_state", "public_registrations",
    "registration_settings",
  ],
  crm_and_leads: [
    "clients", "contact_notes", "crm_leads", "lead_conversation_messages", "lead_conversations",
    "past_projects",
  ],
  projects_and_delivery: [
    "change_requests", "files", "project_assumptions", "project_briefs", "project_progress_updates",
    "project_questions", "project_requirements", "project_schedule", "projects",
  ],
  scope: ["scope_items", "scopes"],
  estimates_and_pricing: [
    "estimate_adjustments", "estimate_items", "estimate_role_allocations", "estimate_scenarios",
    "estimate_supplier_reviews", "estimate_versions", "phase_pricing", "project_estimates", "project_pricing",
  ],
  suppliers: [
    "project_supplier_assignments", "supplier_payments", "supplier_profiles", "supplier_time_entries", "suppliers",
  ],
  billing_and_hours: ["meeting_time_charges", "paid_hours", "payments"],
  conversations: [
    "chat_messages", "conversation_participants", "project_conversations", "project_messages",
  ],
  specification_and_meetings: [
    "client_meetings", "meeting_sources", "specification_section_sources", "specification_sections",
    "specification_versions",
  ],
  prototypes: ["project_prototypes", "prototype_approvals", "prototype_versions"],
  proposals_documents_and_execution: [
    "execution_packages", "project_documents", "proposal_signatures", "proposal_versions",
  ],
  imports_and_email_operations: [
    "email_send_log", "email_send_state", "email_unsubscribe_tokens", "import_batches", "import_rows",
    "suppressed_emails",
  ],
};

const domainByTable = new Map();
for (const [domain, names] of Object.entries(domainTables)) {
  for (const name of names) {
    if (domainByTable.has(name)) throw new Error(`Table appears in multiple API domains: ${name}`);
    domainByTable.set(name, domain);
  }
}
const missing = tableNames.filter((name) => !domainByTable.has(name));
const unknown = [...domainByTable.keys()].filter((name) => !tableNames.includes(name));
if (missing.length || unknown.length) {
  throw new Error(`Domain catalog mismatch. Missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"}`);
}

const legacyReadOnly = new Set(["phase_pricing", "project_pricing"]);
const appendOnly = new Set([
  "activity_logs", "ai_usage_events", "approvals", "chat_messages", "client_meetings",
  "contact_notes", "copilot_audit_log", "copilot_messages", "decision_logs", "email_send_log",
  "lead_conversation_messages", "meeting_sources", "payments", "project_messages", "proposal_signatures",
  "prototype_approvals", "registration_audit_log", "supplier_payments", "supplier_time_entries",
]);
const actionOnly = new Set([
  "ai_generated_drafts", "approvals", "estimate_supplier_reviews", "execution_packages", "payments",
  "profiles", "project_estimates", "project_supplier_assignments", "proposal_signatures", "proposal_versions",
  "prototype_approvals", "prototype_versions", "supplier_payments",
]);
const confidential = new Set([
  "ai_response_cache", "ai_runs", "ai_usage_alerts", "ai_usage_events", "ai_usage_limits",
  "copilot_audit_log", "copilot_entity_facts", "copilot_operator_actions", "copilot_slot_memory", "copilot_state",
  "email_send_log", "email_send_state", "email_unsubscribe_tokens", "import_batches", "import_rows",
  "registration_audit_log", "registration_settings", "suppressed_emails",
]);
const clientReadableDomains = new Set([
  "billing_and_hours", "conversations", "projects_and_delivery", "proposals_documents_and_execution",
  "prototypes", "scope", "specification_and_meetings",
]);
const supplierReadableDomains = new Set([
  "conversations", "projects_and_delivery", "scope", "specification_and_meetings", "suppliers",
]);
const clientWritable = new Set([
  "change_requests", "chat_messages", "files", "project_assumptions", "project_briefs", "project_messages",
  "project_questions", "project_requirements", "proposal_signatures", "prototype_approvals",
]);
const supplierWritable = new Set([
  "chat_messages", "files", "project_messages", "supplier_profiles", "supplier_time_entries", "suppliers",
]);

const permissions = {
  formatVersion: 1,
  authority: "Runtime authorization is the intersection of integration scopes, application role, row ownership/RLS, and table policy. This file never grants access by itself.",
  integrationRoles: {
    integration_reader: ["schema.read", "data.read"],
    integration_writer: ["schema.read", "data.read", "data.write", "actions.execute"],
    integration_admin: ["schema.read", "data.read", "data.write", "data.delete", "actions.execute", "audit.read"],
  },
  applicationRoles: {
    agency_admin: "Internal agency operator. Broadest row access, still constrained by guarded business actions and audit requirements.",
    client: "Only the linked client and that client's projects; only client-visible records.",
    supplier: "Only the linked supplier, assigned projects, supplier-visible records, and own time/cost records.",
  },
  globalRules: [
    "Anonymous tokens cannot access operational table endpoints.",
    "Never expose a Supabase service_role key to a browser, generated Skill, desktop client, or third party.",
    "Final scope, pricing, supplier assignment, supplier cost, visibility, readiness, lead promotion, and payment overrides require a guarded business action.",
    "A project may not start without approved scope, paid payment or hour bank (or an explicit audited agency override), and an assigned supplier.",
    "Hard delete requires integration_admin, data.delete, an application role permitted below, a reason, an idempotency key, and explicit confirmation. Append-only records use correction/reversal events instead.",
    "RLS and gateway authorization remain authoritative even when this catalog says a role may access a table.",
  ],
  domains: domainTables,
  tablePolicies: tableNames.map((name) => {
    const domain = domainByTable.get(name);
    const isLegacy = legacyReadOnly.has(name);
    const isAppendOnly = appendOnly.has(name);
    return {
      table: name,
      domain,
      dataClass: confidential.has(name) ? "confidential_internal" : "business",
      mutationMode: isLegacy ? "read_only_legacy" : actionOnly.has(name) ? "business_action_preferred" : isAppendOnly ? "append_only" : "direct_crud_with_policy",
      deleteMode: isLegacy ? "forbidden" : isAppendOnly ? "correction_or_reversal_only" : "guarded_admin_delete",
      agency_admin: isLegacy ? ["read"] : ["create", "read", "update", ...(isAppendOnly ? [] : ["delete_guarded"])],
      client: confidential.has(name) || !clientReadableDomains.has(domain)
        ? []
        : ["read_own", ...(clientWritable.has(name) ? [actionOnly.has(name) ? "write_own_via_action" : "create_or_update_own"] : [])],
      supplier: confidential.has(name) || !supplierReadableDomains.has(domain)
        ? []
        : ["read_assigned_or_own", ...(supplierWritable.has(name) ? ["create_or_update_own"] : [])],
    };
  }),
};

const services = [
  { service: "access-admin", audience: "agency_admin", actions: ["list", "invite", "link", "setActive", "quickInviteClient", "quickInviteSupplier", "listInvitations", "registrationSettings", "setRegistrationSettings", "listRegistrations", "markRegistrationsSeen", "reviewRegistration", "projectContinuationLink"] },
  { service: "public-registration", audience: "public_or_authenticated_claim", actions: ["info", "register", "submit", "claim", "continueInfo", "continueActivate"] },
  { service: "onboarding-chat", audience: "client_or_supplier", actions: ["state", "send", "patch", "submitForReview"] },
  { service: "lead-conversations", audience: "agency_admin", actions: ["list", "detail", "markRead", "message", "setStatus", "promote"] },
  { service: "project-chat", audience: "authenticated_project_participant", actions: ["history", "send", "confirm_action", "cancel_action"] },
  { service: "copilot", audience: "agency_admin", actions: ["history", "send", "operator_queue", "operator_confirm", "operator_retry", "operator_cancel", "clear_slot", "confirm_action", "cancel_action", "clear", "save_preferences"] },
  { service: "copilot-voice", audience: "agency_admin", actions: ["transcribe", "speak"] },
  { service: "crm-import", audience: "agency_admin", actions: ["preview", "createBatch", "executeChunk", "finishBatch", "retryFailed"] },
  { service: "crm-ai-map", audience: "agency_admin", actions: ["suggestMapping", "enrichLead"] },
  { service: "project-documents", audience: "agency_admin", actions: ["generate"] },
  { service: "project-prototype", audience: "agency_admin", actions: ["generate", "share"] },
  { service: "project-workflow", audience: "authenticated_by_action", actions: ["publish_proposal", "sign_proposal", "generate_execution_package"] },
];

const rpc = catalog.functions.map((entry) => ({
  name: entry.name,
  exposure: ["finish_client_meeting", "promote_client_onboarding", "submit_client_onboarding", "submit_supplier_onboarding"].includes(entry.name)
    ? "business_action_only"
    : "internal_server_only",
  signature: entry.signature ?? { args: entry.args, returns: entry.returns },
}));

const businessActions = {
  formatVersion: 1,
  note: "Existing Supabase Edge Function/RPC inventory. A production external API gateway should wrap these operations and preserve their current authorization checks.",
  edgeFunctions: services,
  databaseFunctions: rpc,
  guardedDecisions: [
    "promote lead to project", "publish or approve scope", "publish pricing", "assign supplier",
    "publish/share MVP or prototype", "approve/reopen MVP", "record payment or override payment gate",
    "publish/sign proposal", "start delivery", "hard delete business data",
  ],
};

const tableParameter = {
  name: "table", in: "path", required: true,
  description: "A table from the generated public-schema catalog. Authorization is evaluated per table and row.",
  schema: { type: "string", enum: tableNames },
};
const recordIdParameter = { name: "recordId", in: "path", required: true, schema: { type: "string" } };
const standardErrors = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "409": { $ref: "#/components/responses/Conflict" },
  "422": { $ref: "#/components/responses/Unprocessable" },
  "429": { $ref: "#/components/responses/RateLimited" },
};

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Client-to-Scope AI External Automation API",
    version: "0.1.0-design",
    summary: "Scoped CRUD and business-action contract for external tools and AI Skills.",
    description: "Contract for the first-party Supabase Edge Function gateway. Agency-issued keys are scoped and stored only as SHA-256 hashes. Do not point third-party agents at the Supabase service_role. The gateway enforces table policy, confirmations, idempotency, optimistic concurrency, rate limits, and audit logs.",
  },
  servers: [
    { url: "https://jvluliwmugamojdqstha.supabase.co/functions/v1/external-api", description: "Deployed Supabase Edge Function gateway" },
    { url: "https://api.{domain}", variables: { domain: { default: "YOUR_DOMAIN.example" } }, description: "Production gateway after implementation" },
    { url: "http://localhost:8787", description: "Local gateway development" },
  ],
  tags: [
    { name: "Identity" }, { name: "Schema" }, { name: "Data" }, { name: "Actions" }, { name: "Audit" },
  ],
  security: [{ apiKeyAuth: [] }],
  paths: {
    "/v1/me": {
      get: { tags: ["Identity"], operationId: "getCurrentIdentity", summary: "Return the authenticated integration and application identity", responses: { "200": { description: "Identity and effective scopes", content: { "application/json": { schema: { $ref: "#/components/schemas/Identity" } } } }, ...standardErrors } },
    },
    "/v1/schema/tables": {
      get: { tags: ["Schema"], operationId: "listTables", summary: "List accessible tables and capabilities", security: [{ apiKeyAuth: [] }], responses: { "200": { description: "Tables filtered to the caller's effective permissions", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/TableSummary" } } }, required: ["data"] } } } }, ...standardErrors } },
    },
    "/v1/schema/tables/{table}": {
      get: { tags: ["Schema"], operationId: "getTableSchema", summary: "Get fields, relations, and permitted operations for one table", security: [{ apiKeyAuth: [] }], parameters: [tableParameter], responses: { "200": { description: "Table schema", content: { "application/json": { schema: { $ref: "#/components/schemas/TableSchema" } } } }, "404": { $ref: "#/components/responses/NotFound" }, ...standardErrors } },
    },
    "/v1/data/{table}": {
      get: {
        tags: ["Data"], operationId: "listRecords", summary: "List row-scoped records", security: [{ apiKeyAuth: [] }],
        parameters: [tableParameter,
          { name: "fields", in: "query", schema: { type: "string" }, description: "Comma-separated allowlisted columns; defaults to safe fields." },
          { name: "filter", in: "query", schema: { type: "string" }, description: "URL-encoded JSON filter AST; no raw SQL." },
          { name: "order", in: "query", schema: { type: "string" }, description: "Comma-separated column.direction values." },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Page of records", content: { "application/json": { schema: { $ref: "#/components/schemas/RecordPage" } } } }, ...standardErrors },
      },
      post: {
        tags: ["Data"], operationId: "createRecord", summary: "Create a record when direct creation is permitted", security: [{ apiKeyAuth: [] }],
        parameters: [tableParameter, { $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RecordWrite" } } } },
        responses: { "201": { description: "Created", headers: { ETag: { schema: { type: "string" } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/RecordResult" } } } }, ...standardErrors },
      },
    },
    "/v1/data/{table}/{recordId}": {
      get: { tags: ["Data"], operationId: "getRecord", summary: "Read one row-scoped record", security: [{ apiKeyAuth: [] }], parameters: [tableParameter, recordIdParameter], responses: { "200": { description: "Record", headers: { ETag: { schema: { type: "string" } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/RecordResult" } } } }, "404": { $ref: "#/components/responses/NotFound" }, ...standardErrors } },
      patch: { tags: ["Data"], operationId: "updateRecord", summary: "Patch a permitted record", security: [{ apiKeyAuth: [] }], parameters: [tableParameter, recordIdParameter, { $ref: "#/components/parameters/IfMatch" }, { $ref: "#/components/parameters/IdempotencyKey" }], requestBody: { required: true, content: { "application/merge-patch+json": { schema: { $ref: "#/components/schemas/RecordWrite" } } } }, responses: { "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/RecordResult" } } } }, "404": { $ref: "#/components/responses/NotFound" }, "412": { $ref: "#/components/responses/PreconditionFailed" }, ...standardErrors } },
      delete: { tags: ["Data"], operationId: "deleteRecord", summary: "Guarded delete; unavailable for append-only or protected business records", security: [{ apiKeyAuth: [] }], parameters: [tableParameter, recordIdParameter, { $ref: "#/components/parameters/IfMatch" }, { $ref: "#/components/parameters/IdempotencyKey" }, { name: "X-Confirm-Delete", in: "header", required: true, schema: { type: "string", const: "DELETE" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string", minLength: 3 }, mode: { type: "string", enum: ["soft", "hard"], default: "soft" } }, required: ["reason"], additionalProperties: false } } } }, responses: { "204": { description: "Deleted or archived" }, "404": { $ref: "#/components/responses/NotFound" }, "412": { $ref: "#/components/responses/PreconditionFailed" }, ...standardErrors } },
    },
    "/v1/actions/{service}/{action}": {
      post: {
        tags: ["Actions"], operationId: "executeBusinessAction", summary: "Execute a guarded business operation", security: [{ apiKeyAuth: [] }],
        parameters: [
          { name: "service", in: "path", required: true, schema: { type: "string", enum: services.map((entry) => entry.service) } },
          { name: "action", in: "path", required: true, schema: { type: "string" }, description: "Must be an action listed for the selected service in business-actions.json." },
          { $ref: "#/components/parameters/IdempotencyKey" },
          { name: "X-User-Access-Token", in: "header", required: true, schema: { type: "string" }, description: "Short-lived Supabase access token for the active agency admin who confirms the guarded business action." },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { input: { type: "object", additionalProperties: true }, confirmation: { type: "object", properties: { confirmed: { type: "boolean" }, reason: { type: "string" } }, additionalProperties: false } }, required: ["input"], additionalProperties: false } } } },
        responses: { "200": { description: "Action completed", content: { "application/json": { schema: { $ref: "#/components/schemas/ActionResult" } } } }, "202": { description: "Confirmation or asynchronous completion required", content: { "application/json": { schema: { $ref: "#/components/schemas/ActionResult" } } } }, ...standardErrors },
      },
    },
    "/v1/audit-events": {
      get: { tags: ["Audit"], operationId: "listAuditEvents", summary: "List immutable integration audit events", security: [{ apiKeyAuth: [] }], parameters: [{ name: "cursor", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } }], responses: { "200": { description: "Audit page", content: { "application/json": { schema: { $ref: "#/components/schemas/RecordPage" } } } }, ...standardErrors } },
    },
  },
  components: {
    securitySchemes: {
      apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key", description: "Agency-issued scoped key. The full value is shown once in API & Integrations and stored only as a SHA-256 hash." },
      oauth2: { type: "oauth2", description: "Reserved for a future delegated flow. The deployed first-party gateway currently issues scoped API keys.", flows: { clientCredentials: { tokenUrl: "https://api.YOUR_DOMAIN.example/oauth/token", scopes: { "schema.read": "Read schema metadata", "data.read": "Read permitted rows", "data.write": "Create/update permitted rows", "data.delete": "Request guarded deletes", "actions.execute": "Execute permitted business actions", "audit.read": "Read integration audit events" } } } },
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Interactive Supabase user JWT routed through the gateway; never a service_role JWT." },
    },
    parameters: {
      IdempotencyKey: { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8, maxLength: 200 }, description: "Unique per logical mutation; retain results for safe retries." },
      IfMatch: { name: "If-Match", in: "header", required: true, schema: { type: "string" }, description: "ETag from the last read; prevents lost updates." },
    },
    schemas: {
      Identity: { type: "object", properties: { integrationId: { type: "string" }, profileId: { type: ["string", "null"] }, applicationRole: { type: "string", enum: ["agency_admin", "client", "supplier", "service"] }, clientId: { type: ["string", "null"] }, supplierId: { type: ["string", "null"] }, scopes: { type: "array", items: { type: "string" } } }, required: ["integrationId", "applicationRole", "scopes"] },
      TableSummary: { type: "object", properties: { name: { type: "string" }, domain: { type: "string" }, capabilities: { type: "array", items: { type: "string", enum: ["create", "read", "update", "delete"] } } }, required: ["name", "capabilities"] },
      TableSchema: { type: "object", properties: { name: { type: "string" }, row: { type: "object", additionalProperties: true }, insert: { type: "object", additionalProperties: true }, update: { type: "object", additionalProperties: true }, relationships: { type: "array", items: { type: "object", additionalProperties: true } }, effectiveCapabilities: { type: "array", items: { type: "string" } } }, required: ["name", "row", "insert", "update", "relationships", "effectiveCapabilities"] },
      RecordWrite: { type: "object", additionalProperties: true, description: "Validated against table-catalog.json and field-level policy. Unknown, immutable, tenant, role, and server-managed fields are rejected." },
      RecordResult: { type: "object", properties: { data: { type: "object", additionalProperties: true }, meta: { type: "object", properties: { requestId: { type: "string" }, auditEventId: { type: ["string", "null"] } }, required: ["requestId"] } }, required: ["data", "meta"] },
      RecordPage: { type: "object", properties: { data: { type: "array", items: { type: "object", additionalProperties: true } }, page: { type: "object", properties: { nextCursor: { type: ["string", "null"] }, limit: { type: "integer" } }, required: ["nextCursor", "limit"] } }, required: ["data", "page"] },
      ActionResult: { type: "object", properties: { status: { type: "string", enum: ["completed", "pending_confirmation", "accepted", "rejected", "failed"] }, data: { type: ["object", "null"], additionalProperties: true }, confirmation: { type: ["object", "null"], additionalProperties: true }, auditEventId: { type: ["string", "null"] }, requestId: { type: "string" } }, required: ["status", "requestId"] },
      Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: { type: ["object", "null"], additionalProperties: true }, requestId: { type: "string" }, retryable: { type: "boolean" } }, required: ["code", "message", "requestId", "retryable"] } }, required: ["error"] },
    },
    responses: Object.fromEntries([
      ["BadRequest", 400], ["Unauthorized", 401], ["Forbidden", 403], ["NotFound", 404], ["Conflict", 409], ["PreconditionFailed", 412], ["Unprocessable", 422], ["RateLimited", 429],
    ].map(([name, status]) => [name, { description: `${status} error`, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }])),
  },
};

const skillInput = {
  packageFormat: "client-to-scope-ai-skill-input/v1",
  purpose: "Single-file source package for generating an API connector or AI Skill for the deployed scoped gateway.",
  status: "runtime_gateway_contract",
  generationPrompt: [
    "Create a production-quality AI Skill/connector for the API contract in this package.",
    "Treat openapi as the protocol contract, tableCatalog as the exact public database schema, permissions as mandatory policy, and businessActions as the preferred interface for guarded business mutations.",
    "Generate a concise SKILL.md, detailed reference files, and small deterministic scripts only where useful.",
    "Use the agency-issued X-API-Key with least-privilege scopes. Keep API_BASE_URL and API_KEY in environment variables or a secret manager. Never request, store, print, or expose a Supabase service_role key.",
    "At startup call GET /v1/me and GET /v1/schema/tables. Refuse any operation not returned as an effective capability.",
    "Support paginated reads, safe field selection, filter ASTs, create, optimistic-concurrency patch, guarded delete, business actions, idempotency keys, rate-limit retries, and structured errors.",
    "Before destructive or high-impact operations, show the target, proposed change, side effects, and confirmation requirement. Never infer approval from silence.",
    "Use business actions instead of raw table writes for scope/pricing publication, supplier assignment, lead promotion, payment overrides, MVP/prototype decisions, proposals, execution start, approvals, signatures, and protected deletes.",
    "Respect client/supplier row boundaries and visibility. Never broaden access after a 403 or attempt to bypass RLS/gateway policy.",
    "Include connection setup, command examples, troubleshooting, and contract tests using non-production fixtures. Do not invent endpoints, columns, actions, or permissions not present in this package.",
    "Use the deployed Supabase Edge Function server from the OpenAPI document unless the operator provides another API_BASE_URL.",
  ].join("\n"),
  openapi,
  tableCatalog: catalog,
  permissions,
  businessActions,
};

mkdirSync(apiDir, { recursive: true });
writeFileSync(resolve(apiDir, "permissions-matrix.json"), `${JSON.stringify(permissions, null, 2)}\n`);
writeFileSync(resolve(apiDir, "business-actions.json"), `${JSON.stringify(businessActions, null, 2)}\n`);
writeFileSync(resolve(apiDir, "openapi.json"), `${JSON.stringify(openapi, null, 2)}\n`);
writeFileSync(resolve(apiDir, "ai-skill-input.json"), `${JSON.stringify(skillInput, null, 2)}\n`);

const runtimePath = resolve(root, "supabase/functions/_shared/apiRuntimeContract.generated.ts");
const runtime = [
  "// Generated by scripts/generate-api-contract.mjs. Do not edit by hand.",
  `export const apiOpenApi: Record<string, unknown> = ${JSON.stringify(openapi)};`,
  `export const apiTableCatalog: Record<string, unknown> = ${JSON.stringify(catalog)};`,
  `export const apiPermissions: Record<string, unknown> = ${JSON.stringify(permissions)};`,
  `export const apiBusinessActions: Record<string, unknown> = ${JSON.stringify(businessActions)};`,
  `export const apiSkillInput: Record<string, unknown> = ${JSON.stringify(skillInput)};`,
  "",
].join("\n");
writeFileSync(runtimePath, runtime, "utf8");
console.log(`Wrote API contract for ${tableNames.length} tables, ${services.length} services, and ${rpc.length} RPC functions.`);
