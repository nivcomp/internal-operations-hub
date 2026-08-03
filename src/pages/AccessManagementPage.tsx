import { useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { QuickInvitePanel } from "../components/QuickInvitePanel";
import { PublicLinkSettings } from "../components/access/PublicLinkSettings";
import { RegistrationsPanel } from "../components/access/RegistrationsPanel";
import { StatusBadge } from "../components/StatusBadge";
import { useAppData } from "../context/AppDataContext";
import {
  accessStatusLabels,
  copyToClipboard,
  createAccessLink,
  formatDateTime,
  inviteAccessUser,
  setAccessActive,
  useAccessAccounts,
  type AccessAccount,
} from "../services/accessApi";
import type { UserRole } from "../types/domain";

type AccessManagementPageProps = {
  onClientSelect: (clientId: string) => void;
  onSupplierSelect: (supplierId: string) => void;
};

const roleLabels: Record<UserRole, string> = {
  agency_admin: "Agency admin",
  client: "Client",
  supplier: "Supplier",
};

export function AccessManagementPage({ onClientSelect, onSupplierSelect }: AccessManagementPageProps) {
  const { clients, suppliers } = useAppData();
  const { accounts, loading, error, reload } = useAccessAccounts();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [inviteFilter, setInviteFilter] = useState<"all" | "pending" | "active" | "disabled">("all");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [linkId, setLinkId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (roleFilter !== "all" && account.role !== roleFilter) return false;
      if (activeFilter === "active" && !account.isActive) return false;
      if (activeFilter === "inactive" && account.isActive) return false;
      if (inviteFilter !== "all" && account.invitationStatus !== inviteFilter) return false;
      if (!term) return true;
      return `${account.fullName} ${account.email}`.toLowerCase().includes(term);
    });
  }, [accounts, search, roleFilter, activeFilter, inviteFilter]);

  function linkedLabel(account: AccessAccount) {
    if (account.clientId) return clients.find((c) => c.id === account.clientId)?.company ?? "Client";
    if (account.supplierId) return suppliers.find((s) => s.id === account.supplierId)?.name ?? "Supplier";
    return "Agency";
  }

  async function run(key: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setFormError(null);
    setNotice(null);
    setCopiedId(null);
    try {
      await task();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not complete that action.");
    } finally {
      setBusy(null);
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    await run("invite", async () => {
      if (role !== "agency_admin" && !linkId) {
        throw new Error(`Select the ${role} record this account belongs to.`);
      }
      const result = await inviteAccessUser({
        email: email.trim(),
        fullName: fullName.trim() || email.trim(),
        role,
        clientId: role === "client" ? linkId : null,
        supplierId: role === "supplier" ? linkId : null,
      });
      if (result.link) setLink({ id: result.userId, url: result.link });
      setNotice(`Invitation created for ${email.trim()}.`);
      setEmail(""); setFullName(""); setLinkId("");
      await reload();
    });
  }

  async function handleLink(account: AccessAccount) {
    await run(`link:${account.id}`, async () => {
      const url = await createAccessLink(account.id);
      setLink({ id: account.id, url });
      await copyToClipboard(url);
      setCopiedId(account.id);
      setNotice(`Invitation link for ${account.email} copied to your clipboard.`);
    });
  }

  async function handleToggle(account: AccessAccount) {
    await run(`toggle:${account.id}`, async () => {
      await setAccessActive(account.id, !account.isActive);
      setNotice(account.isActive ? `${account.email} was disabled.` : `${account.email} was reactivated.`);
      await reload();
    });
  }

  return (
    <>
      <PageHeader
        title="Access Management"
        subtitle="An overview of every account. Day-to-day invitations can also be sent straight from a client or supplier record."
      />

      <QuickInvitePanel onInvited={() => void reload()} />
      <RegistrationsPanel onReviewed={() => void reload()} />
      <PublicLinkSettings />

      <section className="card">
        <h2>Accounts</h2>
        <div className="filter-row">
          <input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
            <option value="all">All roles</option>
            <option value="agency_admin">Agency admin</option>
            <option value="client">Client</option>
            <option value="supplier">Supplier</option>
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}>
            <option value="all">Active and inactive</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select value={inviteFilter} onChange={(e) => setInviteFilter(e.target.value as typeof inviteFilter)}>
            <option value="all">Any invitation status</option>
            <option value="pending">Invitation pending</option>
            <option value="active">Signed in</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p className="muted-text">Loading accounts…</p> : null}

        {!loading && visible.length === 0 ? (
          <div className="empty-state inline-empty-state">
            <h3>No accounts match</h3>
            <p>Adjust the filters, or invite someone using the form below.</p>
          </div>
        ) : null}

        {!loading && visible.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Linked to</th>
                <th>Invitation</th><th>Account</th><th>Created</th><th>Last sign-in</th><th />
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => (
                <tr key={account.id}>
                  <td>{account.fullName}</td>
                  <td>{account.email}</td>
                  <td>{roleLabels[account.role]}</td>
                  <td>
                    {account.clientId || account.supplierId ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          account.clientId ? onClientSelect(account.clientId) : onSupplierSelect(account.supplierId!)
                        }
                      >
                        {linkedLabel(account)}
                      </button>
                    ) : (
                      linkedLabel(account)
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      label={accessStatusLabels[account.invitationStatus]}
                      tone={account.invitationStatus === "active" ? "success" : account.invitationStatus === "disabled" ? "danger" : "warning"}
                    />
                  </td>
                  <td>{account.isActive ? "Enabled" : "Disabled"}</td>
                  <td>{formatDateTime(account.createdAt)}</td>
                  <td>{formatDateTime(account.lastSignInAt)}</td>
                  <td>
                    <div className="action-row compact">
                      <button type="button" onClick={() => void handleLink(account)} disabled={busy !== null}>
                        {copiedId === account.id ? "Copied" : "Copy invite link"}
                      </button>
                      <button type="button" onClick={() => void handleToggle(account)} disabled={busy !== null}>
                        {account.isActive ? "Disable" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {link ? (
          <div className="invite-link-box">
            <p className="muted-text">Secure invitation link — send it by email, WhatsApp or any channel you prefer.</p>
            <code className="invite-link">{link.url}</code>
            <div className="action-row">
              <button className="primary-button" type="button" onClick={() => { void copyToClipboard(link.url); setCopiedId(link.id); }}>
                {copiedId === link.id ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card form-panel">
        <h2>Invite a user</h2>
        <form onSubmit={handleInvite} className="form-grid">
          <label>
            Email
            <input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => { setRole(e.target.value as UserRole); setLinkId(""); }}>
              <option value="agency_admin">Agency admin</option>
              <option value="client">Client</option>
              <option value="supplier">Supplier</option>
            </select>
          </label>
          {role === "client" ? (
            <label>
              Linked client
              <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                <option value="">Select a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </label>
          ) : null}
          {role === "supplier" ? (
            <label>
              Linked supplier
              <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ) : null}
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={busy !== null}>
              {busy === "invite" ? "Creating invitation…" : "Create invitation"}
            </button>
          </div>
        </form>
        {role === "supplier" && suppliers.length === 0 ? (
          <p className="muted-text">Create a supplier before inviting a supplier user.</p>
        ) : null}
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
        {notice && !formError ? <p className="form-success">{notice}</p> : null}
      </section>
    </>
  );
}
