import { useEffect, useRef, useState } from "react";
import { useCopilot } from "../../context/CopilotContext";
import type { CopilotChip } from "../../services/copilotApi";

function isHebrew(text: string) {
  return /[\u0590-\u05FF]/.test(text);
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