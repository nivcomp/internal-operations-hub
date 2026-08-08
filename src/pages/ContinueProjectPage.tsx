import { useEffect, useMemo, useState, type FormEvent } from "react";
import { activateContinuation, continuationInfo, type ContinuationInfo } from "../services/publicRegistrationApi";

/**
 * Continuation screen for a link that belongs to one specific project.
 * The email is already known from the meeting, so the client only chooses a
 * password and lands directly inside that project.
 */
export function ContinueProjectPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("t") ?? "", []);
  const [info, setInfo] = useState<ContinuationInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await continuationInfo(token);
        if (!cancelled) setInfo(result);
      } catch {
        if (!cancelled) setInfo({ valid: false, reason: "invalid" });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("הסיסמה חייבת להכיל לפחות 8 תווים."); return; }
    if (password !== confirm) { setError("הסיסמאות אינן תואמות."); return; }
    setBusy(true);
    const result = await activateContinuation(token, password);
    setBusy(false);
    if (result.signedIn) { window.location.replace("/"); return; }
    if (result.accountExists) { setInfo((current) => current ? { ...current, accountExists: true } : current); return; }
    setError(result.error ?? "לא הצלחנו להשלים את הכניסה.");
  }

  const shell = (children: React.ReactNode) => (
    <div className="auth-screen" dir="rtl" lang="he">
      <div className="card auth-card">{children}</div>
    </div>
  );

  if (!info) return shell(<p>טוען את פרטי הפרויקט…</p>);

  if (!info.valid) {
    const message = info.reason === "used"
      ? "כבר נעשה שימוש בלינק הזה. אפשר להתחבר עם המייל והסיסמה שבחרתם."
      : info.reason === "expired"
        ? "תוקף הלינק פג. בקשו לינק חדש מהסוכנות."
        : "הלינק אינו תקין. בקשו לינק חדש מהסוכנות.";
    return shell(
      <>
        <h1 style={{ fontSize: "1.15rem" }}>הלינק אינו זמין</h1>
        <p className="form-note">{message}</p>
        <a className="primary-button" href="/">מסך הכניסה</a>
      </>,
    );
  }

  if (info.accountExists) {
    return shell(
      <>
        <h1 style={{ fontSize: "1.15rem" }}>כבר קיים חשבון עם המייל הזה</h1>
        <p className="form-note">התחברו עם הסיסמה הקיימת כדי להמשיך את הפרויקט {info.projectName}.</p>
        <div className="action-row">
          <a className="primary-button" href="/">התחברות</a>
          <a className="ghost-button" href="/reset-password">שכחתי סיסמה</a>
        </div>
      </>,
    );
  }

  return (
    <div className="auth-screen" dir="rtl" lang="he">
      <form className="card auth-card" onSubmit={submit}>
        <p className="eyebrow">{info.company || "המשך אפיון"}</p>
        <h1 style={{ fontSize: "1.25rem" }}>המשך האפיון של {info.projectName || "הפרויקט"}</h1>
        <p className="form-note">התחלנו את הפרויקט יחד בפגישה. בחרו סיסמה כדי להיכנס ולהמשיך לבד.</p>

        <div className="form-grid">
          <label>
            כתובת אימייל
            <input dir="ltr" value={info.email ?? ""} readOnly />
          </label>
          <label>
            סיסמה
            <input
              type={show ? "text" : "password"}
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            אימות סיסמה
            <input
              type={show ? "text" : "password"}
              dir="ltr"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button
            type="button"
            className="ghost-button"
            style={{ alignSelf: "flex-start", padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
            onClick={() => setShow((value) => !value)}
          >
            {show ? "הסתרה" : "הצגה"}
          </button>
          <p className="form-note">לפחות 8 תווים, מומלץ לשלב אותיות ומספרים.</p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "נכנסים לפרויקט…" : "כניסה והמשך אפיון"}
        </button>
      </form>
    </div>
  );
}