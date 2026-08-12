import { useEffect, useState } from "react";
import { copyToClipboard } from "../../services/accessApi";
import {
  loadRegistrationSettings,
  publicRegistrationLink,
  saveRegistrationSettings,
  type RegistrationSettings,
} from "../../services/registrationApi";

/** Agency-only control for the public /join links. Off by default. */
export function PublicLinkSettings() {
  const [settings, setSettings] = useState<RegistrationSettings[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try { setSettings(await loadRegistrationSettings()); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load link settings."); }
    })();
  }, []);

  async function update(
    role: "client" | "supplier",
    patch: Omit<Parameters<typeof saveRegistrationSettings>[0], "role">,
  ) {
    setBusy(role);
    setError(null);
    try {
      const next = await saveRegistrationSettings({ ...patch, role });
      setSettings((prev) => prev.map((item) => (item.role === role ? next : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this link.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <h2>Public registration links</h2>
      <p className="form-note">
        Optional open links anyone can use to register. Personal invitations stay the default —
        these links are off until you turn them on, and every submission still needs email confirmation and your review.
      </p>
      <p className="form-note public-link-guidance">
        The client registration link is only for a brand-new client with no existing project. If a project was already
        started in a meeting, create “Continue project” from that project’s meeting room so the client keeps the existing
        conversation, brief and MVP.
      </p>
      {error ? <p className="form-error">{error}</p> : null}

      {settings.map((item) => {
        const link = publicRegistrationLink(item);
        return (
          <div key={item.role} className="public-link-row">
            <div className="public-link-head">
              <strong>{item.role === "client" ? "Client registration" : "Supplier registration"}</strong>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={busy === item.role}
                  onChange={(event) => void update(item.role, { enabled: event.target.checked })}
                />
                {item.enabled ? "Open" : "Closed"}
              </label>
            </div>

            <p className="form-note">
              {item.role === "client" ? "Starts a completely new project brief." : "Starts a new supplier profile."}
            </p>

            {item.enabled ? (
              <>
                <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
                <div className="table-actions">
                  <button type="button" onClick={async () => { await copyToClipboard(link); setCopied(item.role); }}>
                    {copied === item.role ? "Link copied" : "Copy link"}
                  </button>
                  <button type="button" disabled={busy === item.role} onClick={() => void update(item.role, { rotateCode: true })}>
                    Replace link
                  </button>
                  <label className="inline-number">
                    Daily limit
                    <input
                      type="number" min={1} max={500} defaultValue={item.daily_limit}
                      onBlur={(event) => void update(item.role, { dailyLimit: Number(event.target.value) })}
                    />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
