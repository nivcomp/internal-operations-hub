import { supabase } from "../integrations/supabase/client";
import type {
  ColumnMapping, ImportRunResult, PreviewResult, RowResolution, SheetPlan,
} from "../types/crm";

const CHUNK_SIZE = 200;

async function functionErrorMessage(name: string, error: unknown): Promise<string> {
  const context = (error as any)?.context as Response | undefined;
  const status = context?.status;
  let serverMessage = "";
  if (context && typeof context.text === "function") {
    const detail = await context.clone().text().catch(() => "");
    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        serverMessage = String(parsed?.error ?? parsed?.message ?? "");
        if (parsed?.code === "NOT_FOUND") return `Function ${name} is not deployed.`;
      } catch {
        serverMessage = detail.slice(0, 240);
      }
    }
  }
  if (status === 404) return `Function ${name} is not deployed.`;
  if (status === 401) return "Your session expired. Sign in again.";
  if (status === 403) return "You do not have permission to import CRM data.";
  if (/AI mapping is not configured/i.test(serverMessage)) {
    return "AI mapping is not configured. You may continue with manual column mapping.";
  }
  if (/selected AI model is unavailable|model.+(not found|unsupported|unavailable)/i.test(serverMessage)) {
    return "The selected AI model is unavailable.";
  }
  if (serverMessage) return serverMessage;
  const fallback = String((error as Error)?.message ?? "");
  if (/failed to send|fetch/i.test(fallback)) {
    return `Could not reach ${name}. The function may not be deployed or the network may be unavailable.`;
  }
  return fallback || `Function ${name} failed.`;
}

async function callImport<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("crm-import", { body: payload });
  if (error) throw new Error(await functionErrorMessage("crm-import", error));
  if (data && typeof data === "object" && "error" in data && (data as any).error) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

/** Keeps the original file for the audit trail; failure never blocks the import. */
export async function uploadSourceFile(file: File): Promise<string | null> {
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name}`.slice(0, 380);
  const { error } = await supabase.storage.from("crm-imports").upload(path, file, { upsert: false });
  if (error) {
    console.warn("Import file was not archived:", error.message);
    return null;
  }
  return path;
}

export async function suggestMapping(sheets: SheetPlan[]): Promise<{
  sheetName: string; sheetType: string; columns: { column: string; target: string; confidence?: string }[];
}[]> {
  const payload = sheets.map((sheet) => ({
    sheetName: sheet.sheetName,
    headers: sheet.headers,
    samples: sheet.rows.slice(0, 3),
  }));
  const data = await (async () => {
    const { data, error } = await supabase.functions.invoke("crm-ai-map", {
      body: { action: "suggestMapping", sheets: payload },
    });
    if (error) throw new Error(await functionErrorMessage("crm-ai-map", error));
    return data as any;
  })();
  return data?.sheets ?? [];
}

function columnsOf(mapping: ColumnMapping[]) {
  return mapping.map((entry) => ({ column: entry.column, target: entry.target }));
}

export async function previewSheet(sheet: SheetPlan): Promise<PreviewResult> {
  const data = await callImport<{ preview: PreviewResult }>({
    action: "preview",
    sheetName: sheet.sheetName,
    sheetType: sheet.sheetType,
    columns: columnsOf(sheet.mapping),
    rows: sheet.rows.map((values, rowIndex) => ({ rowIndex, values })),
  });
  return data.preview;
}

export async function runImport(input: {
  file: File;
  storagePath: string | null;
  sheets: SheetPlan[];
  resolutions: Record<string, Record<string, RowResolution>>;
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportRunResult> {
  const { file, storagePath, sheets, resolutions, onProgress } = input;
  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);

  const { batch } = await callImport<{ batch: { id: string } }>({
    action: "createBatch",
    fileName: file.name,
    fileType: file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
    storagePath,
    totalRows,
    mapping: Object.fromEntries(sheets.map((sheet) => [sheet.sheetName, {
      sheetType: sheet.sheetType, columns: columnsOf(sheet.mapping),
    }])),
  });

  const result: ImportRunResult = {
    batchId: batch.id, created: 0, updated: 0, skipped: 0, failed: 0, errors: [],
  };
  let done = 0;

  for (const sheet of sheets) {
    for (let start = 0; start < sheet.rows.length; start += CHUNK_SIZE) {
      const chunk = sheet.rows.slice(start, start + CHUNK_SIZE)
        .map((values, offset) => ({ rowIndex: start + offset, values }));
      const chunkResult = await callImport<{
        created: number; updated: number; skipped: number; failed: number;
        errors: { rowIndex: number; message: string }[];
      }>({
        action: "executeChunk",
        batchId: batch.id,
        sheetName: sheet.sheetName,
        sheetType: sheet.sheetType,
        columns: columnsOf(sheet.mapping),
        rows: chunk,
        resolutions: resolutions[sheet.sheetName] ?? {},
      });
      result.created += chunkResult.created;
      result.updated += chunkResult.updated;
      result.skipped += chunkResult.skipped;
      result.failed += chunkResult.failed;
      result.errors.push(...chunkResult.errors.map((e) => ({ ...e, message: `${sheet.sheetName}: ${e.message}` })));
      done += chunk.length;
      onProgress?.(done, totalRows);
    }
  }

  await callImport({ action: "finishBatch", batchId: batch.id });
  return result;
}

export async function fetchFailedRows(batchId: string): Promise<{
  rowIndex: number; values: Record<string, string>; sheetName: string; sheetType: string;
}[]> {
  const data = await callImport<{ rows: any[] }>({ action: "retryFailed", batchId });
  return data.rows ?? [];
}

/** Re-sends only the rows that failed, using the mapping of their sheet. */
export async function retryFailedRows(batchId: string, sheets: SheetPlan[]): Promise<ImportRunResult> {
  const failed = await fetchFailedRows(batchId);
  const result: ImportRunResult = { batchId, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  const grouped = new Map<string, typeof failed>();
  for (const row of failed) {
    const list = grouped.get(row.sheetName) ?? [];
    list.push(row);
    grouped.set(row.sheetName, list);
  }
  for (const [sheetName, rows] of grouped) {
    const sheet = sheets.find((item) => item.sheetName === sheetName);
    if (!sheet) continue;
    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      const chunkResult = await callImport<any>({
        action: "executeChunk",
        batchId,
        sheetName,
        sheetType: sheet.sheetType,
        columns: columnsOf(sheet.mapping),
        rows: rows.slice(start, start + CHUNK_SIZE).map((row) => ({ rowIndex: row.rowIndex, values: row.values })),
      });
      result.created += chunkResult.created;
      result.updated += chunkResult.updated;
      result.skipped += chunkResult.skipped;
      result.failed += chunkResult.failed;
      result.errors.push(...(chunkResult.errors ?? []));
    }
  }
  return result;
}

export function buildErrorReport(result: ImportRunResult): string {
  const header = "row,message";
  const lines = result.errors.map((e) => `${e.rowIndex + 1},"${e.message.replace(/"/g, "'")}"`);
  return [header, ...lines].join("\n");
}
