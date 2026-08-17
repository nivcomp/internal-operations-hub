import { deliverable } from "../../lib/clientWording";
import { useEffect, useMemo, useState } from "react";
import {
  generateClientLivePreview, generatePrototype, getPrototypeFreshness, listProjectPrototypes, recordPrototypeDecision, sharePrototype,
  type ProjectPrototype, type PrototypeKind, type PrototypeScreen, type PrototypeVersion,
} from "../../services/prototypeApi";
import { ConfirmDialog } from "../ui/ConfirmDialog";

type Props = {
  projectId: string;
  projectName: string;
  readOnly?: boolean;
  clientMode?: boolean;
  simple?: boolean;
  language?: "he" | "en";
  refreshToken?: number;
  allowClientLivePreview?: boolean;
};

const kindLabels: Record<PrototypeKind, string> = { app: "אפליקציה / אתר", whatsapp: "בוט WhatsApp", automation: "אוטומציה" };

export function PrototypeStudio({
  projectId, projectName, readOnly = false, clientMode = false, simple = false,
  language = "he", refreshToken, allowClientLivePreview = false,
}: Props) {
  const [prototypes, setPrototypes] = useState<ProjectPrototype[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [prototypeId, setPrototypeId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [screenId, setScreenId] = useState("");
  const [kind, setKind] = useState<PrototypeKind>("app");
  const [instructions, setInstructions] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [studioFullScreen, setStudioFullScreen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [freshness, setFreshness] = useState({ hasMvp: false, isStale: false, version: undefined as number | undefined });
  const showLivePreviewControls = allowClientLivePreview && clientMode && readOnly;

  async function refresh(preferredPrototypeId?: string, preferredVersionId?: string) {
    const [result, nextFreshness] = await Promise.all([
      listProjectPrototypes(projectId),
      showLivePreviewControls
        ? getPrototypeFreshness(projectId).catch(() => ({ hasMvp: false, isStale: false, version: undefined }))
        : Promise.resolve(null),
    ]);
    const visiblePrototypes = clientMode
      ? result.prototypes
          .map((item) => ({ ...item, versions: item.versions.filter((version) => version.audience === "client" && (version.status === "shared" || version.status === "approved")) }))
          .filter((item) => item.versions.length > 0)
      : result.prototypes;
    setPrototypes(visiblePrototypes); setApprovals(result.approvals);
    const selectedPrototype = visiblePrototypes.find((item) => item.id === (preferredPrototypeId || prototypeId)) ?? visiblePrototypes[0];
    const selectedVersion = selectedPrototype?.versions.find((item) => item.id === (preferredVersionId || versionId)) ?? selectedPrototype?.versions[0];
    setPrototypeId(selectedPrototype?.id ?? ""); setVersionId(selectedVersion?.id ?? "");
    setScreenId((current) => selectedVersion?.content.screens.some((screen) => screen.id === current) ? current : selectedVersion?.content.startScreenId ?? "");
    if (nextFreshness) setFreshness(nextFreshness);
  }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, [projectId, refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const prototype = prototypes.find((item) => item.id === prototypeId) ?? prototypes[0];
  const version = prototype?.versions.find((item) => item.id === versionId) ?? prototype?.versions[0];
  const screen = version?.content.screens.find((item) => item.id === screenId) ?? version?.content.screens[0];
  const decision = approvals.find((item) => item.prototype_version_id === version?.id);
  const hasShared = prototype?.versions.some((item) => item.status === "shared" || item.status === "approved");

  async function readSource(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth/mammoth.browser");
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        setSourceText(result.value.slice(0, 18000));
      } else {
        setSourceText((await file.text()).slice(0, 18000));
      }
      setNotice(`החומר מתוך ${file.name} נטען ויצורף לגרסה הבאה.`);
    } catch (e) { setError(e instanceof Error ? e.message : "לא ניתן לקרוא את הקובץ."); }
  }

  async function createRevision() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await generatePrototype({ projectId, prototypeId: prototype?.id, kind: prototype?.prototype_kind ?? kind, title: prototype?.title || `${projectName} MVP`, instructions, sourceText });
      if (result.version.status === "draft") {
        try { await sharePrototype(projectId, result.version.id); } catch { /* keep the new version even if auto-share fails */ }
      }
      await refresh(result.prototypeId, result.version.id); setInstructions("");
      setNotice(`נוצרה גרסה ${result.version.version} והיא שותפה אוטומטית עם הלקוח בפורטל שלו.`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function createLivePreview() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await generateClientLivePreview({ projectId, prototypeId: prototype?.id });
      await refresh(result.prototypeId, result.version.id);
      setNotice(language === "he"
        ? result.reused
          ? "התצוגה כבר מעודכנת — לא בוצעה יצירת AI נוספת."
          : "התצוגה החיה נוצרה והיא מחוברת לפרויקט שלך."
        : result.reused
          ? "Your preview is already current — no additional AI generation was used."
          : "Your live preview is ready and connected to this project.");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function share() {
    if (!version) return; setBusy(true); setError("");
    try { await sharePrototype(projectId, version.id); await refresh(prototype.id, version.id); setNotice("הגרסה זמינה כעת בפורטל הלקוח."); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  async function decide(value: "approved" | "changes_requested") {
    if (!version) return; setBusy(true); setError("");
    try { await recordPrototypeDecision(version, value, comment); await refresh(prototype.id, version.id); setComment(""); setNotice(value === "approved" ? "האישור נשמר לגרסה המדויקת הזו." : "בקשת השינויים נשמרה."); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  async function reopenForChanges() {
    if (!version) return;
    setBusy(true); setError(""); setNotice("");
    const reason = comment.trim() || (language === "he" ? "האישור בוטל כדי לחזור לתיקונים." : "Approval withdrawn to return for changes.");
    try {
      await recordPrototypeDecision(version, "changes_requested", reason);
      await refresh(prototype.id, version.id);
      setComment(""); setReopenDialogOpen(false);
      setNotice(language === "he" ? "האישור בוטל. הגרסה והשיחה נשמרו, והפרויקט חזר לתיקונים." : "Approval withdrawn. The version and conversation were preserved and the project is back in review.");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const handoffPayload = useMemo(() => version ? JSON.stringify({ project: projectName, prototypeType: prototype?.prototype_kind, version: version.version, summary: version.summary, ui: version.content, rules: ["Preserve the approved screens and interactions", "Implement authentication and role isolation", "Do not invent pricing or expose internal agency data", "Create the required database schema and integrations from the supplied specification"] }, null, 2) : "", [version, prototype?.prototype_kind, projectName]);
  async function copyExport(platform: "Lovable" | "Base44") { await navigator.clipboard.writeText(`Build an implementation of this reviewed MVP in ${platform}. Treat the JSON as the approved product contract. Include the required database, authentication, permissions, integrations and automation flows. Ask before inventing missing business rules.\n\n${handoffPayload}`); setNotice(`חבילת ה־MVP הועתקה עבור ${platform}. יש לבדוק אותה לפני ההדבקה.`); }

  const thing = deliverable(prototype?.prototype_kind ?? null, language);
  const clientCopy = language === "he" ? {
    title: thing.name, empty: `עדיין לא שיתפנו איתך תצוגה של ${thing.short}. נעדכן אותך ברגע שתהיה מוכנה.`,
    fullscreen: "פתח במסך מלא", exit: "צא ממסך מלא",
    prototype: "מה שבונים", version: "גרסה", approval: "האישור שלך לגרסה", approved: "אישרת את הגרסה", changes: "ביקשת שינויים",
    placeholder: "הערה או שינוי שתרצה", approve: "זה מתאים לי", request: "יש לי הערות",
    approvedHelp: "אישרת בטעות או שינית את דעתך? אפשר לבטל את האישור ולחזור לתיקונים.",
    undo: "ביטול האישור וחזרה לתיקונים", undoTitle: "לבטל את האישור?",
    undoDescription: "האישור לגרסה הזו יבוטל והסוכנות תראה שהפרויקט חזר לתיקונים. הגרסה, השיחה והאישור המקורי יישמרו בהיסטוריה.",
    undoConfirm: "כן, בטל את האישור", cancel: "לא, השאר מאושר",
    changesHelp: "הגרסה נשמרה. הסוכנות תראה את הבקשה ותוכל להכין גרסה מתוקנת.",
    liveTitle: "התצוגה החיה של הפרויקט",
    liveHelp: "ניצור המחשה ויזואלית מתוך מה שכבר סיכמנו בשיחה. אם לא השתנה מידע, נציג את הגרסה הקיימת בלי להשתמש שוב ב־AI.",
    liveCreate: "צור תצוגה חיה",
    liveRefresh: "עדכן את התצוגה",
    liveBusy: "מכין תצוגה…",
    liveCurrent: "התצוגה מעודכנת",
    viewOnly: "המחשה בלבד — הכפתורים מדגימים מעבר בין מסכים ואינם מפעילים מערכת, שולחים הודעות או משנים נתונים.",
    liveDraft: "זו תצוגה ראשונית מתוך השיחה, ולא אישור סופי של היקף הפרויקט.",
  } : {
    title: thing.name, empty: `We have not shared a preview of ${thing.short} with you yet. We will let you know once it is ready.`,
    fullscreen: "Open full screen", exit: "Exit full screen",
    prototype: "What we are building", version: "Version", approval: "Your approval for version", approved: "You approved this version", changes: "You asked for changes",
    placeholder: "A comment or change you would like", approve: "This works for me", request: "I have comments",
    approvedHelp: "Approved by mistake or changed your mind? You can withdraw approval and return it for changes.",
    undo: "Withdraw approval and request changes", undoTitle: "Withdraw this approval?",
    undoDescription: "This version will return for changes and the agency will be notified. The version, conversation and original approval stay in the history.",
    undoConfirm: "Yes, withdraw approval", cancel: "Keep it approved",
    changesHelp: "The version is preserved. The agency can now review your request and prepare a corrected version.",
    liveTitle: "Your live project preview",
    liveHelp: "We create a visual preview from what is already captured in the project. If nothing changed, we reuse the current version without another AI generation.",
    liveCreate: "Create live preview",
    liveRefresh: "Update preview",
    liveBusy: "Preparing preview…",
    liveCurrent: "Preview is up to date",
    viewOnly: "Preview only — buttons demonstrate navigation and do not run the system, send messages or change data.",
    liveDraft: "This is an early visual based on the conversation, not final scope approval.",
  };

  const isClientLivePreview = Boolean(version?.source_notes?.startsWith("[CLIENT_LIVE_PREVIEW]"));

  if (!version && readOnly && !showLivePreviewControls) return <section className="card prototype-empty"><h2>{clientCopy.title}</h2><p>{clientCopy.empty}</p></section>;

  return <section className={`card prototype-studio${simple ? " prototype-simple" : ""}${studioFullScreen ? " prototype-fullscreen" : ""}`} dir={language === "he" ? "rtl" : "ltr"}>
    <header className="prototype-head"><div><p className="eyebrow">{clientMode ? clientCopy.title : "MVP חזותי שמור"}</p><h2>{prototype?.title || projectName}</h2><p>{version?.summary || (clientMode ? clientCopy.empty : "צור אב־טיפוס לחיץ מתוך השיחה, האפיון או קובץ Word.")}</p></div><div className="prototype-head-actions">{version ? <span className={`prototype-status ${version.status}`}>{clientMode ? `${clientCopy.version} ${version.version}` : `v${version.version} · ${version.status}`}</span> : null}<button type="button" onClick={() => setStudioFullScreen((value) => !value)}>{studioFullScreen ? clientCopy.exit : clientCopy.fullscreen}</button></div></header>

    {showLivePreviewControls ? <div className="prototype-live-controls">
      <div>
        <span className="prototype-live-dot" aria-hidden="true" />
        <div><strong>{clientCopy.liveTitle}</strong><p>{clientCopy.liveHelp}</p></div>
      </div>
      <button className="primary-button" type="button" disabled={busy || (freshness.hasMvp && !freshness.isStale)} onClick={() => void createLivePreview()}>
        {busy ? clientCopy.liveBusy : !freshness.hasMvp ? clientCopy.liveCreate : freshness.isStale ? clientCopy.liveRefresh : clientCopy.liveCurrent}
      </button>
    </div> : null}

    {!readOnly ? <div className="prototype-authoring">
      {!prototype ? <label>סוג MVP<select value={kind} onChange={(e) => setKind(e.target.value as PrototypeKind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
      <label className="span-2">מה לשנות או להוסיף?<textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="לדוגמה: הוסף מסך פתיחה, מצב שבו הבוט לא מבין וכפתור מעבר לנציג" /></label>
      <label className="prototype-file">צרף TXT / MD / Word<input type="file" accept=".txt,.md,.json,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => void readSource(e.target.files?.[0])} /></label>
      {sourceText ? <details><summary>טקסט שיצורף ל־AI ({sourceText.length} תווים)</summary><textarea rows={5} value={sourceText} onChange={(e) => setSourceText(e.target.value)} /></details> : null}
      <p className="form-note prototype-auto-share">כל גרסה חדשה משותפת אוטומטית עם הלקוח. גרסאות קודמות נשמרות בהיסטוריה.</p>
      <div className="action-row"><button className="primary-button" disabled={busy} onClick={() => void createRevision()}>{busy ? "יוצר…" : prototype ? "צור גרסה חדשה" : "צור MVP ראשון"}</button>{version?.status === "draft" ? <button disabled={busy} onClick={() => void share()}>שתף עם הלקוח</button> : null}{version ? <><button type="button" onClick={() => void copyExport("Lovable")}>העתק ל־Lovable</button><button type="button" onClick={() => void copyExport("Base44")}>העתק ל־Base44</button></> : null}</div>
    </div> : null}

    {prototypes.length > 1 || (prototype?.versions.length ?? 0) > 1 ? <div className="prototype-selectors"><label>{clientMode ? clientCopy.prototype : "אב־טיפוס"}<select value={prototype?.id || ""} onChange={(e) => { setPrototypeId(e.target.value); const next = prototypes.find((item) => item.id === e.target.value)?.versions[0]; setVersionId(next?.id || ""); setScreenId(next?.content.startScreenId || ""); }}>{prototypes.map((item) => <option key={item.id} value={item.id}>{item.title} · {kindLabels[item.prototype_kind]}</option>)}</select></label><label>{clientMode ? clientCopy.version : "גרסה"}<select value={version?.id || ""} onChange={(e) => { setVersionId(e.target.value); const next = prototype?.versions.find((item) => item.id === e.target.value); setScreenId(next?.content.startScreenId || ""); }}>{prototype?.versions.map((item) => <option key={item.id} value={item.id}>{clientMode ? `${clientCopy.version} ${item.version}` : `v${item.version} · ${item.status}`}</option>)}</select></label></div> : null}

    {clientMode && version ? <div className="prototype-view-only-note" role="note"><span aria-hidden="true">◉</span><p>{clientCopy.viewOnly}{isClientLivePreview ? ` ${clientCopy.liveDraft}` : ""}</p></div> : null}

    {version && screen ? <div className={`prototype-workbench kind-${prototype.prototype_kind}`} style={{ "--prototype-primary": version.content.theme.primary, "--prototype-accent": version.content.theme.accent } as React.CSSProperties}>
      <nav className="prototype-screen-nav" aria-label="מסכי האב טיפוס">{version.content.screens.map((item, index) => <button key={item.id} className={item.id === screen.id ? "active" : ""} onClick={() => setScreenId(item.id)}><span>{index + 1}</span>{item.title}</button>)}</nav>
      <div className="prototype-device"><div className="prototype-device-bar"><i /><i /><i /><strong>{prototype.prototype_kind === "whatsapp" ? "WhatsApp Demo" : screen.title}</strong></div><div className="prototype-canvas"><h3>{screen.title}</h3>{screen.subtitle ? <p className="prototype-subtitle">{screen.subtitle}</p> : null}<div className="prototype-blocks">{screen.blocks.map((block, index) => <PrototypeBlockView key={`${block.type}-${index}`} block={block} />)}</div><div className="prototype-actions">{screen.actions.filter((action) => !clientMode || action.targetScreenId).map((action) => <button key={action.id} className={`prototype-action ${action.tone || "primary"}`} onClick={() => action.targetScreenId && setScreenId(action.targetScreenId)} disabled={!action.targetScreenId}>{action.label}</button>)}</div></div></div>
    </div> : <div className="prototype-empty"><p>{clientMode ? clientCopy.empty : "עדיין אין MVP שמור. אפשר ליצור אותו מהשיחה או מחומר שהלקוח שלח."}</p></div>}

    {!clientMode && decision ? <div className={`prototype-client-decision ${decision.decision}`}><strong>{decision.decision === "approved" ? "הלקוח אישר את הגרסה" : "הלקוח החזיר את הגרסה לתיקונים"}</strong>{decision.comment ? <p>{decision.comment}</p> : null}</div> : null}
    {clientMode && version && !isClientLivePreview && (version.status === "shared" || version.status === "approved") ? <div className="prototype-approval"><h3>{clientCopy.approval} v{version.version}</h3>{decision ? decision.decision === "approved" ? <div className="prototype-approval-current"><p><strong>{clientCopy.approved}</strong>{decision.comment ? ` · ${decision.comment}` : ""}</p><p className="form-note">{clientCopy.approvedHelp}</p><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={clientCopy.placeholder} /><button type="button" disabled={busy} onClick={() => setReopenDialogOpen(true)}>{clientCopy.undo}</button></div> : <div className="prototype-approval-current"><p><strong>{clientCopy.changes}</strong>{decision.comment ? ` · ${decision.comment}` : ""}</p><p className="form-note">{clientCopy.changesHelp}</p></div> : <><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={clientCopy.placeholder} /><div className="action-row"><button className="primary-button" disabled={busy} onClick={() => void decide("approved")}>{clientCopy.approve}</button><button disabled={busy || !comment.trim()} onClick={() => void decide("changes_requested")}>{clientCopy.request}</button></div></>}</div> : null}
    {error ? <p className="form-error">{error}</p> : null}{notice ? <p className="form-success">{notice}</p> : null}
    {!readOnly && hasShared ? <p className="form-note">גרסה ששותפה נשארת בהיסטוריה. תיקונים תמיד יוצרים גרסה חדשה ואינם מוחקים את מה שהלקוח ראה.</p> : null}
    <ConfirmDialog
      open={reopenDialogOpen}
      title={clientCopy.undoTitle}
      description={clientCopy.undoDescription}
      confirmLabel={clientCopy.undoConfirm}
      cancelLabel={clientCopy.cancel}
      destructive={false}
      busy={busy}
      onConfirm={() => void reopenForChanges()}
      onCancel={() => setReopenDialogOpen(false)}
    />
  </section>;
}

function PrototypeBlockView({ block }: { block: PrototypeScreen["blocks"][number] }) {
  if (block.type === "heading") return <h4>{block.label}</h4>;
  if (block.type === "input") return <label className="prototype-input"><span>{block.label}</span><input readOnly value={block.value || ""} placeholder={block.label} /></label>;
  if (block.type === "image") return <div className="prototype-image" role="img" aria-label={block.label}><span>▧</span><strong>{block.label}</strong><small>{block.value || "תמונת המחשה תיווצר או תועלה כאן"}</small></div>;
  if (block.type === "message") return <div className={`prototype-message ${block.sender === "client" ? "client" : "bot"}`}><small>{block.sender === "client" ? "לקוח" : "בוט"}</small><p>{block.label}</p>{block.value ? <span>{block.value}</span> : null}</div>;
  if (block.type === "status") return <div className="prototype-state"><strong>{block.label}</strong><span>{block.value}</span></div>;
  if (block.type === "card") return <article className="prototype-card"><strong>{block.label}</strong>{block.value ? <p>{block.value}</p> : null}</article>;
  return <p>{block.label}{block.value ? ` — ${block.value}` : ""}</p>;
}

