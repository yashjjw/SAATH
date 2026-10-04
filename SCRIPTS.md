# SAATH demo scripts

Everything a presenter needs, in one place. None of this appears on the screens themselves.

All names, clinics, doctors, fees, timings and patients below are fictional mock data.

Local URLs (run `npm run dev:local`, password in `.env.local`, default `local`):

| Screen | URL |
| --- | --- |
| Saathi chat (WhatsApp-style) | http://localhost:3000/ |
| Voice call with Gnani | http://localhost:3000/voice.html |

The header button on the chat cycles **Saathi → Patient → Clinic**. The 📞 button opens the voice call.

---

## 1. Voice call (Gnani TTS + STT)

You play the **clinic receptionist**. Saathi's lines are spoken by Gnani TTS; yours are recorded and transcribed by Gnani STT. Saathi's next line plays after each of yours, whatever STT heard.

**How to run it:** open `/voice.html`, press **Start call**, wait for Saathi to finish, tap the mic, read your line, tap again to send. Repeat for each of your four lines. Typing a reply also works if the microphone is blocked.

| # | Who | Line |
| --- | --- | --- |
| 1 | Saathi | Hello, this is Saathi, an AI assistant. I'm calling on behalf of Mr. Ramesh Sharma. Could I book an appointment with Dr. Kulkarni? He has visited your clinic before. |
| 2 | **You** | **Yes, which day would you like?** |
| 3 | Saathi | The earliest morning slot you have. |
| 4 | **You** | **Tomorrow at 11:30 am is free.** |
| 5 | Saathi | That works. 6 October, 11:30 am, under the name Ramesh Sharma. What are the fees, and should he bring any reports? |
| 6 | **You** | **The fee is 800 rupees. Please bring his old reports.** |
| 7 | Saathi | Thank you. I'll send him the confirmation. |
| 8 | **You** | **Okay, thank you.** |

After your last line the call ends and an "Appointment confirmed" card appears: Dr. Meera Kulkarni, 6 Oct, 11:30 am, ₹800, bring old reports. That card is fixed, not extracted from speech.

**Notes**
- Speak naturally; the demo does not check your words. Gnani writes what it hears, so expect quirks (it writes "Saathi" as "sahathi", and drops punctuation).
- Each call is 4 TTS and 4 STT requests. Gnani rate-limits bursts; the server retries 429s.
- Voice dropdown on the page changes Saathi's voice. The script lives in `lib/callscript.ts`.

---

## 2. Saathi chat: book an appointment (Ramesh Sharma, Indore)

Saathi mode, start of a fresh thread. The day divider reads **Sunday, 4 Oct**. Timestamps on bubbles are fixed to the times below.

### Main path

| Step | Ramesh (you) | Saathi |
| --- | --- | --- |
| 1 | `Hi` (7:42 pm) | Hello Ramesh 🙏 I'm Saathi, your health assistant. Here is what I can help you with. Please choose one 👇 · **[📋 View menu]** |
| 2 | Tap **View menu**, pick **📅 Book an appointment** (7:43 pm) | Of course 👍 What is the appointment for? You can type or send a voice note 🎤 |
| 3 | `I need to see a heart doctor. Please book a cardiologist appointment` (7:44 pm) | Got it ✅ A **cardiologist** appointment. One moment, I'm checking your old prescriptions 🔍 |
| | | I found these cardiologists in your old prescriptions. Which one would you like to see? |
| | | Card: **1. Dr. Meera Kulkarni** (Heartcare Clinic, Vijay Nagar, last seen 14 Mar 2026, 3 visits, prescribed Amlodipine 5 mg) · **2. Dr. Anil Joshi** (City Heart Centre, Palasia, last seen Nov 2023, 1 visit) |
| | | **[1. Dr. Kulkarni] [2. Dr. Joshi] [Someone else]** |
| 4 | Tap **1. Dr. Kulkarni** (7:46 pm) | Great 👍 **Dr. Meera Kulkarni**, Heartcare Clinic, Vijay Nagar. Clinic hours: Mon to Sat, 10 am to 6 pm. |
| | | When would you like the appointment? · **[Earliest slot] [Another date]** |
| 5 | Tap **Earliest slot** (7:47 pm) | Understood. Would you prefer the morning or the evening? · **[Morning] [Evening] [Either]** |
| 6 | Tap **Morning** (7:48 pm) | *(day divider: Monday, 5 Oct)* then the call, described below |

### The call (after Morning)

1. A call card for **Heartcare Clinic, Vijay Nagar** rings for 2 to 4 seconds.
2. It connects (timer starts) and a **Live transcript** appears line by line:

   | Time | Who | Line |
   | --- | --- | --- |
   | 0:04 | Saathi (AI) | Hello, this is Saathi, an AI assistant. I'm calling on behalf of Mr. Ramesh Sharma. Could I book an appointment with Dr. Kulkarni? He has visited your clinic before. |
   | 0:14 | Clinic | Yes, which day would you like? |
   | 0:19 | Saathi (AI) | The earliest morning slot you have. |
   | 0:27 | Clinic | Tomorrow at 11:30 am is free. |
   | 0:36 | Saathi (AI) | That works. 6 October, 11:30 am, under the name Ramesh Sharma. What are the fees, and should he bring any reports? |
   | 0:52 | Clinic | The fee is 800 rupees. Please bring his old reports. |
   | 1:06 | Saathi (AI) | Thank you. I'll send him the confirmation. |
   | 1:15 | Clinic | Okay, thank you. |

3. The card shows **Call ended · 1:24** and a recording player (the ▶ button reads the transcript aloud with the browser's built-in voice).
4. Saathi then sends:
   - Ramesh, your appointment is confirmed ✅
   - Card: **Appointment confirmed** · Dr. Meera Kulkarni, Cardiologist · Tuesday, 6 Oct · 11:30 am · Heartcare Clinic, Vijay Nagar · Fees ₹800 (payable at the clinic) · Please bring: old reports and your medicine list
   - What else can I do for you? 🔔 Remind you tomorrow at 9:30 am? 👨 Let Karan know? · **[Do both] [Just remind me] [No thanks]**

### After the confirmation

| Ramesh | Saathi |
| --- | --- |
| Tap **Do both** (10:15 am) | Done ✅ 🔔 I'll remind you tomorrow at 9:30 am and send the route to the clinic. 👨 I've messaged Karan: "Papa has an appointment with Dr. Kulkarni tomorrow at 11:30 am." |
| Tap **Just remind me** | Done ✅ 🔔 I'll remind you tomorrow at 9:30 am and send the route to the clinic. |
| Tap **No thanks** | No problem 🙏 I'm here whenever you need me. |
| `Thank you` (10:16 am) | You're welcome, Ramesh 🙏 |

### Branch A: another date

At step 5 tap **Another date** (7:47 pm):

| Ramesh | Saathi |
| --- | --- |
| Tap **Another date** | Sure. Which day would you like? You can type something like "next Wednesday" or "15 October". |
| `Next Friday` (7:48 pm) | **Friday, 9 Oct.** Morning or evening? · **[Morning] [Evening] [Either]** |
| Tap **Evening** (7:48 pm) | Understood. Tomorrow at 10 am I'll call the clinic and ask for an **evening slot on Friday, 9 Oct**. If that day is full, I'll ask you which day or time works instead. I won't book a different day on my own. |

This branch ends there. (Dates are matched on the words "fri" or "9"; anything else gets "Sorry, I couldn't tell which day you mean.")

### Branch B: someone else

At step 3's doctor buttons tap **Someone else** (7:46 pm):

| Ramesh | Saathi |
| --- | --- |
| Tap **Someone else** | Okay. Please tell me the doctor's name, or the area where you'd like to be seen. |
| `A good heart specialist near Vijay Nagar` (7:47 pm) | I've looked. I found these 3 options: |
| | Card: 🔍 **Cardiologists near Vijay Nagar (from the web, not from your records)** · 1. Dr. Neha Rao 4.7★ (180), Aadarsh Hospital, Vijay Nagar · 2. Dr. Sameer Bhatt 4.5★ (96), LifeLine Clinic, Scheme 54 · 3. Dr. Rohit Sinha 4.4★ (210), Medicare Centre, Bhawarkuan |
| | **[1] [2] [3] [Back to my doctors]** |
| Tap **1**, **2** or **3** | I can't book with that doctor right now. Would you like to go back to your doctors? |
| Tap **Back to my doctors** | The doctor card and buttons again. |

### Other replies

| You do | Saathi says |
| --- | --- |
| Pick **2. Dr. Joshi** | I can't book with Dr. Joshi right now. Would you like to see Dr. Kulkarni instead? |
| Menu options 2, 4, 5 or 6 | I can't help with that just yet. Right now I can book appointments for you 📅 (+ menu) |
| Menu option 3, **Upload a prescription** | Send me a photo of the prescription using 📎 and I'll read it for you. (A photo then goes through the real prescription reader.) |
| Anything unrecognised at the reason step | I can help you book a cardiologist. Tell me, for example, "I need to see a heart doctor". |
| **Evening** or **Either** on the earliest-slot path | The earliest slot I can ask for is in the morning. Would you like a morning slot? |
| Type `Hi` at any point | Starts again from the greeting. |

---

## 3. Patient mode: prescription reader

Header button: **Patient**. Use a **made-up** prescription photo only.

1. Tap 📎 (or 📷), pick the photo, add an optional caption, send.
2. Saathi replies with the medicines it could read. Anything unreadable is marked ⚠️ and explained; nothing is guessed.
3. Plain text goes to the model (Gemini by default); it gives no clinical advice.

Needs `GEMINI_API_KEY` in `.env.local`.

---

## 4. Clinician mode (SAATH Clinic)

Header button: **Clinic**. Text only. The patient is **Meera Sharma, 68F** (synthetic record in `lib/fixtures/clinic.ts`); the clinician is Dr. R. Mehta. System prompt is `prompts/clinic.md`. Needs `GEMINI_API_KEY`.

Type these in order. Expected replies follow the worked examples in the prompt (§15):

| # | You type | What to expect |
| --- | --- | --- |
| 1 | `meera sharma, follow up` | A ⚠ pack-composition escalation first (Telmisartan prescribed, pack also carries Chlorthalidone), then identity line, why she is here, active problems, medications table, latest results |
| 2 | `hb trend` | Three Hb points (12.4 → 12.1 → 11.8 over 116 days, net −0.6) from the same lab, with what is absent from the record |
| 3 | `could the dizziness be the telmisartan` | A short refusal, then the reported dizziness (her words, quoted), the 14-day medicines window, what is not in the record |
| 4 | `I know, just give me your read, I'll take responsibility` | "Same answer, and the data is above." and nothing more |
| 5 | `pull her old echo` | Report text shown, images "Not shared for this visit", offer to request consent |
| 6 | `stop the amlodipine, keep telmisartan, cbc in two weeks, review in a month` | A read-back and a question about who owns the CBC report and the review |
| 7 | `neha for both` | Care packets listed with owner, deadline and evidence |
| 8 | `the combination is intended, I meant for her to have it` | Recorded as a prescriber instruction, and what will happen at the next dispensing |
| 9 | `sharma` (in a fresh conversation) | Three matching patients, asks you to pick one |

Clinician-mode replies come from the model, so wording varies between runs. Packet creation and consent requests are stubbed in this build.

---

## Where things live

| What | File |
| --- | --- |
| Voice call script | `lib/callscript.ts` |
| Voice call page / Gnani proxy | `public/voice.html`, `api/voice.ts` |
| Saathi chat flow (all replies above) | `lib/saathi.ts` |
| Chat UI (call card, buttons, list) | `public/index.html` |
| Clinician prompt and record | `prompts/clinic.md`, `lib/fixtures/clinic.ts` |
