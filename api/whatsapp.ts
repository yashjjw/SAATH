import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import { chatReply, extractPrescription, formatExtraction } from "../lib/agent.js";
import { claimMessage, downloadMedia, isValidSignature, sendWhatsApp, webhookUrl } from "../lib/twilio.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST only");

  const params = (req.body ?? {}) as Record<string, string>;

  let valid: boolean;
  try {
    valid = isValidSignature(req.headers["x-twilio-signature"] as string | undefined, webhookUrl(), params);
  } catch (err) {
    // Misconfiguration (missing env var): fail closed with a clear log line, never skip validation.
    console.error("webhook misconfigured:", err instanceof Error ? err.message : err);
    return res.status(500).send("server misconfigured");
  }
  if (!valid) return res.status(403).send("invalid signature");

  // Reply inline in the TwiML response when the work finishes inside Twilio's ~15s window.
  // This also works on Twilio accounts where API-initiated free-form sends are blocked (e.g.
  // Tryout mode, error 21654). If the work is slower, ack empty and deliver via the REST API.
  const work = computeReplies(params);
  const first = await Promise.race([work.then((replies) => ({ replies })), sleep(INLINE_MS).then(() => null)]);

  res.setHeader("Content-Type", "text/xml");
  if (first) {
    console.log("Replying inline via TwiML", { messages: first.replies.length, chars: first.replies.join("").length });
    return res.status(200).send(twiml(first.replies));
  }

  console.log("Reply not ready within inline window; acked empty, will deliver via REST API");
  waitUntil(work.then((replies) => deliver(params.From, replies)));
  return res.status(200).send("<Response></Response>");
}

const INLINE_MS = Number(process.env.INLINE_REPLY_MS ?? 11000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FALLBACK = "Sorry, I couldn't process that. Nothing was changed. Please try again or send a clearer photo.";

const xmlEscape = (t: string) =>
  t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function chunks(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 1500) out.push(text.slice(i, i + 1500));
  return out;
}

function twiml(replies: string[]): string {
  const msgs = replies.flatMap(chunks).map((c) => `<Message>${xmlEscape(c)}</Message>`).join("");
  return `<Response>${msgs}</Response>`;
}

async function deliver(to: string, replies: string[]) {
  try {
    for (const r of replies) await sendWhatsApp(to, r);
  } catch (err: any) {
    console.error("deliver failed", { code: err?.code, status: err?.status, message: err?.message });
  }
}

// Pure "what should we say" step. Never rejects: failures become a safe apology.
async function computeReplies(p: Record<string, string>): Promise<string[]> {
  try {
    if (!(await claimMessage(p.MessageSid))) return [];

    const text = (p.Body ?? "").trim();
    const numMedia = parseInt(p.NumMedia ?? "0", 10);

    // TODO(identity/consent gate, PRD R10): map `p.From` -> verified patient + active grant first.

    if (numMedia > 0) {
      const mime = p.MediaContentType0;
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) {
        return ["I can read photos for now (JPG/PNG). Voice and PDFs are coming next."];
      }
      const media = await downloadMedia(p.MediaUrl0);
      const extraction = await extractPrescription(media.base64, mime as any, text);
      return [formatExtraction(extraction)];
    }

    if (!text) return [];
    return [await chatReply(text)];
  } catch (err) {
    console.error("computeReplies failed", p.MessageSid, err);
    return [FALLBACK];
  }
}
