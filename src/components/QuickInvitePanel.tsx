import { useEffect, useState, type FormEvent } from "react";
import { copyToClipboard } from "../services/accessApi";
import {
  listInvitations,
  quickInviteClient,
  quickInviteSupplier,
  type InvitationRecord,
} from "../services/invitationsApi";

/**
 * AI-first invitations. Yaniv enters the minimum only; the AI assistant
 * collects everything else during the invited person's onboarding conversation.
 */
export function QuickInvitePanel({ onInvited }: { onInvited?: () => void }) {
  const [mode, setMode] = useState<"client" | "supplier">("client");
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);

  async function reloadInvitations() {
    try {
      setInvitations(await listInvitations());
    } catch {
      /* listing is informational only */
    }
  }

  useEffect(() => { void reloadInvitations(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setLink(null);
    setCopied(false);
    try {
      const result = mode === "client"
        ? await quickInviteClient({ company, contactName, email, phone })
        : await quickInviteSupplier({ contactName, email, phone });
      setLink(result.link);
      setNotice(
        result.emailed
          ? "Invitation email sent. You can also copy the link below."
          : "This person already had an account — the sign-in link below still works.",
      );
      setCompany(""); setContactName(""); setEmail(""); setPhone("");
      await reloadInvitations();
      onInvited?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send this invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>AI-first invitation</h2>
      <p className="form-note">
        Enter the minimum. The AI assistant collects the brief, requirements, dates and preferences in conversation.
      </p>

      <div className="table-actions" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className={mode === "client" ? "primary-button" : ""} onClick={() => setMode("client")}>
          Invite a client
        </button>
        <button type="button" className={mode === "supplier" ? "primary-button" : ""} onClick={() => setMode("supplier")}>
          Invite a supplier
        </button>
      </div>

      <form className="form-grid" onSubmit={submit}>
        {mode === "client" ? (
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
          Phone (optional)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44…" />
        </label>
        <div className="table-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-note">{notice}</p> : null}
      {link ? (
        <div className="table-actions">
          <button
            type="button"
            onClick={async () => { await copyToClipboard(link); setCopied(true); }}
          >
            {copied ? "Link copied" : "Copy invitation link"}
          </button>
        </div>
      ) : null}

      {invitations.length ? (
        <table>
          <thead>
            <tr><th>Contact</th><th>Role</th><th>Email</th><th>Status</th></tr>
          </thead>
          <tbody>
            {invitations.slice(0, 8).map((invitation) => (
              <tr key={invitation.id}>
                <td>{invitation.contact_name}{invitation.company ? ` — ${invitation.company}` : ""}</td>
                <td>{invitation.role === "client" ? "Client" : "Supplier"}</td>
                <td>{invitation.email}</td>
                <td>{invitation.emailed ? "Email sent" : "Link only"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}