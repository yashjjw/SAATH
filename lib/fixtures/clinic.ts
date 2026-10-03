// SYNTHETIC test patient for the clinician-mode harness. Nothing here is real. It mirrors the
// worked turns in prompts/clinic.md so the agent has records to ground on instead of inventing
// them. Replace with record.fetch against real storage once consent and storage exist.
export const SESSION_TIMESTAMP = "17 Oct 2026, 09:20 IST";

export const CLINIC_CONTEXT = {
  clinician: {
    name: "Dr. R. Mehta",
    registration_number: "SYNTHETIC-0001",
    specialty: "Cardiology",
    institution: "City Heart Clinic",
    department: "OPD",
    role: "treating",
  },
  session: { timestamp: SESSION_TIMESTAMP, setting: "opd", encounter_id: "enc_synthetic_0001", mode: "pre_consult" },
  patient: {
    saath_id: "sa_synthetic_meera",
    name: "Meera Sharma",
    age: 68,
    sex: "F",
    abha_linked: true,
    consent_scope: ["demographics", "problems", "medications", "labs", "imaging", "documents", "adherence", "family_reported", "encounters", "writeback"],
    consent_expiry: "31 Dec 2026",
    break_glass: false,
  },
  sources_online: ["saath_library", "abha", "hospital_emr", "hospital_lis", "family_reported"],
  sources_degraded: [] as string[],
  patient_directory_matches_for_surname_Sharma: [
    { name: "Meera Sharma", age: 68, sex: "F", last_seen: "12 Oct 2026, Dr. R. Mehta", record_loaded: true },
    { name: "Rakesh Sharma", age: 54, sex: "M", last_seen: "9 Aug 2026, Dr. P. Nair", record_loaded: false },
    { name: "Anjali Sharma", age: 31, sex: "F", last_seen: "3 Oct 2026, Dr. R. Mehta", record_loaded: false },
  ],
};

export const CLINIC_RECORD = {
  coverage: { abha_documents: 6, from: "20 Jun 2026", to: "14 Oct 2026", facilities: ["City Heart Clinic", "Sunrise Hospital", "Metro Diagnostics"], earlier_than_20_Jun: "no records in any connected source" },
  care_circle: [
    { name: "Meera", role: "patient" },
    { name: "Neha", role: "caregiver, owns tasks" },
    { name: "Arjun", role: "payment authority, Rs 1,500 per order" },
  ],
  problems: [
    { problem: "Hypertension", recorded: "20 Jun 2026", by: "Dr. R. Mehta", facility: "City Heart Clinic", grade: "A" },
  ],
  allergies_and_reactions: "no entries in any connected source",
  encounters: [
    {
      date: "12 Oct 2026", clinician: "Dr. R. Mehta", booked_as: "hypertension review", grade_of_transcript: "C",
      prescription_12_Oct: [
        { drug: "Telmisartan", strength: "40 mg", schedule: "1 OD, after breakfast" },
        { drug: "Amlodipine", strength: "5 mg", schedule: "morning" },
        { drug: "Vitamin D", strength: "not stated on prescription", schedule: "weekly, Sunday" },
      ],
      tests_ordered: [{ test: "CBC", ordered: "12 Oct 2026", by: "Dr. R. Mehta", repeat_interval_set_by_prescriber: "4 weeks" }],
      transcript_excerpt: "Amlodipine to be taken in the evening",
      seated_bp: { value: "134/84", source: "clinic slip, 12 Oct 2026", printed_interval: "none printed" },
      booked_follow_up: "follow-up, blood pressure",
    },
  ],
  results: [
    { analyte: "Haemoglobin", value: 12.4, unit: "g/dL", date: "20 Jun 2026", lab: "Metro Diagnostics", printed_interval: "12.0-15.0", lab_flag: null, grade: "A" },
    { analyte: "Haemoglobin", value: 12.1, unit: "g/dL", date: "3 Aug 2026", lab: "Metro Diagnostics", printed_interval: "12.0-15.0", lab_flag: null, grade: "A" },
    { analyte: "Haemoglobin", value: 11.8, unit: "g/dL", date: "14 Oct 2026", lab: "Metro Diagnostics", printed_interval: "12.0-15.0", lab_flag: "L", grade: "A" },
    { analyte: "Fasting glucose", value: 104, unit: "mg/dL", date: "14 Oct 2026", lab: "Metro Diagnostics", printed_interval: "70-100", lab_flag: "H", grade: "A" },
    { analyte: "Total cholesterol", value: 186, unit: "mg/dL", date: "3 Aug 2026", lab: "Metro Diagnostics", printed_interval: "<200", lab_flag: null, grade: "A" },
    { analyte: "HDL cholesterol", value: 52, unit: "mg/dL", date: "3 Aug 2026", lab: "Metro Diagnostics", printed_interval: ">40", lab_flag: null, grade: "A" },
    { analyte: "Creatinine", value: 0.9, unit: "mg/dL", date: "14 Oct 2026", lab: "Metro Diagnostics", printed_interval: "0.6-1.1", lab_flag: null, grade: "A" },
    { analyte: "Potassium", value: 4.2, unit: "mmol/L", date: "14 Oct 2026", lab: "Metro Diagnostics", printed_interval: "3.5-5.1", lab_flag: null, grade: "A" },
  ],
  tests_with_no_result_in_any_source: ["CBC (ordered 12 Oct 2026). Ferritin, B12, folate, iron studies, reticulocyte count and thyroid profile have no entries at all."],
  documents: [
    { type: "Echocardiography report (text)", date: "20 Jun 2026", facility: "Sunrise Hospital", grade: "A", images_in_scope: false },
  ],
  medications: {
    prescribed: ["Telmisartan 40 mg 1 OD after breakfast (Rx 12 Oct)", "Amlodipine 5 mg, morning per Rx 12 Oct", "Vitamin D weekly Sunday (Rx 12 Oct)"],
    dispensed: [
      { item: "Telmisartan 40 mg, 30 tablets", date: "12 Oct 2026", pharmacy: "Sharma Medical Store", tier: 1 },
      { item: "pack photograph reads Telmisartan 40 mg + Chlorthalidone 12.5 mg", date: "16 Oct 2026", source: "saath_library, read by SAATH, original attached, legible", tier: 2 },
    ],
    reported: [],
    institutional_emr_active_list: ["Telmisartan 40 mg", "Amlodipine 5 mg", "Vitamin D"],
    note: "Refill and payment for Telmisartan are on hold in the patient-side system pending a prescriber or pharmacist answer.",
  },
  adherence_evidence: {
    telmisartan: {
      tier1: ["Dispensed 30 tablets on 12 Oct 2026, Sharma Medical Store", "Next refill not collected as of 17 Oct 2026; 30-day supply from 12 Oct covers to 11 Nov 2026"],
      tier3: "Reminder acknowledged on 24 of 28 scheduled occasions since 12 Oct 2026; 4 occasions carry no acknowledgement",
    },
  },
  reported_since_last_visit: [
    {
      event: "Dizziness on standing", reported_by: "Meera", when: "15 Oct 2026, 9:40 PM", channel: "app", grade: "C",
      her_words: "subah uthte waqt chakkar aata hai, 2-3 din se", onset_as_reported: "2 to 3 days", urgent_flag: false, assessed_by_clinician: false,
      medicines_started_or_changed_in_previous_14_days: ["Telmisartan 40 mg, started 12 Oct 2026"],
    },
  ],
  postural_bp_in_record: false,
  open_care_packets: [{ action: "CBC report to be uploaded", owner: "Neha", state: "open", waits_on: "result upload" }],
};
