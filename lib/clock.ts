// Dates for the booking flow, computed from the caller's real clock and time zone (sent by the
// browser) so the chat and the voice call never show made-up dates. The clinic is closed on
// Sundays, so the appointment lands on the first open day from tomorrow.
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_L = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface Day { weekday: string; d: number; monShort: string; monLong: string; label: string }  // label: "Tuesday, 6 Oct"
export interface Clock {
  nowTime: string;                 // "8:15 pm" in the caller's time zone
  today: Day;
  appt: Day & { word: string };    // first open day from tomorrow; word: "tomorrow" | "on Monday"
  nextFriday: Day;
}

const DEFAULT_TZ = "Asia/Kolkata";

function validTz(tz: unknown): string {
  if (typeof tz !== "string" || !tz) return DEFAULT_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return DEFAULT_TZ; }
}

export function makeClock(nowMs?: number, tzIn?: string): Clock {
  const tz = validTz(tzIn);
  const now = typeof nowMs === "number" && Number.isFinite(nowMs) ? nowMs : Date.now();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = Number(get("year")), m = Number(get("month")), d = Number(get("day"));
  const nowTime = `${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;

  const dayAt = (offset: number): Day => {
    const dt = new Date(Date.UTC(y, m - 1, d + offset));
    const weekday = WD[dt.getUTCDay()], dd = dt.getUTCDate(), mi = dt.getUTCMonth();
    return { weekday, d: dd, monShort: MON_S[mi], monLong: MON_L[mi], label: `${weekday}, ${dd} ${MON_S[mi]}` };
  };
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  let off = 1;
  if (new Date(Date.UTC(y, m - 1, d + 1)).getUTCDay() === 0) off = 2;          // closed on Sunday
  const appt = dayAt(off);
  return {
    nowTime,
    today: dayAt(0),
    appt: { ...appt, word: off === 1 ? "tomorrow" : `on ${appt.weekday}` },
    nextFriday: dayAt(((5 - dow + 7) % 7) || 7),
  };
}
