import { useState, type FormEvent } from "react";
import { copyToClipboard } from "../../services/accessApi";
import { quickInviteClient, quickInviteSupplier } from "../../services/invitationsApi";

type Props = {
  role: "client" | "supplier";
  onClose: () => void;
  onInvited?: () => void;
  onOpenRecord?: (input: { clientId: string | null; supplierId: string | null }) => void;
};

function whatsappHe(role: "client" | "supplier", name: string, link: string) {
  const first = name.split(" ")[0] || "היי";
  return role === "client"
    ? `היי ${first}, זה הלינק האישי שלך להתחלת הפרויקט איתנו. הוא פותח מרחב עבודה אישי שבו העוזר החכם שלנו אוסף את כל הפרטים:\n${link}`
    : `היי ${first}, זה הלינק האישי שלך להצטרפות לרשת הספקים שלנו. הוא פותח את הגדרת הפרופיל — לוקח כמה דקות:\n${link}`;
}

/** Hebrew invitation drawer for Simple Mode. Uses the existing invitation services. */
export function InviteDrawer({ role, onClose, onInvited, onOpenRecord }: Props) {
  const isClient = role === "client";
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<
    { link: string; emailed: boolean; clientId: string | null; supplierId: string | null } | null
  >(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = isClient
        ? await quickInviteClient({ company, contactName, email, phone })
        : await quickInviteSupplier({ contactName, email, phone });
      if (!response.link) throw new Error("ההזמנה נוצרה אך לא הצלחנו להפיק לינק אישי.");
      setResult({
        link: response.link,
        emailed: response.emailed,
        clientId: response.clientId,
        supplierId: response.supplierId,
      });
      setMessage(whatsappHe(role, contactName, response.link));
      onInvited?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לשלוח את ההזמנה.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null); setCompany(""); setContactName(""); setEmail(""); setPhone("");
    setMessage(""); setCopied(null); setError(null);
  }

  const waHref = result
    ? `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`
    : "";

  return (
    <div className="simple-drawer-backdrop" role="dialog" aria-modal="true" dir="rtl" onClick={onClose}>
      <aside className="simple-drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{isClient ? "הזמנת לקוח" : "הזמנת ספק"}</h2>
          <button type="button" onClick={onClose} aria-label="סגור">×</button>
        </header>

        {result ? (
          <div className="simple-drawer-body">
            <p className={result.emailed ? "simple-ok" : "simple-note"}>
              {result.emailed ? "האימייל נשלח בהצלחה." : "האימייל לא נשלח — אפשר לשתף את הלינק האישי ישירות."}
            </p>
            <label>
              לינק אישי מאובטח
              <input readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <label>
              הודעת WhatsApp
              <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <div className="simple-actions-row">
              <button
                type="button"
                className="primary-button"
                onClick={async () => { await copyToClipboard(result.link); setCopied("link"); }}
              >
                {copied === "link" ? "הלינק הועתק" : "העתק לינק"}
              </button>
              <button
                type="button"
                onClick={async () => { await copyToClipboard(message); setCopied("msg"); }}
              >
                {copied === "msg" ? "ההודעה הועתקה" : "העתק הודעת WhatsApp"}
              </button>
              <a className="button-link" href={result.link} target="_blank" rel="noreferrer">פתח את הלינק</a>
              {phone ? <a className="button-link" href={waHref} target="_blank" rel="noreferrer">שלח ב‑WhatsApp</a> : null}
              <button type="button" onClick={reset}>הזמן אדם נוסף</button>
              {onOpenRecord ? (
                <button
                  type="button"
                  onClick={() => { onOpenRecord({ clientId: result.clientId, supplierId: result.supplierId }); onClose(); }}
                >
                  פתח את הכרטיס שלו
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <form className="simple-drawer-body" onSubmit={submit}>
            {isClient ? (
              <label>
                שם החברה או העסק
                <input value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="אלפא בע״מ" />
              </label>
            ) : null}
            <label>
              {isClient ? "שם איש קשר" : "שם הספק"}
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} required placeholder="דנה כהן" />
            </label>
            <label>
              אימייל
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="dana@example.com" dir="ltr" />
            </label>
            <label>
              טלפון – לא חובה
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+972…" dir="ltr" />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="simple-actions-row">
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? "שולח…" : "שלח הזמנה"}
              </button>
              <button type="button" onClick={onClose}>ביטול</button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}