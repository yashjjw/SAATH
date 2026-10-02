import twilio from "twilio";

const sid = process.env.TWILIO_ACCOUNT_SID!;
const token = process.env.TWILIO_AUTH_TOKEN!;

let _client: ReturnType<typeof twilio> | null = null;
const client = () => (_client ??= twilio(sid, token));

// Env values pasted into a dashboard often carry stray quotes, spaces or a missing prefix.
// Normalise to Twilio's channel format: whatsapp:+E164.
export function toWhatsApp(raw: string | undefined): string {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (!v) throw new Error("WhatsApp address is empty (check TWILIO_WHATSAPP_FROM)");
  const num = v.replace(/^whatsapp:/i, "").replace(/\s+/g, "");
  if (!/^\+\d{8,15}$/.test(num)) throw new Error(`WhatsApp address is not E.164: "${v}" (expected whatsapp:+14155238886)`);
  return `whatsapp:${num}`;
}

// Plain free-form reply (no content template). Valid inside the 24h window after the user's
// last message, which is always the case for a reply to an inbound message.
export async function sendWhatsApp(to: string, body: string) {
  const params = { from: toWhatsApp(process.env.TWILIO_WHATSAPP_FROM), to: toWhatsApp(to) };
  try {
    for (let i = 0; i < body.length; i += 1500) {
      await client().messages.create({ ...params, body: body.slice(i, i + 1500) });
    }
  } catch (err: any) {
    // Log Twilio's own explanation and the addresses used (never credentials or message text).
    console.error("twilio send failed", {
      status: err?.status, code: err?.code, message: err?.message, moreInfo: err?.moreInfo,
      from: params.from, to: params.to,
    });
    throw err;
  }
}

// Twilio media URLs need basic auth with SID:token.
export async function downloadMedia(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
  });
  if (!res.ok) throw new Error(`Media fetch failed: ${res.status}`);
  const mime = (res.headers.get("content-type") ?? "").split(";")[0];
  return { base64: Buffer.from(await res.arrayBuffer()).toString("base64"), mime };
}

// The exact public URL Twilio signed. Prefers PUBLIC_BASE_URL; falls back to Vercel's
// production-domain system variable. Normalised so a missing scheme or trailing slash can't
// break validation. Throws (never returns a guess) if neither is set. It deliberately does NOT
// derive the URL from request headers, which the caller controls.
export function webhookUrl(): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = process.env.PUBLIC_BASE_URL?.trim() || (prod ? `https://${prod}` : "");
  if (!raw) throw new Error("PUBLIC_BASE_URL is not set (e.g. https://saath-sigma.vercel.app)");
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return `${new URL(withScheme).origin}/api/whatsapp`;
}

export function isValidSignature(signature: string | undefined, url: string, params: Record<string, string>) {
  if (!token) throw new Error("TWILIO_AUTH_TOKEN is not set");
  return !!signature && twilio.validateRequest(token, signature, url, params);
}

// Serverless has no shared memory between invocations, so dedupe via Upstash Redis (REST).
// Returns true if this MessageSid is new. If Redis isn't configured, it allows everything.
export async function claimMessage(messageSid: string): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return true;
  try {
    const r = await fetch(`${url}/set/msg:${messageSid}/1/NX/EX/86400`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const j = (await r.json()) as { result: string | null };
    return j.result === "OK";
  } catch {
    return true; // fail open: a rare duplicate is better than a dropped message
  }
}
