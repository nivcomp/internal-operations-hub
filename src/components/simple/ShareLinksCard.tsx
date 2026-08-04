import { useCallback, useEffect, useState } from "react";
import { copyToClipboard } from "../../services/accessApi";
import {
  listRegistrations, loadRegistrationSettings, publicRegistrationLink, saveRegistrationSettings,
  type PublicRegistration, type RegistrationSettings,
} from "../../services/registrationApi";
import {
  listInvitations, quickInviteClient, quickInviteSupplier, type InvitationRecord,
} from "../../services/invitationsApi";
import { timeAgoHe } from "../../lib/simpleHebrew";

const roleLabel = { client: "לקוח", supplier: "ספק" } as const;

/** "לינקים לשיתוף" – public registration links plus the latest personal invitations. */
export function ShareLinksCard({ refreshToken = 0 }: { refreshToken?: number }) {
  const [settings, setSettings] = useState<RegistrationSettings[]>([]);
  const [registrations, setRegistrations] = useState<PublicRegistration[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, r, i] = await Promise.all([
        loadRegistrationSettings(), listRegistrations(), listInvitations(),
      ]);
      setSettings(s); setRegistrations(r); setInvitations(i);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את הלינקים.");
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  async function toggle(role: "client" | "supplier", enabled: boolean) {
    setBusy(`toggle-${role}`);
    try {
      const updated = await saveRegistrationSettings({ role, enabled });
      setSettings((current) => current.map((item) => (item.role === role ? updated : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "העדכון נכשל.");
    } finally { setBusy(null); }
  }

  async function resend(invitation: InvitationRecord) {
    setBusy(`resend-${invitation.id}`);
    try {
      const result = invitation.role === "client"
        ? await quickInviteClient({
            company: invitation.company, contactName: invitation.contact_name,
            email: invitation.email, phone: invitation.phone,
          })
        : await quickInviteSupplier({
            contactName: invitation.contact_name, email: invitation.email, phone: invitation.phone,
          });
      if (result.link) await copyToClipboard(result.link);
      setCopied(`resend-${invitation.id}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "השליחה החוזרת נכשלה.");
    } finally { setBusy(null); }
  }

  const lastInvitation = (role: "client" | "supplier") =>
    invitations.filter((item) => item.role === role)[0];

  return (
    <section className="card simple-card">
      <h2>לינקים לשיתוף</h2>
      {error ? <p className="form-error">{error}</p> : null}
      {settings.length === 0 && !error ? <p className="simple-note">טוען…</p> : null}

      {settings.map((item) => {
        const link = publicRegistrationLink(item);
        const pending = registrations.filter(
          (r) => r.role === item.role && (r.status === "awaiting_confirmation" || r.status === "confirmed"),
        ).length;
        const invitation = lastInvitation(item.role);
        return (
          <div key={item.role} className="simple-link-row">
            <div className="simple-link-head">
              <strong>לינק הרשמת {roleLabel[item.role]}</strong>
              <span className={item.enabled ? "simple-pill on" : "simple-pill off"}>
                {item.enabled ? "פעיל" : "כבוי"}
              </span>
              <span className="simple-note">{pending} הרשמות ממתינות</span>
            </div>
            <input readOnly value={link} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
            <div className="simple-actions-row">
              <button
                type="button"
                onClick={async () => { await copyToClipboard(link); setCopied(item.role); }}
              >
                {copied === item.role ? "הועתק" : "העתק"}
              </button>
              <a className="button-link" href={link} target="_blank" rel="noreferrer">פתח</a>
              <button type="button" disabled={busy === `toggle-${item.role}`} onClick={() => void toggle(item.role, !item.enabled)}>
                {item.enabled ? "כבה לינק" : "הפעל לינק"}
              </button>
            </div>
            {invitation ? (
              <div className="simple-subrow">
                <span>
                  הזמנה אחרונה: {invitation.contact_name}
                  {invitation.company ? ` (${invitation.company})` : ""} · {timeAgoHe(invitation.created_at)}
                </span>
                <div className="simple-actions-row">
                  <button
                    type="button"
                    onClick={async () => { await copyToClipboard(invitation.invite_link); setCopied(`inv-${invitation.id}`); }}
                  >
                    {copied === `inv-${invitation.id}` ? "הועתק" : "העתק לינק אישי"}
                  </button>
                  <button type="button" disabled={busy === `resend-${invitation.id}`} onClick={() => void resend(invitation)}>
                    {copied === `resend-${invitation.id}` ? "נשלח והועתק" : "שלח שוב הזמנה"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="simple-note">עדיין לא נשלחה הזמנה אישית ל{roleLabel[item.role]}.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}