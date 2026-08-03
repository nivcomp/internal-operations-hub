import { useCallback, useEffect, useState } from "react";
import { copyToClipboard } from "../../services/accessApi";
import {
  listRegistrations,
  markRegistrationsSeen,
  reviewRegistration,
  type PublicRegistration,
} from "../../services/registrationApi";

const statusLabels: Record<PublicRegistration["status"], string> = {
  awaiting_confirmation: "Waiting for email confirmation",
  confirmed: "Email confirmed",
  converted: "Account created",
  rejected: "Rejected",
  blocked: "Blocked",
};

/** New people who registered themselves through a public link. */
export function RegistrationsPanel({ onReviewed }: { onReviewed?: () => void }) {
  const [registrations, setRegistrations] = useState<PublicRegistration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    try { setRegistrations(await listRegistrations()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load registrations."); }
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
      try { await markRegistrationsSeen(); } catch { /* informational only */ }
    })();
  }, [reload]);

  async function review(registration: PublicRegistration, decision: "approve" | "reject" | "block") {
    setBusy(registration.id);
    setError(null);
    setLink(null);
    setCopied(false);
    try {
      const result = await reviewRegistration({ registrationId: registration.id, decision });
      if (decision === "approve" && result?.link) setLink(result.link);
      await reload();
      onReviewed?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this registration.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <h2>Self-registrations</h2>
      <p className="form-note">
        People who used a public link. They stay isolated from project data until you approve them.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      {link ? (
        <div className="table-actions">
          <button type="button" onClick={async () => { await copyToClipboard(link); setCopied(true); }}>
            {copied ? "Sign-in link copied" : "Copy sign-in link"}
          </button>
        </div>
      ) : null}

      {registrations.length === 0 ? (
        <p className="form-note">No public registrations yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Contact</th><th>Role</th><th>Email</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {registrations.slice(0, 25).map((registration) => (
              <tr key={registration.id}>
                <td>
                  {registration.contact_name}
                  {registration.company ? ` — ${registration.company}` : ""}
                  {registration.message ? <div className="form-note">{registration.message}</div> : null}
                </td>
                <td>{registration.role === "client" ? "Client" : "Supplier"}</td>
                <td>{registration.email}</td>
                <td>{statusLabels[registration.status]}</td>
                <td>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busy === registration.id || registration.status === "blocked"}
                      onClick={() => void review(registration, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy === registration.id}
                      onClick={() => void review(registration, "reject")}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={busy === registration.id}
                      onClick={() => void review(registration, "block")}
                    >
                      Block
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}