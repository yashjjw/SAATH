// The prescription shown in the scripted demo (Ramesh Sharma's, from the simulation plan).
// Medicines are exactly as named in the plan: Telma CT 40, Ecosprin AV 75, Pan-D 40, each 1-0-0.
//
// !! The plan says the prescription advises "9 tests" but does not name them. The nine below are
// !! PLACEHOLDERS (common tests for these medicines), not read from the real prescription.
// !! Replace them with the exact nine tests from your prescription.
import type { PrescriptionExtraction, MedicationLine } from "../schema.js";

const med = (drug: string, strength: string): MedicationLine => ({
  drug_name: drug, strength, form: "tablet", dose_instruction: "1-0-0", duration: null,
  confidence: "CLEAR", unclear_reason: null, source_note: "prescription photo",
});

export const SAMPLE_EXTRACTION: PrescriptionExtraction = {
  is_prescription: true,
  doctor_or_clinic: null,
  date_on_document: null,
  overall_note: null,
  lines: [med("Telma CT", "40"), med("Ecosprin AV", "75"), med("Pan-D", "40")],
  tests: [
    "CBC",
    "Lipid profile",
    "Fasting blood sugar",
    "HbA1c",
    "Serum creatinine",
    "Serum electrolytes",
    "Liver function test (LFT)",
    "ECG",
    "Thyroid profile (TSH)",
  ],
};
