// Ramesh Sharma's shared health record, as the doctor sees it in Doctor Mode (Feature 2 mock).
// FICTIONAL mock data. Everything here is "shared by the patient": uploaded reports and
// information Ramesh typed in. Nothing is clinician-verified, and the summary says so.
const bp = (s: number, d: number) => ({ sys: s, dia: d });

export const RAMESH = {
  name: "Ramesh Sharma", age: 63, sex: "M",
  reasonForVisit: "Routine BP check-up",
  condition: "Hypertension since 2019",
  medicine: { name: "Amlodipine 5 mg", when: "morning" },
  allergy: "Penicillin",
  familyHistory: "Father had a heart attack at age 66",
  lifestyle: "Non-smoker. Walks around 30 minutes daily.",
  reports: [
    { name: "ECG", date: "14 March 2026", short: "Mar 2026", finding: "Normal sinus rhythm, no acute changes.", page: 1 },
    { name: "Lipid Profile", date: "Mar 2026", short: "Mar 2026", finding: null },   // report on file; values not extracted
  ],
  // The patient's own symptom statement, made 2 days before the visit.
  statement: { daysAgo: 2, quote: "Sometimes I feel short of breath while climbing stairs." },
  // Home BP entered by the patient over the last 14 days: avg 148/92, range 138/86 to 158/96,
  // 9 of 14 above 140/90 (either number above its limit).
  homeBp: [
    bp(138, 86), bp(139, 88), bp(140, 90), bp(138, 88), bp(140, 90),
    bp(158, 96), bp(156, 96), bp(155, 95), bp(154, 95), bp(153, 94), bp(152, 94), bp(151, 93), bp(150, 92), bp(148, 91),
  ],
};
