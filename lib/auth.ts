import { timingSafeEqual } from "node:crypto";

// Shared password gate for the test-only endpoints (/api/chat, /api/voice). They spend model
// or voice credits on a public URL, so they stay disabled unless CHAT_TEST_PASSWORD is set.
export function passwordOk(given: string | undefined): boolean {
  const want = process.env.CHAT_TEST_PASSWORD;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
