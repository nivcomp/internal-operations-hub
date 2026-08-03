import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  checkPublicLink,
  submitPublicRegistration,
  type RegistrationRole,
} from "../services/publicRegistrationApi";

/**
 * Public self-registration page (/join/client, /join/supplier).
 * Nothing operational is reachable from here: the form only creates an isolated
 * registration record and sends a confirmation email.
 */
export function JoinPage({ role }: { role: RegistrationRole }) {
  const isClient = role === "client";
  const code = useMemo(() => new URLSearchParams(window.location.search).get("c") ?? "", []);
  const openedAt = useRef(Date.now());

  const [state, setState] = useState<"checking" | "open" | "closed">("checking");
  const [introText, setIntroText] = useState("");
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await checkPublicLink(role, code);
        if (cancelled) return;
        setIntroText(result.introText ?? "");
        setState(result.open ? "open" : "closed");
      } catch {
        if (!cancelled) setState("closed");
      }
    })();
    return () => { cancelled = true; };
  }, [role, code]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitPublicRegistration({
        role, code, company, contactName, email, phone, message, website,
        elapsedMs: Date.now() - openedAt.current,
      });
      setDone(result.notice ?? "Thanks — check your inbox to confirm your email.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your registration.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="auth-screen">
        <div className="card auth-card"><p>Opening the registration form…</p></div>
      </div>
    );
  }

  if (state === "closed") {
    return (
      <div className="auth-screen">
        <div className="card auth-card">
          <h1 style={{ fontSize: "1.15rem" }}>This registration link is not available</h1>
          <p className="form-note">
            The link may have been turned off or replaced. Please ask for a new one.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-screen">
        <div className="card auth-card">
          <h1 style={{ fontSize: "1.15rem" }}>Almost there</h1>
          <p className="form-note">{done}</p>
          <p className="form-note">You can close this page — the confirmation link brings you straight back.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={submit}>
        <p className="eyebrow">{isClient ? "New client" : "New supplier"}</p>
        <h1 style={{ fontSize: "1.25rem" }}>
          {isClient ? "Tell us about your project" : "Join the supplier network"}
        </h1>
        <p className="form-note">
          {introText || (isClient
            ? "Share a few details and the AI project guide will take it from there."
            : "Share a few details and we will set up your supplier profile.")}
        </p>

        <div className="form-grid">
          {isClient ? (
            <label>
              Company
              <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={160} />
            </label>
          ) : null}
          <label>
            Your name
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} required maxLength={120} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
          </label>
          <label>
            Phone (optional)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </label>
          <label>
            {isClient ? "What do you need? (optional)" : "What kind of work do you do? (optional)"}
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} />
          </label>

          {/* Honeypot: hidden from people, tempting for bots. */}
          <label aria-hidden="true" tabIndex={-1} style={{ position: "absolute", left: "-9999px" }}>
            Website
            <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Sending…" : "Send my details"}
        </button>
        <p className="form-note">We only use your details to contact you about this work.</p>
      </form>
    </div>
  );
}