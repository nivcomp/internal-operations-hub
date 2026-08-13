import type { WordingLang } from "./clientWording";

export type ClientGlossaryCategory =
  | "automation"
  | "communication"
  | "data"
  | "integration"
  | "security"
  | "ai";

export type ClientGlossaryEntry = {
  key: string;
  displayName: string;
  explanation: Record<WordingLang, string>;
  technical: Record<WordingLang, string>;
  category: ClientGlossaryCategory;
  icon: string;
  aliases: readonly string[];
};

export const clientGlossary: readonly ClientGlossaryEntry[] = [
  {
    key: "whatsapp_bot",
    displayName: "WhatsApp Bot",
    explanation: {
      he: "מענה אוטומטי ב־WhatsApp שיכול לקבל מידע, לשאול שאלות, לסנן פניות ולהעביר אותן להמשך טיפול.",
      en: "An automated WhatsApp assistant that can collect information, ask questions, sort enquiries and pass them on for follow-up.",
    },
    technical: { he: "ממשק שיחה אוטומטי ב־WhatsApp.", en: "An automated WhatsApp conversation interface." },
    category: "communication",
    icon: "💬",
    aliases: ["whatsapp bot", "בוט וואטסאפ", "בוט ווטסאפ"],
  },
  {
    key: "microsoft_365",
    displayName: "Microsoft 365",
    explanation: {
      he: "חבילת כלי העבודה של Microsoft, כגון Outlook, Excel, Word ו־OneDrive.",
      en: "Microsoft's work suite, including tools such as Outlook, Excel, Word and OneDrive.",
    },
    technical: { he: "חבילת שירותי ענן וכלי עבודה של Microsoft.", en: "Microsoft's cloud productivity suite." },
    category: "integration",
    icon: "▦",
    aliases: ["microsoft 365", "office 365"],
  },
  {
    key: "google_sheets",
    displayName: "Google Sheets",
    explanation: {
      he: "גיליון מקוון שבו אפשר לשמור, לסדר ולעדכן מידע יחד.",
      en: "An online spreadsheet used to store, organise and update information collaboratively.",
    },
    technical: { he: "שירות גיליונות אלקטרוניים בענן של Google.", en: "Google's cloud spreadsheet service." },
    category: "data",
    icon: "▦",
    aliases: ["google sheets", "גוגל שיטס", "גיליונות גוגל"],
  },
  {
    key: "google_drive",
    displayName: "Google Drive",
    explanation: {
      he: "שירות לשמירה ולשיתוף של קבצים ומסמכים בענן.",
      en: "A cloud service for storing and sharing files and documents.",
    },
    technical: { he: "שירות אחסון קבצים בענן של Google.", en: "Google's cloud file-storage service." },
    category: "data",
    icon: "📁",
    aliases: ["google drive", "גוגל דרייב"],
  },
  {
    key: "green_api",
    displayName: "Green API",
    explanation: {
      he: "שירות שמאפשר למערכת לשלוח ולקבל הודעות WhatsApp באופן אוטומטי.",
      en: "A service that lets a system send and receive WhatsApp messages automatically.",
    },
    technical: { he: "שירות חיבור תוכנתי ל־WhatsApp.", en: "A programmatic WhatsApp connectivity service." },
    category: "communication",
    icon: "💬",
    aliases: ["green api", "green-api", "גרין api"],
  },
  {
    key: "openai_ai",
    displayName: "OpenAI / AI",
    explanation: {
      he: "בינה מלאכותית שעוזרת להבין מידע, לנסח תשובות או לבצע משימה שהוגדרה לה מראש.",
      en: "Artificial intelligence that helps understand information, draft responses or perform a defined task.",
    },
    technical: { he: "שירות בינה מלאכותית לעיבוד וליצירת תוכן.", en: "An AI service for processing and generating content." },
    category: "ai",
    icon: "✦",
    aliases: ["openai", "open ai", "בינה מלאכותית", "ai"],
  },
  {
    key: "airtable",
    displayName: "Airtable",
    explanation: {
      he: "מערכת לניהול מידע וטבלאות, שיכולה לשמש גם כמסד נתונים או CRM.",
      en: "A system for managing information and tables that can also serve as a database or CRM.",
    },
    technical: { he: "פלטפורמת מסד נתונים שיתופית בענן.", en: "A collaborative cloud database platform." },
    category: "data",
    icon: "▦",
    aliases: ["airtable", "איירטייבל", "איירטייבל"],
  },
  {
    key: "supabase",
    displayName: "Supabase",
    explanation: {
      he: "שירות ששומר את המידע של המערכת ומאפשר לאפליקציה לקרוא ולעדכן אותו בצורה מאובטחת.",
      en: "A service that stores application data and lets the app read and update it securely.",
    },
    technical: { he: "פלטפורמת Backend ומסד נתונים מנוהל.", en: "A managed backend and database platform." },
    category: "data",
    icon: "▤",
    aliases: ["supabase", "סופאבייס"],
  },
  {
    key: "zapier",
    displayName: "Zapier",
    explanation: {
      he: "שירות שמאפשר לחבר בין מערכות וליצור תהליכים אוטומטיים.",
      en: "A service that connects systems and creates automated processes between them.",
    },
    technical: { he: "פלטפורמת אוטומציה ואינטגרציה.", en: "An automation and integration platform." },
    category: "automation",
    icon: "⚡",
    aliases: ["zapier", "זאפייר"],
  },
  {
    key: "webhook",
    displayName: "Webhook",
    explanation: {
      he: "התראה אוטומטית שמערכת אחת שולחת לאחרת ברגע שאירוע מסוים קורה.",
      en: "An automatic notification one system sends to another when a specific event happens.",
    },
    technical: { he: "קריאת HTTP שמופעלת בעקבות אירוע.", en: "An event-triggered HTTP callback." },
    category: "integration",
    icon: "↗",
    aliases: ["webhook", "web hook", "וובהוק"],
  },
  {
    key: "make",
    displayName: "Make",
    explanation: {
      he: "מערכת שמחברת בין תוכנות ומאפשרת לבצע פעולות אוטומטיות ביניהן בלי שעובד יצטרך לבצע אותן ידנית.",
      en: "A system that connects software and performs automatic actions between services without requiring manual work.",
    },
    technical: { he: "פלטפורמת אוטומציה ואינטגרציה.", en: "An automation and integration platform." },
    category: "automation",
    icon: "⚡",
    aliases: ["make.com", "make", "מייק"],
  },
  {
    key: "oauth",
    displayName: "OAuth",
    explanation: {
      he: "דרך מאובטחת לאפשר למערכת גישה מוגבלת לשירות אחר, בלי למסור לה את הסיסמה שלך.",
      en: "A secure way to grant limited access to another service without sharing your password.",
    },
    technical: { he: "תקן הרשאה מאובטח בין שירותים.", en: "A secure delegated-authorisation standard." },
    category: "security",
    icon: "🔐",
    aliases: ["oauth", "oauth2", "או-אות'"],
  },
  {
    key: "gmail",
    displayName: "Gmail",
    explanation: {
      he: "שירות הדואר האלקטרוני של Google לשליחה ולקבלה של הודעות.",
      en: "Google's email service for sending and receiving messages.",
    },
    technical: { he: "שירות דואר אלקטרוני של Google.", en: "Google's email service." },
    category: "communication",
    icon: "✉",
    aliases: ["gmail", "ג'ימייל", "גימייל"],
  },
  {
    key: "crm",
    displayName: "CRM",
    explanation: {
      he: "מערכת שבה נשמר מידע על לידים, לקוחות, שיחות, סטטוסים והמשך טיפול.",
      en: "A system that stores leads, customers, conversations, statuses and follow-up work.",
    },
    technical: { he: "מערכת לניהול קשרי לקוחות.", en: "A customer relationship management system." },
    category: "data",
    icon: "▦",
    aliases: ["crm", "ניהול קשרי לקוחות"],
  },
  {
    key: "api",
    displayName: "API",
    explanation: {
      he: "דרך מוסכמת שבה שתי מערכות מעבירות ביניהן מידע או בקשות.",
      en: "A standard way for two systems to exchange information or requests.",
    },
    technical: { he: "ממשק תכנות שמאפשר תקשורת בין מערכות.", en: "An application programming interface between systems." },
    category: "integration",
    icon: "↔",
    aliases: ["api", "ממשק תכנות"],
  },
  {
    key: "database",
    displayName: "מסד נתונים",
    explanation: {
      he: "מקום מסודר שבו המערכת שומרת מידע כדי שיהיה אפשר למצוא ולעדכן אותו.",
      en: "An organised place where a system stores information so it can be found and updated.",
    },
    technical: { he: "מאגר נתונים מובנה.", en: "A structured data store." },
    category: "data",
    icon: "▤",
    aliases: ["database", "data base", "מסד נתונים", "בסיס נתונים"],
  },
  {
    key: "automation",
    displayName: "אוטומציה",
    explanation: {
      he: "פעולה שהמערכת מבצעת לבד לפי כללים שנקבעו מראש.",
      en: "An action the system performs automatically according to predefined rules.",
    },
    technical: { he: "תהליך ממוכן שמופעל לפי תנאי או אירוע.", en: "An automated process triggered by a condition or event." },
    category: "automation",
    icon: "⚡",
    aliases: ["automation", "אוטומציה"],
  },
  {
    key: "integration",
    displayName: "אינטגרציה",
    explanation: {
      he: "חיבור בין מערכות שמאפשר להן להעביר מידע ולעבוד יחד.",
      en: "A connection that lets systems exchange information and work together.",
    },
    technical: { he: "חיבור נתונים או פעולות בין שירותים.", en: "A data or action connection between services." },
    category: "integration",
    icon: "↔",
    aliases: ["integration", "אינטגרציה", "שילוב מערכות"],
  },
] as const;

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasRange(text: string, alias: string): [number, number] | null {
  const latinAlias = /^[a-z0-9 .+'-]+$/i.test(alias);
  if (latinAlias) {
    const match = new RegExp(`(^|[^a-z0-9])(${escaped(alias)})(?=$|[^a-z0-9])`, "i").exec(text);
    if (!match) return null;
    const start = match.index + match[1].length;
    return [start, start + match[2].length];
  }

  const start = text.toLocaleLowerCase().indexOf(alias.toLocaleLowerCase());
  return start < 0 ? null : [start, start + alias.length];
}

export function findClientGlossaryTerms(text: string): ClientGlossaryEntry[] {
  const candidates = clientGlossary
    .flatMap((entry) => entry.aliases.map((alias) => ({ entry, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const ranges: Array<[number, number]> = [];
  const matches: ClientGlossaryEntry[] = [];

  candidates.forEach(({ entry, alias }) => {
    if (matches.some((match) => match.key === entry.key)) return;
    const range = aliasRange(text, alias);
    if (!range || ranges.some(([start, end]) => range[0] < end && range[1] > start)) return;
    ranges.push(range);
    matches.push(entry);
  });

  return matches;
}

export function clientGlossaryText(entry: ClientGlossaryEntry, language: WordingLang) {
  return {
    explanation: entry.explanation[language],
    technical: entry.technical[language],
  };
}
