import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  findClientGlossaryMatches,
  getClientGlossaryTerm,
  type ClientGlossaryTerm,
} from "../../lib/clientGlossary";
import type { WordingLang } from "../../lib/clientWording";

type TechnicalTermProps = {
  term: ClientGlossaryTerm | string;
  language: WordingLang;
  label?: string;
};

export function TechnicalTerm({ term, language, label }: TechnicalTermProps) {
  const item = typeof term === "string" ? getClientGlossaryTerm(term) : term;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("touchstart", closeOutside, { passive: true });
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("touchstart", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!item) return <>{label ?? String(term)}</>;

  const explanation = language === "he" ? item.he : item.en ?? item.he;
  const helpLabel = language === "he" ? `הסבר על ${item.displayName}` : `Explain ${item.displayName}`;

  return (
    <span className="technical-term" ref={rootRef}>
      <span>{label ?? item.displayName}</span>
      <button
        type="button"
        className="technical-term-help"
        aria-label={helpLabel}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => event.stopPropagation()}
      >
        ⓘ
      </button>
      {open ? (
        <span className="technical-term-popover" id={id} role="dialog" aria-label={item.displayName} onClick={(event: ReactMouseEvent<HTMLSpanElement>) => event.stopPropagation()}>
          <strong>{item.displayName}</strong>
          <span>{explanation}</span>
          {item.technical ? <small>{item.technical}</small> : null}
        </span>
      ) : null}
    </span>
  );
}

type ClientGlossaryTextProps = {
  text: string;
  language: WordingLang;
};

export function ClientGlossaryText({ text, language }: ClientGlossaryTextProps) {
  const matches = findClientGlossaryMatches(text);
  if (!matches.length) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start > cursor) parts.push(text.slice(cursor, match.start));
    parts.push(
      <TechnicalTerm
        key={`${match.term.key}-${match.start}-${index}`}
        term={match.term}
        language={language}
        label={match.text}
      />,
    );
    cursor = match.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
