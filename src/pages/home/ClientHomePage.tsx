import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProjectChat } from "../../components/ProjectChat";
import { PrototypeStudio } from "../../components/prototype/PrototypeStudio";
import { useAppData } from "../../context/AppDataContext";
import { getProjectSolutionKind } from "../../services/prototypeApi";
import { getProjectFileLink, listProjectFiles, type ProjectFile } from "../../services/projectFilesApi";
import { deliverable, guessSolutionKind, type SolutionKind, type WordingLang } from "../../lib/clientWording";

type Props = { clientId?: string; initialProjectId?: string; onRestartWizard: () => void };

const copy = {
  he: {
    workspace: "המרחב שלך",
    intro: "כאן ממשיכים את השיחה ורואים מיד את מה שאנחנו בונים עבורך.",
    chatTitle: "השיחה על הפרויקט",
    chatSub: "אפשר לשאול, לדייק ולצרף מסמך. כל מה שנכתב נשמר בפרויקט שלך.",
    stages: ["מבינים מה צריך", "מאשרים את ההצעה", "בונים", "מוסרים לך"],
    stageHelp: [
      "אנחנו מסכמים את הצורך ומוודאים שלא חסר מידע חשוב.",
      "ההצעה וההחלטות מחכות לאישור לפני שמתקדמים.",
      "העבודה מתקדמת לפי מה שסיכמנו.",
      "הפרויקט מוכן למסירה ולבדיקה שלך.",
    ],
    currentStage: "איפה אנחנו עכשיו",
    previewEyebrow: "מה בונים עבורך",
    previewTitle: "התצוגה של הפרויקט שלך",
    previewHelp: "הגרסה האחרונה ששיתפנו מופיעה כאן מיד. אפשר לעבור בין המסכים, לאשר או לשלוח הערות.",
    files: "המסמכים שהעלית",
    noFiles: "עוד לא העלית מסמכים. אפשר לצרף קובץ מתוך השיחה באמצעות הכפתור ➕.",
    open: "פתח",
    noProject: "עוד אין פרויקט",
    noProjectText: "נתחיל יחד. שום דבר לא הופך לפרויקט פעיל עד שהסוכנות מאשרת את המעבר.",
    startCta: "בוא נגדיר מה צריך",
    langLabel: "שפה",
    projectLabel: "הפרויקט שלך",
    suggestions: ["מה עוד צריך ממני?", "אפשר לראות את הגרסה האחרונה?", "מה השלב הבא?"],
    safety: "אני יכול להסביר ולהציע. יניב הוא זה שמאשר מחיר, תשלום ותאריך.",
  },
  en: {
    workspace: "Your space",
    intro: "Continue the conversation and immediately see what we are building for you.",
    chatTitle: "Project conversation",
    chatSub: "Ask questions, clarify details or attach a document. Everything stays with your project.",
    stages: ["Understanding the need", "Approving the offer", "Building", "Handing it over"],
    stageHelp: [
      "We are confirming the need and checking that no important details are missing.",
      "The proposal and decisions are waiting for approval before work continues.",
      "Work is moving ahead according to what we agreed.",
      "The project is ready for your review and handoff.",
    ],
    currentStage: "Where we are now",
    previewEyebrow: "What we are building",
    previewTitle: "Your project preview",
    previewHelp: "The latest version shared with you appears here automatically. Explore it, approve it or send comments.",
    files: "Documents you added",
    noFiles: "No documents yet. Attach one from the conversation using the ➕ button.",
    open: "Open",
    noProject: "No project yet",
    noProjectText: "Let's start together. Nothing becomes an active project until the agency approves the move.",
    startCta: "Let's define what you need",
    langLabel: "Language",
    projectLabel: "Your project",
    suggestions: ["What else do you need from me?", "Can I see the latest version?", "What is the next step?"],
    safety: "I can explain and suggest. Yaniv confirms price, payment and dates.",
  },
} as const;

function stageIndex(status: string) {
  if (["lead_started", "discovery_in_progress", "waiting_for_agency_pricing", "pricing_set", "brief_ready", "scope_ready"].includes(status)) return 0;
  if (["waiting_for_client_approval", "approved_by_client", "waiting_for_payment", "paid_ready_to_start"].includes(status)) return 1;
  if (["assigned_to_supplier", "in_development", "change_requested", "change_priced", "change_approved"].includes(status)) return 2;
  return 3;
}

export function ClientHomePage({ clientId, initialProjectId, onRestartWizard }: Props) {
  const { clients, projects, liveUpdates } = useAppData();
  const client = clients.find((item) => item.id === clientId);
  const clientProjects = useMemo(
    () => projects
      .filter((item) => item.clientId === clientId)
      .slice()
      .sort((a, b) => b.updatedDate.localeCompare(a.updatedDate)),
    [projects, clientId],
  );
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? "");
  const project = useMemo(
    () => clientProjects.find((item) => item.id === selectedProjectId) ?? clientProjects[0],
    [clientProjects, selectedProjectId],
  );

  const [language, setLanguage] = useState<WordingLang>(() => {
    const saved = window.localStorage.getItem("client-portal-language");
    if (saved === "he" || saved === "en") return saved;
    return navigator.language.toLowerCase().startsWith("he") ? "he" : "en";
  });
  const [solutionKind, setSolutionKind] = useState<SolutionKind | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const text = copy[language];

  useEffect(() => {
    if (initialProjectId && clientProjects.some((item) => item.id === initialProjectId)) {
      setSelectedProjectId(initialProjectId);
      return;
    }
    if (selectedProjectId && !clientProjects.some((item) => item.id === selectedProjectId)) {
      setSelectedProjectId(clientProjects[0]?.id ?? "");
    }
  }, [clientProjects, initialProjectId, selectedProjectId]);

  function changeLanguage(next: WordingLang) {
    setLanguage(next);
    window.localStorage.setItem("client-portal-language", next);
  }

  const refreshFiles = useCallback(async () => {
    if (!project) return;
    try { setFiles(await listProjectFiles(project.id)); } catch { /* keep the current list */ }
  }, [project]);

  useEffect(() => { void refreshFiles(); }, [refreshFiles]);

  useEffect(() => {
    if (!project) { setSolutionKind(null); return; }
    let active = true;
    void getProjectSolutionKind(project.id)
      .then((kind) => {
        if (active) setSolutionKind(kind ?? guessSolutionKind(project.name, project.summary));
      })
      .catch(() => {
        if (active) setSolutionKind(guessSolutionKind(project.name, project.summary));
      });
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
  const refreshToken = liveUpdates[project.id];

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

      {clientProjects.length > 1 ? (
        <label className="client-project-picker">
          <span>{text.projectLabel}</span>
          <select value={project.id} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {clientProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}

      <section className="card client-current-stage" aria-label={text.currentStage}>
        <span className="client-current-stage-number">{stage + 1}</span>
        <div>
          <p className="eyebrow">{text.currentStage}</p>
          <h2>{text.stages[stage]}</h2>
          <p>{text.stageHelp[stage]}</p>
        </div>
      </section>

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

        <aside className="client-space-preview" aria-label={text.previewTitle}>
          <section className="card client-preview-intro">
            <p className="eyebrow">{text.previewEyebrow}</p>
            <h2>{text.previewTitle}</h2>
            <p>{text.previewHelp}</p>
          </section>
          <PrototypeStudio
            projectId={project.id}
            projectName={project.name}
            readOnly
            clientMode
            simple
            language={language}
            refreshToken={refreshToken}
            allowClientLivePreview
          />
        </aside>
      </div>
    </div>
  );
}
