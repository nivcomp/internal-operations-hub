import { findClientGlossaryTerms } from "./clientGlossary";
import type { WordingLang } from "./clientWording";

export type ClientProcessNode = {
  id: string;
  label: string;
  kind?: string;
  status?: string;
  description?: string;
  purpose?: string;
  input?: string;
  output?: string;
  technicalDetails?: string;
};

export type ProcessCategory = "human" | "automation" | "ai" | "system" | "decision" | "message" | "meeting";
export type ProcessStatus = "not_started" | "waiting" | "in_progress" | "completed" | "decision_required";

export type ProcessExplanation = {
  title: string;
  what: string;
  why: string;
  input: string;
  output: string;
  who: string;
  category: ProcessCategory;
  status: ProcessStatus | null;
  technicalDetails?: string;
};

export const PROCESS_CATEGORY_META: Record<ProcessCategory, { icon: string; he: string; en: string }> = {
  human: { icon: "👤", he: "פעולה אנושית", en: "Human action" },
  automation: { icon: "⚡", he: "אוטומציה", en: "Automation" },
  ai: { icon: "🤖", he: "פעולת AI", en: "AI action" },
  system: { icon: "⚙️", he: "מערכת חיצונית", en: "External system" },
  decision: { icon: "✅", he: "החלטה / אישור", en: "Decision / approval" },
  message: { icon: "💬", he: "הודעה", en: "Message" },
  meeting: { icon: "📅", he: "פגישה", en: "Meeting" },
};

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, { he: string; en: string }> = {
  not_started: { he: "טרם התחיל", en: "Not started" },
  waiting: { he: "ממתין", en: "Waiting" },
  in_progress: { he: "בתהליך", en: "In progress" },
  completed: { he: "הושלם", en: "Completed" },
  decision_required: { he: "דורש החלטה", en: "Decision required" },
};

const PRIVATE_TEXT_PATTERNS = [
  /supplier\s*(cost|rate)/i,
  /hourly\s*cost/i,
  /agency\s*margin/i,
  /internal\s*(notes|instructions)/i,
  /עלות\s*ספק/i,
  /תעריף\s*ספק/i,
  /מרווח\s*סוכנות/i,
  /הערות\s*פנימיות/i,
];

export function isClientSafeProcessText(value: string | undefined | null) {
  return Boolean(value?.trim() && !PRIVATE_TEXT_PATTERNS.some((pattern) => pattern.test(value)));
}

export function categorizeClientProcessNode(node: ClientProcessNode): ProcessCategory {
  const value = `${node.label} ${node.kind ?? ""}`.toLocaleLowerCase();
  if (/פגישה|meeting|appointment|calendar|יומן/.test(value)) return "meeting";
  if (/openai|chatgpt|\bai\b|בינה מלאכותית|ai agent|סוכן ai/.test(value)) return "ai";
  if (node.kind === "approval" || /סינון|החלט|אישור|decision|approval|filter|qualif/.test(value)) return "decision";
  if (node.kind === "user" || /ידני|manual|נציג|טלפון/.test(value)) return "human";
  if (node.kind === "automation" || /make(?:\.com)?|zapier|n8n|אוטומצי|automation|bot|בוט/.test(value)) return "automation";
  if (/הודע|message|whatsapp|וואטסאפ|gmail|e-?mail|מייל/.test(value)) return "message";
  return "system";
}

export function getClientProcessStatus(value?: string): ProcessStatus | null {
  if (!value) return null;
  const status = value.trim().toLocaleLowerCase().replace(/[\s-]+/g, "_");
  if (["not_started", "new", "todo"].includes(status)) return "not_started";
  if (["waiting", "pending", "on_hold"].includes(status)) return "waiting";
  if (["in_progress", "active", "working"].includes(status)) return "in_progress";
  if (["completed", "complete", "done"].includes(status)) return "completed";
  if (["decision_required", "requires_decision", "needs_approval", "approval_required"].includes(status)) return "decision_required";
  return null;
}

const genericCopy: Record<WordingLang, Record<ProcessCategory, { what: string; why: string; who: string }>> = {
  he: {
    human: { what: "אדם מבצע כאן פעולה ידנית כחלק מהתהליך.", why: "כדי להשאיר לאדם את הפעולות שבהן נדרש קשר אישי או שיקול דעת.", who: "עובד / נציג" },
    automation: { what: "המערכת מבצעת כאן פעולה אוטומטית ומעבירה את התהליך קדימה.", why: "כדי לחסוך עבודה ידנית, לקצר זמן תגובה ולצמצם טעויות.", who: "האוטומציה" },
    ai: { what: "ה-AI מעבד כאן מידע ומבצע את המשימה שהוגדרה לו.", why: "כדי לטפל במידע במהירות ובצורה עקבית.", who: "AI" },
    system: { what: "מערכת מקבלת, שומרת או מעבירה כאן מידע.", why: "כדי שהמידע יהיה במקום הנכון וזמין לשלב הבא.", who: "המערכת החיצונית" },
    decision: { what: "המידע נבדק כאן כדי להחליט איך התהליך ממשיך.", why: "כדי שכל פנייה תמשיך למסלול שמתאים לה.", who: "עובד או כלל אוטומטי, לפי הגדרת השלב" },
    message: { what: "נשלחת או מתקבלת כאן הודעה כחלק מהטיפול בפנייה.", why: "כדי שהלקוח או הצוות יקבלו את המידע הנכון בזמן הנכון.", who: "עובד או מערכת הודעות" },
    meeting: { what: "קובעים או מקיימים כאן פגישה כדי להתקדם.", why: "כדי ליצור נקודת קשר ברורה להבנה, החלטה או המשך טיפול.", who: "הלקוח והנציג / העובד" },
  },
  en: {
    human: { what: "A person performs a manual action here.", why: "To keep human judgment and personal contact where they matter.", who: "Employee / representative" },
    automation: { what: "The system performs an automated action here and moves the process forward.", why: "To reduce manual work, response time and errors.", who: "Automation" },
    ai: { what: "AI processes information here and performs its defined task.", why: "To process information quickly and consistently.", who: "AI" },
    system: { what: "A system receives, stores or transfers information here.", why: "To keep information in the right place and ready for the next step.", who: "External system" },
    decision: { what: "Information is checked here to decide how the process continues.", why: "So each enquiry continues through the right route.", who: "Employee or automated rule" },
    message: { what: "A message is sent or received here.", why: "So the client or team gets the right information at the right time.", who: "Employee or messaging system" },
    meeting: { what: "A meeting is booked or held here.", why: "To create a clear point for understanding, deciding or moving forward.", who: "Client and representative / employee" },
  },
};

function linkedText(labels: string[] | undefined, language: WordingLang, direction: "in" | "out") {
  const names = (labels ?? []).filter(Boolean).slice(0, 3).join(language === "he" ? " / " : ", ");
  if (names) {
    if (direction === "in") return language === "he" ? `מידע שמגיע מהשלב: ${names}.` : `Information coming from: ${names}.`;
    return language === "he" ? `בסיום עוברים לשלב: ${names}.` : `When this finishes, the process continues to: ${names}.`;
  }
  if (direction === "in") return language === "he" ? "המידע או הפנייה שמתחילים את התהליך." : "The information or enquiry that starts the process.";
  return language === "he" ? "המידע נשמר או מועבר להמשך הטיפול." : "The information is stored or passed on for follow-up.";
}

function knownCopy(label: string, language: WordingLang) {
  const value = label.toLocaleLowerCase();
  const he = language === "he";
  if (/לידים חדשים|new leads|facebook leads|פייסבוק.*ליד|שיווק.*ליד/.test(value)) return {
    what: he ? "פניות חדשות מהשיווק, מפייסבוק או ממקורות אחרים נכנסות כאן לתהליך במקום אחד." : "New enquiries from marketing, Facebook or other sources enter the process here.",
    why: he ? "כדי שכל ליד ייכנס לטיפול מסודר ולא ילך לאיבוד בין ערוצים שונים." : "So every lead enters organized follow-up and is not lost between channels.",
    input: he ? "פנייה חדשה עם פרטי הקשר והמידע שהלקוח השאיר." : "A new enquiry with contact details and submitted information.",
  };
  if (/לידים מהעבר|old leads|past leads/.test(value)) return {
    what: he ? "לידים שכבר פנו בעבר נכנסים כאן למסלול חידוש קשר." : "Past leads enter a re-engagement route here.",
    why: he ? "כדי לבדוק אם יש שוב עניין בלי להתחיל מאפס." : "To check for renewed interest without starting from zero.",
    input: he ? "רשימת לידים קיימת עם פרטי קשר מהעבר." : "An existing list of past leads and contact details.",
  };
  if (/שיחה ידנית|manual call|שיחת טלפון/.test(value)) return {
    what: he ? "נציג מתקשר לליד באופן אישי כדי להבין, להשלים מידע או לקדם אותו." : "A representative calls the lead personally to understand, complete information or move forward.",
    why: he ? "כדי לשמור מגע אנושי בנקודה שבה שיחה אישית חשובה." : "To keep human contact where a personal conversation matters.",
  };
  if (/הודעת פתיחה|opening message|welcome message/.test(value)) return {
    what: he ? "נשלחת לליד הודעת פתיחה שמתחילה את השיחה ומסבירה את הצעד הבא." : "An opening message starts the conversation and explains the next step.",
    why: he ? "כדי ליצור תגובה מהירה ועקבית מיד כשהפנייה נכנסת." : "To respond quickly and consistently when the enquiry arrives.",
  };
  if (/חידוש קשר|reconnect|re-engage|follow.?up/.test(value)) return {
    what: he ? "נשלחת פנייה מחודשת לליד מהעבר כדי לבדוק אם הנושא עדיין רלוונטי." : "A past lead receives a new contact attempt to check whether the need is still relevant.",
    why: he ? "כדי להחזיר הזדמנויות ישנות לשיחה בלי עבודה ידנית חוזרת." : "To revive older opportunities without repetitive manual work.",
  };
  if (/whatsapp.*bot|בוט.*וואטסאפ|וואטסאפ.*בוט/.test(value)) return {
    what: he ? "הבוט ב-WhatsApp מקבל את הפנייה, שואל שאלות ואוסף את המידע הדרוש להמשך." : "The WhatsApp bot receives the enquiry, asks questions and collects the information needed next.",
    why: he ? "כדי לתת מענה מיידי ולאסוף מידע בצורה אחידה לפני המשך הטיפול." : "To respond immediately and collect information consistently before follow-up.",
  };
  if (/\bmake(?:\.com)?\b|\bzapier\b|\bn8n\b/.test(value)) return {
    what: he ? "מערכת האוטומציה מחברת בין הכלים ומעבירה מידע או מפעילה את הפעולה הבאה אוטומטית." : "The automation platform connects the tools and transfers information or triggers the next action automatically.",
    why: he ? "כדי שהמערכות יעבדו יחד בלי העתקה ידנית ובלי פעולות חוזרות." : "So systems work together without manual copying or repetitive actions.",
  };
  if (/סינון|filter|qualif|התאמה/.test(value)) return {
    what: he ? "המידע שנאסף נבדק לפי כללים כדי להבין אם הפנייה מתאימה להמשך." : "Collected information is checked against rules to decide whether the enquiry should continue.",
    why: he ? "כדי שהצוות יתמקד בפניות הרלוונטיות וכל פנייה תגיע למסלול המתאים." : "So the team focuses on relevant enquiries and each enquiry reaches the right route.",
  };
  if (/airtable|איירטייבל|\bcrm\b/.test(value)) return {
    what: he ? "פרטי הליד והסטטוס שלו נשמרים או מתעדכנים במערכת ניהול המידע." : "Lead details and status are stored or updated in the information-management system.",
    why: he ? "כדי שהצוות יראה תמונה עדכנית של כל ליד במקום אחד." : "So the team sees an up-to-date picture of every lead in one place.",
  };
  return null;
}

export function explainClientProcessNode(
  node: ClientProcessNode,
  language: WordingLang,
  context: { previousLabels?: string[]; nextLabels?: string[] } = {},
): ProcessExplanation {
  const category = categorizeClientProcessNode(node);
  const generic = genericCopy[language][category];
  const known = knownCopy(node.label, language);
  const terms = findClientGlossaryTerms(node.label);

  return {
    title: node.label,
    what: isClientSafeProcessText(node.description) ? node.description!.trim() : known?.what ?? generic.what,
    why: isClientSafeProcessText(node.purpose) ? node.purpose!.trim() : known?.why ?? generic.why,
    input: isClientSafeProcessText(node.input) ? node.input!.trim() : known?.input ?? linkedText(context.previousLabels, language, "in"),
    output: isClientSafeProcessText(node.output) ? node.output!.trim() : linkedText(context.nextLabels, language, "out"),
    who: generic.who,
    category,
    status: getClientProcessStatus(node.status),
    technicalDetails: isClientSafeProcessText(node.technicalDetails)
      ? node.technicalDetails!.trim()
      : terms.length
        ? (language === "he" ? `השלב משתמש ב-${terms.map((term) => term.displayName).join(", ")}.` : `This step uses ${terms.map((term) => term.displayName).join(", ")}.`)
        : undefined,
  };
}
