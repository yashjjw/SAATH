// The doctor's side of the Saath chat: a ~200-word history summary for the clinician, then answers
// to the questions they ask. Used by the "Doctor visit" menu option (lib/saath.ts).
// Deterministic: every answer is read from the record (lib/fixtures/ramesh.ts) with its source and
// date, follows the clinician-side rules (point at the record, never diagnose, "no record" is not
// "normal"), and clinical judgement questions get a one-line boundary plus the adjacent data.
import type { Clock } from "./clock.js";
import { RAMESH as R } from "./fixtures/ramesh.js";

const list = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " and $1");

// ~200 words, in the order a doctor scans: who, problems, medicines, tests, gaps.
export function summaryText(c: Clock): string {
  const rx = R.prescription, up = c.today.d + " " + c.today.monShort;
  const meds = list(rx.meds.map((m) => m.name));
  return [
    `*${R.name}, ${R.age}${R.sex}, ${R.city}.* Last seen at Heartcare Clinic on ${R.visits[0].last} by ${R.visits[0].doctor} (${R.visits[0].count} visits there). Earlier: ${R.visits[1].doctor}, City Heart Centre, ${R.visits[1].last}.`,
    `*Problems on record:* ${R.problems.map((p) => `${p.problem.toLowerCase()} (${p.by}, ${p.recorded})`).join("; ")}. No allergy or adverse reaction is recorded in any connected source.`,
    `*Medicines:* ${R.priorMedicine.by} prescribed ${R.priorMedicine.name.toLowerCase()} on ${R.priorMedicine.date}. A prescription uploaded through SAATH on ${up} lists ${meds}, each ${rx.meds[0].dose}. ${R.priorMedicine.name} is not on it, and no document records it being stopped.`,
    `*Tests:* ${rx.tests.length} are advised on that prescription (${list(rx.tests)}). No result for any of them is in the record.`,
    `*Since last visit:* no symptoms or side effects reported through SAATH. No dispensing or reminder records yet, so adherence cannot be described.`,
    `*Coverage:* ${R.coverage.facilities} facilities, ${R.coverage.from} to ${up}. ABHA is not linked. Anything earlier, or from another facility, is not here and is not known to be absent.`,
  ].join("\n\n");
}

// ---- questions ------------------------------------------------------------------------------------
const TEST_WORDS: [RegExp, string][] = [
  [/\b(cbc|complete blood|haemoglobin|hemoglobin|hb)\b/i, "CBC"], [/\b(hba1c|a1c)\b/i, "HbA1c"], [/\b(sugar|glucose|diabet)\w*/i, "Fasting blood sugar"],
  [/\b(creatinine|kidney|renal)\b/i, "Serum creatinine"], [/\b(electrolyte|sodium|potassium)\b/i, "Serum electrolytes"], [/\b(lipid|cholesterol|ldl|hdl)\b/i, "Lipid profile"],
  [/\b(lft|liver)\b/i, "Liver function test (LFT)"], [/\becg|ekg\b/i, "ECG"], [/\b(thyroid|tsh)\b/i, "Thyroid profile (TSH)"],
];
const OTHER_TESTS = /\b(echo|echocardiogram|2d echo|tmt|stress test|angiogra\w*|holter|x-?ray|ct scan|mri|bnp|troponin|ferritin|b12|vitamin|inr)\b/i;

function noRecord(what: string, c: Clock): string {
  return `No record of ${what} in any connected source, covering ${R.coverage.from} to ${c.today.d} ${c.today.monShort}. Nothing before ${R.coverage.from} is in any connected source.`;
}
function meds(c: Clock): string {
  const up = `${c.today.d} ${c.today.monShort}`;
  return `*Medicines on record*\n` +
    R.prescription.meds.map((m) => `• ${m.name}, ${m.dose}: prescription uploaded through SAATH on ${up}, prescriber not stated`).join("\n") +
    `\n• ${R.priorMedicine.name}: prescribed by ${R.priorMedicine.by}, ${R.priorMedicine.date}. Not on the ${up} prescription; no document records it being stopped.`;
}
function problems(): string {
  return `*Problems on record*\n` + R.problems.map((p) => `• ${p.problem}: recorded ${p.recorded} by ${p.by}, ${p.where}`).join("\n");
}
function visits(): string {
  return `*Visits on record*\n` + R.visits.map((v) => `• ${v.where}, ${v.doctor}: ${v.count} visit${v.count > 1 ? "s" : ""}, last ${v.last}${v.note ? ` (${v.note})` : ""}`).join("\n") +
    `\nDates of the earlier ${R.visits[0].count - 1} Heartcare visits are not in the record.`;
}

function judgement(text: string, c: Clock): string | null {
  const drug = /\b(increase|decrease|uptitrat\w*|titrat\w*|switch|substitut\w*|stop|start|add|dose|dosage|recommend\w*|suggest\w*|should (i|we)|which (drug|medicine|tablet)|better)\b/i;
  const dx = /\b(diagnos\w*|differential|prognosis|could (it|this|that) be|is (it|this|that) (anaemi\w*|diabet\w*|hypertens\w*|cardiac|serious|safe|normal|controlled)|safe to|risk( score)?|chances|likely|what would you)\b/i;
  if (!drug.test(text) && !dx.test(text)) return null;
  const lead = drug.test(text) && !/\b(diagnos|could|is (it|this))/i.test(text) ? "That's yours to decide." : "I can't read it for you.";
  const up = `${c.today.d} ${c.today.monShort}`;
  return `${lead} What the record holds: ${R.problems.map((p) => `${p.problem.toLowerCase()} (${p.recorded})`).join(" and ")}; ` +
    `${R.priorMedicine.name.toLowerCase()} prescribed ${R.priorMedicine.date}, and the ${up} prescription of ${list(R.prescription.meds.map((m) => m.name))}. ` +
    `No laboratory results, vitals or reported symptoms are in the record.`;
}

// One answer to one question, as plain text. `id` is a suggested-question button, `text` free text.
export function doctorAnswer(text: string, id: string | undefined, c: Clock): string {
  const wants = (key: string, re: RegExp) => id === key || (!id && re.test(text));
  const j = !id ? judgement(text, c) : null;
  if (j) return j;

  if (wants("q_summary", /\b(summary|summari[sz]e|brief|overview|recap)\b/i)) return summaryText(c);
  if (wants("q_allergy", /\b(allerg\w*|adverse|reaction|intoleran\w*)\b/i)) {
    return R.allergies.length ? `Allergies: ${list(R.allergies)}.` : `No allergy or adverse reaction is recorded in any connected source. That is an absence of records, not confirmation that he has none.`;
  }
  if (wants("q_symptoms", /\b(symptom\w*|complain\w*|side effects?|dizz\w*|chest pain|breathless\w*|palpitation\w*|swelling|cough|fever|fatigue|pain|reported)\b/i)) {
    const named = text.match(/\b(dizz\w*|chest pain|breathless\w*|palpitation\w*|swelling|cough|fever|fatigue)\b/i)?.[1];
    return `${named ? `No record of ${named.toLowerCase()}. ` : ""}No symptoms or side effects have been reported through SAATH. That is an absence of reports, not confirmation that there are none.`;
  }
  if (wants("q_labs", /\b(lab|labs|results?|reports?|blood|tests?|investigation\w*)\b/i) || TEST_WORDS.some(([re]) => re.test(text)) || OTHER_TESTS.test(text)) {
    const hit = id ? undefined : TEST_WORDS.find(([re]) => re.test(text))?.[1];
    const up = `${c.today.d} ${c.today.monShort}`;
    if (hit && R.prescription.tests.includes(hit)) return `${hit}: advised on the ${up} prescription, but no result is in any connected source, covering ${R.coverage.from} to ${up}. Nothing before ${R.coverage.from} is in any connected source.`;
    const other = !id ? text.match(OTHER_TESTS)?.[1] : undefined;
    if (other) return noRecord(other, c);
    if (hit) return noRecord(hit.toLowerCase(), c);
    return `No laboratory results are in the record. ${R.prescription.tests.length} tests are advised on the ${up} prescription, none resulted yet: ${list(R.prescription.tests)}.`;
  }
  if (wants("q_visits", /\b(visit\w*|last seen|seen|previous|earlier|follow.?up|who did he see|other doctor|consult\w*|encounter\w*)\b/i)) return visits();
  const taking = /\b(taking|adheren\w*|complian\w*|refill\w*|consum\w*|does he take)\b/i;
  if (!id && taking.test(text)) {
    return `I can't tell you that. Evidence I have: none yet. There are no dispensing, refill or reminder records in SAATH, so nothing shows whether he is taking his medicines.`;
  }
  if (wants("q_meds", /\b(medicin\w*|medication\w*|drugs?|tablets?|prescri\w*|on|amlodipine|telma|ecosprin|pan-?d)\b/i)) return meds(c);
  if (/\b(problem\w*|condition\w*|diagnos\w*|comorbid\w*|history|hypertens\w*|lipid|cholesterol|bp)\b/i.test(text)) return problems();
  if (/\b(son|daughter|family|caregiver|contact|karan|who (is|comes|accompan\w*))\b/i.test(text)) return `${R.caregiver.name} (${R.caregiver.relation}, ${R.caregiver.city}) is the caregiver on record.`;
  if (/\b(why|reason|booked|appointment|here for)\b/i.test(text)) return `Booked through SAATH: a cardiologist appointment with you, ${c.appt.label} at 11:30 am (earliest morning slot requested). No other reason was given.`;
  if (/\b(thank|thanks)\b/i.test(text)) return "You're welcome, Doctor 🙏";
  return "I don't have that in the record. I can answer about medicines, allergies, tests, visits, problems or reported symptoms.";
}
