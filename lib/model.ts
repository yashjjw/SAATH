import { anthropicModel } from "./providers/anthropic.js";
import { geminiModel } from "./providers/gemini.js";

export type ImgMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// Providers only produce text / raw JSON. Validation and gates live in agent.ts so they
// apply identically whichever model is behind this.
export interface Model {
  chat(system: string, userText: string): Promise<string>;
  extract(system: string, imageBase64: string, mime: ImgMime, caption: string): Promise<unknown>;
}

// MODEL_PROVIDER = "gemini" (default) | "anthropic"
export function getModel(): Model {
  const p = (process.env.MODEL_PROVIDER ?? "gemini").toLowerCase();
  if (p === "gemini") return geminiModel;
  if (p === "anthropic") return anthropicModel;
  throw new Error(`Unknown MODEL_PROVIDER "${p}" (use "gemini" or "anthropic")`);
}
