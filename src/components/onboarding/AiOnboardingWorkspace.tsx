import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { submitSupplierOnboarding } from "../../services/onboardingApi";
import {
  loadOnboardingConversation,
  patchOnboardingAnswers,
  sendOnboardingMessage,
  submitOnboardingForReview,
  type LiveDocument,
  type LiveFlow,
  type LiveSupplierProfile,
  type LeadConversationStatus,
  type OnboardingAnswers,
  type OnboardingIdentity,
  type OnboardingTurn,
} from "../../services/onboardingChatApi";
import { LiveFlowDiagram } from "./LiveFlowDiagram";
import { ClientWorkspaceIdentity } from "../client/ClientWorkspaceIdentity";

type Props = { role: "client" | "supplier"; onDone: (projectId?: string) => void; onUseForm: () => void };
type Lang = "he" | "en";

const COPY = {
  he: {
    projectGuide: "מלווה הפרויקט שלכם",
    supplierGuide: "הצטרפות לרשת הספקים",
    clientTitle: "בואו נבנה יחד את הפרויקט שלכם",
    supplierTitle: "בואו נכיר ונבנה יחד את הפרופיל שלכם",
    clientIntro: "זו שיחה קצרה ונעימה — לא שאלון. אתם מספרים בקצב שלכם, ואני מארגן את הדברים לאפיון ברור שממנו נוכל להתקדם ל־MVP.",
    supplierIntro: "זו שיחה קצרה ונעימה. אתם מספרים על הניסיון והזמינות שלכם, ואני מארגן את הפרטים לפרופיל מסודר.",
    clientOpener: "היי, נעים מאוד 👋 אני כאן כדי להבין את העסק ואת הרעיון שלכם. אין צורך לנסח משהו רשמי — במשפט או שניים, מה העסק עושה ומה הייתם רוצים לשפר או לבנות?",
    supplierOpener: "היי, נעים מאוד 👋 נתחיל בפשטות: באיזה סוג עבודה אתם עוסקים ומה אתם הכי אוהבים לעשות?",
    progressStart: "רק מתחילים",
    progressDirection: "מגבשים את הכיוון",
    progressDetails: "מחברים את הפרטים",
    progressReady: "האפיון מוכן לבדיקה",
    progressAria: "התקדמות באפיון",
    chatTitle: "השיחה שלנו",
    chatHint: "אפשר לכתוב בחופשיות. אשאל בכל פעם רק שאלה אחת.",
    opening: "פותח את השיחה…",
    thinking: "רגע, אני מארגן את מה שכתבתם…",
    placeholder: "כתבו כאן כאילו אנחנו יושבים יחד…",
    send: "שליחה",
    sendAria: "שליחת ההודעה",
    journeyTitle: "מה יקרה תוך כדי השיחה?",
    journeyOneTitle: "מכירים את הצורך",
    journeyOneText: "נדבר על העסק, המטרה והאנשים שישתמשו במוצר.",
    journeyTwoTitle: "נבנה אפיון ברור",
    journeyTwoText: "הסיכום נבנה אוטומטית ורק מידע שכבר סיפרתם יופיע בו.",
    journeyThreeTitle: "מתקדמים ל־MVP",
    journeyThreeText: "בסיום הסוכנות תבדוק את האפיון ותכין כיוון ראשוני למוצר.",
    summaryTitle: "הסיכום שנבנה מהשיחה",
    summaryHint: "כאן מופיע רק מה שכבר סיכמנו. אפשר לפתוח, לקרוא ולתקן.",
    detailsCount: "פרטים שסוכמו",
    edit: "תיקון",
    save: "שמירה",
    cancel: "ביטול",
    flowTitle: "זרימת העבודה שזיהינו",
    readyTitle: "יש לנו מספיק כדי להתחיל",
    readyText: "עברו על הסיכום אם תרצו, ואז שלחו אותו לסוכנות. תמיד אפשר לדייק אותו יחד בהמשך.",
    submitClient: "שליחה ליניב לבדיקה",
    submitSupplier: "שליחת הפרופיל",
    submitting: "שולח…",
    classicPrefix: "מעדיפים למלא שאלון מסודר?",
    classicAction: "מעבר לטופס הקלאסי",
    privacy: "המידע נשמר בסביבת הפרויקט שלכם ומשמש רק כדי להתקדם בעבודה.",
    sections: {
      summary: "סיכום הפרויקט",
      businessGoal: "המטרה העסקית",
      currentSituation: "המצב היום",
      desiredOutcome: "התוצאה הרצויה",
      requirements: "צרכים מרכזיים",
      integrations: "מערכות וחיבורים",
      workflow: "דרך העבודה",
      phases: "שלבי הפרויקט",
      openQuestions: "שאלות פתוחות",
      assumptions: "הנחות",
      risks: "נקודות שצריך לבדוק",
      exclusions: "מחוץ להיקף כרגע",
      timeline: "לוח זמנים מבוקש",
      requestedDate: "מועד רצוי",
      background: "רקע מקצועי",
      skills: "יכולות",
      tools: "טכנולוגיות וכלים",
      specialisations: "התמחויות",
      languages: "שפות",
      experienceYears: "שנות ניסיון",
      availabilityHours: "זמינות שבועית",
      timezone: "אזור זמן",
      workingHours: "שעות עבודה",
      communication: "תקשורת מועדפת",
      hourlyRate: "תעריף שעתי",
      currency: "מטבע",
      fixedPricePreference: "העדפת מחיר קבוע",
      typicalProjectSize: "גודל פרויקט טיפוסי",
      portfolioLinks: "תיק עבודות",
      certificates: "הסמכות",
    },
  },
  en: {
    projectGuide: "Your project guide",
    supplierGuide: "Supplier onboarding",
    clientTitle: "Let’s build your project together",
    supplierTitle: "Let’s get to know you and build your profile",
    clientIntro: "This is a relaxed conversation, not a questionnaire. Share things in your own words and I’ll shape them into a clear brief we can use to move toward an MVP.",
    supplierIntro: "This is a short, friendly conversation. Tell me about your experience and availability and I’ll organise it into a clear profile.",
    clientOpener: "Hi, great to meet you 👋 I’m here to understand your business and your idea. Nothing formal is needed — in a sentence or two, what does your business do and what would you like to improve or build?",
    supplierOpener: "Hi, great to meet you 👋 Let’s start simply: what kind of work do you do, and what do you most enjoy working on?",
    progressStart: "Just getting started",
    progressDirection: "Shaping the direction",
    progressDetails: "Connecting the details",
    progressReady: "Your brief is ready to review",
    progressAria: "Planning progress",
    chatTitle: "Our conversation",
    chatHint: "Write naturally. I’ll ask just one question at a time.",
    opening: "Opening your conversation…",
    thinking: "One moment — I’m organising what you shared…",
    placeholder: "Write here as if we were sitting together…",
    send: "Send",
    sendAria: "Send message",
    journeyTitle: "What happens as we talk?",
    journeyOneTitle: "Understand the need",
    journeyOneText: "We’ll talk about the business, the goal and the people who will use the product.",
    journeyTwoTitle: "Shape a clear brief",
    journeyTwoText: "The summary builds gradually and only shows information you have already shared.",
    journeyThreeTitle: "Move toward an MVP",
    journeyThreeText: "When we finish, the agency will review the brief and prepare an initial product direction.",
    summaryTitle: "The summary we’re building together",
    summaryHint: "Only things we have already covered appear here. Open it whenever you want to review or correct them.",
    detailsCount: "details captured",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    flowTitle: "The workflow we identified",
    readyTitle: "We have enough to get started",
    readyText: "Review the summary if you like, then send it to the agency. We can always refine it together later.",
    submitClient: "Send to Yaniv for review",
    submitSupplier: "Send my profile",
    submitting: "Sending…",
    classicPrefix: "Would you rather complete a structured questionnaire?",
    classicAction: "Use the classic form",
    privacy: "Your information stays in your project workspace and is only used to move the work forward.",
    sections: {
      summary: "Project summary",
      businessGoal: "Business goal",
      currentSituation: "Current situation",
      desiredOutcome: "Desired outcome",
      requirements: "Key needs",
      integrations: "Systems and integrations",
      workflow: "Workflow",
      phases: "Project phases",
      openQuestions: "Open questions",
      assumptions: "Assumptions",
      risks: "Things to check",
      exclusions: "Out of scope for now",
      timeline: "Requested timeline",
      requestedDate: "Preferred date",
      background: "Professional background",
      skills: "Skills",
      tools: "Technologies and tools",
      specialisations: "Specialisations",
      languages: "Languages",
      experienceYears: "Years of experience",
      availabilityHours: "Weekly availability",
      timezone: "Timezone",
      workingHours: "Working hours",
      communication: "Preferred communication",
      hourlyRate: "Hourly rate",
      currency: "Currency",
      fixedPricePreference: "Fixed-price preference",
      typicalProjectSize: "Typical project size",
      portfolioLinks: "Portfolio links",
      certificates: "Certificates",
    },
  },
} as const;

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => String(item).trim());
  if (typeof value === "number") return value > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function preferredLanguage(metadataLanguage?: unknown): Lang {
  if (metadataLanguage === "he" || metadataLanguage === "en") return metadataLanguage;
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("he") ? "he" : "en";
}

export function AiOnboardingWorkspace({ role, onDone, onUseForm }: Props) {
  const { profile, user } = useAuth();
  const { clients } = useAppData();

  const [lang, setLang] = useState<Lang>(() => preferredLanguage(user?.user_metadata?.preferred_language));
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [accountIdentity, setAccountIdentity] = useState<OnboardingIdentity | undefined>();
  const [turns, setTurns] = useState<OnboardingTurn[]>([]);
  const [conversationStatus, setConversationStatus] = useState<LeadConversationStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const promotedProjectRef = useRef<string | null>(null);

  const isClient = role === "client";
  const t = COPY[lang];
  const client = isClient ? clients.find((item) => item.id === profile?.clientId) : undefined;
  const clientName = accountIdentity?.clientName || client?.name || profile?.fullName || profile?.email || "";
  const company = accountIdentity?.businessName || client?.company || clientName;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async (initial = false) => {
      try {
        const state = await loadOnboardingConversation();
        if (cancelled) return;
        setAnswers(state.answers ?? {});
        setAccountIdentity(state.identity);
        setTurns(state.transcript ?? []);
        setConversationStatus(state.conversationStatus ?? null);
        setStatusMessage(state.statusMessage ?? "");
        if (state.conversationStatus === "promoted" && state.projectId && promotedProjectRef.current !== state.projectId) {
          promotedProjectRef.current = state.projectId;
          onDone(state.projectId);
        }
      } catch (cause) {
        if (!cancelled && initial) setError(cause instanceof Error ? cause.message : "Could not open your assistant.");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };
    void load(true);
    if (isClient) timer = window.setInterval(() => void load(false), 8000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
    // The onboarding gate owns navigation; polling follows the account-bound
    // lead until the agency promotes it into a project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, sending]);

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    setTurns((prev) => [...prev, { role: "user", body: message, at: new Date().toISOString() }]);
    try {
      const result = await sendOnboardingMessage(message);
      setAnswers(result.answers ?? {});
      setAccountIdentity(result.identity);
      setTurns(result.transcript ?? []);
      setConversationStatus(result.conversationStatus ?? null);
      setStatusMessage(result.statusMessage ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant could not reply.");
    } finally {
      setSending(false);
    }
  }, [draft, sending]);

  const doc = (answers._document ?? {}) as LiveDocument;
  const supplierProfile = (answers._profile ?? {}) as LiveSupplierProfile;
  const flow = (answers._flow ?? {}) as LiveFlow;
  const confidence = Math.max(0, Math.min(100, Number(answers._confidence ?? 0)));
  const ready = Boolean(answers._readyToSubmit);
  const conversationOpen = !isClient || conversationStatus === null || conversationStatus === "active" || conversationStatus === "invited";

  async function saveEdit(path: string) {
    const value = editValue;
    const nextDoc: Record<string, any> = isClient ? { ...doc } : { ...supplierProfile };
    const current = nextDoc[path];
    nextDoc[path] = Array.isArray(current)
      ? value.split("\n").map((line) => line.trim()).filter(Boolean)
      : typeof current === "number"
        ? Number(value) || 0
        : value;
    const patch = isClient ? { _document: nextDoc } : { _profile: nextDoc };
    setEditing(null);
    try {
      const result = await patchOnboardingAnswers(patch);
      setAnswers(result.answers ?? {});
      setAccountIdentity(result.identity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your edit.");
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const flat = Object.fromEntries(Object.entries(answers).filter(([key]) => !key.startsWith("_")));
      if (isClient) {
        const result = await submitOnboardingForReview({
          ...answers,
          ...flat,
          project_name: (flat as any).project_name || doc.summary?.slice(0, 60) || "New project",
          goal: (flat as any).goal || doc.businessGoal || doc.desiredOutcome || "",
          current_process: (flat as any).current_process || doc.currentSituation || "",
          existing_systems: (flat as any).existing_systems || asList(doc.integrations).join(", "),
          pain_points: (flat as any).pain_points || asList(doc.risks).join(", "),
          capabilities: (flat as any).capabilities || asList(doc.requirements).join(" | "),
          requested_date: (flat as any).requested_date || doc.requestedDate || "",
        });
        setAnswers(result.answers ?? answers);
        setTurns(result.transcript ?? turns);
        setConversationStatus(result.conversationStatus ?? "awaiting_review");
        setStatusMessage(result.statusMessage ?? "");
        return;
      } else {
        await submitSupplierOnboarding({
          ...flat,
          name: (flat as any).name || profile?.fullName || "",
          email: (flat as any).email || profile?.email || "",
          skills: asList((flat as any).skills).length ? asList((flat as any).skills) : asList(supplierProfile.skills),
          tools: asList((flat as any).tools).length ? asList((flat as any).tools) : asList(supplierProfile.tools),
          portfolio_links: asList((flat as any).portfolio_links).length
            ? asList((flat as any).portfolio_links)
            : asList(supplierProfile.portfolioLinks),
          hourly_rate: (flat as any).hourly_rate || String(supplierProfile.hourlyRate ?? ""),
          currency: (flat as any).currency || supplierProfile.currency || "GBP",
          weekly_availability: (flat as any).weekly_availability || String(supplierProfile.availabilityHours ?? ""),
          timezone: (flat as any).timezone || supplierProfile.timezone || "",
          communication: (flat as any).communication || supplierProfile.communication || "",
        });
      }
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  const sections = useMemo(() => {
    if (isClient) {
      return [
        { key: "summary", label: t.sections.summary, value: doc.summary },
        { key: "businessGoal", label: t.sections.businessGoal, value: doc.businessGoal },
        { key: "currentSituation", label: t.sections.currentSituation, value: doc.currentSituation },
        { key: "desiredOutcome", label: t.sections.desiredOutcome, value: doc.desiredOutcome },
        { key: "requirements", label: t.sections.requirements, value: doc.requirements },
        { key: "integrations", label: t.sections.integrations, value: doc.integrations },
        { key: "workflow", label: t.sections.workflow, value: doc.workflow },
        { key: "phases", label: t.sections.phases, value: doc.phases },
        { key: "openQuestions", label: t.sections.openQuestions, value: doc.openQuestions },
        { key: "assumptions", label: t.sections.assumptions, value: doc.assumptions },
        { key: "risks", label: t.sections.risks, value: doc.risks },
        { key: "exclusions", label: t.sections.exclusions, value: doc.exclusions },
        { key: "timeline", label: t.sections.timeline, value: doc.timeline },
        { key: "requestedDate", label: t.sections.requestedDate, value: doc.requestedDate },
      ];
    }
    return [
      { key: "background", label: t.sections.background, value: supplierProfile.background },
      { key: "skills", label: t.sections.skills, value: supplierProfile.skills },
      { key: "tools", label: t.sections.tools, value: supplierProfile.tools },
      { key: "specialisations", label: t.sections.specialisations, value: supplierProfile.specialisations },
      { key: "languages", label: t.sections.languages, value: supplierProfile.languages },
      { key: "experienceYears", label: t.sections.experienceYears, value: supplierProfile.experienceYears },
      { key: "availabilityHours", label: t.sections.availabilityHours, value: supplierProfile.availabilityHours },
      { key: "timezone", label: t.sections.timezone, value: supplierProfile.timezone },
      { key: "workingHours", label: t.sections.workingHours, value: supplierProfile.workingHours },
      { key: "communication", label: t.sections.communication, value: supplierProfile.communication },
      { key: "hourlyRate", label: t.sections.hourlyRate, value: supplierProfile.hourlyRate },
      { key: "currency", label: t.sections.currency, value: supplierProfile.currency },
      { key: "fixedPricePreference", label: t.sections.fixedPricePreference, value: supplierProfile.fixedPricePreference },
      { key: "typicalProjectSize", label: t.sections.typicalProjectSize, value: supplierProfile.typicalProjectSize },
      { key: "portfolioLinks", label: t.sections.portfolioLinks, value: supplierProfile.portfolioLinks },
      { key: "certificates", label: t.sections.certificates, value: supplierProfile.certificates },
    ];
  }, [isClient, doc, supplierProfile, t]);

  const visibleSections = sections.filter((section) => hasValue(section.value));
  const hasFlow = isClient && Boolean(flow.nodes?.length);
  const progressLabel = ready
    ? t.progressReady
    : confidence < 25
      ? t.progressStart
      : confidence < 60
        ? t.progressDirection
        : t.progressDetails;
  const projectName = typeof answers.project_name === "string" ? answers.project_name.trim() : "";
  const personalisedTitle = isClient && company
    ? lang === "he"
      ? `בואו נבנה יחד את הפרויקט של ${company}`
      : `Let’s build ${company}'s project together`
    : isClient ? t.clientTitle : t.supplierTitle;
  const personalisedOpener = isClient && company
    ? lang === "he"
      ? `היי, נעים מאוד 👋 אני רואה שנכנסתם מטעם ${company}. כדי שאכיר את הפעילות שלכם, ספרו לי במשפט או שניים מה העסק עושה ומה הייתם רוצים לשפר או לבנות.`
      : `Hi, great to meet you 👋 I can see you’re joining from ${company}. In a sentence or two, what does the business do and what would you like to improve or build?`
    : isClient ? t.clientOpener : t.supplierOpener;

  const leadStatusCopy = isClient && conversationStatus && !conversationOpen ? {
    awaiting_review: lang === "he"
      ? { title: "האפיון אצל יניב לבדיקה", text: "השיחה והסיכום נשמרו. עדיין לא נפתח פרויקט; יניב יבדוק ויעדכן אתכם כאן." }
      : { title: "Your brief is with Yaniv", text: "The conversation and summary are saved. No project exists yet; Yaniv will review it and update you here." },
    paused: lang === "he"
      ? { title: "השיחה הושהתה זמנית", text: statusMessage || "יניב עצר זמנית את השיחה. ההיסטוריה נשמרת כאן." }
      : { title: "Conversation temporarily paused", text: statusMessage || "Yaniv has paused the conversation. Your history remains saved here." },
    disqualified: lang === "he"
      ? { title: "התהליך נסגר בשלב זה", text: "השיחה נשמרה, אך לא נפתח ממנה פרויקט." }
      : { title: "This process is closed", text: "The conversation remains saved, but no project was created from it." },
    promoted: lang === "he"
      ? { title: "הפרויקט נפתח", text: "מעבירים אתכם עכשיו למרחב הפרויקט האישי שלכם." }
      : { title: "Your project is ready", text: "We are taking you to your personal project workspace now." },
    invited: null,
    active: null,
  }[conversationStatus] : null;

  return (
    <div className="ai-onboarding" dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
      <header className="ai-onboarding-head">
        <div className="ai-onboarding-heading">
          <p className="eyebrow">{isClient ? t.projectGuide : t.supplierGuide}</p>
          <h1>{personalisedTitle}</h1>
          <p>{isClient ? t.clientIntro : t.supplierIntro}</p>
        </div>
        <div className="ai-language-switch" aria-label="Language">
          <button type="button" className={lang === "he" ? "active" : ""} onClick={() => setLang("he")}>עברית</button>
          <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>English</button>
        </div>
      </header>

      {isClient ? (
        <ClientWorkspaceIdentity
          language={lang}
          clientName={clientName}
          company={company}
          email={profile?.email || ""}
          projectName={projectName}
          projectPending
        />
      ) : null}

      <div className="ai-onboarding-progress" aria-label={t.progressAria}>
        <span>{progressLabel}</span>
        <div><i style={{ width: `${ready ? 100 : confidence}%` }} /></div>
      </div>

      {error ? <p className="form-error ai-onboarding-error">{error}</p> : null}

      {leadStatusCopy ? (
        <section className={`ai-lead-status ${conversationStatus}`} role="status">
          <strong>{leadStatusCopy.title}</strong>
          <p>{leadStatusCopy.text}</p>
        </section>
      ) : null}

      <main className="ai-onboarding-main">
        <section className="ai-onboarding-chat" aria-label={t.chatTitle}>
          <div className="ai-chat-head">
            <div className="ai-guide-avatar" aria-hidden="true">✦</div>
            <div>
              <h2>{t.chatTitle}</h2>
              <p>{t.chatHint}</p>
            </div>
          </div>

          <div className="ai-chat-log" ref={listRef} aria-live="polite">
            <div className="ai-chat-row assistant">
              <span className="ai-mini-avatar" aria-hidden="true">✦</span>
              <div className="ai-bubble assistant">{personalisedOpener}</div>
            </div>
            {loading ? <p className="ai-chat-status">{t.opening}</p> : null}
            {turns.map((turn, index) => (
              <div key={`${turn.at}-${index}`} className={`ai-chat-row ${turn.role}`}>
                {turn.role === "assistant" ? <span className="ai-mini-avatar" aria-hidden="true">✦</span> : null}
                {turn.role === "agency" ? <span className="ai-mini-avatar agency" aria-hidden="true">י</span> : null}
                <div className={`ai-bubble ${turn.role}`}>{turn.body}</div>
              </div>
            ))}
            {sending ? (
              <div className="ai-chat-row assistant">
                <span className="ai-mini-avatar" aria-hidden="true">✦</span>
                <div className="ai-bubble assistant muted">{t.thinking}</div>
              </div>
            ) : null}
          </div>

          <form className="ai-chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t.placeholder}
              rows={3}
              disabled={loading || !conversationOpen}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
              }}
            />
            <button type="submit" className="primary-button ai-send-button" disabled={loading || sending || !conversationOpen || !draft.trim()} aria-label={t.sendAria}>
              <span>{t.send}</span>
              <span aria-hidden="true">{lang === "he" ? "←" : "→"}</span>
            </button>
          </form>
        </section>

        <aside className="ai-onboarding-journey">
          <h2>{t.journeyTitle}</h2>
          <ol>
            <li>
              <span>1</span>
              <div><strong>{t.journeyOneTitle}</strong><p>{t.journeyOneText}</p></div>
            </li>
            <li>
              <span>2</span>
              <div><strong>{t.journeyTwoTitle}</strong><p>{t.journeyTwoText}</p></div>
            </li>
            {isClient ? (
              <li>
                <span>3</span>
                <div><strong>{t.journeyThreeTitle}</strong><p>{t.journeyThreeText}</p></div>
              </li>
            ) : null}
          </ol>
        </aside>
      </main>

      {visibleSections.length || hasFlow ? (
        <details className="ai-onboarding-summary">
          <summary>
            <span>
              <strong>{t.summaryTitle}</strong>
              <small>{t.summaryHint}</small>
            </span>
            <span className="ai-summary-count">{visibleSections.length} {t.detailsCount}</span>
          </summary>
          <div className="ai-summary-content">
            <div className="ai-summary-grid">
              {visibleSections.map((section) => {
                const list = Array.isArray(section.value) ? section.value : null;
                const text = list ? list.join("\n") : String(section.value ?? "");
                return (
                  <article className="ai-doc-section" key={section.key}>
                    <div className="ai-doc-section-head">
                      <span className="ai-doc-label">{section.label}</span>
                      {editing === section.key ? null : (
                        <button
                          type="button"
                          className="ai-text-button"
                          onClick={() => { setEditing(section.key); setEditValue(text); }}
                        >
                          {t.edit}
                        </button>
                      )}
                    </div>
                    {editing === section.key ? (
                      <div className="ai-doc-edit">
                        <textarea rows={list ? 4 : 2} value={editValue} onChange={(event) => setEditValue(event.target.value)} />
                        <div className="table-actions">
                          <button type="button" className="primary-button" onClick={() => void saveEdit(section.key)}>{t.save}</button>
                          <button type="button" onClick={() => setEditing(null)}>{t.cancel}</button>
                        </div>
                      </div>
                    ) : list ? (
                      <ul className="ai-doc-list">{list.map((item, index) => <li key={index}>{item}</li>)}</ul>
                    ) : (
                      <p>{text}</p>
                    )}
                  </article>
                );
              })}
            </div>
            {hasFlow ? (
              <div className="ai-summary-flow">
                <h3>{t.flowTitle}</h3>
                <LiveFlowDiagram flow={flow} />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {ready && conversationOpen ? (
        <section className="ai-onboarding-ready">
          <div>
            <h2>{t.readyTitle}</h2>
            <p>{t.readyText}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? t.submitting : isClient ? t.submitClient : t.submitSupplier}
          </button>
        </section>
      ) : null}

      <footer className="ai-onboarding-footer">
        <p>{t.classicPrefix} <button type="button" className="ai-text-button" onClick={onUseForm}>{t.classicAction}</button></p>
        <small>{t.privacy}</small>
      </footer>
    </div>
  );
}
