import type { VercelRequest, VercelResponse } from "@vercel/node";
import { passwordOk } from "../lib/auth.js";
import { CALL_META, callLines, outcome } from "../lib/callscript.js";
import { makeClock } from "../lib/clock.js";

// Gnani (Vachana) speech proxy for the voice-call simulation. The API key stays server-side.
//   TTS  POST {BASE}/api/v1/tts/inference   JSON in, binary audio out   (Timbre v2.5)
//   STT  POST {BASE}/stt/v3                 multipart in, {transcript}  (Prisma v2.5)
// Contracts taken from https://docs.gnani.ai (verify against the live docs if a call fails).
const BASE = "https://api.vachana.ai";
const TTS_LANGS = new Set(["en-IN", "hi-IN", "hi-en", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN"]);
const STT_LANGS = new Set(["en-IN", "hi-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN"]);

class GnaniError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

function explain(status: number, body: string): string {
  const hint = status === 403 ? "invalid API key or no credits" : status === 429 ? "rate limited" : status === 400 ? "bad request (check voice and language)" : "service error";
  return `Gnani ${status} (${hint}): ${body.slice(0, 200)}`;
}

// Gnani streams WAV with 0xFFFFFFFF in the RIFF and data size fields. Browsers then report an
// infinite duration and can't seek, so write the real sizes into the header.
export function fixWav(buf: Buffer): Buffer {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return buf;
  const out = Buffer.from(buf);
  out.writeUInt32LE(out.length - 8, 4);
  let off = 12;
  while (off + 8 <= out.length) {
    const id = out.toString("ascii", off, off + 4);
    if (id === "data") { out.writeUInt32LE(out.length - off - 8, off + 4); break; }
    off += 8 + out.readUInt32LE(off + 4);
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry rate limits and transient 5xx with backoff (1.5s, 3s). Client errors (400/403) fail fast.
async function withRetry(label: string, run: () => Promise<Response>): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt * 1500);
    last = await run();
    if (last.ok || ![429, 500, 502, 503, 504].includes(last.status)) return last;
    console.warn(`gnani ${label} ${last.status}, attempt ${attempt + 1}/3`);
  }
  return last!;
}

async function tts(key: string, text: string, voice: string, language: string): Promise<Buffer> {
  const r = await withRetry("tts", () => fetch(`${BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-API-Key-ID": key },
    body: JSON.stringify({
      text, model: "timbre-v2.5", voice, language, speed: 1.0,
      audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
    }),
    signal: AbortSignal.timeout(30_000),
  }));
  if (!r.ok) throw new GnaniError(r.status, explain(r.status, await r.text()));
  return fixWav(Buffer.from(await r.arrayBuffer()));
}

async function stt(key: string, audio: Buffer, mime: string, language: string): Promise<string> {
  const r = await withRetry("stt", () => {
    const fd = new FormData();   // rebuilt per attempt: a consumed body can't be resent
    fd.append("audio_file", new Blob([Uint8Array.from(audio)], { type: mime }), "audio.wav");
    fd.append("language_code", language);
    fd.append("format", "transcribe");
    return fetch(`${BASE}/stt/v3`, { method: "POST", headers: { "X-API-Key-ID": key }, body: fd, signal: AbortSignal.timeout(30_000) });
  });
  if (!r.ok) throw new GnaniError(r.status, explain(r.status, await r.text()));
  const j = (await r.json()) as { transcript?: string };
  return (j.transcript ?? "").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.CHAT_TEST_PASSWORD) return res.status(404).json({ error: "voice tester disabled" });
  if (!passwordOk(req.headers["x-test-key"] as string | undefined)) return res.status(401).json({ error: "wrong password" });

  const body = (req.body ?? {}) as Record<string, any>;
  const key = process.env.GNANI_API_KEY;

  if (body.action === "script") {
    const clock = makeClock(typeof body.now === "number" ? body.now : undefined, typeof body.tz === "string" ? body.tz : undefined);
    return res.json({ ...CALL_META, lines: callLines(clock), outcome: outcome(clock), gnani: !!key });
  }

  if (!key) return res.status(503).json({ error: "GNANI_API_KEY is not set" });

  const language = String(body.language ?? "en-IN");
  try {
    if (body.action === "speak") {
      const text = String(body.text ?? "").trim().slice(0, 600);
      const voice = String(body.voice ?? "");
      if (!text) return res.status(400).json({ error: "text is required" });
      if (!/^[A-Za-z]{2,24}$/.test(voice)) return res.status(400).json({ error: "invalid voice name" });
      if (!TTS_LANGS.has(language)) return res.status(400).json({ error: "unsupported language" });

      const t0 = Date.now();
      const audio = await tts(key, text, voice, language);
      const ttsMs = Date.now() - t0;
      const out: Record<string, unknown> = { audio: audio.toString("base64"), mime: "audio/wav", ms: { tts: ttsMs } };

      // Feed the synthesized audio straight back through STT: what the other party "heard".
      if (body.transcribe !== false && STT_LANGS.has(language)) {
        const t1 = Date.now();
        try {
          out.transcript = await stt(key, audio, "audio/wav", language);
        } catch (e) {
          out.sttError = e instanceof Error ? e.message : String(e);
        }
        (out.ms as any).stt = Date.now() - t1;
      }
      return res.json(out);
    }

    if (body.action === "stt") {
      const b64 = String(body.audio ?? "");
      if (!b64 || b64.length > 4_000_000) return res.status(400).json({ error: "audio missing or too large" });
      if (!STT_LANGS.has(language)) return res.status(400).json({ error: "unsupported language" });
      const t0 = Date.now();
      const transcript = await stt(key, Buffer.from(b64, "base64"), String(body.mime ?? "audio/wav"), language);
      return res.json({ transcript, ms: { stt: Date.now() - t0 } });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    console.error("voice failed", e instanceof Error ? e.message : e);
    const status = e instanceof GnaniError ? e.status : 502;
    return res.status(status === 403 || status === 429 || status === 400 ? status : 502).json({ error: e instanceof Error ? e.message : "voice request failed" });
  }
}
