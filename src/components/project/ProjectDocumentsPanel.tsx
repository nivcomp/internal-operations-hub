import { useEffect, useState } from "react";
import {
  generateProjectDocument,
  listProjectDocuments,
  type ProjectDocument,
  type ProjectDocumentAudience,
  type ProjectDocType,
} from "../../services/documentsApi";

const DOC_TYPES: Array<{ key: ProjectDocType; label: string; simpleLabel: string }> = [
  { key: "project_brief", label: "Project brief", simpleLabel: "תקציר פרויקט" },
  { key: "functional_spec", label: "Functional specification", simpleLabel: "מסמך אפיון מלא" },
  { key: "technical_spec", label: "Technical specification", simpleLabel: "אפיון טכני למתכנת" },
  { key: "supplier_brief", label: "Supplier brief", simpleLabel: "תדריך לספק" },
  { key: "client_proposal", label: "Client proposal", simpleLabel: "הצעה ללקוח" },
  { key: "internal_planning", label: "Internal planning", simpleLabel: "תכנון פנימי" },
  { key: "implementation_checklist", label: "Implementation checklist", simpleLabel: "רשימת ביצוע" },
  { key: "meeting_summary", label: "Meeting summary", simpleLabel: "סיכום פגישה" },
  { key: "change_request", label: "Change request", simpleLabel: "בקשת שינוי" },
];

const SIMPLE_TYPES = new Set<ProjectDocType>(["functional_spec", "technical_spec", "implementation_checklist", "meeting_summary"]);
const LANGUAGES = ["Hebrew", "English", "Spanish", "French", "German", "Arabic", "Russian"];

/** Shared document center. RLS limits read-only portal users to their client-safe documents. */
export function ProjectDocumentsPanel({
  projectId,
  simple = false,
  readOnly = false,
}: { projectId: string; simple?: boolean; readOnly?: boolean }) {
  const [docType, setDocType] = useState<ProjectDocType>(simple ? "functional_spec" : "project_brief");
  const [language, setLanguage] = useState(simple ? "Hebrew" : "English");
  const [audience, setAudience] = useState<ProjectDocumentAudience>(simple ? "client" : "agency");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string>();

  async function refresh() {
    const loaded = await listProjectDocuments(projectId);
    const rows = readOnly || simple ? loaded.filter((document) => document.audience === "client") : loaded;
    setDocuments(rows);
    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id);
  }

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load documents."));
  }, [projectId]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await generateProjectDocument({ projectId, docType, language, notes, audience });
      await refresh();
      setSelectedId(result.document.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate this document.");
    } finally {
      setBusy(false);
    }
  }

  const selected = documents.find((document) => document.id === selectedId);
  const typeLabel = (type: ProjectDocType) => {
    const item = DOC_TYPES.find((candidate) => candidate.key === type);
    return simple || readOnly ? item?.simpleLabel : item?.label;
  };

  return (
    <section className="card project-document-center" dir={simple || readOnly ? "rtl" : undefined}>
      <h2>{simple || readOnly ? "מסמכי הפרויקט" : "Requirements documents"}</h2>
      <p className="form-note">
        {readOnly
          ? "כאן מופיעים המסמכים שהסוכנות פרסמה עבורך."
          : simple
            ? "המסמך נוצר רק מסעיפי אפיון שאושרו במפורש ונשמר באותו פרויקט. טיוטות ושאלות פתוחות אינן הופכות להתחייבות."
            : "Generated only from reviewed project data. Client documents never include internal cost or margin."}
      </p>
      {!readOnly ? <>
        <div className="form-grid">
          <label>
            {simple ? "סוג מסמך" : "Document"}
            <select value={docType} onChange={(event) => setDocType(event.target.value as ProjectDocType)}>
              {DOC_TYPES.filter((item) => !simple || SIMPLE_TYPES.has(item.key)).map((item) => (
                <option key={item.key} value={item.key}>{simple ? item.simpleLabel : item.label}</option>
              ))}
            </select>
          </label>
          <label>
            {simple ? "שפה" : "Language"}
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {!simple ? <label>
            {simple ? "מי יוכל לראות" : "Audience"}
            <select value={audience} onChange={(event) => setAudience(event.target.value as ProjectDocumentAudience)}>
              <option value="agency">{simple ? "פנימי לסוכנות" : "Agency"}</option>
              <option value="client">{simple ? "לקוח" : "Client"}</option>
            </select>
          </label> : null}
          <label>
            {simple ? "הנחיה נוספת (לא חובה)" : "Extra instructions (optional)"}
            <input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
        <div className="table-actions">
          <button type="button" className="primary-button" onClick={() => void generate()} disabled={busy}>
            {busy ? (simple ? "מייצר…" : "Generating…") : (simple ? "צור גרסה חדשה" : "Generate document")}
          </button>
          {selected ? <button type="button" onClick={() => window.print()}>{simple ? "הדפס" : "Print"}</button> : null}
        </div>
      </> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="project-document-layout">
        <div className="project-document-list">
          {documents.length ? documents.map((document) => (
            <button type="button" className={document.id === selectedId ? "active" : ""} key={document.id} onClick={() => setSelectedId(document.id)}>
              <strong>{typeLabel(document.document_type) ?? document.document_type}</strong>
              <small>v{document.version} · {document.status} · {new Date(document.created_at).toLocaleDateString(simple || readOnly ? "he-IL" : undefined)}</small>
            </button>
          )) : <p className="muted-text">{simple || readOnly ? "עדיין אין מסמכים זמינים." : "No documents yet."}</p>}
        </div>
        {selected ? <article className="generated-document">
          <header><strong>{typeLabel(selected.document_type) ?? selected.document_type}</strong><span>{selected.audience} · v{selected.version}</span></header>
          <pre>{selected.markdown}</pre>
        </article> : null}
      </div>
    </section>
  );
}
