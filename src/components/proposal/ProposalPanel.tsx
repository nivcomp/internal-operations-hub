import { useEffect, useState } from "react";
import { invokeProjectWorkflow, loadPublishedProposals } from "../../services/meetingWorkflowApi";

const errorHints: Record<string, string> = {
  "Yaniv must approve a final fixed price first.":
    "יש לאשר קודם מחיר קבוע סופי במסך האומדן (כפתור \"אישור מחיר קבוע\") ואז לפרסם הצעה.",
  "All client-visible specification sections must be approved.":
    "יש לאשר את כל סעיפי המפרט המוצגים ללקוח לפני פרסום ההצעה.",
};

export function ProposalPanel({ projectId, mode, readOnly = false }: { projectId: string; mode: "admin" | "client"; readOnly?: boolean }) {
  const [proposals,setProposals]=useState<any[]>([]); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [name,setName]=useState(""); const [role,setRole]=useState(""); const [signature,setSignature]=useState(""); const [accepted,setAccepted]=useState(false);
  const refresh=()=>loadPublishedProposals(projectId).then(setProposals).catch((e)=>setError(e.message)); useEffect(()=>{void refresh()},[projectId]);
  const current=proposals[0];
  async function run(action:string,payload={}) { setBusy(true);setError("");try{await invokeProjectWorkflow(action,projectId,payload);await refresh();}catch(e){const raw=(e as Error).message;const key=Object.keys(errorHints).find((k)=>raw.includes(k));setError(key?errorHints[key]:raw);}finally{setBusy(false)} }
  return <section className="card proposal-panel"><h2>{mode === "admin" ? "הצעה, חתימה ומסירה" : "הצעת המחיר שלך"}</h2>{error&&<p className="form-error">{error}</p>}
    {mode === "admin" && <div className="action-row"><button className="primary-button" disabled={busy} onClick={()=>void run("publish_proposal",{language:"he",proposalKind:"full"})}>פרסם גרסה לחתימה</button><button disabled={busy || current?.status!=="signed"} onClick={()=>void run("generate_execution_package")}>צור חבילת ביצוע</button></div>}
    {!current ? <p className="muted-text">עדיין אין הצעה שפורסמה.</p> : <><div className="proposal-preview" dir={current.language==="he"?"rtl":"ltr"}><p><strong>גרסה:</strong> {current.version} · <strong>סטטוס:</strong> {current.status}</p><h3>{current.content?.project?.name}</h3><p>{current.content?.project?.summary}</p>{(current.content?.sections??[]).map((s:any)=><div key={s.section_key}><h4>{s.title}</h4><p>{s.content}</p></div>)}<h3>מחיר קבוע: {Number(current.fixed_price).toLocaleString()} {current.currency}</h3><p><strong>תנאי תשלום:</strong> {current.payment_terms||"טרם הוגדר"}</p><small>Document hash: {current.document_hash}</small></div>
      {mode === "client" && current.status !== "signed" && <div className="signature-form"><h3>חתימה דיגיטלית</h3>{readOnly && <p className="form-note">תצוגה מקדימה בלבד — רק חשבון הלקוח יכול לחתום.</p>}<label>שם משפטי מלא<input disabled={readOnly} value={name} onChange={(e)=>setName(e.target.value)}/></label><label>תפקיד<input disabled={readOnly} value={role} onChange={(e)=>setRole(e.target.value)}/></label><label>חתימה מוקלדת<input disabled={readOnly} value={signature} onChange={(e)=>setSignature(e.target.value)} placeholder="הקלד/י את שמך כחתימה"/></label><label><input disabled={readOnly} type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)}/> קראתי ואני מאשר/ת את ההצעה המדויקת המוצגת לעיל.</label><button className="primary-button" disabled={readOnly||busy||!accepted||!name||!role||!signature} onClick={()=>void run("sign_proposal",{proposalVersionId:current.id,signerName:name,signerRole:role,signatureArtifact:signature,acceptTerms:accepted})}>חתום ואשר</button></div>}
      {current.status === "signed" && <p className="form-success">הצעה זו חתומה ונעולה לשינויים. שינוי נוסף יטופל כבקשת שינוי וגרסה חדשה.</p>}</>}
  </section>;
}
