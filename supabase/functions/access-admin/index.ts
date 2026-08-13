import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { safeRedirect } from "../_shared/publicUrl.ts";

// Server-side access administration for agency admins only.
// Never exposes the service-role key; every branch re-checks the caller's role.

type Role = "agency_admin" | "client" | "supplier";

type Body = {
  action?:
    | "list" | "invite" | "link" | "setActive"
    | "quickInviteClient" | "quickInviteSupplier" | "listInvitations"
    | "registrationSettings" | "setRegistrationSettings"
    | "listRegistrations" | "reviewRegistration" | "markRegistrationsSeen"
    | "projectContinuationLink";
  email?: string;
  fullName?: string;
  role?: Role;
  clientId?: string | null;
  supplierId?: string | null;
  userId?: string;
  projectId?: string;
  isActive?: boolean;
  redirectTo?: string;
  company?: string;
  contactName?: string;
  phone?: string;
  registrationId?: string;
  decision?: "approve" | "reject" | "block";
  notes?: string;
  enabled?: boolean;
  dailyLimit?: number;
  introText?: string;
  rotateCode?: boolean;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anon.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
  const callerId = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", callerId)
    .maybeSingle();
  if (!callerProfile || callerProfile.role !== "agency_admin" || callerProfile.is_active !== true) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const redirectTo = safeRedirect(body.redirectTo, "/reset-password");

  // ---- helpers -------------------------------------------------------------
  async function authUsers() {
    const map = new Map<string, Record<string, unknown>>();
    let page = 1;
    // Small internal team; a couple of pages is plenty.
    while (page <= 10) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      for (const u of data.users) map.set(u.id, u as unknown as Record<string, unknown>);
      if (data.users.length < 200) break;
      page += 1;
    }
    return map;
  }

  async function listAccounts() {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, full_name, email, role, client_id, supplier_id, is_active, created_at")
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 400);
    const users = await authUsers();
    const accounts = (profiles ?? []).map((p) => {
      const u = users.get(p.id) as any;
      const lastSignInAt = u?.last_sign_in_at ?? null;
      const invitationStatus = p.is_active === false ? "disabled" : lastSignInAt ? "active" : "pending";
      return {
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        role: p.role,
        clientId: p.client_id,
        supplierId: p.supplier_id,
        isActive: p.is_active,
        createdAt: p.created_at,
        invitedAt: u?.invited_at ?? u?.created_at ?? null,
        lastSignInAt,
        invitationStatus,
      };
    });
    return json({ accounts });
  }

  async function actionLinkFor(email: string) {
    // A recovery link lets the invited person set a password. The link is bound to
    // the email address and expires per the project's Supabase auth settings.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(error?.message ?? "Could not generate an invitation link.");
    }
    return data.properties.action_link as string;
  }

  async function ensureClientLeadThread(profileId: string, clientId: string, invitationId?: string | null) {
    const { count: projectCount } = await admin.from("projects")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    if ((projectCount ?? 0) > 0) return null;

    const { data: currentThread } = await admin.from("lead_conversations")
      .select("id, status")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (!currentThread) {
      const { error } = await admin.from("lead_conversations").insert({
        profile_id: profileId,
        client_id: clientId,
        invitation_id: invitationId ?? null,
        status: "invited",
      });
      return error?.message ?? null;
    }
    if (currentThread.status === "promoted") return null;
    const { error } = await admin.from("lead_conversations").update({
      client_id: clientId,
      invitation_id: invitationId ?? null,
      status: "invited",
      pause_message: "",
      disqualification_reason: "",
    }).eq("id", currentThread.id);
    return error?.message ?? null;
  }

  // ---- actions -------------------------------------------------------------
  const action = body.action ?? "list";

  if (action === "list") return listAccounts();

  // ---- project continuation link -------------------------------------------
  // A single-use link for one specific project: the client only chooses a
  // password and lands straight in the project that was started in the meeting.
  if (action === "projectContinuationLink") {
    const projectId = (body.projectId ?? "").trim();
    if (!projectId) return json({ error: "A project is required." }, 400);

    const { data: project } = await admin
      .from("projects").select("id, name, client_id").eq("id", projectId).maybeSingle();
    if (!project?.client_id) return json({ error: "This project has no linked client yet." }, 400);

    const { data: client } = await admin
      .from("clients").select("id, name, company, email, phone").eq("id", project.client_id).maybeSingle();
    if (!client) return json({ error: "This project has no linked client yet." }, 400);

    const provided = (body.email ?? "").trim().toLowerCase();
    let email = String(client.email ?? "").trim().toLowerCase();
    if (provided) {
      if (!EMAIL_RE.test(provided)) return json({ error: "A valid email is required." }, 400);
      if (provided !== email) {
        await admin.from("clients").update({ email: provided }).eq("id", client.id);
      }
      email = provided;
    }
    if (!EMAIL_RE.test(email)) return json({ error: "missing_client_email" }, 400);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invitation, error: invitationError } = await admin
      .from("onboarding_invitations")
      .insert({
        role: "client",
        contact_name: client.name ?? "",
        company: client.company ?? "",
        email,
        phone: client.phone ?? "",
        client_id: client.id,
        project_id: project.id,
        expires_at: expiresAt,
        created_by: callerId,
        status: "pending",
      })
      .select("token")
      .maybeSingle();
    if (invitationError || !invitation) {
      return json({ error: invitationError?.message ?? "Could not create the link." }, 400);
    }

    const base = safeRedirect("/", "/").replace(/\/$/, "");
    const link = `${base}/continue?t=${invitation.token}`;
    await admin.from("onboarding_invitations")
      .update({ invite_link: link }).eq("token", invitation.token);

    return json({ ok: true, link, email, projectName: project.name });
  }

  if (action === "listInvitations") {
    const { data, error } = await admin
      .from("onboarding_invitations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return json({ error: error.message }, 400);
    return json({ invitations: data ?? [] });
  }

  // ---- public self-registration administration -------------------------------
  if (action === "registrationSettings") {
    const { data, error } = await admin.from("registration_settings").select("*").order("role");
    if (error) return json({ error: error.message }, 400);
    return json({ settings: data ?? [] });
  }

  if (action === "setRegistrationSettings") {
    const role = body.role;
    if (role !== "client" && role !== "supplier") return json({ error: "Invalid link role." }, 400);
    const patch: Record<string, unknown> = { updated_by: callerId };
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.dailyLimit === "number" && body.dailyLimit >= 1 && body.dailyLimit <= 500) {
      patch.dailyLimit = undefined;
      patch.daily_limit = Math.round(body.dailyLimit);
    }
    if (typeof body.introText === "string") patch.intro_text = body.introText.slice(0, 600);
    if (body.rotateCode) {
      patch.path_code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    }
    delete patch.dailyLimit;
    const { data, error } = await admin
      .from("registration_settings").update(patch).eq("role", role).select("*").maybeSingle();
    if (error) return json({ error: error.message }, 400);
    await admin.from("registration_audit_log").insert({
      event: body.rotateCode ? "link_rotated" : "settings_updated",
      role, actor_profile_id: callerId, detail: patch as Record<string, unknown>,
    });
    return json({ ok: true, settings: data });
  }

  if (action === "listRegistrations") {
    const { data, error } = await admin
      .from("public_registrations").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return json({ error: error.message }, 400);
    return json({ registrations: data ?? [] });
  }

  if (action === "markRegistrationsSeen") {
    const { error } = await admin
      .from("public_registrations").update({ seen_by_admin: true }).eq("seen_by_admin", false);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === "reviewRegistration") {
    const registrationId = body.registrationId;
    const decision = body.decision;
    if (!registrationId) return json({ error: "registrationId is required." }, 400);
    if (!decision || !["approve", "reject", "block"].includes(decision)) {
      return json({ error: "Invalid decision." }, 400);
    }
    const { data: registration } = await admin
      .from("public_registrations").select("*").eq("id", registrationId).maybeSingle();
    if (!registration) return json({ error: "Registration not found." }, 404);

    const notes = (body.notes ?? "").slice(0, 1000);
    const now = new Date().toISOString();

    if (decision !== "approve") {
      if (registration.profile_id) {
        await admin.from("profiles").update({ is_active: false }).eq("id", registration.profile_id);
      }
      const { error } = await admin.from("public_registrations").update({
        status: decision === "block" ? "blocked" : "rejected",
        reviewed_at: now, reviewed_by: callerId, review_notes: notes, seen_by_admin: true,
      }).eq("id", registrationId);
      if (error) return json({ error: error.message }, 400);
      await admin.from("registration_audit_log").insert({
        event: decision === "block" ? "registration_blocked" : "registration_rejected",
        role: registration.role, email: registration.email,
        registration_id: registrationId, actor_profile_id: callerId,
      });
      return json({ ok: true });
    }

    // Approve: make sure the person has an active, correctly scoped account.
    let clientId: string | null = registration.client_id;
    let supplierId: string | null = registration.supplier_id;
    const email = String(registration.email).toLowerCase();
    const role: Role = registration.role === "supplier" ? "supplier" : "client";

    if (role === "client" && !clientId) {
      const { data: created } = await admin.from("clients").insert({
        name: registration.contact_name,
        company: registration.company || registration.contact_name,
        email, phone: registration.phone || null, status: "lead",
        notes: "Approved from a public registration.",
      }).select("id").maybeSingle();
      clientId = created?.id ?? null;
    }
    if (role === "supplier" && !supplierId) {
      const { data: created } = await admin.from("suppliers").insert({
        name: registration.contact_name, email,
        phone: registration.phone || null, status: "pending_review",
      }).select("id").maybeSingle();
      supplierId = created?.id ?? null;
    }

    let userId: string | null = registration.profile_id;
    if (!userId) {
      const { data: invited } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { role, full_name: registration.contact_name, client_id: clientId, supplier_id: supplierId },
        redirectTo,
      });
      if (invited?.user) userId = invited.user.id;
      else {
        const users = await authUsers();
        for (const [id, u] of users) {
          if (String((u as any).email ?? "").toLowerCase() === email) { userId = id; break; }
        }
      }
    }
    if (!userId) return json({ error: "Could not create an account for this registration." }, 400);
    if (userId === callerId) return json({ error: "This is your own account." }, 400);

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId, email, full_name: registration.contact_name, role,
      client_id: clientId, supplier_id: supplierId, is_active: true,
    });
    if (profileError) return json({ error: profileError.message }, 400);
    if (role === "client" && clientId) {
      const threadError = await ensureClientLeadThread(userId, clientId);
      if (threadError) return json({ error: threadError }, 400);
    }

    let link: string | null = null;
    try { link = await actionLinkFor(email); } catch { link = null; }

    await admin.from("public_registrations").update({
      status: "converted", reviewed_at: now, reviewed_by: callerId, review_notes: notes,
      converted_at: registration.converted_at ?? now, seen_by_admin: true,
      profile_id: userId, client_id: clientId, supplier_id: supplierId,
    }).eq("id", registrationId);

    await admin.from("registration_audit_log").insert({
      event: "registration_approved", role, email,
      registration_id: registrationId, actor_profile_id: callerId,
    });

    return json({ ok: true, link, clientId, supplierId, userId });
  }

  // ---- AI-first quick invitations ------------------------------------------
  // Minimal input only: everything else is collected by the AI assistant during
  // the invited person's onboarding conversation.
  if (action === "quickInviteClient" || action === "quickInviteSupplier") {
    const isClient = action === "quickInviteClient";
    const email = (body.email ?? "").trim().toLowerCase();
    const contactName = (body.contactName ?? "").trim();
    const company = (body.company ?? "").trim();
    const phone = (body.phone ?? "").trim();

    if (!EMAIL_RE.test(email)) return json({ error: "A valid email is required." }, 400);
    if (!contactName) return json({ error: "A contact name is required." }, 400);
    if (isClient && !company) return json({ error: "A company or client name is required." }, 400);

    let clientId: string | null = null;
    let supplierId: string | null = null;

    if (isClient) {
      const { data: existing } = await admin
        .from("clients").select("id").ilike("email", email).maybeSingle();
      if (existing?.id) {
        clientId = existing.id;
        await admin.from("clients")
          .update({ name: contactName, company, phone: phone || null }).eq("id", existing.id);
      } else {
        const { data: created, error } = await admin.from("clients").insert({
          name: contactName, company, email, phone: phone || null,
          notes: "Created from an AI-first invitation.", status: "lead",
        }).select("id").maybeSingle();
        if (error || !created) return json({ error: error?.message ?? "Could not create the client." }, 400);
        clientId = created.id;
      }
    } else {
      const { data: existing } = await admin
        .from("suppliers").select("id").ilike("email", email).maybeSingle();
      if (existing?.id) {
        supplierId = existing.id;
        await admin.from("suppliers").update({ name: contactName, phone: phone || null }).eq("id", existing.id);
      } else {
        const { data: created, error } = await admin.from("suppliers").insert({
          name: contactName, email, phone: phone || null, status: "pending_review",
        }).select("id").maybeSingle();
        if (error || !created) return json({ error: error?.message ?? "Could not create the supplier." }, 400);
        supplierId = created.id;
      }
    }

    // Reuse the existing, proven invitation security: a Supabase auth invite plus
    // a signed single-use action link bound to this email address.
    let userId: string | null = null;
    const role: Role = isClient ? "client" : "supplier";
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role, full_name: contactName, client_id: clientId, supplier_id: supplierId },
      redirectTo,
    });
    if (invited?.user) {
      userId = invited.user.id;
    } else {
      const users = await authUsers();
      for (const [id, u] of users) {
        if (String((u as any).email ?? "").toLowerCase() === email) { userId = id; break; }
      }
      if (!userId) return json({ error: inviteError?.message ?? "Could not invite this contact." }, 400);
    }
    if (userId === callerId) {
      return json({ error: "This is your own account. Use a different email address." }, 400);
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId, email, full_name: contactName, role,
      client_id: clientId, supplier_id: supplierId, is_active: true,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    let link: string | null = null;
    try { link = await actionLinkFor(email); } catch { link = null; }

    const { data: invitation, error: invitationError } = await admin.from("onboarding_invitations").insert({
      role, contact_name: contactName, company, email, phone,
      client_id: clientId, supplier_id: supplierId, invited_profile_id: userId,
      invite_link: link ?? "", emailed: Boolean(invited?.user), created_by: callerId,
      status: "pending",
    }).select("*").maybeSingle();
    if (invitationError) return json({ error: invitationError.message }, 400);

    if (isClient && clientId && invitation) {
      const threadError = await ensureClientLeadThread(userId, clientId, invitation.id);
      if (threadError) return json({ error: threadError }, 400);
    }

    return json({
      ok: true, userId, clientId, supplierId, link,
      emailed: Boolean(invited?.user), invitation,
    });
  }

  if (action === "invite") {
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role;
    const fullName = (body.fullName ?? email).trim();
    const clientId = body.clientId || null;
    const supplierId = body.supplierId || null;

    if (!EMAIL_RE.test(email)) return json({ error: "A valid email is required." }, 400);
    if (!role || !["agency_admin", "client", "supplier"].includes(role)) return json({ error: "Invalid role." }, 400);
    if (role === "client" && !clientId) return json({ error: "A linked client is required for client accounts." }, 400);
    if (role === "supplier" && !supplierId) return json({ error: "A linked supplier is required for supplier accounts." }, 400);
    if (role === "agency_admin" && (clientId || supplierId)) {
      return json({ error: "Agency admins cannot be linked to a client or supplier." }, 400);
    }

    // Create the auth user (sends the invitation email when SMTP is configured).
    let userId: string | null = null;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role, full_name: fullName, client_id: clientId, supplier_id: supplierId },
      redirectTo,
    });
    if (invited?.user) {
      userId = invited.user.id;
    } else {
      // Most likely the auth user already exists — reuse it.
      const users = await authUsers();
      for (const [id, u] of users) {
        if (String((u as any).email ?? "").toLowerCase() === email) { userId = id; break; }
      }
      if (!userId) return json({ error: inviteError?.message ?? "Could not invite this user." }, 400);
    }

    // Never let an invite overwrite the caller's own account, and never demote the
    // last active agency admin — that would lock everyone out of Access Management.
    if (userId === callerId && role !== "agency_admin") {
      return json({ error: "This is your own account. You cannot re-invite yourself as a client or supplier." }, 400);
    }
    if (role !== "agency_admin") {
      const { data: existing } = await admin
        .from("profiles").select("role").eq("id", userId).maybeSingle();
      if (existing?.role === "agency_admin") {
        const { count } = await admin
          .from("profiles").select("id", { count: "exact", head: true })
          .eq("role", "agency_admin").eq("is_active", true);
        if ((count ?? 0) <= 1) {
          return json({ error: "This is the last active agency admin. Create another admin before changing this account." }, 400);
        }
      }
    }

    // The profile is written server-side only: the invited user can never choose
    // their own role, client_id or supplier_id.
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      role,
      client_id: clientId,
      supplier_id: supplierId,
      is_active: true,
    });
    if (profileError) return json({ error: profileError.message }, 400);
    if (role === "client" && clientId) {
      const threadError = await ensureClientLeadThread(userId, clientId);
      if (threadError) return json({ error: threadError }, 400);
    }

    let link: string | null = null;
    try { link = await actionLinkFor(email); } catch { link = null; }
    return json({ ok: true, userId, link, emailed: Boolean(invited?.user) });
  }

  if (action === "link") {
    const userId = body.userId;
    if (!userId) return json({ error: "userId is required." }, 400);
    const { data: target } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
    if (!target?.email) return json({ error: "No account found for this record." }, 400);
    try {
      const link = await actionLinkFor(String(target.email));
      return json({ ok: true, link });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Could not generate a link." }, 400);
    }
  }

  if (action === "setActive") {
    const userId = body.userId;
    if (!userId) return json({ error: "userId is required." }, 400);
    if (typeof body.isActive !== "boolean") return json({ error: "isActive must be true or false." }, 400);
    if (userId === callerId && body.isActive === false) {
      return json({ error: "You cannot disable your own account." }, 400);
    }
    const { error } = await admin.from("profiles").update({ is_active: body.isActive }).eq("id", userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
});
