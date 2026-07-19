import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { MutationKeys, useAppData } from "../context/AppDataContext";
import { currency, getProjectName } from "../lib/domainHelpers";
import type { Client, ClientPayment, HourBank, Project } from "../types/domain";

type PaymentsHoursPageProps = {
  clients: Client[];
  projects: Project[];
  clientPayments: ClientPayment[];
  hourBanks: HourBank[];
  onPaymentReceived: (paymentId: string) => Promise<unknown>;
};

export function PaymentsHoursPage({ clients, projects, clientPayments, hourBanks, onPaymentReceived }: PaymentsHoursPageProps) {
  const { isPending } = useAppData();
  return (
    <>
      <PageHeader title="Payments / Hour Banks" subtitle="Manual payment and paid-hour tracking for the first internal MVP." />
      <section className="detail-grid">
        <article className="card">
          <h2>Client payments</h2>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Rule</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clientPayments.length === 0 ? (
                <tr><td colSpan={5}><p>No payment requests recorded yet.</p></td></tr>
              ) : clientPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{getProjectName(payment.projectId, projects)}</td>
                  <td>{currency.format(payment.amount)}</td>
                  <td><StatusBadge label={payment.status} tone={payment.status === "received" ? "success" : "warning"} /></td>
                  <td>{payment.status === "received" ? "Work can use this payment" : "Work remains gated"}</td>
                  <td>
                    {payment.status !== "received" ? (
                      <button
                        type="button"
                        disabled={isPending(MutationKeys.markPaymentReceived(payment.id))}
                        onClick={() => { void onPaymentReceived(payment.id).catch(() => {}); }}
                      >
                        {isPending(MutationKeys.markPaymentReceived(payment.id)) ? "…" : "Mark received"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="card">
          <h2>Hour banks</h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Project</th>
                <th>Remaining</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {hourBanks.length === 0 ? (
                <tr><td colSpan={4}><p>No paid-hour banks recorded yet.</p></td></tr>
              ) : hourBanks.map((bank) => (
                <tr key={bank.id}>
                  <td>{clients.find((client) => client.id === bank.clientId)?.company}</td>
                  <td>{bank.projectId ? getProjectName(bank.projectId, projects) : "General"}</td>
                  <td>{bank.hoursRemaining} hrs</td>
                  <td>{bank.expiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </>
  );
}
