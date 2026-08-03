import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { safeRedirect } from "../_shared/publicUrl.ts";

// Public self-registration for clients and suppliers.
// This function is intentionally reachable without a session, so every branch is
// defensive: the public link must be enabled, the secret path code must match,
// input is validated and throttled, and nothing here ever touches operational
// project, pricing or supplier data. A submission only creates an isolated
// `public_registrations` row plus an email-confirmation link.

type Role = "client" | "supplier";

type Body = {
  action?: "info" | "submit" | "claim";
  role?: string;
  code?: string;
  company?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  message?: string;
  website?: string; // honeypot — must stay empty
  elapsedMs?: number;
  redirectTo?: string;
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

  if (action !== "submit") return json({ error: "Unknown action." }, 400);
  if (!linkOpen) return json({ error: "This registration link is closed." }, 403);

  // ---- bot and abuse protection ---------------------------------------------
  if (clean(body.website, 200)) {
    await audit("registration_blocked", { reason: "honeypot" });
    return json({ ok: true, submitted: true }); // silent for bots
  }
  if (typeof body.elapsedMs === "number" && body.elapsedMs < 2500) {
    await audit("registration_blocked", { reason: "too_fast" });
    return json({ error: "Please take a moment and try again." }, 429);
  }

  const email = clean(body.email, 200).toLowerCase();
  const contactName = clean(body.contactName, 120);
  const company = clean(body.company, 160);
  const phone = clean(body.phone, 40);
  const message = clean(body.message, 1000);

  if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (contactName.length < 2) return json({ error: "Please enter your name." }, 400);
  if (role === "client" && company.length < 2) return json({ error: "Please enter your company name." }, 400);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: perIp } = await admin
    .from("public_registrations").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("created_at", hourAgo);
  if ((perIp ?? 0) >= 3) {
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

  const { data: duplicate } = await admin
    .from("public_registrations").select("id, status")
    .ilike("email", email).in("status", ["awaiting_confirmation", "confirmed", "converted"]).maybeSingle();
  if (duplicate) {
    await audit("registration_duplicate", {}, { email, registration_id: duplicate.id });
    return json({
      ok: true, submitted: true, duplicate: true,
      notice: "We already have a registration for this email. Check your inbox for the confirmation link.",
    });
  }

  const { data: inserted, error: insertError } = await admin.from("public_registrations").insert({
    role, company, contact_name: contactName, email, phone, message,
    ip_hash: ipHash, user_agent: userAgent, status: "awaiting_confirmation",
  }).select("id").maybeSingle();
  if (insertError || !inserted) return json({ error: "Could not save your registration." }, 400);

  const redirectTo = safeRedirect(body.redirectTo, "/");

  // ---- immediate access for a brand-new email address --------------------------
  // A person who is not already known to the system is let straight in so they can
  // start with the assistant. This never grants access to an existing account:
  // if the address already has a login, we fall back to the emailed link below.
  const anonForSignIn = createClient(SUPABASE_URL, ANON_KEY);
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

  if (!existingUserId) {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role, full_name: contactName },
    });
    const userId = createdUser?.user?.id ?? null;

    if (createUserError) {
      const probeUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      const probeLink = await admin.auth.admin.generateLink({
        type: "signup", email, password: crypto.randomUUID(), options: { redirectTo },
      });
      return json({ error: `debug: create=${createUserError.name}/${createUserError.status} list=${probeUsers.error ? probeUsers.error.name + "/" + probeUsers.error.status : "ok:" + probeUsers.data.users.length} link=${probeLink.error ? probeLink.error.name + "/" + probeLink.error.status + "/" + probeLink.error.message : "ok"}` }, 400);
    }

    if (!createUserError && userId) {
      let clientId: string | null = null;
      let supplierId: string | null = null;

      if (role === "client") {
        const { data: created } = await admin.from("clients").insert({
          name: contactName,
          company: company || contactName,
          email,
          phone: phone || null,
          status: "lead",
          notes: "Self-registered through the public client link.",
        }).select("id").maybeSingle();
        clientId = created?.id ?? null;
      } else {
        const { data: created } = await admin.from("suppliers").insert({
          name: contactName,
          email,
          phone: phone || null,
          status: "pending_review",
        }).select("id").maybeSingle();
        supplierId = created?.id ?? null;
      }

      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId,
        email,
        full_name: contactName,
        role,
        client_id: clientId,
        supplier_id: supplierId,
        is_active: true,
      });
      if (profileError) console.error("[public-registration] profile upsert failed", profileError.message);

      // A one-time token the browser exchanges for its own session. It is bound to
      // the address we just created, so no existing account can be reached with it.
      let tokenHash: string | null = null;
      if (!profileError) {
        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });
        if (linkError) console.error("[public-registration] generateLink failed", linkError.message);
        tokenHash = (linkData?.properties?.hashed_token as string | undefined) ?? null;
      }

      if (!profileError && tokenHash) {
        const now = new Date().toISOString();
        await admin.from("public_registrations").update({
          status: "converted",
          confirmed_at: now,
          converted_at: now,
          profile_id: userId,
          client_id: clientId,
          supplier_id: supplierId,
          seen_by_admin: false,
        }).eq("id", inserted.id);

        await audit("registration_submitted", { immediateAccess: true }, {
          email, registration_id: inserted.id,
        });

        return json({
          ok: true,
          submitted: true,
          immediateAccess: true,
          tokenHash,
          notice: "You're in — let's get started.",
        });
      }

      // Provisioning did not complete: remove the half-created login so the
      // emailed-link path below stays the single way in.
      await admin.auth.admin.deleteUser(userId);
    }
  }

  // Confirmation email: a magic link proves the address is real. No profile is
  // created here — provisioning happens in `claim`, after the link is clicked.
  const { error: otpError } = await anonForSignIn.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });

  await audit("registration_submitted", { emailed: !otpError }, { email, registration_id: inserted.id });

  return json({
    ok: true,
    submitted: true,
    emailed: !otpError,
    notice: otpError
      ? "Your details were received. We will be in touch shortly."
      : "Check your inbox — click the confirmation link to continue.",
  });
});