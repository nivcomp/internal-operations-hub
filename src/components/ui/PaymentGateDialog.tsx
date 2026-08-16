import { useEffect } from "react";
import type { PaymentDecision } from "../../types/domain";

type Props = {
  open: boolean;
  projectName: string;
  busy?: boolean;
  onChoose: (decision: PaymentDecision) => void;
  onCancel: () => void;
};

export function PaymentGateDialog({ open, projectName, busy = false, onChoose, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop payment-gate-backdrop" role="presentation" onClick={() => { if (!busy) onCancel(); }}>
      <div className="dialog-card payment-gate-dialog" role="alertdialog" aria-modal="true" aria-labelledby="payment-gate-title" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">בדיקת תשלום לפני פתיחת פרויקט</p>
        <h2 id="payment-gate-title">האם התשלום עבור “{projectName}” התקבל?</h2>
        <p>הפרויקט לא ייפתח עד שתבחר אחת משתי האפשרויות. הבחירה נשמרת ביומן הפעילות.</p>

        <div className="payment-gate-options">
          <button type="button" className="payment-gate-option paid" disabled={busy} onClick={() => onChoose("paid")}>
            <strong>כן, התשלום התקבל</strong>
            <span>פתח את הפרויקט וסמן את שער התשלום כמאושר.</span>
          </button>
          <button type="button" className="payment-gate-option override" disabled={busy} onClick={() => onChoose("override_unpaid")}>
            <strong>פתח למרות שטרם שולם</strong>
            <span>פתח כחריגה מתועדת והשאר את תחילת העבודה חסומה לתשלום.</span>
          </button>
        </div>

        <div className="dialog-actions">
          <button type="button" className="ghost-button" disabled={busy} onClick={onCancel}>ביטול</button>
          {busy ? <span className="form-note">פותח את הפרויקט…</span> : null}
        </div>
      </div>
    </div>
  );
}
