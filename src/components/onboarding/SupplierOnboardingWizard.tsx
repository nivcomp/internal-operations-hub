import { useMemo, useState } from "react";
import { WizardShell, type WizardStep } from "./WizardShell";
import { useOnboarding } from "../../context/OnboardingContext";
import { submitSupplierOnboarding } from "../../services/onboardingApi";

type Answers = Record<string, string>;

const skillOptions = [
  "Web development", "Mobile development", "Automation", "Integrations",
  "UI / UX design", "Data & reporting", "QA & testing", "DevOps",
];

export function SupplierOnboardingWizard({ onDone }: { onDone: () => void }) {
  const { state, save } = useOnboarding();
  const stored = (state?.answers ?? {}) as Answers;

  const [answers, setAnswers] = useState<Answers>(stored);
  const [index, setIndex] = useState(state?.currentStep ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exited, setExited] = useState(false);

  const set = (key: string) => (value: string) => setAnswers((prev) => ({ ...prev, [key]: value }));
  const field = (key: string) => answers[key] ?? "";
  const list = (key: string) => field(key).split(" | ").filter(Boolean);
  const toggle = (key: string, option: string) => {
    const current = list(key);
    const next = current.includes(option) ? current.filter((v) => v !== option) : [...current, option];
    set(key)(next.join(" | "));
  };

  const steps = useMemo<WizardStep[]>(() => [
    {
      id: "welcome",
      title: "Welcome to your supplier workspace",
      helper: "This is where you receive work, ask questions and report your hours. Complete your profile so Yaniv can match you to the right projects.",
      render: () => (
        <ul className="wizard-list">
          <li>You only ever see projects assigned to you.</li>
          <li>Client pricing is never shared with suppliers.</li>
          <li>Your profile is reviewed by Yaniv before work is assigned.</li>
        </ul>
      ),
    },
    {
      id: "details",
      title: "Your professional details",
      helper: "How Yaniv reaches you and plans around your working hours.",
      validate: () => (field("name").trim() ? null : "Please enter your name."),
      render: () => (
        <div className="form-grid">
          <label>Full name<input value={field("name")} onChange={(e) => set("name")(e.target.value)} /></label>
          <label>Email<input type="email" value={field("email")} onChange={(e) => set("email")(e.target.value)} /></label>
          <label>Phone<input value={field("phone")} onChange={(e) => set("phone")(e.target.value)} /></label>
          <label>Country<input value={field("country")} onChange={(e) => set("country")(e.target.value)} /></label>
          <label>Timezone<input value={field("timezone")} onChange={(e) => set("timezone")(e.target.value)} placeholder="For example: UTC+2" /></label>
        </div>
      ),
    },
    {
      id: "skills",
      title: "What do you do best?",
      helper: "Pick your main skills and add anything that is missing.",
      render: () => (
        <>
          <div className="option-grid">
            {skillOptions.map((option) => (
              <button key={option} type="button"
                className={`option-chip${list("skills_selected").includes(option) ? " active" : ""}`}
                onClick={() => toggle("skills_selected", option)}>{option}</button>
            ))}
          </div>
          <label>Anything else you know that is not listed
            <textarea rows={3} value={field("custom_skills")} onChange={(e) => set("custom_skills")(e.target.value)}
              placeholder="Separate with commas" />
          </label>
          <label>Preferred project types
            <input value={field("project_types")} onChange={(e) => set("project_types")(e.target.value)} />
          </label>
        </>
      ),
    },
    {
      id: "availability",
      title: "How much time can you give?",
      helper: "This is used only for planning, never shared with clients.",
      render: () => (
        <div className="form-grid">
          <label>Weekly availability (hours)
            <input type="number" min={0} value={field("weekly_availability")} onChange={(e) => set("weekly_availability")(e.target.value)} />
          </label>
          <label>Preferred working days
            <input value={field("working_days")} onChange={(e) => set("working_days")(e.target.value)} placeholder="Mon–Thu" />
          </label>
          <label>Earliest start date
            <input type="date" value={field("earliest_start")} onChange={(e) => set("earliest_start")(e.target.value)} />
          </label>
        </div>
      ),
    },
    {
      id: "terms",
      title: "Your commercial terms",
      helper: "Your rate is internal to the agency. Clients never see it.",
      render: () => (
        <div className="form-grid">
          <label>Hourly rate
            <input type="number" min={0} value={field("hourly_rate")} onChange={(e) => set("hourly_rate")(e.target.value)} />
          </label>
          <label>Currency
            <select value={field("currency") || "GBP"} onChange={(e) => set("currency")(e.target.value)}>
              <option value="GBP">GBP</option><option value="EUR">EUR</option>
              <option value="USD">USD</option><option value="ILS">ILS</option>
            </select>
          </label>
          <label>Do you take fixed-price work?
            <select value={field("fixed_price") || "sometimes"} onChange={(e) => set("fixed_price")(e.target.value)}>
              <option value="yes">Yes</option><option value="sometimes">Sometimes</option><option value="no">No</option>
            </select>
          </label>
          <label>Minimum engagement
            <input value={field("minimum_engagement")} onChange={(e) => set("minimum_engagement")(e.target.value)} placeholder="For example: 10 hours" />
          </label>
        </div>
      ),
    },
    {
      id: "preferences",
      title: "How do you like to work?",
      helper: "This helps Yaniv contact you the right way.",
      optional: true,
      render: () => (
        <div className="form-grid">
          <label>Preferred communication
            <input value={field("communication")} onChange={(e) => set("communication")(e.target.value)} placeholder="Email, WhatsApp, calls" />
          </label>
          <label>Typical response time
            <input value={field("response_time")} onChange={(e) => set("response_time")(e.target.value)} placeholder="Within 24 hours" />
          </label>
          <label className="span-2">Tools you use
            <input value={field("tools_text")} onChange={(e) => set("tools_text")(e.target.value)} placeholder="Separate with commas" />
          </label>
          <label className="span-2">Portfolio links
            <textarea rows={3} value={field("portfolio_text")} onChange={(e) => set("portfolio_text")(e.target.value)} placeholder="One link per line" />
          </label>
        </div>
      ),
    },
    {
      id: "review",
      title: "Check your profile",
      helper: "Yaniv reviews your profile before assigning work. You can correct anything now.",
      render: () => (
        <dl className="wizard-summary">
          {[
            ["Name", field("name")],
            ["Contact", [field("email"), field("phone")].filter(Boolean).join(" · ")],
            ["Location", [field("country"), field("timezone")].filter(Boolean).join(" · ")],
            ["Skills", [...list("skills_selected"), field("custom_skills")].filter(Boolean).join(", ")],
            ["Availability", field("weekly_availability") ? `${field("weekly_availability")} h/week` : ""],
            ["Rate", field("hourly_rate") ? `${field("hourly_rate")} ${field("currency") || "GBP"}` : ""],
            ["Fixed price", field("fixed_price")],
          ].map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>
          ))}
        </dl>
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
    const skills = [
      ...list("skills_selected"),
      ...field("custom_skills").split(",").map((v) => v.trim()).filter(Boolean),
    ];
    await submitSupplierOnboarding({
      ...answers,
      skills,
      tools: field("tools_text").split(",").map((v) => v.trim()).filter(Boolean),
      portfolio_links: field("portfolio_text").split("\n").map((v) => v.trim()).filter(Boolean),
    });
    onDone();
  });

  if (exited) {
    return (
      <div className="wizard-screen">
        <div className="card wizard-card">
          <h1 className="wizard-title">Saved</h1>
          <p className="wizard-helper">Your profile is saved as a draft. You can finish it whenever you like.</p>
          <button type="button" className="primary-button" onClick={() => setExited(false)}>Continue now</button>
        </div>
      </div>
    );
  }

  return (
    <WizardShell
      eyebrow="Supplier setup"
      steps={steps}
      index={index}
      saving={saving}
      error={error}
      finishLabel="Submit for approval"
      onBack={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={goNext}
      onSkip={() => void guard(async () => { await persist(index + 1); setIndex(index + 1); })}
      onSaveAndExit={() => void guard(async () => { await persist(index); setExited(true); })}
      onFinish={finish}
    />
  );
}