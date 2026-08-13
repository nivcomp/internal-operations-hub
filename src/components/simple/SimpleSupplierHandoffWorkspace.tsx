import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { canWorkStart } from "../../lib/domainHelpers";
import { fetchProjectEstimation } from "../../services/estimationApi";
import {
  generateProjectDocument, listProjectDocuments, type ProjectDocument,
} from "../../services/documentsApi";
import type { EstimateBundle } from "../../types/estimation";
import type { Project } from "../../types/domain";

const emptyBundle: EstimateBundle = { estimates: [], items: [], allocations: [], reviews: [], adjustments: [], scenarios: [] };

export function SimpleSupplierHandoffWorkspace({
  project,
  onOpenSupplier,
}: {
  project: Project;
  onOpenSupplier: (supplierId: string) => void;
}) {
  const {
    suppliers, scopes, projectSchedules, updateProjectSupplierAssignment, refreshCommercials,
  } = useAppData();
  const [bundle, setBundle] = useState<EstimateBundle>(emptyBundle);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [supplierId, setSupplierId] = useState(project.assignedSupplierIds[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    const [estimateData, documentData] = await Promise.all([
      fetchProjectEstimation(project.id),
      listProjectDocuments(project.id),
    ]);
    setBundle(estimateData);
    const briefs = documentData.filter((item) => item.document_type === "supplier_brief" && item.audience === "supplier");
    setDocuments(briefs);
    setSelectedDocumentId((current) => current && briefs.some((item) => item.id === current) ? current : briefs[0]?.id ?? "");
  }

  useEffect(() => {
    void reload().catch((cause) => setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את מסירת הספק."));
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSupplierId(project.assignedSupplierIds[0] ?? ""); }, [project.id, project.assignedSupplierIds]);

  const estimate = bundle.estimates.find((item) => item.status !== "superseded") ?? bundle.estimates[0];
  const assignedItems = useMemo(() => bundle.items.filter((item) =>
    estimate && item.estimate_id === estimate.id && item.supplier_id && project.assignedSupplierIds.includes(item.supplier_id)),
  [bundle.items, estimate, project.assignedSupplierIds]);
  const supplierHours = assignedItems.reduce((sum, item) => sum + Number(item.estimated_hours_max || 0), 0);
  const schedule = projectSchedules.find((item) => item.projectId === project.id);
  const activeScope = scopes.find((item) => item.projectId === project.id);
  const assignedSuppliers = project.assignedSupplierIds
    .map((id) => suppliers.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const selectableSuppliers = [...suppliers].sort((a, b) => {
    const statusOrder = { approved: 0, pending_review: 1, inactive: 2 };
    return statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name, "he");
  });
  const selectedSupplier = suppliers.find((item) => item.id === supplierId);
  const ready = canWorkStart(project, scopes)
    && assignedSuppliers.length > 0
    && assignedSuppliers.every((item) => item.status === "approved")
    && assignedItems.length > 0;
  const blockers = [
    ...(activeScope?.status === "approved" ? [] : ["היקף העבודה עדיין לא אושר"]),
    ...(project.paymentGateStatus === "blocked" ? ["טרם התקבל תשלום או בנק שעות מתאים"] : []),
    ...(assignedSuppliers.length ? [] : ["טרם שויך ספק"]),
    ...(assignedSuppliers.some((item) => item.status !== "approved") ? ["הספק המשויך עדיין לא אושר לביצוע"] : []),
    ...(assignedItems.length ? [] : ["סעיפי האומדן עדיין אינם משויכים לספק"]),
  ];
  const selectedDocument = documents.find((item) => item.id === selectedDocumentId);
  const printUrl = selectedDocument
    ? `${window.location.origin}/?supplierBriefProject=${encodeURIComponent(project.id)}&supplierBriefDocument=${encodeURIComponent(selectedDocument.id)}`
    : "";

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await reload(); await refreshCommercials(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "הפעולה נכשלה."); }
    finally { setBusy(false); }
  }

  async function assignSupplier() {
    if (!supplierId || project.assignedSupplierIds.includes(supplierId)) return;
    await run(() => updateProjectSupplierAssignment(project.id, supplierId, true), "הספק שויך לפרויקט.");
  }

  async function generateBrief() {
    await run(async () => {
      const result = await generateProjectDocument({
        projectId: project.id,
        docType: "supplier_brief",
        language: "Hebrew",
        audience: "supplier",
        notes: "Create a supplier-safe implementation handoff. Exclude client price, agency margin, other supplier rates and internal client-only notes.",
      });
      setSelectedDocumentId(result.document.id);
    }, "תדריך הספק נוצר ונשמר בפרויקט.");
  }

  return (
    <div className="simple-workflow-stack" dir="rtl">
      <section className="card simple-supplier-workspace">
        <header className="simple-section-heading">
          <div><p className="eyebrow">ביצוע וספק</p><h2>מכינים מסירה בטוחה לביצוע</h2></div>
          <span className={`simple-pill ${ready ? "success" : ""}`}>{ready ? "מוכן להתחלה" : "עדיין חסום"}</span>
        </header>

        <dl className="simple-pricing-facts">
          <div><dt>ספק משויך</dt><dd>{assignedSuppliers.map((item) => item.name).join(", ") || "טרם שויך"}</dd></div>
          <div><dt>שעות ספק מוערכות</dt><dd>{supplierHours || "טרם הוגדר"}</dd></div>
          <div><dt>יעד מסירה</dt><dd>{schedule?.approvedDeliveryDate || schedule?.requestedCompletionDate || "טרם נקבע"}</dd></div>
          <div><dt>מוכנות להתחלה</dt><dd>{ready ? "כל תנאי ההתחלה מתקיימים" : "נדרש טיפול"}</dd></div>
        </dl>

        {blockers.length ? <section className="simple-risk-summary warning"><strong>מה חסר לפני ביצוע?</strong><ul>{blockers.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}

        <div className="simple-supplier-flow" aria-label="תהליך מסירת ספק">
          <span className={assignedSuppliers.length ? "done" : "active"}>1. בחר ספק</span>
          <span className={documents.length ? "done" : assignedSuppliers.length ? "active" : ""}>2. צור תדריך</span>
          <span className={selectedDocument ? "active" : ""}>3. הצג והורד</span>
          <span>4. פתח פורטל ספק</span>
        </div>

        <div className="simple-supplier-actions">
          <label>בחירת ספק
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">בחר ספק</option>
              {selectableSuppliers.map((item) => (
                <option key={item.id} value={item.id} disabled={item.status === "inactive"}>
                  {item.name} · {item.status === "approved" ? "מאושר" : item.status === "pending_review" ? "ממתין לאישור" : "לא פעיל"}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy || !supplierId || selectedSupplier?.status === "inactive" || project.assignedSupplierIds.includes(supplierId)} onClick={() => void assignSupplier()}>שייך ספק</button>
          <button type="button" className="primary-button" disabled={busy || !assignedSuppliers.length} onClick={() => void generateBrief()}>צור תדריך לספק</button>
          <p className="simple-note simple-action-note">
            {selectedSupplier?.status === "pending_review"
              ? "אפשר לשייך את הספק לתכנון, אך הפרויקט יישאר חסום לביצוע עד שהספק יאושר."
              : "כל הספקים הקיימים מוצגים כאן; ספק לא פעיל מוצג לצורך זיהוי אך אינו ניתן לשיוך."}
          </p>
        </div>

        {documents.length ? <div className="supplier-brief-picker">
          <label>גרסת תדריך
            <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
              {documents.map((item) => <option key={item.id} value={item.id}>גרסה {item.version} · {new Date(item.created_at).toLocaleDateString("he-IL")}</option>)}
            </select>
          </label>
          <div className="simple-actions-row">
            <a className="button-link" href={printUrl} target="_blank" rel="noreferrer">תצוגה מקדימה</a>
            <a className="button-link" href={`${printUrl}&print=1`} target="_blank" rel="noreferrer">הדפס</a>
            <a className="primary-button button-link" href={`${printUrl}&print=1`} target="_blank" rel="noreferrer">יצוא PDF</a>
            {assignedSuppliers[0] ? <button type="button" onClick={() => onOpenSupplier(assignedSuppliers[0].id)}>פתח פורטל ספק</button> : null}
          </div>
        </div> : null}

        {selectedDocument ? <details className="supplier-brief-preview"><summary>הצג את התדריך כאן</summary><pre>{selectedDocument.markdown}</pre></details> : null}
        {notice ? <p className="form-success">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>
    </div>
  );
}
