// Test-report upload (a PDF) -> plain-language summary -> send to the doctor and/or family.
// The summary is FIXED text for the demo (Ramesh's reports of 3 October). The uploaded PDF is
// checked to be a PDF but its contents are not analysed: reading real lab reports would need a model.
import type { DemoState, DemoResult, Msg } from "./saath.js";

export interface UploadedDoc { name?: string; size?: number; mime?: string }
export const isPdf = (d: UploadedDoc | undefined) => !!d && (/pdf/i.test(d.mime ?? "") || /\.pdf$/i.test(d.name ?? ""));

const DOCTOR = "Dr. Meera Kulkarni";
const FAMILY = "Karan";

export const REPORT_SUMMARY = [
  "Ramesh ji, your tests from 3 October are back. Most things look fine, but three need your doctor's attention.",
  "*Not fine*",
  "*Sugar:* Your sugar is high. The test that shows your average sugar over the last three months is 8.6%. A healthy level is under 5.7%.",
  "*Liver:* Your liver tests are higher than normal. They are about double what they were in March. The lab says this could mean your liver is irritated or stressed.",
  "*Cholesterol:* Your cholesterol is high. The \"good\" cholesterol is low and the \"bad\" one is high.",
  "*Fine*",
  "Your blood count, kidneys and thyroid are normal.\nYour heart tracing (ECG) is mostly normal and the rhythm is regular. There is one small change that was not there last time. The lab says it is minor and your doctor should look at it.",
  "*Compared with your earlier reports*\nYour sugar and cholesterol have been creeping up every time. The liver numbers are the biggest jump.",
  "_This is not a diagnosis. Only your doctor can tell you what it means, so please show them this report soon._",
].join("\n\n");

const t = (text: string): Msg => ({ kind: "text", text });
const MENU_HINT = "Is there anything else I can help you with?";

function sendOptions(sent: string[]): Msg | null {
  const d = sent.includes("doctor"), f = sent.includes("family");
  if (d && f) return null;
  const o: { id: string; label: string }[] = [];
  if (!d) o.push({ id: "rpt_doctor", label: d ? "" : f ? `Send to ${DOCTOR} too` : `Send to ${DOCTOR}` });
  if (!f) o.push({ id: "rpt_family", label: d ? `Send to ${FAMILY} too` : `Send to ${FAMILY}` });
  if (!d && !f) o.push({ id: "rpt_both", label: "Send to both" });
  o.push({ id: "rpt_done", label: sent.length ? "Done" : "Not now" });
  return { kind: "buttons", options: o };
}

// A PDF arrived (from the 📎 button). Its name and size are kept so the doctor can be sent the complete report.
export function reportFromUpload(doc?: UploadedDoc): DemoResult {
  return {
    state: { step: "rpt_sent", sent: [], doc: { name: doc?.name || "test-reports.pdf", size: doc?.size ?? 0 } },
    messages: [
      t("Got it, reading your test reports 🔍"),
      { kind: "card", text: REPORT_SUMMARY },
      t(`Would you like me to send this to your doctor or to ${FAMILY}? ${DOCTOR} would get the summary *and* your complete report. ${FAMILY} would get the summary.`),
      sendOptions([])!,
    ],
  };
}

export function reportWait(state: DemoState): DemoResult {
  return { state, messages: [t("Send me your test reports as a PDF using 📎 and I'll explain them in simple words 🧪")] };
}

// Buttons / typed text once the summary is on screen.
export function reportStep(state: DemoState, input: { id?: string; text?: string }): DemoResult | null {
  if (state.step === "rpt_wait") return reportWait(state);
  if (state.step !== "rpt_sent") return null;
  const id = input.id ?? "", text = (input.text ?? "").trim();
  const both = id === "rpt_both" || (!id && /\bboth\b/i.test(text));
  const doctor = id === "rpt_doctor" || both || (!id && /\b(doctor|dr\.?|kulkarni)\b/i.test(text));
  const family = id === "rpt_family" || both || (!id && /\b(karan|son|family|beta)\b/i.test(text));
  const done = id === "rpt_done" || (!id && /^\s*(no|not now|nahi|later|done|skip)\b/i.test(text));
  const sent = state.sent ?? [];

  if (done) {
    return { state: { step: "end" }, messages: [t(sent.length ? `Okay 🙏 ${MENU_HINT}` : `Okay 🙏 I haven't sent it to anyone. You can show it to your doctor yourself. ${MENU_HINT}`)] };
  }
  if (doctor || family) {
    const now = [...sent];
    const out: Msg[] = [];
    const doc = state.doc ?? { name: "test-reports.pdf", size: 0 };
    if (doctor && !now.includes("doctor")) {
      now.push("doctor");
      out.push(t(`Done ✅ I've sent *${DOCTOR}* at Heartcare Clinic the summary and your complete report.`));
      out.push({ kind: "document", name: doc.name, size: doc.size, label: `Complete report sent to ${DOCTOR}` });
    }
    if (family && !now.includes("family")) {
      now.push("family");
      out.push(t(`Done ✅ I've sent *${FAMILY}* the summary. He didn't get the full report.`));
    }
    if (!out.length) return { state, messages: [t("I've already sent it there 👍")] };
    out.push(t("I shared only that, not your other records."));
    const more = sendOptions(now);
    return { state: { step: more ? "rpt_sent" : "end", sent: now, doc: state.doc }, messages: [...out, ...(more ? [more] : [t(`That's everyone. ${MENU_HINT}`)])] };
  }
  return { state, messages: [t("Would you like me to send this to your doctor (summary and complete report) or to Karan (summary)?"), sendOptions(sent) ?? t(MENU_HINT)] };
}
