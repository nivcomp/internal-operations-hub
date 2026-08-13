import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  cancelProposedAction, confirmProposedAction, loadChatHistory, sendChatMessage,
  type ActionKind, type AgentType, type ChatArtifact, type ChatDraft, type ChatMessage, type ChatUsage, type PendingAction,
} from "../services/chatApi";
import { notifyEstimationChanged } from "../lib/estimationEvents";
import { detectProjectViewIntent, requestProjectView } from "../lib/projectViewEvents";
import { startRecording, type Recorder } from "../lib/voice";
import { transcribeAudio } from "../services/copilotApi";
import { uploadProjectFile } from "../services/projectFilesApi";
import { supabase } from "../integrations/supabase/client";
import { buildClientProcessExplanation, type ClientProcessNodeData } from "../lib/clientProcessExplanation";
import { ProcessNode } from "./client/ProcessNode";
import { ProcessNodeDetails, type ProcessDetailsSelection } from "./client/ProcessNodeDetails";

type ProjectChatProps = {
  projectId: string;
  projectName: string;
  agent: AgentType;
  title: string;
  subtitle: string;
  /** Agency admin sees the visibility label of each message. */
  showVisibility?: boolean;
  /** Preview mode: reading is allowed, writing is not. */
  readOnly?: boolean;
  readOnlyReason?: string;
  suggestions?: string[];
  /** Shown above the composer for client and supplier chats. */
  safetyNotice?: string;
  /** Interface language for the surrounding labels. */
  language?: "he" | "en";
  /** Shows one "+" button that attaches a document to the project. */
  allowAttachments?: boolean;
  onFileUploaded?: () => void;
  /** Applies a final presentation boundary even if an upstream payload contains internal fields. */
  clientSafe?: boolean;
};

const chatCopy = {
  he: {
    refresh: "רענן", loading: "טוען את השיחה…", empty: "עוד אין הודעות. אפשר להתחיל לכתוב למטה.",
    thinking: "חושב…", retry: "נסה שוב", dismiss: "סגור", send: "שלח", sending: "שולח…",
    placeholder: "כתוב הודעה…", disabled: "שליחה מושבתת בתצוגה מקדימה",
    attach: "➕ צרף מסמך", uploading: "מעלה…", uploaded: "המסמך נוסף לפרויקט",
    senders: { client: "אתם", agency_admin: "הצוות", supplier: "ספק", ai_agent: "עוזר AI", system: "המערכת" },
    artifact: { flow: "תרשים תהליך", wireframe: "סקיצה", table: "טבלה", checklist: "רשימה", download: "הורד כתמונה", copy: "העתק קישור לפורטל", copied: "הקישור הועתק", email: "פתח טיוטת מייל" },
    waitingConfirmation: "ממתין לאישור שלך", openQuestions: "שאלות פתוחות", notAllowed: "פעולות שלא ניתן לבצע",
    usagePaused: "ה־AI מושהה כרגע", usageToday: (used: number, limit: number) => `${used}/${limit} הודעות היום`,
  },
  en: {
    refresh: "Refresh", loading: "Loading conversation…", empty: "No messages yet. Start the conversation below.",
    thinking: "Thinking…", retry: "Retry", dismiss: "Dismiss", send: "Send", sending: "Sending…",
    placeholder: "Write your message… (Hebrew or English)", disabled: "Sending is disabled in preview mode",
    attach: "➕ Attach a document", uploading: "Uploading…", uploaded: "Document added to the project",
    senders: { client: "You", agency_admin: "Agency", supplier: "Supplier", ai_agent: "AI assistant", system: "System" },
    artifact: { flow: "Process flow", wireframe: "Wireframe", table: "Table", checklist: "Checklist", download: "Download as image", copy: "Copy portal link", copied: "Link copied", email: "Open email draft" },
    waitingConfirmation: "Waiting for your confirmation", openQuestions: "Open questions", notAllowed: "Actions that cannot be performed",
    usagePaused: "AI is paused for now", usageToday: (used: number, limit: number) => `${used}/${limit} messages today`,
  },
} as const;

const actionLabels: Record<ActionKind, string> = {
  add_estimate_items: "Add work items to the estimate",
  update_estimate_items: "Change estimate work items",
  update_estimate_settings: "Change commercial settings",
  assign_supplier: "Assign work to a supplier",
  request_supplier_review: "Request a supplier review",
  accept_supplier_review: "Use supplier-reviewed hours",
  publish_client_estimate: "Publish the estimate to the client",
  approve_fixed_price: "Approve a fixed price",
  save_client_scenario: "Save this budget scenario",
  supplier_review_response: "Send this review to the agency",
  create_change_request: "Create a change request",
};

const confirmLabels: Record<ActionKind, string> = {
  add_estimate_items: "Confirm and add",
  update_estimate_items: "Confirm and update",
  update_estimate_settings: "Confirm and update",
  assign_supplier: "Confirm assignment",
  request_supplier_review: "Confirm and request",
  accept_supplier_review: "Confirm and apply",
  publish_client_estimate: "Confirm and publish",
  approve_fixed_price: "Approve fixed price",
  save_client_scenario: "Save scenario",
  supplier_review_response: "Send to agency",
  create_change_request: "Create change request",
};

const visibilityLabels: Record<ChatMessage["visibility"], string> = {
  client_agency: "Client + agency",
  supplier_agency: "Supplier + agency",
  agency_only: "Agency only",
  shared_all: "Shared with all",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function isRtl(text: string) {
  return /[\u0590-\u05FF\u0600-\u06FF]/.test(text);
}

const xml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);

function downloadArtifactImage(artifact: ChatArtifact, projectName: string) {
  const entries = artifact.nodes?.length ? artifact.nodes.map((node) => `${node.label}${node.detail ? ` — ${node.detail}` : ""}`)
    : artifact.items?.length ? artifact.items
      : artifact.rows?.map((row) => row.join(" · ")) ?? [];
  const width = 1200;
  const height = Math.max(500, 230 + entries.length * 72);
  const rows = entries.slice(0, 14).map((entry, index) => `<g transform="translate(80 ${205 + index * 72})"><rect width="1040" height="54" rx="14" fill="${index % 2 ? "#f4f8f7" : "#e7f3f0"}"/><circle cx="30" cy="27" r="16" fill="#0f766e"/><text x="30" y="33" text-anchor="middle" font-size="16" font-weight="700" fill="white">${index + 1}</text><text x="62" y="33" font-size="20" fill="#172033">${xml(entry.slice(0, 92))}</text></g>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/><rect x="40" y="40" width="1120" height="${height - 80}" rx="28" fill="#fbfdfc" stroke="#cbd5e1"/><text x="80" y="100" font-family="Arial,sans-serif" font-size="18" fill="#0f766e">${xml(projectName)}</text><text x="80" y="148" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#172033">${xml(artifact.title)}</text>${rows}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${artifact.type}-${projectName}`.replace(/[^\p{L}\p{N}._-]+/gu, "-") + ".svg";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ArtifactPanel({
  artifact,
  projectId,
  projectName,
  language,
}: {
  artifact: ChatArtifact;
  projectId: string;
  projectName: string;
  language: "he" | "en";
}) {
  const [copied, setCopied] = useState(false);
  const [processSelection, setProcessSelection] = useState<ProcessDetailsSelection | null>(null);
  const artifactText = chatCopy[language].artifact;
  const kind = artifactText[artifact.type];
  const portalUrl = `${window.location.origin}/?portalProject=${encodeURIComponent(projectId)}`;
  async function copyPortalLink() {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy portal link", portalUrl);
    }
  }
  const emailHref = `mailto:?subject=${encodeURIComponent(`${projectName} — ${artifact.title}`)}&body=${encodeURIComponent(`הסקיצה והפרויקט זמינים בפורטל הלקוח:\n${portalUrl}`)}`;
  return <section className={`chat-artifact artifact-${artifact.type}`} dir={language === "he" ? "rtl" : "ltr"}><header><span>{kind}</span><strong>{artifact.title}</strong></header>{artifact.description ? <p>{artifact.description}</p> : null}
    {artifact.type === "flow" ? <div className="artifact-flow">{(artifact.nodes ?? []).map((artifactNode, index) => {
      const node: ClientProcessNodeData = { id: artifactNode.id || `artifact-step-${index}`, label: artifactNode.label, detail: artifactNode.detail };
      const explanation = buildClientProcessExplanation(node, language);
      const active = processSelection?.type === "node" && processSelection.node.id === node.id;
      return <div key={node.id} className="artifact-flow-step"><ProcessNode node={node} explanation={explanation} language={language} active={active} onOpen={() => setProcessSelection({ type: "node", node, explanation })} onOpenTerm={(term) => setProcessSelection({ type: "term", term })} />{index < (artifact.nodes?.length ?? 0) - 1 ? <span className="artifact-flow-arrow" aria-hidden="true">{language === "he" ? "←" : "→"}</span> : null}</div>;
    })}</div> : null}
    {artifact.type === "wireframe" ? <div className="artifact-wireframe">{(artifact.nodes ?? []).map((node, index) => <article key={node.id || index}><header><span className="artifact-window-dots" aria-hidden="true"><i /><i /><i /></span><strong>{node.label}</strong></header><div className="artifact-screen-body"><span className="artifact-screen-hero" /><span className="artifact-screen-line wide" /><span className="artifact-screen-line" />{node.detail ? <p>{node.detail}</p> : null}<span className="artifact-screen-action">פעולה</span></div></article>)}</div> : null}
    {artifact.type === "table" && artifact.columns?.length ? <div className="table-scroll"><table><thead><tr>{artifact.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{(artifact.rows ?? []).map((row, rowIndex) => <tr key={rowIndex}>{artifact.columns!.map((_, cellIndex) => <td key={cellIndex}>{row[cellIndex] ?? ""}</td>)}</tr>)}</tbody></table></div> : null}
    {artifact.type === "checklist" ? <ul className="artifact-checklist">{(artifact.items ?? []).map((item, index) => <li key={index}>✓ {item}</li>)}</ul> : null}
    <footer className="artifact-share-actions"><button type="button" onClick={() => downloadArtifactImage(artifact, projectName)}>{artifactText.download}</button><button type="button" onClick={() => void copyPortalLink()}>{copied ? artifactText.copied : artifactText.copy}</button><a href={emailHref}>{artifactText.email}</a></footer>
    <ProcessNodeDetails selection={processSelection} language={language} onClose={() => setProcessSelection(null)} />
  </section>;
}

function DraftPanel({ draft }: { draft: ChatDraft }) {
  const entries = Object.entries(draft.payload ?? {}).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
  if (entries.length === 0) return null;
  return (
    <div className="chat-draft">
      <p className="chat-draft-flag">AI draft — awaiting agency review</p>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/_/g, " ")}</dt>
            <dd>{Array.isArray(value) ? value.map(String).join(" · ") : String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ActionCard({
  action, busy, error, clientSafe, onConfirm, onCancel,
}: {
  action: PendingAction;
  busy: boolean;
  error: string | null;
  clientSafe: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const preview = action.preview ?? {};
  const label = actionLabels[action.action_kind] ?? action.action_kind.replace(/_/g, " ");
  const summary = String(action.payload?.summary ?? preview.requested ?? "");
  const highRisk = action.action_kind === "approve_fixed_price" || action.action_kind === "publish_client_estimate";
  return (
    <div className={`action-card${highRisk ? " action-card-critical" : ""}`}>
      <p className="chat-draft-flag">AI proposal — nothing has changed yet</p>
      <h4>{label}</h4>
      {summary && <p className="action-card-summary" dir={isRtl(summary) ? "rtl" : "ltr"}>{summary}</p>}

      {(preview.current?.length || preview.proposed?.length) && (
        <div className="action-card-compare">
          <div>
            <h5>Now</h5>
            <ul>{(preview.current ?? []).map((row, i) => <li key={i}><span>{row.label}</span><strong>{row.value}</strong></li>)}</ul>
          </div>
          <div>
            <h5>After confirming</h5>
            <ul>{(preview.proposed ?? []).map((row, i) => <li key={i}><span>{row.label}</span><strong>{row.value}</strong></li>)}</ul>
          </div>
        </div>
      )}

      {(preview.records ?? []).length > 0 && (
        <details className="action-card-records">
          <summary>{(preview.records ?? []).length} record(s) affected</summary>
          <ul>{(preview.records ?? []).map((r, i) => <li key={i}>{r}</li>)}</ul>
        </details>
      )}

      <dl className="action-card-effects">
        {preview.client_visibility_effect && (
          <div><dt>Client visibility</dt><dd>{preview.client_visibility_effect}</dd></div>
        )}
        {!clientSafe && preview.internal_cost_effect && (
          <div><dt>Internal cost</dt><dd>{preview.internal_cost_effect}</dd></div>
        )}
        {!clientSafe && preview.margin_effect && (
          <div><dt>Margin</dt><dd>{preview.margin_effect}</dd></div>
        )}
      </dl>

      {error && <p className="chat-error-inline">{error}</p>}
      <div className="action-row">
        <button type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Applying…" : confirmLabels[action.action_kind] ?? "Confirm"}
        </button>
        <button type="button" className="ghost-button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      <p className="chat-hint">To change the details, ask the assistant to adjust the proposal, then confirm the new one.</p>
    </div>
  );
}

export function ProjectChat({
  projectId, projectName, agent, title, subtitle,
  showVisibility = false, readOnly = false, readOnlyReason, suggestions = [], safetyNotice,
  language = "en", allowAttachments = false, onFileUploaded, clientSafe = false,
}: ProjectChatProps) {
  const text = chatCopy[language];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<ChatDraft[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [aiState, setAiState] = useState<"idle" | "thinking" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const data = await loadChatHistory(agent, projectId);
      setMessages(data.messages ?? []);
      setDrafts(data.drafts ?? []);
      setPendingActions(data.pendingActions ?? []);
      setUsage(data.usage ?? null);
      setLoadState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadState("error");
    }
  }, [agent, projectId]);

  useEffect(() => { void load(); }, [load]);

  // Live sync: a message written by the client (or the agency) in another
  // session appears here without a manual refresh.
  const aiStateRef = useRef(aiState);
  aiStateRef.current = aiState;
  useEffect(() => {
    let timer = 0;
    const channel = supabase
      .channel(`chat-${agent}-${projectId}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `project_id=eq.${projectId}` },
        () => {
          if (aiStateRef.current === "thinking") return;
          window.clearTimeout(timer);
          timer = window.setTimeout(() => { void load(); }, 500);
        },
      )
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [agent, projectId, load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, aiState]);

  useEffect(() => {
    if (!readOnly && loadState === "ready") inputRef.current?.focus();
  }, [readOnly, loadState, projectId]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || aiState === "thinking" || readOnly) return;
    setInput("");
    setError(null);
    setLastFailedText(null);
    setAiState("thinking");
    // "Show me the project flow" / "print the report" open the panels already on
    // this screen. The message still goes to the AI so the answer stays in context.
    const intent = detectProjectViewIntent(trimmed);
    if (intent) requestProjectView(projectId, intent);
    try {
      const result = await sendChatMessage(agent, projectId, trimmed);
      setUsage(result.usage ?? null);
      setMessages((prev) => [...prev, result.userMessage, result.aiMessage]);
      if (result.draft) setDrafts((prev) => [result.draft as ChatDraft, ...prev].slice(0, 5));
      if (result.pendingActions?.length) {
        setPendingActions((prev) => [...result.pendingActions, ...prev]);
      }
      setAiState("idle");
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLastFailedText(trimmed);
      setAiState("failed");
      void load();
    }
  }, [agent, projectId, aiState, readOnly, load]);

  const confirmAction = useCallback(async (action: PendingAction) => {
    setActionBusyId(action.id);
    setActionErrors((prev) => ({ ...prev, [action.id]: "" }));
    try {
      await confirmProposedAction(agent, projectId, action.id);
      setPendingActions((prev) => prev.filter((a) => a.id !== action.id));
      notifyEstimationChanged(projectId);
      await load();
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [action.id]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setActionBusyId(null);
    }
  }, [agent, projectId, load]);

  const dismissAction = useCallback(async (action: PendingAction) => {
    setActionBusyId(action.id);
    try {
      await cancelProposedAction(agent, projectId, action.id);
      setPendingActions((prev) => prev.filter((a) => a.id !== action.id));
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [action.id]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setActionBusyId(null);
    }
  }, [agent, projectId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  async function toggleVoice() {
    setError(null);
    if (!recording) {
      try { recorderRef.current = await startRecording(); setRecording(true); }
      catch { setError("לא התקבלה הרשאה למיקרופון. אפשר להמשיך בהקלדה או לנסות שוב."); }
      return;
    }
    const active = recorderRef.current; recorderRef.current = null; setRecording(false);
    if (!active) return;
    setTranscribing(true);
    try {
      const wav = await active.stop(); const result = await transcribeAudio(wav);
      if (!result.text?.trim()) throw new Error("לא זוהה דיבור. נסה שוב.");
      setInput((current) => current ? `${current}\n${result.text.trim()}` : result.text.trim());
      inputRef.current?.focus();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setTranscribing(false); }
  }

  async function handleAttach(file?: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadProjectFile(projectId, file);
      setUploadedName(file.name);
      onFileUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const latestDraft = drafts[0];
  const openQuestions = messages
    .slice()
    .reverse()
    .find((m) => (m.structured_payload?.questions ?? []).length > 0)?.structured_payload.questions ?? [];
  const rejectedActions = messages
    .slice()
    .reverse()
    .find((m) => (m.structured_payload?.rejected_actions ?? []).length > 0)?.structured_payload.rejected_actions ?? [];

  return (
    <section className="card chat-panel">
      <header className="chat-head">
        <div>
          <p className="eyebrow">{projectName}</p>
          <h2>{title}</h2>
          <p className="chat-sub">{subtitle}</p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void load()} disabled={loadState === "loading"}>
          {text.refresh}
        </button>
      </header>

      {readOnly && <p className="chat-readonly">{readOnlyReason ?? "Preview mode — sending is disabled."}</p>}

      <div className="chat-body">
        <div className="chat-messages" ref={listRef}>
          {loadState === "loading" && <p className="chat-hint">{text.loading}</p>}
          {loadState === "error" && (
            <div className="chat-error">
              <p>{error}</p>
              <button type="button" onClick={() => void load()}>{text.retry}</button>
            </div>
          )}
          {loadState === "ready" && messages.length === 0 && (
            <p className="chat-hint">{text.empty}</p>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`chat-bubble chat-${message.sender_type === "ai_agent" ? "ai" : "human"}`}
              dir={isRtl(message.body) ? "rtl" : "ltr"}
            >
              <p className="chat-meta">
                <span>{text.senders[message.sender_type]}</span>
                <span>{formatTime(message.created_at)}</span>
                {showVisibility && <span className="chat-visibility">{visibilityLabels[message.visibility]}</span>}
              </p>
              <p className="chat-text">{message.body}</p>
              {(message.structured_payload?.artifacts ?? []).map((artifact, index) => <ArtifactPanel key={`${message.id}-${index}`} artifact={artifact} projectId={projectId} projectName={projectName} language={language} />)}
              {!clientSafe && message.sender_type === "ai_agent" && message.structured_payload?.ai_draft && (
                <p className="chat-draft-flag">AI draft — awaiting agency review</p>
              )}
            </article>
          ))}
          {aiState === "thinking" && <p className="chat-hint chat-thinking">{text.thinking}</p>}
          {aiState === "failed" && (
            <div className="chat-error">
              <p>{error}</p>
              <div className="action-row">
                {lastFailedText && (
                  <button type="button" onClick={() => void send(lastFailedText)}>{text.retry}</button>
                )}
                <button type="button" className="ghost-button" onClick={() => { setAiState("idle"); setError(null); }}>
                  {text.dismiss}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="chat-side">
          {pendingActions.length > 0 && !readOnly && (
            <div className="chat-side-block">
              <h3>{text.waitingConfirmation}</h3>
              {pendingActions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  busy={actionBusyId === action.id}
                  error={actionErrors[action.id] || null}
                  clientSafe={clientSafe}
                  onConfirm={() => void confirmAction(action)}
                  onCancel={() => void dismissAction(action)}
                />
              ))}
            </div>
          )}
          {!clientSafe && latestDraft && <DraftPanel draft={latestDraft} />}
          {openQuestions.length > 0 && (
            <div className="chat-side-block">
              <h3>{text.openQuestions}</h3>
              <ul>{openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
          {!clientSafe && rejectedActions.length > 0 && (
            <div className="chat-side-block">
              <h3>{text.notAllowed}</h3>
              <ul>
                {rejectedActions.map((action, i) => (
                  <li key={i}>
                    <strong>{actionLabels[action.kind as ActionKind] ?? action.kind}</strong>
                    <span>{action.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <form className="chat-composer" onSubmit={handleSubmit}>
        {safetyNotice && !readOnly ? <p className="chat-safety-notice">{safetyNotice}</p> : null}
        {usage && !readOnly ? (
          <div className="chat-usage-bar">
            <span>
              {usage.paused
                ? text.usagePaused
                : text.usageToday(usage.messagesToday, usage.dailyMessageLimit)}
            </span>
            <span className="chat-usage-track">
              <span
                className={`chat-usage-fill${usage.percentUsed >= 90 ? " stop" : usage.percentUsed >= usage.warningThreshold ? " warn" : ""}`}
                style={{ width: `${Math.min(100, Math.max(2, usage.percentUsed))}%` }}
              />
            </span>
          </div>
        ) : null}
        {suggestions.length > 0 && !readOnly && (
          <div className="chat-suggestions">
            {suggestions.map((s) => (
              <button key={s} type="button" className="ghost-button" disabled={aiState === "thinking"} onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          dir={isRtl(input) ? "rtl" : "ltr"}
          rows={3}
          maxLength={usage?.maximumMessageLength ?? 4000}
          placeholder={readOnly ? text.disabled : text.placeholder}
          disabled={readOnly || aiState === "thinking"}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send(input);
            }
          }}
        />
        <div className="action-row">
          {allowAttachments && !readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(event) => void handleAttach(event.target.files?.[0])}
              />
              <button
                type="button"
                className="ghost-button"
                disabled={uploading || aiState === "thinking"}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? text.uploading : text.attach}
              </button>
            </>
          )}
          <button type="button" className={recording ? "danger-button" : "ghost-button"} disabled={readOnly || transcribing || aiState === "thinking"} onClick={() => void toggleVoice()}>{recording ? "■ עצור ותמלל" : transcribing ? "מתמלל…" : "🎙️ דבר"}</button>
          <button type="submit" disabled={readOnly || aiState === "thinking" || input.trim().length === 0}>
            {aiState === "thinking" ? text.sending : text.send}
          </button>
        </div>
        {uploadedName && <p className="chat-hint">{text.uploaded}: {uploadedName}</p>}
      </form>
    </section>
  );
}
