import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Public self-registration for clients and suppliers.
// This function is intentionally reachable without a session, so every branch is
// defensive: the public link must be enabled, the secret path code must match,
// input is validated and throttled, and nothing here ever touches operational
// project, pricing or supplier data. A submission only creates an isolated
// `public_registrations` row plus an email-confirmation link.

type Role = "client" | "supplier";

type Body = {
  action?: "info" | "submit" | "register" | "claim" | "continueInfo" | "continueActivate";
  role?: string;
  code?: string;
  token?: string;
  password?: string;
  company?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  message?: string;
  website?: string; // honeypot — must stay empty
  elapsedMs?: number;
  redirectTo?: string;
  language?: string;
  timezone?: string;
  consent?: boolean;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

async function hashIp(ip: string) {
  const pepper = Deno.env.get("SUPABASE_URL") ?? "pepper";
  const bytes = new TextEncoder().encode(`${pepper}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }

  // ---- project continuation link (one project, password only) ---------------
  if (body.action === "continueInfo" || body.action === "continueActivate") {
    const token = clean(body.token, 128);
    if (!token) return json({ error: "Invalid link." }, 400);

    const { data: invitation } = await admin
      .from("onboarding_invitations")
      .select("id, email, company, contact_name, client_id, project_id, expires_at, used_at, status")
      .eq("token", token)
      .maybeSingle();

    if (!invitation || !invitation.project_id || !invitation.client_id) {
      return json({ valid: false, reason: "invalid" });
    }
    if (invitation.used_at) return json({ valid: false, reason: "used" });
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
      return json({ valid: false, reason: "expired" });
    }

    const email = String(invitation.email ?? "").toLowerCase();

    async function findUserId(): Promise<string | null> {
      let page = 1;
      while (page <= 10) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        for (const user of data.users) {
          if (String(user.email ?? "").toLowerCase() === email) return user.id;
        }
        if (data.users.length < 200) break;
        page += 1;
      }
      return null;
    }

    const { data: project } = await admin
      .from("projects").select("name").eq("id", invitation.project_id).maybeSingle();

    if (body.action === "continueInfo") {
      const existing = await findUserId();
      return json({
        valid: true,
        email,
        company: invitation.company ?? "",
        contactName: invitation.contact_name ?? "",
        projectName: project?.name ?? "",
        accountExists: Boolean(existing),
      });
    }

    const password = String(body.password ?? "");
    if (password.length < 8) return json({ error: "password_too_short" }, 400);

    const existing = await findUserId();
    if (existing) return json({ ok: false, accountExists: true });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: invitation.contact_name ?? "", role: "client", client_id: invitation.client_id },
    });
    if (createError || !created?.user) {
      return json({ error: createError?.message ?? "Could not create the account." }, 400);
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: created.user.id,
      email,
      full_name: invitation.contact_name ?? email,
      role: "client",
      client_id: invitation.client_id,
      supplier_id: null,
      is_active: true,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    await admin.from("onboarding_invitations").update({
      used_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      status: "accepted",
      invited_profile_id: created.user.id,
    }).eq("id", invitation.id);

    await admin.from("registration_audit_log").insert({
      event: "project_continuation_activated",
      role: "client",
      ip_hash: await hashIp((req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown"),
      email,
      detail: { project_id: invitation.project_id },
    });

    return json({ ok: true, email });
  }

  const role = (body.role === "supplier" ? "supplier" : body.role === "client" ? "client" : null) as Role | null;
  if (!role) return json({ error: "Unknown registration link." }, 400);

  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ipHash = await hashIp(forwarded.split(",")[0].trim() || "unknown");
  const userAgent = clean(req.headers.get("user-agent"), 300);

  async function audit(event: string, detail: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
    await admin.from("registration_audit_log").insert({
      event, role, ip_hash: ipHash, detail, ...extra,
    });
  }

  const { data: settings } = await admin
    .from("registration_settings").select("*").eq("role", role).maybeSingle();

  const action = body.action ?? "info";

  // ---- claim: a confirmed registrant turns into a real, isolated account ----
  if (action === "claim") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = String(authUser?.user?.email ?? "").toLowerCase();
    if (!email) return json({ error: "No email on this account." }, 400);

    // The person only reaches this point by clicking the emailed confirmation
    // link, so having a session proves ownership of the address.
    const { data: registration } = await admin
      .from("public_registrations")
      .select("*")
      .ilike("email", email)
      .in("status", ["awaiting_confirmation", "confirmed"])
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (!registration) return json({ ok: false, claimed: false });

    const { data: existingProfile } = await admin
      .from("profiles").select("id").eq("id", userId).maybeSingle();
    if (existingProfile) {
      await admin.from("public_registrations")
        .update({ status: "converted", profile_id: userId, confirmed_at: registration.confirmed_at ?? new Date().toISOString(), converted_at: new Date().toISOString() })
        .eq("id", registration.id);
      return json({ ok: true, claimed: true });
    }

    let clientId: string | null = null;
    let supplierId: string | null = null;

    if (registration.role === "client") {
      const { data: created, error } = await admin.from("clients").insert({
        name: registration.contact_name,
        company: registration.company || registration.contact_name,
        email,
        phone: registration.phone || null,
        status: "lead",
        notes: "Self-registered through the public client link.",
      }).select("id").maybeSingle();
      if (error || !created) return json({ error: "Could not finish your registration." }, 400);
      clientId = created.id;
    } else {
      const { data: created, error } = await admin.from("suppliers").insert({
        name: registration.contact_name,
        email,
        phone: registration.phone || null,
        status: "pending_review",
      }).select("id").maybeSingle();
      if (error || !created) return json({ error: "Could not finish your registration." }, 400);
      supplierId = created.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: registration.contact_name,
      role: registration.role,
      client_id: clientId,
      supplier_id: supplierId,
      is_active: true,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    const now = new Date().toISOString();
    await admin.from("public_registrations").update({
      status: "converted",
      confirmed_at: registration.confirmed_at ?? now,
      converted_at: now,
      profile_id: userId,
      client_id: clientId,
      supplier_id: supplierId,
      seen_by_admin: false,
    }).eq("id", registration.id);

    await audit("registration_confirmed", { role: registration.role }, {
      registration_id: registration.id, email,
    });

    return json({ ok: true, claimed: true });
  }

  // ---- public link gate ------------------------------------------------------
  const code = clean(body.code, 64);
  const linkOpen = Boolean(settings?.enabled) && settings?.path_code === code && code.length > 0;

  if (action === "info") {
    if (!linkOpen) return json({ open: false });
    return json({ open: true, role, introText: settings?.intro_text ?? "" });
  }

  if (action !== "submit" && action !== "register") return json({ error: "Unknown action." }, 400);
  if (!linkOpen) return json({ error: "This registration link is closed." }, 403);

  // ---- bot and abuse protection ---------------------------------------------
  if (clean(body.website, 200)) {
    await audit("registration_blocked", { reason: "honeypot" });
    return json({ ok: true, status: "ready" }); // silent for bots
  }
  if (typeof body.elapsedMs === "number" && body.elapsedMs < 2000) {
    await audit("registration_blocked", { reason: "too_fast" });
    return json({ error: "Please take a moment and try again." }, 429);
  }

  const email = clean(body.email, 200).toLowerCase();
  const contactName = clean(body.contactName, 120);
  const company = clean(body.company, 160);
  const phone = clean(body.phone, 40);
  const message = clean(body.message, 1000);
  const language = body.language === "he" ? "he" : "en";
  const timezone = clean(body.timezone, 80);

  if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (contactName.length < 2) return json({ error: "Please enter your name." }, 400);
  if (role === "client" && company.length < 2) return json({ error: "Please enter your company name." }, 400);
  if (body.consent !== true) return json({ error: "Please accept the privacy terms." }, 400);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: perIp } = await admin
    .from("public_registrations").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("created_at", hourAgo);
  if ((perIp ?? 0) >= 5) {
    await audit("registration_throttled", { reason: "ip_hourly" }, { email });
    return json({ error: "Too many attempts from this device. Please try again later." }, 429);
  }

  const { count: perDay } = await admin
    .from("public_registrations").select("id", { count: "exact", head: true })
    .eq("role", role).gte("created_at", dayAgo);
  if ((perDay ?? 0) >= (settings?.daily_limit ?? 25)) {
    await audit("registration_throttled", { reason: "daily_limit" }, { email });
    return json({ error: "This link has reached today's limit. Please try again tomorrow." }, 429);
  }

  // ---- an address that already has a login never registers twice --------------
  let existingUserId: string | null = null;
  {
    let page = 1;
    while (page <= 10 && !existingUserId) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      for (const user of data.users) {
        if (String(user.email ?? "").toLowerCase() === email) { existingUserId = user.id; break; }
      }
      if (data.users.length < 200) break;
      page += 1;
    }
  }
  if (existingUserId) {
    await audit("registration_duplicate", {}, { email });
    return json({ ok: true, status: "email_exists" });
  }

  // The intake row is the only thing stored here. The password is created by
  // Supabase Auth from the browser and never reaches this function.
  const { data: existingRow } = await admin
    .from("public_registrations").select("id")
    .ilike("email", email).in("status", ["awaiting_confirmation", "confirmed"])
    .order("created_at", { ascending: false }).maybeSingle();

  const payload = {
    role, company, contact_name: contactName, email, phone, message,
    preferred_language: language, timezone, consent_at: new Date().toISOString(),
    ip_hash: ipHash, user_agent: userAgent, status: "awaiting_confirmation",
    source: "public_registration",
  };

  let registrationId = existingRow?.id ?? null;
  if (registrationId) {
    await admin.from("public_registrations").update(payload).eq("id", registrationId);
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("public_registrations").insert(payload).select("id").maybeSingle();
    if (insertError || !inserted) return json({ error: "Could not save your registration." }, 400);
    registrationId = inserted.id;
  }

  await audit("registration_submitted", { language }, { email, registration_id: registrationId });

  return json({ ok: true, status: "ready", registrationId });
});
