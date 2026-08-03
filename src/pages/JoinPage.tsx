import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  checkPublicLink,
  prepareRegistration,
  createAccount,
  claimAccount,
  resendVerification,
  type RegistrationRole,
} from "../services/publicRegistrationApi";
import { publicUrl } from "../config/publicUrl";

type Lang = "he" | "en";
type Phase = "form" | "creating" | "verify" | "exists" | "failed";

const COPY = {
  he: {
    dir: "rtl" as const,
    eyebrowClient: "לקוח חדש",
    eyebrowSupplier: "ספק חדש",
    titleClient: "ספרו לנו על הפרויקט שלכם",
    titleSupplier: "הצטרפות לרשת הספקים",
    subtitleClient: "ממלאים כמה פרטים בסיסיים, ועוזר ה־AI ימשיך אתכם לאפיון הפרויקט.",
    subtitleSupplier: "ממלאים כמה פרטים בסיסיים, ועוזר ה־AI ימשיך אתכם להשלמת הפרופיל.",
    company: "שם העסק או החברה",
    nameClient: "השם שלך",
    nameSupplier: "שם מלא",
    email: "כתובת אימייל",
    phone: "טלפון – לא חובה",
    password: "סיסמה",
    confirm: "אימות סיסמה",
    timezone: "אזור זמן",
    language: "שפה מועדפת",
    messageClient: "במה אתם צריכים עזרה? – לא חובה",
    messageSupplier: "באיזה סוג עבודה אתם עוסקים? – לא חובה",
    consent: "אני מאשר/ת את מדיניות הפרטיות ותנאי השימוש.",
    privacy: "הפרטים ישמשו לפתיחת סביבת הפרויקט וליצירת קשר בנוגע לפרויקט בלבד.",
    submitClient: "יצירת חשבון והתחלת אפיון",
    submitSupplier: "יצירת חשבון והשלמת פרופיל",
    show: "הצגה",
    hide: "הסתרה",
    pwRule: "לפחות 8 תווים, מומלץ לשלב אותיות ומספרים.",
    pwShort: "הסיסמה חייבת להכיל לפחות 8 תווים.",
    pwMismatch: "הסיסמאות אינן תואמות.",
    consentRequired: "יש לאשר את מדיניות הפרטיות.",
    creating: "יוצרים את החשבון ואת סביבת העבודה שלך…",
    verifyTitle: "אישור כתובת האימייל",
    verifyBody: "שלחנו לך מייל אישור. אחרי הלחיצה על הקישור תיכנס/י ישירות לסביבת העבודה.",
    resend: "שליחת אימות מחדש",
    resent: "המייל נשלח שוב.",
    existsTitle: "כבר קיים חשבון עם כתובת האימייל הזאת.",
    signIn: "התחברות",
    reset: "איפוס סיסמה",
    failedTitle: "לא הצלחנו להשלים את ההרשמה",
    retry: "ניסיון נוסף",
    contact: "יצירת קשר עם הסוכנות",
    closedTitle: "קישור ההרשמה אינו זמין",
    closedBody: "ייתכן שהקישור כובה או הוחלף. אנא בקשו קישור חדש.",
    loading: "טוען את טופס ההרשמה…",
  },
  en: {
    dir: "ltr" as const,
    eyebrowClient: "New client",
    eyebrowSupplier: "New supplier",
    titleClient: "Tell us about your project",
    titleSupplier: "Join the supplier network",
    subtitleClient: "Share a few details and the AI project guide will take it from there.",
    subtitleSupplier: "Share a few details and the AI assistant will help you complete your profile.",
    company: "Company or client name",
    nameClient: "Your name",
    nameSupplier: "Full name",
    email: "Email address",
    phone: "Phone (optional)",
    password: "Password",
    confirm: "Confirm password",
    timezone: "Timezone",
    language: "Preferred language",
    messageClient: "What do you need? (optional)",
    messageSupplier: "What kind of work do you do? (optional)",
    consent: "I accept the privacy policy and terms of use.",
    privacy: "Your details are only used to open your project workspace and contact you about this work.",
    submitClient: "Create account and start planning",
    submitSupplier: "Create account and complete profile",
    show: "Show",
    hide: "Hide",
    pwRule: "At least 8 characters; mixing letters and numbers is stronger.",
    pwShort: "Password must be at least 8 characters.",
    pwMismatch: "Passwords do not match.",
    consentRequired: "Please accept the privacy terms.",
    creating: "Creating your account and workspace…",
    verifyTitle: "Confirm your email",
    verifyBody: "We sent you a confirmation email. Clicking the link takes you straight into your workspace.",
    resend: "Resend verification email",
    resent: "Verification email sent again.",
    existsTitle: "This email already has an account.",
    signIn: "Sign in",
    reset: "Reset password",
    failedTitle: "We could not finish your registration",
    retry: "Retry",
    contact: "Contact agency",
    closedTitle: "This registration link is not available",
    closedBody: "The link may have been turned off or replaced. Please ask for a new one.",
    loading: "Opening the registration form…",
  },
};

function browserLanguage(): Lang {
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("he") ? "he" : "en";
}

function guessTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""; } catch { return ""; }
}

/**
 * Public self-registration page (/join/client, /join/supplier). The person
 * chooses their own password; Supabase Auth owns it end to end and the account
 * is provisioned server-side into an isolated client or supplier record.
 */
export function JoinPage({ role }: { role: RegistrationRole }) {
  const isClient = role === "client";
  const code = useMemo(() => new URLSearchParams(window.location.search).get("c") ?? "", []);
  const openedAt = useRef(Date.now());

  const [lang, setLang] = useState<Lang>(browserLanguage);
  const t = COPY[lang];

  const [state, setState] = useState<"checking" | "open" | "closed">("checking");
  const [introText, setIntroText] = useState("");
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [timezone, setTimezone] = useState(guessTimezone);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    if (phase === "creating") return;
    setError(null);
    setNotice(null);

    if (password.length < 8) { setError(t.pwShort); return; }
    if (password !== confirm) { setError(t.pwMismatch); return; }
    if (!consent) { setError(t.consentRequired); return; }

    setPhase("creating");
    try {
      const prepared = await prepareRegistration({
        role, code, company, contactName, email: email.trim().toLowerCase(), phone, message, website,
        language: lang, timezone, consent, elapsedMs: Date.now() - openedAt.current,
      });
      if (prepared.status === "email_exists") { setPhase("exists"); return; }

      const created = await createAccount({
        email: email.trim().toLowerCase(),
        password,
        fullName: contactName,
        language: lang,
        redirectTo: publicUrl("/"),
      });
      if (created.error) {
        if (/already/i.test(created.error)) { setPhase("exists"); return; }
        setError(created.error);
        setPhase("failed");
        return;
      }
      if (created.needsVerification) { setPhase("verify"); return; }

      await claimAccount(role);
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed.");
      setPhase("failed");
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="auth-screen" dir={t.dir} lang={lang}>
      <div className="card auth-card">{children}</div>
    </div>
  );

  const langSwitch = (
    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
      {(["he", "en"] as Lang[]).map((option) => (
        <button
          key={option}
          type="button"
          className={option === lang ? "primary-button" : "ghost-button"}
          style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
          onClick={() => setLang(option)}
        >
          {option === "he" ? "עברית" : "English"}
        </button>
      ))}
    </div>
  );

  if (state === "checking") return shell(<p>{t.loading}</p>);

  if (state === "closed") {
    return shell(
      <>
        <h1 style={{ fontSize: "1.15rem" }}>{t.closedTitle}</h1>
        <p className="form-note">{t.closedBody}</p>
      </>,
    );
  }

  if (phase === "creating") return shell(<p>{t.creating}</p>);

  if (phase === "verify") {
    return shell(
      <>
        <h1 style={{ fontSize: "1.15rem" }}>{t.verifyTitle}</h1>
        <p className="form-note">{t.verifyBody}</p>
        {notice ? <p className="form-note">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button
          type="button"
          className="primary-button"
          onClick={async () => {
            const failure = await resendVerification(email.trim().toLowerCase(), publicUrl("/"));
            if (failure) setError(failure); else setNotice(t.resent);
          }}
        >
          {t.resend}
        </button>
      </>,
    );
  }

  if (phase === "exists") {
    return shell(
      <>
        <h1 style={{ fontSize: "1.15rem" }}>{t.existsTitle}</h1>
        {notice ? <p className="form-note">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <a className="primary-button" href="/">{t.signIn}</a>
          <a className="ghost-button" href="/reset-password">{t.reset}</a>
          <button
            type="button"
            className="ghost-button"
            onClick={async () => {
              const failure = await resendVerification(email.trim().toLowerCase(), publicUrl("/"));
              if (failure) setError(failure); else setNotice(t.resent);
            }}
          >
            {t.resend}
          </button>
        </div>
      </>,
    );
  }

  if (phase === "failed") {
    return shell(
      <>
        <h1 style={{ fontSize: "1.15rem" }}>{t.failedTitle}</h1>
        <p className="form-error">{error}</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <button type="button" className="primary-button" onClick={() => setPhase("form")}>{t.retry}</button>
          <a className="ghost-button" href="/">{t.signIn}</a>
          <a className="ghost-button" href="mailto:hello@stat.ninja">{t.contact}</a>
        </div>
      </>,
    );
  }

  return (
    <div className="auth-screen" dir={t.dir} lang={lang}>
      <form className="card auth-card" onSubmit={submit}>
        {langSwitch}
        <p className="eyebrow">{isClient ? t.eyebrowClient : t.eyebrowSupplier}</p>
        <h1 style={{ fontSize: "1.25rem" }}>{isClient ? t.titleClient : t.titleSupplier}</h1>
        <p className="form-note">{introText || (isClient ? t.subtitleClient : t.subtitleSupplier)}</p>

        <div className="form-grid">
          {isClient ? (
            <label>
              {t.company}
              <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={160} />
            </label>
          ) : null}
          <label>
            {isClient ? t.nameClient : t.nameSupplier}
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} required maxLength={120} />
          </label>
          <label>
            {t.email}
            <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="email" />
          </label>
          <label>
            {t.phone}
            <input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" />
          </label>
          <label>
            {t.password}
            <input
              type={showPassword ? "text" : "password"}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            {t.confirm}
            <input
              type={showPassword ? "text" : "password"}
              dir="ltr"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button
            type="button"
            className="ghost-button"
            style={{ alignSelf: "flex-start", padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? t.hide : t.show}
          </button>
          <p className="form-note">{t.pwRule}</p>

          {!isClient ? (
            <label>
              {t.timezone}
              <input dir="ltr" value={timezone} onChange={(e) => setTimezone(e.target.value)} required maxLength={80} />
            </label>
          ) : null}

          <label>
            {isClient ? t.messageClient : t.messageSupplier}
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} />
          </label>

          <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexDirection: "row" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>{t.consent}</span>
          </label>

          {/* Honeypot: hidden from people, tempting for bots. */}
          <label aria-hidden="true" tabIndex={-1} style={{ position: "absolute", left: "-9999px" }}>
            Website
            <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="primary-button">
          {isClient ? t.submitClient : t.submitSupplier}
        </button>
        <p className="form-note">{t.privacy}</p>
      </form>
    </div>
  );
}
