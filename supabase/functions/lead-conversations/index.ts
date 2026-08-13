import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type LeadStatus = "invited" | "active" | "awaiting_review" | "paused" | "disqualified" | "promoted";
type Body = {
  action?: "list" | "detail" | "message" | "setStatus" | "markRead" | "promote";
  conversationId?: string;
  body?: string;
  visibility?: "client_agency" | "agency_only";
  status?: LeadStatus;
  clientMessage?: string;
  reason?: string;
  projectName?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const MAX_MESSAGE = 4000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: claims, error: claimsError } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsError || !claims?.claims) return json({ error: "Unauthorized" }, 401);
  const callerId = claims.claims.sub as string;

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: caller } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", callerId)
    .maybeSingle();
  if (!caller || caller.role !== "agency_admin" || caller.is_active !== true) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = body.action ?? "list";

  async function loadThreads(conversationId?: string) {
    let query = admin.from("lead_conversations").select("*");
    if (conversationId) query = query.eq("id", conversationId);
    const { data: threads, error } = await query.order("updated_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    if (!threads?.length) return [];

    const profileIds = [...new Set(threads.map((thread) => String(thread.profile_id)))];
    const clientIds = [...new Set(threads.map((thread) => String(thread.client_id)))];
    const projectIds = threads.map((thread) => thread.project_id).filter(Boolean) as string[];
    const threadIds = threads.map((thread) => String(thread.id));

    const [profilesResult, clientsResult, statesResult, projectsResult, messagesResult] = await Promise.all([
      admin.from("profiles").select("id, full_name, email").in("id", profileIds),
      admin.from("clients").select("id, name, company, email, phone, status").in("id", clientIds),
      admin.from("onboarding_state").select("profile_id, answers, completion_percentage, updated_at").in("profile_id", profileIds),
      projectIds.length
        ? admin.from("projects").select("id, name, status").in("id", projectIds)
        : Promise.resolve({ data: [], error: null }),
      admin.from("lead_conversation_messages")
        .select("id, conversation_id, sender_type, sender_profile_id, body, visibility, created_at")
        .in("conversation_id", threadIds)
        .order("created_at", { ascending: true })
        .limit(2000),
    ]);

    const failures = [profilesResult.error, clientsResult.error, statesResult.error, projectsResult.error, messagesResult.error]
      .filter(Boolean);
    if (failures.length) throw new Error(failures[0]!.message);

    const profiles = new Map((profilesResult.data ?? []).map((row) => [row.id, row]));
    const clients = new Map((clientsResult.data ?? []).map((row) => [row.id, row]));
    const states = new Map((statesResult.data ?? []).map((row) => [row.profile_id, row]));
    const projects = new Map((projectsResult.data ?? []).map((row) => [row.id, row]));
    const messagesByThread = new Map<string, Array<Record<string, any>>>();
    for (const message of messagesResult.data ?? []) {
      const existing = messagesByThread.get(message.conversation_id) ?? [];
      existing.push(message);
      messagesByThread.set(message.conversation_id, existing);
    }

    return threads.map((thread) => {
      const profile = profiles.get(thread.profile_id);
      const client = clients.get(thread.client_id);
      const state = states.get(thread.profile_id);
      const project = thread.project_id ? projects.get(thread.project_id) : null;
      const messages = messagesByThread.get(thread.id) ?? [];
      const lastMessage = messages[messages.length - 1] ?? null;
      const answers = (state?.answers ?? {}) as Record<string, any>;
      const document = answers._document && typeof answers._document === "object" ? answers._document : {};
      const lastClientAt = thread.last_client_message_at ? new Date(thread.last_client_message_at).getTime() : 0;
      const lastReadAt = thread.last_agency_read_at ? new Date(thread.last_agency_read_at).getTime() : 0;
      return {
        id: thread.id,
        profileId: thread.profile_id,
        clientId: thread.client_id,
        status: thread.status,
        contactName: profile?.full_name || client?.name || profile?.email || "",
        businessName: client?.company || client?.name || "",
        email: profile?.email || client?.email || "",
        phone: client?.phone || "",
        clientStatus: client?.status || "",
        projectId: thread.project_id,
        projectName: project?.name || "",
        projectStatus: project?.status || "",
        progress: state?.completion_percentage ?? 0,
        answers,
        document,
        flow: answers._flow ?? {},
        pauseMessage: thread.pause_message || "",
        disqualificationReason: thread.disqualification_reason || "",
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        submittedAt: thread.submitted_at,
        lastClientMessageAt: thread.last_client_message_at,
        lastAgencyMessageAt: thread.last_agency_message_at,
        unread: lastClientAt > lastReadAt,
        lastMessage: lastMessage ? {
          body: lastMessage.body,
          senderType: lastMessage.sender_type,
          visibility: lastMessage.visibility,
          createdAt: lastMessage.created_at,
        } : null,
        messages,
      };
    });
  }

  try {
    if (action === "list") {
      const threads = await loadThreads();
      return json({ conversations: threads.map(({ messages: _messages, answers: _answers, flow: _flow, ...thread }) => thread) });
    }

    const conversationId = String(body.conversationId ?? "");
    if (!conversationId) return json({ error: "conversationId is required" }, 400);

    const loaded = await loadThreads(conversationId);
    const thread = loaded[0];
    if (!thread) return json({ error: "Lead conversation not found" }, 404);

    if (action === "detail") return json({ conversation: thread });

    if (action === "markRead") {
      const { error } = await admin.from("lead_conversations")
        .update({ last_agency_read_at: new Date().toISOString() })
        .eq("id", conversationId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "message") {
      if (thread.status === "promoted") return json({ error: "This lead already belongs to a project." }, 409);
      const message = String(body.body ?? "").trim();
      if (!message) return json({ error: "Write a message first." }, 400);
      if (message.length > MAX_MESSAGE) return json({ error: `Keep messages under ${MAX_MESSAGE} characters.` }, 400);
      const visibility = body.visibility === "agency_only" ? "agency_only" : "client_agency";
      const now = new Date().toISOString();
      const { error } = await admin.from("lead_conversation_messages").insert({
        conversation_id: conversationId,
        sender_type: "agency_admin",
        sender_profile_id: callerId,
        body: message,
        visibility,
        created_at: now,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("lead_conversations").update({
        last_agency_message_at: now,
        last_agency_read_at: now,
      }).eq("id", conversationId);
      return json({ conversation: (await loadThreads(conversationId))[0] });
    }

    if (action === "setStatus") {
      if (!body.status || !["active", "paused", "disqualified"].includes(body.status)) {
        return json({ error: "Invalid lead status." }, 400);
      }
      if (thread.status === "promoted") return json({ error: "A promoted lead cannot be moved back." }, 409);

      const nextStatus = body.status as "active" | "paused" | "disqualified";
      const reason = String(body.reason ?? "").trim().slice(0, 2000);
      const clientMessage = String(body.clientMessage ?? "").trim().slice(0, MAX_MESSAGE);
      const patch: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "paused") patch.pause_message = clientMessage || "השיחה הושהתה זמנית על ידי מנהל הפרויקט.";
      if (nextStatus === "active") {
        patch.pause_message = "";
        patch.disqualification_reason = "";
      }
      if (nextStatus === "disqualified") {
        patch.disqualification_reason = reason;
        patch.pause_message = "";
      }
      const { error } = await admin.from("lead_conversations").update(patch).eq("id", conversationId);
      if (error) return json({ error: error.message }, 400);

      await admin.from("clients").update({ status: nextStatus === "active" ? "lead" : "paused" }).eq("id", thread.clientId);

      const visibleBody = clientMessage || (nextStatus === "active"
        ? "השיחה פתוחה שוב ואפשר להמשיך מכאן."
        : nextStatus === "paused"
          ? "השיחה הושהתה זמנית על ידי מנהל הפרויקט."
          : "תודה על השיחה. בשלב זה התהליך נסגר.");
      if (visibleBody) {
        const now = new Date().toISOString();
        await admin.from("lead_conversation_messages").insert({
          conversation_id: conversationId,
          sender_type: "agency_admin",
          sender_profile_id: callerId,
          body: visibleBody,
          visibility: "client_agency",
          created_at: now,
        });
        await admin.from("lead_conversations").update({ last_agency_message_at: now }).eq("id", conversationId);
      }
      if (reason) {
        await admin.from("lead_conversation_messages").insert({
          conversation_id: conversationId,
          sender_type: "agency_admin",
          sender_profile_id: callerId,
          body: reason,
          visibility: "agency_only",
        });
      }
      return json({ conversation: (await loadThreads(conversationId))[0] });
    }

    if (action === "promote") {
      if (thread.status === "disqualified") return json({ error: "Resume the lead before promoting it." }, 409);
      const { data: projectId, error } = await anon.rpc("promote_client_onboarding", {
        _profile_id: thread.profileId,
        _project_name: String(body.projectName ?? "").trim() || null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, projectId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "Lead conversation request failed." }, 400);
  }
});
