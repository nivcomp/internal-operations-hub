import * as XLSX from "xlsx";
import type { ColumnMapping, SheetPlan, SheetType, TargetField } from "../types/crm";

export const MAX_ROWS_PER_IMPORT = 20000;

/** Neutralizes spreadsheet formula injection when a value is shown or stored. */
export function sanitizeCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const trimmed = raw.replace(/\u0000/g, "").trim();
  if (/^[=+\-@\t\r]/.test(trimmed) && !/^[-+]?\d/.test(trimmed)) return `'${trimmed}`;
  return trimmed;
}

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizePhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length > 9 ? digits.slice(-9) : digits;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function isValidPhone(value: string): boolean {
  return normalizePhone(value).length >= 7;
}

const HEADER_HINTS: { target: TargetField; patterns: RegExp[] }[] = [
  { target: "company", patterns: [/company/i, /organi[sz]ation/i, /business/i, /חברה/, /עסק/, /ארגון/] },
  { target: "name", patterns: [/contact/i, /full ?name/i, /^name$/i, /person/i, /שם/, /איש קשר/] },
  { target: "email", patterns: [/e-?mail/i, /מייל/, /דוא"?ל/] },
  { target: "phone", patterns: [/phone/i, /mobile/i, /tel/i, /whats/i, /טלפון/, /נייד/] },
  { target: "source", patterns: [/source/i, /channel/i, /referr/i, /מקור/] },
  { target: "stage", patterns: [/stage/i, /pipeline/i, /שלב/] },
  { target: "status", patterns: [/status/i, /סטטוס/, /מצב/] },
  { target: "service_interest", patterns: [/service/i, /interest/i, /need/i, /שירות/, /מעוניין/] },
  { target: "estimated_value", patterns: [/value/i, /budget/i, /amount/i, /price/i, /תקציב/, /סכום/, /מחיר/] },
  { target: "currency", patterns: [/currency/i, /מטבע/] },
  { target: "next_follow_up_at", patterns: [/follow ?up/i, /next ?contact/i, /מעקב/] },
  { target: "last_contact_at", patterns: [/last ?contact/i, /last ?call/i, /קשר אחרון/] },
  { target: "tags", patterns: [/tags?/i, /labels?/i, /תגיות/] },
  { target: "notes", patterns: [/notes?/i, /comment/i, /remark/i, /הערות/, /הערה/] },
  { target: "project_name", patterns: [/project/i, /job/i, /פרויקט/] },
  { target: "description", patterns: [/description/i, /scope/i, /תיאור/] },
  { target: "start_date", patterns: [/start/i, /התחלה/] },
  { target: "end_date", patterns: [/end/i, /finish/i, /סיום/] },
  { target: "technologies", patterns: [/tech/i, /stack/i, /tools?/i, /טכנולוג/] },
  { target: "outcome", patterns: [/outcome/i, /result/i, /תוצאה/] },
];

/** Local heuristic mapping used before (and as fallback for) the AI suggestion. */
export function guessMapping(headers: string[], rows: Record<string, string>[]): ColumnMapping[] {
  const used = new Set<TargetField>();
  return headers.map((header) => {
    const samples = rows.slice(0, 3).map((row) => row[header] ?? "").filter(Boolean);
    const hit = HEADER_HINTS.find(({ target, patterns }) =>
      !used.has(target) && patterns.some((pattern) => pattern.test(header)));
    if (hit) {
      used.add(hit.target);
      return { column: header, target: hit.target, confidence: "medium" as const, samples };
    }
    const looksEmail = samples.some((s) => isValidEmail(s));
    if (looksEmail && !used.has("email")) {
      used.add("email");
      return { column: header, target: "email" as TargetField, confidence: "medium" as const, samples };
    }
    return { column: header, target: "ignore" as TargetField, confidence: "low" as const, samples };
  });
}

export function guessSheetType(sheetName: string, headers: string[]): SheetType {
  const joined = `${sheetName} ${headers.join(" ")}`.toLowerCase();
  if (/past|history|previous|היסטור|קודמ/.test(joined)) return "past_projects";
  if (/note|comment|הערות/.test(joined) && !/email|phone/.test(joined)) return "notes";
  if (/client|customer|לקוח/.test(joined)) return "clients";
  if (/lead|prospect|ליד/.test(joined)) return "leads";
  if (/email|phone|מייל|טלפון/.test(joined)) return "leads";
  return "unknown";
}

function toRecord(rows: unknown[][], headerIndex: number): { headers: string[]; body: Record<string, string>[] } {
  const rawHeaders = (rows[headerIndex] ?? []).map((cell, index) => {
    const label = sanitizeCell(cell);
    return label || `עמודה ${index + 1}`;
  });
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count === 0 ? header : `${header} (${count + 1})`;
  });
  const body: Record<string, string>[] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, column) => {
      const value = sanitizeCell(row[column]);
      record[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) body.push(record);
  }
  return { headers, body };
}

/** Finds the first row that looks like a header (most non-empty text cells). */
function detectHeaderIndex(rows: unknown[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let index = 0; index < Math.min(rows.length, 10); index += 1) {
    const cells = (rows[index] ?? []).map((cell) => sanitizeCell(cell));
    const filled = cells.filter(Boolean).length;
    const textual = cells.filter((cell) => cell && !/^\d+([.,]\d+)?$/.test(cell)).length;
    const score = filled + textual;
    if (score > bestScore) { bestScore = score; best = index; }
  }
  return best;
}

export async function parseWorkbook(file: File): Promise<SheetPlan[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, cellFormula: false, raw: false });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
    if (!matrix.length) {
      return {
        sheetName, sheetType: "unknown" as SheetType, headers: [], rowCount: 0, rows: [],
        mapping: [], warnings: ["הגיליון ריק"], include: false,
      };
    }
    const headerIndex = detectHeaderIndex(matrix);
    const { headers, body } = toRecord(matrix, headerIndex);
    const warnings: string[] = [];
    if (headerIndex > 0) warnings.push(`שורת הכותרות זוהתה בשורה ${headerIndex + 1}`);
    if (body.length > MAX_ROWS_PER_IMPORT) {
      warnings.push(`הגיליון גדול מ־${MAX_ROWS_PER_IMPORT} שורות — רק ${MAX_ROWS_PER_IMPORT} הראשונות ייובאו`);
    }
    const rows = body.slice(0, MAX_ROWS_PER_IMPORT);
    const sheetType = guessSheetType(sheetName, headers);
    return {
      sheetName,
      sheetType,
      headers,
      rowCount: rows.length,
      rows,
      mapping: guessMapping(headers, rows),
      warnings,
      include: rows.length > 0 && sheetType !== "unknown",
    };
  });
}

export const TARGET_LABELS_HE: Record<TargetField, string> = {
  ignore: "התעלם",
  note: "הוסף להערות",
  name: "שם איש קשר",
  company: "חברה",
  email: "אימייל",
  phone: "טלפון",
  source: "מקור",
  stage: "שלב",
  status: "סטטוס",
  service_interest: "תחום עניין",
  estimated_value: "שווי משוער",
  currency: "מטבע",
  notes: "הערות",
  tags: "תגיות",
  next_follow_up_at: "מעקב הבא",
  last_contact_at: "קשר אחרון",
  project_name: "שם פרויקט",
  description: "תיאור",
  start_date: "תאריך התחלה",
  end_date: "תאריך סיום",
  value: "שווי",
  technologies: "טכנולוגיות",
  outcome: "תוצאה",
};

export const LEAD_TARGETS: TargetField[] = [
  "ignore", "note", "name", "company", "email", "phone", "source", "stage", "status",
  "service_interest", "estimated_value", "currency", "notes", "tags", "next_follow_up_at", "last_contact_at",
];

export const PAST_PROJECT_TARGETS: TargetField[] = [
  "ignore", "note", "company", "project_name", "description", "status", "start_date", "end_date",
  "value", "currency", "technologies", "outcome", "notes",
];

export function targetsForSheet(type: SheetType): TargetField[] {
  return type === "past_projects" ? PAST_PROJECT_TARGETS : LEAD_TARGETS;
}
