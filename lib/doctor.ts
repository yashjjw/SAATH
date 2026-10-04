// The doctor's side of the Saath chat (Feature 2): the one-page Doctor Summary Ramesh can show, then
// Doctor Mode, where the doctor asks questions and Saath answers only from what Ramesh has shared,
// with the source. Saath never diagnoses, recommends treatment or makes clinical decisions.
// Deterministic: no model. The record is fictional (lib/fixtures/ramesh.ts).
import type { Clock } from "./clock.js";
import { RAMESH as R } from "./fixtures/ramesh.js";

const SOURCE_NOTE = "_Source: patient-uploaded reports and patient-provided information. This may not represent a complete clinical history and has not been independently verified._";

export function doctorSummaryCard(): string {
  const avg = homeBp();
  return [
    `📋 *Doctor Summary: ${R.name}, ${R.age} ${R.sex}*`,
    `*Reason for visit:* ${R.reasonForVisit}`,
    `*Known condition:* ${R.condition}`,
    `*Current medicine:* ${R.medicine.name} — ${R.medicine.when}`,
    `*Recent readings:* Average home BP ${avg.avg} over the last 2 weeks\n_Patient-entered readings_`,
    `*Latest reports:* ${R.reports.map((r) => `${r.name} — ${r.short}`).join("; ")}`,
    `*Allergy:* ${R.allergy}\n_As stated by patient_`,
    `*Family history:* ${R.familyHistory}`,
    `*Lifestyle:* ${R.lifestyle}`,
    SOURCE_NOTE,
  ].join("\n\n");
}

export const DOCTOR_VIEW_BANNER = `*Doctor View*\n\nAnswers come only from records and information ${R.name} has shared.\n\nSaath does not diagnose, recommend treatment or make clinical decisions.`;

function homeBp() {
  const n = R.homeBp.length;
  const mean = (k: "sys" | "dia") => Math.round(R.homeBp.reduce((a, x) => a + x[k], 0) / n);
  const lo = R.homeBp.reduce((a, x) => (x.sys < a.sys ? x : a));
  const hi = R.homeBp.reduce((a, x) => (x.sys > a.sys ? x : a));
  const above = R.homeBp.filter((x) => x.sys > 140 || x.dia > 90).length;
  return { n, avg: `${mean("sys")}/${mean("dia")}`, range: `${lo.sys}/${lo.dia} to ${hi.sys}/${hi.dia}`, above };
}

export interface DoctorAnswer { text: string; reportButton?: boolean }

const ecg = R.reports[0];

// The doctor's questions. `id` is a suggested-question button, `text` free text.
export function doctorAnswer(text: string, id: string | undefined, c: Clock): DoctorAnswer {
  const wants = (key: string, re: RegExp) => id === key || (!id && re.test(text));
  const stated = c.at(-R.statement.daysAgo);
  const statedOn = `${stated.d} ${stated.monShort}`;

  // Clinical judgement is the doctor's: one line of boundary, then what the records hold.
  const drug = /\b(increase|decrease|uptitrat\w*|titrat\w*|switch|substitut\w*|stop|start|add|dose|dosage|recommend\w*|suggest\w*|should (i|we)|which (drug|medicine|tablet)|better)\b/i;
  const dx = /\b(diagnos\w*|differential|prognosis|could (it|this|that) be|is (it|this|that) (anaemi\w*|diabet\w*|hypertens\w*|cardiac|serious|safe|normal|controlled)|safe to|risk( score)?|chances|likely|what would you)\b/i;
  if (!id && (drug.test(text) || dx.test(text))) {
    const lead = drug.test(text) && !/\b(diagnos|could|is (it|this))/i.test(text) ? "That's yours to decide." : "I can't read it for you.";
    return { text: `${lead} What the shared records hold: ${R.condition.toLowerCase()} (as stated by the patient), ${R.medicine.name.toLowerCase()} in the ${R.medicine.when}, home BP averaging ${homeBp().avg} (patient-entered), an ECG report from ${ecg.date}, and a lipid profile from ${R.reports[1].date}.` };
  }

  if (wants("q_ecg", /\b(ecg|ekg|electrocardio\w*)\b/i)) {
    return {
      text: `The most recent ECG in ${R.name}'s shared records is from *${ecg.date}*.\n\nThe report states:\n\n*"${ecg.finding}"*\n\nSource: ECG report · ${ecg.date}`,
      reportButton: true,
    };
  }
  if (wants("q_symptoms", /\b(dizz\w*|chest|discomfort|breathless\w*|short of breath|symptom\w*|palpitation\w*|pain|complain\w*|swelling|fatigue)\b/i)) {
    return {
      text: `I don't have any record of dizziness or chest discomfort in the uploaded documents.\n\n${R.name.split(" ")[0]} did tell me on *${statedOn}*:\n\n*"${R.statement.quote}"*\n\nSource: Patient statement · ${statedOn}\n\nI don't have any other symptom information recorded. Please confirm directly with ${R.name.split(" ")[0]}.`,
    };
  }
  if (wants("q_bp", /\b(bp|blood pressure|readings?|trend|hypertension readings)\b/i)) {
    const b = homeBp();
    return {
      text: `Patient-entered home BP readings from the last ${b.n} days:\n\n*Average:* ${b.avg}\n*Range:* ${b.range}\n*${b.above} of ${b.n} readings:* above 140/90\n\nSource: Home BP entries by patient\n\n_The home BP device has not been clinically validated by Saath._`,
    };
  }
  if (wants("q_meds", /\b(medicin\w*|medication\w*|drugs?|tablets?|on|taking|amlodipine|prescri\w*)\b/i)) {
    if (!id && /\b(taking|adheren\w*|complian\w*|refill\w*)\b/i.test(text)) {
      return { text: `I can't tell you that. ${R.name.split(" ")[0]} lists ${R.medicine.name} (${R.medicine.when}) as his current medicine. I have no dispensing, refill or reminder records, so nothing shows whether he takes it.` };
    }
    return { text: `*Current medicine:* ${R.medicine.name} — ${R.medicine.when}\n\nSource: medicine information shared by ${R.name.split(" ")[0]}. I don't have a prescription document for it, or any other medicine on record.` };
  }
  if (wants("q_allergy", /\b(allerg\w*|adverse|reaction|intoleran\w*)\b/i)) {
    return { text: `*Allergy:* ${R.allergy}\n\nSource: stated by the patient. It is not recorded by a clinician in the shared records. I have no record of any other allergy, which is not confirmation that there is none.` };
  }
  if (/\b(lipid|cholesterol|ldl|hdl|triglycerid\w*)\b/i.test(text)) {
    return { text: `A lipid profile from *${R.reports[1].date}* is in ${R.name.split(" ")[0]}'s shared records. I haven't extracted its values, so I can't quote them. Please open the report.\n\nSource: Lipid profile report · ${R.reports[1].date}` };
  }
  if (/\b(family|father|mother|parent\w*|heredit\w*)\b/i.test(text)) return { text: `${R.familyHistory}.\n\nSource: stated by the patient.` };
  if (/\b(smok\w*|alcohol|lifestyle|exercise|walk\w*|diet|habit\w*)\b/i.test(text)) return { text: `${R.lifestyle}\n\nSource: stated by the patient.` };
  if (/\b(why|reason|here for|visit)\b/i.test(text)) return { text: `*Reason for visit:* ${R.reasonForVisit}\n\nSource: stated by the patient.` };
  if (/\b(condition\w*|problem\w*|diagnos\w*|history|since when|comorbid\w*)\b/i.test(text)) return { text: `*Known condition:* ${R.condition}\n\nSource: stated by the patient. I have no clinician-recorded diagnosis in the shared records.` };
  if (/\b(report\w*|test\w*|lab\w*|result\w*)\b/i.test(text)) {
    return { text: `Reports in the shared records: ${R.reports.map((r) => `${r.name} (${r.date})`).join("; ")}. Ask about either and I'll show what I have.` };
  }
  if (/\b(thank|thanks)\b/i.test(text)) return { text: "You're welcome, Doctor 🙏" };
  return { text: "I don't have that in the records Ramesh has shared. I can answer about his ECG, symptoms he has told me about, home BP, medicine, allergy, reports, family history or lifestyle." };
}

export function ecgReportCard(): string {
  return `📄 *ECG report — Page ${ecg.page}*\n${ecg.date}\n\n"${ecg.finding}"\n\nSource: ECG report · ${ecg.date}`;
}
