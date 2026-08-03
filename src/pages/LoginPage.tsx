import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

const HE = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("he");
const T = HE
  ? {
      dir: "rtl" as const,
      signIn: "התחברות", resetTitle: "איפוס סיסמה",
      signInNote: "הגישה פתוחה לחשבונות סוכנות, לקוחות וספקים.",
      resetNote: "הזינו אימייל ונשלח קישור לאיפוס.",
      email: "אימייל", password: "סיסמה",
      working: "רגע…", sendReset: "שליחת קישור איפוס",
      forgot: "שכחת סיסמה?", back: "חזרה להתחברות",
      sent: "אם קיים חשבון עם האימייל הזה, נשלח אליו קישור לאיפוס.",
      failed: "משהו השתבש.",
    }
  : {
      dir: "ltr" as const,
      signIn: "Sign in", resetTitle: "Reset your password",
      signInNote: "Access is limited to agency, client and supplier accounts.",
      resetNote: "Enter your email and we will send a reset link.",
      email: "Email", password: "Password",
      working: "Working…", sendReset: "Send reset link",
      forgot: "Forgot your password?", back: "Back to sign in",
      sent: "If that email has an account, a reset link is on its way.",
      failed: "Something went wrong.",
    };

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
        setNotice(T.sent);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : T.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen" dir={T.dir}>
      <div className="card auth-card">
        <div className="brand" style={{ marginBottom: "1.25rem" }}>
          <div className="brand-mark">CS</div>
          <div>
            <strong>Client-to-Scope AI</strong>
            <span>Internal operations hub</span>
          </div>
        </div>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.35rem" }}>
          {mode === "login" ? T.signIn : T.resetTitle}
        </h1>
        <p style={{ margin: "0 0 1.25rem", color: "var(--text-muted, #64748b)", fontSize: "0.9rem" }}>
          {mode === "login"
            ? T.signInNote
            : T.resetNote}
        </p>
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            <span>{T.email}</span>
            <input type="email" dir="ltr" value={email} required autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode === "login" ? (
            <label>
              <span>{T.password}</span>
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
            {busy ? T.working : mode === "login" ? T.signIn : T.sendReset}
          </button>
        </form>
        <button
          type="button"
          className="link-button"
          onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setError(null); setNotice(null); }}
        >
          {mode === "login" ? T.forgot : T.back}
        </button>
      </div>
    </div>
  );
}
