import { useMemo, useState } from "react";
import { WizardShell, type WizardStep } from "./WizardShell";
import { useOnboarding } from "../../context/OnboardingContext";
import { submitClientOnboarding } from "../../services/onboardingApi";

type Answers = Record<string, string>;

const capabilityOptions = [
  "Collect enquiries automatically",
  "Track customers in one place",
  "Send updates to customers",
  "Approve and sign documents",
  "Reports and dashboards",
  "Online payments",
  "I'm not sure yet",
];

export function ClientOnboardingWizard({ onDone }: { onDone: () => void }) {
  const { state, save } = useOnboarding();
  const stored = (state?.answers ?? {}) as Answers;

  const [answers, setAnswers] = useState<Answers>(stored);
  const [index, setIndex] = useState(state?.currentStep ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exited, setExited] = useState(false);

  const set = (key: string) => (value: string) => setAnswers((prev) => ({ ...prev, [key]: value }));
  const field = (key: string) => answers[key] ?? "";

  const toggleCapability = (option: string) => {
    const current = field("capabilities").split(" | ").filter(Boolean);
    const next = current.includes(option) ? current.filter((v) => v !== option) : [...current, option];
    set("capabilities")(next.join(" | "));
  };

  const steps = useMemo<WizardStep[]>(() => [
    {
      id: "welcome",
      title: "Welcome — let's shape your project together",
      helper: "We will ask a few simple questions, explore options with you, and give you an estimated budget and delivery window. Nothing is final until you approve it.",
      render: () => (
        <ul className="wizard-list">
          <li>Describe what you want to achieve, in your own words.</li>
          <li>See an estimated budget range and delivery window.</li>
          <li>Yaniv reviews everything before anything is promised.</li>
        </ul>
      ),
    },
    {
      id: "goal",
      title: "What do you want to achieve?",
      helper: "Describe the result you want for your business. No technical words needed.",
      validate: () => (field("goal").trim().length < 5 ? "Please describe the result you want." : null),
      render: () => (
        <textarea rows={5} value={field("goal")} onChange={(e) => set("goal")(e.target.value)}
          placeholder="For example: stop losing enquiries that arrive by WhatsApp" />
      ),
    },
    {
      id: "current",
      title: "What happens today?",
      helper: "Tell us how you do this now, and what is slow, manual or frustrating.",
      render: () => (
        <>
          <label>How it works today
            <textarea rows={4} value={field("current_process")} onChange={(e) => set("current_process")(e.target.value)} />
          </label>
          <label>What is difficult or slow
            <textarea rows={3} value={field("pain_points")} onChange={(e) => set("pain_points")(e.target.value)} />
          </label>
        </>
      ),
    },
    {
      id: "users",
      title: "Who will use it?",
      helper: "For example your team, your customers, or outside suppliers.",
      render: () => (
        <textarea rows={4} value={field("users")} onChange={(e) => set("users")(e.target.value)}
          placeholder="For example: 4 office staff and our customers" />
      ),
    },
    {
      id: "capabilities",
      title: "What should the system do?",
      helper: "Pick anything that sounds right. You can change this later.",
      render: () => (
        <div className="option-grid">
          {capabilityOptions.map((option) => {
            const active = field("capabilities").split(" | ").includes(option);
            return (
              <button key={option} type="button" className={`option-chip${active ? " active" : ""}`}
                onClick={() => toggleCapability(option)}>{option}</button>
            );
          })}
        </div>
      ),
    },
    {
      id: "systems",
      title: "Which tools do you already use?",
      helper: "WhatsApp, a CRM, email, a website, spreadsheets, or anything else.",
      optional: true,
      render: () => (
        <textarea rows={4} value={field("existing_systems")} onChange={(e) => set("existing_systems")(e.target.value)} />
      ),
    },
    {
      id: "budget",
      title: "What budget feels comfortable?",
      helper: "This is only a starting point. You will receive an estimate, not a final quote.",
      render: () => (
        <div className="option-grid">
          {["Up to £5,000", "£5,000 – £15,000", "£15,000 – £40,000", "More than £40,000", "I don't know yet"].map((option) => (
            <button key={option} type="button"
              className={`option-chip${field("budget_range") === option ? " active" : ""}`}
              onClick={() => set("budget_range")(option)}>{option}</button>
          ))}
        </div>
      ),
    },
    {
      id: "date",
      title: "When would you like it finished?",
      helper: "Yaniv will review whether this date is realistic and tell you honestly.",
      optional: true,
      render: () => (
        <>
          <label>Requested completion date
            <input type="date" value={field("requested_date")} onChange={(e) => set("requested_date")(e.target.value)} />
          </label>
          <label>How important is this date?
            <select value={field("date_priority") || "flexible"} onChange={(e) => set("date_priority")(e.target.value)}>
              <option value="flexible">Flexible</option>
              <option value="preferred">Preferred</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>Why this date?
            <textarea rows={3} value={field("date_reason")} onChange={(e) => set("date_reason")(e.target.value)} />
          </label>
        </>
      ),
    },
    {
      id: "files",
      title: "Anything you can show us?",
      helper: "Links to examples, current tools or documents. This is optional.",
      optional: true,
      render: () => (
        <textarea rows={4} value={field("links")} onChange={(e) => set("links")(e.target.value)}
          placeholder="One link per line" />
      ),
    },
    {
      id: "review",
      title: "Here is what we understood",
      helper: "Check the summary. You can go back and change any answer before sending it.",
      render: () => (
        <>
          <label>Give your project a name
            <input value={field("project_name")} onChange={(e) => set("project_name")(e.target.value)}
              placeholder="For example: Customer enquiry system" />
          </label>
          <dl className="wizard-summary">
            {[
              ["Goal", field("goal")],
              ["Today", field("current_process")],
              ["Difficulties", field("pain_points")],
              ["Users", field("users")],
              ["Should do", field("capabilities").split(" | ").join(", ")],
              ["Existing tools", field("existing_systems")],
              ["Budget preference", field("budget_range")],
              ["Requested date", field("requested_date")],
              ["Links", field("links")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
  ], [answers]);

  async function persist(nextIndex: number) {
    await save({
      answers,
      currentStep: nextIndex,
      completionPercentage: Math.round((nextIndex / steps.length) * 100),
    });
  }

  async function guard(run: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try { await run(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally { setSaving(false); }
  }

  const goNext = () => {
    const problem = steps[index].validate?.() ?? null;
    if (problem) { setError(problem); return; }
    void guard(async () => { await persist(index + 1); setIndex(index + 1); });
  };

  const finish = () => void guard(async () => {
    await submitClientOnboarding({ ...answers });
    onDone();
  });

  if (exited) {
    return (
      <div className="wizard-screen">
        <div className="card wizard-card">
          <h1 className="wizard-title">Saved</h1>
          <p className="wizard-helper">Your answers are saved. You can pick up exactly where you stopped.</p>
          <button type="button" className="primary-button" onClick={() => setExited(false)}>Continue now</button>
        </div>
      </div>
    );
  }

  return (
    <WizardShell
      eyebrow="Your project setup"
      steps={steps}
      index={index}
      saving={saving}
      error={error}
      finishLabel="Send to Yaniv for review"
      onBack={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={goNext}
      onSkip={() => void guard(async () => { await persist(index + 1); setIndex(index + 1); })}
      onSaveAndExit={() => void guard(async () => { await persist(index); setExited(true); })}
      onFinish={finish}
    />
  );
}