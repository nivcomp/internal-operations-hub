import { useEffect, useId, useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { findClientGlossaryTerms } from "../../lib/clientGlossary";
import {
  explainClientProcessNode,
  PROCESS_CATEGORY_META,
  PROCESS_STATUS_LABELS,
  type ClientProcessNode,
} from "../../lib/clientProcess";
import type { WordingLang } from "../../lib/clientWording";
import { ClientGlossaryText } from "./TechnicalTerm";

type Props = {
  node: ClientProcessNode;
  language: WordingLang;
  previousLabels: string[];
  nextLabels: string[];
  onClose: () => void;
  onOpenDeliverable?: () => void;
  deliverableLabel?: string;
};

const copy = {
  he: {
    dialog: "פרטי שלב בתהליך",
    close: "סגור",
    what: "מה קורה כאן?",
    why: "למה זה חשוב?",
    next: "מה קורה אחרי זה?",
    input: "מה נכנס לשלב",
    who: "מי מבצע את השלב",
    technical: "פרטים טכניים",
    technicalEmpty: "אין פרטים טכניים נוספים שמורים לשלב הזה.",
    terms: "מערכות ומונחים בשלב",
    open: "פתח תצוגה",
  },
  en: {
    dialog: "Process step details",
    close: "Close",
    what: "What happens here?",
    why: "Why does it matter?",
    next: "What happens next?",
    input: "What enters this step",
    who: "Who performs it",
    technical: "Technical details",
    technicalEmpty: "No additional technical details are stored for this step.",
    terms: "Systems and terms in this step",
    open: "Open preview",
  },
} as const;

export function ProcessNodeDetails({
  node,
  language,
  previousLabels,
  nextLabels,
  onClose,
  onOpenDeliverable,
  deliverableLabel,
}: Props) {
  const t = copy[language];
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const explanation = useMemo(
    () => explainClientProcessNode(node, language, { previousLabels, nextLabels }),
    [language, nextLabels, node, previousLabels],
  );
  const category = PROCESS_CATEGORY_META[explanation.category];
  const terms = useMemo(() => findClientGlossaryTerms(node.label), [node.label]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="client-flow-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="client-flow-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={t.dialog}
        onMouseDown={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()}
        dir={language === "he" ? "rtl" : "ltr"}
      >
        <header className="client-flow-drawer-head">
          <div>
            <div className="client-flow-detail-badges">
              <span className="client-flow-category-badge" data-category={explanation.category}>
                <span aria-hidden="true">{category.icon}</span>
                {category[language]}
              </span>
              {explanation.status ? (
                <span className="client-flow-status-badge" data-status={explanation.status}>
                  {PROCESS_STATUS_LABELS[explanation.status][language]}
                </span>
              ) : null}
            </div>
            <h2 id={titleId}><ClientGlossaryText text={explanation.title} language={language} /></h2>
          </div>
          <button ref={closeRef} type="button" className="client-flow-close" onClick={onClose} aria-label={t.close}>×</button>
        </header>

        <div className="client-flow-primary-explanation">
          <section>
            <h3>{t.what}</h3>
            <p>{explanation.what}</p>
          </section>
          <section>
            <h3>{t.why}</h3>
            <p>{explanation.why}</p>
          </section>
          <section>
            <h3>{t.next}</h3>
            <p>{explanation.output}</p>
          </section>
        </div>

        <dl className="client-flow-facts">
          <div>
            <dt>{t.input}</dt>
            <dd>{explanation.input}</dd>
          </div>
          <div>
            <dt>{t.who}</dt>
            <dd>{explanation.who}</dd>
          </div>
        </dl>

        <details className="client-flow-technical">
          <summary>{t.technical}</summary>
          <div className="client-flow-technical-body">
            {explanation.technicalDetails ? <p>{explanation.technicalDetails}</p> : null}
            {terms.length ? (
              <div>
                <strong>{t.terms}</strong>
                <ul>
                  {terms.map((term) => (
                    <li key={term.key}>
                      <strong>{term.displayName}</strong>
                      <span>{language === "he" ? term.he : term.en ?? term.he}</span>
                      {term.technical ? <small>{term.technical}</small> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!explanation.technicalDetails && !terms.length ? <p>{t.technicalEmpty}</p> : null}
          </div>
        </details>

        {onOpenDeliverable ? (
          <button type="button" className="primary-button client-flow-real-action" onClick={onOpenDeliverable}>
            {t.open}{deliverableLabel ? ` · ${deliverableLabel}` : ""}
          </button>
        ) : null}
      </aside>
    </div>
  );
}
