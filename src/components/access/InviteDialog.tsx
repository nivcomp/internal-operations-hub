import { useState, type FormEvent } from "react";
import { copyToClipboard } from "../../services/accessApi";
import { quickInviteClient, quickInviteSupplier } from "../../services/invitationsApi";

type Props = {
  role: "client" | "supplier";
  onClose: () => void;
  onInvited?: () => void;
};

function whatsappText(role: "client" | "supplier", name: string, link: string) {
  const first = name.split(" ")[0] || "there";
  return role === "client"
    ? `Hi ${first}, here is your private link to start your project with us. It opens your own workspace where our AI guide collects everything we need:\n${link}`
    : `Hi ${first}, here is your private link to join our supplier network. It opens your profile setup — it only takes a few minutes:\n${link}`;
}

/** Fast, focused invitation flow: minimum fields, instant shareable link. */
export function InviteDialog({ role, onClose, onInvited }: Props) {
  const isClient = role === "client";
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; emailed: boolean; name: string; phone: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = isClient
        ? await quickInviteClient({ company, contactName, email, phone })
        : await quickInviteSupplier({ contactName, email, phone });
      if (!response.link) throw new Error("The invitation was created but no link could be generated.");
      setResult({ link: response.link, emailed: response.emailed, name: contactName, phone });
      setMessageDraft(whatsappText(role, contactName, response.link));
      onInvited?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send this invitation.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setCompany(""); setContactName(""); setEmail(""); setPhone("");
    setMessageDraft(""); setCopied(null); setError(null);
  }

  const waHref = result
    ? `https://wa.me/${result.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(messageDraft)}`
    : "";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>{isClient ? "Invite a client" : "Invite a supplier"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {result ? (
          <div className="invite-result">
            <p className="form-note">
              {result.emailed
                ? `Invitation email sent to ${email || result.name}. You can also share the link directly.`
                : "This person already had an account — the personal link below still works."}
            </p>

            <label>
              Personal invitation link
              <input readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} />
            </label>

            <label>
              Message to send
              <textarea rows={4} value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} />
            </label>

            <div className="table-actions">
              <button
                type="button"
                className="primary-button"
                onClick={async () => { await copyToClipboard(result.link); setCopied("link"); }}
              >
                {copied === "link" ? "Link copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={async () => { await copyToClipboard(messageDraft); setCopied("message"); }}
              >
                {copied === "message" ? "Message copied" : "Copy WhatsApp message"}
              </button>
              <a className="button-link" href={waHref} target="_blank" rel="noreferrer">Open WhatsApp</a>
              <button type="button" onClick={reset}>Invite another</button>
            </div>
          </div>
        ) : (
          <form className="form-grid" onSubmit={submit}>
            {isClient ? (
              <label>
                Company or client name
                <input value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="Acme Ltd" />
              </label>
            ) : null}
            <label>
              Contact name
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} required placeholder="Dana Cohen" />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="dana@acme.com" />
            </label>
            <label>
              Phone (optional, for WhatsApp)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+972…" />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="table-actions">
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? "Creating…" : "Create invitation"}
              </button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
            <p className="form-note">
              The AI assistant collects the brief, requirements and dates in conversation — you only need the basics here.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}