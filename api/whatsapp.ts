import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import { chatReply, extractPrescription, formatExtraction } from "../lib/agent.js";
import { claimMessage, downloadMedia, isValidSignature, sendWhatsApp, webhookUrl } from "../lib/twilio.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
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

  // Ack Twilio immediately (it times out at ~15s), then keep the function alive
  // for the slow Claude call with waitUntil. Without waitUntil, Vercel freezes the
  // function the moment the response is sent and the reply would never go out.
  res.setHeader("Content-Type", "text/xml");
  res.status(200).send("<Response></Response>");

  waitUntil(handleInbound(params));
}

async function handleInbound(p: Record<string, string>) {
  const from = p.From;
  try {
    if (!(await claimMessage(p.MessageSid))) return;

    const text = (p.Body ?? "").trim();
    const numMedia = parseInt(p.NumMedia ?? "0", 10);

    // TODO(identity/consent gate, PRD R10): map `from` -> verified patient + active grant first.

    if (numMedia > 0) {
      const mime = p.MediaContentType0;
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) {
        return await sendWhatsApp(from, "I can read photos for now (JPG/PNG). Voice and PDFs are coming next.");
      }
      await sendWhatsApp(from, "Got it, reading your prescription…");
      const media = await downloadMedia(p.MediaUrl0);
      const extraction = await extractPrescription(media.base64, mime as any, text);
      return await sendWhatsApp(from, formatExtraction(extraction));
    }

    if (!text) return;
    await sendWhatsApp(from, await chatReply(text));
  } catch (err) {
    console.error("handleInbound failed", p.MessageSid, err);
    try {
      await sendWhatsApp(from, "Sorry, I couldn't process that. Nothing was changed. Please try again or send a clearer photo.");
    } catch (e) {
      console.error("fallback send failed", e);
    }
  }
}
