type Props = {
  language: "he" | "en";
  clientName: string;
  company: string;
  email: string;
  projectName?: string;
  projectPending?: boolean;
  preview?: boolean;
};

const COPY = {
  he: {
    connected: "מחובר לחשבון הלקוח",
    preview: "תצוגת לקוח מקדימה",
    client: "לקוח",
    business: "עסק",
    project: "פרויקט",
    pendingProject: "פרויקט חדש — השם ייקבע מתוך השיחה",
    draftNote: "כל מה שנכתב כאן נשמר בחשבון הזה. בסיום ייפתח פרויקט אחד, והשיחה, הסיכום והתרשים יישמרו בתוכו. אחרי שנעבור על זה, נכין באותו מקום תצוגה ראשונה של מה שבונים לך.",
    projectNote: "השיחה, הסיכום, התרשימים והתצוגה של מה שבונים מחוברים לפרויקט הזה בלבד ולחשבון שמופיע כאן.",
    previewNote: "זו תצוגה מקדימה של סביבת הלקוח. הנתונים המוצגים שייכים ללקוח ולפרויקט שמופיעים כאן.",
  },
  en: {
    connected: "Connected client account",
    preview: "Client view preview",
    client: "Client",
    business: "Business",
    project: "Project",
    pendingProject: "New project — the name will come from the conversation",
    draftNote: "Everything written here is saved to this account. When you finish, one project is created and the conversation, summary and diagram stay inside it. After we review it, we prepare a first preview of what we are building for you in the same place.",
    projectNote: "The conversation, summary, diagrams and the preview of what we are building are connected only to this project and the account shown here.",
    previewNote: "This is a preview of the client workspace. The information shown belongs to the client and project named here.",
  },
} as const;

export function ClientWorkspaceIdentity({
  language,
  clientName,
  company,
  email,
  projectName,
  projectPending = false,
  preview = false,
}: Props) {
  const t = COPY[language];
  const resolvedProject = projectName?.trim() || t.pendingProject;

  return (
    <section className="client-workspace-identity" aria-label={preview ? t.preview : t.connected}>
      <div className={`client-identity-status${preview ? " preview" : ""}`}>
        <span aria-hidden="true" />
        {preview ? t.preview : t.connected}
      </div>
      <dl>
        <div>
          <dt>{t.client}</dt>
          <dd>{clientName || email}</dd>
          {email ? <small>{email}</small> : null}
        </div>
        <div>
          <dt>{t.business}</dt>
          <dd>{company || clientName || email}</dd>
        </div>
        <div>
          <dt>{t.project}</dt>
          <dd>{resolvedProject}</dd>
        </div>
      </dl>
      <p>{preview ? t.previewNote : projectPending ? t.draftNote : t.projectNote}</p>
    </section>
  );
}
