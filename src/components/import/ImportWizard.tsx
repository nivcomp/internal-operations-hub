import { useMemo, useState } from "react";
import {
  MAX_ROWS_PER_IMPORT, TARGET_LABELS_HE, parseWorkbook, targetsForSheet,
} from "../../lib/importParsing";
import { buildErrorReport, previewSheet, retryFailedRows, runImport, suggestMapping, uploadSourceFile } from "../../services/importApi";
import type {
  ImportRunResult, PreviewResult, RowResolution, SheetPlan, SheetType, TargetField,
} from "../../types/crm";

type Step = "upload" | "sheets" | "mapping" | "preview" | "done";

const SHEET_TYPE_LABELS: Record<SheetType, string> = {
  leads: "לידים",
  clients: "לקוחות",
  contacts: "אנשי קשר",
  past_projects: "פרויקטים קודמים",
  notes: "הערות",
  unknown: "לא ידוע",
};

const RESOLUTION_LABELS: Record<RowResolution, string> = {
  create: "צור חדש",
  merge: "מזג לרשומה קיימת",
  update: "עדכן קיים",
  skip: "דלג",
  review_later: "לבדיקה מאוחרת",
};

function downloadCsv(name: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetPlan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewResult[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Record<string, RowResolution>>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [aiMappingFailed, setAiMappingFailed] = useState(false);

  const included = useMemo(() => sheets.filter((sheet) => sheet.include && sheet.rows.length > 0), [sheets]);

  async function handleFile(nextFile: File) {
    setError(null);
    setBusy("קורא את הקובץ…");
    try {
      const parsed = await parseWorkbook(nextFile);
      if (!parsed.length) throw new Error("לא נמצאו גיליונות בקובץ");
      setFile(nextFile);
      setSheets(parsed);
      setStep("sheets");
      void uploadSourceFile(nextFile).then(setStoragePath);
    } catch (parseError) {
      setError((parseError as Error).message || "לא הצלחנו לקרוא את הקובץ");
    } finally {
      setBusy(null);
    }
  }

  async function applyAiSuggestions() {
    setBusy("ה-AI מציע מיפוי…");
    setError(null);
    try {
      const suggestions = await suggestMapping(included.length ? included : sheets);
      setAiMappingFailed(false);
      setSheets((current) => current.map((sheet) => {
        const suggestion = suggestions.find((item) => item.sheetName === sheet.sheetName);
        if (!suggestion) return sheet;
        const allowed = targetsForSheet((suggestion.sheetType as SheetType) ?? sheet.sheetType);
        return {
          ...sheet,
          sheetType: (suggestion.sheetType as SheetType) ?? sheet.sheetType,
          mapping: sheet.mapping.map((entry) => {
            const column = suggestion.columns?.find((item) => item.column === entry.column);
            if (!column) return entry;
            const target = column.target as TargetField;
            if (!allowed.includes(target)) return entry;
            return {
              ...entry,
              target,
              confidence: (column.confidence as "high" | "medium" | "low") ?? "medium",
            };
          }),
        };
      }));
    } catch (aiError) {
      setAiMappingFailed(true);
      setStep("mapping");
      setError(`המיפוי האוטומטי אינו זמין כרגע. אפשר להמשיך במיפוי ידני או לנסות שוב. ${(aiError as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function buildPreview() {
    setBusy("בודק את הנתונים…");
    setError(null);
    try {
      const results: PreviewResult[] = [];
      for (const sheet of included) results.push(await previewSheet(sheet));
      setPreviews(results);
      setResolutions((current) => {
        const next = { ...current };
        for (const preview of results) {
          const sheetMap = { ...(next[preview.sheetName] ?? {}) };
          for (const duplicate of preview.duplicates) {
            if (!sheetMap[String(duplicate.rowIndex)]) sheetMap[String(duplicate.rowIndex)] = "merge";
          }
          for (const rowIndex of preview.missingRequired) sheetMap[String(rowIndex)] = "skip";
          next[preview.sheetName] = sheetMap;
        }
        return next;
      });
      setStep("preview");
    } catch (previewError) {
      setError((previewError as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function execute() {
    if (!file) return;
    setBusy("מייבא…");
    setError(null);
    setProgress({ done: 0, total: included.reduce((sum, sheet) => sum + sheet.rows.length, 0) });
    try {
      const runResult = await runImport({
        file, storagePath, sheets: included, resolutions,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(runResult);
      setStep("done");
      onImported();
    } catch (runError) {
      setError((runError as Error).message);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function retry() {
    if (!result) return;
    setBusy("מנסה שוב את השורות שנכשלו…");
    try {
      const retryResult = await retryFailedRows(result.batchId, included);
      setResult({ ...retryResult, batchId: result.batchId });
      onImported();
    } catch (retryError) {
      setError((retryError as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="simple-drawer-backdrop" role="dialog" aria-modal="true" dir="rtl">
      <div className="simple-drawer import-wizard">
        <header className="import-head">
          <div>
            <strong>ייבוא Excel / CSV</strong>
            <span className="simple-note">
              {file ? `${file.name} · ${(file.size / 1024).toFixed(0)}KB` : "העלה קובץ לידים, לקוחות או פרויקטים קודמים"}
            </span>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>סגור</button>
        </header>

        <ol className="import-steps">
          {(["upload", "sheets", "mapping", "preview", "done"] as Step[]).map((item, index) => (
            <li key={item} className={step === item ? "active" : ""}>
              {index + 1}. {{ upload: "קובץ", sheets: "גיליונות", mapping: "מיפוי", preview: "בדיקה", done: "סיום" }[item]}
            </li>
          ))}
        </ol>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {busy ? <p className="simple-note">{busy}</p> : null}
        {progress ? <p className="simple-note">{progress.done} מתוך {progress.total} שורות</p> : null}

        {step === "upload" ? (
          <div className="import-drop">
            <p>גרור לכאן קובץ .xlsx, .xls או .csv, או בחר קובץ.</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void handleFile(selected);
              }}
            />
            <p className="simple-note">עד {MAX_ROWS_PER_IMPORT.toLocaleString("he-IL")} שורות בכל ייבוא. הקובץ נשמר לצורכי ביקורת בלבד.</p>
          </div>
        ) : null}

        {step === "sheets" ? (
          <div className="import-body">
            {sheets.map((sheet) => (
              <article key={sheet.sheetName} className="card import-sheet">
                <header>
                  <label>
                    <input
                      type="checkbox"
                      checked={sheet.include}
                      onChange={(event) => setSheets((current) => current.map((item) =>
                        item.sheetName === sheet.sheetName ? { ...item, include: event.target.checked } : item))}
                    />
                    <strong>{sheet.sheetName}</strong>
                  </label>
                  <span className="simple-note">{sheet.rowCount} שורות · {sheet.headers.length} עמודות</span>
                </header>
                <label>
                  סוג הגיליון
                  <select
                    value={sheet.sheetType}
                    onChange={(event) => setSheets((current) => current.map((item) =>
                      item.sheetName === sheet.sheetName ? { ...item, sheetType: event.target.value as SheetType } : item))}
                  >
                    {(Object.keys(SHEET_TYPE_LABELS) as SheetType[]).map((type) => (
                      <option key={type} value={type}>{SHEET_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                {sheet.warnings.map((warning) => <p key={warning} className="simple-note">⚠ {warning}</p>)}
              </article>
            ))}
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => void applyAiSuggestions()}>הצע מיפוי עם AI</button>
              <button type="button" className="primary-button" disabled={!included.length} onClick={() => setStep("mapping")}>
                המשך למיפוי
              </button>
            </div>
          </div>
        ) : null}

        {step === "mapping" ? (
          <div className="import-body">
            {aiMappingFailed ? (
              <div className="card" role="status">
                <p>המיפוי האוטומטי אינו זמין כרגע. אפשר להמשיך במיפוי ידני או לנסות שוב.</p>
                <div className="form-actions">
                  <button type="button" className="ghost-button" disabled={!!busy} onClick={() => void applyAiSuggestions()}>
                    נסה מיפוי אוטומטי שוב
                  </button>
                  <button type="button" className="primary-button" onClick={() => { setAiMappingFailed(false); setError(null); }}>
                    המשך במיפוי ידני
                  </button>
                </div>
              </div>
            ) : null}
            {included.map((sheet) => (
              <article key={sheet.sheetName} className="card import-sheet">
                <header><strong>{sheet.sheetName}</strong><span className="simple-note">{SHEET_TYPE_LABELS[sheet.sheetType]}</span></header>
                <table className="import-map-table">
                  <thead>
                    <tr><th>עמודה בקובץ</th><th>דוגמאות</th><th>יעד</th><th>ביטחון</th></tr>
                  </thead>
                  <tbody>
                    {sheet.mapping.map((entry) => (
                      <tr key={entry.column}>
                        <td>{entry.column}</td>
                        <td className="simple-note">{entry.samples.slice(0, 2).join(" · ") || "—"}</td>
                        <td>
                          <select
                            value={entry.target}
                            onChange={(event) => setSheets((current) => current.map((item) => item.sheetName !== sheet.sheetName ? item : {
                              ...item,
                              mapping: item.mapping.map((mapEntry) => mapEntry.column === entry.column
                                ? { ...mapEntry, target: event.target.value as TargetField, confidence: "high" }
                                : mapEntry),
                            }))}
                          >
                            {targetsForSheet(sheet.sheetType).map((target) => (
                              <option key={target} value={target}>{TARGET_LABELS_HE[target]}</option>
                            ))}
                          </select>
                        </td>
                        <td>{{ high: "גבוה", medium: "בינוני", low: "נמוך" }[entry.confidence]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setStep("sheets")}>חזרה</button>
              <button type="button" className="primary-button" onClick={() => void buildPreview()}>בדוק לפני ייבוא</button>
            </div>
          </div>
        ) : null}

        {step === "preview" ? (
          <div className="import-body">
            {previews.map((preview) => {
              const sheet = included.find((item) => item.sheetName === preview.sheetName);
              return (
                <article key={preview.sheetName} className="card import-sheet">
                  <header><strong>{preview.sheetName}</strong><span className="simple-note">{SHEET_TYPE_LABELS[preview.sheetType]}</span></header>
                  <dl className="simple-facts">
                    <div><dt>ייווצרו</dt><dd>{preview.toCreate}</dd></div>
                    <div><dt>כפילויות</dt><dd>{preview.duplicates.length}</dd></div>
                    <div><dt>מיילים לא תקינים</dt><dd>{preview.invalidEmails.length}</dd></div>
                    <div><dt>טלפונים לא תקינים</dt><dd>{preview.invalidPhones.length}</dd></div>
                    <div><dt>חסר שדה חובה</dt><dd>{preview.missingRequired.length}</dd></div>
                    <div><dt>הערות שיתווספו</dt><dd>{preview.notesToAppend}</dd></div>
                  </dl>
                  {preview.ignoredColumns.length ? (
                    <p className="simple-note">עמודות שלא ייובאו: {preview.ignoredColumns.join(", ")}</p>
                  ) : null}
                  {preview.duplicates.length ? (
                    <table className="import-map-table">
                      <thead><tr><th>שורה</th><th>התאמה</th><th>סיבה</th><th>מה לעשות</th></tr></thead>
                      <tbody>
                        {preview.duplicates.slice(0, 50).map((duplicate) => (
                          <tr key={`${duplicate.rowIndex}-${duplicate.matchId}`}>
                            <td>{duplicate.rowIndex + 1}</td>
                            <td>{duplicate.matchLabel} ({duplicate.matchType === "client" ? "לקוח" : "ליד"})</td>
                            <td>{{ email: "אימייל", phone: "טלפון", company: "חברה", name: "שם" }[duplicate.reason]}</td>
                            <td>
                              <select
                                value={resolutions[preview.sheetName]?.[String(duplicate.rowIndex)] ?? "merge"}
                                onChange={(event) => setResolutions((current) => ({
                                  ...current,
                                  [preview.sheetName]: {
                                    ...(current[preview.sheetName] ?? {}),
                                    [String(duplicate.rowIndex)]: event.target.value as RowResolution,
                                  },
                                }))}
                              >
                                {(Object.keys(RESOLUTION_LABELS) as RowResolution[]).map((value) => (
                                  <option key={value} value={value}>{RESOLUTION_LABELS[value]}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {preview.missingRequired.length && sheet ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => downloadCsv(
                        `שורות-בעייתיות-${preview.sheetName}.csv`,
                        ["row,issue", ...preview.missingRequired.map((r) => `${r + 1},missing name/company`)].join("\n"),
                      )}
                    >
                      הורד דוח שורות בעייתיות
                    </button>
                  ) : null}
                </article>
              );
            })}
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setStep("mapping")}>חזרה למיפוי</button>
              <button type="button" className="primary-button" disabled={!!busy} onClick={() => void execute()}>
                אשר וייבא
              </button>
            </div>
          </div>
        ) : null}

        {step === "done" && result ? (
          <div className="import-body">
            <dl className="simple-facts">
              <div><dt>נוצרו</dt><dd>{result.created}</dd></div>
              <div><dt>עודכנו</dt><dd>{result.updated}</dd></div>
              <div><dt>דולגו</dt><dd>{result.skipped}</dd></div>
              <div><dt>נכשלו</dt><dd>{result.failed}</dd></div>
            </dl>
            {result.errors.length ? (
              <>
                <ul className="simple-note">
                  {result.errors.slice(0, 10).map((item) => <li key={`${item.rowIndex}-${item.message}`}>שורה {item.rowIndex + 1}: {item.message}</li>)}
                </ul>
                <div className="form-actions">
                  <button type="button" className="ghost-button" onClick={() => downloadCsv("import-errors.csv", buildErrorReport(result))}>
                    הורד דוח שגיאות
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void retry()}>נסה שוב רק את השורות שנכשלו</button>
                </div>
              </>
            ) : <p className="simple-note">הייבוא הסתיים ללא שגיאות.</p>}
            <div className="form-actions">
              <button type="button" className="primary-button" onClick={onClose}>סיום</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
