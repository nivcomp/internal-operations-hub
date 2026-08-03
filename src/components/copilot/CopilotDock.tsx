import { useEffect, useRef, useState } from "react";
import { useCopilot } from "../../context/CopilotContext";
import type { CopilotChip, CopilotOperatorAction } from "../../services/copilotApi";

function isHebrew(text: string) {
  return /[\u0590-\u05FF]/.test(text);
}

const OPEN_STATUSES = ["proposed", "awaiting_confirmation", "failed"];

/** One queued operator action: what it does, to what, and what changes. */
function OperatorCard({
  action, busy, onConfirm, onCancel, onRetry,
}: {
  action: CopilotOperatorAction;
  busy: boolean;
  onConfirm: (ids: string[]) => void;
  onCancel: (ids: string[]) => void;
  onRetry: (ids: string[]) => void;
}) {
  const open = OPEN_STATUSES.includes(action.status);
  const detailed = action.risk_level === "high";
  return (
    <div className={`copilot-op copilot-op-${action.risk_level} is-${action.status}`}>
      <header>
        <strong>{action.action_label}</strong>
        <span className={`copilot-op-risk risk-${action.risk_level}`}>{action.risk_level} risk</span>
      </header>
      {action.target_label ? <p className="copilot-op-target">Target: {action.target_label}</p> : null}

      {(action.preview?.fields ?? []).length ? (
        <ul className="copilot-op-fields">
          {action.preview!.fields!.map((field, index) => (
            <li key={index}>
              <span>{field.label}</span>
              <span>
                {field.current !== undefined ? <em>{field.current} → </em> : null}
                {field.proposed ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {detailed && action.preview?.impact?.length ? (
        <ul className="copilot-op-impact">
          {action.preview.impact.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      ) : null}
      {detailed && action.preview?.related?.length ? (
        <p className="copilot-op-related">Related records: {action.preview.related.join(", ")}</p>
      ) : null}

      {action.status === "completed" ? (
        <p className="copilot-op-done">Done — {action.result?.summary ?? "completed"}</p>
      ) : null}
      {action.status === "cancelled" ? <p className="copilot-hint">Cancelled.</p> : null}
      {action.failure_reason ? <p className="copilot-error">{action.failure_reason}</p> : null}

      {open ? (
        <div className="copilot-action-buttons">
          <button type="button" disabled={busy} onClick={() => (action.status === "failed" ? onRetry([action.id]) : onConfirm([action.id]))}>
            {action.status === "failed" ? "Retry" : "Confirm"}
          </button>
          <button type="button" className="ghost" disabled={busy} onClick={() => onCancel([action.id])}>Cancel</button>
        </div>
      ) : null}
    </div>
  );
}

/** Groups queued actions into multi-step plans and single actions. */
function OperatorQueue() {
  const copilot = useCopilot();
  const [showAll, setShowAll] = useState(false);
  if (!copilot.operatorMode) return null;

  const open = copilot.operatorActions.filter((action) => OPEN_STATUSES.includes(action.status));
  const history = copilot.operatorActions.filter((action) => !OPEN_STATUSES.includes(action.status));
  const visible = showAll ? [...open, ...history] : open;
  if (!visible.length) return null;

  const plans = new Map<string, CopilotOperatorAction[]>();
  const singles: CopilotOperatorAction[] = [];
  for (const action of visible) {
    if (action.plan_id) plans.set(action.plan_id, [...(plans.get(action.plan_id) ?? []), action]);
    else singles.push(action);
  }

  return (
    <div className="copilot-op-queue">
      <div className="copilot-op-queue-head">
        <strong>Action queue</strong>
        <button type="button" className="copilot-icon" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Open only" : `History (${history.length})`}
        </button>
      </div>

      {[...plans.entries()].map(([planId, steps]) => {
        const ordered = [...steps].sort((a, b) => a.plan_step - b.plan_step);
        const openIds = ordered.filter((s) => OPEN_STATUSES.includes(s.status)).map((s) => s.id);
        return (
          <div key={planId} className="copilot-op-plan">
            <p className="copilot-op-plan-title">{ordered[0].plan_title || "Multi-step plan"} — {ordered.length} steps</p>
            {ordered.map((step) => (
              <OperatorCard
                key={step.id} action={step} busy={copilot.operatorBusy}
                onConfirm={copilot.confirmOperator} onCancel={copilot.cancelOperator} onRetry={copilot.retryOperator}
              />
            ))}
            {openIds.length > 1 ? (
              <div className="copilot-action-buttons">
                <button type="button" disabled={copilot.operatorBusy} onClick={() => void copilot.confirmOperator(openIds)}>
                  Confirm all {openIds.length}
                </button>
                <button type="button" className="ghost" disabled={copilot.operatorBusy} onClick={() => void copilot.cancelOperator(openIds)}>
                  Cancel plan
                </button>
              </div>
            ) : null}
            <p className="copilot-hint">Steps run in order and stop if one fails.</p>
          </div>
        );
      })}

      {singles.map((action) => (
        <OperatorCard
          key={action.id} action={action} busy={copilot.operatorBusy}
          onConfirm={copilot.confirmOperator} onCancel={copilot.cancelOperator} onRetry={copilot.retryOperator}
        />
      ))}
    </div>
  );
}

function ChipRow({ chips, onRun }: { chips: CopilotChip[]; onRun: (chip: CopilotChip) => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="copilot-chips">
      {chips.map((chip, index) => (
        <button key={`${chip.type}-${index}`} type="button" className="copilot-chip" onClick={() => onRun(chip)}>
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export function CopilotDock() {
  const copilot = useCopilot();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // A voice transcript lands in the composer so it can be corrected before sending.
  useEffect(() => {
    if (!copilot.transcript) return;
    setDraft(copilot.transcript);
    copilot.clearTranscript();
  }, [copilot]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [copilot.messages, copilot.pendingActions]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        copilot.setOpen(!copilot.open);
      }
      if (event.key === "Escape" && copilot.open) copilot.setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copilot]);

  function submit() {
    const text = draft;
    setDraft("");
    void copilot.send(text);
  }

  if (!copilot.open) {
    return (
      <button
        type="button"
        className="copilot-bubble"
        onClick={() => copilot.setOpen(true)}
        aria-label="Open the copilot"
        title="Copilot (⌘J)"
      >
        <span className="copilot-bubble-dot" aria-hidden="true" />
        Copilot
      </button>
    );
  }

  return (
    <aside className="copilot-panel" aria-label="Copilot">
      <header className="copilot-head">
        <div>
          <strong>Copilot</strong>
          {copilot.operatorMode ? <span className="copilot-operator-badge">Operator Mode</span> : null}
          <p className="copilot-context">{copilot.label}</p>
        </div>
        <div className="copilot-head-actions">
          <button
            type="button"
            className={`copilot-toggle${copilot.voiceReplies ? " is-on" : ""}`}
            onClick={() => copilot.setVoiceReplies(!copilot.voiceReplies)}
            title="Read answers aloud"
          >
            {copilot.voiceReplies ? "Voice on" : "Voice off"}
          </button>
          <button type="button" className="copilot-icon" onClick={() => void copilot.clear()} title="Clear this thread">
            Clear
          </button>
          <button type="button" className="copilot-icon" onClick={() => copilot.setOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
      </header>

      {copilot.observation ? <p className="copilot-observation">{copilot.observation}</p> : null}

      {copilot.slotMemory && copilot.slotMemory.status !== "completed" ? (
        <div className="copilot-slot">
          <div>
            <strong>{copilot.slotMemory.target_label || "Pending command"}</strong>
            <p>
              {Object.entries(copilot.slotMemory.confirmed_parameters ?? {})
                .filter(([key]) => !key.startsWith("__"))
                .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
                .join(" · ") || "No values captured yet"}
            </p>
            {copilot.slotMemory.missing_parameters?.length ? (
              <p className="copilot-hint">Still needed: {copilot.slotMemory.missing_parameters.join(", ")}</p>
            ) : null}
          </div>
          <button type="button" className="copilot-icon" onClick={() => void copilot.clearSlotMemory()}>
            Forget
          </button>
        </div>
      ) : null}

      <div className="copilot-messages" ref={listRef}>
        {copilot.loading ? <p className="copilot-hint">Loading…</p> : null}
        {!copilot.loading && copilot.messages.length === 0 ? (
          <p className="copilot-hint">
            Ask me about this screen — what is missing, what to do next, or where to go.
            I can also fill a field for you to review, but I never save anything myself.
          </p>
        ) : null}

        {copilot.messages.map((message) => (
          <div
            key={message.id}
            className={`copilot-message copilot-message-${message.sender}`}
            dir={isHebrew(message.body) ? "rtl" : "ltr"}
          >
            <p>{message.body}</p>
            {message.payload?.rejectedActions?.length ? (
              <ul className="copilot-rejected">
                {message.payload.rejectedActions.map((item, index) => (
                  <li key={index}>Not allowed: {item.reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {copilot.pendingActions.map((action) => (
          <div key={action.id} className="copilot-action">
            <strong>{action.title ?? action.action_kind.replace(/_/g, " ")}</strong>
            {action.summary ? <p>{action.summary}</p> : null}
            {Array.isArray(action.preview?.proposed) ? (
              <ul>
                {action.preview.proposed.map((row: any, index: number) => (
                  <li key={index}>{row.label}: {row.value}</li>
                ))}
              </ul>
            ) : null}
            <p className="copilot-hint">Nothing changes until you confirm.</p>
            <div className="copilot-action-buttons">
              <button type="button" onClick={() => void copilot.confirm(action.id)}>Confirm</button>
              <button type="button" className="ghost" onClick={() => void copilot.dismiss(action.id)}>Dismiss</button>
            </div>
          </div>
        ))}

        <OperatorQueue />
      </div>

      <ChipRow chips={copilot.chips} onRun={copilot.runChip} />

      {copilot.error ? <p className="copilot-error">{copilot.error}</p> : null}
      {copilot.usage && copilot.usage.percentUsed >= 70 ? (
        <p className="copilot-hint">AI usage today: {copilot.usage.percentUsed}%</p>
      ) : null}

      <div className="copilot-composer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={copilot.recording ? "Listening…" : "Ask about this screen…"}
          disabled={copilot.sending || copilot.recording}
        />
        <div className="copilot-composer-buttons">
          {copilot.recording ? (
            <>
              <button type="button" onClick={() => void copilot.stopVoice()}>Stop &amp; send</button>
              <button type="button" className="ghost" onClick={copilot.cancelVoice}>Cancel</button>
            </>
          ) : (
            <button
              type="button"
              className="ghost"
              onClick={() => void copilot.startVoice()}
              disabled={copilot.transcribing || copilot.sending}
              title="Speak instead of typing"
            >
              🎙 Speak
            </button>
          )}
          {copilot.speaking ? (
            <button type="button" className="ghost" onClick={copilot.stopSpeaking}>Stop audio</button>
          ) : null}
          <button type="button" onClick={submit} disabled={copilot.sending || !draft.trim()}>
            {copilot.sending ? "Thinking…" : "Send"}
          </button>
        </div>
        {copilot.transcribing ? <p className="copilot-hint">Transcribing…</p> : null}
      </div>
    </aside>
  );
}