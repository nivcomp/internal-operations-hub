import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Disclosure } from "../../components/ui/Disclosure";
import { ProjectChat } from "../../components/ProjectChat";
import { SaveShortcutCard } from "../../components/SaveShortcutCard";
import { ProjectFlowCanvas } from "../../components/client/ProjectFlowCanvas";
import { PrototypeStudio } from "../../components/prototype/PrototypeStudio";
import { useAppData } from "../../context/AppDataContext";
import { useAuth } from "../../context/AuthContext";
import { fetchOnboardingState } from "../../services/onboardingApi";
import { getProjectSolutionKind } from "../../services/prototypeApi";
import { getProjectFileLink, listProjectFiles, type ProjectFile } from "../../services/projectFilesApi";
import type { LiveFlow } from "../../services/onboardingChatApi";
import { deliverable, guessSolutionKind, type SolutionKind, type WordingLang } from "../../lib/clientWording";
import type { ViewKey } from "../../views";

type Props = { clientId?: string; onNavigate: (view: ViewKey) => void; onRestartWizard: () => void };

const copy = {
  he: {
    workspace: "המרחב שלך", intro: "כאן מדברים על הפרויקט, מעלים מסמכים ורואים איך התהליך נראה.",
    chatTitle: "השיחה על הפרויקט", chatSub: "ספר לנו מה צריך — אפשר גם לצרף מסמך או לדבר.",
    stages: ["מבינים מה צריך", "מאשרים את ההצעה", "בונים", "מוסרים לך"],
    files: "המסמכים שהעלית", noFiles: "עוד לא העלית מסמכים. אפשר לצרף מהשיחה עם הכפתור ➕.",
    open: "פתח", details: "פרטים נוספים", detailsHint: "הצעה, תשלומים ובקשות שינוי.",
    openFull: "פתח את הפרויקט המלא", noProject: "עוד אין פרויקט",
    noProjectText: "נתחיל יחד. זה לוקח כמה דקות ואף דבר לא סופי עד שתאשר.",
    startCta: "בוא נגדיר מה אתה צריך", langLabel: "שפה",
    suggestions: ["מה עוד צריך ממני?", "אפשר לראות איך זה ייראה?", "כמה זמן זה ייקח?"],
    safety: "אני יכול להסביר ולהציע. יניב הוא זה שמאשר מחיר ותאריך.",
  },
  en: {
    workspace: "Your space", intro: "Talk about the project, add documents and see how the process looks.",
    chatTitle: "Project conversation", chatSub: "Tell us what you need — you can attach a document or talk.",
    stages: ["Understanding the need", "Approving the offer", "Building", "Handing it over"],
    files: "Documents you added", noFiles: "No documents yet. Add one from the conversation with the ➕ button.",
    open: "Open", details: "More details", detailsHint: "Offer, payments and change requests.",
    openFull: "Open the full project", noProject: "No project yet",
    noProjectText: "Let's start together. It takes a few minutes and nothing is final until you approve.",
    startCta: "Let's define what you need", langLabel: "Language",
    suggestions: ["What else do you need from me?", "Can I see how it will look?", "How long will it take?"],
    safety: "I can explain and suggest. Yaniv is the one who confirms price and dates.",
  },
} as const;

function stageIndex(status: string) {
  if (["lead_started", "discovery_in_progress", "waiting_for_agency_pricing", "pricing_set", "brief_ready", "scope_ready"].includes(status)) return 0;
  if (["waiting_for_client_approval", "approved_by_client", "waiting_for_payment", "paid_ready_to_start"].includes(status)) return 1;
  if (["assigned_to_supplier", "in_development", "change_requested", "change_priced", "change_approved"].includes(status)) return 2;
  return 3;
}

export function ClientHomePage({ clientId, onNavigate, onRestartWizard }: Props) {
  const { clients, projects } = useAppData();
  const { profile } = useAuth();

  const client = clients.find((c) => c.id === clientId);
  const project = useMemo(
    () => projects.filter((p) => p.clientId === clientId).slice(-1)[0],
    [projects, clientId],
  );

  const [language, setLanguage] = useState<WordingLang>(() => {
    const saved = window.localStorage.getItem("client-portal-language");
    if (saved === "he" || saved === "en") return saved;
    return navigator.language.toLowerCase().startsWith("he") ? "he" : "en";
  });
  const [flow, setFlow] = useState<LiveFlow>({});
  const [solutionKind, setSolutionKind] = useState<SolutionKind | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [showDeliverable, setShowDeliverable] = useState(false);

  const text = copy[language];

  function changeLanguage(next: WordingLang) {
    setLanguage(next);
    window.localStorage.setItem("client-portal-language", next);
  }

  const refreshFiles = useCallback(async () => {
    if (!project) return;
    try { setFiles(await listProjectFiles(project.id)); } catch { /* list stays as-is */ }
  }, [project]);

  useEffect(() => { void refreshFiles(); }, [refreshFiles]);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    void fetchOnboardingState(profile.id)
      .then((state) => {
        const answers = (state?.answers ?? {}) as Record<string, any>;
        if (active && answers._flow) setFlow(answers._flow as LiveFlow);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [profile?.id]);

  useEffect(() => {
    if (!project) return;
    let active = true;
    void getProjectSolutionKind(project.id)
      .then((kind) => {
        if (!active) return;
        setSolutionKind(kind ?? guessSolutionKind(project.name, project.summary));
      })
      .catch(() => setSolutionKind(guessSolutionKind(project.name, project.summary)));
    return () => { active = false; };
  }, [project]);

  if (!project) {
    return (
      <div className="home-screen">
        <EmptyState
          title={text.noProject}
          description={text.noProjectText}
          action={{ label: text.startCta, onClick: onRestartWizard }}
        />
      </div>
    );
  }

  const product = deliverable(solutionKind, language);
  const stage = stageIndex(project.status);

  async function openFile(file: ProjectFile) {
    try { window.open(await getProjectFileLink(file.path), "_blank", "noopener"); } catch { /* ignore */ }
  }

  return (
    <div className="home-screen client-space" dir={language === "he" ? "rtl" : "ltr"}>
      <header className="client-space-head">
        <div>
          <p className="eyebrow">{client?.company ?? text.workspace}</p>
          <h1>{project.name}</h1>
          <p className="home-subtitle">{text.intro}</p>
        </div>
        <div className="client-space-lang" role="group" aria-label={text.langLabel}>
          <button type="button" className={language === "he" ? "primary-button" : "ghost-button"} onClick={() => changeLanguage("he")}>עברית</button>
          <button type="button" className={language === "en" ? "primary-button" : "ghost-button"} onClick={() => changeLanguage("en")}>English</button>
        </div>
      </header>

      <ol className="client-space-stages">
        {text.stages.map((label, index) => (
          <li key={label} className={index <= stage ? "is-done" : ""}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="client-space-grid">
        <div className="client-space-chat">
          <ProjectChat
            projectId={project.id}
            projectName={project.name}
            agent="project_guide"
            title={text.chatTitle}
            subtitle={text.chatSub}
            language={language}
            allowAttachments
            clientSafe
            onFileUploaded={() => void refreshFiles()}
            safetyNotice={text.safety}
            suggestions={[...text.suggestions]}
          />

          <section className="card client-space-files">
            <h2>{text.files}</h2>
            {files.length === 0 ? (
              <p className="form-note">{text.noFiles}</p>
            ) : (
              <ul className="client-file-list">
                {files.map((file) => (
                  <li key={file.id}>
                    <span>{file.title}</span>
                    <button type="button" className="ghost-button" onClick={() => void openFile(file)}>{text.open}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="client-space-side">
          <ProjectFlowCanvas
            flow={flow}
            language={language}
            solutionKind={solutionKind}
            onOpenDeliverable={() => setShowDeliverable(true)}
          />

          {showDeliverable && (
            <section className="card">
              <header className="client-project-flow-head">
                <h2>{product.name}</h2>
                <button type="button" className="ghost-button" onClick={() => setShowDeliverable(false)}>×</button>
              </header>
              <PrototypeStudio
                projectId={project.id}
                projectName={project.name}
                clientMode
                simple
                language={language}
              />
            </section>
          )}

          <SaveShortcutCard />

          <Disclosure title={text.details}>
            <p>{text.detailsHint}</p>
            <button type="button" onClick={() => onNavigate("client-portal")}>{text.openFull}</button>
          </Disclosure>
        </div>
      </div>
    </div>
  );
}
