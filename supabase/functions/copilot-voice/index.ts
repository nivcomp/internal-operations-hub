import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const { data: claims, error: claimsError } = await admin.auth.getClaims(authHeader.slice(7));
    if (claimsError || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const { data: profile } = await admin.from("profiles")
      .select("id, is_active").eq("id", claims.claims.sub as string).maybeSingle();
    if (!profile || profile.is_active === false) return json({ error: "No active profile" }, 403);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Voice is not configured." }, 500);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "transcribe") {
      const base64 = String(body.audio ?? "");
      if (!base64) return json({ error: "No audio received." }, 400);
      const bytes = decodeBase64(base64);
      if (bytes.length < 2048) return json({ error: "That recording was empty — please try again." }, 400);
      if (bytes.length > MAX_AUDIO_BYTES) return json({ error: "That recording is too long." }, 413);

      const form = new FormData();
      form.append("model", "openai/gpt-4o-transcribe");
      form.append("file", new Blob([bytes], { type: "audio/wav" }), "recording.wav");
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return json({ error: `Transcription failed: ${detail.slice(0, 300)}` }, res.status);
      }
      const result = await res.json();
      return json({ text: String(result.text ?? "").trim() });
    }

    if (action === "speak") {
      const text = String(body.text ?? "").trim().slice(0, 1200);
      if (!text) return json({ error: "Nothing to read out." }, 400);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: text,
          voice: "alloy",
          response_format: "mp3",
          instructions: "Speak calmly, clearly and briefly, like a helpful colleague.",
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return json({ error: `Speech failed: ${detail.slice(0, 300)}` }, res.status);
      }
      const audio = new Uint8Array(await res.arrayBuffer());
      return json({ audio: encodeBase64(audio), mime: "audio/mpeg" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});