import { useState } from "react";

type RulePanelProps = {
  /** When true, render as a collapsible details panel starting closed. */
  collapsible?: boolean;
};

export function RulePanel({ collapsible = false }: RulePanelProps) {
  const [open, setOpen] = useState(false);

  const list = (
    <ul>
      <li>Client price and supplier cost stay separate.</li>
      <li>Suppliers never see client price or agency margin.</li>
      <li>Work starts only after payment is received or paid hours are available.</li>
      <li>Change requests must be priced and client-approved before becoming work.</li>
      <li>Supplier time must be approved before it becomes payable.</li>
    </ul>
  );

  if (collapsible) {
    return (
      <section className={`rule-panel rule-panel-collapsible${open ? " open" : ""}`}>
        <button
          type="button"
          className="rule-panel-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>Operating rules</span>
          <span className="muted-text">{open ? "Hide" : "View"}</span>
        </button>
        {open ? list : null}
      </section>
    );
  }

  return (
    <section className="rule-panel">
      <strong>Operating rules visible in this MVP</strong>
      {list}
    </section>
  );
}
