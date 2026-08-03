// Shared, non-streaming call into the Lovable AI gateway (Responses API).
// Used by the onboarding assistant and the document generator.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
export const DEFAULT_MODEL = "openai/gpt-5.6-sol";

export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callModel(
  input: ModelMessage[],
  options: { maxOutputTokens?: number; model?: string } = {},
): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      input,
      stream: false,
      store: false,
      max_output_tokens: options.maxOutputTokens ?? 4000,
      reasoning: { effort: "low" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks: string[] = [];
  for (const item of data.output ?? []) {
    for (const part of item?.content ?? []) {
      if (typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("").trim();
}

/** Tolerant JSON extraction: models sometimes wrap output in prose or fences. */
export function parseJsonOutput<T>(raw: string): T | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}