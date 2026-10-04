import type { VercelRequest, VercelResponse } from "@vercel/node";
import { passwordOk } from "../lib/auth.js";
import { chatReply, extractPrescription, formatExtraction } from "../lib/agent.js";
import { clinicReply } from "../lib/clinic.js";
import { saathReply, type DemoState } from "../lib/saath.js";
import { rxFromExtraction, type OrderEvent } from "../lib/order.js";
import { SAMPLE_EXTRACTION } from "../lib/fixtures/prescription.js";
import type { ChatTurn } from "../lib/model.js";

// Test-only twin of api/whatsapp.ts: same agent functions, no Twilio. Disabled unless
// CHAT_TEST_PASSWORD is set, because it spends Anthropic credits on a public URL.
const IMG_MIME = /^image\/(jpeg|png|webp|gif)$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.CHAT_TEST_PASSWORD) return res.status(404).json({ error: "chat tester disabled" });
  if (!passwordOk(req.headers["x-test-key"] as string | undefined)) {
    return res.status(401).json({ error: "wrong password" });
  }

  const { text = "", image, mode = "patient", history = [], state = null, id, now, tz, event } = (req.body ?? {}) as {
    text?: string;
    image?: { base64: string; mime: string };
    mode?: "saath" | "patient" | "clinic";
    history?: ChatTurn[];
    state?: DemoState | null;
    id?: string;
    now?: number;
    tz?: string;
    event?: OrderEvent;
  };
  const caption = String(text).trim();

  try {
    // Scripted demo: deterministic, no model call. A photo falls through to the real reader below.
    if (mode === "saath" && !image) return res.json(saathReply(state, { id, text: caption, now, tz, event }));

    // A prescription photo in Saath mode: the real reader, then the order workflow (lib/order.ts).
    if (mode === "saath" && image) {
      const busy = ["po_wait", "po_decide", "link_wait", "pay_wait", "pay_retry", "ship_wait"];
      if (state && busy.includes(state.step)) {
        return res.json({ state, messages: [{ kind: "text", text: "Let's finish your current order first 🙏 I'll be ready for the next prescription right after." }] });
      }
      if (!IMG_MIME.test(image.mime)) {
        return res.json({ state, messages: [{ kind: "text", text: "I can read photos for now (JPG or PNG)." }] });
      }
      // Default: the scripted prescription from the plan (no model needed). RX_READER=live reads the
      // uploaded photo with the model instead.
      if (process.env.RX_READER !== "live") return res.json(rxFromExtraction(state, SAMPLE_EXTRACTION));
      try {
        return res.json(rxFromExtraction(state, await extractPrescription(image.base64, image.mime as any, caption)));
      } catch (err) {
        console.error("prescription read failed", err instanceof Error ? err.message : err);
        return res.json(rxFromExtraction(state, null));
      }
    }

    if (mode === "clinic") {
      if (image) return res.json({ replies: ["Clinic mode is text only for now. Switch to Patient mode to read a prescription photo."] });
      if (!caption) return res.json({ replies: [] });
      // Client-held history, capped and sanitised. Nothing is stored server-side.
      const turns = (Array.isArray(history) ? history : [])
        .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
        .slice(-20)
        .map((t) => ({ role: t.role, text: t.text.slice(0, 6000) }));
      return res.json({ replies: [await clinicReply(turns, caption)] });
    }
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
