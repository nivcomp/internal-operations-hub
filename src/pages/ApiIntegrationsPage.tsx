import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import {
  API_SCOPES, createApiCredential, loadApiContractSummary, loadApiCredentials, revokeApiCredential,
  type ApiContractSummary, type ApiCredential, type ApiScope,
} from "../services/apiIntegrationsApi";

const scopeCopy: Record<ApiScope, { label: string; detail: string; risk?: boolean }> = {
  "schema.read": { label: "מבנה המערכת", detail: "רשימת טבלאות, שדות וקשרים" },
  "data.read": { label: "קריאת נתונים", detail: "קריאה מהטבלאות המורשות" },
  "data.write": { label: "יצירה ועריכה", detail: "הוספה ועדכון לפי חוקי המערכת" },
  "data.delete": { label: "מחיקה מבוקרת", detail: "מחיקה עם סיבה, ETag ואישור מפורש", risk: true },
  "actions.execute": { label: "פעולות עסקיות", detail: "תהליכים מוגנים כמו פרויקט, MVP והצעה" },
  "audit.read": { label: "יומן פעילות", detail: "קריאת היסטוריית פעולות המפתח" },
};

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function ApiIntegrationsPage() {
  const [summary, setSummary] = useState<ApiContractSummary | null>(null);
  const [keys, setKeys] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("AI Connector");
  const [expiry, setExpiry] = useState("90");
  const [scopes, setScopes] = useState<ApiScope[]>(["schema.read", "data.read", "data.write", "actions.execute", "audit.read"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contract, credentials] = await Promise.all([loadApiContractSummary(), loadApiCredentials()]);
      setSummary(contract);
      setKeys(credentials);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את הגדרות ה־API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeKeys = useMemo(() => keys.filter((key) => !key.revoked_at), [keys]);

  function toggleScope(scope: ApiScope) {
    if (scope === "schema.read" || scope === "data.read") return;
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  async function createKey() {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null); setNewSecret(null); setCopied(false);
    try {
      const expiresAt = expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
      const result = await createApiCredential({ name: name.trim(), scopes, expiresAt });
      setNewSecret(result.secret);
      setNotice("המפתח נוצר. העתיקו ושמרו אותו עכשיו — הוא לא יוצג שוב לאחר יציאה מהמסך.");
      setKeys((current) => [result.key, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו ליצור מפתח.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
  }

  async function revoke(key: ApiCredential) {
    if (!window.confirm(`לבטל את המפתח “${key.name}”? כל חיבור שמשתמש בו יפסיק לעבוד מיד.`)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await revokeApiCredential(key.id);
      setKeys((current) => current.map((item) => item.id === key.id ? { ...item, revoked_at: new Date().toISOString() } : item));
      setNotice("המפתח בוטל.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לבטל את המפתח.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="api-integrations-page">
      <PageHeader
        title="API ואינטגרציות"
        subtitle="מפתחות חיבור, מסמכי המערכת וכל מה שמנוע AI צריך כדי לפעול בצורה מבוקרת."
      />

      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <div className="form-success">{notice}</div> : null}
      {loading ? <p className="muted-text">טוען את שירות ה־API…</p> : null}

      {summary ? (
        <section className="stats-grid api-contract-stats">
          <article className="stat-card"><span className="section-eyebrow">טבלאות</span><strong className="stat-value">{summary.tableCount}</strong></article>
          <article className="stat-card"><span className="section-eyebrow">פונקציות מסד</span><strong className="stat-value">{summary.functionCount}</strong></article>
          <article className="stat-card"><span className="section-eyebrow">שירותים</span><strong className="stat-value">{summary.serviceCount}</strong></article>
          <article className="stat-card"><span className="section-eyebrow">מפתחות פעילים</span><strong className="stat-value">{activeKeys.length}</strong></article>
        </section>
      ) : null}

      {newSecret ? (
        <section className="card api-secret-card" aria-live="polite">
          <div>
            <p className="eyebrow">המפתח החדש — מוצג פעם אחת בלבד</p>
            <h2>העתיקו אותו עכשיו</h2>
            <p>המערכת שומרת רק hash מאובטח. אחרי רענון לא ניתן יהיה להציג שוב את המפתח המלא, רק לבטל וליצור חדש.</p>
          </div>
          <code className="api-secret-value" dir="ltr">{newSecret}</code>
          <button type="button" className="primary-button" onClick={() => void copySecret()}>{copied ? "הועתק" : "העתקת המפתח"}</button>
        </section>
      ) : null}

      <div className="api-two-column">
        <section className="card">
          <p className="eyebrow">מפתח חדש</p>
          <h2>חיבור מנוע AI או מערכת חיצונית</h2>
          <label>שם החיבור<input value={name} onChange={(event) => setName(event.target.value)} placeholder="לדוגמה: ChatGPT Skill" /></label>
          <label>תוקף
            <select value={expiry} onChange={(event) => setExpiry(event.target.value)}>
              <option value="30">30 יום</option><option value="90">90 יום</option><option value="365">שנה</option><option value="never">ללא תאריך סיום</option>
            </select>
          </label>
          <div className="api-scope-list">
            {API_SCOPES.map((scope) => {
              const fixed = scope === "schema.read" || scope === "data.read";
              return (
                <label key={scope} className={scopeCopy[scope].risk ? "api-scope-risk" : ""}>
                  <input type="checkbox" checked={scopes.includes(scope)} disabled={fixed} onChange={() => toggleScope(scope)} />
                  <span><strong>{scopeCopy[scope].label}</strong><small>{scopeCopy[scope].detail}</small></span>
                </label>
              );
            })}
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setScopes([...API_SCOPES])}>בחירת גישה מלאה</button>
            <button type="button" className="primary-button" disabled={busy || name.trim().length < 2} onClick={() => void createKey()}>{busy ? "יוצר…" : "יצירת מפתח"}</button>
          </div>
        </section>

        <section className="card">
          <p className="eyebrow">חיבור מהיר</p>
          <h2>פרטי השירות</h2>
          {summary ? (
            <>
              <label>API Base URL<code className="api-url" dir="ltr">{summary.baseUrl}</code></label>
              <p>בכל בקשה שולחים את המפתח בכותרת:</p>
              <code className="api-url" dir="ltr">X-API-Key: cts_live_…</code>
              <div className="api-doc-actions">
                <a className="primary-button" href={summary.docsUrl} target="_blank" rel="noreferrer">פתיחת המסמכים</a>
                <a href={summary.openApiUrl} target="_blank" rel="noreferrer">OpenAPI JSON</a>
                <a href={summary.skillPackageUrl} target="_blank" rel="noreferrer">חבילת AI Skill</a>
              </div>
              <p className="muted-text small">פעולות עסקיות מוגנות דורשות בנוסף session פעיל של מנהל, כדי שמנוע AI לא יאשר מחיר, תשלום או MVP לבדו.</p>
            </>
          ) : null}
        </section>
      </div>

      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">מפתחות</p><h2>חיבורים קיימים</h2></div><button type="button" onClick={() => void load()} disabled={loading}>רענון</button></div>
        {keys.length === 0 && !loading ? <p className="muted-text">עדיין לא נוצר מפתח API.</p> : null}
        {keys.length ? (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>שם</th><th>מזהה מוצג</th><th>הרשאות</th><th>נוצר</th><th>שימוש אחרון</th><th>סטטוס</th><th /></tr></thead><tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td><strong>{key.name}</strong></td><td><code dir="ltr">{key.key_prefix}…</code></td>
                <td><div className="api-scope-chips">{key.scopes.map((scope) => <span key={scope}>{scopeCopy[scope]?.label ?? scope}</span>)}</div></td>
                <td>{dateLabel(key.created_at)}</td><td>{dateLabel(key.last_used_at)}</td>
                <td><StatusBadge label={key.revoked_at ? "מבוטל" : key.expires_at && new Date(key.expires_at) < new Date() ? "פג תוקף" : "פעיל"} tone={key.revoked_at ? "danger" : "success"} /></td>
                <td>{!key.revoked_at ? <button type="button" className="danger-button" disabled={busy} onClick={() => void revoke(key)}>ביטול</button> : null}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : null}
      </section>

      {summary ? (
        <section className="card api-docs-embedded">
          <div className="section-heading"><div><p className="eyebrow">מסמכים חיים</p><h2>מדריך החיבור בתוך המערכת</h2></div><a href={summary.docsUrl} target="_blank" rel="noreferrer">פתיחה בחלון מלא</a></div>
          <iframe title="מסמכי API" src={summary.docsUrl} />
        </section>
      ) : null}
    </div>
  );
}
