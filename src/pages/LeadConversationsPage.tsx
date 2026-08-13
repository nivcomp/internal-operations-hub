import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { LiveFlowDiagram } from "../components/onboarding/LiveFlowDiagram";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { useAppData } from "../context/AppDataContext";
import {
  getLeadConversation,
  listLeadConversations,
  markLeadConversationRead,
  promoteLeadConversation,
  sendLeadManagerMessage,
  setLeadConversationStatus,
  type LeadConversation,
  type LeadConversationMessage,
} from "../services/leadConversationsApi";
import type { LeadConversationStatus } from "../services/onboardingChatApi";

type Props = { onProjectOpen: (projectId: string) => void };
type Filter = "open" | "awaiting_review" | "paused" | "disqualified" | "promoted" | "all";

const STATUS_COPY: Record<LeadConversationStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "info" }> = {
  invited: { label: "הוזמן – טרם התחיל", tone: "neutral" },
  active: { label: "בשיחה", tone: "info" },
  awaiting_review: { label: "ממתין לבדיקה שלך", tone: "warning" },
  paused: { label: "מושהה", tone: "neutral" },
  disqualified: { label: "לא ממשיך", tone: "danger" },
  promoted: { label: "עבר לפרויקט", tone: "success" },
};

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "open", label: "פתוחים" },
  { key: "awaiting_review", label: "לבדיקה" },
  { key: "paused", label: "מושהים" },
  { key: "disqualified", label: "לא ממשיכים" },
  { key: "promoted", label: "עברו לפרויקט" },
  { key: "all", label: "הכול" },
];

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function senderLabel(message: LeadConversationMessage) {
  if (message.visibility === "agency_only") return "הערה פנימית";
  if (message.sender_type === "client") return "הלקוח";
  if (message.sender_type === "agency_admin") return "יניב";
  if (message.sender_type === "system") return "עדכון מערכת";
  return "מלווה הפרויקט";
}

export function LeadConversationsPage({ onProjectOpen }: Props) {
  const { reload } = useAppData();
  const toast = useToast();
  const [items, setItems] = useState<LeadConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadConversation | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [projectName, setProjectName] = useState("");
  const [control, setControl] = useState<"pause" | "disqualify" | null>(null);
  const [controlMessage, setControlMessage] = useState("");
  const [internalReason, setInternalReason] = useState("");
  const [confirmPromote, setConfirmPromote] = useState(false);

  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const next = await listLeadConversations();
      setItems(next);
      setError(null);
      setSelectedId((current) => current ?? next.find((item) => item.unread)?.id ?? next[0]?.id ?? null);
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את שיחות הלידים.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (conversationId: string, quiet = false) => {
    try {
      const next = await getLeadConversation(conversationId);
      setDetail(next);
      if (!quiet) setProjectName(String(next.answers?.project_name ?? next.document?.summary ?? "").slice(0, 120));
      if (next.unread) {
        await markLeadConversationRead(conversationId);
        setItems((current) => current.map((item) => item.id === conversationId ? { ...item, unread: false } : item));
      }
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "לא הצלחנו לפתוח את השיחה.");
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setProjectName("");
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadList(true);
      if (selectedId) void loadDetail(selectedId, true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadList, loadDetail, selectedId]);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesFilter = filter === "all"
      || (filter === "open" && ["invited", "active", "awaiting_review"].includes(item.status))
      || item.status === filter;
    const needle = search.trim().toLocaleLowerCase("he");
    const matchesSearch = !needle || `${item.contactName} ${item.businessName} ${item.email}`.toLocaleLowerCase("he").includes(needle);
    return matchesFilter && matchesSearch;
  }), [items, filter, search]);

  async function refreshSelected(next?: LeadConversation) {
    if (next) setDetail(next);
    await loadList(true);
    if (selectedId && !next) await loadDetail(selectedId, true);
  }

  async function send(visibility: "client_agency" | "agency_only") {
    if (!selectedId || !message.trim() || busy) return;
    setBusy(true);
    try {
      const next = await sendLeadManagerMessage(selectedId, message.trim(), visibility);
      setMessage("");
      await refreshSelected(next);
      toast.notify(visibility === "agency_only" ? "ההערה נשמרה לעצמך" : "ההודעה נשלחה ללקוח");
    } catch (cause) {
      toast.notify(cause instanceof Error ? cause.message : "הפעולה נכשלה", "error");
    } finally { setBusy(false); }
  }

  async function changeStatus(status: "active" | "paused" | "disqualified") {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      const next = await setLeadConversationStatus(selectedId, status, {
        clientMessage: controlMessage.trim() || undefined,
        reason: internalReason.trim() || undefined,
      });
      setControl(null); setControlMessage(""); setInternalReason("");
      await refreshSelected(next);
      toast.notify(status === "active" ? "השיחה נפתחה מחדש" : status === "paused" ? "השיחה הושהתה" : "הליד סומן כלא ממשיך");
    } catch (cause) {
      toast.notify(cause instanceof Error ? cause.message : "הפעולה נכשלה", "error");
    } finally { setBusy(false); }
  }

  async function promote() {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      const projectId = await promoteLeadConversation(selectedId, projectName.trim());
      setConfirmPromote(false);
      await reload();
      await refreshSelected();
      toast.notify("הפרויקט נפתח וכל השיחה והאפיון הועברו אליו");
      onProjectOpen(projectId);
    } catch (cause) {
      toast.notify(cause instanceof Error ? cause.message : "לא הצלחנו לפתוח את הפרויקט", "error");
    } finally { setBusy(false); }
  }

  const counts = useMemo(() => ({
    open: items.filter((item) => ["invited", "active", "awaiting_review"].includes(item.status)).length,
    awaiting_review: items.filter((item) => item.status === "awaiting_review").length,
    paused: items.filter((item) => item.status === "paused").length,
    disqualified: items.filter((item) => item.status === "disqualified").length,
    promoted: items.filter((item) => item.status === "promoted").length,
    all: items.length,
  }), [items]);

  return (
    <div className="lead-inbox-page" dir="rtl" lang="he">
      <PageHeader
        title="שיחות לידים"
        subtitle="כל הדרך מהכניסה בלינק ועד להחלטה שלך אם לפתוח פרויקט — בלי שליד ייצור פרויקט בעצמו."
      />

      <div className="lead-inbox-toolbar card">
        <div className="lead-filter-tabs" role="tablist" aria-label="סינון שיחות">
          {FILTERS.map((entry) => (
            <button key={entry.key} type="button" className={filter === entry.key ? "active" : ""} onClick={() => setFilter(entry.key)}>
              {entry.label} <span>{counts[entry.key]}</span>
            </button>
          ))}
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי לקוח, עסק או אימייל" />
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="lead-inbox-layout">
        <aside className="lead-thread-list card" aria-label="רשימת שיחות">
          {loading ? <p className="empty-copy">טוען שיחות…</p> : null}
          {!loading && filtered.length === 0 ? <p className="empty-copy">אין שיחות שמתאימות לסינון.</p> : null}
          {filtered.map((item) => {
            const status = STATUS_COPY[item.status];
            return (
              <button key={item.id} type="button" className={`lead-thread-card${selectedId === item.id ? " active" : ""}`} onClick={() => setSelectedId(item.id)}>
                <span className="lead-thread-top">
                  <strong>{item.businessName || item.contactName}</strong>
                  {item.unread ? <i aria-label="הודעה חדשה" /> : null}
                </span>
                <span>{item.contactName}{item.email ? ` · ${item.email}` : ""}</span>
                <small>{item.lastMessage?.body || "עדיין לא נכתבה הודעה"}</small>
                <span className="lead-thread-bottom">
                  <StatusBadge label={status.label} tone={status.tone} />
                  <time>{formatDate(item.lastMessage?.createdAt || item.updatedAt)}</time>
                </span>
              </button>
            );
          })}
        </aside>

        <main className="lead-thread-workspace card">
          {!detail ? (
            <div className="lead-empty-detail">
              <strong>בחר שיחה</strong>
              <p>כאן תראה את כל ההיסטוריה ותוכל להחליט מה הצעד הבא.</p>
            </div>
          ) : (
            <>
              <header className="lead-detail-head">
                <div>
                  <p className="eyebrow">ליד לפני פרויקט</p>
                  <h2>{detail.businessName || detail.contactName}</h2>
                  <p>{detail.contactName} · {detail.email}{detail.phone ? ` · ${detail.phone}` : ""}</p>
                </div>
                <StatusBadge label={STATUS_COPY[detail.status].label} tone={STATUS_COPY[detail.status].tone} />
              </header>

              <div className="lead-detail-meta">
                <span><strong>{detail.progress}%</strong> מהאפיון נאסף</span>
                <span><strong>{detail.messages?.filter((item) => item.visibility === "client_agency").length ?? 0}</strong> הודעות בשיחה</span>
                <span><strong>{detail.messages?.filter((item) => item.visibility === "agency_only").length ?? 0}</strong> הערות פנימיות</span>
              </div>

              <section className="lead-message-log" aria-label="תכתובת הליד">
                {detail.messages?.length ? detail.messages.map((entry) => (
                  <article key={entry.id} className={`lead-message ${entry.sender_type} ${entry.visibility}`}>
                    <div>
                      <strong>{senderLabel(entry)}</strong>
                      <time>{formatDate(entry.created_at)}</time>
                    </div>
                    <p>{entry.body}</p>
                  </article>
                )) : <p className="empty-copy">הלקוח עדיין לא התחיל לדבר.</p>}
              </section>

              {detail.status !== "promoted" ? (
                <section className="lead-manager-composer">
                  <label htmlFor="manager-message">מה תרצה לומר או לשמור?</label>
                  <textarea id="manager-message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="הודעה ללקוח או הערה פנימית לעצמך…" />
                  <div className="table-actions">
                    <button type="button" className="primary-button" disabled={busy || !message.trim()} onClick={() => void send("client_agency")}>שלח ללקוח</button>
                    <button type="button" disabled={busy || !message.trim()} onClick={() => void send("agency_only")}>שמור כהערה פנימית</button>
                  </div>
                </section>
              ) : null}

              <details className="lead-brief-panel" open={detail.status === "awaiting_review"}>
                <summary>האפיון שנבנה מהשיחה</summary>
                <div className="lead-brief-grid">
                  {[
                    ["סיכום", detail.document?.summary],
                    ["מטרה עסקית", detail.document?.businessGoal],
                    ["המצב היום", detail.document?.currentSituation],
                    ["התוצאה הרצויה", detail.document?.desiredOutcome],
                    ["דרישות", detail.document?.requirements],
                    ["אינטגרציות", detail.document?.integrations],
                    ["תהליך", detail.document?.workflow],
                    ["שאלות פתוחות", detail.document?.openQuestions],
                  ].filter(([, value]) => Array.isArray(value) ? value.length : Boolean(value)).map(([label, value]) => (
                    <article key={String(label)}><strong>{label}</strong><p>{Array.isArray(value) ? value.join(" · ") : String(value)}</p></article>
                  ))}
                </div>
                {detail.flow?.nodes?.length ? <LiveFlowDiagram flow={detail.flow} /> : null}
              </details>

              {control ? (
                <section className="lead-control-panel">
                  <h3>{control === "pause" ? "השהיית השיחה" : "סגירת הליד"}</h3>
                  <label>הודעה שהלקוח יראה
                    <textarea rows={2} value={controlMessage} onChange={(event) => setControlMessage(event.target.value)} placeholder={control === "pause" ? "השיחה הושהתה זמנית, נחזור אליכם בהמשך." : "תודה על השיחה. בשלב זה לא נמשיך לפרויקט."} />
                  </label>
                  {control === "disqualify" ? <label>סיבה פנימית (הלקוח לא יראה)
                    <textarea rows={2} value={internalReason} onChange={(event) => setInternalReason(event.target.value)} />
                  </label> : null}
                  <div className="table-actions">
                    <button type="button" className={control === "disqualify" ? "danger-button" : "primary-button"} disabled={busy} onClick={() => void changeStatus(control === "pause" ? "paused" : "disqualified")}>
                      {control === "pause" ? "השהה שיחה" : "סגור ליד"}
                    </button>
                    <button type="button" onClick={() => setControl(null)}>ביטול</button>
                  </div>
                </section>
              ) : null}

              <footer className="lead-decision-bar">
                <div className="lead-status-actions">
                  {detail.status === "paused" || detail.status === "disqualified" ? (
                    <button type="button" onClick={() => void changeStatus("active")} disabled={busy}>פתח את השיחה מחדש</button>
                  ) : detail.status !== "promoted" ? (
                    <button type="button" onClick={() => setControl("pause")}>השהה שיחה</button>
                  ) : null}
                  {detail.status !== "disqualified" && detail.status !== "promoted" ? (
                    <button type="button" className="danger-link" onClick={() => setControl("disqualify")}>לא לקוח פוטנציאלי</button>
                  ) : null}
                </div>
                {detail.status === "promoted" && detail.projectId ? (
                  <button type="button" className="primary-button" onClick={() => onProjectOpen(detail.projectId!)}>פתח את הפרויקט: {detail.projectName}</button>
                ) : detail.status !== "disqualified" ? (
                  <div className="lead-promote-box">
                    <label>שם הפרויקט
                      <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="שם ברור לפרויקט" />
                    </label>
                    <button type="button" className="primary-button" disabled={busy || !projectName.trim()} onClick={() => setConfirmPromote(true)}>העבר לפרויקט</button>
                  </div>
                ) : null}
              </footer>
            </>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={confirmPromote}
        title="לפתוח פרויקט מהליד הזה?"
        description="המערכת תיצור פרויקט אחד ותעביר אליו את כל השיחה, האפיון, התרשים וההערות. הלקוח יעבור לממשק הפרויקט ויוכל להתקדם ל־MVP."
        confirmLabel="כן, פתח פרויקט"
        cancelLabel="עדיין לא"
        destructive={false}
        busy={busy}
        onConfirm={() => void promote()}
        onCancel={() => setConfirmPromote(false)}
      />
    </div>
  );
}
