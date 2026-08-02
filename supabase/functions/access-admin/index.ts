import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Server-side access administration for agency admins only.
// Never exposes the service-role key; every branch re-checks the caller's role.

type Role = "agency_admin" | "client" | "supplier";

type Body = {
  action?: "list" | "invite" | "link" | "setActive";
  email?: string;
  fullName?: string;
  role?: Role;
  clientId?: string | null;
  supplierId?: string | null;
  userId?: string;
  isActive?: boolean;
  redirectTo?: string;
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

  const redirectTo =
    typeof body.redirectTo === "string" && body.redirectTo.startsWith("http") ? body.redirectTo : undefined;

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

  // ---- actions -------------------------------------------------------------
  const action = body.action ?? "list";

  if (action === "list") return listAccounts();

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