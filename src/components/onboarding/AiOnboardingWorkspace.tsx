import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { submitClientOnboarding, submitSupplierOnboarding } from "../../services/onboardingApi";
import {
  loadOnboardingConversation,
  patchOnboardingAnswers,
  sendOnboardingMessage,
  type LiveDocument,
  type LiveFlow,
  type LiveSupplierProfile,
  type OnboardingAnswers,
  type OnboardingTurn,
} from "../../services/onboardingChatApi";
import { LiveFlowDiagram } from "./LiveFlowDiagram";

type Props = { role: "client" | "supplier"; onDone: () => void; onUseForm: () => void };

const CLIENT_OPENER =
  "Welcome! I'm your AI Project Guide. Tell me in a sentence or two what your business does — I'll take it from there and build your project plan as we talk.";
const SUPPLIER_OPENER =
  "Welcome! I'll set up your supplier profile through a short conversation. To start, what kind of work do you do?";

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function AiOnboardingWorkspace({ role, onDone, onUseForm }: Props) {
  const { profile } = useAuth();
  const { refresh } = useOnboarding();

  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [turns, setTurns] = useState<OnboardingTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const isClient = role === "client";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await loadOnboardingConversation();
        if (cancelled) return;
        setAnswers(state.answers ?? {});
        setTurns(state.transcript ?? []);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open your assistant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, sending]);

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    setTurns((prev) => [...prev, { role: "user", body: message, at: new Date().toISOString() }]);
    try {
      const result = await sendOnboardingMessage(message);
      setAnswers(result.answers ?? {});
      setTurns(result.transcript ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant could not reply.");
    } finally {
      setSending(false);
    }
  }, [draft, sending]);

  const doc = (answers._document ?? {}) as LiveDocument;
  const supplierProfile = (answers._profile ?? {}) as LiveSupplierProfile;
  const flow = (answers._flow ?? {}) as LiveFlow;
  const confidence = Number(answers._confidence ?? 0);
  const missing = asList(answers._missing);
  const ready = Boolean(answers._readyToSubmit);

  async function saveEdit(path: string) {
    const value = editValue;
    const nextDoc: Record<string, any> = isClient ? { ...doc } : { ...supplierProfile };
    const current = nextDoc[path];
    nextDoc[path] = Array.isArray(current)
      ? value.split("\n").map((line) => line.trim()).filter(Boolean)
      : typeof current === "number"
        ? Number(value) || 0
        : value;
    const patch = isClient ? { _document: nextDoc } : { _profile: nextDoc };
    setEditing(null);
    try {
      const result = await patchOnboardingAnswers(patch);
      setAnswers(result.answers ?? {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your edit.");
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const flat = Object.fromEntries(Object.entries(answers).filter(([key]) => !key.startsWith("_")));
      if (isClient) {
        await submitClientOnboarding({
          ...flat,
          project_name: (flat as any).project_name || doc.summary?.slice(0, 60) || "New project",
          goal: (flat as any).goal || doc.businessGoal || doc.desiredOutcome || "",
          current_process: (flat as any).current_process || doc.currentSituation || "",
          existing_systems: (flat as any).existing_systems || asList(doc.integrations).join(", "),
          pain_points: (flat as any).pain_points || asList(doc.risks).join(", "),
          capabilities: (flat as any).capabilities || asList(doc.requirements).join(" | "),
          requested_date: (flat as any).requested_date || doc.requestedDate || "",
        });
      } else {
        await submitSupplierOnboarding({
          ...flat,
          name: (flat as any).name || profile?.fullName || "",
          email: (flat as any).email || profile?.email || "",
          skills: asList((flat as any).skills).length ? asList((flat as any).skills) : asList(supplierProfile.skills),
          tools: asList((flat as any).tools).length ? asList((flat as any).tools) : asList(supplierProfile.tools),
          portfolio_links: asList((flat as any).portfolio_links).length
            ? asList((flat as any).portfolio_links)
            : asList(supplierProfile.portfolioLinks),
          hourly_rate: (flat as any).hourly_rate || String(supplierProfile.hourlyRate ?? ""),
          currency: (flat as any).currency || supplierProfile.currency || "GBP",
          weekly_availability: (flat as any).weekly_availability || String(supplierProfile.availabilityHours ?? ""),
          timezone: (flat as any).timezone || supplierProfile.timezone || "",
          communication: (flat as any).communication || supplierProfile.communication || "",
        });
      }
      await refresh();
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  const sections = useMemo(() => {
    if (isClient) {
      return [
        { key: "summary", label: "Project summary", value: doc.summary },
        { key: "businessGoal", label: "Business goal", value: doc.businessGoal },
        { key: "currentSituation", label: "Current situation", value: doc.currentSituation },
        { key: "desiredOutcome", label: "Desired outcome", value: doc.desiredOutcome },
        { key: "requirements", label: "Requirements", value: doc.requirements },
        { key: "integrations", label: "Integrations", value: doc.integrations },
        { key: "workflow", label: "Workflow", value: doc.workflow },
        { key: "phases", label: "Project phases", value: doc.phases },
        { key: "openQuestions", label: "Open questions", value: doc.openQuestions },
        { key: "assumptions", label: "Assumptions", value: doc.assumptions },
        { key: "risks", label: "Risks", value: doc.risks },
        { key: "exclusions", label: "Exclusions", value: doc.exclusions },
        { key: "timeline", label: "Timeline", value: doc.timeline },
        { key: "requestedDate", label: "Requested completion date", value: doc.requestedDate },
      ];
    }
    return [
      { key: "background", label: "Professional background", value: supplierProfile.background },
      { key: "skills", label: "Skills", value: supplierProfile.skills },
      { key: "tools", label: "Technologies and tools", value: supplierProfile.tools },
      { key: "specialisations", label: "Specialisations", value: supplierProfile.specialisations },
      { key: "languages", label: "Languages", value: supplierProfile.languages },
      { key: "experienceYears", label: "Years of experience", value: supplierProfile.experienceYears },
      { key: "availabilityHours", label: "Weekly availability (hours)", value: supplierProfile.availabilityHours },
      { key: "timezone", label: "Timezone", value: supplierProfile.timezone },
      { key: "workingHours", label: "Working hours", value: supplierProfile.workingHours },
      { key: "communication", label: "Preferred communication", value: supplierProfile.communication },
      { key: "hourlyRate", label: "Hourly rate", value: supplierProfile.hourlyRate },
      { key: "currency", label: "Currency", value: supplierProfile.currency },
      { key: "fixedPricePreference", label: "Fixed-price preference", value: supplierProfile.fixedPricePreference },
      { key: "typicalProjectSize", label: "Typical project size", value: supplierProfile.typicalProjectSize },
      { key: "portfolioLinks", label: "Portfolio links", value: supplierProfile.portfolioLinks },
      { key: "certificates", label: "Certificates", value: supplierProfile.certificates },
    ];
  }, [isClient, doc, supplierProfile]);

  const hours = [doc.estimatedHoursMin ?? 0, doc.estimatedHoursMax ?? 0];

  return (
    <div className="ai-onboarding">
      <header className="ai-onboarding-head">
        <div>
          <p className="eyebrow">{isClient ? "AI Project Guide" : "AI Supplier Onboarding"}</p>
          <h1>{isClient ? "Let's plan your project together" : "Let's build your supplier profile"}</h1>
        </div>
        <div className="ai-onboarding-head-actions">
          <span className="ai-progress-chip">Progress {Math.max(0, Math.min(100, confidence))}%</span>
          <button type="button" className="ghost-button" onClick={onUseForm}>Use the classic form</button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void submit()}
            disabled={submitting || (!ready && turns.length < 4)}
          >
            {submitting ? "Submitting…" : isClient ? "Send to the agency" : "Submit profile"}
          </button>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="ai-onboarding-grid">
        <section className="card ai-onboarding-chat" aria-label="Onboarding conversation">
          <div className="ai-chat-log" ref={listRef}>
            <div className="ai-bubble assistant">{isClient ? CLIENT_OPENER : SUPPLIER_OPENER}</div>
            {loading ? <p className="form-note">Opening your assistant…</p> : null}
            {turns.map((turn, index) => (
              <div key={`${turn.at}-${index}`} className={`ai-bubble ${turn.role}`}>{turn.body}</div>
            ))}
            {sending ? <div className="ai-bubble assistant muted">Thinking…</div> : null}
          </div>
          <form
            className="ai-chat-composer"
            onSubmit={(event) => { event.preventDefault(); void send(); }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write your answer…"
              rows={2}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
              }}
            />
            <button type="submit" className="primary-button" disabled={sending || !draft.trim()}>Send</button>
          </form>
          {missing.length ? (
            <p className="form-note">Still to cover: {missing.slice(0, 5).join(", ")}</p>
          ) : null}
        </section>

        <aside className="ai-onboarding-doc" aria-label={isClient ? "Live project document" : "Live supplier profile"}>
          <div className="card">
            <div className="ai-doc-head">
              <h2>{isClient ? "Live project document" : "Live supplier profile"}</h2>
              {isClient ? <span className="ai-progress-chip">Scope v{doc.scopeVersion ?? 1}</span> : null}
            </div>
            {isClient ? (
              <div className="ai-doc-estimate">
                <div>
                  <span className="ai-doc-label">Estimated effort</span>
                  <strong>{hours[1] ? `${hours[0]}–${hours[1]} hours (draft)` : "Estimate under review."}</strong>
                </div>
                <div>
                  <span className="ai-doc-label">Estimated budget</span>
                  <strong>{doc.estimatedBudgetNote || "Estimate under review."}</strong>
                </div>
              </div>
            ) : null}

            {sections.map((section) => {
              const list = Array.isArray(section.value) ? section.value : null;
              const text = list ? list.join("\n") : section.value === undefined || section.value === null || section.value === ""
                ? ""
                : String(section.value);
              return (
                <div className="ai-doc-section" key={section.key}>
                  <div className="ai-doc-section-head">
                    <span className="ai-doc-label">{section.label}</span>
                    {editing === section.key ? null : (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => { setEditing(section.key); setEditValue(text); }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editing === section.key ? (
                    <div className="ai-doc-edit">
                      <textarea rows={list ? 4 : 2} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                      <div className="table-actions">
                        <button type="button" className="primary-button" onClick={() => void saveEdit(section.key)}>Save</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : list ? (
                    list.length ? (
                      <ul className="ai-doc-list">{list.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    ) : <p className="form-note">We'll fill this in as we talk.</p>
                  ) : (
                    <p>{text || <span className="form-note">We'll fill this in as we talk.</span>}</p>
                  )}
                </div>
              );
            })}
          </div>

          {isClient ? (
            <div className="card">
              <h2>Live flow diagram</h2>
              <LiveFlowDiagram flow={flow} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}