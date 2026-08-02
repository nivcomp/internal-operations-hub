import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../integrations/supabase/client";
import type { UserRole } from "../types/domain";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  client_id: string | null;
  supplier_id: string | null;
  is_active: boolean;
};

export function AccessManagementPage() {
  const { clients, suppliers } = useAppData();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [linkId, setLinkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, client_id, supplier_id, is_active")
      .order("created_at", { ascending: true });
    if (err) setLoadError(err.message);
    else { setProfiles((data ?? []) as ProfileRow[]); setLoadError(null); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (role === "client" && !linkId) throw new Error("Select the client this account belongs to.");
      if (role === "supplier" && !linkId) throw new Error("Select the supplier this account belongs to.");
      const { data, error: fnError } = await supabase.functions.invoke("invite-user", {
        body: {
          email: email.trim(),
          fullName: fullName.trim() || email.trim(),
          role,
          clientId: role === "client" ? linkId : null,
          supplierId: role === "supplier" ? linkId : null,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(String(data.error));
      setNotice(`Invitation sent to ${email.trim()}.`);
      setEmail(""); setFullName(""); setLinkId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(profile: ProfileRow) {
    const { error: err } = await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);
    if (err) setLoadError(err.message);
    else await load();
  }

  return (
    <>
      <PageHeader
        title="Access Management"
        subtitle="Invite agency, client and supplier accounts and control who can sign in. Agency admin only."
      />

      <section className="card">
        <h2>Invite a user</h2>
        <form onSubmit={handleInvite} className="stack-form">
          <label>
            <span>Email</span>
            <input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <span>Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label>
            <span>Role</span>
            <select value={role} onChange={(e) => { setRole(e.target.value as UserRole); setLinkId(""); }}>
              <option value="agency_admin">Agency admin</option>
              <option value="client">Client</option>
              <option value="supplier">Supplier</option>
            </select>
          </label>
          {role === "client" ? (
            <label>
              <span>Linked client</span>
              <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                <option value="">Select a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </label>
          ) : null}
          {role === "supplier" ? (
            <label>
              <span>Linked supplier</span>
              <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-success">{notice}</p> : null}
          <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</button>
        </form>
      </section>

      <section className="card">
        <h2>Accounts</h2>
        {loadError ? <p className="form-error">{loadError}</p> : null}
        {loading ? <p>Loading accounts…</p> : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Linked to</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name}</td>
                  <td>{p.email}</td>
                  <td>{p.role}</td>
                  <td>
                    {p.client_id ? clients.find((c) => c.id === p.client_id)?.company ?? "Client" : null}
                    {p.supplier_id ? suppliers.find((s) => s.id === p.supplier_id)?.name ?? "Supplier" : null}
                    {!p.client_id && !p.supplier_id ? "Agency" : null}
                  </td>
                  <td><StatusBadge label={p.is_active ? "active" : "disabled"} tone={p.is_active ? "success" : "warning"} /></td>
                  <td>
                    <button type="button" onClick={() => void toggleActive(p)}>
                      {p.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
