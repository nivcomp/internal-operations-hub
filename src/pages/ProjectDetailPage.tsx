import { type FormEvent, useState } from "react";
import type { NewChangeRequestInput, NewClientPaymentInput, NewTimeEntryInput } from "../App";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import {
  decisionLogs,
  fileLinks,
  projectBriefs,
  scopeItems,
  scopes,
  supplierProfiles,
  suppliers,
} from "../data/mockData";
import {
  canWorkStart,
  currency,
  getClient,
  getPricing,
  getProjectById,
  getSupplierName,
  statusLabels,
} from "../lib/domainHelpers";
import type { ChangeRequest, Client, ClientPayment, Project, TimeEntry } from "../types/domain";

type ProjectDetailPageProps = {
  selectedProjectId?: string;
  clients: Client[];
  projects: Project[];
  changeRequests: ChangeRequest[];
  timeEntries: TimeEntry[];
  clientPayments: ClientPayment[];
  onChangeRequestCreate: (projectId: string, clientId: string, input: NewChangeRequestInput) => void;
  onChangeRequestStatusChange: (changeRequestId: string, status: "priced" | "client_approved" | "declined") => void;
  onClientPaymentCreate: (projectId: string, input: NewClientPaymentInput) => void;
  onPaymentReceived: (paymentId: string) => void;
  onSupplierAssignmentChange: (projectId: string, supplierId: string, assigned: boolean) => void;
  onTimeEntryCreate: (projectId: string, input: NewTimeEntryInput) => void;
  onTimeEntryStatusChange: (timeEntryId: string, status: "approved" | "rejected") => void;
};

const initialChangeForm: NewChangeRequestInput = {
  title: "",
  description: "",
  agencyPrice: undefined,
  supplierCost: undefined,
};

const initialTimeForm: NewTimeEntryInput = {
  supplierId: "",
  date: new Date().toISOString().slice(0, 10),
  hours: 1,
  description: "",
};

const initialPaymentForm: NewClientPaymentInput = {
  amount: 0,
  dueDate: "",
  notes: "",
};

export function ProjectDetailPage({
  selectedProjectId,
  clients,
  projects,
  changeRequests,
  timeEntries,
  clientPayments,
  onChangeRequestCreate,
  onChangeRequestStatusChange,
  onClientPaymentCreate,
  onPaymentReceived,
  onSupplierAssignmentChange,
  onTimeEntryCreate,
  onTimeEntryStatusChange,
}: ProjectDetailPageProps) {
  const [changeForm, setChangeForm] = useState<NewChangeRequestInput>(initialChangeForm);
  const [timeForm, setTimeForm] = useState<NewTimeEntryInput>(initialTimeForm);
  const [paymentForm, setPaymentForm] = useState<NewClientPaymentInput>(initialPaymentForm);
  const [supplierToAssign, setSupplierToAssign] = useState("");
  const project = selectedProjectId ? getProjectById(selectedProjectId, projects) : undefined;

  if (!project) {
    return (
      <>
        <PageHeader title="Project Detail" subtitle="Select a project from the Projects page or a Client Detail page to open its command center." />
        <section className="empty-state">
          <h2>No project selected</h2>
          <p>Choose a project row to inspect summary, payment gate, scope, suppliers, changes, files, and decisions.</p>
        </section>
      </>
    );
  }

  const activeProject = project;
  const client = getClient(activeProject, clients);
  const pricing = getPricing(activeProject.id);
  const scope = scopes.find((item) => item.projectId === activeProject.id);
  const brief = projectBriefs.find((item) => item.projectId === activeProject.id);
  const items = scope ? scopeItems.filter((item) => item.scopeId === scope.id) : [];
  const payment = clientPayments.find((item) => item.projectId === activeProject.id);
  const projectChanges = changeRequests.filter((request) => request.projectId === activeProject.id);
  const projectTimeEntries = timeEntries.filter((entry) => entry.projectId === activeProject.id);
  const projectFiles = fileLinks.filter((file) => file.projectId === activeProject.id);
  const projectDecisions = decisionLogs.filter((decision) => decision.projectId === activeProject.id);
  const approvedSuppliers = suppliers.filter((supplier) => supplier.status === "approved");
  const assignableSuppliers = approvedSuppliers.filter((supplier) => !activeProject.assignedSupplierIds.includes(supplier.id));
  const approvedSupplierRows = approvedSuppliers.map((supplier) => ({
    supplier,
    profile: supplierProfiles.find((item) => item.supplierId === supplier.id),
    assigned: activeProject.assignedSupplierIds.includes(supplier.id),
  }));

  function handleChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !changeForm.title.trim() || !changeForm.description.trim()) return;
    onChangeRequestCreate(activeProject.id, client.id, {
      title: changeForm.title.trim(),
      description: changeForm.description.trim(),
      agencyPrice: changeForm.agencyPrice,
      supplierCost: changeForm.supplierCost,
    });
    setChangeForm(initialChangeForm);
  }

  function handleTimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timeForm.supplierId || !timeForm.description.trim() || timeForm.hours <= 0) return;
    onTimeEntryCreate(activeProject.id, {
      ...timeForm,
      description: timeForm.description.trim(),
    });
    setTimeForm({ ...initialTimeForm, supplierId: timeForm.supplierId });
  }

  function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentForm.amount <= 0) return;
    onClientPaymentCreate(activeProject.id, {
      amount: paymentForm.amount,
      dueDate: paymentForm.dueDate || undefined,
      notes: paymentForm.notes.trim(),
    });
    setPaymentForm(initialPaymentForm);
  }

  function handleSupplierAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplierToAssign) return;
    onSupplierAssignmentChange(activeProject.id, supplierToAssign, true);
    setSupplierToAssign("");
  }

  return (
    <>
      <PageHeader title="Project Command Center" subtitle="A single project view for summary, client context, payment gate, scope, pricing, suppliers, changes, files, and decisions." />
      <section className="detail-grid">
        <article className="card">
          <h2>{activeProject.name}</h2>
          <p>{activeProject.summary}</p>
          <dl className="meta-list">
            <div><dt>Client</dt><dd>{client?.company}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge label={statusLabels[activeProject.status]} tone="warning" /></dd></div>
            <div><dt>Start gate</dt><dd>{canWorkStart(activeProject) ? "Ready" : "Blocked until approved scope and payment or paid hours"}</dd></div>
            <div><dt>Assigned</dt><dd>{activeProject.assignedSupplierIds.map((supplierId) => getSupplierName(supplierId)).join(", ") || "No supplier assigned"}</dd></div>
          </dl>
        </article>
        <article className="card warning-card">
          <h2>Payment gate</h2>
          <p>{canWorkStart(activeProject) ? "Work may start because scope is approved and payment is received or paid hours are available." : "Work remains blocked until scope is approved and payment is received or paid hours are available."}</p>
          <dl className="meta-list">
            <div><dt>Gate</dt><dd>{activeProject.paymentGateStatus}</dd></div>
            <div><dt>Payment</dt><dd>{payment?.status ?? "Not due"}</dd></div>
            <div><dt>Amount</dt><dd>{payment ? currency.format(payment.amount) : "Not set"}</dd></div>
          </dl>
          {payment && payment.status !== "received" ? (
            <div className="action-row">
              <button className="primary-button" type="button" onClick={() => onPaymentReceived(payment.id)}>
                Mark payment received
              </button>
            </div>
          ) : null}
        </article>
      </section>
      {!payment ? (
        <section className="card form-panel">
          <h2>Create payment request</h2>
          <form className="form-grid" onSubmit={handlePaymentSubmit}>
            <label>
              Amount
              <input
                min="1"
                type="number"
                value={paymentForm.amount || ""}
                onChange={(event) => setPaymentForm({ ...paymentForm, amount: Number(event.target.value) })}
              />
            </label>
            <label>
              Due date optional
              <input
                type="date"
                value={paymentForm.dueDate ?? ""}
                onChange={(event) => setPaymentForm({ ...paymentForm, dueDate: event.target.value })}
              />
            </label>
            <label className="span-2">
              Notes
              <textarea
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
              />
            </label>
            <p className="form-note">This creates a local requested payment only. Work remains blocked until Yaniv marks the payment received.</p>
            <div className="form-actions">
              <button className="primary-button" type="submit">Create payment request</button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="detail-grid">
        <article className="card">
          <h2>Brief</h2>
          {brief ? (
            <>
              <p>{brief.problemStatement}</p>
              <h3>Goals</h3>
              <ul>{brief.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
              <h3>Constraints</h3>
              <ul>{brief.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
            </>
          ) : (
            <p>No brief has been drafted for this project yet.</p>
          )}
        </article>
        <article className="card">
          <h2>Agency pricing separation</h2>
          <dl className="meta-list">
            <div><dt>Client price</dt><dd>{pricing ? currency.format(pricing.clientPrice) : "Not set"}</dd></div>
            <div><dt>Supplier cost</dt><dd>{pricing ? currency.format(pricing.supplierCostEstimate) : "Not set"}</dd></div>
            <div><dt>Margin</dt><dd>{pricing ? `${pricing.actualMarginPercent}%` : "Not set"}</dd></div>
            <div><dt>Internal note</dt><dd>{pricing?.pricingNotes ?? "Pricing not set"}</dd></div>
          </dl>
        </article>
      </section>
      <section className="card form-panel">
        <h2>Add change request</h2>
        <form className="form-grid" onSubmit={handleChangeSubmit}>
          <label>
            Title
            <input value={changeForm.title} onChange={(event) => setChangeForm({ ...changeForm, title: event.target.value })} />
          </label>
          <label>
            Agency price optional
            <input
              min="0"
              type="number"
              value={changeForm.agencyPrice ?? ""}
              onChange={(event) => setChangeForm({ ...changeForm, agencyPrice: event.target.value ? Number(event.target.value) : undefined })}
            />
          </label>
          <label>
            Supplier cost optional
            <input
              min="0"
              type="number"
              value={changeForm.supplierCost ?? ""}
              onChange={(event) => setChangeForm({ ...changeForm, supplierCost: event.target.value ? Number(event.target.value) : undefined })}
            />
          </label>
          <label className="span-2">
            Description
            <textarea value={changeForm.description} onChange={(event) => setChangeForm({ ...changeForm, description: event.target.value })} />
          </label>
          <p className="form-note">New change requests start in agency review. If prices are empty, they remain visibly unpriced.</p>
          <div className="form-actions">
            <button className="primary-button" type="submit">Add change request</button>
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Client details</h2>
        <dl className="meta-list">
          <div><dt>Company</dt><dd>{client?.company}</dd></div>
          <div><dt>Contact</dt><dd>{client?.name}</dd></div>
          <div><dt>Email</dt><dd>{client?.email}</dd></div>
          <div><dt>Phone</dt><dd>{client?.phone ?? "Not set"}</dd></div>
        </dl>
      </section>
      <section className="card">
        <h2>Scope and scope items</h2>
        {scope ? (
          <>
            <p>{scope.clientFacingSummary}</p>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Phase</th>
                  <th>Client visible</th>
                  <th>Supplier visible</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.phase}</td>
                    <td>{item.clientVisible ? "Yes" : "No"}</td>
                    <td>{item.supplierVisible ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>No scope has been created for this project yet.</p>
        )}
      </section>
      <section className="detail-grid">
        <article className="card">
          <h2>Assigned suppliers</h2>
          {activeProject.assignedSupplierIds.length ? (
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Skills</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeProject.assignedSupplierIds.map((supplierId) => {
                  const supplier = suppliers.find((item) => item.id === supplierId);
                  const profile = supplierProfiles.find((item) => item.supplierId === supplierId);
                  return (
                    <tr key={supplierId}>
                      <td>{supplier?.name ?? getSupplierName(supplierId)}</td>
                      <td>{supplier?.status ?? "Unknown"}</td>
                      <td>{profile?.mainSkills.join(", ") ?? "Not set"}</td>
                      <td>
                        <button type="button" onClick={() => onSupplierAssignmentChange(activeProject.id, supplierId, false)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p>No supplier assigned yet.</p>
          )}
          <form className="inline-form" onSubmit={handleSupplierAssign}>
            <label>
              Assign approved supplier
              <select value={supplierToAssign} onChange={(event) => setSupplierToAssign(event.target.value)}>
                <option value="">Select supplier</option>
                {assignableSuppliers.map((supplier) => {
                  const profile = supplierProfiles.find((item) => item.supplierId === supplier.id);
                  return (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}{profile ? ` - ${profile.mainSkills.join(", ")}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <button type="submit" disabled={!supplierToAssign}>Assign</button>
          </form>
          <h3>Approved supplier pool</h3>
          {approvedSupplierRows.length ? (
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Skills</th>
                  <th>Weekly availability</th>
                  <th>Assignment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {approvedSupplierRows.map(({ supplier, profile, assigned }) => (
                  <tr key={supplier.id}>
                    <td>{supplier.name}</td>
                    <td>{profile?.mainSkills.join(", ") ?? "Not set"}</td>
                    <td>{profile ? `${profile.weeklyAvailabilityHours}h` : "Not set"}</td>
                    <td><StatusBadge label={assigned ? "Assigned" : "Available"} tone={assigned ? "success" : "neutral"} /></td>
                    <td>
                      {assigned ? (
                        <button type="button" onClick={() => onSupplierAssignmentChange(activeProject.id, supplier.id, false)}>
                          Remove
                        </button>
                      ) : (
                        <button type="button" onClick={() => onSupplierAssignmentChange(activeProject.id, supplier.id, true)}>
                          Assign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No approved suppliers are available for assignment yet.</p>
          )}
          <p className="form-note">Only agency-approved suppliers can be assigned. Assignment stays local until persistence is added.</p>
        </article>
        <article className="card">
          <h2>Supplier time entries</h2>
          {projectTimeEntries.length ? (
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projectTimeEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{getSupplierName(entry.supplierId)}</td>
                    <td>{entry.hours}</td>
                    <td><StatusBadge label={entry.status} tone={entry.status === "approved" ? "success" : "warning"} /></td>
                    <td>
                      {entry.status === "submitted" ? (
                        <div className="table-actions">
                          <button type="button" onClick={() => onTimeEntryStatusChange(entry.id, "approved")}>Approve</button>
                          <button type="button" onClick={() => onTimeEntryStatusChange(entry.id, "rejected")}>Reject</button>
                        </div>
                      ) : (
                        entry.status === "approved" ? "Payable" : "Not payable"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No supplier time has been logged for this project.</p>
          )}
        </article>
      </section>
      <section className="card form-panel">
        <h2>Add supplier time entry</h2>
        <form className="form-grid" onSubmit={handleTimeSubmit}>
          <label>
            Supplier
            <select value={timeForm.supplierId} onChange={(event) => setTimeForm({ ...timeForm, supplierId: event.target.value })}>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={timeForm.date} onChange={(event) => setTimeForm({ ...timeForm, date: event.target.value })} />
          </label>
          <label>
            Hours
            <input min="0.25" step="0.25" type="number" value={timeForm.hours} onChange={(event) => setTimeForm({ ...timeForm, hours: Number(event.target.value) })} />
          </label>
          <label className="span-2">
            Description
            <textarea value={timeForm.description} onChange={(event) => setTimeForm({ ...timeForm, description: event.target.value })} />
          </label>
          <p className="form-note">New time entries are submitted first. They are not payable until Yaniv approves them.</p>
          <div className="form-actions">
            <button className="primary-button" type="submit">Add submitted time</button>
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Change requests</h2>
        {projectChanges.length ? (
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Status</th>
                <th>Agency price</th>
                <th>Supplier cost</th>
                <th>Work rule</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectChanges.map((request) => (
                <tr key={request.id}>
                  <td>{request.title}</td>
                  <td><StatusBadge label={request.status} tone={request.status === "client_approved" ? "success" : "warning"} /></td>
                  <td>{request.agencyPrice ? currency.format(request.agencyPrice) : "Needs pricing"}</td>
                  <td>{request.supplierCost ? currency.format(request.supplierCost) : "Not estimated"}</td>
                  <td>{request.status === "client_approved" ? "Can become work" : "Blocked until priced and approved"}</td>
                  <td>
                    <div className="table-actions">
                      {request.status === "agency_review" ? <button type="button" onClick={() => onChangeRequestStatusChange(request.id, "priced")}>Mark priced</button> : null}
                      {request.status === "priced" ? <button type="button" onClick={() => onChangeRequestStatusChange(request.id, "client_approved")}>Client approved</button> : null}
                      {request.status !== "declined" && request.status !== "client_approved" ? <button type="button" onClick={() => onChangeRequestStatusChange(request.id, "declined")}>Decline</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No change requests for this project.</p>
        )}
      </section>
      <section className="detail-grid">
        <article className="card">
          <h2>Files and links</h2>
          {projectFiles.length ? projectFiles.map((file) => (
            <p key={file.id}>{file.title} - {file.visibility}</p>
          )) : <p>No files or links attached yet.</p>}
        </article>
        <article className="card">
          <h2>Decision log</h2>
          {projectDecisions.length ? projectDecisions.map((decision) => (
            <p key={decision.id}>{decision.decision} {decision.impact}</p>
          )) : <p>No decisions logged yet.</p>}
        </article>
      </section>
    </>
  );
}
