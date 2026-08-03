import { useEffect, useState } from "react";
import { StatusBadge } from "../StatusBadge";
import { fetchSupplierEstimateWork, saveSupplierReview } from "../../services/estimationApi";
import type { EstimateItem, EstimateSupplierReview } from "../../types/estimation";
import { roleLabels } from "../../types/estimation";

type Props = { supplierId: string; readOnly?: boolean };

type Draft = {
  suggested_hours_min: string;
  suggested_hours_max: string;
  fixed_quote: string;
  assumptions: string;
  dependencies: string;
  missing_information: string;
  delivery_risk: string;
  proposed_duration_days: string;
  weekly_availability_hours: string;
};

const emptyDraft: Draft = {
  suggested_hours_min: "", suggested_hours_max: "", fixed_quote: "", assumptions: "",
  dependencies: "", missing_information: "", delivery_risk: "", proposed_duration_days: "",
  weekly_availability_hours: "",
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function SupplierEstimateReview({ supplierId, readOnly = false }: Props) {
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [reviews, setReviews] = useState<EstimateSupplierReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const data = await fetchSupplierEstimateWork(supplierId);
      setItems(data.items); setReviews(data.reviews); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your assigned estimate work.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [supplierId]);

  function openItem(item: EstimateItem) {
    const review = reviews.find((r) => r.item_id === item.id);
    setOpenId(item.id);
    setDraft({
      suggested_hours_min: review?.suggested_hours_min?.toString() ?? String(item.estimated_hours_min ?? ""),
      suggested_hours_max: review?.suggested_hours_max?.toString() ?? String(item.estimated_hours_max ?? ""),
      fixed_quote: review?.fixed_quote?.toString() ?? "",
      assumptions: review?.assumptions ?? "",
      dependencies: review?.dependencies ?? "",
      missing_information: review?.missing_information ?? "",
      delivery_risk: review?.delivery_risk ?? "",
      proposed_duration_days: review?.proposed_duration_days?.toString() ?? "",
      weekly_availability_hours: review?.weekly_availability_hours?.toString() ?? "",
    });
  }

  async function submit(item: EstimateItem, decision: "confirmed" | "changes_requested" | "declined") {
    if (readOnly) return;
    setBusy(true); setNotice(null);
    try {
      await saveSupplierReview({
        estimate_id: item.estimate_id,
        item_id: item.id,
        supplier_id: supplierId,
        supplier_decision: decision,
        status: decision === "confirmed" ? "supplier_reviewed" : decision === "declined" ? "supplier_changes_requested" : "supplier_changes_requested",
        suggested_hours_min: num(draft.suggested_hours_min),
        suggested_hours_max: num(draft.suggested_hours_max),
        fixed_quote: num(draft.fixed_quote),
        assumptions: draft.assumptions,
        dependencies: draft.dependencies,
        missing_information: draft.missing_information,
        delivery_risk: draft.delivery_risk,
        proposed_duration_days: num(draft.proposed_duration_days),
        weekly_availability_hours: num(draft.weekly_availability_hours),
      } as any);
      setNotice("Your review was sent to the agency. The agency decides whether to accept the change.");
      setOpenId(null);
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save your review.");
    } finally { setBusy(false); }
  }

  if (loading) return <section className="card"><h2>Estimate review</h2><p className="muted-text">Loading assigned work…</p></section>;
  if (error) return <section className="card"><h2>Estimate review</h2><p className="form-error" role="alert">{error}</p></section>;

  return (
    <section className="card">
      <h2>Estimate review</h2>
      <p className="muted-text">Review only the work assigned to you. You are not reviewing the client budget.</p>
      {items.length === 0 ? (
        <p className="muted-text">No estimate items are assigned to you yet.</p>
      ) : (
        <table>
          <thead><tr><th>Work item</th><th>Role</th><th>Agency hours</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((item) => {
              const review = reviews.find((r) => r.item_id === item.id);
              return (
                <tr key={item.id}>
                  <td><strong>{item.title}</strong>{item.description ? <><br />{item.description}</> : null}</td>
                  <td>{roleLabels[item.responsible_role] ?? item.responsible_role}</td>
                  <td>{item.estimated_hours_min}–{item.estimated_hours_max} hrs</td>
                  <td>
                    <StatusBadge
                      label={review?.status ?? "not_sent"}
                      tone={review?.status === "accepted_by_yaniv" ? "success" : review?.status === "rejected_by_yaniv" ? "danger" : "warning"}
                    />
                  </td>
                  <td><button type="button" onClick={() => openItem(item)} disabled={readOnly}>Review</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {openId ? (() => {
        const item = items.find((i) => i.id === openId);
        if (!item) return null;
        return (
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void submit(item, "changes_requested"); }}>
            <h3 className="span-2">Review: {item.title}</h3>
            <label>Minimum hours<input type="number" min={0} step="0.25" value={draft.suggested_hours_min} onChange={(e) => setDraft({ ...draft, suggested_hours_min: e.target.value })} /></label>
            <label>Maximum hours<input type="number" min={0} step="0.25" value={draft.suggested_hours_max} onChange={(e) => setDraft({ ...draft, suggested_hours_max: e.target.value })} /></label>
            <label>Fixed quote (optional)<input type="number" min={0} value={draft.fixed_quote} onChange={(e) => setDraft({ ...draft, fixed_quote: e.target.value })} /></label>
            <label>Delivery duration (days)<input type="number" min={0} value={draft.proposed_duration_days} onChange={(e) => setDraft({ ...draft, proposed_duration_days: e.target.value })} /></label>
            <label>Weekly availability (hours)<input type="number" min={0} value={draft.weekly_availability_hours} onChange={(e) => setDraft({ ...draft, weekly_availability_hours: e.target.value })} /></label>
            <label className="span-2">Assumptions<textarea value={draft.assumptions} onChange={(e) => setDraft({ ...draft, assumptions: e.target.value })} /></label>
            <label className="span-2">Dependencies<textarea value={draft.dependencies} onChange={(e) => setDraft({ ...draft, dependencies: e.target.value })} /></label>
            <label className="span-2">Missing information<textarea value={draft.missing_information} onChange={(e) => setDraft({ ...draft, missing_information: e.target.value })} /></label>
            <label className="span-2">Delivery risk<textarea value={draft.delivery_risk} onChange={(e) => setDraft({ ...draft, delivery_risk: e.target.value })} /></label>
            <div className="form-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => void submit(item, "confirmed")}>
                {busy ? "Saving…" : "Confirm estimate"}
              </button>
              <button type="submit" disabled={busy}>Suggest changes</button>
              <button type="button" disabled={busy} onClick={() => void submit(item, "declined")}>Decline item</button>
              <button type="button" onClick={() => setOpenId(null)}>Close</button>
            </div>
          </form>
        );
      })() : null}
      {notice ? <p className="form-success">{notice}</p> : null}
      {readOnly ? <p className="muted-text">Preview mode — submitting a supplier review is disabled.</p> : null}
    </section>
  );
}