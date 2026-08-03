import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import {
  cancelCopilotAction, clearCopilotThread, confirmCopilotAction, loadCopilotHistory,
  saveCopilotPreferences, sendCopilotMessage, synthesizeSpeech, transcribeAudio,
  type CopilotChip, type CopilotMessage, type CopilotPendingAction,
  type CopilotScreenHint, type CopilotUsage,
} from "../services/copilotApi";
import { playBase64Audio, startRecording, stopSpeech, type Recorder } from "../lib/voice";

export type CopilotFormHint = Pick<
  CopilotScreenHint, "formSection" | "fields" | "errors" | "missing" | "notes"
>;

type CopilotApi = {
  open: boolean;
  setOpen: (open: boolean) => void;
  label: string;
  messages: CopilotMessage[];
  pendingActions: CopilotPendingAction[];
  usage: CopilotUsage | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
  observation: string;
  chips: CopilotChip[];
  recording: boolean;
  transcribing: boolean;
  speaking: boolean;
  voiceReplies: boolean;
  setVoiceReplies: (value: boolean) => void;
  send: (text: string, viaVoice?: boolean) => Promise<void>;
  startVoice: () => Promise<void>;
  stopVoice: () => Promise<void>;
  cancelVoice: () => void;
  stopSpeaking: () => void;
  confirm: (draftId: string) => Promise<void>;
  dismiss: (draftId: string) => Promise<void>;
  clear: () => Promise<void>;
  registerScreen: (hint: CopilotScreenHint) => void;
  setFormHint: (id: string, hint: CopilotFormHint | null) => void;
  runChip: (chip: CopilotChip) => void;
};

const CopilotContext = createContext<CopilotApi | null>(null);

export function useCopilot(): CopilotApi {
  const context = useContext(CopilotContext);
  if (!context) throw new Error("useCopilot must be used inside CopilotProvider");
  return context;
}

const VOICE_PREF_KEY = "copilot.voiceReplies";

export function CopilotProvider({
  children, onChip,
}: {
  children: React.ReactNode;
  onChip: (chip: CopilotChip) => void;
}) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<CopilotScreenHint>({ page: "home", entityType: "none" });
  const [formHints, setFormHints] = useState<Record<string, CopilotFormHint>>({});
  const [label, setLabel] = useState("Helping you in the workspace");
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<CopilotPendingAction[]>([]);
  const [usage, setUsage] = useState<CopilotUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceReplies, setVoiceRepliesState] = useState(
    () => localStorage.getItem(VOICE_PREF_KEY) === "true",
  );
  const recorderRef = useRef<Recorder | null>(null);
  const scopeRef = useRef<string>("");

  // The screen hint says only WHERE the user is; the server re-reads and filters the data.
  const hint = useMemo<CopilotScreenHint>(() => {
    const forms = Object.values(formHints);
    const active = forms[forms.length - 1];
    return {
      ...screen,
      formSection: active?.formSection ?? screen.formSection,
      fields: active?.fields ?? screen.fields,
      errors: active?.errors ?? screen.errors,
      missing: active?.missing ?? screen.missing,
      notes: [...(screen.notes ?? []), ...(active?.notes ?? [])],
    };
  }, [screen, formHints]);
  const hintRef = useRef(hint);
  hintRef.current = hint;

  const scopeSignature = `${hint.page}|${hint.projectId ?? ""}|${hint.clientId ?? ""}|${hint.supplierId ?? ""}`;

  const registerScreen = useCallback((next: CopilotScreenHint) => {
    setScreen((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, []);

  const setFormHint = useCallback((id: string, value: CopilotFormHint | null) => {
    setFormHints((current) => {
      if (!value) {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }
      if (JSON.stringify(current[id]) === JSON.stringify(value)) return current;
      return { ...current, [id]: value };
    });
  }, []);

  const setVoiceReplies = useCallback((value: boolean) => {
    setVoiceRepliesState(value);
    localStorage.setItem(VOICE_PREF_KEY, String(value));
    void saveCopilotPreferences(hintRef.current, { voiceReplies: value }).catch(() => undefined);
  }, []);

  // Loads the thread that belongs to the entity currently on screen.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadCopilotHistory(hintRef.current)
      .then((result) => {
        if (cancelled) return;
        scopeRef.current = result.scopeKey;
        setLabel(result.label);
        setMessages(result.messages);
        setUsage(result.usage);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, scopeSignature]);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      setSpeaking(true);
      const audio = await synthesizeSpeech(text);
      await playBase64Audio(audio.audio, audio.mime);
    } catch {
      /* speech is optional; the text answer is already visible */
    } finally {
      setSpeaking(false);
    }
  }, []);

  const send = useCallback(async (text: string, viaVoice = false) => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    const optimistic: CopilotMessage = {
      id: `local-${Date.now()}`, sender: "user", body: value,
      payload: { voice: viaVoice }, created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const result = await sendCopilotMessage(hintRef.current, value, viaVoice);
      scopeRef.current = result.scopeKey;
      setLabel(result.label);
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimistic.id),
        result.userMessage, result.assistantMessage,
      ]);
      setPendingActions(result.pendingActions ?? []);
      setUsage(result.usage);
      if (voiceReplies || viaVoice) void speak(result.assistantMessage.body);
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }, [sending, speak, voiceReplies]);

  const startVoice = useCallback(async () => {
    if (recording) return;
    setError(null);
    try {
      recorderRef.current = await startRecording();
      setRecording(true);
    } catch {
      setError("Microphone access is needed for voice. You can keep typing instead.");
    }
  }, [recording]);

  const cancelVoice = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const stopVoice = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (!recorder) return;
    setTranscribing(true);
    try {
      const wav = await recorder.stop();
      const { text } = await transcribeAudio(wav);
      if (!text) {
        setError("I could not hear that. Please try again.");
        return;
      }
      await send(text, true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTranscribing(false);
    }
  }, [send]);

  const confirm = useCallback(async (draftId: string) => {
    try {
      await confirmCopilotAction(hintRef.current, draftId);
      setPendingActions((current) => current.filter((action) => action.id !== draftId));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const dismiss = useCallback(async (draftId: string) => {
    try {
      await cancelCopilotAction(hintRef.current, draftId);
    } catch {
      /* leaving the proposal in place is safe */
    }
    setPendingActions((current) => current.filter((action) => action.id !== draftId));
  }, []);

  const clear = useCallback(async () => {
    try {
      await clearCopilotThread(hintRef.current);
      setMessages([]);
      setPendingActions([]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const lastAssistant = [...messages].reverse().find((message) => message.sender === "assistant");
  const observation = lastAssistant?.payload?.observation ?? "";
  const chips = (lastAssistant?.payload?.chips ?? []) as CopilotChip[];

  const value = useMemo<CopilotApi>(() => ({
    open, setOpen, label, messages, pendingActions, usage, loading, sending, error,
    observation, chips, recording, transcribing, speaking, voiceReplies, setVoiceReplies,
    send, startVoice, stopVoice, cancelVoice, stopSpeaking: () => { stopSpeech(); setSpeaking(false); },
    confirm, dismiss, clear, registerScreen, setFormHint, runChip: onChip,
  }), [
    open, label, messages, pendingActions, usage, loading, sending, error, observation, chips,
    recording, transcribing, speaking, voiceReplies, setVoiceReplies, send, startVoice, stopVoice,
    cancelVoice, confirm, dismiss, clear, registerScreen, setFormHint, onChip,
  ]);

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

/** Registers the screen the user is looking at. Data itself is never sent from here. */
export function useCopilotScreen(hint: CopilotScreenHint) {
  const { registerScreen } = useCopilot();
  const signature = JSON.stringify(hint);
  useEffect(() => {
    registerScreen(JSON.parse(signature) as CopilotScreenHint);
  }, [registerScreen, signature]);
}

/** Lets a form describe its own state so the copilot can help complete it. */
export function useCopilotForm(id: string, hint: CopilotFormHint | null) {
  const { setFormHint } = useCopilot();
  const signature = JSON.stringify(hint);
  useEffect(() => {
    setFormHint(id, signature === "null" ? null : (JSON.parse(signature) as CopilotFormHint));
    return () => setFormHint(id, null);
  }, [id, setFormHint, signature]);
}