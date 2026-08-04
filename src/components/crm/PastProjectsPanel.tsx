import { useEffect, useState } from "react";
import { fetchPastProjects } from "../../services/crmApi";
import type { PastProjectRecord } from "../../types/crm";

/** Imported history only — these records never affect live pricing or margin. */
export function PastProjectsPanel({ clientId }: { clientId: string }) {
  const [records, setRecords] = useState<PastProjectRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPastProjects(clientId)
      .then((rows) => { if (active) setRecords(rows); })
      .catch((loadError) => { if (active) setError((loadError as Error).message); });
    return () => { active = false; };
  }, [clientId]);

  if (error) return null;
  if (!records.length) return null;

  return (
    <section className="card">
      <h2>Past projects (imported history)</h2>
      <p className="hint">Reference only — not included in active pricing, margin or delivery calculations.</p>
      <table>
        <thead>
          <tr><th>Project</th><th>Status</th><th>Dates</th><th>Value</th><th>Outcome</th></tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.projectName}</td>
              <td>{record.status}</td>
              <td>{[record.startDate, record.endDate].filter(Boolean).join(" → ") || "—"}</td>
              <td>{record.value ? `${record.currency} ${record.value.toLocaleString()}` : "—"}</td>
              <td>{record.outcome || record.description.slice(0, 80) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
