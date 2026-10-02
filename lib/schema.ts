// Structured output the model must produce for a prescription photo (PRD R01).
// The model PROPOSES; nothing here is executable until the user confirms.
export type Confidence = "CLEAR" | "UNCLEAR";

export interface MedicationLine {
  drug_name: string | null;
  strength: string | null;      // keep exactly as written, e.g. "500 mg"
  form: string | null;          // tablet, syrup...
  dose_instruction: string | null; // e.g. "1-0-1 after food"
  duration: string | null;
  confidence: Confidence;
  unclear_reason: string | null; // required when UNCLEAR
  source_note: string;          // where on the image it was read (line/position)
}

export interface PrescriptionExtraction {
  is_prescription: boolean;
  doctor_or_clinic: string | null;
  date_on_document: string | null;
  lines: MedicationLine[];
  overall_note: string | null;
}

export const EXTRACT_TOOL = {
  name: "record_prescription_extraction",
  description:
    "Record what is literally legible on the prescription image. Never guess unreadable strengths or names: mark the line UNCLEAR and say why.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_prescription: { type: "boolean" },
      doctor_or_clinic: { type: ["string", "null"] },
      date_on_document: { type: ["string", "null"] },
      overall_note: { type: ["string", "null"] },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            drug_name: { type: ["string", "null"] },
            strength: { type: ["string", "null"] },
            form: { type: ["string", "null"] },
            dose_instruction: { type: ["string", "null"] },
            duration: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["CLEAR", "UNCLEAR"] },
            unclear_reason: { type: ["string", "null"] },
            source_note: { type: "string" },
          },
          required: ["drug_name", "strength", "form", "dose_instruction", "duration", "confidence", "unclear_reason", "source_note"],
        },
      },
    },
    required: ["is_prescription", "doctor_or_clinic", "date_on_document", "overall_note", "lines"],
  },
};
