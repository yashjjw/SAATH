import type { VercelRequest, VercelResponse } from "@vercel/node";
import { timingSafeEqual } from "node:crypto";
import { chatReply, extractPrescription, formatExtraction } from "../lib/agent.js";

// Test-only twin of api/whatsapp.ts: same agent functions, no Twilio. Disabled unless
// CHAT_TEST_PASSWORD is set, because it spends Anthropic credits on a public URL.
const IMG_MIME = /^image\/(jpeg|png|webp|gif)$/;

function passwordOk(given: string | undefined): boolean {
  const want = process.env.CHAT_TEST_PASSWORD;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.CHAT_TEST_PASSWORD) return res.status(404).json({ error: "chat tester disabled" });
  if (!passwordOk(req.headers["x-test-key"] as string | undefined)) {
    return res.status(401).json({ error: "wrong password" });
  }

  const { text = "", image } = (req.body ?? {}) as {
    text?: string;
    image?: { base64: string; mime: string };
  };
  const caption = String(text).trim();

  try {
    if (image) {
      if (!IMG_MIME.test(image.mime)) {
        return res.json({ replies: ["I can read photos for now (JPG/PNG). Voice and PDFs are coming next."] });
      }
      const extraction = await extractPrescription(image.base64, image.mime as any, caption);
      return res.json({ replies: ["Got it, reading your prescription…", formatExtraction(extraction)] });
    }
    if (!caption) return res.json({ replies: [] });
    return res.json({ replies: [await chatReply(caption)] });
  } catch (err) {
    console.error("chat failed", err);
    return res.json({
      replies: ["Sorry, I couldn't process that. Nothing was changed. Please try again or send a clearer photo."],
      debug: err instanceof Error ? err.message : String(err),
    });
  }
}
