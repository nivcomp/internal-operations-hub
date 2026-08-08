import { useEffect, useMemo, useState } from "react";
import {
  generatePrototype, listProjectPrototypes, recordPrototypeDecision, sharePrototype,
  type ProjectPrototype, type PrototypeKind, type PrototypeScreen, type PrototypeVersion,
} from "../../services/prototypeApi";

type Props = { projectId: string; projectName: string; readOnly?: boolean; clientMode?: boolean; simple?: boolean };

const kindLabels: Record<PrototypeKind, string> = { app: "אפליקציה / אתר", whatsapp: "בוט WhatsApp", automation: "אוטומציה" };

export function PrototypeStudio({ projectId, projectName, readOnly = false, clientMode = false, simple = false }: Props) {
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
  const [autoShare, setAutoShare] = useState(() => localStorage.getItem(`prototype-auto-share:${projectId}`) !== "off");
  useEffect(() => { localStorage.setItem(`prototype-auto-share:${projectId}`, autoShare ? "on" : "off"); }, [autoShare, projectId]);

  async function refresh(preferredPrototypeId?: string, preferredVersionId?: string) {
    const result = await listProjectPrototypes(projectId);
    setPrototypes(result.prototypes); setApprovals(result.approvals);
    const selectedPrototype = result.prototypes.find((item) => item.id === (preferredPrototypeId || prototypeId)) ?? result.prototypes[0];
    const selectedVersion = selectedPrototype?.versions.find((item) => item.id === (preferredVersionId || versionId)) ?? selectedPrototype?.versions[0];
    setPrototypeId(selectedPrototype?.id ?? ""); setVersionId(selectedVersion?.id ?? "");
    setScreenId((current) => selectedVersion?.content.screens.some((screen) => screen.id === current) ? current : selectedVersion?.content.startScreenId ?? "");
  }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (autoShare) {
        await sharePrototype(projectId, result.version.id);
        await refresh(result.prototypeId, result.version.id); setInstructions("");
        setNotice(`נוצרה גרסה ${result.version.version} והיא שותפה אוטומטית עם הלקוח בפורטל שלו.`);
      } else {
        await refresh(result.prototypeId, result.version.id); setInstructions("");
        setNotice(`נוצרה גרסה ${result.version.version}. היא טיוטה עד שתשתף אותה.`);
      }
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

  const lovablePrompt = useMemo(() => version ? `Build this reviewed client prototype. Preserve its screens and interactions exactly. Do not invent pricing, internal costs, supplier data or permissions.\n\n${JSON.stringify(version.content, null, 2)}` : "", [version]);
  async function copyExport() { await navigator.clipboard.writeText(lovablePrompt); setNotice("חבילת ה־MVP הועתקה. יש לבדוק אותה לפני הדבקה ב־Lovable."); }

  if (!version && readOnly) return <section className="card prototype-empty"><h2>ה־MVP החזותי</h2><p>עדיין לא שותף אב־טיפוס לפרויקט.</p></section>;

  return <section className={`card prototype-studio${simple ? " prototype-simple" : ""}`} dir="rtl">
    <header className="prototype-head"><div><p className="eyebrow">MVP חזותי שמור</p><h2>{prototype?.title || projectName}</h2><p>{version?.summary || "צור אב־טיפוס לחיץ מתוך השיחה, האפיון או קובץ Word."}</p></div>{version ? <span className={`prototype-status ${version.status}`}>v{version.version} · {version.status}</span> : null}</header>

    {!readOnly ? <div className="prototype-authoring">
      {!prototype ? <label>סוג MVP<select value={kind} onChange={(e) => setKind(e.target.value as PrototypeKind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
      <label className="span-2">מה לשנות או להוסיף?<textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="לדוגמה: הוסף מסך פתיחה, מצב שבו הבוט לא מבין וכפתור מעבר לנציג" /></label>
      <label className="prototype-file">צרף TXT / MD / Word<input type="file" accept=".txt,.md,.json,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => void readSource(e.target.files?.[0])} /></label>
      {sourceText ? <details><summary>טקסט שיצורף ל־AI ({sourceText.length} תווים)</summary><textarea rows={5} value={sourceText} onChange={(e) => setSourceText(e.target.value)} /></details> : null}
      <label className="prototype-auto-share"><input type="checkbox" checked={autoShare} onChange={(event) => setAutoShare(event.target.checked)} /> שתף אוטומטית כל גרסה חדשה עם הלקוח בפורטל שלו</label>
      <div className="action-row"><button className="primary-button" disabled={busy} onClick={() => void createRevision()}>{busy ? "יוצר…" : prototype ? "צור גרסה חדשה" : "צור MVP ראשון"}</button>{version?.status === "draft" ? <button disabled={busy} onClick={() => void share()}>שתף עם הלקוח</button> : null}{version ? <button type="button" onClick={() => void copyExport()}>העתק חבילה ל־Lovable</button> : null}</div>
    </div> : null}

    {prototypes.length > 1 || (prototype?.versions.length ?? 0) > 1 ? <div className="prototype-selectors"><label>אב־טיפוס<select value={prototype?.id || ""} onChange={(e) => { setPrototypeId(e.target.value); const next = prototypes.find((item) => item.id === e.target.value)?.versions[0]; setVersionId(next?.id || ""); setScreenId(next?.content.startScreenId || ""); }}>{prototypes.map((item) => <option key={item.id} value={item.id}>{item.title} · {kindLabels[item.prototype_kind]}</option>)}</select></label><label>גרסה<select value={version?.id || ""} onChange={(e) => { setVersionId(e.target.value); const next = prototype?.versions.find((item) => item.id === e.target.value); setScreenId(next?.content.startScreenId || ""); }}>{prototype?.versions.map((item) => <option key={item.id} value={item.id}>v{item.version} · {item.status}</option>)}</select></label></div> : null}

    {version && screen ? <div className={`prototype-workbench kind-${prototype.prototype_kind}`} style={{ "--prototype-primary": version.content.theme.primary, "--prototype-accent": version.content.theme.accent } as React.CSSProperties}>
      <nav className="prototype-screen-nav" aria-label="מסכי האב טיפוס">{version.content.screens.map((item, index) => <button key={item.id} className={item.id === screen.id ? "active" : ""} onClick={() => setScreenId(item.id)}><span>{index + 1}</span>{item.title}</button>)}</nav>
      <div className="prototype-device"><div className="prototype-device-bar"><i /><i /><i /><strong>{prototype.prototype_kind === "whatsapp" ? "WhatsApp Demo" : screen.title}</strong></div><div className="prototype-canvas"><h3>{screen.title}</h3>{screen.subtitle ? <p className="prototype-subtitle">{screen.subtitle}</p> : null}<div className="prototype-blocks">{screen.blocks.map((block, index) => <PrototypeBlockView key={`${block.type}-${index}`} block={block} />)}</div><div className="prototype-actions">{screen.actions.map((action) => <button key={action.id} className={`prototype-action ${action.tone || "primary"}`} onClick={() => action.targetScreenId && setScreenId(action.targetScreenId)} disabled={!action.targetScreenId}>{action.label}</button>)}</div></div></div>
    </div> : <div className="prototype-empty"><p>עדיין אין MVP שמור. אפשר ליצור אותו מהשיחה או מחומר שהלקוח שלח.</p></div>}

    {clientMode && version && (version.status === "shared" || version.status === "approved") ? <div className="prototype-approval"><h3>אישור הלקוח לגרסה v{version.version}</h3>{decision ? <p><strong>{decision.decision === "approved" ? "הגרסה אושרה" : "התבקשו שינויים"}</strong>{decision.comment ? ` · ${decision.comment}` : ""}</p> : <><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="הערה או שינוי מבוקש" /><div className="action-row"><button className="primary-button" disabled={busy} onClick={() => void decide("approved")}>אני מאשר/ת את הגרסה</button><button disabled={busy || !comment.trim()} onClick={() => void decide("changes_requested")}>בקש שינויים</button></div></>}</div> : null}
    {error ? <p className="form-error">{error}</p> : null}{notice ? <p className="form-success">{notice}</p> : null}
    {!readOnly && hasShared ? <p className="form-note">גרסה ששותפה נשארת בהיסטוריה. תיקונים תמיד יוצרים גרסה חדשה ואינם מוחקים את מה שהלקוח ראה.</p> : null}
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

