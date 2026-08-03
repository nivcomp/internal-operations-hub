import { useState } from "react";
import { Disclosure } from "../ui/Disclosure";
import { useOnboarding } from "../../context/OnboardingContext";

type FieldDef = {
  key: string;
  label: string;
  helper: string;
  priority: "recommended" | "optional";
  type?: "text" | "number";
};

const fields: FieldDef[] = [
  { key: "agency_name", label: "Agency name", helper: "Shown on reports and client documents.", priority: "recommended" },
  { key: "agency_contact", label: "Contact details", helper: "Email or phone used on client documents.", priority: "recommended" },
  { key: "default_currency", label: "Default currency", helper: "Used when a project has no currency of its own.", priority: "recommended" },
  { key: "default_rate", label: "Default client calculation rate", helper: "Starting rate for new project estimates.", priority: "recommended", type: "number" },
  { key: "internal_cost", label: "Your internal cost or target value per hour", helper: "Used for margin, never shown to clients.", priority: "recommended", type: "number" },
  { key: "target_margin", label: "Default target margin %", helper: "Applied to new estimates.", priority: "recommended", type: "number" },
  { key: "risk_buffer", label: "Default risk buffer %", helper: "Protects estimates against unknowns.", priority: "optional", type: "number" },
  { key: "management_buffer", label: "Default management buffer %", helper: "Covers coordination time.", priority: "optional", type: "number" },
  { key: "payment_terms", label: "Standard payment terms", helper: "For example: 50% upfront, 50% on delivery.", priority: "optional" },
  { key: "estimate_validity", label: "Standard estimate validity", helper: "For example: 30 days.", priority: "optional" },
  { key: "change_wording", label: "Standard change-request wording", helper: "Reused when pricing changes.", priority: "optional" },
  { key: "logo_url", label: "Agency logo link", helper: "Optional image link for reports.", priority: "optional" },
];

type Props = {
  hasClient: boolean;
  hasSupplier: boolean;
  hasProject: boolean;
  onCreateClient: () => void;
  onCreateSupplier: () => void;
  onCreateProject: () => void;
};

export function AgencySetupAssistant({
  hasClient, hasSupplier, hasProject, onCreateClient, onCreateSupplier, onCreateProject,
}: Props) {
  const { state, save } = useOnboarding();
  const stored = (state?.answers ?? {}) as Record<string, string>;
  const skipped = state?.skippedSteps ?? [];

  const [draft, setDraft] = useState<Record<string, string>>(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = fields.filter((f) => (stored[f.key] ?? "").trim() || skipped.includes(f.key)).length;
  const milestones = [hasClient, hasSupplier, hasProject].filter(Boolean).length;
  const percent = Math.round(((done + milestones) / (fields.length + 3)) * 100);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try { await action(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally { setSaving(false); }
  }

  const saveField = (key: string) => run(async () => {
    await save({ answers: { ...stored, [key]: draft[key] ?? "" }, completionPercentage: percent });
  });

  const skipField = (key: string) => run(async () => {
    await save({ skippedSteps: Array.from(new Set([...skipped, key])), completionPercentage: percent });
  });

  return (
    <div className="card setup-assistant">
      <div className="control-summary-head">
        <div>
          <span className="eyebrow">Setup assistant</span>
          <h2>Your business configuration</h2>
          <p className="home-subtitle">Fill in what matters now. You can return to the rest whenever you like.</p>
        </div>
        <strong>{percent}% ready</strong>
      </div>
      <div className="wizard-progress" aria-hidden><div className="wizard-progress-bar" style={{ width: `${percent}%` }} /></div>

      <div className="setup-milestones">
        {[
          { label: "First client", ok: hasClient, action: onCreateClient, cta: "Create client" },
          { label: "First supplier", ok: hasSupplier, action: onCreateSupplier, cta: "Create supplier" },
          { label: "First project", ok: hasProject, action: onCreateProject, cta: "Create project" },
        ].map((item) => (
          <div key={item.label} className={`setup-milestone${item.ok ? " done" : ""}`}>
            <span>{item.ok ? "✓" : "•"} {item.label}</span>
            {item.ok ? <em>Completed</em> : <button type="button" onClick={item.action}>{item.cta}</button>}
          </div>
        ))}
      </div>

      <Disclosure title="Business defaults" hint={`${done} of ${fields.length} handled`}>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="setup-fields">
          {fields.map((f) => {
            const value = draft[f.key] ?? "";
            const isDone = (stored[f.key] ?? "").trim().length > 0;
            const isSkipped = skipped.includes(f.key);
            return (
              <div key={f.key} className="setup-field">
                <label>
                  <span>
                    {f.label}
                    <em className={`setup-tag ${isDone ? "done" : isSkipped ? "skipped" : f.priority}`}>
                      {isDone ? "completed" : isSkipped ? "skipped" : f.priority}
                    </em>
                  </span>
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={value}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </label>
                <p className="field-hint">{f.helper}</p>
                <div className="action-row compact">
                  <button type="button" onClick={() => void saveField(f.key)} disabled={saving}>Save</button>
                  {!isDone && !isSkipped ? (
                    <button type="button" className="ghost-button" onClick={() => void skipField(f.key)} disabled={saving}>
                      Skip for now
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Disclosure>
    </div>
  );
}