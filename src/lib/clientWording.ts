/**
 * Client-facing wording layer.
 *
 * Clients and leads should never see internal/technical jargon ("MVP",
 * "prototype", "scope", "אב־טיפוס"). Everything they see is described in
 * everyday words that match what they actually asked for.
 *
 * This file only affects visible text. Database fields, statuses and business
 * logic keep their existing technical names.
 */

export type SolutionKind = "app" | "whatsapp" | "automation";
export type WordingLang = "he" | "en";

type Deliverable = {
  /** "האוטומציה שלך" — used as a title/tab label. */
  name: string;
  /** "האוטומציה" — used inside a sentence. */
  short: string;
};

const DELIVERABLES: Record<WordingLang, Record<SolutionKind | "unknown", Deliverable>> = {
  he: {
    automation: { name: "האוטומציה שלך", short: "האוטומציה" },
    whatsapp: { name: "הבוט בוואטסאפ שלך", short: "הבוט" },
    app: { name: "האפליקציה שלך", short: "האפליקציה" },
    unknown: { name: "מה שבונים לך", short: "מה שבונים לך" },
  },
  en: {
    automation: { name: "Your automation", short: "the automation" },
    whatsapp: { name: "Your WhatsApp bot", short: "the bot" },
    app: { name: "Your app", short: "the app" },
    unknown: { name: "What we are building for you", short: "what we are building" },
  },
};

export function deliverable(kind: SolutionKind | null | undefined, language: WordingLang): Deliverable {
  const key = kind && kind in DELIVERABLES[language] ? kind : "unknown";
  return DELIVERABLES[language][key as SolutionKind | "unknown"];
}

/** Best-effort guess from free text when no solution kind is stored yet. */
export function guessSolutionKind(...text: Array<string | undefined | null>): SolutionKind | null {
  const value = text.filter(Boolean).join(" ").toLowerCase();
  if (!value.trim()) return null;
  if (/whatsapp|וואטסאפ|ווטסאפ|בוט|chatbot|צ.טבוט/.test(value)) return "whatsapp";
  if (/אוטומצי|automation|תהליך אוטומטי|zapier|make\.com|n8n/.test(value)) return "automation";
  if (/אפליקצי|app\b|mobile|מערכת|אתר|website|portal|פורטל|dashboard/.test(value)) return "app";
  return null;
}

/**
 * Wording for the client-facing conversation and interface, in plain language.
 * Shared by the portal, the lead conversation and the AI system prompts.
 */
export const PLAIN_LANGUAGE_RULES_HE = [
  "דבר בעברית פשוטה ויומיומית, כמו בשיחה רגילה.",
  "אסור להשתמש במונחים מקצועיים מול הלקוח: MVP, אב־טיפוס, פרוטוטייפ, אפיון, scope, היקף, אינטגרציה, API, backend, deploy, sprint, KPI.",
  "אל תשאל שאלה שמכילה מונח מקצועי. במקום 'מה ה־Scope?' שאל 'מה בדיוק אתה רוצה שיקרה?'.",
  "תאר את התוצר במילים שהלקוח עצמו השתמש בהן (אוטומציה, בוט בוואטסאפ, אפליקציה, אתר). אל תדחוף מושג שהוא לא אמר.",
  "אם אין ברירה ומונח מקצועי הכרחי — הסבר אותו במשפט קצר וברור.",
].join(" ");

export const PLAIN_LANGUAGE_RULES_EN = [
  "Speak in simple everyday language.",
  "Never use jargon with the client: MVP, prototype, spec, scope, integration, API, backend, deploy, sprint, KPI.",
  "Never ask a question that contains a technical term.",
  "Describe the deliverable using the client's own words (automation, WhatsApp bot, app, website).",
  "If a technical word is unavoidable, explain it in one short sentence.",
].join(" ");
