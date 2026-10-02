import type { Model } from "../model.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const modelId = () => process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Gemini's responseSchema is an OpenAPI subset: `nullable: true`, not type arrays.
const str = { type: "STRING", nullable: true };
const EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_prescription: { type: "BOOLEAN" },
    doctor_or_clinic: str,
    date_on_document: str,
    overall_note: str,
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

async function generate(body: Record<string, unknown>): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const res = await fetch(`${BASE}/${modelId()}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  const cand = data.candidates?.[0];
  if (!cand) throw new Error(`Gemini returned no candidate (${data.promptFeedback?.blockReason ?? "unknown reason"})`);
  const text = (cand.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
  if (!text && cand.finishReason && cand.finishReason !== "STOP") {
    throw new Error(`Gemini stopped: ${cand.finishReason}`);
  }
  return text;
}

export const geminiModel: Model = {
  chat(system, userText) {
    return generate({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      // 2.5 models spend output budget on thinking; leave headroom.
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
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
            { text: `Extract the medication lines from this image. Record only what is literally legible; mark anything unreadable or ambiguous as UNCLEAR with a reason.${caption ? ` User note: ${caption}` : ""}` },
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
