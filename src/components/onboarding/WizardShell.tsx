import type { ReactNode } from "react";

export type WizardStep = {
  id: string;
  title: string;
  helper: string;
  optional?: boolean;
  render: () => ReactNode;
  /** Return an error message to block moving on. */
  validate?: () => string | null;
};

type WizardShellProps = {
  eyebrow: string;
  steps: WizardStep[];
  index: number;
  saving: boolean;
  error: string | null;
  finishLabel: string;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  onSaveAndExit: () => void;
  onFinish: () => void;
};

export function WizardShell({
  eyebrow, steps, index, saving, error, finishLabel, onBack, onNext, onSkip, onSaveAndExit, onFinish,
}: WizardShellProps) {
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const percent = Math.round(((index + 1) / steps.length) * 100);

  return (
    <div className="wizard-screen">
      <div className="card wizard-card">
        <div className="wizard-head">
          <p className="eyebrow">{eyebrow}</p>
          <span className="wizard-count">Step {index + 1} of {steps.length}</span>
        </div>
        <div className="wizard-progress" aria-hidden>
          <div className="wizard-progress-bar" style={{ width: `${percent}%` }} />
        </div>

        <h1 className="wizard-title">{step.title}</h1>
        <p className="wizard-helper">{step.helper}</p>

        <div className="wizard-body">{step.render()}</div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="wizard-actions">
          <button type="button" onClick={onBack} disabled={index === 0 || saving}>Back</button>
          <div className="wizard-actions-right">
            <button type="button" className="ghost-button" onClick={onSaveAndExit} disabled={saving}>
              Save and continue later
            </button>
            {step.optional && onSkip && !isLast ? (
              <button type="button" onClick={onSkip} disabled={saving}>Skip</button>
            ) : null}
            <button
              type="button"
              className="primary-button"
              onClick={isLast ? onFinish : onNext}
              disabled={saving}
            >
              {saving ? "Saving…" : isLast ? finishLabel : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}