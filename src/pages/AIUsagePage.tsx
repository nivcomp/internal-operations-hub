import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import {
  acknowledgeAlert,
  fetchUsageAlerts,
  fetchUsageEvents,
  fetchUsageLimits,
  updateUsageLimit,
  type UsageAlert,
  type UsageEvent,
  type UsageLimit,
} from "../services/aiUsageApi";

const NUMERIC_FIELDS: { key: keyof UsageLimit; label: string; help: string }[] = [
  { key: "daily_message_limit", label: "Messages / day", help: "Maximum AI messages a user may send each day." },
  { key: "monthly_message_limit", label: "Messages / month", help: "Maximum AI messages a user may send each month." },
  { key: "daily_token_limit", label: "Tokens / day", help: "Daily token ceiling for this scope." },
  { key: "monthly_token_limit", label: "Tokens / month", help: "Monthly token ceiling for this scope." },
  { key: "maximum_message_length", label: "Max message length", help: "Characters accepted in a single message." },
  { key: "maximum_context_size", label: "Max context size", help: "Characters of project context sent to the model." },
  { key: "maximum_output_tokens", label: "Max output tokens", help: "Upper bound on a single AI answer." },
  { key: "cooldown_seconds", label: "Cooldown (seconds)", help: "Minimum gap between two messages from the same user." },
  { key: "warning_threshold_percent", label: "Warning at %", help: "Raise a warning alert at this share of a limit." },
  { key: "hard_stop_threshold_percent", label: "Hard stop at %", help: "Block further requests at this share of a limit." },
];

const severityTone: Record<string, string> = { critical: "danger", warning: "warning", info: "info" };

function startOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function AIUsagePage() {
  const { profile } = useAuth();
  const { clients, suppliers, projects } = useAppData();

  const [limits, setLimits] = useState<UsageLimit[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Partial<UsageLimit>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, e, a] = await Promise.all([fetchUsageLimits(), fetchUsageEvents(30), fetchUsageAlerts()]);
      setLimits(l);
      setEvents(e);
      setAlerts(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load AI usage data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const dayStart = startOfDay();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const today = events.filter((e) => new Date(e.created_at).getTime() >= dayStart);
    const month = events.filter((e) => new Date(e.created_at).getTime() >= monthStart);
    const sum = (rows: UsageEvent[], key: "total_tokens" | "estimated_cost") =>
      rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
    return {
      todayMessages: today.length,
      monthMessages: month.length,
      todayTokens: sum(today, "total_tokens"),
      monthTokens: sum(month, "total_tokens"),
      monthCost: sum(month, "estimated_cost"),
      rejected: month.filter((e) => e.outcome !== "success").length,
      unrelated: month.filter((e) => e.classification === "unrelated" || e.classification === "abusive").length,
    };
  }, [events]);

  const perUser = useMemo(() => {
    const map = new Map<string, { role: string; messages: number; tokens: number; cost: number; rejected: number }>();
    for (const event of events) {
      const key = event.profile_id ?? "unknown";
      const entry = map.get(key) ?? { role: event.actor_role, messages: 0, tokens: 0, cost: 0, rejected: 0 };
      entry.messages += 1;
      entry.tokens += Number(event.total_tokens ?? 0);
      entry.cost += Number(event.estimated_cost ?? 0);
      if (event.outcome !== "success") entry.rejected += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].tokens - a[1].tokens).slice(0, 12);
  }, [events]);

  const perProject = useMemo(() => {
    const map = new Map<string, { messages: number; tokens: number; cost: number }>();
    for (const event of events) {
      if (!event.project_id) continue;
      const entry = map.get(event.project_id) ?? { messages: 0, tokens: 0, cost: 0 };
      entry.messages += 1;
      entry.tokens += Number(event.total_tokens ?? 0);
      entry.cost += Number(event.estimated_cost ?? 0);
      map.set(event.project_id, entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].tokens - a[1].tokens).slice(0, 10);
  }, [events]);

  function scopeLabel(limit: UsageLimit) {
    if (limit.scope_type === "global") return "All users (default)";
    if (limit.scope_type === "role") return `Role: ${String(limit.scope_id).replace(/_/g, " ")}`;
    if (limit.scope_type === "project") {
      return `Project: ${projects.find((p) => p.id === limit.scope_id)?.name ?? limit.scope_id}`;
    }
    return `User: ${limit.scope_id}`;
  }

  async function run(key: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete that action.");
    } finally {
      setBusy(null);
    }
  }

  async function saveLimit(limit: UsageLimit) {
    const patch = draft[limit.id];
    if (!patch || Object.keys(patch).length === 0) return;
    await run(`limit:${limit.id}`, async () => {
      const updated = await updateUsageLimit(limit.id, patch);
      setLimits((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setDraft((prev) => ({ ...prev, [limit.id]: {} }));
      setNotice(`Limits updated for ${scopeLabel(limit)}.`);
    });
  }

  async function togglePause(limit: UsageLimit) {
    await run(`pause:${limit.id}`, async () => {
      const updated = await updateUsageLimit(limit.id, {
        is_paused: !limit.is_paused,
        paused_reason: limit.is_paused ? "" : "Paused manually by the agency admin.",
        paused_until: null,
      });
      setLimits((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setNotice(updated.is_paused ? "AI access paused for this scope." : "AI access resumed for this scope.");
    });
  }

  async function ack(alert: UsageAlert) {
    if (!profile) return;
    await run(`ack:${alert.id}`, async () => {
      await acknowledgeAlert(alert.id, profile.id);
      setAlerts((prev) => prev.map((row) => (row.id === alert.id ? { ...row, acknowledged: true } : row)));
    });
  }

  const openAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <>
      <PageHeader
        title="AI usage and alerts"
        subtitle="Cost, token consumption, abuse alerts and the limits that protect the account."
        actions={<button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>Refresh</button>}
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}
      {loading ? <p className="muted">Loading AI usage…</p> : null}

      <section className="kpi-grid">
        <article className="kpi"><span className="kpi-label">Messages today</span><strong className="kpi-value">{summary.todayMessages}</strong></article>
        <article className="kpi"><span className="kpi-label">Messages this month</span><strong className="kpi-value">{summary.monthMessages}</strong></article>
        <article className="kpi"><span className="kpi-label">Tokens today</span><strong className="kpi-value">{summary.todayTokens.toLocaleString()}</strong></article>
        <article className="kpi"><span className="kpi-label">Tokens this month</span><strong className="kpi-value">{summary.monthTokens.toLocaleString()}</strong></article>
        <article className="kpi"><span className="kpi-label">Estimated cost (month)</span><strong className="kpi-value">${summary.monthCost.toFixed(2)}</strong></article>
        <article className="kpi"><span className="kpi-label">Blocked / off-topic</span><strong className="kpi-value">{summary.rejected} / {summary.unrelated}</strong></article>
      </section>

      <section className="card">
        <h3>Open alerts</h3>
        {openAlerts.length === 0 ? (
          <p className="muted">No open alerts. Threshold, burst and off-topic events will appear here.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Alert</th><th>Severity</th><th>Who</th><th>When</th><th></th></tr></thead>
            <tbody>
              {openAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td><strong>{alert.title}</strong><div className="muted small">{alert.detail}</div></td>
                  <td><StatusBadge status={alert.severity} tone={severityTone[alert.severity] ?? "info"} /></td>
                  <td className="small">
                    {alert.profile_id ?? "—"}
                    {alert.project_id ? <div className="muted">{projects.find((p) => p.id === alert.project_id)?.name ?? ""}</div> : null}
                  </td>
                  <td className="small">{new Date(alert.created_at).toLocaleString()}</td>
                  <td>
                    <button type="button" className="btn-ghost" onClick={() => void ack(alert)} disabled={busy === `ack:${alert.id}`}>
                      Acknowledge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Usage by user</h3>
        {perUser.length === 0 ? <p className="muted">No AI activity in the last 30 days.</p> : (
          <table className="data-table">
            <thead><tr><th>User</th><th>Role</th><th>Messages</th><th>Tokens</th><th>Cost</th><th>Blocked</th></tr></thead>
            <tbody>
              {perUser.map(([id, row]) => (
                <tr key={id}>
                  <td className="small">{id}</td>
                  <td>{row.role.replace(/_/g, " ")}</td>
                  <td>{row.messages}</td>
                  <td>{row.tokens.toLocaleString()}</td>
                  <td>${row.cost.toFixed(2)}</td>
                  <td>{row.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Usage by project</h3>
        {perProject.length === 0 ? <p className="muted">No project-linked AI activity yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Project</th><th>Messages</th><th>Tokens</th><th>Cost</th></tr></thead>
            <tbody>
              {perProject.map(([id, row]) => (
                <tr key={id}>
                  <td>{projects.find((p) => p.id === id)?.name ?? id}</td>
                  <td>{row.messages}</td>
                  <td>{row.tokens.toLocaleString()}</td>
                  <td>${row.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Limits</h3>
        <p className="muted small">
          A user is checked against the most specific limit that applies: their own profile, then their role, then the global default.
        </p>
        {limits.map((limit) => {
          const patch = draft[limit.id] ?? {};
          const dirty = Object.keys(patch).length > 0;
          return (
            <div key={limit.id} className="limit-block">
              <header className="limit-head">
                <div>
                  <strong>{scopeLabel(limit)}</strong>
                  {limit.is_paused ? <StatusBadge status="paused" tone="danger" /> : null}
                  {limit.paused_reason ? <div className="muted small">{limit.paused_reason}</div> : null}
                </div>
                <div className="flow-actions">
                  <button type="button" className="btn-ghost" onClick={() => void togglePause(limit)} disabled={busy === `pause:${limit.id}`}>
                    {limit.is_paused ? "Resume AI" : "Pause AI"}
                  </button>
                  <button type="button" className="btn-primary" onClick={() => void saveLimit(limit)} disabled={!dirty || busy === `limit:${limit.id}`}>
                    {busy === `limit:${limit.id}` ? "Saving…" : "Save"}
                  </button>
                </div>
              </header>
              <div className="limit-grid">
                {NUMERIC_FIELDS.map((field) => (
                  <label key={String(field.key)} title={field.help}>
                    <span className="muted small">{field.label}</span>
                    <input
                      type="number"
                      min={0}
                      value={String((patch[field.key] ?? limit[field.key]) ?? 0)}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          [limit.id]: { ...prev[limit.id], [field.key]: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h3>Recent AI requests</h3>
        {events.length === 0 ? <p className="muted">No requests recorded yet.</p> : (
          <table className="data-table">
            <thead><tr><th>When</th><th>Role</th><th>Agent</th><th>Classification</th><th>Outcome</th><th>Tokens</th><th>Cost</th></tr></thead>
            <tbody>
              {events.slice(0, 60).map((event) => (
                <tr key={event.id}>
                  <td className="small">{new Date(event.created_at).toLocaleString()}</td>
                  <td>{event.actor_role.replace(/_/g, " ")}</td>
                  <td>{event.agent_type.replace(/_/g, " ")}</td>
                  <td>{event.classification.replace(/_/g, " ")}</td>
                  <td>
                    {event.outcome === "success"
                      ? <StatusBadge status="success" tone="success" />
                      : <StatusBadge status={event.outcome.replace(/_/g, " ")} tone="warning" />}
                    {event.rejection_reason ? <div className="muted small">{event.rejection_reason}</div> : null}
                  </td>
                  <td>{Number(event.total_tokens ?? 0).toLocaleString()}</td>
                  <td>${Number(event.estimated_cost ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">
          {clients.length + suppliers.length} external accounts can reach the AI chat. Limits above apply to all of them.
        </p>
      </section>
    </>
  );
}
