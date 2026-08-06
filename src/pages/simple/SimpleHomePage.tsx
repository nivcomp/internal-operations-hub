import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useMode } from "../../context/ModeContext";
import { useCopilot } from "../../context/CopilotContext";
import { ShareLinksCard } from "../../components/simple/ShareLinksCard";
import { InviteDrawer } from "../../components/simple/InviteDrawer";
import { copyToClipboard } from "../../services/accessApi";
import {
  listRegistrations, loadRegistrationSettings, publicRegistrationLink,
  type PublicRegistration, type RegistrationSettings,
} from "../../services/registrationApi";
import {
  getNeedsPricingItems, getSupplierTimeApprovalItems, getWaitingApprovalItems, getWaitingPaymentItems,
} from "../../lib/actionQueue";
import { buildProjectCommercials, needsScheduleAttention } from "../../lib/projectCommercials";

type Props = { onSearch: () => void };

export function SimpleHomePage({ onSearch }: Props) {
  const {
    clients, suppliers, projects, changeRequests, clientPayments, timeEntries,
    projectSchedules, estimateSummaries, supplierProfiles,
  } = useAppData();
  const { setSimpleView, openAdvanced } = useMode();
  const copilot = useCopilot();
  const [inviteRole, setInviteRole] = useState<"client" | "supplier" | null>(null);
  const [settings, setSettings] = useState<RegistrationSettings[]>([]);
  const [registrations, setRegistrations] = useState<PublicRegistration[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [meetingProjectId, setMeetingProjectId] = useState("");

  useEffect(() => {
    if (!meetingProjectId && projects[0]) setMeetingProjectId(projects[0].id);
  }, [projects, meetingProjectId]);

  useEffect(() => {
    void (async () => {
      try {
        const [s, r] = await Promise.all([loadRegistrationSettings(), listRegistrations()]);
        setSettings(s); setRegistrations(r);
      } catch { /* informational only */ }
    })();
  }, [refreshToken]);

  const needsPricing = useMemo(() => getNeedsPricingItems(projects, changeRequests), [projects, changeRequests]);
  const waitingApproval = useMemo(() => getWaitingApprovalItems(projects, changeRequests), [projects, changeRequests]);
  const waitingPayment = useMemo(() => getWaitingPaymentItems(projects, clientPayments), [projects, clientPayments]);
  const waitingTime = useMemo(() => getSupplierTimeApprovalItems(timeEntries), [timeEntries]);
  const atRisk = useMemo(() => projects.filter((project) => needsScheduleAttention(
    buildProjectCommercials({
      project,
      schedule: projectSchedules.find((s) => s.projectId === project.id),
      summary: estimateSummaries.find((s) => s.projectId === project.id),
      supplierProfiles,
    }),
    project,
  )), [projects, projectSchedules, estimateSummaries, supplierProfiles]);

  const newClients = clients.filter((client) => client.status === "lead");
  const newSuppliers = suppliers.filter((supplier) => supplier.status === "pending_review");
  const unfinished = registrations.filter((item) => item.status === "awaiting_confirmation");

  const attention = [
    { label: "פרויקטים שמחכים לתמחור", count: needsPricing.length, action: "בדוק עכשיו", run: () => setSimpleView("tasks") },
    { label: "פרויקטים שמחכים לאישור", count: waitingApproval.length, action: "פתח משימות", run: () => setSimpleView("tasks") },
    { label: "תשלומים ממתינים", count: waitingPayment.length, action: "פתח כספים", run: () => setSimpleView("finance") },
    { label: "שעות ספק ממתינות", count: waitingTime.length, action: "אשר שעות", run: () => openAdvanced("supplier-time") },
    { label: "לקוחות חדשים", count: newClients.length, action: "פתח לקוחות", run: () => setSimpleView("clients") },
    { label: "ספקים חדשים", count: newSuppliers.length, action: "פתח ספקים", run: () => setSimpleView("suppliers") },
    { label: "פרויקטים בסיכון", count: atRisk.length, action: "בדוק פרויקטים", run: () => setSimpleView("projects") },
    { label: "הרשמות שלא הושלמו", count: unfinished.length, action: "פתח הרשמות", run: () => openAdvanced("access-management") },
  ];
  const total = attention.reduce((sum, item) => sum + item.count, 0);

  async function copyPublicLink(role: "client" | "supplier") {
    const item = settings.find((entry) => entry.role === role);
    if (!item) return;
    await copyToClipboard(publicRegistrationLink(item));
    setCopied(role);
  }

  return (
    <div className="simple-page">
      <header className="simple-head">
        <p className="eyebrow">מה דורש טיפול</p>
        <h1>{total > 0 ? `${total} דברים מחכים לך` : "אין משימות פתוחות"}</h1>
        <p className="simple-note">כל השאר נשאר בצד עד שתצטרך אותו.</p>
      </header>

      <section className="card simple-card simple-meeting-card" dir="rtl">
        <div>
          <p className="eyebrow">פגישה עם לקוח</p>
          <h2>פגישה פרונטלית חדשה</h2>
          <p className="simple-note">בחר פרויקט ופתח מיד את חדר האפיון עם שיחה, תמלול, קבצים, אפיון חי ותמחור.</p>
        </div>
        {projects.length ? (
          <div className="simple-meeting-actions">
            <label>
              פרויקט
              <select value={meetingProjectId} onChange={(event) => setMeetingProjectId(event.target.value)}>
                {projects.map((project) => {
                  const client = clients.find((item) => item.id === project.clientId);
                  return <option key={project.id} value={project.id}>{client?.company ? `${client.company} — ` : ""}{project.name}</option>;
                })}
              </select>
            </label>
            <button
              type="button"
              className="primary-button simple-meeting-button"
              disabled={!meetingProjectId}
              onClick={() => {
                window.sessionStorage.setItem("open-project-meeting", meetingProjectId);
                openAdvanced("project-detail", { projectId: meetingProjectId });
              }}
            >
              פתח חדר אפיון
            </button>
          </div>
        ) : (
          <button type="button" className="primary-button" onClick={() => openAdvanced("clients")}>צור לקוח ופרויקט ראשון</button>
        )}
      </section>

      <section className="simple-attention">
        {attention.filter((item) => item.count > 0).map((item) => (
          <button key={item.label} type="button" className="card simple-attention-card" onClick={item.run}>
            <strong>{item.count}</strong>
            <span>{item.label}</span>
            <em>{item.action}</em>
          </button>
        ))}
        {total === 0 ? <p className="simple-note">הכול מעודכן. אפשר להזמין לקוח חדש או לפתוח פרויקט.</p> : null}
      </section>

      <section className="card simple-card">
        <h2>פעולות מהירות</h2>
        <div className="simple-quick-grid">
          <button type="button" onClick={() => setInviteRole("client")}>הזמן לקוח</button>
          <button type="button" onClick={() => setInviteRole("supplier")}>הזמן ספק</button>
          <button type="button" onClick={() => openAdvanced("clients")}>צור לקוח</button>
          <button type="button" onClick={() => openAdvanced("projects")}>צור פרויקט</button>
          <button type="button" onClick={() => openAdvanced("suppliers")}>צור ספק</button>
          <button type="button" onClick={() => void copyPublicLink("client")}>
            {copied === "client" ? "הועתק" : "העתק לינק הרשמת לקוח"}
          </button>
          <button type="button" onClick={() => void copyPublicLink("supplier")}>
            {copied === "supplier" ? "הועתק" : "העתק לינק הרשמת ספק"}
          </button>
          <button type="button" onClick={onSearch}>חפש לקוח, ספק או פרויקט</button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              copilot.setOpen(true);
              void copilot.send("מה דורש טיפול היום? תן לי את המשימה הבאה בעברית.");
            }}
          >
            פתח את המשימה הבאה
          </button>
        </div>
      </section>

      <ShareLinksCard refreshToken={refreshToken} />

      {inviteRole ? (
        <InviteDrawer
          role={inviteRole}
          onClose={() => setInviteRole(null)}
          onInvited={() => setRefreshToken((value) => value + 1)}
          onOpenRecord={({ clientId, supplierId }) => {
            if (clientId) openAdvanced("client-detail", { clientId });
            else if (supplierId) openAdvanced("supplier-detail", { supplierId });
          }}
        />
      ) : null}
    </div>
  );
}
