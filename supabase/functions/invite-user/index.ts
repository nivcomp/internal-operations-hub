import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type InviteBody = {
  email?: string;
  fullName?: string;
  role?: "agency_admin" | "client" | "supplier";
  clientId?: string | null;
  supplierId?: string | null;
  redirectTo?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

  // Only an active agency admin may invite.
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", callerId)
    .maybeSingle();
  if (!callerProfile || callerProfile.role !== "agency_admin" || callerProfile.is_active !== true) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: InviteBody;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role;
  const fullName = (body.fullName ?? email).trim();
  const clientId = body.clientId || null;
  const supplierId = body.supplierId || null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "A valid email is required." }, 400);
  if (!role || !["agency_admin", "client", "supplier"].includes(role)) return json({ error: "Invalid role." }, 400);
  if (role === "client" && !clientId) return json({ error: "clientId is required for client accounts." }, 400);
  if (role === "supplier" && !supplierId) return json({ error: "supplierId is required for supplier accounts." }, 400);
  if (role === "agency_admin" && (clientId || supplierId)) return json({ error: "Agency admins cannot be linked to a client or supplier." }, 400);

  const redirectTo = typeof body.redirectTo === "string" && body.redirectTo.startsWith("http")
    ? body.redirectTo
    : undefined;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role, full_name: fullName, client_id: clientId, supplier_id: supplierId },
    redirectTo,
  });
  if (inviteError || !invited?.user) {
    return json({ error: inviteError?.message ?? "Could not invite the user." }, 400);
  }

  // The signup trigger creates the profile; upsert keeps it correct either way.
  const { error: profileError } = await admin.from("profiles").upsert({
    id: invited.user.id,
    email,
    full_name: fullName,
    role,
    client_id: clientId,
    supplier_id: supplierId,
    is_active: true,
  });
  if (profileError) return json({ error: profileError.message }, 400);

  return json({ ok: true, userId: invited.user.id });
});
