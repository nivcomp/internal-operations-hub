import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  loadChatHistory, sendChatMessage,
  type AgentType, type ChatDraft, type ChatMessage,
} from "../services/chatApi";

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

export function ProjectChat({
  projectId, projectName, agent, title, subtitle,
  showVisibility = false, readOnly = false, readOnlyReason, suggestions = [],
}: ProjectChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<ChatDraft[]>([]);
  const [input, setInput] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [aiState, setAiState] = useState<"idle" | "thinking" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const data = await loadChatHistory(agent, projectId);
      setMessages(data.messages ?? []);
      setDrafts(data.drafts ?? []);
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
    try {
      const result = await sendChatMessage(agent, projectId, trimmed);
      setMessages((prev) => [...prev, result.userMessage, result.aiMessage]);
      if (result.draft) setDrafts((prev) => [result.draft as ChatDraft, ...prev].slice(0, 5));
      setAiState("idle");
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLastFailedText(trimmed);
      setAiState("failed");
      void load();
    }
  }, [agent, projectId, aiState, readOnly, load]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  const latestDraft = drafts[0];
  const openQuestions = messages
    .slice()
    .reverse()
    .find((m) => (m.structured_payload?.questions ?? []).length > 0)?.structured_payload.questions ?? [];
  const proposedActions = messages
    .slice()
    .reverse()
    .find((m) => (m.structured_payload?.proposed_actions ?? []).length > 0)?.structured_payload.proposed_actions ?? [];

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
          {latestDraft && <DraftPanel draft={latestDraft} />}
          {openQuestions.length > 0 && (
            <div className="chat-side-block">
              <h3>Open questions</h3>
              <ul>{openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
          {proposedActions.length > 0 && (
            <div className="chat-side-block">
              <h3>Proposed actions</h3>
              <ul>
                {proposedActions.map((action, i) => (
                  <li key={i}>
                    <strong>{action.title}</strong>
                    <span>{action.detail}</span>
                    {action.affects && <em>Affects: {action.affects}</em>}
                  </li>
                ))}
              </ul>
              <p className="chat-hint">Nothing is changed automatically. Apply confirmed actions from the project screens.</p>
            </div>
          )}
        </aside>
      </div>

      <form className="chat-composer" onSubmit={handleSubmit}>
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
          maxLength={4000}
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
          <button type="submit" disabled={readOnly || aiState === "thinking" || input.trim().length === 0}>
            {aiState === "thinking" ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}