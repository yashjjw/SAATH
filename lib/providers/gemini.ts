import type { Model } from "../model.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const modelId = () => process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

// Gemini's responseSchema is an OpenAPI subset: `nullable: true`, not type arrays.
const str = { type: "STRING", nullable: true };
const EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_prescription: { type: "BOOLEAN" },
    doctor_or_clinic: str,
    date_on_document: str,
    overall_note: str,
    tests: { type: "ARRAY", items: { type: "STRING" } },
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          drug_name: str,
          strength: str,
          form: str,
          dose_instruction: str,
          duration: str,
          confidence: { type: "STRING", enum: ["CLEAR", "UNCLEAR"] },
          unclear_reason: str,
          source_note: { type: "STRING" },
        },
        required: ["drug_name", "strength", "form", "dose_instruction", "duration", "confidence", "unclear_reason", "source_note"],
      },
    },
  },
  required: ["is_prescription", "doctor_or_clinic", "date_on_document", "overall_note", "lines"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// One model: up to 3 attempts on overload/rate-limit, with backoff. Anything else fails fast.
async function callModel(model: string, key: string, body: Record<string, unknown>): Promise<string> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt * 1500);
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      lastErr = `Gemini ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`;
      if (RETRYABLE.has(res.status)) continue;
      throw new Error(lastErr);
    }
    const data: any = await res.json();
    const cand = data.candidates?.[0];
    if (!cand) throw new Error(`Gemini returned no candidate (${data.promptFeedback?.blockReason ?? "unknown reason"})`);
    const text = (cand.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
    if (!text && cand.finishReason && cand.finishReason !== "STOP") {
      throw new Error(`Gemini stopped: ${cand.finishReason}`);
    }
    return text;
  }
  throw new Error(lastErr);
}

// Optional GEMINI_FALLBACK_MODEL is tried only if the primary stays overloaded.
async function generate(body: Record<string, unknown>): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  try {
    return await callModel(modelId(), key, body);
  } catch (err) {
    const fallback = process.env.GEMINI_FALLBACK_MODEL;
    const retryable = err instanceof Error && /^Gemini (429|5\d\d) /.test(err.message);
    if (!fallback || fallback === modelId() || !retryable) throw err;
    return await callModel(fallback, key, body);
  }
}

export const geminiModel: Model = {
  chat(system, userText, opts) {
    const history = (opts?.history ?? []).map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.text }],
    }));
    return generate({
      systemInstruction: { parts: [{ text: system }] },
      contents: [...history, { role: "user", parts: [{ text: userText }] }],
      // thinking models spend output budget on thinking; leave headroom.
      generationConfig: { maxOutputTokens: opts?.maxTokens ?? 2048, temperature: opts?.temperature ?? 0.3 },
    });
  },

  async extract(system, imageBase64, mime, caption) {
    const text = await generate({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mime, data: imageBase64 } },
            { text: `Extract the medication lines from this image. Record only what is literally legible; mark anything unreadable or ambiguous as UNCLEAR with a reason. Also list any laboratory or diagnostic tests the document advises, each exactly as written, in the tests field (empty array if none).${caption ? ` User note: ${caption}` : ""}` },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: EXTRACT_SCHEMA,
      },
    });
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON for the extraction");
    }
  },
};
