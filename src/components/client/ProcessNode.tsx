import type { ClientGlossaryEntry } from "../../lib/clientGlossary";
import type { ClientProcessExplanation, ClientProcessNodeData } from "../../lib/clientProcessExplanation";
import type { WordingLang } from "../../lib/clientWording";

type Props = {
  node: ClientProcessNodeData;
  explanation: ClientProcessExplanation;
  language: WordingLang;
  active?: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
  onOpenTerm: (term: ClientGlossaryEntry, trigger: HTMLButtonElement) => void;
};

export function TechnicalTerm({
  term,
  language,
  onOpen,
}: {
  term: ClientGlossaryEntry;
  language: WordingLang;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const label = language === "he" ? `הסבר על ${term.displayName}` : `Explain ${term.displayName}`;
  return (
    <button
      type="button"
      className="client-technical-term"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span>{term.displayName}</span>
      <span aria-hidden="true">?</span>
    </button>
  );
}

export function ProcessNode({ node, explanation, language, active = false, onOpen, onOpenTerm }: Props) {
  return (
    <article className={`client-process-node category-${explanation.category}${active ? " is-active" : ""}`}>
      <button
        type="button"
        className="client-process-node-main"
        aria-haspopup="dialog"
        aria-expanded={active}
        onClick={(event) => onOpen(event.currentTarget)}
      >
        <span className="client-process-node-icon" aria-hidden="true">{explanation.icon}</span>
        <span className="client-process-node-copy">
          <strong>{node.label}</strong>
          <small>{explanation.categoryLabel}</small>
        </span>
        <span className="client-process-node-open" aria-hidden="true">›</span>
      </button>
      {explanation.terms.length ? (
        <div className="client-process-node-terms">
          {explanation.terms.slice(0, 2).map((term) => (
            <TechnicalTerm key={term.key} term={term} language={language} onOpen={(trigger) => onOpenTerm(term, trigger)} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
