import { PageHeader } from "../components/PageHeader";
import { RulePanel } from "../components/RulePanel";

export function AIWorkbenchPage() {
  const agents = [
    ["Client Guide Agent", "Drafts intake summaries and follow-up questions from client notes."],
    ["Agency Control Agent", "Highlights missing scope, pricing, approval, and payment gates for Yaniv."],
    ["Supplier Work Agent", "Summarizes assigned work and drafts supplier progress updates."],
    ["Architect Agent", "Suggests phases, dependencies, and delivery assumptions."],
    ["Change Control Agent", "Compares requests with approved scope and drafts impact notes."],
  ];
  return (
    <>
      <PageHeader title="AI Workbench Placeholder" subtitle="No real AI calls yet. These panels show where reviewable AI drafts can live later." />
      <section className="agent-grid">
        {agents.map(([name, description]) => (
          <article className="card agent-card" key={name}>
            <p className="eyebrow">Placeholder</p>
            <h2>{name}</h2>
            <p>{description}</p>
            <div className="draft-box">Future editable draft output. Yaniv reviews before any client or supplier action.</div>
          </article>
        ))}
      </section>
      <section className="card">
        <h2>Future agency control context</h2>
        <p>The Agency Control Agent should use Action Queue data as its main context before drafting recommendations for Yaniv.</p>
      </section>
      <RulePanel />
    </>
  );
}
