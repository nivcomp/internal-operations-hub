import { findClientGlossaryTerms, type ClientGlossaryEntry } from "./clientGlossary";
import type { WordingLang } from "./clientWording";

export type ClientProcessCategory = "human" | "automation" | "ai" | "external" | "decision" | "message" | "meeting";

export type ClientProcessNodeData = {
  id: string;
  label: string;
  kind?: string;
  detail?: string;
};

export type ClientProcessExplanation = {
  category: ClientProcessCategory;
  categoryLabel: string;
  icon: string;
  what: string;
  why: string;
  after: string;
  input: string;
  output: string;
  performer: string;
  terms: ClientGlossaryEntry[];
};

const categoryMeta: Record<ClientProcessCategory, Record<WordingLang, { label: string; icon: string }>> = {
  human: { he: { label: "פעולה של אדם", icon: "👤" }, en: { label: "Human action", icon: "👤" } },
  automation: { he: { label: "פעולה אוטומטית", icon: "⚡" }, en: { label: "Automated action", icon: "⚡" } },
  ai: { he: { label: "פעולת AI", icon: "✦" }, en: { label: "AI action", icon: "✦" } },
  external: { he: { label: "מערכת חיצונית", icon: "⚙" }, en: { label: "External system", icon: "⚙" } },
  decision: { he: { label: "החלטה או סינון", icon: "✓" }, en: { label: "Decision or filter", icon: "✓" } },
  message: { he: { label: "הודעה", icon: "💬" }, en: { label: "Message", icon: "💬" } },
  meeting: { he: { label: "פגישה", icon: "◷" }, en: { label: "Meeting", icon: "◷" } },
};

const content: Record<ClientProcessCategory, Record<WordingLang, Omit<ClientProcessExplanation, "category" | "categoryLabel" | "icon" | "terms">>> = {
  human: {
    he: { what: "אדם מבצע את הפעולה ומוסיף את המידע הדרוש להמשך.", why: "כאן נדרשים שיקול דעת, שיחה או פעולה אישית.", after: "המידע או הפעולה שהושלמו עוברים לשלב הבא בתהליך.", input: "הפרטים שנאספו עד לנקודה הזו.", output: "פעולה שהושלמה ומידע מעודכן.", performer: "הלקוח או עובד צוות, בהתאם לשלב." },
    en: { what: "A person completes the action and adds the information needed to continue.", why: "This step needs judgement, a conversation or a personal action.", after: "The completed action and its information move to the next step.", input: "The details collected up to this point.", output: "A completed action and updated information.", performer: "The client or a team member, depending on the step." },
  },
  automation: {
    he: { what: "המערכת מבצעת את הפעולה לבד לפי כללים שהוגדרו מראש.", why: "כך הפעולה מתבצעת באופן עקבי ומהיר בלי עבודה ידנית חוזרת.", after: "התוצאה מועברת אוטומטית לשלב הבא או למערכת הבאה.", input: "מידע או אירוע שמפעילים את התהליך.", output: "פעולה אוטומטית שהושלמה ומידע שהועבר הלאה.", performer: "אוטומציה." },
    en: { what: "The system performs the action automatically using predefined rules.", why: "This keeps repeated work fast and consistent without manual effort.", after: "The result moves automatically to the next step or system.", input: "Information or an event that starts the process.", output: "A completed automatic action and forwarded information.", performer: "Automation." },
  },
  ai: {
    he: { what: "ה־AI מעבד את המידע כדי להבין, לסכם או להכין תשובה בהתאם למשימה.", why: "כך אפשר לטפל במידע במהירות ועדיין להעביר החלטות חשובות לאדם.", after: "התוצאה עוברת לבדיקה, לשיחה או לשלב האוטומטי הבא.", input: "טקסט או מידע רלוונטי למשימה.", output: "סיכום, סיווג או טיוטת תשובה.", performer: "בינה מלאכותית, לפי הכללים שהוגדרו לה." },
    en: { what: "AI processes the information to understand, summarise or prepare a response for the task.", why: "This handles information quickly while keeping important decisions with a person.", after: "The result moves to review, conversation or the next automated step.", input: "Text or information relevant to the task.", output: "A summary, classification or response draft.", performer: "AI, according to its defined rules." },
  },
  external: {
    he: { what: "מערכת חיצונית מקבלת, שומרת או מעדכנת את המידע של השלב.", why: "כך המידע נשמר במקום שבו הצוות כבר מנהל את העבודה.", after: "המידע המעודכן זמין להמשך טיפול או לשלב הבא.", input: "המידע שהגיע מהשלב הקודם.", output: "רשומה שמורה או מעודכנת במערכת.", performer: "המערכת החיצונית." },
    en: { what: "An external system receives, stores or updates the information for this step.", why: "This keeps the information in the place where the team already manages its work.", after: "The updated information is available for follow-up or the next step.", input: "Information received from the previous step.", output: "A saved or updated record in the system.", performer: "The external system." },
  },
  decision: {
    he: { what: "המידע נבדק מול תנאי כדי להחליט לאיזה המשך הוא מתאים.", why: "כך כל פנייה מקבלת את הטיפול הנכון ולא ממשיכה למסלול לא מתאים.", after: "התהליך ממשיך במסלול שנבחר לפי תוצאת הבדיקה.", input: "המידע והקריטריונים שנאספו.", output: "החלטה ברורה לגבי מסלול ההמשך.", performer: "עובד צוות או אוטומציה, בהתאם לכלל שהוגדר." },
    en: { what: "The information is checked against a condition to choose the right next path.", why: "This gives each enquiry the right treatment instead of sending it down the wrong path.", after: "The process continues along the path selected by the result.", input: "The collected information and criteria.", output: "A clear decision about the next path.", performer: "A team member or automation, depending on the defined rule." },
  },
  message: {
    he: { what: "נשלחת או מתקבלת הודעה כחלק מהשיחה עם הלקוח או הליד.", why: "כך נשמר קשר בזמן הנכון והצד השני יודע מה נדרש ממנו.", after: "התשובה או תוצאת ההודעה ממשיכות לשלב הבא.", input: "פרטי איש הקשר וההקשר להודעה.", output: "הודעה שנשלחה או תשובה שנקלטה.", performer: "WhatsApp, מערכת הודעות, אוטומציה או עובד צוות — לפי השלב." },
    en: { what: "A message is sent or received as part of the conversation with the client or lead.", why: "This keeps contact timely and makes the next action clear.", after: "The reply or message result continues to the next step.", input: "Contact details and the context for the message.", output: "A sent message or a recorded reply.", performer: "WhatsApp, a messaging system, automation or a team member, depending on the step." },
  },
  meeting: {
    he: { what: "מתאמים ומקיימים פגישה בזמן שמתאים לצדדים.", why: "הפגישה מאפשרת להבין את הצורך, לענות על שאלות ולהחליט איך ממשיכים.", after: "סיכום הפגישה וההחלטות עוברים להמשך הטיפול.", input: "פרטי קשר, זמינות ונושא הפגישה.", output: "פגישה שנקבעה או סיכום של פגישה שהתקיימה.", performer: "הלקוח ועובד הצוות." },
    en: { what: "A meeting is scheduled and held at a suitable time.", why: "The meeting helps clarify the need, answer questions and decide what comes next.", after: "The meeting summary and decisions move into follow-up work.", input: "Contact details, availability and the meeting topic.", output: "A booked meeting or a summary of a completed meeting.", performer: "The client and a team member." },
  },
};

const patterns = {
  meeting: /פגישה|תיאום|יומן|meeting|appointment|calendar|booking/i,
  decision: /סינון|החלט|אישור|בדיק|תנאי|filter|decision|approval|qualif/i,
  ai: /בינה מלאכותית|openai|(^|\W)ai(\W|$)/i,
  message: /הודע|וואטסאפ|ווטסאפ|whatsapp|message|sms|מייל|email|gmail|bot|בוט/i,
  human: /ידני|ידנית|שיחה של|עובד|לקוח|manual|employee|client|human/i,
};

const externalTermKeys = new Set(["airtable", "crm", "supabase", "google_sheets", "google_drive", "microsoft_365", "database"]);
const automationTermKeys = new Set(["make", "zapier", "automation", "integration", "api", "webhook", "oauth"]);

function categoryFor(node: ClientProcessNodeData, terms: ClientGlossaryEntry[]): ClientProcessCategory {
  const label = node.label;
  if (patterns.meeting.test(label)) return "meeting";
  if (patterns.decision.test(label) || node.kind === "approval") return "decision";
  if (patterns.ai.test(label)) return "ai";
  if (patterns.message.test(label)) return "message";
  if (patterns.human.test(label) || node.kind === "user") return "human";
  if (terms.some((term) => externalTermKeys.has(term.key))) return "external";
  if (terms.some((term) => automationTermKeys.has(term.key)) || node.kind === "automation" || node.kind === "integration") return "automation";
  return node.kind === "user" ? "human" : "external";
}

function applyKnownStepDetails(
  node: ClientProcessNodeData,
  language: WordingLang,
  explanation: ClientProcessExplanation,
): ClientProcessExplanation {
  const isLeadSource = /ליד|פניי|lead|enquir/i.test(node.label) && /פייסבוק|facebook|שיווק|marketing|קבוצ|group/i.test(node.label);
  const isPastLead = /לידים? מהעבר|לידים? ישנים|old leads?|past leads?/i.test(node.label);
  if (!isLeadSource && !isPastLead) return explanation;

  if (language === "he") {
    return {
      ...explanation,
      what: isPastLead ? "פרטי לידים שכבר פנו בעבר נכנסים מחדש לתהליך מסודר." : "פניות חדשות מערוצי השיווק נכנסות לתהליך במקום אחד.",
      why: isPastLead ? "כך אפשר לחדש קשר עם אנשים שכבר גילו עניין ולא לאבד הזדמנויות קיימות." : "כך אף פנייה חדשה לא הולכת לאיבוד ואפשר להתחיל לטפל בה בזמן.",
      input: isPastLead ? "רשימת לידים קיימת ופרטי הקשר שנשמרו." : "פרטי הפנייה מערוץ השיווק.",
      output: "ליד מסודר שמוכן להמשך טיפול.",
      after: "הליד עובר לשיחה, לסינון או למערכת ניהול הלקוחות לפי התהליך שהוגדר.",
    };
  }

  return {
    ...explanation,
    what: isPastLead ? "Details of previous leads re-enter a structured follow-up process." : "New enquiries from marketing channels enter the process in one place.",
    why: isPastLead ? "This helps reconnect with people who already showed interest without losing existing opportunities." : "This prevents new enquiries from being lost and enables timely follow-up.",
    input: isPastLead ? "An existing lead list and saved contact details." : "Enquiry details from the marketing channel.",
    output: "An organised lead ready for follow-up.",
    after: "The lead moves to a conversation, filter or CRM according to the defined process.",
  };
}

export function buildClientProcessExplanation(node: ClientProcessNodeData, language: WordingLang): ClientProcessExplanation {
  const terms = findClientGlossaryTerms(`${node.label} ${node.detail ?? ""}`);
  const category = categoryFor(node, terms);
  const meta = categoryMeta[category][language];
  return applyKnownStepDetails(node, language, {
    category,
    categoryLabel: meta.label,
    icon: meta.icon,
    ...content[category][language],
    terms,
  });
}
