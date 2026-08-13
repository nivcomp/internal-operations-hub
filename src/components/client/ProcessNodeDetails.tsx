import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { clientGlossaryText, type ClientGlossaryEntry } from "../../lib/clientGlossary";
import type { ClientProcessExplanation, ClientProcessNodeData } from "../../lib/clientProcessExplanation";
import type { WordingLang } from "../../lib/clientWording";

type NodeSelection = {
  type: "node";
  node: ClientProcessNodeData;
  explanation: ClientProcessExplanation;
  canOpenDeliverable?: boolean;
};

type TermSelection = { type: "term"; term: ClientGlossaryEntry };

export type ProcessDetailsSelection = NodeSelection | TermSelection;

type Props = {
  selection: ProcessDetailsSelection | null;
  language: WordingLang;
  onClose: () => void;
  onOpenDeliverable?: () => void;
};

const copy = {
  he: {
    close: "סגירה",
    what: "מה קורה כאן?",
    why: "למה זה חשוב?",
    after: "מה קורה אחרי זה?",
    input: "מה נכנס לשלב",
    output: "מה יוצא מהשלב",
    performer: "מי מבצע",
    technical: "פרטים טכניים",
    knownTools: "כלים ומונחים שמופיעים בשלב",
    sourceDetail: "מידע נוסף שנשמר לשלב",
    noTechnical: "לא נשמרו במערכת פרטי מימוש נוספים לשלב הזה.",
    openDeliverable: "פתיחת התצוגה של מה שבונים",
    termTitle: "הסבר פשוט",
  },
  en: {
    close: "Close",
    what: "What happens here?",
    why: "Why does it matter?",
    after: "What happens next?",
    input: "Input",
    output: "Output",
    performer: "Who performs it",
    technical: "Technical details",
    knownTools: "Tools and terms in this step",
    sourceDetail: "Additional information saved for this step",
    noTechnical: "No additional implementation details are stored for this step.",
    openDeliverable: "Open the preview of what is being built",
    termTitle: "Simple explanation",
  },
} as const;

export function ProcessNodeDetails({ selection, language, onClose, onOpenDeliverable }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selection) return undefined;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus();
    };
  }, [selection, onClose]);

  if (!selection) return null;
  const text = copy[language];
  const title = selection.type === "node" ? selection.node.label : selection.term.displayName;

  return createPortal(
    <div className="client-process-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        className="client-process-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir={language === "he" ? "rtl" : "ltr"}
      >
        <header className="client-process-drawer-head">
          <div>
            {selection.type === "node" ? (
              <span className={`client-process-category category-${selection.explanation.category}`}>
                <span aria-hidden="true">{selection.explanation.icon}</span>
                {selection.explanation.categoryLabel}
              </span>
            ) : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button ref={closeRef} type="button" className="client-process-close" onClick={onClose} aria-label={text.close}>×</button>
        </header>

        {selection.type === "term" ? (
          <div className="client-process-drawer-body">
            <section className="client-process-answer is-primary">
              <h3>{text.termTitle}</h3>
              <p>{clientGlossaryText(selection.term, language).explanation}</p>
            </section>
            <details className="client-process-technical">
              <summary>{text.technical}</summary>
              <p>{clientGlossaryText(selection.term, language).technical}</p>
            </details>
          </div>
        ) : (
          <div className="client-process-drawer-body">
            <section className="client-process-answer is-primary"><h3>{text.what}</h3><p>{selection.explanation.what}</p></section>
            <section className="client-process-answer"><h3>{text.why}</h3><p>{selection.explanation.why}</p></section>
            <section className="client-process-answer"><h3>{text.after}</h3><p>{selection.explanation.after}</p></section>

            <dl className="client-process-facts">
              <div><dt>{text.input}</dt><dd>{selection.explanation.input}</dd></div>
              <div><dt>{text.output}</dt><dd>{selection.explanation.output}</dd></div>
              <div><dt>{text.performer}</dt><dd>{selection.explanation.performer}</dd></div>
            </dl>

            {selection.canOpenDeliverable && onOpenDeliverable ? (
              <button type="button" className="primary-button client-process-deliverable-action" onClick={() => { onClose(); onOpenDeliverable(); }}>
                {text.openDeliverable}
              </button>
            ) : null}

            <details className="client-process-technical">
              <summary>{text.technical}</summary>
              {selection.explanation.terms.length ? (
                <div className="client-process-term-list">
                  <strong>{text.knownTools}</strong>
                  {selection.explanation.terms.map((term) => {
                    const termText = clientGlossaryText(term, language);
                    return <article key={term.key}><span aria-hidden="true">{term.icon}</span><div><strong>{term.displayName}</strong><p>{termText.technical}</p></div></article>;
                  })}
                </div>
              ) : null}
              {selection.node.detail ? <p><strong>{text.sourceDetail}:</strong> {selection.node.detail}</p> : null}
              {!selection.explanation.terms.length && !selection.node.detail ? <p>{text.noTechnical}</p> : null}
            </details>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
