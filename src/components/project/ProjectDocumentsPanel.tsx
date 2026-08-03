import { useState } from "react";
import { generateProjectDocument, type ProjectDocType } from "../../services/documentsApi";

const DOC_TYPES: Array<{ key: ProjectDocType; label: string }> = [
  { key: "project_brief", label: "Project brief" },
  { key: "functional_spec", label: "Functional specification" },
  { key: "technical_spec", label: "Technical specification" },
  { key: "supplier_brief", label: "Supplier brief" },
  { key: "client_proposal", label: "Client proposal" },
  { key: "internal_planning", label: "Internal planning" },
  { key: "implementation_checklist", label: "Implementation checklist" },
  { key: "meeting_summary", label: "Meeting summary" },
  { key: "change_request", label: "Change request" },
];

const LANGUAGES = ["English", "Hebrew", "Spanish", "French", "German", "Arabic", "Russian"];

/** Agency-only document generation from the project's existing structured data. */
export function ProjectDocumentsPanel({ projectId }: { projectId: string }) {
  const [docType, setDocType] = useState<ProjectDocType>("project_brief");
  const [language, setLanguage] = useState("English");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await generateProjectDocument({ projectId, docType, language, notes });
      setMarkdown(result.markdown ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate this document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Requirements documents</h2>
      <p className="form-note">
        Generated from this project's brief, requirements, schedule and estimate. Supplier and client documents never
        include internal cost or margin.
      </p>
      <div className="form-grid">
        <label>
          Document
          <select value={docType} onChange={(e) => setDocType(e.target.value as ProjectDocType)}>
            {DOC_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Language
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Extra instructions (optional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Focus on phase one only…" />
        </label>
      </div>
      <div className="table-actions">
        <button type="button" className="primary-button" onClick={() => void generate()} disabled={busy}>
          {busy ? "Generating…" : markdown ? "Regenerate" : "Generate document"}
        </button>
        {markdown ? (
          <button type="button" onClick={() => window.print()}>Print</button>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {markdown ? <pre className="generated-document">{markdown}</pre> : null}
    </section>
  );
}