import twilio from "twilio";

const sid = process.env.TWILIO_ACCOUNT_SID!;
const token = process.env.TWILIO_AUTH_TOKEN!;
const from = process.env.TWILIO_WHATSAPP_FROM!;

let _client: ReturnType<typeof twilio> | null = null;
const client = () => (_client ??= twilio(sid, token));

export async function sendWhatsApp(to: string, body: string) {
  for (let i = 0; i < body.length; i += 1500) {
    await client().messages.create({ from, to, body: body.slice(i, i + 1500) });
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

export function isValidSignature(signature: string | undefined, url: string, params: Record<string, string>) {
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
