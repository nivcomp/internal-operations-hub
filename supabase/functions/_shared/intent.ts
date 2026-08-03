/**
 * Structured command understanding for Operator Mode.
 *
 * Every admin command is first turned into a validated structured intent
 * (action type + normalized parameters), merged into persistent slot memory,
 * and only then handed to the typed action catalog. Nothing here writes data.
 *
 * Model routing:
 *   STRONG_MODEL — command interpretation, entity resolution, corrections.
 *   LIGHT_MODEL  — routing, relevance, short summaries (see guard.ts).
 */

export const STRONG_MODEL = "openai/gpt-5.6-sol";
export const LIGHT_MODEL = "openai/gpt-5.6-luna";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

export type ConversationOp = "new" | "correction" | "confirm" | "cancel" | "question" | "none";

export type StructuredIntent = {
  intent: string;
  action_type: string;
  conversation_op: ConversationOp;
  target: { entity_type: string; entity_id: string | null; entity_name: string };
  parameters: Record<string, unknown>;
  missing_parameters: string[];
  source_language: "he" | "en";
  confidence: number;
  admin_query: string;
};

export type SlotMemory = {
  id?: string;
  intent: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  target_label: string;
  confirmed_parameters: Record<string, unknown>;
  missing_parameters: string[];
  source_language: string;
  confidence: number;
  status: string;
  last_correction: string;
  operator_action_id: string | null;
  expires_at?: string;
};

// ------------------------------------------------------------------ normalizing

const CURRENCY_PATTERNS: [RegExp, string][] = [
  [/₪|ש["״']?ח|שקלים|שקל|\bils\b|\bnis\b/i, "ILS"],
  [/£|פאונד|שטרלינג|\bgbp\b/i, "GBP"],
  [/\$|דולר|\busd\b/i, "USD"],
  [/€|אירו|יורו|\beur\b/i, "EUR"],
];

const HE_UNITS: Record<string, number> = {
  "אפס": 0, "אחת": 1, "אחד": 1, "שתיים": 2, "שניים": 2, "שתי": 2, "שני": 2, "שלוש": 3, "שלושה": 3,
  "ארבע": 4, "ארבעה": 4, "חמש": 5, "חמישה": 5, "שש": 6, "שישה": 6, "שבע": 7, "שבעה": 7,
  "שמונה": 8, "תשע": 9, "תשעה": 9, "עשר": 10, "עשרה": 10,
};
const HE_TENS: Record<string, number> = {
  "עשרים": 20, "שלושים": 30, "ארבעים": 40, "חמישים": 50, "שישים": 60, "שבעים": 70, "שמונים": 80, "תשעים": 90,
};
const HE_HUNDREDS: Record<string, number> = { "מאה": 100, "מאתיים": 200 };

/** Converts written Hebrew numbers ("ארבע מאות חמישים") into digits. */
export function hebrewWordsToNumber(phrase: string): number | null {
  const words = phrase.replace(/[־-]/g, " ").split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let matched = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/^ו/, "");
    if (w === "מאות") {
      current = (current || 1) * 100;
      total += current;
      current = 0;
      matched = true;
    } else if (HE_HUNDREDS[w] !== undefined) {
      total += HE_HUNDREDS[w];
      matched = true;
    } else if (w === "אלף" || w === "אלפים") {
      total = (total || current || 1) * 1000;
      current = 0;
      matched = true;
    } else if (w === "אלפיים") {
      total += 2000;
      matched = true;
    } else if (HE_TENS[w] !== undefined) {
      total += HE_TENS[w];
      matched = true;
    } else if (HE_UNITS[w] !== undefined) {
      current = HE_UNITS[w];
      // "ארבע מאות" — the unit belongs to the following multiplier.
      if (words[i + 1] === "מאות" || words[i + 1] === "אלפים") continue;
      total += current;
      current = 0;
      matched = true;
    }
  }
  if (current) total += current;
  return matched && total > 0 ? total : null;
}

export type CommandSignals = {
  normalized: string;
  amounts: number[];
  currency: string | null;
  billingUnit: "hour" | "day" | "month" | "project" | null;
  percentages: number[];
  dates: string[];
};

/**
 * Rewrites a raw (often voice-transcribed) command into a normalized form and
 * pulls out the machine-usable signals, so a value the user already said is
 * never lost between turns.
 */
export function normalizeCommand(raw: string): CommandSignals {
  let text = String(raw ?? "").trim();

  // Written Hebrew numbers -> digits, longest phrase first.
  const numberWord =
    /(?:(?:[ו]?(?:אחת|אחד|שתיים|שניים|שתי|שני|שלוש(?:ה)?|ארבע(?:ה)?|חמש(?:ה)?|שש|שישה|שבע(?:ה)?|שמונה|תשע(?:ה)?|עשר(?:ה)?|עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים|מאה|מאתיים|מאות|אלף|אלפיים|אלפים))\s*){2,}/g;
  text = text.replace(numberWord, (match) => {
    const value = hebrewWordsToNumber(match);
    return value === null ? match : ` ${value} `;
  });

  let currency: string | null = null;
  for (const [pattern, code] of CURRENCY_PATTERNS) {
    if (pattern.test(text)) { currency = code; break; }
  }

  let billingUnit: CommandSignals["billingUnit"] = null;
  if (/לשעה|per\s*hour|\/\s*hr|an\s*hour|בשעה|hourly|שעתי/i.test(text)) billingUnit = "hour";
  else if (/ליום|per\s*day|daily/i.test(text)) billingUnit = "day";
  else if (/לחודש|per\s*month|monthly/i.test(text)) billingUnit = "month";
  else if (/לפרויקט|per\s*project|fixed\s*price/i.test(text)) billingUnit = "project";

  const percentages = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|אחוז)/g)]
    .map((m) => Number(m[1])).filter((n) => Number.isFinite(n));
  const percentText = new Set(percentages.map((p) => String(p)));
  const amounts = [...text.matchAll(/(?<![\d.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\d.])/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && !percentText.has(String(n)));
  const dates = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]);

  return { normalized: text.replace(/\s+/g, " ").trim(), amounts, currency, billingUnit, percentages, dates };
}

// ------------------------------------------------------------------ routing

const COMMAND_HINTS =
  /(set|change|update|create|add|assign|approve|archive|delete|invite|mark|generate|cancel|retry|rename|restore|duplicate|publish|תעדכן|עדכן|תשנה|שנה|תקבע|קבע|צור|תיצור|הוסף|תוסיף|שייך|תשייך|אשר|תאשר|תארכב|ארכב|מחק|תמחק|הזמן|תזמין|תסמן|סמן|תפיק|בטל|תבטל|כן|תבצע|בצע|עשה|תעשה)/i;

/** Simple questions stay on the cheap model; anything that could change data does not. */
export function isComplexCommand(text: string, hasPendingIntent: boolean): boolean {
  if (hasPendingIntent) return true;
  if (COMMAND_HINTS.test(text)) return true;
  if (/\d/.test(text) && /(rate|תעריף|price|מחיר|margin|מרווח|date|תאריך|hours|שעות)/i.test(text)) return true;
  return text.length > 220;
}

// ------------------------------------------------------------------ model call

async function callJsonModel(model: string, system: string, user: string): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model,
      input: [{ role: "system", content: system }, { role: "user", content: user }],
      stream: true,
      store: false,
      max_output_tokens: 1500,
      reasoning: { effort: "low" },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Intent request failed [${res.status}]`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
          if (evt.type === "response.completed" && !text && evt.response?.output_text) text = evt.response.output_text;
        } catch { /* partial frame */ }
      }
    }
  }
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

const INTENT_SYSTEM = (catalog: string, queries: string) =>
  `You convert one agency-owner command into a STRUCTURED INTENT. You never execute anything and never invent records.

Reply with a single JSON object and nothing else:
{"intent": string, "action_type": string, "conversation_op": "new"|"correction"|"confirm"|"cancel"|"question"|"none",
 "target": {"entity_type": "project"|"client"|"supplier"|"payment"|"time_entry"|"none", "entity_id": string|null, "entity_name": string},
 "parameters": object, "missing_parameters": [string], "source_language": "he"|"en", "confidence": number, "admin_query": string}

"action_type" MUST be one of these, or "" when the user is only asking a question:
${catalog}

"admin_query" is "" unless the user is asking a system-wide question, in which case use one of: ${queries}.

conversation_op rules:
- "confirm" when the user approves the pending action ("yes", "do it", "כן", "תבצע", "אשר").
- "cancel" when the user withdraws it ("cancel", "תבטל", "עזוב").
- "correction" when the user changes a value or target of the PENDING ACTION ("לא 450, תשנה ל-400", "בשקלים לא בפאונד", "התכוונתי לפרויקט השני"). Keep the same action_type as the pending action and return ONLY the changed parameters.
- "new" for a fresh command, "question" for a read-only question, "none" for chit-chat.

Parameter rules:
- Reuse every value already present in PENDING ACTION MEMORY. Never list a parameter as missing when memory already holds it.
- Currency must be an ISO code: ILS (₪, ש"ח, שקל), GBP (£, פאונד), USD ($, דולר), EUR (€, אירו).
- "450 לשעה" means rate 450 with billing_unit "hour". Numbers may arrive as Hebrew words already converted to digits.
- Voice transcripts can be noisy: correct obvious mistakes using the context and the record names you were given.
- Prefer an entity_id from the context or memory; otherwise give the exact entity_name the user said.
- "missing_parameters" lists ONLY required values that are truly absent after merging memory.
- confidence is 0..1; below 0.5 means you are guessing.`;

export async function extractIntent(args: {
  command: string;
  signals: CommandSignals;
  catalog: string;
  queries: string[];
  memory: SlotMemory | null;
  contextDigest: string;
}): Promise<StructuredIntent | null> {
  const memoryBlock = args.memory
    ? JSON.stringify({
        action_type: args.memory.action_type,
        target: { id: args.memory.target_id, label: args.memory.target_label, type: args.memory.target_type },
        confirmed_parameters: args.memory.confirmed_parameters,
        missing_parameters: args.memory.missing_parameters,
        status: args.memory.status,
      })
    : "none";

  const user = `--- PENDING ACTION MEMORY ---
${memoryBlock}

--- SIGNALS DETECTED IN THE COMMAND ---
${JSON.stringify(args.signals)}

--- RECORDS IN CONTEXT ---
${args.contextDigest.slice(0, 12000)}

--- COMMAND (normalized) ---
${args.signals.normalized}

--- COMMAND (original) ---
${args.command}`;

  const raw = await callJsonModel(STRONG_MODEL, INTENT_SYSTEM(args.catalog, args.queries.join(", ")), user);
  if (!raw || typeof raw !== "object") return null;
  const target = raw.target ?? {};
  return {
    intent: String(raw.intent ?? "").slice(0, 80),
    action_type: String(raw.action_type ?? "").slice(0, 80),
    conversation_op: (["new", "correction", "confirm", "cancel", "question", "none"] as const)
      .includes(raw.conversation_op) ? raw.conversation_op : "none",
    target: {
      entity_type: String(target.entity_type ?? "none").slice(0, 20),
      entity_id: typeof target.entity_id === "string" && target.entity_id ? target.entity_id : null,
      entity_name: String(target.entity_name ?? "").slice(0, 120),
    },
    parameters: (raw.parameters && typeof raw.parameters === "object") ? raw.parameters : {},
    missing_parameters: Array.isArray(raw.missing_parameters)
      ? raw.missing_parameters.map((v: unknown) => String(v).slice(0, 40)).slice(0, 8) : [],
    source_language: raw.source_language === "he" ? "he" : "en",
    confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : 0.5,
    admin_query: String(raw.admin_query ?? "").slice(0, 60),
  };
}

// ------------------------------------------------------------------ slot memory

const EMPTY = (v: unknown) => v === undefined || v === null || v === "";

/** Merges a new extraction into memory WITHOUT dropping values already supplied. */
export function mergeSlots(memory: SlotMemory | null, intent: StructuredIntent, signals: CommandSignals): SlotMemory {
  const keepMemory = memory
    && (intent.conversation_op === "correction" || intent.conversation_op === "confirm"
      || intent.conversation_op === "none" || intent.action_type === "" || intent.action_type === memory.action_type);

  const base: SlotMemory = keepMemory
    ? { ...memory! }
    : {
        intent: intent.intent || intent.action_type,
        action_type: intent.action_type,
        target_type: intent.target.entity_type,
        target_id: null,
        target_label: intent.target.entity_name,
        confirmed_parameters: {},
        missing_parameters: [],
        source_language: intent.source_language,
        confidence: intent.confidence,
        status: "collecting",
        last_correction: "",
        operator_action_id: null,
      };

  const parameters: Record<string, unknown> = { ...base.confirmed_parameters };
  for (const [key, value] of Object.entries(intent.parameters)) {
    if (!EMPTY(value)) parameters[key] = value;
  }
  // Deterministic signals win over nothing, never over an explicit model value.
  if (EMPTY(parameters.currency) && signals.currency) parameters.currency = signals.currency;
  if (EMPTY(parameters.billing_unit) && signals.billingUnit) parameters.billing_unit = signals.billingUnit;

  if (intent.target.entity_id) {
    base.target_id = intent.target.entity_id;
    base.target_label = intent.target.entity_name || base.target_label;
  } else if (intent.target.entity_name && intent.conversation_op !== "confirm") {
    base.target_label = intent.target.entity_name;
    if (!keepMemory) base.target_id = null;
  }

  return {
    ...base,
    intent: intent.intent || base.intent,
    action_type: intent.action_type || base.action_type,
    target_type: intent.target.entity_type !== "none" ? intent.target.entity_type : base.target_type,
    confirmed_parameters: parameters,
    missing_parameters: intent.missing_parameters.filter((key) => EMPTY(parameters[key])),
    source_language: intent.source_language || base.source_language,
    confidence: intent.confidence || base.confidence,
    last_correction: intent.conversation_op === "correction" ? signals.normalized.slice(0, 300) : base.last_correction,
  };
}

/** Slot memory maps onto the catalog's input shape. */
export function slotsToActionInput(memory: SlotMemory): Record<string, unknown> {
  const input: Record<string, unknown> = { ...memory.confirmed_parameters };
  if (memory.target_id) {
    input[memory.target_type === "client" ? "clientId"
      : memory.target_type === "supplier" ? "supplierId" : "projectId"] = memory.target_id;
  }
  if (memory.target_label && !input.name) input.name = memory.target_label;
  return input;
}