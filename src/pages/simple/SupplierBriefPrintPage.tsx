import { useEffect, useState } from "react";
import { listProjectDocuments, type ProjectDocument } from "../../services/documentsApi";

export function SupplierBriefPrintPage({ projectId, documentId, autoPrint }: { projectId: string; documentId: string; autoPrint: boolean }) {
  const [document, setDocument] = useState<ProjectDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void listProjectDocuments(projectId).then((items) => {
      const safe = items.find((item) => item.id === documentId && item.document_type === "supplier_brief" && item.audience === "supplier");
      if (!safe) throw new Error("תדריך הספק אינו זמין לחשבון הזה.");
      setDocument(safe);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "לא הצלחנו לפתוח את התדריך."));
  }, [projectId, documentId]);

  useEffect(() => {
    if (!document || !autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [document, autoPrint]);

  return <main className="supplier-print-page" dir="rtl" lang="he">
    <header className="supplier-print-toolbar no-print">
      <button type="button" onClick={() => window.opener ? window.close() : window.history.back()}>חזרה</button>
      <button type="button" onClick={() => window.print()}>הדפס</button>
      <button type="button" className="primary-button" onClick={() => window.print()}>שמירה כ־PDF</button>
    </header>
    {error ? <p className="form-error">{error}</p> : null}
    {!document && !error ? <p>טוען תדריך…</p> : null}
    {document ? <article className="supplier-print-document">
      <header><p>מסמך מסירה לספק</p><h1>תדריך ביצוע</h1><span>גרסה {document.version} · {new Date(document.created_at).toLocaleDateString("he-IL")}</span></header>
      <pre>{document.markdown}</pre>
      <footer>מסמך זה מיועד לספק ואינו כולל מחיר לקוח, מרווח סוכנות או הערות פנימיות.</footer>
    </article> : null}
  </main>;
}
