// Insurance help (Feature 7): upload the policy, ask "is my heart surgery covered?", get a verdict
// with reasons, an example of what Ramesh would pay, hospitals in Indore, a claim checklist, and
// answers to common questions. FIXED, deterministic text from the Feature 7 mock and the dummy
// policy (Suraksha Senior Secure, fictional insurer): the uploaded PDF is validated by the server
// as a PDF but its contents are not analysed. Nothing here is medical, legal or financial advice,
// and it never promises approval: "should be covered", "the insurer decides".
import type { DemoState, DemoResult, Msg } from "./saath.js";

const t = (text: string): Msg => ({ kind: "text", text });
const card = (text: string): Msg => ({ kind: "card", text });
const btn = (...o: [string, string][]): Msg => ({ kind: "buttons", options: o.map(([id, label]) => ({ id, label })) });

export const INS_WAIT_PROMPT = "Of course. Please send me your health insurance policy (a PDF or photos of the pages). I'll read it and keep it with your records. 📎";

const POLICY_CARD = [
  "🛡 *Your policy: Suraksha Senior Secure*",
  "*Policy no.:* SHI-SS-2022-0481726\n*Cover:* ₹5,00,000 + ₹1,50,000 bonus = *₹6,50,000*\n*Running since:* 1 Dec 2022 (no break)\n*Room limit:* ₹5,000/day · *ICU limit:* ₹10,000/day\n*You pay:* 10% of every claim\n*Waiting periods:* all completed",
].join("\n\n");

const ASK_PROC = btn(["ins_cabg", "Bypass surgery (CABG)"], ["ins_valve", "Valve repair or replacement"], ["ins_unsure", "Not sure"]);
const AFTER_ANSWER = btn(["ins_example", "Yes, show me"], ["ins_hosp_first", "Hospitals first"]);
const QUOTE = btn(["ins_quote_yes", "Yes, ask them"], ["ins_quote_no", "I'll ask myself"]);
const PACK = btn(["ins_pack", "Prepare my document pack"], ["ins_later", "Later"]);

// Policy uploaded (PDF, or photos of the pages).
export function insuranceUpload(): DemoResult {
  return {
    state: { step: "ins_ready" },
    messages: [
      t("Got it ✅ Here is a short summary of your policy:"),
      card(POLICY_CARD),
      t("You can ask me anything about it. Or tell me what your doctor has recommended and I'll check whether it should be covered."),
      btn(["ins_ask", "Is my heart surgery covered?"]),
    ],
  };
}

const PROC_LABEL = { cabg: ["bypass surgery", "Bypass (CABG)"], valve: ["valve surgery", "Valve repair or replacement"] } as const;

function verdict(proc: "cabg" | "valve"): Msg[] {
  const [short, listed] = PROC_LABEL[proc];
  return [
    t(`*Short answer: your policy should cover ${short}, but you would still pay part of the bill.* The insurer makes the final decision after it reviews the claim.`),
    card([
      "✅ *Why it should be covered*",
      `1. *Cardiac surgery is listed as covered.* ${listed} has no separate cap.\n2. *Your waiting periods are over.* Your policy started on 1 Dec 2022, so it has run almost 4 years. Cardiac conditions are not on the 24-month list.\n3. *Blood pressure is not a problem.* You declared it in 2022, and its 36-month waiting period ended on 30 Nov 2025. Even if the insurer links heart disease to blood pressure, it is past the waiting period.\n4. *Diabetes was found after you bought the policy.* Your records show it was first flagged in March 2026, so it is not a pre-existing condition.\n5. *You have no claims this year.* The full ₹6,50,000 is available.`,
    ].join("\n\n")),
    card([
      "⚠️ *What will reduce what the insurer pays*",
      "1. *Room rent limit.* ₹5,000/day for a room and ₹10,000/day for ICU. If you take a costlier room, the insurer also cuts the surgeon, OT and nursing charges in the same proportion.\n2. *10% co-payment* on whatever the insurer accepts.\n3. *Non-payable items.* Consumables, admission kits and similar charges are not covered.",
    ].join("\n\n")),
    card([
      "❓ *What could cause questions from the insurer*",
      "1. *What you declared in 2022.* You answered \"No\" to diabetes and to high cholesterol. Your records start in March 2025, so I cannot see anything earlier. If the insurer finds an older diagnosis, it could dispute the claim.\n2. *Paperwork.* The insurer will want the doctor's written recommendation and reports (such as the angiography) with the pre-authorisation request.\n3. *Your new liver results.* They are not a coverage issue by themselves, but the hospital may order extra tests before surgery. Tests done only for diagnosis, without treatment, are not covered.",
    ].join("\n\n")),
    t("Would you like to see how much you might pay yourself?"),
    AFTER_ANSWER,
  ];
}

const EXAMPLE = [
  "🧾 *Example: what you might pay, by room choice*",
  "_An illustration, not a quote. It assumes an 8-day stay (3 in ICU, 5 in a room) and a surgery package of ₹2,40,000 for surgeon, OT and related fees._",
  "*A. Costlier private room* (room ₹8,000, ICU ₹14,000)\nTotal bill: ₹3,82,000\nReduced for room limit: −₹1,17,000\nConsumables not payable: −₹15,000\nInsurer accepts: ₹2,50,000\nYou pay 10% co-pay: ₹25,000\n*Insurer pays: ₹2,25,000*\n*You pay in total: ₹1,57,000*",
  "*B. Room within your limit* (room ₹5,000, ICU ₹10,000)\nTotal bill: ₹3,55,000\nReduced for room limit: none\nConsumables not payable: −₹15,000\nInsurer accepts: ₹3,40,000\nYou pay 10% co-pay: ₹34,000\n*Insurer pays: ₹3,06,000*\n*You pay in total: ₹49,000*",
  "*Choosing a room within your limit could save about ₹1,08,000.*",
].join("\n\n");

const HOSPITALS = [
  "🏥 *Heart surgery hospitals in Indore*",
  "*CARE CHL Hospitals* · AB Road, near LIG Square\nLists CABG, minimally invasive CABG, valve repair and replacement. Says it is empanelled with insurers and TPAs.",
  "*Apollo Hospitals, Indore*\n180 beds. Has a cath lab and a cardiothoracic operating room. Offers CABG.",
  "*Medanta Indore*\nLists bypass, valve and heart procedures.",
  "*Nakshatra Heart and Multispeciality Hospital*\nKnown for cardiac care. I could not confirm that it does bypass surgery.",
  "_Cashless status with your insurer: your policy's network list (Annexure 2, a dummy list) shows all four as cashless for cardiac surgery. Please confirm with the insurer before booking, and with Nakshatra that it does bypass surgery._\n_No hospital publishes a fixed price online. The ₹2.5 to 3.8 lakh range is a city-wide estimate, not a quote._",
].join("\n\n");

const CHECKLIST = [
  "📋 *Claim checklist*",
  "✅ *Doctor's written recommendation* for surgery (diagnosis and procedure named)\n✅ *Angiography and other reports* (I have your blood tests and ECG)\n✅ *Hospital sends pre-authorisation* to the insurer *at least 3 days before admission*\n✅ *Choose a room within ₹5,000/day* (ICU is covered up to ₹10,000/day)\n✅ *After discharge:* itemised bill, discharge summary and receipts within *15 days* if you claim by reimbursement\n⏳ *Pre and post-hospital costs:* keep bills for 30 days before and 60 days after",
].join("\n\n");

const PACK_TEXT = [
  "📦 *Your document pack*",
  "✅ Policy: Suraksha Senior Secure (on file)\n✅ Blood tests and ECG reports (on file)\n⏳ Doctor's written recommendation, naming the diagnosis and procedure: *not yet*\n⏳ Angiography or other diagnostic reports: *not yet*\n⏳ Past records for heart, blood pressure and diabetes: *only from March 2025*",
  "Send me the missing ones with 📎 as you get them, and I'll add them. I won't share anything with a hospital or the insurer without your permission.",
].join("\n\n");

function hospitals(seen: string[]): Msg[] {
  return [
    t("Your cover is ₹6,50,000. Published estimates for bypass surgery in Indore run roughly *₹2.5 lakh to ₹3.8 lakh* in total. That is well inside your cover, so the real question is how much you pay yourself, and that depends on the room.\n\nHospitals in Indore that offer heart surgery:"),
    card(HOSPITALS),
    t("Shall I ask these hospitals for a *package quote* for bypass surgery, by room type (twin-sharing, single AC, and so on)? Then you can compare what you would pay yourself."),
    seen.includes("example") ? QUOTE : btn(["ins_example", "Show what I might pay"], ["ins_quote_yes", "Yes, ask them"], ["ins_quote_no", "I'll ask myself"]),
  ];
}

// ---- questions and answers (from the mock; "your policy doesn't say" when the document is silent) ----
const QA: [RegExp, string][] = [
  [/\b(second opinion)\b/i, "Your policy doesn't say. Ask the insurer."],
  [/\b(minimally invasive|robotic|keyhole|laparoscopic|technique)\b/i, "Your policy doesn't say anything about technique. Ask the insurer whether extra charges for it are payable."],
  [/\b(stent|angioplasty)\b/i, "It is covered, but stent cost is capped at ₹60,000 per procedure."],
  [/\b(do i (really )?need|need (this|the) surgery|is (the )?surgery necessary|really necessary)\b/i, "Ask your doctor. I don't judge medical need."],
  [/\b(best hospital|which hospital is (the )?best|better hospital|rank)\b/i, "I can show facts and your likely cost, but I can't rank quality."],
  [/\b(will|would) (my |the )?claim (be )?(approved|accepted|rejected|pass)|(is|get) (my )?claim (approved|accepted)\b/i, "Nobody can promise that. I can only say whether the policy terms appear to cover it. The insurer decides."],
  [/\b(non.?disclos|answered no|declared|rejected? .*(diabet|cholesterol)|(diabet|cholesterol).*(reject|dispute))\b/i, "Only if it can show you were diagnosed before 1 Dec 2022. I can see your records only from March 2025."],
  [/\b(liver)\b/i, "Not by themselves. A liver problem found after the policy began is not pre-existing. But extra tests done only for diagnosis, with no treatment, are excluded."],
  [/\b(waiting period|any waiting|waiting)\b/i, "No. The 30-day, 36-month and 24-month waiting periods are all complete."],
  [/\b(diabet\w*|high bp|blood pressure|\bbp\b|hypertension|pre.?existing)\b/i, "Blood pressure was declared in 2022 and its 36-month waiting period ended on 30 Nov 2025. Diabetes was first flagged after the policy began, so it is not treated as pre-existing."],
  [/\b(higher room|costlier room|expensive room|upgrade|more expensive room|room costs more)\b/i, "The insurer reduces room-linked charges (surgeon, anaesthetist, OT, nursing, procedure) in the same proportion. For an ₹8,000 room against a ₹5,000 limit, those charges are paid at 62.5%."],
  [/\b(which room|what room|room should|choose a room|room to choose)\b/i, "One whose daily rate is within ₹5,000 (and ICU within ₹10,000). Ask the hospital for its tariff by room category and compare."],
  [/\b(room rent|room limit|icu limit|room)\b/i, "₹5,000 per day (1% of ₹5,00,000) for a single private AC room, and ₹10,000 per day for ICU."],
  [/\b(co.?pay\w*|copay)\b/i, "10% of every accepted claim."],
  [/\b(how much (will|would) i (have to )?pay|my share|out of pocket|pay myself)\b/i, "In the example, about ₹49,000 with a room within the limit and about ₹1,57,000 with a costlier room. Real figures depend on the hospital quote."],
  [/\b(bonus|cumulative)\b/i, "Yes. The ₹1,50,000 bonus is added to the ₹5,00,000 base, so ₹6,50,000 is available."],
  [/\b(before and after|pre.?hospital\w*|post.?hospital\w*|medicines? and tests|after surgery)\b/i, "Yes, tests and medicines related to the surgery are covered for 30 days before admission and 60 days after discharge."],
  [/\b(how early|pre.?auth\w*|approval|in advance|emergency)\b/i, "At least 3 days before a planned admission. For an emergency, tell the insurer within 24 hours."],
  [/\b(refus\w*|cashless (is )?(denied|rejected)|reimburse\w*)\b/i, "You can still be admitted and pay, then claim by reimbursement within 15 days of discharge. I can help prepare the documents and, if the claim is rejected, the appeal letter."],
  [/\b(which documents|what documents|documents (do i|will i)? ?need|papers)\b/i, "Doctor's recommendation, angiography and other reports, past records for heart, blood pressure and diabetes, claim form, discharge summary, itemised bill, receipts and ID."],
  [/\b(bypass|cabg|cardiac surgery|heart surgery|open.?heart|valve)\b.*\b(cover\w*)\b|\b(cover\w*)\b.*\b(bypass|cabg|cardiac surgery|heart surgery|valve)\b/i, "Yes, as a covered cardiac surgery with no sub-limit. The insurer decides on the claim after reviewing the documents."],
];

export function insuranceAnswer(text: string): string | null {
  for (const [re, a] of QA) if (re.test(text)) return a;
  return null;
}

function stepButtons(step: string, seen: string[]): Msg | null {
  switch (step) {
    case "ins_ready": return btn(["ins_ask", "Is my heart surgery covered?"]);
    case "ins_proc": return ASK_PROC;
    case "ins_answer": return AFTER_ANSWER;
    case "ins_example": return btn(["ins_hosp", "Hospitals in Indore"]);
    case "ins_hosp": return seen.includes("example") ? QUOTE : btn(["ins_example", "Show what I might pay"], ["ins_quote_yes", "Yes, ask them"], ["ins_quote_no", "I'll ask myself"]);
    case "ins_pack": return PACK;
    default: return null;
  }
}

const SURGERY_Q = /\b(sternotomy|my doctor (has )?recommended|doctor (has )?(advised|suggested|recommended)|based on my (medical )?history|check my insurance)\b/i;

export function insuranceStep(state: DemoState, input: { id?: string; text?: string }): DemoResult | null {
  const id = input.id ?? "", text = (input.text ?? "").trim();
  const step = state.step, seen = state.seen ?? [];
  if (!step.startsWith("ins_")) return null;
  const keep = (s: Partial<DemoState> = {}): DemoState => ({ ...state, ...s });
  const sayHospitals = () => ({ state: keep({ step: "ins_hosp" }), messages: hospitals(seen) });
  const sayExample = (): DemoResult => ({
    state: keep({ step: "ins_example", seen: [...new Set([...seen, "example"])] }),
    messages: [card(EXAMPLE), t("Both cases are well inside your ₹6,50,000 cover. The difference is the room you choose."), btn(["ins_hosp", "Hospitals in Indore"])],
  });
  const sayChecklist = (lead: string): DemoResult => ({ state: keep({ step: "ins_pack" }), messages: [t(lead), t("Once you choose a hospital, here is what to do. I can help with each step:"), card(CHECKLIST), PACK] });

  if (step === "ins_wait") return { state, messages: [t("Please send me your policy as a PDF (or photos of its pages) using 📎 🛡")] };

  // The surgery question starts the check; buttons and typed text move it along.
  if (id === "ins_ask" || SURGERY_Q.test(text)) {
    return { state: keep({ step: "ins_proc" }), messages: [t("I'll check. First, which operation did the doctor name? Coverage depends on the diagnosis and the procedure."), ASK_PROC] };
  }
  if (step === "ins_proc") {
    const cabg = id === "ins_cabg" || (!id && /\b(bypass|cabg)\b/i.test(text));
    const valve = id === "ins_valve" || (!id && /\bvalve\b/i.test(text));
    if (cabg || valve) {
      return {
        state: keep({ step: "ins_answer", proc: cabg ? "cabg" : "valve" }),
        messages: [t("Thank you. I'll check your policy against your records: your blood pressure history, your diabetes, your cholesterol and your liver tests."), ...verdict(cabg ? "cabg" : "valve")],
      };
    }
    if (id === "ins_unsure" || /\b(not sure|don'?t know|no idea)\b/i.test(text)) {
      return {
        state: keep(),
        messages: [t("That's okay. Please ask your doctor which operation was named, and tell me when you know. In the meantime, your policy lists bypass and valve surgery as covered with no sub-limit, and stents (angioplasty) as covered up to ₹60,000."), btn(["ins_cabg", "Bypass surgery (CABG)"], ["ins_valve", "Valve repair or replacement"])],
      };
    }
  }
  const qa = !id ? insuranceAnswer(text) : null;
  if (qa) {
    const b = stepButtons(step, seen);
    return { state, messages: [t(qa), ...(b ? [b] : [])] };
  }
  if (id === "ins_example" || (!id && /\b(how much|show me|yes|pay myself|my share|what i might pay)\b/i.test(text) && (step === "ins_answer" || step === "ins_hosp"))) return sayExample();
  if (id === "ins_hosp_first" || id === "ins_hosp" || (!id && /\b(hospitals?|which hospital)\b/i.test(text))) return sayHospitals();
  if (id === "ins_quote_yes" || id === "ins_quote_no") {
    return sayChecklist(id === "ins_quote_yes"
      ? "Okay. I'll message the insurance desk at each hospital, tell them I'm an AI assistant acting for you, and share your quotes here as they arrive. I will not share your reports without your permission."
      : "Okay, that works too. Ask each hospital's insurance desk for a package quote by room type, and bring the quotes to me to compare.");
  }
  if (id === "ins_pack") return { state: keep({ step: "ins_pack" }), messages: [card(PACK_TEXT), btn(["ins_later", "Done for now"])] };
  if (id === "ins_later" || (!id && step === "ins_pack" && /^\s*(later|no|not now|done)\b/i.test(text))) {
    return { state: { step: "end" }, messages: [t("Okay 🙏 I'll keep your policy with your records. Is there anything else I can help you with?")] };
  }

  const b = stepButtons(step, seen);
  return { state, messages: [t("I can answer questions about your policy: cover, waiting periods, room limits, co-payment, claims and documents. Or tell me what your doctor recommended."), ...(b ? [b] : [])] };
}
