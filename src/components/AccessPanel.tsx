import { useMemo, useState, type FormEvent } from "react";
import { StatusBadge } from "./StatusBadge";
import {
  accessStatusLabels,
  copyToClipboard,
  createAccessLink,
  formatDateTime,
  inviteAccessUser,
  setAccessActive,
  useAccessAccounts,
  type AccessAccount,
} from "../services/accessApi";

type AccessPanelProps = {
  kind: "client" | "supplier";
  targetId: string;
  /** Name/email suggested for the invitation form. */
  defaultEmail: string;
  defaultName: string;
  onOpenPortal: () => void;
};

function toneFor(account: AccessAccount) {
  if (!account.isActive) return "danger" as const;
  return account.invitationStatus === "active" ? ("success" as const) : ("warning" as const);
}

export function AccessPanel({ kind, targetId, defaultEmail, defaultName, onOpenPortal }: AccessPanelProps) {
  const { accounts, loading, error, reload } = useAccessAccounts();
  const [email, setEmail] = useState(defaultEmail);
  const [fullName, setFullName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const account = useMemo(
    () => accounts.find((item) => (kind === "client" ? item.clientId : item.supplierId) === targetId),
    [accounts, kind, targetId],
  );

  const label = kind === "client" ? "client" : "supplier";

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setNotice(null);
    setCopied(false);
    try {
      await task();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : `Could not update ${label} access.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await inviteAccessUser({
        email: email.trim(),
        fullName: fullName.trim() || email.trim(),
        role: kind,
        clientId: kind === "client" ? targetId : null,
        supplierId: kind === "supplier" ? targetId : null,
      });
      setLink(result.link);
      setNotice(
        result.link
          ? `Invitation created for ${email.trim()}. Copy the link below and send it however you prefer.`
          : `Invitation created for ${email.trim()}.`,
      );
      await reload();
    });
  }

  async function handleResend() {
    if (!account) return;
    await run(async () => {
      const fresh = await createAccessLink(account.id);
      setLink(fresh);
      setNotice("A fresh invitation link was generated.");
      await reload();
    });
  }

  async function handleToggleActive() {
    if (!account) return;
    await run(async () => {
      await setAccessActive(account.id, !account.isActive);
      setNotice(account.isActive ? "Portal access disabled." : "Portal access reactivated.");
      await reload();
    });
  }

  async function handleCopy() {
    if (!link) return;
    await copyToClipboard(link);
    setCopied(true);
  }

  return (
    <section className="card">
      <h2>Portal access</h2>

      {loading ? <p className="muted-text">Checking portal access…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && !error && !account ? (
        <div className="empty-state inline-empty-state">
          <h3>This {label} does not have portal access yet</h3>
          <p>Invite them to create an account. They stay linked to this {label} record automatically.</p>
          <form className="form-grid" onSubmit={handleInvite}>
            <label>
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Creating invitation…" : `Invite ${label}`}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {account ? (
        <>
          <dl className="meta-list">
            <div>
              <dt>Status</dt>
              <dd><StatusBadge label={accessStatusLabels[account.invitationStatus]} tone={toneFor(account)} /></dd>
            </div>
            <div><dt>Account email</dt><dd>{account.email}</dd></div>
            <div><dt>Invited</dt><dd>{formatDateTime(account.invitedAt)}</dd></div>
            <div><dt>Last sign-in</dt><dd>{formatDateTime(account.lastSignInAt)}</dd></div>
          </dl>
          <div className="action-row">
            <button type="button" onClick={() => void handleResend()} disabled={busy}>
              {busy ? "Working…" : "Resend / create invitation link"}
            </button>
            <button type="button" onClick={() => void handleToggleActive()} disabled={busy}>
              {account.isActive ? "Disable access" : "Reactivate access"}
            </button>
            <button type="button" onClick={onOpenPortal}>Open {label} portal preview</button>
          </div>
        </>
      ) : null}

      {link ? (
        <div className="invite-link-box">
          <p className="muted-text">Secure invitation link — expires per your auth settings and is tied to {account?.email ?? email}.</p>
          <code className="invite-link">{link}</code>
          <div className="action-row">
            <button className="primary-button" type="button" onClick={() => void handleCopy()}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : null}

      {formError ? <p className="form-error" role="alert">{formError}</p> : null}
      {notice && !formError ? <p className="form-success">{notice}</p> : null}
    </section>
  );
}