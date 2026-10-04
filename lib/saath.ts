// Scripted "Book an appointment" flow for Saath (Ramesh Sharma, Indore). Fully deterministic:
// no model call, no real booking, no real phone call. Names, clinics and fees are fictional mock
// data from the Feature 1 design doc. Dates and times come from the caller's real clock
// (input.now / input.tz); nothing here carries a fixed timestamp. Channel-neutral: the web chat
// renders the buttons/list/cards; a plain-text channel would degrade them to numbered options.
import { makeClock, type Clock } from "./clock.js";
import { callLines, CALL_META } from "./callscript.js";

export type Step =
  | "menu" | "reason" | "doctor" | "other_query" | "other_pick" | "when" | "date" | "daypart"
  | "followup" | "done" | "end";

export interface DemoState { step: Step; date?: string }
export interface Opt { id: string; label: string }
export type Msg =
  | { kind: "text"; text: string }
  | { kind: "card"; text: string }
  | { kind: "system"; text: string }
  | { kind: "transcript"; clinic: string; lines: { who: "Saath" | "Clinic"; t: number; text: string }[]; duration: string }
  | { kind: "buttons"; options: Opt[] }
  | { kind: "list"; button: string; title: string; items: { id: string; title: string; desc: string }[] };

export interface DemoResult {
  state: DemoState;
  messages: Msg[];
}
export interface DemoInput { id?: string; text?: string; now?: number; tz?: string }

const t = (text: string): Msg => ({ kind: "text", text });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const MENU: Msg = {
  kind: "list",
  button: "📋 View menu",
  title: "What can I do for you?",
  items: [
    { id: "menu_1", title: "📅 Book an appointment", desc: "Find a doctor and call the clinic to get a slot" },
    { id: "menu_2", title: "🩺 Doctor visit", desc: "A summary of your history, and a summary of what the doctor said" },
    { id: "menu_3", title: "💊 Upload a prescription", desc: "What to take and when, and ordering your medicines" },
    { id: "menu_4", title: "📦 Where is my order?", desc: "Delivery status of your medicines" },
    { id: "menu_5", title: "⏰ Medicine reminders", desc: "Reminders at the right time" },
    { id: "menu_6", title: "📊 My health report", desc: "Your week at a glance, and sharing with family" },
  ],
};
const DOCTORS: Msg = {
  kind: "buttons",
  options: [{ id: "doc_1", label: "1. Dr. Kulkarni" }, { id: "doc_2", label: "2. Dr. Joshi" }, { id: "doc_other", label: "Someone else" }],
};
const WHEN: Msg = { kind: "buttons", options: [{ id: "when_earliest", label: "Earliest slot" }, { id: "when_another", label: "Another date" }] };
const PARTS: Msg = {
  kind: "buttons",
  options: [{ id: "part_morning", label: "Morning" }, { id: "part_evening", label: "Evening" }, { id: "part_either", label: "Either" }],
};
const FOLLOW: Msg = {
  kind: "buttons",
  options: [{ id: "both", label: "Do both" }, { id: "remind", label: "Just remind me" }, { id: "none", label: "No thanks" }],
};
const BACK: Msg = { kind: "buttons", options: [{ id: "back_docs", label: "Back to my doctors" }] };

const DOCTOR_CARD: Msg = {
  kind: "card",
  text:
    "🩺 *Your previous cardiologists*\n\n" +
    "*1. Dr. Meera Kulkarni*\nHeartcare Clinic, Vijay Nagar\nLast seen: 14 Mar 2026 · 3 visits\nPrescribed: Amlodipine 5 mg\n\n" +
    "*2. Dr. Anil Joshi*\nCity Heart Centre, Palasia\nLast seen: Nov 2023 · 1 visit",
};

const GREETING = /^\s*(hi+|hello+|hey+|namaste|hola)\b/i;
const has = (i: DemoInput, id: string, re?: RegExp) => i.id === id || (!!re && !i.id && re.test(i.text ?? ""));

function greet(): DemoResult {
  return {
    state: { step: "menu" },
    messages: [t("Hello Ramesh 🙏 I'm Saath, your health assistant.\nHere is what I can help you with. Please choose one 👇"), MENU],
  };
}

// Re-show whatever the current step is waiting for, after input we can't use.
function reprompt(s: DemoState, lead: string): DemoResult {
  const by: Record<Step, Msg[]> = {
    menu: [MENU],
    reason: [],
    doctor: [DOCTORS],
    other_query: [],
    other_pick: [BACK],
    when: [WHEN],
    date: [],
    daypart: [PARTS],
    followup: [FOLLOW],
    done: [MENU],
    end: [MENU],
  };
  return { state: s, messages: [t(lead), ...by[s.step]] };
}

// The chat shows only the outcome of the call: a note, the finished transcript and the
// confirmation. The live call is on the voice screen.
function bookingFlow(c: Clock): Msg[] {
  return [
    { kind: "system", text: `Saath called Heartcare Clinic · ${c.nowTime} (1 min 24 sec)` },
    { kind: "transcript", clinic: CALL_META.clinic, lines: callLines(c), duration: CALL_META.duration },
    t("Ramesh, your appointment is confirmed ✅"),
    {
      kind: "card",
      text:
        `📅 *Appointment confirmed*\n\n*Dr. Meera Kulkarni*, Cardiologist\n🗓 *${c.appt.label} · 11:30 am*\n` +
        "📍 Heartcare Clinic, Vijay Nagar\n💰 Fees: ₹800 (payable at the clinic)\n🧾 Please bring: old reports and your medicine list",
    },
    t(`What else can I do for you?\n\n🔔 Remind you ${c.appt.word} at 9:30 am?\n👨 Let Karan know?`),
    FOLLOW,
  ];
}

export function saathReply(state: DemoState | null | undefined, input: DemoInput): DemoResult {
  const text = (input.text ?? "").trim();
  if (input.id === "restart" || GREETING.test(text) || !state) return greet();
  const clock = makeClock(input.now, input.tz);

  switch (state.step) {
    case "menu": {
      if (has(input, "menu_1", /^\s*1\b|book|appointment/i)) {
        return {
          state: { step: "reason" },
          messages: [t("Of course 👍 What is the appointment for?\nYou can type or send a voice note 🎤")],
        };
      }
      if (has(input, "menu_3", /^\s*3\b|prescription/i)) {
        return {
          state,
          messages: [t("Send me a photo of the prescription using 📎 and I'll read it for you.")],
        };
      }
      if (/^menu_[2456]$/.test(input.id ?? "") || /^\s*[2456]\b/.test(text)) {
        return { state, messages: [t("I can't help with that just yet. Right now I can book appointments for you 📅"), MENU] };
      }
      return reprompt(state, "Please choose one from the menu 👇");
    }

    case "reason":
      if (/cardio|heart/i.test(text)) {
        return {
          state: { step: "doctor" },
          messages: [
            t("Got it ✅ A *cardiologist* appointment.\nOne moment, I'm checking your old prescriptions 🔍"),
            t("I found these cardiologists in your old prescriptions. Which one would you like to see?"),
            DOCTOR_CARD,
            DOCTORS,
          ],
        };
      }
      return { state, messages: [t("I can help you book a cardiologist. Tell me, for example, \"I need to see a heart doctor\".")] };

    case "doctor":
      if (has(input, "doc_1", /kulkarni|^\s*1\b/i)) {
        return {
          state: { step: "when" },
          messages: [
            t("Great 👍 *Dr. Meera Kulkarni*, Heartcare Clinic, Vijay Nagar.\nClinic hours: Mon to Sat, 10 am to 6 pm."),
            t("When would you like the appointment?"),
            WHEN,
          ],
        };
      }
      if (has(input, "doc_2", /joshi|^\s*2\b/i)) {
        return reprompt(state, "I can't book with Dr. Joshi right now. Would you like to see Dr. Kulkarni instead?");
      }
      if (has(input, "doc_other", /someone else|other/i)) {
        return {
          state: { step: "other_query" },
          messages: [t("Okay. Please tell me the doctor's name, or the area where you'd like to be seen.")],
        };
      }
      return reprompt(state, "Please tap one of the options below 👇");

    case "other_query":
      if (!text) return { state, messages: [] };
      return {
        state: { step: "other_pick" },
        messages: [
          t("I've looked. I found these 3 options:"),
          {
            kind: "card",
            text:
              "🔍 *Cardiologists near Vijay Nagar (from the web, not from your records)*\n\n" +
              "*1. Dr. Neha Rao* · 4.7★ (180) · Aadarsh Hospital, Vijay Nagar\n" +
              "*2. Dr. Sameer Bhatt* · 4.5★ (96) · LifeLine Clinic, Scheme 54\n" +
              "*3. Dr. Rohit Sinha* · 4.4★ (210) · Medicare Centre, Bhawarkuan",
          },
          {
            kind: "buttons",
            options: [{ id: "web_1", label: "1" }, { id: "web_2", label: "2" }, { id: "web_3", label: "3" }, { id: "back_docs", label: "Back to my doctors" }],
          },
        ],
      };

    case "other_pick":
      if (input.id === "back_docs" || /back/i.test(text)) {
        return { state: { step: "doctor" }, messages: [t("Here are your doctors again:"), DOCTOR_CARD, DOCTORS] };
      }
      return reprompt(state, "I can't book with that doctor right now. Would you like to go back to your doctors?");

    case "when":
      if (has(input, "when_earliest", /earliest/i)) {
        return {
          state: { step: "daypart" },
          messages: [t("Understood. Would you prefer the morning or the evening?"), PARTS],
        };
      }
      if (has(input, "when_another", /another|date/i)) {
        return {
          state: { step: "date" },
          messages: [t("Sure. Which day would you like? You can type something like \"next Wednesday\" or \"15 October\".")],
        };
      }
      return reprompt(state, "Please tap one of the options below 👇");

    case "date":
      if (/fri/i.test(text)) {
        return {
          state: { step: "daypart", date: clock.nextFriday.label },
          messages: [t(`*${clock.nextFriday.label}.* Morning or evening?`), PARTS],
        };
      }
      return { state, messages: [t("Sorry, I couldn't tell which day you mean. You can type something like \"next Friday\".")] };

    case "daypart": {
      const part = input.id?.replace("part_", "") ?? (/morning/i.test(text) ? "morning" : /evening/i.test(text) ? "evening" : /either/i.test(text) ? "either" : "");
      if (!part) return reprompt(state, "Please tap one of the options below 👇");
      if (state.date) {
        const slot = part === "either" ? "slot" : `${part} slot`;
        return {
          state: { step: "end" },
          messages: [
            t(`Understood. ${cap(clock.appt.word)} at 10 am I'll call the clinic and ask for ${part === "either" ? "a" : "an"} *${slot} on ${state.date}*.\nIf that day is full, I'll ask you which day or time works instead. I won't book a different day on my own.`),
          ],
        };
      }
      if (part === "morning") {
        return { state: { step: "followup" }, messages: bookingFlow(clock) };
      }
      return reprompt(state, "The earliest slot I can ask for is in the morning. Would you like a morning slot?");
    }

    case "followup":
      if (has(input, "both", /both/i)) {
        return {
          state: { step: "done" },
          messages: [
            t(`Done ✅\n🔔 I'll remind you ${clock.appt.word} at 9:30 am and send the route to the clinic.\n👨 I've messaged Karan: "Papa has an appointment with Dr. Kulkarni ${clock.appt.word} at 11:30 am."`),
          ],
        };
      }
      if (has(input, "remind", /remind/i)) {
        return {
          state: { step: "done" },
          messages: [t(`Done ✅\n🔔 I'll remind you ${clock.appt.word} at 9:30 am and send the route to the clinic.`)],
        };
      }
      if (has(input, "none", /no thanks|^no\b/i)) {
        return {
          state: { step: "done" },
          messages: [t("No problem 🙏 I'm here whenever you need me.")],
        };
      }
      return reprompt(state, "Please tap one of the options below 👇");

    case "done":
      if (/thank/i.test(text)) {
        return { state: { step: "end" }, messages: [t("You're welcome, Ramesh 🙏")] };
      }
      return reprompt(state, "Is there anything else I can help you with?");

    case "end":
    default:
      return reprompt({ step: "end" }, "Is there anything else I can help you with?");
  }
}
