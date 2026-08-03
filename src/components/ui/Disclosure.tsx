import { useState, type ReactNode } from "react";

type DisclosureProps = {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Optional trailing element in the header, e.g. a count badge. */
  trailing?: ReactNode;
};

/** Progressive disclosure wrapper: advanced or secondary content stays folded. */
export function Disclosure({ title, hint, defaultOpen = false, children, trailing }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`disclosure${open ? " open" : ""}`}>
      <button type="button" className="disclosure-header" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="disclosure-chevron" aria-hidden>▸</span>
        <span className="disclosure-title">{title}</span>
        {hint ? <span className="disclosure-hint">{hint}</span> : null}
        <span className="disclosure-spacer" />
        {trailing}
      </button>
      {open ? <div className="disclosure-body">{children}</div> : null}
    </section>
  );
}