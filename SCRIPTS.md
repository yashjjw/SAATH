# SAATH demo scripts

Everything a presenter needs, in one place. None of this appears on the screens themselves.

All names, clinics, doctors, fees, timings and patients below are fictional mock data.

Local URLs (run `npm run dev:local`, password in `.env.local`, default `local`):

| Screen | URL |
| --- | --- |
| Saath chat (WhatsApp-style) | http://localhost:3000/ |
| Voice call with Gnani | http://localhost:3000/voice.html |

The header button on the chat cycles **Saath → Patient → Clinic**. The 📞 button opens the voice call.

---

## 1. Voice call (Gnani TTS + STT)

You play the **clinic receptionist**. Saath's lines are spoken by Gnani TTS; yours are recorded and transcribed by Gnani STT. Saath's next line plays after each of yours, whatever STT heard.

**How to run it:** open `/voice.html`, press **Start call**, wait for Saath to finish, tap the mic, read your line, tap again to send. Repeat for each of your four lines. Typing a reply also works if the microphone is blocked.

| # | Who | Line |
| --- | --- | --- |
| 1 | Saath | Hello, this is Saath, an AI assistant. I'm calling on behalf of Mr. Ramesh Sharma. Could I book an appointment with Dr. Kulkarni? He has visited your clinic before. |
| 2 | **You** | **Yes, which day would you like?** |
| 3 | Saath | The earliest morning slot you have. |
| 4 | **You** | **Tomorrow at 11:30 am is free.** (on a Saturday, say **Monday at 11:30 am is free.** instead, because the clinic is closed on Sunday) |
| 5 | Saath | That works. *{tomorrow's date, e.g. 5 October}*, 11:30 am, under the name Ramesh Sharma. What are the fees, and should he bring any reports? |
| 6 | **You** | **The fee is 800 rupees. Please bring his old reports.** |
| 7 | Saath | Thank you. I'll send him the confirmation. |
| 8 | **You** | **Okay, thank you.** |

After your last line the call ends and an "Appointment confirmed" card appears: Dr. Meera Kulkarni, the appointment date (e.g. 5 Oct), 11:30 am, ₹800, bring old reports. That card is fixed, not extracted from speech.

**Dates come from the real clock.** The appointment is **tomorrow**, worked out from your device's date and time zone when you press Start call. The clinic is closed on Sundays, so on a Saturday the appointment moves to **Monday** and Saath says that date instead. The call screen does not display your lines, so use the table above.

**Notes**
- Speak naturally; the demo does not check your words. Gnani writes what it hears, so expect small quirks on names and no punctuation.
- Each call is 4 TTS and 4 STT requests. Gnani rate-limits bursts; the server retries 429s.
- Voice dropdown on the page changes Saath's voice. The script lives in `lib/callscript.ts`.

---

## 2. Saath chat: book an appointment (Ramesh Sharma, Indore)

Saath mode, start of a fresh thread. The day divider shows **today's real date**. Message bubbles carry no timestamps (only delivery ticks on yours, and a 🔊 on Saath's replies); the one clock time in the thread is in the "Saath called Heartcare Clinic · {time}" note. Dates below use an example where today is Sunday 4 Oct.

### Main path

| Step | Ramesh (you) | Saath |
| --- | --- | --- |
| 1 | `Hi` | Hello Ramesh 🙏 I'm Saath, your health assistant. Here is what I can help you with. Please choose one 👇 · **[📋 View menu]** |
| 2 | Tap **View menu**, pick **📅 Book an appointment** | Of course 👍 What is the appointment for? You can type or send a voice note 🎤 |
| 3 | `I need to see a heart doctor. Please book a cardiologist appointment` | Got it ✅ A **cardiologist** appointment. One moment, I'm checking your old prescriptions 🔍 |
| | | I found these cardiologists in your old prescriptions. Which one would you like to see? |
| | | Card: **1. Dr. Meera Kulkarni** (Heartcare Clinic, Vijay Nagar, last seen 14 Mar 2026, 3 visits, prescribed Amlodipine 5 mg) · **2. Dr. Anil Joshi** (City Heart Centre, Palasia, last seen Nov 2023, 1 visit) |
| | | **[1. Dr. Kulkarni] [2. Dr. Joshi] [Someone else]** |
| 4 | Tap **1. Dr. Kulkarni** | Great 👍 **Dr. Meera Kulkarni**, Heartcare Clinic, Vijay Nagar. Clinic hours: Mon to Sat, 10 am to 6 pm. |
| | | When would you like the appointment? · **[Earliest slot] [Another date]** |
| 5 | Tap **Earliest slot** | Understood. Would you prefer the morning or the evening? · **[Morning] [Evening] [Either]** |
| 6 | Tap **Morning** | The call outcome, described below |

### The call (after Morning)

The chat does **not** show the call live. The live call is on the voice screen (section 1). After **Morning**, the chat shows only the outcome (the call happens "now"):

1. A note: *Saath called Heartcare Clinic · {current time} (1 min 24 sec)*
2. A **Call transcript** card, already finished (**Call ended · 1:24**), with no ringing, no live timer and no recording player:

   | Time | Who | Line |
   | --- | --- | --- |
   | 0:04 | Saath (AI) | Hello, this is Saath, an AI assistant. I'm calling on behalf of Mr. Ramesh Sharma. Could I book an appointment with Dr. Kulkarni? He has visited your clinic before. |
   | 0:14 | Clinic | Yes, which day would you like? |
   | 0:19 | Saath (AI) | The earliest morning slot you have. |
   | 0:27 | Clinic | Tomorrow at 11:30 am is free. *(Monday at 11:30 am if tomorrow is a Sunday)* |
   | 0:36 | Saath (AI) | That works. 5 October, 11:30 am, under the name Ramesh Sharma. What are the fees, and should he bring any reports? |
   | 0:52 | Clinic | The fee is 800 rupees. Please bring his old reports. |
   | 1:06 | Saath (AI) | Thank you. I'll send him the confirmation. |
   | 1:15 | Clinic | Okay, thank you. |

3. Saath then sends:
   - Ramesh, your appointment is confirmed ✅
   - Card: **Appointment confirmed** · Dr. Meera Kulkarni, Cardiologist · Monday, 5 Oct · 11:30 am · Heartcare Clinic, Vijay Nagar · Fees ₹800 (payable at the clinic) · Please bring: old reports and your medicine list
   - What else can I do for you? 🔔 Remind you tomorrow at 9:30 am? 👨 Let Karan know? · **[Do both] [Just remind me] [No thanks]**

### After the confirmation

| Ramesh | Saath |
| --- | --- |
| Tap **Do both** | Done ✅ 🔔 I'll remind you tomorrow at 9:30 am and send the route to the clinic. 👨 I've messaged Karan: "Papa has an appointment with Dr. Kulkarni tomorrow at 11:30 am." |
| Tap **Just remind me** | Done ✅ 🔔 I'll remind you tomorrow at 9:30 am and send the route to the clinic. |
| Tap **No thanks** | No problem 🙏 I'm here whenever you need me. |
| `Thank you` | You're welcome, Ramesh 🙏 |

### Branch A: another date

At step 5 tap **Another date**:

| Ramesh | Saath |
| --- | --- |
| Tap **Another date** | Sure. Which day would you like? You can type something like "next Wednesday" or "15 October". |
| `Next Friday` | **Friday, 9 Oct.** (the next Friday after today) Morning or evening? · **[Morning] [Evening] [Either]** |
| Tap **Evening** | Understood. Tomorrow at 10 am I'll call the clinic and ask for an **evening slot on Friday, 9 Oct**. If that day is full, I'll ask you which day or time works instead. I won't book a different day on my own. |

This branch ends there. (Dates are matched on the words "fri" or "9"; anything else gets "Sorry, I couldn't tell which day you mean.")

### Branch B: someone else

At step 3's doctor buttons tap **Someone else**:

| Ramesh | Saath |
| --- | --- |
| Tap **Someone else** | Okay. Please tell me the doctor's name, or the area where you'd like to be seen. |
| `A good heart specialist near Vijay Nagar` | I've looked. I found these 3 options: |
| | Card: 🔍 **Cardiologists near Vijay Nagar (from the web, not from your records)** · 1. Dr. Neha Rao 4.7★ (180), Aadarsh Hospital, Vijay Nagar · 2. Dr. Sameer Bhatt 4.5★ (96), LifeLine Clinic, Scheme 54 · 3. Dr. Rohit Sinha 4.4★ (210), Medicare Centre, Bhawarkuan |
| | **[1] [2] [3] [Back to my doctors]** |
| Tap **1**, **2** or **3** | I can't book with that doctor right now. Would you like to go back to your doctors? |
| Tap **Back to my doctors** | The doctor card and buttons again. |

### Other replies

| You do | Saath says |
| --- | --- |
| Pick **2. Dr. Joshi** | I can't book with Dr. Joshi right now. Would you like to see Dr. Kulkarni instead? |
| Menu options 4, 5 or 6 | I can't help with that just yet. Right now I can book appointments for you 📅 (+ menu) |
| Menu option 2, **Doctor visit** | Starts the doctor's side: see the section below |
| Menu option 3, **Upload a prescription** | Send me a photo of the prescription using 📎 and I'll read it for you. (A photo then goes through the real prescription reader.) |
| Anything unrecognised at the reason step | I can help you book a cardiologist. Tell me, for example, "I need to see a heart doctor". |
| **Evening** or **Either** on the earliest-slot path | The earliest slot I can ask for is in the morning. Would you like a morning slot? |
| Type `Hi` at any point | Starts again from the greeting. |

---

### Voice notes and photos in the chat (Saath mode, and Patient mode)

- **Voice note:** tap the 🎙 button (shown when the message box is empty), speak, then tap the green send button. 🗑 or Esc cancels. Gnani STT transcribes it and the transcript appears under a playable voice-note bubble. Saath then answers as if you had typed it. It works anywhere a typed message works, so you can say the phrases in the flow tables above ("I need to see a heart doctor. Please book a cardiologist appointment", "Next Friday", "Thank you"). Buttons still need a tap.
- **Listen to a reply:** each Saath text bubble has a small 🔊. Tap it to hear that reply in a Gnani voice (the voice chosen on the call screen, default Kaveri). It is fetched on demand, so it costs one Gnani request per reply you play. Without a Gnani key it falls back to the browser's voice.
- **Photo:** 📎 opens the gallery, 📷 the camera. A preview opens with a caption box; send it and the photo goes to the prescription reader. Use a made-up prescription only. Reading it needs `GEMINI_API_KEY`; without it Saath replies that it couldn't read the photo.
- Voice notes need `CHAT_TEST_PASSWORD` and `GNANI_API_KEY`, and a microphone the browser can use (localhost or https).
- Spoken English only for now (`en-IN`). Voice notes can be up to about 55 seconds.

---

### Doctor visit: the doctor's side of the same chat (Saath mode)

At the clinic, Ramesh picks **🩺 Doctor visit** from the menu (or types "doctor visit"). Saath asks before sharing anything, then gives Dr. Kulkarni a history summary and she asks questions in the same thread, by typing, by voice note, or with the suggested-question buttons. Everything is read from Ramesh's record, which is **fictional mock data** in `lib/fixtures/ramesh.ts` (edit it freely).

| Step | You do | Saath does |
| --- | --- | --- |
| 1 | Menu → **🩺 Doctor visit** | "I'll prepare a summary of your history for Dr. Meera Kulkarni. Shall I share it with her for this visit?" **[Yes, share] [Not now]** |
| 2 | **Yes, share** | Shares, then sends the **history summary (about 190 to 200 words)**: who, last visit, recorded problems, medicines (including that amlodipine 5 mg from 14 Mar 2026 is not on today's prescription and no document records it stopping), the 9 advised tests with no results, no symptoms reported, no adherence records, and the coverage gaps. Then **[Current medicines] [Allergies] [Lab results] [Previous visits] [Reported symptoms] [Back to menu]** |
| 3 | Ask questions | Answers from the record, each with its source and date |
| 4 | **Back to menu** (or "hi") | Stops sharing and returns to the menu |

Questions it understands (any wording, or the buttons): medicines, allergies, lab results or a specific test (`has he had an HbA1c`, `any ECG`, `did he have an echo`), previous visits, problems, reported symptoms (`any dizziness`), who the caregiver is, why he is here. How it answers:

| Doctor asks | Saath says |
| --- | --- |
| `what is he on?` | The medicines with source and date, including the amlodipine discrepancy |
| `any allergies?` | None recorded in any connected source: "an absence of records, not confirmation that he has none" |
| `has he had an HbA1c` | Advised on the prescription, but no result in any connected source, with the date range it covers |
| `did he have an echo` | "No record of echo in any connected source, covering Nov 2023 to today. Nothing before Nov 2023 is in any connected source." |
| `is he taking the medicines` | "I can't tell you that." Evidence: none yet (no dispensing or reminder records) |
| `could this be anaemia` | "I can't read it for you." plus what the record holds and what is absent |
| `should I increase the amlodipine` | "That's yours to decide." plus the same adjacent facts |
| Anything else | "I don't have that in the record." and what it can answer |

The prescription medicines and tests come from `lib/fixtures/prescription.ts` (the 9 tests there are placeholders). Voice notes work here too, so the doctor can ask aloud.

---

## 3. Patient mode: prescription reader

Header button: **Patient**. Use a **made-up** prescription photo only.

1. Tap 📎 (or 📷), pick the photo, add an optional caption, send.
2. Saath replies with the medicines it could read. Anything unreadable is marked ⚠️ and explained; nothing is guessed.
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

## 5. Prescription → order → payment → delivery (Backend input)

Saath mode. The agent reads the real photo and decides what to say and which request to make. The outside world (pharmacy, Pine Labs, Delhivery) is **you**, pasting what each source would send into the **Backend input** panel on the right (🧾 in the header toggles it; open by default on wide screens, a slide-over on a phone). The agent only knows what you paste. **The prescription summary is scripted by default**: whatever photo you attach, Saath shows Ramesh's prescription from the plan, so no model or key is needed. Set `RX_READER=live` (and `GEMINI_API_KEY`) to have it read the actual photo instead.

> **Edit the 9 tests.** Your plan says the prescription advises 9 tests but doesn't name them. The nine in `lib/fixtures/prescription.ts` (CBC, Lipid profile, Fasting blood sugar, HbA1c, Serum creatinine, Serum electrolytes, Liver function test, ECG, Thyroid profile) are **placeholders**. Replace them with the exact tests from your prescription.

**Real vs simulated**

| Piece | Real or simulated | Source |
| --- | --- | --- |
| Reading the photo | **Scripted by default** (`RX_READER=live` reads the real photo with the model) | `lib/fixtures/prescription.ts` |
| Offer, and every decision after each event | **Real** agent logic | `lib/order.ts` |
| Pine Labs create-link request and the documented 201 response and `payment_link.processed` webhook | Simulated, documented shapes | the plan's Pine Labs section |
| Other Pine Labs events (failed, expired, opened) | Simulated, **illustrative shapes** | follow the processed example; names marked "illustrative" in the panel |
| Delhivery tracking | Simulated; **JSON shape unverified** | status names only (Pending → Delivered). Paste a real response from the Delhivery developer portal, or just type a status |
| Pharmacy | Simulated; **no documentation exists** | the order goes out as a message, and you paste the reply as received |
| `amount.value` unit | **Assumed paise** (₹528 = 52800) | confirm in Pine Labs' API reference |

**Run order**

| # | You do | The agent does |
| --- | --- | --- |
| 1 | Menu → 💊 Upload a prescription, or just attach any photo with 📎 | "Got it, reading your prescription 🔍", then the summary: **1. Telma CT 40 — 1-0-0 · 2. Ecosprin AV 75 — 1-0-0 · 3. Pan-D 40 — 1-0-0**, and **Tests advised (9)**. Then the offer: **[Yes, order them] [Not now]**. (With `RX_READER=live`, any line it can't read is flagged and left out of the order.) |
| 2 | Tap **Yes, order them** | "Placing your order with Sunrise Pharmacy…". Backend input shows the order sent to the pharmacy |
| 3 | In **Pharmacy → agent** paste the pharmacy's plain-text reply with the **UPI ID, the bill amount, the 4-day delivery time and a request for payment approval** (see below; the **Confirmed with bill, UPI, delivery (sample)** button fills one in) | Tells Ramesh the bill, delivery time and UPI ID, and **asks him to approve the payment**: **[Approve payment] [Cancel order]**. Nothing is paid or sent to Pine Labs yet |
| 4 | Tap **Approve payment** | "Approved ✅ I'm starting the payment…". Backend input shows the Pine Labs **Create payment link** request (documented endpoint and fields, masked token; the pharmacy's UPI ID is carried in the description) |
| 5 | In **Pine Labs → agent** click **Payment processed (documented webhook)** and Send. (You can skip the create-link response: the event is matched to the order by our payment reference. Or click **Create-link response** first to see the longer route) | Checks the event against the order (reference, amount). If it matches: "Pine Labs has approved your payment of ₹528 ✅", and a message to the pharmacy appears asking it to dispatch and share the Delhivery tracking ID |
| 6 | In **Pharmacy → agent** paste the pharmacy's reply with the tracking ID (the **Dispatched with tracking ID (sample)** button fills one in) | Gives Ramesh the **Delhivery tracking ID** and the delivery time, tells him he can follow it in the Delhivery app **or ask Saath to check**, and offers **[📦 Track my delivery]** |
| 7 | Tap **📦 Track my delivery** (or type "track my parcel" / "where is my order") | "Checking with Delhivery for tracking ID …". Backend input shows a **Track shipment** request carrying the tracking ID, and the **Delhivery → agent** field is highlighted **← response expected** with quick buttons (*In Transit*, *Out for Delivery*, *Delivered*, *Undelivered (problem)*) |
| 8 | In **Delhivery → agent** paste Delhivery's response (a tracking JSON, or a status such as `In Transit`) and Send | "Here's the latest from Delhivery 📦 …" with the stage, and **[📦 Track my delivery]** again. Repeat 7 and 8 for `Out for Delivery`, then `Delivered`, which ends the order (no more tracking button) |

Delhivery updates also work without tapping the button (paste one any time after the tracking ID and Ramesh gets "Your parcel is on its way…" etc.). The tracking request deliberately shows only the tracking ID: Delhivery's API details aren't in the docs provided, so no endpoint or fields are invented. An unreadable response is rejected with a ✗ and the request stays open. The highlight works for every source: it appears when the agent has asked something and clears when an accepted reply arrives.

Every box shows a ✓ or ✗ with how the agent read what you sent, so the audience can see why it acted or didn't.

**What to paste as the pharmacy's reply.** There is no pharmacy API, so the agent reads plain text (or simple JSON). For step 3, include these, in any wording:

```
Hello Mr. Sharma, your order is confirmed.
Bill amount: ₹528
Delivery in 4 days.
UPI ID: sunrise.pharmacy@okicici
Kindly approve the payment so we can dispatch.
```

| It looks for | Accepted forms | If missing |
| --- | --- | --- |
| **Bill amount** (one amount per reply) | `Total ₹528`, `Bill amount: 528`, `Payable: INR 1,528.50`, `Rs 528`, `grand total ₹528` (with several totals it takes the grand total / payable / last one). Never a count: `4 days` or `3 items` are not read as the bill | No usable amount: the agent waits and asks for one (no approval request) |
| **UPI ID** | `name@okicici`, `9876543210@ybl`. An email address (`orders@site.com`) is not taken as a UPI ID | Still asks for approval, just without a UPI ID |
| **Delivery time** | `4 days`, `2-3 days`, `48 hours`, `1 day` (the one near the word "deliver" wins, not `30 days supply`) | Omitted from the message |
| **Out of stock** | `out of stock`, `not available`, `unavailable`, `shortage`, `can't supply` | Tells Ramesh, offers to cancel, **does not substitute** (even if a bill is mentioned) |
| *(anything else)* | `ok bhaiya`, `Total ₹0`, a bill of ₹1,00,000 or more | Nothing happens; the panel shows ✗ with why |

For step 6, include `Tracking ID: 3714910042305` (also `AWB …`, `Waybill …`, `Consignment no …`; the ID needs digits and 8 to 20 characters). A reply without one, like `Packing your order now`, is passed to Ramesh as "Update from Sunrise Pharmacy" and the agent keeps waiting. Amounts are treated as rupees.

**Failure injections (the agent must handle each on its own)**

| Inject | Paste | Expected |
| --- | --- | --- |
| Item out of stock | Pharmacy: `Pan-D 40 is out of stock this week` | Tells Ramesh, offers to cancel, **does not substitute** |
| Pharmacy confirms with no bill amount | Pharmacy: `Order confirmed` | Waits for an amount; no approval request |
| Ramesh declines | Tap **Cancel order** at the approval step | Cancels; nothing is paid |
| Ramesh stays silent | (nothing) | Agent keeps asking; never pays without his OK |
| Pine Labs error | Pine Labs: `{"error":"UNAUTHORIZED"}` | "I couldn't create the payment link", offers **Try again** (new reference) |
| Link for the wrong amount | Create-link response with a different `amount.value` | Not forwarded to Ramesh |
| "I paid" with no webhook | Ramesh types `I paid` | Refuses to count it; only the gateway's event counts |
| Event for another order | Webhook with a different `payment_link_id` | Ignored (✗ "Doesn't match this order") |
| Event with the wrong amount | Processed webhook with a different `amount.value` | **Not** treated as paid |
| Payment failed | Click **Payment failed (illustrative)** | Says so, offers **Send a new link** |
| Link expired | Click **Link expired (illustrative)** | Says so, offers a new link, places nothing |
| Wrong source for the moment | Delhivery update before the pharmacy has sent a tracking ID | ✗ "Not expected right now" |
| Delivery problem | Delhivery: `RTO Initiated`, `Undelivered`, `Lost`, `Cancelled` | Flags the problem, takes **no action**, won't reorder without Ramesh |
| Replayed event | Send the processed webhook twice | The second is ignored |

**Operator rules** (from the plan): paste only what the source's documentation, or a real recorded response, would send; never tell the agent what to do next; don't hint through timing; keep a note of where each pasted message came from.

---

## Where things live

| What | File |
| --- | --- |
| Voice call script | `lib/callscript.ts` |
| Voice call page / Gnani proxy | `public/voice.html`, `api/voice.ts` |
| Recording and WAV helpers (shared) | `public/audio.js` |
| Saath chat flow (all replies above) | `lib/saath.ts` |
| Chat UI (transcript card, buttons, list) | `public/index.html` |
| Clinician prompt and record | `prompts/clinic.md`, `lib/fixtures/clinic.ts` |
| Scripted prescription (edit the tests here) | `lib/fixtures/prescription.ts` |
| Doctor visit (summary and questions) | `lib/doctor.ts` (logic), `lib/fixtures/ramesh.ts` (the record), `lib/saath.ts` (menu option 2) |
| Prescription → order workflow | `lib/order.ts` (logic), `api/chat.ts` (photo + events), Backend input panel in `public/index.html` |
| Date and clock logic | `lib/clock.ts` |
