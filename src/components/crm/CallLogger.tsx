import { useRef, useState } from "react";
import { startRecording, type Recorder } from "../../lib/voice";
import { transcribeAudio } from "../../services/copilotApi";
import { logLeadCall } from "../../services/crmApi";
import type { ContactNote } from "../../types/crm";

type Props = { leadId: string; phone: string | null; onSaved: (note: ContactNote) => void };

/** Tap-to-call plus voice documentation of what was said in the call. */
export function CallLogger({ leadId, phone, onSaved }: Props) {
  const recorderRef = useRef<Recorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString());
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  async function toggleRecording() {
    setStatus("");
    if (recording) {
      const active = recorderRef.current;
      recorderRef.current = null;
      setRecording(false);
      if (!active) return;
      setStatus("מתמלל…");
      try {
        const wav = await active.stop();
        const result = await transcribeAudio(wav);
        setText((current) => (current ? `${current} ${result.text}` : result.text).trim());
        setStatus("התמלול מוכן — אפשר לערוך ולשמור");
      } catch (error) {
        setStatus((error as Error).message);
      }
      return;
    }
    try {
      recorderRef.current = await startRecording();
      setStartedAt(new Date().toISOString());
      setRecording(true);
      setStatus("מקליט… דבר בחופשיות מה נאמר בשיחה");
    } catch {
      setStatus("אין גישה למיקרופון");
    }
  }

  async function save() {
    if (!text.trim()) return;
    setStatus("שומר…");
    try {
      const note = await logLeadCall(leadId, text, startedAt);
      onSaved(note);
      setText("");
      setStatus("השיחה נשמרה בהיסטוריה");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return (
    <section className="crm-call-logger">
      <div className="crm-call-actions">
        {phone ? (
          <a className="primary-button crm-call-button" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
            📞 התקשר {phone}
          </a>
        ) : <span className="simple-note">אין מספר טלפון</span>}
        <button type="button" className={recording ? "primary-button" : "ghost-button"} onClick={() => void toggleRecording()}>
          {recording ? "עצור והמר לטקסט" : "🎙️ תעד שיחה בקול"}
        </button>
      </div>
      <textarea
        rows={4}
        value={text}
        placeholder="מה נאמר בשיחה? אפשר להקליט או להקליד."
        onChange={(event) => setText(event.target.value)}
      />
      <div className="crm-call-actions">
        <button type="button" className="primary-button" disabled={!text.trim()} onClick={() => void save()}>
          שמור שיחה ({new Date(startedAt).toLocaleString("he-IL")})
        </button>
        {status ? <span className="simple-note">{status}</span> : null}
      </div>
    </section>
  );
}
