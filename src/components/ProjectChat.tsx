import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  cancelProposedAction, confirmProposedAction, loadChatHistory, sendChatMessage,
  type ActionKind, type AgentType, type ChatArtifact, type ChatDraft, type ChatMessage, type ChatUsage, type PendingAction,
} from "../services/chatApi";
import { notifyEstimationChanged } from "../lib/estimationEvents";
import { detectProjectViewIntent, requestProjectView } from "../lib/projectViewEvents";
import { startRecording, type Recorder } from "../lib/voice";
import { transcribeAudio } from "../services/copilotApi";

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
};

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

const senderLabels: Record<ChatMessage["sender_type"], string> = {
  client: "Client",
  agency_admin: "Agency",
  supplier: "Supplier",
  ai_agent: "AI",
  system: "System",
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

function ArtifactPanel({ artifact }: { artifact: ChatArtifact }) {
  const kind = artifact.type === "flow" ? "תרשים תהליך" : artifact.type === "wireframe" ? "סקיצה" : artifact.type === "table" ? "טבלה" : "רשימה";
  return <section className={`chat-artifact artifact-${artifact.type}`} dir="rtl"><header><span>{kind}</span><strong>{artifact.title}</strong></header>{artifact.description ? <p>{artifact.description}</p> : null}
    {artifact.type === "flow" ? <div className="artifact-flow">{(artifact.nodes ?? []).map((node, index) => <div key={node.id || index} className="artifact-flow-step"><article><strong>{node.label}</strong>{node.detail ? <small>{node.detail}</small> : null}</article>{index < (artifact.nodes?.length ?? 0) - 1 ? <span>←</span> : null}</div>)}</div> : null}
    {artifact.type === "wireframe" ? <div className="artifact-wireframe">{(artifact.nodes ?? []).map((node, index) => <article key={node.id || index}><strong>{node.label}</strong>{node.detail ? <p>{node.detail}</p> : null}</article>)}</div> : null}
    {artifact.type === "table" && artifact.columns?.length ? <div className="table-scroll"><table><thead><tr>{artifact.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{(artifact.rows ?? []).map((row, rowIndex) => <tr key={rowIndex}>{artifact.columns!.map((_, cellIndex) => <td key={cellIndex}>{row[cellIndex] ?? ""}</td>)}</tr>)}</tbody></table></div> : null}
    {artifact.type === "checklist" ? <ul className="artifact-checklist">{(artifact.items ?? []).map((item, index) => <li key={index}>✓ {item}</li>)}</ul> : null}
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
  action, busy, error, onConfirm, onCancel,
}: {
  action: PendingAction;
  busy: boolean;
  error: string | null;
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
        {preview.internal_cost_effect && (
          <div><dt>Internal cost</dt><dd>{preview.internal_cost_effect}</dd></div>
        )}
        {preview.margin_effect && (
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
}: ProjectChatProps) {
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
          Refresh
        </button>
      </header>

      {readOnly && <p className="chat-readonly">{readOnlyReason ?? "Preview mode — sending is disabled."}</p>}

      <div className="chat-body">
        <div className="chat-messages" ref={listRef}>
          {loadState === "loading" && <p className="chat-hint">Loading conversation…</p>}
          {loadState === "error" && (
            <div className="chat-error">
              <p>{error}</p>
              <button type="button" onClick={() => void load()}>Retry</button>
            </div>
          )}
          {loadState === "ready" && messages.length === 0 && (
            <p className="chat-hint">No messages yet. Start the conversation below.</p>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`chat-bubble chat-${message.sender_type === "ai_agent" ? "ai" : "human"}`}
              dir={isRtl(message.body) ? "rtl" : "ltr"}
            >
              <p className="chat-meta">
                <span>{senderLabels[message.sender_type]}</span>
                <span>{formatTime(message.created_at)}</span>
                {showVisibility && <span className="chat-visibility">{visibilityLabels[message.visibility]}</span>}
              </p>
              <p className="chat-text">{message.body}</p>
              {(message.structured_payload?.artifacts ?? []).map((artifact, index) => <ArtifactPanel key={`${message.id}-${index}`} artifact={artifact} />)}
              {message.sender_type === "ai_agent" && message.structured_payload?.ai_draft && (
                <p className="chat-draft-flag">AI draft — awaiting agency review</p>
              )}
            </article>
          ))}
          {aiState === "thinking" && <p className="chat-hint chat-thinking">Thinking…</p>}
          {aiState === "failed" && (
            <div className="chat-error">
              <p>{error}</p>
              <div className="action-row">
                {lastFailedText && (
                  <button type="button" onClick={() => void send(lastFailedText)}>Retry</button>
                )}
                <button type="button" className="ghost-button" onClick={() => { setAiState("idle"); setError(null); }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="chat-side">
          {pendingActions.length > 0 && !readOnly && (
            <div className="chat-side-block">
              <h3>Waiting for your confirmation</h3>
              {pendingActions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  busy={actionBusyId === action.id}
                  error={actionErrors[action.id] || null}
                  onConfirm={() => void confirmAction(action)}
                  onCancel={() => void dismissAction(action)}
                />
              ))}
            </div>
          )}
          {latestDraft && <DraftPanel draft={latestDraft} />}
          {openQuestions.length > 0 && (
            <div className="chat-side-block">
              <h3>Open questions</h3>
              <ul>{openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
          {rejectedActions.length > 0 && (
            <div className="chat-side-block">
              <h3>Not allowed</h3>
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
                ? "AI is paused for now"
                : `${usage.messagesToday}/${usage.dailyMessageLimit} messages today`}
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
          placeholder={readOnly ? "Sending is disabled in preview mode" : "Write your message… (Hebrew or English)"}
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
          <button type="button" className={recording ? "danger-button" : "ghost-button"} disabled={readOnly || transcribing || aiState === "thinking"} onClick={() => void toggleVoice()}>{recording ? "■ עצור ותמלל" : transcribing ? "מתמלל…" : "🎙️ דבר"}</button>
          <button type="submit" disabled={readOnly || aiState === "thinking" || input.trim().length === 0}>
            {aiState === "thinking" ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
