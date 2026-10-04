// Scripted "Book an appointment" demo for Saathi (Ramesh Sharma, Indore). Fully deterministic:
// no model call, no real booking, no real phone call. Every name, clinic, fee and time is
// fictional mock data from the Feature 1 design doc. Channel-neutral: the web chat renders the
// buttons/list/cards; a plain-text channel would degrade them to numbered options.

export type Step =
  | "menu" | "reason" | "doctor" | "other_query" | "other_pick" | "when" | "date" | "daypart"
  | "followup" | "done" | "end";

export interface DemoState { step: Step; date?: string }
export interface Opt { id: string; label: string }
export type Msg =
  | { kind: "text"; text: string; time?: string }
  | { kind: "card"; text: string; time?: string }
  | { kind: "system"; text: string }
  | { kind: "day"; text: string }
  | { kind: "call"; clinic: string; lines: { who: "Saathi" | "Clinic"; t: number; text: string }[]; duration: string; time?: string }
  | { kind: "buttons"; options: Opt[] }
  | { kind: "list"; button: string; title: string; items: { id: string; title: string; desc: string }[] };

export interface DemoResult {
  state: DemoState;
  userTime?: string;  // timestamp shown on the user's bubble, as in the script
  silent?: boolean;   // true = a demo control, so no user bubble
  messages: Msg[];
}
export interface DemoInput { id?: string; text?: string }

const t = (text: string, time?: string): Msg => ({ kind: "text", text, time });

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
const RESTART: Msg = { kind: "buttons", options: [{ id: "restart", label: "↺ Restart demo" }] };
const BACK: Msg = { kind: "buttons", options: [{ id: "back_docs", label: "Back to my doctors" }] };

const DOCTOR_CARD: Msg = {
  kind: "card",
  time: "7:45 pm",
  text:
    "🩺 *Your previous cardiologists*\n\n" +
    "*1. Dr. Meera Kulkarni*\nHeartcare Clinic, Vijay Nagar\nLast seen: 14 Mar 2026 · 3 visits\nPrescribed: Amlodipine 5 mg\n\n" +
    "*2. Dr. Anil Joshi*\nCity Heart Centre, Palasia\nLast seen: Nov 2023 · 1 visit",
};

// Timestamps (seconds into the call) drive the live timer and the transcript's [m:ss] labels.
const CALL_LINES: { who: "Saathi" | "Clinic"; t: number; text: string }[] = [
  { who: "Saathi", t: 4, text: "Hello, this is Saathi, an AI assistant. I'm calling on behalf of Mr. Ramesh Sharma. Could I book an appointment with Dr. Kulkarni? He has visited your clinic before." },
  { who: "Clinic", t: 14, text: "Yes, which day would you like?" },
  { who: "Saathi", t: 19, text: "The earliest morning slot you have." },
  { who: "Clinic", t: 27, text: "Tomorrow at 11:30 am is free." },
  { who: "Saathi", t: 36, text: "That works. 6 October, 11:30 am, under the name Ramesh Sharma. What are the fees, and should he bring any reports?" },
  { who: "Clinic", t: 52, text: "The fee is 800 rupees. Please bring his old reports." },
  { who: "Saathi", t: 66, text: "Thank you. I'll send him the confirmation." },
  { who: "Clinic", t: 75, text: "Okay, thank you." },
];

const GREETING = /^\s*(hi+|hello+|hey+|namaste|hola)\b/i;
const has = (i: DemoInput, id: string, re?: RegExp) => i.id === id || (!!re && !i.id && re.test(i.text ?? ""));

function greet(): DemoResult {
  return {
    state: { step: "menu" },
    userTime: "7:42 pm",
    messages: [t("Hello Ramesh 🙏 I'm Saathi, your health assistant.\nHere is what I can help you with. Please choose one 👇", "7:42 pm"), MENU],
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
    done: [RESTART],
    end: [RESTART],
  };
  return { state: s, messages: [t(lead), ...by[s.step]] };
}

// The call happens right away (no overnight wait). It is placed on Monday morning so that
// "tomorrow at 11:30" in the transcript is Tuesday 6 Oct, matching the confirmation card.
function bookingFlow(): Msg[] {
  return [
    { kind: "day", text: "Monday, 5 Oct" },
    { kind: "call", clinic: "Heartcare Clinic, Vijay Nagar", lines: CALL_LINES, duration: "1:24", time: "10:04 am" },
    t("Ramesh, your appointment is confirmed ✅", "10:06 am"),
    {
      kind: "card",
      time: "10:06 am",
      text:
        "📅 *Appointment confirmed*\n\n*Dr. Meera Kulkarni*, Cardiologist\n🗓 *Tuesday, 6 Oct · 11:30 am*\n" +
        "📍 Heartcare Clinic, Vijay Nagar\n💰 Fees: ₹800 (payable at the clinic)\n🧾 Please bring: old reports and your medicine list",
    },
    t("What else can I do for you?\n\n🔔 Remind you tomorrow at 9:30 am?\n👨 Let Karan know?", "10:07 am"),
    FOLLOW,
  ];
}

export function saathiReply(state: DemoState | null | undefined, input: DemoInput): DemoResult {
  const text = (input.text ?? "").trim();
  if (input.id === "restart" || GREETING.test(text) || !state) return greet();

  switch (state.step) {
    case "menu": {
      if (has(input, "menu_1", /^\s*1\b|book|appointment/i)) {
        return {
          state: { step: "reason" },
          userTime: "7:43 pm",
          messages: [t("Of course 👍 What is the appointment for?\nYou can type or send a voice note 🎤", "7:43 pm")],
        };
      }
      if (has(input, "menu_3", /^\s*3\b|prescription/i)) {
        return {
          state,
          messages: [t("Send me a photo of the prescription with 📎 and I'll read it. This part uses the real prescription reader, not the script. Use a made-up prescription only."), MENU],
        };
      }
      if (/^menu_[2456]$/.test(input.id ?? "") || /^\s*[2456]\b/.test(text)) {
        return { state, messages: [t("That part isn't in this demo yet. Try 📅 Book an appointment."), MENU] };
      }
      return reprompt(state, "Please choose one from the menu 👇");
    }

    case "reason":
      if (/cardio|heart/i.test(text)) {
        return {
          state: { step: "doctor" },
          userTime: "7:44 pm",
          messages: [
            t("Got it ✅ A *cardiologist* appointment.\nOne moment, I'm checking your old prescriptions 🔍", "7:44 pm"),
            t("I found these cardiologists in your old prescriptions. Which one would you like to see?", "7:45 pm"),
            DOCTOR_CARD,
            DOCTORS,
          ],
        };
      }
      return { state, messages: [t("In this demo I can book a cardiologist. Try: \"I need to see a heart doctor\".")] };

    case "doctor":
      if (has(input, "doc_1", /kulkarni|^\s*1\b/i)) {
        return {
          state: { step: "when" },
          userTime: "7:46 pm",
          messages: [
            t("Great 👍 *Dr. Meera Kulkarni*, Heartcare Clinic, Vijay Nagar.\nClinic hours: Mon to Sat, 10 am to 6 pm.", "7:46 pm"),
            t("When would you like the appointment?", "7:46 pm"),
            WHEN,
          ],
        };
      }
      if (has(input, "doc_2", /joshi|^\s*2\b/i)) {
        return reprompt(state, "In this demo the booking call is only scripted for Dr. Kulkarni. Please pick her to see the full flow 🙂");
      }
      if (has(input, "doc_other", /someone else|other/i)) {
        return {
          state: { step: "other_query" },
          userTime: "7:46 pm",
          messages: [t("Okay. Please tell me the doctor's name, or the area where you'd like to be seen.", "7:46 pm")],
        };
      }
      return reprompt(state, "Please tap one of the options below 👇");

    case "other_query":
      if (!text) return { state, messages: [] };
      return {
        state: { step: "other_pick" },
        userTime: "7:47 pm",
        messages: [
          t("I've looked. I found these 3 options:", "7:48 pm"),
          {
            kind: "card",
            time: "7:48 pm",
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
      return reprompt(state, "In this demo the booking call is only scripted for Dr. Kulkarni, from your records. Tap below to go back.");

    case "when":
      if (has(input, "when_earliest", /earliest/i)) {
        return {
          state: { step: "daypart" },
          userTime: "7:47 pm",
          messages: [t("Understood. Would you prefer the morning or the evening?", "7:47 pm"), PARTS],
        };
      }
      if (has(input, "when_another", /another|date/i)) {
        return {
          state: { step: "date" },
          userTime: "7:47 pm",
          messages: [t("Sure. Which day would you like? You can type something like \"next Wednesday\" or \"15 October\".", "7:47 pm")],
        };
      }
      return reprompt(state, "Please tap one of the options below 👇");

    case "date":
      if (/fri|\b9\b/i.test(text)) {
        return {
          state: { step: "daypart", date: "Friday, 9 Oct" },
          userTime: "7:48 pm",
          messages: [t("*Friday, 9 Oct.* Morning or evening?", "7:48 pm"), PARTS],
        };
      }
      return { state, messages: [t("In this demo, please type \"Next Friday\".")] };

    case "daypart": {
      const part = input.id?.replace("part_", "") ?? (/morning/i.test(text) ? "morning" : /evening/i.test(text) ? "evening" : /either/i.test(text) ? "either" : "");
      if (!part) return reprompt(state, "Please tap one of the options below 👇");
      if (state.date) {
        const slot = part === "either" ? "slot" : `${part} slot`;
        return {
          state: { step: "end" },
          userTime: "7:48 pm",
          messages: [
            t(`Understood. Tomorrow at 10 am I'll call the clinic and ask for ${part === "either" ? "a" : "an"} *${slot} on ${state.date}*.\nIf that day is full, I'll ask you which day or time works instead. I won't book a different day on my own.`, "7:49 pm"),
            { kind: "system", text: "Demo ends here: the outcome of this branch isn't scripted." },
            RESTART,
          ],
        };
      }
      if (part === "morning") {
        return { state: { step: "followup" }, userTime: "7:48 pm", messages: bookingFlow() };
      }
      return reprompt(state, "In this demo the earliest-slot path is scripted for the morning. Please tap Morning.");
    }

    case "followup":
      if (has(input, "both", /both/i)) {
        return {
          state: { step: "done" },
          userTime: "10:15 am",
          messages: [
            t("Done ✅\n🔔 I'll remind you tomorrow at 9:30 am and send the route to the clinic.\n👨 I've messaged Karan: \"Papa has an appointment with Dr. Kulkarni tomorrow at 11:30 am.\"", "10:15 am"),
          ],
        };
      }
      if (has(input, "remind", /remind/i)) {
        return {
          state: { step: "done" },
          userTime: "10:15 am",
          messages: [t("Done ✅\n🔔 I'll remind you tomorrow at 9:30 am and send the route to the clinic.", "10:15 am")],
        };
      }
      if (has(input, "none", /no thanks|^no\b/i)) {
        return {
          state: { step: "done" },
          userTime: "10:15 am",
          messages: [t("No problem 🙏 I'm here whenever you need me.", "10:15 am")],
        };
      }
      return reprompt(state, "Please tap one of the options below 👇");

    case "done":
      if (/thank/i.test(text)) {
        return { state: { step: "end" }, userTime: "10:16 am", messages: [t("You're welcome, Ramesh 🙏", "10:16 am"), RESTART] };
      }
      return reprompt(state, "That's the end of the demo. Type \"Hi\" to start over.");

    case "end":
    default:
      return reprompt({ step: "end" }, "That's the end of the demo. Type \"Hi\" to start over.");
  }
}
