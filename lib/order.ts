// Prescription -> order -> payment -> delivery workflow for Saath.
//
// The agent decides what to say and which request to make next. The outside world (pharmacy,
// Pine Labs, Delhivery) is played by a person who pastes what each source would send into the
// "Backend input" panel. The agent only knows what it is sent: it verifies payment events against
// the order, never treats "I paid" as payment, and never substitutes or invents anything.
//
// Sources for the simulated shapes (from the simulation plan):
//  - Pine Labs: POST /api/pay/v1/paymentlink request fields and the documented 201 response and
//    payment_link.processed webhook. Other event shapes are illustrative, and the unit of
//    amount.value is assumed to be paise: both are flagged in the desk.
//  - Delhivery: only the status names (Pending ... Delivered) are known; the JSON shape is not,
//    so parsing is tolerant and accepts pasted JSON or plain text.
//  - Pharmacy: no documentation exists, so no API is invented: the order goes out as a message and
//    the reply is read as free text or JSON.
import { randomUUID } from "node:crypto";
import type { Clock } from "./clock.js";
import type { DemoState, DemoResult, Msg } from "./saath.js";
import type { PrescriptionExtraction } from "./schema.js";

export interface RxMed { name: string; strength: string | null; dose: string | null; duration: string | null }
export interface RxData { meds: RxMed[]; tests: string[]; unclear: number; doctor: string | null }
export interface OrderData {
  ref: string;               // our order reference
  attempt: number;           // payment link attempts so far
  total?: number;            // rupees, from the pharmacy's reply
  amountValue?: number;      // what we asked Pine Labs to charge (smallest unit)
  linkRef?: string;
  linkId?: string;
  payOrderId?: string;
  link?: string;
  upi?: string;              // pharmacy's UPI id, from its reply
  eta?: string;              // delivery time the pharmacy quoted, e.g. "4 days"
  awb?: string;              // Delhivery tracking id, from the pharmacy's reply
  tracking?: boolean;        // a tracking request is out and Delhivery's response is awaited
  stage?: string;            // last delivery stage
  where?: string;            // last delivery location, if the update had one
}
export interface ApiCall {
  system: "pharmacy" | "pinelabs" | "delhivery";
  label: string;
  method?: string; url?: string; headers?: Record<string, string>; body?: unknown;
  text?: string;             // for a message-based source (the pharmacy)
  note?: string;
}
export interface ExampleSet { system: string; items: { label: string; json: unknown }[] }
export interface DeskUpdate {
  requests?: ApiCall[];
  ack?: { system: string; ok: boolean; note: string };
  examples?: ExampleSet[];
}
export interface OrderEvent { system: string; raw: string }

const PHARMACY = "Sunrise Pharmacy, Vijay Nagar";
const PL_URL = "https://pluraluat.v2.pinepg.in/api/pay/v1/paymentlink";

const t = (text: string): Msg => ({ kind: "text", text });
const btn = (...o: [string, string][]): Msg => ({ kind: "buttons", options: o.map(([id, label]) => ({ id, label })) });
const money = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;
const clip = (s: string, n = 200) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export const OFFER = btn(["order_yes", "Yes, order them"], ["order_no", "Not now"]);
const CANCEL = btn(["order_cancel", "Cancel order"]);
const TRACK = btn(["track_delivery", "📦 Track my delivery"]);
const APPROVE = btn(["pay_approve", "Approve payment"], ["order_cancel", "Cancel order"]);
const NEW_LINK = btn(["new_link", "Send a new link"]);
const RETRY_LINK = btn(["retry_link", "Try again"]);

function parseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return undefined; }
}
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

// ---- prescription summary + offer ---------------------------------------------------------------
export function rxFromExtraction(state: DemoState | null, ex: PrescriptionExtraction | null): DemoResult {
  const keep = state ? { ...state } : { step: "menu" as const };
  if (!ex) return { state: keep, messages: [t("Sorry, I couldn't read that photo. Could you send a clearer one?")] };
  if (!ex.is_prescription) {
    return { state: keep, messages: [t("That doesn't look like a prescription. Please send a clear, well-lit photo of the whole page.")] };
  }
  const clear = ex.lines.filter((l) => l.confidence === "CLEAR");
  const unclear = ex.lines.filter((l) => l.confidence !== "CLEAR");
  const meds: RxMed[] = clear.map((l) => ({
    name: [l.drug_name, l.strength].filter(Boolean).join(" ") || "Unnamed medicine",
    strength: l.strength, dose: l.dose_instruction, duration: l.duration,
  }));
  const tests = (ex.tests ?? []).slice();

  const parts: string[] = [`Here's what I can read on your prescription 🧾${ex.doctor_or_clinic ? ` (${ex.doctor_or_clinic})` : ""}`];
  if (meds.length) {
    parts.push("💊 *Medicines*\n" + meds.map((m, i) => `${i + 1}. ${m.name}${m.dose ? ` — ${m.dose}` : ""}${m.duration ? `, ${m.duration}` : ""}`).join("\n"));
  }
  if (tests.length) {
    const shown = tests.slice(0, 12).map((x) => `• ${x}`).join("\n");
    parts.push(`🧪 *Tests advised (${tests.length})*\n${shown}${tests.length > 12 ? `\n+ ${tests.length - 12} more` : ""}`);
  }
  if (unclear.length) {
    parts.push(`⚠️ I couldn't read ${unclear.length} line${unclear.length > 1 ? "s" : ""} clearly:\n` +
      unclear.map((l) => `• ${[l.drug_name ?? "?", l.strength ?? "strength ?"].join(" ")}: ${l.unclear_reason ?? "unreadable"}`).join("\n") +
      "\nI won't order those until your doctor or pharmacist confirms them.");
  }
  if (ex.overall_note) parts.push(`Note: ${ex.overall_note}`);

  const rx: RxData = { meds, tests, unclear: unclear.length, doctor: ex.doctor_or_clinic };
  if (!meds.length) {
    return { state: { step: "menu", rx }, messages: [t(parts.join("\n\n")), t("There's nothing here I can order yet. Please send a clearer photo, or check with your doctor.")] };
  }
  return {
    state: { step: "rx_offer", rx },
    messages: [t("Got it, reading your prescription 🔍"), t(parts.join("\n\n")), t(`Would you like me to order ${meds.length > 1 ? "these medicines" : "this medicine"} for you? 💊`), OFFER],
  };
}

// ---- requests the agent makes ---------------------------------------------------------------------
function pharmacyRequest(rx: RxData, ref: string): ApiCall {
  const lines = rx.meds.map((m, i) => `${i + 1}. ${m.name}${m.dose ? ` — ${m.dose}` : ""}${m.duration ? `, ${m.duration}` : ""}`);
  return {
    system: "pharmacy",
    label: `Order request to ${PHARMACY}`,
    text: `Order ${ref}\nCustomer: Ramesh Sharma\n${lines.join("\n")}\nPlease confirm availability and the total.`,
    note: "No pharmacy API is documented, so this goes out as a message and the reply is pasted in as received.",
  };
}

function payLinkRequest(o: OrderData, c: Clock, now: number): { call: ApiCall; linkRef: string; amountValue: number } {
  const linkRef = o.attempt === 0 ? o.ref : `${o.ref}-${o.attempt + 1}`;
  const amountValue = Math.round((o.total ?? 0) * 100);
  return {
    linkRef, amountValue,
    call: {
      system: "pinelabs",
      label: "Create payment link",
      method: "POST", url: PL_URL,
      headers: { Authorization: "Bearer ••••••••", "Content-Type": "application/json", "Request-ID": randomUUID(), "Request-Timestamp": new Date(now).toISOString() },
      body: {
        amount: { value: amountValue, currency: "INR" },
        description: `${PHARMACY} order ${o.ref}${o.upi ? ` (pay to UPI ${o.upi})` : ""}`,
        expire_by: new Date(now + 24 * 3600 * 1000).toISOString(),
        merchant_payment_link_reference: linkRef,
      },
      note: `Assumes amount.value is in paise (${money(o.total ?? 0)} = ${amountValue}); confirm in Pine Labs' API reference. The docs given have no payee field, so the pharmacy's UPI id is carried in the description only. Reply with the documented 201 response, or skip it and send the payment event.`,
    },
  };
}

function createResponseExample(o: OrderData, linkRef: string, amountValue: number, now: number) {
  return {
    payment_link: "https://shortener.v2.pinepg.in/PLUTUS/3rh4jtd",
    payment_link_id: "pl-v1-250306082755-aa-uT0noy",
    status: "CREATED",
    amount: { value: amountValue, currency: "INR" },
    order_id: "v1-250131113650-aa-TUzeRY",
    merchant_payment_link_reference: linkRef,
    created_at: new Date(now).toISOString(),
  };
}

function webhookExamples(o: OrderData): ExampleSet {
  const amount = { value: o.amountValue, currency: "INR" };
  return {
    system: "pinelabs",
    items: [
      { label: "Payment processed (documented webhook)", json: { event: "payment_link.processed", data: { payment_link_id: o.linkId, merchant_payment_link_reference: o.linkRef, status: "PROCESSED", amount, order_id: o.payOrderId } } },
      { label: "Payment failed (illustrative)", json: { event_type: "PAYMENT_FAILED", data: { order_id: o.payOrderId, merchant_order_reference: o.linkRef, status: "FAILED", order_amount: amount } } },
      { label: "Link expired (illustrative)", json: { event: "payment_link.expired", data: { payment_link_id: o.linkId, merchant_payment_link_reference: o.linkRef, status: "EXPIRED", amount } } },
      { label: "Link opened (illustrative)", json: { event: "payment_link.clicked", data: { payment_link_id: o.linkId, merchant_payment_link_reference: o.linkRef, status: "CLICKED", amount } } },
    ],
  };
}

function trackRequest(o: OrderData): ApiCall {
  return {
    system: "delhivery",
    label: "Track shipment",
    text: `Tracking ID (waybill): ${o.awb}`,
    note: "Delhivery's tracking API details aren't in the docs provided, so no endpoint or fields are invented here. Paste the real tracking response from the Delhivery developer portal (or a real shipment's history), or just a status such as In Transit.",
  };
}
const delhiveryExamples = (): ExampleSet => ({
  system: "delhivery",
  items: [
    { label: "In Transit", json: "In Transit" },
    { label: "Out for Delivery", json: "Out for Delivery" },
    { label: "Delivered", json: "Delivered" },
    { label: "Undelivered (problem)", json: "Undelivered" },
  ],
});

function askPharmacy(rx: RxData, o: OrderData): DemoResult {
  return {
    state: { step: "po_wait", rx, order: o },
    messages: [t(`Placing your order with ${PHARMACY}… 💊\nI'll message you as soon as they confirm.`)],
    desk: {
      requests: [pharmacyRequest(rx, o.ref)],
      examples: [{ system: "pharmacy", items: [
        { label: "Confirmed with bill, UPI, delivery (sample)", json: `Hello Mr. Sharma, your order ${o.ref} is confirmed.\nBill amount: ₹528\nDelivery: 4 days\nPlease pay to UPI ID sunrise.pharmacy@okicici and approve the payment so we can dispatch.` },
        { label: "Out of stock (sample)", json: "Sorry, Pan-D 40 is out of stock this week." },
      ] }],
    },
  };
}

function makeLink(rx: RxData, o0: OrderData, c: Clock, now: number, lead: Msg[]): DemoResult {
  const { call, linkRef, amountValue } = payLinkRequest(o0, c, now);
  const o: OrderData = { ...o0, linkRef, amountValue, linkId: undefined, payOrderId: undefined, link: undefined };
  const early = webhookExamples({ ...o, linkId: "pl-v1-250306082755-aa-uT0noy", payOrderId: "v1-250131113650-aa-TUzeRY" });
  return {
    state: { step: "link_wait", rx, order: o },
    messages: lead,
    desk: { requests: [call], examples: [{ system: "pinelabs", items: [{ label: "Create-link response (documented 201)", json: createResponseExample(o, linkRef, amountValue, now) }, ...early.items] }] },
  };
}

// ---- buttons / typed text inside the workflow ------------------------------------------------------
export function orderText(state: DemoState, input: { id?: string; text?: string }, c: Clock, now: number): DemoResult | null {
  const text = (input.text ?? "").trim();
  const id = input.id ?? "";
  const rx = state.rx, o = state.order;
  const yes = id === "order_yes" || (!id && /^\s*(yes|yeah|yep|ok(ay)?|sure|haan|order( them| it)?)\b/i.test(text));
  const no = id === "order_no" || (!id && /^\s*(no|not now|nahi|later)\b/i.test(text));

  switch (state.step) {
    case "rx_wait":
      return { state, messages: [t("Send me a photo of the prescription using 📎 and I'll read it for you.")] };

    case "rx_offer":
      if (rx && yes) return askPharmacy(rx, { ref: `SAATH-${now.toString(36).toUpperCase().slice(-6)}`, attempt: 0 });
      if (no) return { state: { step: "end" }, messages: [t("No problem 🙏 Your prescription is saved. Just say the word when you'd like me to order."), ] };
      return { state, messages: [t("Would you like me to order these medicines for you?"), OFFER] };

    case "po_wait":
      return { state, messages: [t(`I'm still waiting for ${PHARMACY} to confirm your order 💊 I'll message you as soon as they do.`)] };

    case "pay_approve": {
      const approve = id === "pay_approve" || (!id && /^\s*(yes|yeah|yep|approve(d)?|ok(ay)?|go ahead|pay|sure|haan|confirm)\b/i.test(text));
      const cancel = id === "order_cancel" || (!id && /\b(cancel|no|don'?t|stop)\b/i.test(text));
      if (rx && o && approve) {
        return makeLink(rx, o, c, now, [t(`Thank you, Ramesh. Approved ✅ I'm starting the payment of ${money(o.total ?? 0)}${o.upi ? ` to ${o.upi}` : ""} through Pine Labs 🔐`)]);
      }
      if (cancel) return { state: { step: "end" }, messages: [t("Okay, I've cancelled the order. Nothing was paid 🙏 Is there anything else I can help you with?")] };
      return { state, messages: [t(`Shall I approve the payment of ${money(o?.total ?? 0)} to ${PHARMACY}? I won't pay anything without your OK.`), APPROVE] };
    }

    case "dispatch_wait":
      if (/\b(paid|payment)\b/i.test(text)) return { state, messages: [t(`Your payment of ${money(o?.total ?? 0)} is confirmed ✅ I'm waiting for ${PHARMACY} to share the Delhivery tracking ID 📦`)] };
      return { state, messages: [t(`Your payment is confirmed ✅ I'm waiting for ${PHARMACY} to dispatch and share the Delhivery tracking ID. I'll tell you as soon as I have it 📦`)] };

    case "po_decide":
      if (id === "order_cancel" || /cancel|no\b/i.test(text)) {
        return { state: { step: "end" }, messages: [t("Okay, I've cancelled the order request. Nothing was charged 🙏 Is there anything else I can help you with?")] };
      }
      return { state, messages: [t("Would you like to cancel this order? I won't substitute anything on my own."), CANCEL] };

    case "link_wait":
      if (rx && o && id === "retry_link") return makeLink(rx, { ...o, attempt: o.attempt + 1 }, c, now, [t("Trying that again 🔁")]);
      return { state, messages: [t("I'm setting up your secure payment link. One moment ⏳")] };

    case "pay_wait":
      if (/\b(paid|payment done|done|completed|transferred)\b/i.test(text)) {
        return { state, messages: [t("Thanks, Ramesh. I can't see the payment yet. I only count it once the payment gateway confirms it, so please give it a moment 🙏")] };
      }
      return { state, messages: [t(`Your payment link is ready${o?.link ? `:\n${o.link}` : ""}\nI'll confirm here as soon as the payment goes through ⏳`)] };

    case "pay_retry":
      if (rx && o && (id === "new_link" || /link|again|retry|yes/i.test(text))) {
        return makeLink(rx, { ...o, attempt: o.attempt + 1 }, c, now, [t("Sure, creating a fresh payment link for you 🔗")]);
      }
      return { state, messages: [t("Shall I send you a new payment link?"), NEW_LINK] };

    case "ship_wait": {
      const wantsTrack = id === "track_delivery" || (!id && /\b(track|tracking|where('?s| is) my|status|parcel|consignment|delivery update)\b/i.test(text));
      if (wantsTrack && o?.awb) {
        if (o.tracking) return { state, messages: [t("I'm still waiting for Delhivery's response 📦 I'll tell you as soon as it arrives.")] };
        return {
          state: { ...state, order: { ...o, tracking: true } },
          messages: [t(`Checking with Delhivery for tracking ID ${o.awb}… 🔎`)],
          desk: { requests: [trackRequest(o)], examples: [delhiveryExamples()] },
        };
      }
      const known = o?.stage && o.stage !== "dispatched" ? `Last update: ${o.stage}${o.where ? ` (${o.where})` : ""}.` : "Your order has been dispatched.";
      const idLine = o?.awb ? `\nDelhivery tracking ID: ${o.awb}. You can follow it in the Delhivery app.` : "";
      return { state, messages: [t(`${known}${idLine}`), TRACK] };
    }

    case "delivered":
      if (/thank/i.test(text)) return { state, messages: [t("You're welcome, Ramesh 🙏")] };
      return { state, messages: [t("Your medicines were delivered ✅ If anything is missing or doesn't match your prescription, tell me and I'll help.")] };

    default:
      return null;
  }
}

// ---- events from the outside world -----------------------------------------------------------------
const ack = (system: string, ok: boolean, note: string) => ({ system, ok, note });

function expecting(step: string): string {
  return ({
    rx_wait: "a prescription photo from Ramesh", rx_offer: "Ramesh's answer", po_wait: "the pharmacy's reply", po_decide: "Ramesh's decision",
    pay_approve: "Ramesh's approval of the payment", link_wait: "Pine Labs' response (or payment event)", link_retry: "Ramesh to retry", pay_wait: "a Pine Labs payment event",
    dispatch_wait: "the pharmacy's tracking ID",
    pay_retry: "Ramesh to ask for a new link", ship_wait: "a Delhivery tracking update", delivered: "nothing (delivered)",
  } as Record<string, string>)[step] ?? "nothing";
}

function extractUpi(raw: string): string | undefined {
  // a UPI id has no dot in its handle ("name@okicici"); anything like name@site.com is an email
  return raw.match(/([A-Za-z0-9._-]{2,}@[A-Za-z]{2,})(?!\.?[A-Za-z0-9-])/)?.[1];
}
function extractEta(raw: string): string | undefined {
  const num = "(\\d{1,2}(?:\\s*(?:-|to)\\s*\\d{1,2})?)\\s*(?:business\\s+|working\\s+)?(days?|hours?|hrs?)";
  const m = raw.match(new RegExp(`deliver[^.\\n]{0,40}?${num}`, "i")) || raw.match(new RegExp(num, "i"));
  return m ? `${m[1].replace(/\s+/g, "")} ${/^h/i.test(m[2]) ? "hours" : /^1$/.test(m[1]) ? "day" : "days"}` : undefined;
}
function extractAwb(raw: string): string | undefined {
  const m = raw.match(/(?:tracking|awb|waybill|way bill|consignment|lr)\s*(?:id|no\.?|number|#)?\s*(?:is)?\s*[:#-]?\s*([A-Za-z0-9]*\d[A-Za-z0-9]*)/i);
  return m && m[1].length >= 8 && m[1].length <= 20 ? m[1] : undefined;
}

function parsePharmacy(raw: string): { kind: "unavailable" | "confirmed" | "no_total" | "unclear"; total?: number; upi?: string; eta?: string; text: string } {
  const j = parseJson(raw);
  const upi = extractUpi(raw), eta = extractEta(raw);
  let text = raw.trim(), total: number | undefined;
  if (isObj(j)) {
    text = [j.message, j.status, j.reply, j.text].filter((x) => typeof x === "string").join(". ") || raw;
    const cand = j.total ?? j.grand_total ?? j.total_amount ?? j.amount;
    const n = isObj(cand) ? Number(cand.value) : Number(cand);
    if (Number.isFinite(n) && n > 0) total = n;
  }
  if (total === undefined) {
    // Read amounts from text with the UPI id and long digit runs (phone numbers, ids) taken out, so a
    // numeric UPI handle like 9876543210@ybl is never mistaken for the bill.
    const body = (upi ? raw.replace(upi, " ") : raw).replace(/\b\d{7,}\b/g, " ");
    // Several figures can appear ("item total ₹264, grand total ₹528", "delivery in 4 days"). Read the amount
    // the customer pays, most specific first, and never a number that is really a count of days or items.
    const AMT = "([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?![0-9,.]*\\d)(?!\\s*(?:days?|hours?|hrs?|weeks?|items?|pcs|pieces|strips?|x\\b))";
    const CUR = "(?:₹|rs\\.?|inr)\\s*";
    const last = (re: RegExp) => { const all = [...body.matchAll(re)]; return all.length ? Number(all[all.length - 1][1].replace(/,/g, "")) : undefined; };
    total = last(new RegExp(`(?:grand total|net payable|amount payable|payable|total)[^0-9₹]{0,24}(?:${CUR})?${AMT}`, "gi"))
      ?? last(new RegExp(`(?:amount|bill|pay(?:ment)?|due)[^0-9₹]{0,24}${CUR}${AMT}`, "gi"))          // keyword + currency marker
      ?? last(new RegExp(`(?:amount|bill)[^0-9₹]{0,12}${AMT}\\s*(?:rupees|rs\\b|inr)`, "gi"))        // "bill amount 528 rupees"
      ?? last(new RegExp(`(?:amount|bill)[^0-9₹]{0,10}${AMT}`, "gi"))                                  // "Bill: 528"
      ?? last(new RegExp(`${CUR}${AMT}`, "gi"));                                                      // any rupee figure
  }
  if (total !== undefined && !(total > 0 && total < 100000)) total = undefined;
  if (/out of stock|not available|unavailable|not in stock|shortage|can'?t supply|cannot supply/i.test(raw)) return { kind: "unavailable", text };
  if (total !== undefined) return { kind: "confirmed", total, upi, eta, text };
  if (/confirm|accept|ready|will (deliver|dispatch)|available/i.test(raw)) return { kind: "no_total", text };
  return { kind: "unclear", text };
}

function stageOf(raw: string): { stage: string; where?: string } | null {
  const j = parseJson(raw);
  const strings: { key: string; value: string }[] = [];
  const walk = (v: unknown, key: string) => {
    if (typeof v === "string") strings.push({ key, value: v });
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (isObj(v)) Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  if (j !== undefined) walk(j, ""); else strings.push({ key: "status", value: raw });
  const PATTERNS: [string, RegExp][] = [
    ["rto", /\brto\b|return(ed)? to origin/i], ["lost", /\blost\b/i], ["cancelled", /cancel/i], ["undelivered", /undeliver|not delivered|delivery (attempt )?failed/i],
    ["out for delivery", /out for delivery/i], ["delivered", /\bdelivered\b/i], ["in transit", /in transit|dispatched|reached|arrived|forwarded/i],
    ["picked up", /picked up|ready for pickup|pickup (done|complete)/i], ["packed", /pending|ready to ship|manifest|packed|processing/i],
  ];
  const find = (list: { key: string; value: string }[]) => { for (const [stage, re] of PATTERNS) if (list.some((s) => re.test(s.value))) return stage; return null; };
  // Prefer fields that are called status; fall back to anything in the payload.
  const stage = find(strings.filter((s) => /status|state/i.test(s.key))) ?? find(strings);
  if (!stage) return null;
  const loc = strings.find((s) => /location|city|hub|centre|center/i.test(s.key) && s.value.trim());
  return { stage, where: loc?.value.trim() };
}

const STAGE_MSG: Record<string, (w?: string) => string> = {
  packed: () => "Your order is packed and waiting for the courier to collect it 📦",
  "picked up": () => "The courier has picked up your parcel ✅",
  "in transit": (w) => `Your parcel is on its way 🚚${w ? ` Last seen at ${w}.` : ""}`,
  "out for delivery": () => "Your parcel is out for delivery today 🛵 Please keep your phone nearby.",
  delivered: () => "Your medicines have been delivered ✅ Please check that the pack matches your prescription. If anything is missing or looks different, tell me.",
};


// A Pine Labs payment event, checked against the order before the agent acts on it.
function payEvent(state: DemoState, j: Record<string, any>): DemoResult {
  const sys = "pinelabs";
  const rx = state.rx!, o = state.order!;
  const empty: DemoResult = { state, messages: [] };
  const data = isObj(j.data) ? j.data : j;
  const status = String(data.status ?? j.status ?? "").toUpperCase();
  const evName = String(j.event ?? j.event_type ?? "");
  const ids = [data.payment_link_id, data.merchant_payment_link_reference, data.order_id, data.merchant_order_reference, j.payment_link_id]
    .filter((x): x is string => typeof x === "string" && !!x);
  const known = [o.linkId, o.linkRef, o.payOrderId].filter(Boolean);
  if (!ids.length) return { ...empty, desk: { ack: ack(sys, false, "No payment_link_id, order_id or reference in this event, so the agent can't tie it to the order and ignored it.") } };
  if (!ids.some((x) => known.includes(x))) return { ...empty, desk: { ack: ack(sys, false, `Doesn't match this order (looking for ${known.join(" / ")}), so the agent ignored it.`) } };

  const amt = isObj(data.amount) ? data.amount.value : isObj(data.order_amount) ? data.order_amount.value : isObj(j.amount) ? j.amount.value : undefined;
  const paid = status === "PROCESSED" || /processed/i.test(evName);
  const failed = status === "FAILED" || /failed/i.test(evName) || /failed/i.test(status);
  const expired = status === "EXPIRED" || /expired/i.test(evName);
  const cancelled = status === "CANCELLED" || /cancel/i.test(evName);

  if (paid && !failed) {
    if (typeof amt === "number" && amt !== o.amountValue) {
      return { ...empty, desk: { ack: ack(sys, false, `Payment event amount (${amt}) differs from the amount requested (${o.amountValue}), so the agent did NOT treat it as paid.`) } };
    }
    const linkId = o.linkId ?? (typeof data.payment_link_id === "string" ? data.payment_link_id : undefined);
    return {
      state: { step: "dispatch_wait", rx, order: { ...o, linkId, stage: "payment received" } },
      messages: [
        t(`Pine Labs has approved your payment of ${money(o.total ?? 0)} ✅ Thank you, Ramesh.`),
        t(`I've told ${PHARMACY}. I'll share the Delhivery tracking ID as soon as they send it 📦`),
      ],
      desk: {
        ack: ack(sys, true, "Verified against the order: treated as paid."),
        requests: [{ system: "pharmacy", label: `Payment confirmed: message to ${PHARMACY}`, text: `Order ${o.ref}: payment of ${money(o.total ?? 0)} approved by Pine Labs. Please dispatch and share the Delhivery tracking ID.` }],
        examples: [{ system: "pharmacy", items: [{ label: "Dispatched with tracking ID (sample)", json: `Payment received, thank you! Your order has been handed to Delhivery.\nTracking ID: 3714910042305\nDelivery in ${o.eta ?? "4 days"}.` }] }],
      },
    };
  }
  if (failed) {
    return { state: { step: "pay_retry", rx, order: o }, messages: [t("The payment didn't go through. Nothing was charged to the order. Would you like to try again with a new payment link?"), NEW_LINK], desk: { ack: ack(sys, true, "Read as: payment failed.") } };
  }
  if (expired || cancelled) {
    return { state: { step: "pay_retry", rx, order: o }, messages: [t(`The payment ${expired ? "link has expired" : "was cancelled"}, so nothing has been paid. Would you like a new payment link?`), NEW_LINK], desk: { ack: ack(sys, true, `Read as: ${expired ? "expired" : "cancelled"}.`) } };
  }
  if (status === "CLICKED" || status === "PAYMENT_INITIATED" || /clicked|initiated/i.test(evName)) {
    return { state, messages: [t("I can see the payment has started 👀 I'll wait for Pine Labs to approve it.")], desk: { ack: ack(sys, true, "Read as: payment started.") } };
  }
  return { ...empty, desk: { ack: ack(sys, false, `Status “${status || "(none)"}” isn't one the agent acts on.`) } };
}

export function orderEvent(state: DemoState | null, ev: OrderEvent, c: Clock, now: number): DemoResult {
  const sys = ev.system;
  const raw = (ev.raw ?? "").trim();
  const empty = (s: DemoState | null): DemoResult => ({ state: s ?? { step: "menu" }, messages: [] });
  if (!raw) return { ...empty(state), desk: { ack: ack(sys, false, "Nothing to send: the field is empty.") } };
  if (!state || !state.order || !state.rx) {
    return { ...empty(state), desk: { ack: ack(sys, false, "No order is open, so the agent has nothing to apply this to.") } };
  }
  const { rx, order: o } = state;
  const wrongNow = (): DemoResult => ({ ...empty(state), desk: { ack: ack(sys, false, `Not expected right now: the agent is waiting for ${expecting(state.step)}.`) } });

  // ----- pharmacy -----
  if (sys === "pharmacy") {
    if (state.step === "po_wait") {
      const r = parsePharmacy(raw);
      if (r.kind === "unavailable") {
        return {
          state: { step: "po_decide", rx, order: o },
          messages: [t(`${PHARMACY} says some items aren't available: “${clip(r.text)}”\nI won't substitute anything on my own. Would you like to cancel this order?`), CANCEL],
          desk: { ack: ack(sys, true, "Read as: item(s) unavailable.") },
        };
      }
      if (r.kind === "confirmed" && r.total !== undefined) {
        const o2: OrderData = { ...o, total: r.total, upi: r.upi, eta: r.eta };
        const lines = [`${PHARMACY} has confirmed your order ✅`, "", `🧾 Bill: ${money(r.total)}`];
        if (r.eta) lines.push(`🚚 Delivery: within ${r.eta}`);
        if (r.upi) lines.push(`💳 Pay to UPI ID: ${r.upi}`);
        lines.push("", `They're asking for your payment approval. Shall I go ahead and pay ${money(r.total)}?`);
        return {
          state: { step: "pay_approve", rx, order: o2 },
          messages: [t(lines.join("\n")), APPROVE],
          desk: { ack: ack(sys, true, `Read as: confirmed. Bill ${money(r.total)}${r.eta ? `, delivery ${r.eta}` : ", no delivery time found"}${r.upi ? `, UPI ${r.upi}` : ", no UPI id found"}. Waiting for Ramesh's approval.`) },
        };
      }
      if (r.kind === "no_total") {
        return { state, messages: [t(`${PHARMACY} confirmed, but hasn't shared the bill amount yet. I'll wait for the amount before asking you to approve a payment.`)], desk: { ack: ack(sys, true, "Confirmed, but no bill amount found: the agent is waiting for one.") } };
      }
      return { ...empty(state), desk: { ack: ack(sys, false, "Couldn't tell whether this confirms the order or gives a bill amount, so the agent did nothing.") } };
    }

    if (state.step === "dispatch_wait") {
      const awb = extractAwb(raw);
      if (awb) {
        const eta = extractEta(raw) ?? o.eta;
        return {
          state: { step: "ship_wait", rx, order: { ...o, awb, eta, stage: "dispatched" } },
          messages: [t(`Your order has been dispatched 🚚\nDelhivery tracking ID: ${awb}${eta ? `\nExpected delivery: within ${eta}` : ""}\nYou can track your consignment in the Delhivery app, or ask me to check it for you.`), TRACK],
          desk: { ack: ack(sys, true, `Read as: dispatched, tracking ID ${awb}.`), examples: [delhiveryExamples()] },
        };
      }
      return { state, messages: [t(`Update from ${PHARMACY}: “${clip(raw)}”`)], desk: { ack: ack(sys, true, "No tracking ID found in this; relayed to Ramesh. The agent is still waiting for the ID.") } };
    }

    if (["pay_approve", "link_wait", "pay_wait", "pay_retry", "ship_wait"].includes(state.step)) {
      return { state, messages: [t(`Update from ${PHARMACY}: “${clip(raw)}”`)], desk: { ack: ack(sys, true, "Relayed to Ramesh.") } };
    }
    return wrongNow();
  }

  // ----- Pine Labs -----
  if (sys === "pinelabs") {
    const j = parseJson(raw);
    if (!isObj(j)) return { ...empty(state), desk: { ack: ack(sys, false, "That isn't valid JSON, so it can't be a Pine Labs response or webhook.") } };

    if (state.step === "link_wait") {
      // The reply to our create-link call has a payment_link; anything else shaped like an event is
      // a payment event and is checked against our reference (so the create-link reply can be skipped).
      const looksLikeEvent = !j.payment_link && (j.event || j.event_type || typeof j.status === "string" || isObj(j.data));
      if (looksLikeEvent) return payEvent(state, j);
      const failed = j.error || j.error_code || (typeof j.status === "number" && j.status >= 400) || (typeof j.code === "string" && /ERROR|FAIL/i.test(j.code));
      if (failed || !j.payment_link || !j.payment_link_id) {
        return {
          state, messages: [t("I couldn't create the payment link just now. Shall I try again?"), RETRY_LINK],
          desk: { ack: ack(sys, false, failed ? "Read as: an error response, no link created." : "Missing payment_link / payment_link_id, so no link was created.") },
        };
      }
      if (isObj(j.amount) && typeof j.amount.value === "number" && j.amount.value !== o.amountValue) {
        return {
          state, messages: [t("The payment link came back for a different amount than your order, so I haven't sent it to you. Shall I try again?"), RETRY_LINK],
          desk: { ack: ack(sys, false, `Amount in the response (${j.amount.value}) differs from the request (${o.amountValue}).`) },
        };
      }
      const o2: OrderData = { ...o, link: String(j.payment_link), linkId: String(j.payment_link_id), payOrderId: j.order_id ? String(j.order_id) : undefined };
      return {
        state: { step: "pay_wait", rx, order: o2 },
        messages: [t(`Please complete the payment of ${money(o.total ?? 0)} using this secure link:\n${o2.link}\n\nI'll confirm here as soon as Pine Labs approves it ⏳`)],
        desk: { ack: ack(sys, true, "Link recorded and sent to Ramesh."), examples: [webhookExamples(o2)] },
      };
    }
    if (state.step === "pay_wait") return payEvent(state, j);
    return wrongNow();
  }

  // ----- Delhivery -----
  if (sys === "delhivery") {
    if (state.step !== "ship_wait") return wrongNow();
    const s = stageOf(raw);
    if (!s) return { ...empty(state), desk: { ack: ack(sys, false, "Couldn't find a delivery status (e.g. In Transit, Out for Delivery, Delivered) in this, so the agent did nothing.") } };
    const answering = !!o.tracking;
    const o2: OrderData = { ...o, stage: s.stage, where: s.where, tracking: false };
    if (STAGE_MSG[s.stage]) {
      const done = s.stage === "delivered";
      const text = (answering ? "Here's the latest from Delhivery 📦\n" : "") + STAGE_MSG[s.stage](s.where);
      return {
        state: { step: done ? "delivered" : "ship_wait", rx, order: o2 },
        messages: done ? [t(text)] : [t(text), TRACK],
        desk: { ack: ack(sys, true, `Read as: ${s.stage}${s.where ? ` at ${s.where}` : ""}.`) },
      };
    }
    const label = { rto: "being returned to the pharmacy", lost: "reported lost", cancelled: "cancelled", undelivered: "not delivered (the courier couldn't hand it over)" }[s.stage] ?? s.stage;
    return {
      state: { step: "ship_wait", rx, order: o2 },
      messages: [t(`There's a problem with your delivery: the parcel is ${label}. I haven't changed anything and I won't reorder without your OK. Please contact the pharmacy; I'll keep tracking and tell you when there's news.`), TRACK],
      desk: { ack: ack(sys, true, `Read as: ${s.stage}. Flagged to Ramesh, no action taken.`) },
    };
  }

  return { ...empty(state), desk: { ack: ack(sys, false, "Unknown source.") } };
}
