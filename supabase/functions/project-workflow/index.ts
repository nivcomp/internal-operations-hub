import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const encoder = new TextEncoder();
async function sha256(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function actor(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data } = await anon.auth.getClaims(auth.slice(7));
  if (!data?.claims?.sub) return null;
  const { data: profile } = await admin.from("profiles").select("id, role, client_id, email, is_active").eq("id", data.claims.sub).maybeSingle();
  return profile?.is_active === false ? null : profile;
}
async function ownsProject(profile: any, projectId: string) {
  if (profile.role === "agency_admin") return true;
  if (profile.role !== "client" || !profile.client_id) return false;
  const { data } = await admin.from("projects").select("id").eq("id", projectId).eq("client_id", profile.client_id).maybeSingle();
  return Boolean(data);
}
async function audit(projectId: string, label: string, detail: string) {
  await admin.from("activity_logs").insert({ label, detail });
  await admin.from("decision_logs").insert({ project_id: projectId, decision: label, made_by_role: "system", impact: detail });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const profile = await actor(req);
  if (!profile) return json({ error: "Unauthorized" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");
  const projectId = String(body.projectId ?? "");
  if (!projectId || !await ownsProject(profile, projectId)) return json({ error: "Forbidden" }, 403);

  if (action === "publish_proposal") {
    if (profile.role !== "agency_admin") return json({ error: "Agency approval required" }, 403);
    const [{ data: project }, { data: sections }, { data: estimates }] = await Promise.all([
      admin.from("projects").select("id,name,summary,client_id").eq("id", projectId).single(),
      admin.from("specification_sections").select("section_key,title,content,status,client_visible,sort_order").eq("project_id", projectId).order("sort_order"),
      admin.from("project_estimates").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1),
    ]);
    const estimate = estimates?.[0];
    if (!estimate?.approved_by_yaniv || !estimate.final_fixed_price) return json({ error: "Yaniv must approve a final fixed price first." }, 409);
    if (!sections?.length || sections.some((s: any) => s.client_visible && s.status !== "approved")) return json({ error: "All client-visible specification sections must be approved." }, 409);
    const { data: items } = await admin.from("estimate_items").select("project_phase,title,description,estimated_hours_min,estimated_hours_max,client_visible_label,client_visible_description,acceptance_criteria").eq("estimate_id", estimate.id).eq("client_visible", true).order("sort_order");
    const specSnapshot = { project, sections, createdAt: new Date().toISOString() };
    const specHash = await sha256(specSnapshot);
    const { data: lastSpec } = await admin.from("specification_versions").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data: spec, error: specError } = await admin.from("specification_versions").insert({ project_id: projectId, version: (lastSpec?.version ?? 0) + 1, snapshot: specSnapshot, content_hash: specHash, created_by: profile.id }).select().single();
    if (specError) return json({ error: specError.message }, 400);
    const content = { project, sections: sections.filter((s: any) => s.client_visible), items, timeline: estimate.delivery_range_label, assumptions: estimate.fixed_price_scope, exclusions: estimate.fixed_price_exclusions, paymentTerms: estimate.payment_milestones, changeRule: estimate.change_request_rule, validityDate: estimate.validity_date };
    const documentHash = await sha256({ content, fixedPrice: estimate.final_fixed_price, currency: estimate.currency, specificationHash: specHash });
    const { data: lastProposal } = await admin.from("proposal_versions").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data: proposal, error } = await admin.from("proposal_versions").insert({ project_id: projectId, specification_version_id: spec.id, estimate_id: estimate.id, change_request_id: body.changeRequestId || null, version: (lastProposal?.version ?? 0) + 1, status: "published", proposal_kind: body.proposalKind || "full", language: body.language || "he", content, fixed_price: estimate.final_fixed_price, currency: estimate.currency, payment_terms: estimate.payment_milestones, document_hash: documentHash, published_at: new Date().toISOString(), created_by: profile.id }).select().single();
    if (error) return json({ error: error.message }, 400);
    if (body.changeRequestId) await admin.from("change_requests").update({ revised_proposal_version_id: proposal.id }).eq("id", body.changeRequestId);
    await audit(projectId, "Proposal published", `Proposal v${proposal.version} published for signature.`);
    return json({ ok: true, proposal });
  }

  if (action === "sign_proposal") {
    if (profile.role !== "client") return json({ error: "Only the client can sign." }, 403);
    const proposalId = String(body.proposalVersionId ?? "");
    const { data: proposal } = await admin.from("proposal_versions").select("*").eq("id", proposalId).eq("project_id", projectId).in("status", ["published","viewed"]).maybeSingle();
    if (!proposal) return json({ error: "This proposal is not available for signature." }, 409);
    const signerName = String(body.signerName ?? "").trim();
    const signerRole = String(body.signerRole ?? "").trim();
    const signatureArtifact = String(body.signatureArtifact ?? "").trim();
    if (!signerName || !signerRole || !signatureArtifact || body.acceptTerms !== true) return json({ error: "Name, role, signature and acceptance are required." }, 400);
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const { data: signature, error } = await admin.from("proposal_signatures").insert({ proposal_version_id: proposal.id, project_id: projectId, specification_version_id: proposal.specification_version_id, fixed_price: proposal.fixed_price, currency: proposal.currency, payment_terms: proposal.payment_terms, signed_by: profile.id, signer_name: signerName, signer_email: profile.email, signer_role: signerRole, signature_artifact: signatureArtifact, ip_address: forwarded, user_agent: req.headers.get("user-agent") || "", document_hash: proposal.document_hash }).select().single();
    if (error) return json({ error: error.message }, 400);
    await admin.from("proposal_versions").update({ status: "signed" }).eq("id", proposal.id);
    if (proposal.change_request_id) await admin.from("change_requests").update({ status: "client_approved", approved_date: new Date().toISOString().slice(0, 10) }).eq("id", proposal.change_request_id);
    await audit(projectId, "Proposal signed", `Proposal v${proposal.version} signed by ${signerName}.`);
    return json({ ok: true, signature });
  }

  if (action === "generate_execution_package") {
    if (profile.role !== "agency_admin") return json({ error: "Agency approval required" }, 403);
    const { data: signed } = await admin.from("proposal_versions").select("*").eq("project_id", projectId).eq("status", "signed").order("version", { ascending: false }).limit(1).maybeSingle();
    if (!signed) return json({ error: "A signed proposal is required." }, 409);
    const { data: project } = await admin.from("projects").select("payment_gate_status").eq("id", projectId).single();
    if (project?.payment_gate_status !== "cleared") return json({ error: "The payment/start gate is not cleared." }, 409);
    const { data: items } = await admin.from("estimate_items").select("project_phase,title,description,responsible_role,supplier_id,dependency_notes,risk_notes,acceptance_criteria").eq("estimate_id", signed.estimate_id).order("sort_order");
    const packageData = { approvedProposalVersion: signed.version, specification: signed.content, workBreakdown: items ?? [], testChecklist: (items ?? []).map((i: any) => i.acceptance_criteria).filter(Boolean), deploymentChecklist: ["Confirm access without storing plaintext secrets", "Back up affected systems", "Run acceptance tests", "Record deployment result"], requiredAccess: [], riskRegister: (items ?? []).map((i: any) => i.risk_notes).filter(Boolean), implementationPrompts: (items ?? []).map((i: any) => ({ title: i.title, prompt: `Implement ${i.title} according to the signed specification and acceptance criteria. Do not expand scope.` })) };
    const { data: last } = await admin.from("execution_packages").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data: executionPackage, error } = await admin.from("execution_packages").insert({ project_id: projectId, proposal_version_id: signed.id, version: (last?.version ?? 0) + 1, status: "draft", package: packageData, created_by: profile.id }).select().single();
    if (error) return json({ error: error.message }, 400);
    await admin.from("projects").update({ planning_readiness: "ready_for_planning" }).eq("id", projectId);
    await audit(projectId, "Execution package generated", `Execution package v${executionPackage.version} created as a draft.`);
    return json({ ok: true, executionPackage });
  }

  return json({ error: "Unknown action" }, 400);
});
