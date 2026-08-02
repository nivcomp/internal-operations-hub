import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const { updatePassword, session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.75rem" }}>Set a new password</h1>
        {!session ? (
          <p className="form-error">
            This reset link is missing or expired. Request a new one from the sign-in screen.
          </p>
        ) : done ? (
          <>
            <p className="form-success">Password updated.</p>
            <button type="button" onClick={onDone}>Continue to the app</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="stack-form">
            <label>
              <span>New password</span>
              <input type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label>
              <span>Confirm password</span>
              <input type="password" value={confirm} autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} required />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
          </form>
        )}
        {!done ? (
          <button type="button" className="link-button" onClick={onDone}>Back to sign in</button>
        ) : null}
      </div>
    </div>
  );
}
