export type ClientGlossaryCategory =
  | "automation"
  | "data"
  | "communication"
  | "identity"
  | "ai"
  | "integration"
  | "platform";

export type ClientGlossaryTerm = {
  key: string;
  displayName: string;
  aliases: string[];
  he: string;
  en?: string;
  technical?: string;
  category?: ClientGlossaryCategory;
  icon?: string;
};

export type ClientGlossaryMatch = {
  start: number;
  end: number;
  text: string;
  term: ClientGlossaryTerm;
};

export const CLIENT_GLOSSARY: ClientGlossaryTerm[] = [
  {
    key: "make",
    displayName: "Make",
    aliases: ["Make.com", "Make"],
    he: "מערכת שמחברת בין תוכנות ומאפשרת לבצע פעולות אוטומטיות ביניהן בלי שעובד יצטרך לבצע אותן ידנית.",
    en: "A platform that connects software and automates actions between systems so a person does not have to perform them manually.",
    technical: "Automation platform / integration platform.",
    category: "automation",
    icon: "⚡",
  },
  {
    key: "zapier",
    displayName: "Zapier",
    aliases: ["Zapier"],
    he: "שירות שמאפשר לחבר בין מערכות וליצור תהליכים אוטומטיים.",
    en: "A service for connecting systems and creating automated workflows.",
    technical: "Automation platform / integration platform.",
    category: "automation",
    icon: "⚡",
  },
  {
    key: "n8n",
    displayName: "n8n",
    aliases: ["n8n"],
    he: "מערכת לבניית אוטומציות וחיבורים בין תוכנות, כך שמידע ופעולות יכולים לעבור ביניהן אוטומטית.",
    en: "A platform for building automations and connections between software systems.",
    technical: "Workflow automation platform.",
    category: "automation",
    icon: "⚡",
  },
  {
    key: "airtable",
    displayName: "Airtable",
    aliases: ["Airtable", "איירטייבל"],
    he: "מערכת לניהול מידע וטבלאות, שיכולה לשמש כמסד נתונים או CRM.",
    en: "A system for managing structured information and tables that can also be used as a database or CRM.",
    technical: "Cloud database / collaborative data platform.",
    category: "data",
    icon: "▦",
  },
  {
    key: "crm",
    displayName: "CRM",
    aliases: ["CRM"],
    he: "מערכת שבה נשמר מידע על לידים, לקוחות, שיחות, סטטוסים והמשך טיפול.",
    en: "A system that stores leads, customers, conversations, statuses and follow-up information.",
    technical: "Customer relationship management system.",
    category: "data",
    icon: "▦",
  },
  {
    key: "whatsapp-bot",
    displayName: "WhatsApp Bot",
    aliases: ["WhatsApp Bot", "WhatsApp bot", "בוט בוואטסאפ", "בוט וואטסאפ", "בוט WhatsApp"],
    he: "מענה אוטומטי ב-WhatsApp שיכול לקבל מידע, לשאול שאלות, לסנן פניות ולהעביר אותן להמשך טיפול.",
    en: "An automated WhatsApp responder that can receive information, ask questions, screen enquiries and pass them on for follow-up.",
    technical: "Messaging automation / chatbot.",
    category: "communication",
    icon: "💬",
  },
  {
    key: "api",
    displayName: "API",
    aliases: ["API"],
    he: "דרך מוסכמת שמאפשרת לשתי מערכות לשלוח ולקבל מידע זו מזו.",
    en: "A defined way for two software systems to send and receive information from each other.",
    technical: "Application Programming Interface.",
    category: "integration",
    icon: "🔗",
  },
  {
    key: "webhook",
    displayName: "Webhook",
    aliases: ["Webhook", "webhook"],
    he: "הודעה אוטומטית שמערכת אחת שולחת למערכת אחרת מיד כשאירוע מסוים קורה.",
    en: "An automatic notification one system sends to another as soon as a specific event happens.",
    technical: "Event-driven HTTP callback.",
    category: "integration",
    icon: "🔗",
  },
  {
    key: "oauth",
    displayName: "OAuth",
    aliases: ["OAuth", "OAuth 2.0"],
    he: "דרך מאובטחת לתת למערכת הרשאה להתחבר לחשבון בלי למסור לה את הסיסמה עצמה.",
    en: "A secure way to let a system access an account without giving it the account password.",
    technical: "Authorization protocol.",
    category: "identity",
    icon: "🔐",
  },
  {
    key: "supabase",
    displayName: "Supabase",
    aliases: ["Supabase"],
    he: "שירות שמספק למערכת מסד נתונים ושירותים כמו התחברות משתמשים ואחסון מידע.",
    en: "A service that provides a database and common application services such as user authentication and storage.",
    technical: "Backend platform based on PostgreSQL.",
    category: "platform",
    icon: "⚙️",
  },
  {
    key: "google-sheets",
    displayName: "Google Sheets",
    aliases: ["Google Sheets", "גוגל שיטס"],
    he: "גיליון נתונים של Google שיכול לשמור רשימות, נתונים וסטטוסים ולשתף אותם בין אנשים ומערכות.",
    en: "Google's spreadsheet service, used to store and share lists, data and statuses.",
    technical: "Cloud spreadsheet service.",
    category: "data",
    icon: "▦",
  },
  {
    key: "gmail",
    displayName: "Gmail",
    aliases: ["Gmail"],
    he: "שירות הדואר של Google. במערכת אוטומטית אפשר להשתמש בו כדי לקרוא, לשלוח או לטפל בהודעות לפי הרשאה.",
    en: "Google's email service. With permission, an automated system can read, send or process messages.",
    technical: "Email service / Gmail API integration.",
    category: "communication",
    icon: "✉️",
  },
  {
    key: "google-drive",
    displayName: "Google Drive",
    aliases: ["Google Drive", "גוגל דרייב"],
    he: "שירות של Google לשמירה ושיתוף של קבצים ומסמכים בענן.",
    en: "Google's cloud service for storing and sharing files and documents.",
    technical: "Cloud file storage service.",
    category: "data",
    icon: "📁",
  },
  {
    key: "microsoft-365",
    displayName: "Microsoft 365",
    aliases: ["Microsoft 365", "Office 365"],
    he: "חבילת השירותים העסקיים של Microsoft, כולל דואר, קבצים, לוחות שנה וכלי עבודה משרדיים.",
    en: "Microsoft's business services suite, including email, files, calendars and office tools.",
    technical: "Microsoft cloud productivity platform.",
    category: "platform",
    icon: "⚙️",
  },
  {
    key: "green-api",
    displayName: "Green API",
    aliases: ["Green API", "GreenAPI"],
    he: "שירות שמאפשר למערכת להתחבר ל-WhatsApp כדי לשלוח ולקבל הודעות כחלק מתהליך אוטומטי.",
    en: "A service that connects a system to WhatsApp for sending and receiving messages as part of an automated process.",
    technical: "WhatsApp integration service.",
    category: "communication",
    icon: "💬",
  },
  {
    key: "openai-ai",
    displayName: "OpenAI / AI",
    aliases: ["OpenAI", "בינה מלאכותית", "Artificial Intelligence", "AI"],
    he: "בינה מלאכותית שיכולה להבין מידע, לנסח תשובות, לסכם או לקבל החלטות מוגדרות כחלק מהתהליך.",
    en: "Artificial intelligence that can understand information, draft responses, summarize or perform defined reasoning steps in a process.",
    technical: "AI model / model service.",
    category: "ai",
    icon: "🤖",
  },
  {
    key: "database",
    displayName: "Database",
    aliases: ["database", "Database", "מסד נתונים", "בסיס נתונים"],
    he: "מקום מסודר שבו המערכת שומרת מידע כדי שאפשר יהיה למצוא, לעדכן ולהשתמש בו בהמשך.",
    en: "An organized place where a system stores information so it can be found, updated and used later.",
    technical: "Structured data store.",
    category: "data",
    icon: "▦",
  },
  {
    key: "automation",
    displayName: "Automation",
    aliases: ["automation", "Automation", "אוטומציות", "אוטומציה"],
    he: "תהליך שבו המערכת מבצעת פעולות לבד לפי כללים שהוגדרו מראש, במקום שעובד יבצע כל פעולה ידנית.",
    en: "A process in which the system performs actions automatically according to defined rules instead of requiring manual work.",
    technical: "Automated workflow.",
    category: "automation",
    icon: "⚡",
  },
  {
    key: "integration",
    displayName: "Integration",
    aliases: ["integration", "Integration", "אינטגרציות", "אינטגרציה"],
    he: "חיבור בין מערכות שמאפשר להן להעביר מידע או להפעיל פעולות זו אצל זו.",
    en: "A connection between systems that lets them exchange information or trigger actions in each other.",
    technical: "System-to-system connection.",
    category: "integration",
    icon: "🔗",
  },
];

const byKey = new Map(CLIENT_GLOSSARY.map((term) => [term.key, term]));

export function getClientGlossaryTerm(key: string) {
  return byKey.get(key) ?? null;
}

function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}

function hasSafeBoundaries(text: string, index: number, length: number, alias: string) {
  const first = alias[0];
  const last = alias[alias.length - 1];
  if (isWordCharacter(first) && isWordCharacter(text[index - 1])) return false;
  if (isWordCharacter(last) && isWordCharacter(text[index + length])) return false;
  return true;
}

export function findClientGlossaryMatches(text: string): ClientGlossaryMatch[] {
  if (!text) return [];
  const lower = text.toLocaleLowerCase();
  const candidates: ClientGlossaryMatch[] = [];

  for (const term of CLIENT_GLOSSARY) {
    for (const alias of [...term.aliases].sort((a, b) => b.length - a.length)) {
      const needle = alias.toLocaleLowerCase();
      let from = 0;
      while (from < lower.length) {
        const index = lower.indexOf(needle, from);
        if (index === -1) break;
        if (hasSafeBoundaries(text, index, alias.length, alias)) {
          candidates.push({
            start: index,
            end: index + alias.length,
            text: text.slice(index, index + alias.length),
            term,
          });
        }
        from = index + Math.max(1, alias.length);
      }
    }
  }

  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const matches: ClientGlossaryMatch[] = [];
  for (const candidate of candidates) {
    if (matches.some((match) => candidate.start < match.end && candidate.end > match.start)) continue;
    matches.push(candidate);
  }
  return matches.sort((a, b) => a.start - b.start);
}

export function findClientGlossaryTerms(text: string) {
  const unique = new Map<string, ClientGlossaryTerm>();
  for (const match of findClientGlossaryMatches(text)) unique.set(match.term.key, match.term);
  return [...unique.values()];
}
