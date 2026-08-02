import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { signIn, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await requestPasswordReset(email);
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="brand" style={{ marginBottom: "1.25rem" }}>
          <div className="brand-mark">CS</div>
          <div>
            <strong>Client-to-Scope AI</strong>
            <span>Internal operations hub</span>
          </div>
        </div>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.35rem" }}>
          {mode === "login" ? "Sign in" : "Reset your password"}
        </h1>
        <p style={{ margin: "0 0 1.25rem", color: "var(--text-muted, #64748b)", fontSize: "0.9rem" }}>
          {mode === "login"
            ? "Access is limited to agency, client and supplier accounts."
            : "Enter your email and we will send a reset link."}
        </p>
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            <span>Email</span>
            <input type="email" value={email} required autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode === "login" ? (
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                required
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-success">{notice}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Send reset link"}
          </button>
        </form>
        <button
          type="button"
          className="link-button"
          onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setError(null); setNotice(null); }}
        >
          {mode === "login" ? "Forgot your password?" : "Back to sign in"}
        </button>
      </div>
    </div>
  );
}
