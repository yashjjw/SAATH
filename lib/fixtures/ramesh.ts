// Ramesh Sharma's record as the doctor's desk sees it. FICTIONAL mock data.
// What is real in the demo: the doctors, clinics and visit dates already used in the Saath booking
// flow (Dr. Meera Kulkarni, Heartcare Clinic, 3 visits, last 14 Mar 2026, amlodipine 5 mg;
// Dr. Anil Joshi, City Heart Centre, 1 visit, Nov 2023) and today's prescription (Telma CT 40,
// Ecosprin AV 75, Pan-D 40, each 1-0-0). The two recorded problems below are mock history written
// for this demo: edit them freely.
import { SAMPLE_EXTRACTION } from "./prescription.js";

export const RAMESH = {
  name: "Ramesh Sharma", age: 63, sex: "M", city: "Indore",
  caregiver: { name: "Karan", relation: "son", city: "Bengaluru" },
  problems: [
    { problem: "Hypertension", recorded: "Nov 2023", by: "Dr. Anil Joshi", where: "City Heart Centre, Palasia" },
    { problem: "Dyslipidaemia", recorded: "14 Mar 2026", by: "Dr. Meera Kulkarni", where: "Heartcare Clinic, Vijay Nagar" },
  ],
  allergies: [] as string[],                       // none recorded in any connected source
  visits: [
    { where: "Heartcare Clinic, Vijay Nagar", doctor: "Dr. Meera Kulkarni", count: 3, last: "14 Mar 2026", note: "prescribed amlodipine 5 mg" },
    { where: "City Heart Centre, Palasia", doctor: "Dr. Anil Joshi", count: 1, last: "Nov 2023", note: "" },
  ],
  priorMedicine: { name: "Amlodipine 5 mg", by: "Dr. Meera Kulkarni", date: "14 Mar 2026" },
  // today's SAATH upload (medicines and tests come from the scripted prescription)
  prescription: {
    meds: SAMPLE_EXTRACTION.lines.map((l) => ({ name: `${l.drug_name} ${l.strength}`, dose: l.dose_instruction ?? "" })),
    tests: SAMPLE_EXTRACTION.tests ?? [],
  },
  coverage: { from: "Nov 2023", facilities: 2 },
};
